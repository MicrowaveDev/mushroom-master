// Solo run scenario — one long flow, multi-round, with checkpoint assertions
// between each phase.
//
// Why this exists: the granular tests in loadout-refactor.test.js,
// run-lifecycle.test.js, run-lock.test.js and run-guards.test.js each pin one
// invariant in isolation. They're fast and precise, but they don't catch
// emergent bugs that only appear when invariants interact — e.g. a
// copy-forward bug that only manifests after a sell-then-refund in round 3,
// or a concurrency race that only shows up when the race happens on top of a
// fresh shop offer instead of a stale one.
//
// This file runs ONE long flow with checkpoint assertions between phases.
// When it fails, the failure message points at the specific phase, which
// the granular tests then help root-cause.
//
// Rule of thumb (see AGENTS.md "Scenario Test Rules"): write unit tests for
// invariants, scenario tests for journeys. Keep them both — scenario tests
// are additive, not substitutive.

import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../app/server/db.js';
import {
  resolveRound,
  buyRunShopItem,
  sellRunItem,
  refreshRunShop,
  getActiveGameRun
} from '../../app/server/services/game-service.js';
import {
  freshDb,
  bootRun,
  seedRunLoadout,
  getCoins,
  getShopOffer,
  forceShopOffer,
  findCheapArtifact,
  countBotGhostRows,
  getArtifactById,
  getArtifactPrice
} from './helpers.js';

test('[Req 1-A, 3-A, 4-B, 4-J, 4-K, 7-G, 11-A, 12-D] solo run scenario: start → buy → reload → resolve → sell → ghost → history', async () => {
  await freshDb();

  // ---------------------------------------------------------------------
  // Phase 0 — create player and choose mushroom. startGameRun seeds the
  // starter bag plus the 2-item starter preset into round 1; the rest of
  // round 1 is empty
  // until the player buys items from the shop.
  // ---------------------------------------------------------------------
  const { playerId, run } = await bootRun({
    telegramId: 7001,
    username: 'scenario'
  });

  // ---------------------------------------------------------------------
  // Phase 1 — startGameRun seeds the character signature starter preset
  // into round 1 of the run-scoped table. The old "legacy table stays
  // untouched" assertion went away with the legacy table itself
  // (deleted 2026-04-13).
  // ---------------------------------------------------------------------
  assert.ok(run.id, 'startGameRun must return a run id');

  const round1Starter = await query(
    `SELECT artifact_id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [run.id, playerId]
  );
  assert.equal(round1Starter.rowCount, 3, 'round 1 must contain starter bag + 2-item preset');

  // Seed a 1-coin loadout so the phases below (buy + sell + refresh + battle)
  // have something placed on the grid. The scenario uses this as its
  // deterministic baseline.
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);

  // ---------------------------------------------------------------------
  // Phase 2 — force a cheap dupable item into the shop, buy it twice.
  // Invariant: duplicates create distinct PKs, not collapsed into one row.
  // ---------------------------------------------------------------------
  const cheap = findCheapArtifact();
  assert.ok(cheap, 'need a price-1 1x1 non-bag artifact for the duplication test');

  await forceShopOffer(run.id, playerId, 1, [cheap.id]);
  await buyRunShopItem(playerId, run.id, cheap.id);

  await forceShopOffer(run.id, playerId, 1, [cheap.id]);
  await buyRunShopItem(playerId, run.id, cheap.id);

  const duplicates = await query(
    `SELECT id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1 AND artifact_id = $3`,
    [run.id, playerId, cheap.id]
  );
  assert.equal(duplicates.rowCount, 2, 'two buys must create two distinct rows');
  assert.notEqual(duplicates.rows[0].id, duplicates.rows[1].id, 'row PKs must differ');

  // ---------------------------------------------------------------------
  // Phase 3 — reload: getActiveGameRun returns identical layout.
  // ---------------------------------------------------------------------
  const active = await getActiveGameRun(playerId);
  assert.equal(active.id, run.id);
  assert.ok(Array.isArray(active.loadoutItems), 'reload must return loadoutItems');
  const dupInReload = active.loadoutItems.filter((i) => i.artifactId === cheap.id);
  assert.equal(dupInReload.length, 2, 'reload must preserve both duplicate rows');

  // ---------------------------------------------------------------------
  // Phase 4 — concurrent buy attempt against a tight-budget shop.
  // Lock must serialize: at most one succeeds, coins never go negative.
  // This re-checks the invariant from run-lock.test.js but inside a real
  // flow where shop state has been mutated by prior phases.
  // ---------------------------------------------------------------------
  const offerRow = await getShopOffer(run.id, playerId, 1);
  if (offerRow && offerRow.length >= 2) {
    const startingCoins = await getCoins(run.id, playerId);
    const [a, b] = offerRow;
    const priceA = getArtifactPrice(getArtifactById(a));
    const priceB = getArtifactPrice(getArtifactById(b));

    const results = await Promise.allSettled([
      buyRunShopItem(playerId, run.id, a),
      buyRunShopItem(playerId, run.id, b)
    ]);
    const finalCoins = await getCoins(run.id, playerId);
    assert.ok(finalCoins >= 0, `coins must never go negative, got ${finalCoins}`);

    if (priceA + priceB > startingCoins) {
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      assert.ok(ok <= 1, 'at most one concurrent buy may succeed on a tight budget');
    }
  }

  // ---------------------------------------------------------------------
  // Phase 5 — resolve round 1 → round 2.
  // Invariants:
  //   - round 1 rows stay byte-identical (frozen history)
  //   - round 2 rows copy forward with fresh_purchase=0 and preserved purchased_round
  //   - round 1 shop state row still exists (round-scoped, not UPDATE in place)
  // ---------------------------------------------------------------------
  const round1Before = await query(
    `SELECT id, artifact_id, x, y, width, height, purchased_round
     FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
     ORDER BY id ASC`,
    [run.id, playerId]
  );

  const resolveResult = await resolveRound(playerId, run.id);
  // In a solo run, status may be 'active' or the run may have ended —
  // either is fine for the history invariant. Only proceed to later
  // phases if still active.
  const stillActive = resolveResult.status === 'active';

  const round1After = await query(
    `SELECT id, artifact_id, x, y, width, height, purchased_round
     FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
     ORDER BY id ASC`,
    [run.id, playerId]
  );
  assert.deepEqual(
    round1After.rows,
    round1Before.rows,
    'round 1 rows must be byte-identical after resolveRound'
  );

  const round1Shop = await getShopOffer(run.id, playerId, 1);
  assert.ok(round1Shop !== null, 'round 1 shop state row must persist as history');

  if (!stillActive) return; // Run ended early; remaining phases N/A.

  // ---------------------------------------------------------------------
  // Phase 6 — round 2 copy-forward checks.
  // ---------------------------------------------------------------------
  const round2 = await query(
    `SELECT artifact_id, purchased_round, fresh_purchase
     FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2`,
    [run.id, playerId]
  );
  assert.ok(round2.rowCount > 0, 'round 2 rows must be copied forward');
  for (const row of round2.rows) {
    assert.equal(row.fresh_purchase, 0, 'copy-forward must reset fresh_purchase to 0');
    // Cheap-duplicate rows were bought in round 1, so purchased_round=1.
    if (row.artifact_id === cheap.id) {
      assert.equal(row.purchased_round, 1, 'purchased_round must survive copy-forward');
    }
  }

  // ---------------------------------------------------------------------
  // Phase 7 — sell a round-1-purchased item in round 2.
  // Invariants:
  //   - graduated refund uses purchased_round (not fresh_purchase), so the
  //     refund is HALF price (not full).
  //   - refund ledger row inserted.
  //   - coins increased by the refund amount.
  // ---------------------------------------------------------------------
  const coinsBeforeSell = await getCoins(run.id, playerId);
  const sellResult = await sellRunItem(playerId, run.id, cheap.id);
  const fullPrice = getArtifactPrice(cheap);
  // [Req 4-K] half-price refund, rounded down, MINIMUM 1 — selling a 1-coin
  // artifact in a later round refunds 1, not 0.
  const expectedRefund = Math.max(1, Math.floor(fullPrice / 2));
  assert.equal(sellResult.sellPrice, expectedRefund, 'non-fresh item must sell for half price (min 1)');

  const coinsAfterSell = await getCoins(run.id, playerId);
  assert.equal(coinsAfterSell, coinsBeforeSell + expectedRefund, 'coins must reflect the refund');

  const ledger = await query(
    `SELECT refund_amount FROM game_run_refunds
     WHERE game_run_id = $1 AND player_id = $2 AND artifact_id = $3`,
    [run.id, playerId, cheap.id]
  );
  assert.ok(ledger.rowCount > 0, 'refund ledger row must be inserted');
  assert.equal(ledger.rows[0].refund_amount, expectedRefund);

  // ---------------------------------------------------------------------
  // Phase 8 — unified ghost path: bot ghost rows live in the same table
  // as real player rows. They should exist after resolveRound (Phase 5)
  // unless a real player snapshot was available.
  // ---------------------------------------------------------------------
  assert.ok(
    (await countBotGhostRows()) > 0,
    'bot fallback must write rows into game_run_loadout_items, not a parallel table'
  );

  // ---------------------------------------------------------------------
  // Phase 9 — shop refresh in round 2 does not bleed round 1's shop state.
  // ---------------------------------------------------------------------
  const round1ShopBefore = await getShopOffer(run.id, playerId, 1);
  try {
    await refreshRunShop(playerId, run.id);
  } catch {
    // Refresh may fail due to insufficient coins; irrelevant for this assertion.
  }
  const round1ShopAfter = await getShopOffer(run.id, playerId, 1);
  assert.deepEqual(
    round1ShopAfter,
    round1ShopBefore,
    'round 1 shop state must remain frozen when round 2 shop is mutated'
  );
});

test('[Req 14-B] L1 resolveRound returns levelBefore and levelAfter; levelAfter > levelBefore on threshold crossing', async () => {
  await freshDb();
  // Start at 0 mycelium (level 1). REWARD_MULTIPLIER=20 guarantees a level-up:
  // loss gives 5×20=100 and win gives 15×20=300 — both reach the level-2 threshold (100).
  const { playerId, run } = await bootRun({ telegramId: 8001, username: 'levelup_test' });

  process.env.REWARD_MULTIPLIER = '20';
  let result;
  try {
    result = await resolveRound(playerId, run.id);
  } finally {
    delete process.env.REWARD_MULTIPLIER;
  }

  assert.ok(result.lastRound, 'resolveRound must return a lastRound object');
  assert.ok('levelBefore' in result.lastRound, 'lastRound must include levelBefore');
  assert.ok('levelAfter' in result.lastRound, 'lastRound must include levelAfter');
  assert.equal(result.lastRound.levelBefore, 1, 'levelBefore must be 1 at 0 mycelium');
  // REWARD_MULTIPLIER=20: worst case (loss) = 5×20=100, which exactly hits the level-2 threshold.
  assert.ok(result.lastRound.levelAfter >= 2, `levelAfter (${result.lastRound.levelAfter}) must be at least 2`);
  assert.ok(
    result.lastRound.levelAfter > result.lastRound.levelBefore,
    'levelAfter must exceed levelBefore when mycelium award crosses a threshold'
  );
});
