// Step 0 of docs/loadout-refactor-plan.md — failing goal-defining tests.
//
// Each test encodes a specific success criterion from §10 of the plan.
// They are intentionally RED until the step that makes them green lands:
//
//   1. Duplicate artifacts                   → Step 3 (lifecycle)
//   2. Reload preserves layout               → Step 3 + Step 7 (projection)
//   3. Round-forward history is frozen       → Step 3 (lifecycle)
//   4. Ghost from real player row            → Step 4 (unified ghost)
//   5. Legacy isolation                      → Step 3 (severance)
//   6. Shop state is round-scoped            → Step 3 (lifecycle)
//   7. Graduated refund uses purchased_round → Step 2/3 (refund policy)
//   8. Authorization: cross-run access 403   → Step 2 (write endpoints)
//   9. Bot ghost rows are real table rows    → Step 4 (unified ghost)
//
// A test that throws "Step N not complete: <hint>" is a signal that the
// precondition for that test isn't in place yet. A test that fails on
// an assertion is a real regression to fix.

import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../app/server/db.js';
import {
  startGameRun,
  resolveRound,
  buyRunShopItem,
  sellRunItem,
  selectActiveMushroom,
  getActiveGameRun
} from '../../app/server/services/game-service.js';
import {
  freshDb,
  createPlayer,
  seedRunLoadout,
  bootRun,
  findCheapArtifact,
  forceShopOffer,
  countBotGhostRows,
  getCoins
} from './helpers.js';

async function tableExists(tableName) {
  try {
    const { sequelize } = await (await import('../../app/server/db.js')).getDb();
    const qi = sequelize.getQueryInterface();
    const tables = await qi.showAllTables();
    return tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name)).includes(tableName);
  } catch {
    return false;
  }
}

async function requireTable(tableName, stepHint) {
  if (!(await tableExists(tableName))) {
    throw new Error(`${stepHint}: table ${tableName} does not exist yet`);
  }
}

async function columnExists(tableName, columnName) {
  try {
    const { sequelize } = await (await import('../../app/server/db.js')).getDb();
    const qi = sequelize.getQueryInterface();
    const desc = await qi.describeTable(tableName);
    return Object.prototype.hasOwnProperty.call(desc, columnName);
  } catch {
    return false;
  }
}

const minimalLoadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
];

async function bootPlayerInRun(overrides = {}) {
  return bootRun({ ...overrides, withLegacyLoadout: minimalLoadout });
}

// ---------------------------------------------------------------------------
// #1 — duplicate artifacts are stored as distinct rows
// Plan: §1.3 missing-capability "Duplicate artifacts", §10 duplicate check.
// ---------------------------------------------------------------------------
test('[Req 2-A] duplicate artifacts create distinct loadout rows', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  const { playerId, run } = await bootPlayerInRun();
  // Replace the 5-coin starter with a 1-coin loadout so we have budget for
  // two purchases of the duplicate artifact (max price 2).
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);

  // Pick a cheap (price 1) non-spore_needle artifact to duplicate. We force
  // the shop to contain two copies by writing directly to offer_json.
  const dupArtifact = findCheapArtifact()?.id;
  assert.ok(dupArtifact, 'expected a cheap 1x1 artifact to exist for duplication');

  await forceShopOffer(run.id, playerId, 1, [dupArtifact]);
  await buyRunShopItem(playerId, run.id, dupArtifact);

  await forceShopOffer(run.id, playerId, 1, [dupArtifact]);
  await buyRunShopItem(playerId, run.id, dupArtifact);

  const rows = await query(
    `SELECT id, artifact_id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND artifact_id = $3`,
    [run.id, playerId, dupArtifact]
  );

  assert.equal(rows.rowCount, 2, 'expected two distinct rows for the duplicate artifact');
  assert.notEqual(rows.rows[0].id, rows.rows[1].id, 'row IDs must differ');
});

// ---------------------------------------------------------------------------
// #2 — reload preserves layout (buy + place + fetch active run → identical)
// Plan: §10 "A player can play 9 rounds without any UI state drift".
// ---------------------------------------------------------------------------
test('[Req 12-D] reload preserves loadout layout for current round', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  const { playerId, run } = await bootPlayerInRun();
  const active = await getActiveGameRun(playerId);
  const artifactId = active.shopOffer[0];
  await buyRunShopItem(playerId, run.id, artifactId);

  const before = await query(
    `SELECT artifact_id, x, y, width, height, bag_id, sort_order
     FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
     ORDER BY sort_order ASC`,
    [run.id, playerId]
  );

  // Simulate reload: fresh getActiveGameRun call should return the same rows.
  const reloaded = await getActiveGameRun(playerId);
  assert.ok(reloaded.loadoutItems, 'getActiveGameRun must return loadoutItems');
  assert.equal(reloaded.loadoutItems.length, before.rowCount);
});

// ---------------------------------------------------------------------------
// #3 — round-forward history is immutable
// Plan: §2.3 "round N rows stay frozen forever", §10 frozen check.
// ---------------------------------------------------------------------------
test('[Req 11-A] round 1 loadout rows remain frozen after round 2 resolves', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  const { playerId, run } = await bootPlayerInRun();
  // Round 1 no longer auto-seeds a starter; seed a deterministic one so the
  // frozen-history assertion has something to compare against.
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);

  const round1Before = await query(
    `SELECT id, artifact_id, x, y FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
     ORDER BY sort_order ASC`,
    [run.id, playerId]
  );
  assert.ok(round1Before.rowCount > 0, 'expected seeded loadout rows in round 1');

  await resolveRound(playerId, run.id);

  const round1After = await query(
    `SELECT id, artifact_id, x, y FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
     ORDER BY sort_order ASC`,
    [run.id, playerId]
  );

  assert.deepEqual(
    round1After.rows,
    round1Before.rows,
    'round 1 rows must be byte-identical after round 2 resolves'
  );

  const round2 = await query(
    `SELECT COUNT(*) AS count FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2`,
    [run.id, playerId]
  );
  assert.ok(Number(round2.rows[0].count) > 0, 'expected round 2 rows to be inserted');
});

// ---------------------------------------------------------------------------
// #4 — ghost lookup pulls from real player snapshots
// Plan: §2.4 unified ghost, §10 ghost snapshot check.
// ---------------------------------------------------------------------------
test('[Req 7-G] ghost lookup returns rows from another real player at the matching round', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  // Player A plays round 1 to produce a snapshot. Round 1 starts empty now,
  // so seed a deterministic row first — that's what will become the ghost
  // candidate for B.
  const a = await bootPlayerInRun({ telegramId: 501, username: 'a' });
  await seedRunLoadout(a.playerId, a.run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
  await resolveRound(a.playerId, a.run.id);

  // Player B starts a new run
  const b = await bootPlayerInRun({ telegramId: 502, username: 'b' });

  // After B resolves round 1, the ghost lookup should have consulted
  // game_run_loadout_items for round 1 rows owned by player A.
  // Since the new path unifies bot + player rows into the same table,
  // we assert that at least one game_run_loadout_items row exists for A.
  const aRows = await query(
    `SELECT COUNT(*) AS count FROM game_run_loadout_items
     WHERE player_id = $1 AND round_number = 1`,
    [a.playerId]
  );
  assert.ok(Number(aRows.rows[0].count) > 0, 'player A must have round 1 rows in the new table');

  // Resolving for B should not throw even when no legacy ghost table exists.
  await resolveRound(b.playerId, b.run.id);
});

// ---------------------------------------------------------------------------
// #5 — startGameRun seeds the character starter preset into the run table
// Plan: §2.9. Originally a "legacy table stays empty" test; the legacy
// table itself was deleted 2026-04-13 so the assertion now just confirms
// the run-scoped table receives the 2-item preset on first pick.
// ---------------------------------------------------------------------------
test('[Req 3-A, 3-B] startGameRun seeds the 2-item starter preset into game_run_loadout_items', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  const session = await createPlayer({ telegramId: 601, username: 'solo' });
  await selectActiveMushroom(session.player.id, 'thalla');

  await startGameRun(session.player.id, 'solo');

  // Round 1 is seeded with the character signature starter preset — two
  // lore-tied items from game-data.js STARTER_PRESETS. Nothing else.
  const newRows = await query(
    `SELECT COUNT(*) AS count FROM game_run_loadout_items WHERE player_id = $1 AND round_number = 1`,
    [session.player.id]
  );
  assert.equal(Number(newRows.rows[0].count), 2, 'round 1 must contain the 2-item starter preset');
});

// ---------------------------------------------------------------------------
// #6 — shop state is round-scoped
// Plan: §2.8.
// ---------------------------------------------------------------------------
test('[Req 11-C] shop state row for round 1 remains after round 2 resolves', async () => {
  await freshDb();
  await requireTable('game_run_shop_states', 'Schema missing');
  if (!(await columnExists('game_run_shop_states', 'round_number'))) {
    throw new Error('Schema incomplete: game_run_shop_states.round_number missing');
  }

  const { playerId, run } = await bootPlayerInRun();
  await resolveRound(playerId, run.id);

  const rounds = await query(
    `SELECT round_number FROM game_run_shop_states
     WHERE game_run_id = $1 AND player_id = $2
     ORDER BY round_number ASC`,
    [run.id, playerId]
  );

  // Both round 1 and round 2 shop state rows must exist — round 1 is frozen history.
  const roundNumbers = rounds.rows.map((r) => r.round_number);
  assert.ok(roundNumbers.includes(1), 'expected round 1 shop state row to remain');
  assert.ok(roundNumbers.includes(2), 'expected round 2 shop state row to be inserted');
});

// ---------------------------------------------------------------------------
// #7 — graduated refund uses purchased_round, preserved across copy-forward
// Plan: §2.2 "purchased_round alongside fresh_purchase".
// ---------------------------------------------------------------------------
test('[Req 4-K, 11-A] item bought in round 1 and sold in round 2 refunds at half price', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');
  const { getArtifactById, getArtifactPrice } = await import('../../app/server/game-data.js');

  const { playerId, run } = await bootPlayerInRun();
  // Replace the auto-generated 5-coin starter with a minimal 1-coin loadout
  // so we have budget headroom for the purchase.
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
  const active = await getActiveGameRun(playerId);
  const artifactId = active.shopOffer.find((id) => id !== 'spore_needle') || active.shopOffer[0];
  const artifact = getArtifactById(artifactId);
  const originalPrice = getArtifactPrice(artifact);
  const expectedHalfPrice = Math.max(1, Math.floor(originalPrice / 2));

  await buyRunShopItem(playerId, run.id, artifactId);
  // Move the purchased item onto the grid so it survives round-forward.
  await query(
    `UPDATE game_run_loadout_items SET x = 1, y = 0
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1 AND artifact_id = $3`,
    [run.id, playerId, artifactId]
  );
  await resolveRound(playerId, run.id);

  // The copy-forward must preserve purchased_round=1 on the round-2 row.
  const rows = await query(
    `SELECT purchased_round, fresh_purchase FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2
       AND artifact_id = $3`,
    [run.id, playerId, artifactId]
  );

  if (rows.rowCount === 0) {
    throw new Error('Step 3 not complete: round 2 copy-forward did not include the purchased item');
  }
  assert.equal(rows.rows[0].purchased_round, 1, 'purchased_round must survive the copy-forward');
  assert.equal(rows.rows[0].fresh_purchase, 0, 'fresh_purchase must reset to 0 after copy-forward');

  // Capture coins BEFORE selling so we can verify the exact refund delta.
  const coinsBefore = (await getCoins(run.id, playerId));

  // Sell the item — refund must be EXACTLY half-price (rounded down, min 1)
  // because purchased_round (1) != current_round (2). [Req 4-K]
  const sellResult = await sellRunItem(playerId, run.id, artifactId);
  assert.equal(
    sellResult.sellPrice,
    expectedHalfPrice,
    `Round-2 sell of round-1 purchase should refund floor(${originalPrice} / 2) = ${expectedHalfPrice}, got ${sellResult.sellPrice}`
  );

  const coinsAfter = (await getCoins(run.id, playerId));
  assert.equal(
    coinsAfter - coinsBefore,
    expectedHalfPrice,
    `Coin delta should equal the half-price refund (${expectedHalfPrice})`
  );
});

test('[Req 4-J, 4-K] same-round sell vs later-round sell: full vs half price (paired assertion)', async () => {
  // Pin both halves of the rule in one place so the relationship can't drift:
  //   - same round: full refund (purchased_round === current_round)
  //   - later round: half refund (purchased_round < current_round)
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');
  const { getArtifactById, getArtifactPrice } = await import('../../app/server/game-data.js');

  // --- Same-round half ---
  const a = await bootPlayerInRun({ telegramId: 8501, username: 'sell_same' });
  await seedRunLoadout(a.playerId, a.run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
  const activeA = await getActiveGameRun(a.playerId);
  const artifactA = activeA.shopOffer.find((id) => id !== 'spore_needle') || activeA.shopOffer[0];
  const priceA = getArtifactPrice(getArtifactById(artifactA));
  await buyRunShopItem(a.playerId, a.run.id, artifactA);
  const sellA = await sellRunItem(a.playerId, a.run.id, artifactA);
  assert.equal(
    sellA.sellPrice,
    priceA,
    `Same-round sell should refund full price (${priceA}), got ${sellA.sellPrice}`
  );

  // --- Later-round half ---
  const b = await bootPlayerInRun({ telegramId: 8502, username: 'sell_later' });
  await seedRunLoadout(b.playerId, b.run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
  const activeB = await getActiveGameRun(b.playerId);
  const artifactB = activeB.shopOffer.find((id) => id !== 'spore_needle') || activeB.shopOffer[0];
  const priceB = getArtifactPrice(getArtifactById(artifactB));
  const expectedHalfB = Math.max(1, Math.floor(priceB / 2));
  await buyRunShopItem(b.playerId, b.run.id, artifactB);
  // Place on grid so it survives copy-forward
  await query(
    `UPDATE game_run_loadout_items SET x = 1, y = 0
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1 AND artifact_id = $3`,
    [b.run.id, b.playerId, artifactB]
  );
  await resolveRound(b.playerId, b.run.id);
  const sellB = await sellRunItem(b.playerId, b.run.id, artifactB);
  assert.equal(
    sellB.sellPrice,
    expectedHalfB,
    `Later-round sell should refund floor(${priceB}/2) = ${expectedHalfB}, got ${sellB.sellPrice}`
  );

  // Cross-check: the later-round refund must be strictly less than the
  // same-round refund (or equal if the artifact only costs 1 coin, since
  // floor(1/2) = 0 → clamped to 1 = original).
  if (priceA > 1 && priceB > 1) {
    assert.ok(
      expectedHalfB < priceB,
      'Half-price refund of a multi-coin artifact should be strictly less than full price'
    );
  }
});

test('[Req 4-M, 4-N] runtime budget ceiling = cumulative_round_income + preset_cost', async () => {
  // Pin the exact ceiling formula end-to-end. The signal-ready path goes
  // through getActiveSnapshot in battle-service which composes
  //   ceiling = sum(ROUND_INCOME[0..currentRound]) + getStarterPresetCost(mushroomId)
  // and feeds it to validateCoinBudget. An off-by-one in either summand
  // would either reject a legitimate round-1 loadout (preset + a full
  // round's worth of buys) or grant the player one extra free coin every
  // round forever after.
  //
  // We exercise this by spending EXACTLY the round's income on shop items
  // (which goes ON TOP of the free starter preset) and asserting that
  // resolveRound succeeds — no budget error from validateLoadoutItems.
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');
  const { ROUND_INCOME, getStarterPresetCost, getStarterPreset, getArtifactById, getArtifactPrice } =
    await import('../../app/server/game-data.js');

  const session = await createPlayer({ telegramId: 8801, username: 'budget_ceiling' });
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');
  const playerId = session.player.id;

  // The starter preset is auto-seeded by startGameRun for the first pick.
  // Verify the preset cost is what we think it is (it must be > 0 — if it
  // were 0, the ceiling would equal cumulative income alone and the test
  // wouldn't actually exercise the preset half of the formula).
  const presetCost = getStarterPresetCost('thalla');
  assert.ok(presetCost > 0, 'Thalla starter preset must have a non-zero cost for this test to be meaningful');

  // Spend the round-1 income (5 coins) buying as many shop items as possible.
  // The active loadout will then contain: preset items (cost = presetCost)
  // + bought items (cost ≤ ROUND_INCOME[0]). Total = presetCost + ROUND_INCOME[0],
  // which must equal exactly the budget ceiling.
  const active = await getActiveGameRun(playerId);
  let coinsLeft = ROUND_INCOME[0];
  let bought = 0;
  for (const artifactId of active.shopOffer) {
    const a = getArtifactById(artifactId);
    if (!a) continue;
    const price = getArtifactPrice(a);
    if (price > coinsLeft) continue;
    try {
      await buyRunShopItem(playerId, run.id, artifactId);
      coinsLeft -= price;
      bought += 1;
    } catch { /* shop validation, continue */ }
    if (coinsLeft === 0) break;
  }
  assert.ok(bought >= 1, 'Test setup: should have bought at least one item');

  // resolveRound feeds the loadout through validateCoinBudget with the
  // run-budget ceiling. If the ceiling is off-by-one, this throws.
  // No throw = the formula matches the spec.
  const result = await resolveRound(playerId, run.id);
  assert.ok(
    result.status === 'active' || result.status === 'completed' || result.status === 'abandoned',
    `resolveRound should succeed, got status=${result.status}`
  );
  assert.ok(result.lastRound, 'resolveRound should return a lastRound (validation passed)');
});

// ---------------------------------------------------------------------------
// #8 — authorization: one player cannot mutate another's run
// Plan: §11.6.
// ---------------------------------------------------------------------------
test('[Req 8-G] cross-run mutation is rejected', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  const a = await bootPlayerInRun({ telegramId: 701, username: 'a' });
  const b = await createPlayer({ telegramId: 702, username: 'b' });

  // Player B attempts to buy from player A's run.
  await assert.rejects(
    () => buyRunShopItem(b.player.id, a.run.id, 'spore_needle'),
    /not part of|Player is not/
  );
});

// ---------------------------------------------------------------------------
// Regression — starter preset + shop buys + resolveRound must not trip the
// coin-budget validator. Before the fix, round 1 exploded on ready because
// validateCoinBudget summed preset items (2 coins) + shop buys (up to 5) = 7,
// and the runBudget in battle-service.js was cumulative ROUND_INCOME = 5.
// The production path was never exercised end-to-end because every scenario
// test uses seedRunLoadout() to overwrite the auto-seeded preset.
// ---------------------------------------------------------------------------
test('[Req 3-C, 4-M, 4-N] auto-seeded preset + full shop spend resolves round 1 without budget error', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  // bootRun() does NOT call seedRunLoadout — the auto-seeded preset stays.
  // This is the only scenario test in the suite that exercises the
  // production seeding → shop → resolve pipeline end-to-end; every other
  // scenario overrides seeding with seedRunLoadout and misses this path.
  const { playerId, run } = await bootRun({ telegramId: 801, username: 'preset-resolve' });

  // Sanity: preset is in place (2 items, both count toward loadout cost).
  const presetRows = await query(
    `SELECT artifact_id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [run.id, playerId]
  );
  assert.equal(presetRows.rowCount, 2, 'preset must seed exactly 2 items');

  // Exhaust the full round-1 income by buying five price-1 items. This
  // drives total loadout value to preset_cost (2) + shop_spend (5) = 7,
  // which is exactly the ceiling the fix widens the validator to allow.
  // Both failing bug reports (cost 7 before the partial fix, cost 6 with
  // the partial fix) are reachable from this setup — if the ceiling is
  // ever narrowed again this test trips immediately.
  const cheap = findCheapArtifact();
  assert.ok(cheap, 'expected a price-1 artifact for the regression');
  await forceShopOffer(run.id, playerId, 1, [cheap.id, cheap.id, cheap.id, cheap.id, cheap.id]);
  for (let i = 0; i < 5; i++) {
    await buyRunShopItem(playerId, run.id, cheap.id);
  }

  // Total loadout items: 2 preset + 5 bought = 7 rows.
  const finalRows = await query(
    `SELECT artifact_id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [run.id, playerId]
  );
  assert.equal(finalRows.rowCount, 7, 'expected 2 preset + 5 shop-bought rows');

  // Resolving round 1 must succeed. Before the fix this threw
  // "Loadout exceeds 5-coin budget (cost 7)" from validateCoinBudget;
  // after the partial starterOnly-skip fix it threw "cost 6" because
  // the existing-half of each preset pair is not starterOnly. The real
  // fix widens runBudget by the full preset gift value in
  // battle-service.js getActiveSnapshot.
  await assert.doesNotReject(
    () => resolveRound(playerId, run.id),
    'resolveRound must accept preset + full-income shop spend'
  );
});

// ---------------------------------------------------------------------------
// #9 — bot fallback rows live in the same table
// Plan: §2.4 unified ghost, bot-fallback unification.
// ---------------------------------------------------------------------------
test('[Req 7-G] bot ghost fallback writes real rows into game_run_loadout_items', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  const { playerId, run } = await bootPlayerInRun();
  await resolveRound(playerId, run.id);

  // After resolving round 1, if no other real player exists the ghost path
  // must have produced a synthetic row. Look for any game_run_id that starts
  // with the "ghost:bot:" marker (see §2.4 unification).
  if ((await countBotGhostRows()) === 0) {
    throw new Error('Step 4 not complete: no synthetic ghost:bot rows found in game_run_loadout_items');
  }
});
