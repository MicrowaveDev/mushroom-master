// Challenge-mode read/write isolation between the two participating players.
//
// §11.6 Authorization was partially shipped in the run-state refactor:
// service-layer rejection of cross-run mutations is pinned by
// `loadout-refactor.test.js::cross-run mutation is rejected`. What was NOT
// yet covered is the in-run isolation contract: when two players are both
// legitimately participating in the SAME challenge run, each player's
// mutations must only touch their own rows, and each player's read paths
// must only return their own private state (shop offer, loadout items,
// coins).
//
// This is a scenario test per the "Backend Scenario vs Unit Test Rules" in
// AGENTS.md: one long flow with checkpoint assertions between phases. A
// failure points at a specific phase, not a single end-of-test assertion.

import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../app/server/db.js';
import {
  createRunChallenge,
  acceptFriendChallenge,
  addFriendByCode,
  getActiveGameRun,
  getGameRun,
  buyRunShopItem,
  refreshRunShop
} from '../../app/server/services/game-service.js';
import {
  freshDb,
  createPlayer,
  saveSetup,
  getCoins,
  getShopOffer,
  forceShopOffer,
  findCheapArtifact
} from './helpers.js';

const starterA = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];
const starterB = [
  { artifactId: 'amber_fang', x: 0, y: 0, width: 1, height: 2 },
  { artifactId: 'shock_puff', x: 1, y: 0, width: 1, height: 1 }
];

/**
 * Boot a live challenge run with two active players. Returns both player ids
 * and the run. Shared between this file and potential future challenge-mode
 * scenarios — but deliberately kept local for now to avoid over-generalizing
 * before a second caller exists.
 */
async function bootChallengeRun() {
  const sessionA = await createPlayer({ telegramId: 8101, username: 'alice' });
  const sessionB = await createPlayer({ telegramId: 8102, username: 'bob' });
  await saveSetup(sessionA.player.id, 'thalla', starterA);
  await saveSetup(sessionB.player.id, 'kirt', starterB);
  await addFriendByCode(sessionA.player.id, sessionB.player.friend_code);

  const challenge = await createRunChallenge(sessionA.player.id, sessionB.player.id);
  const run = await acceptFriendChallenge(challenge.id, sessionB.player.id);

  return {
    playerA: sessionA.player.id,
    playerB: sessionB.player.id,
    run
  };
}

test('[Req 8-G] challenge run isolation: reads and mutations stay scoped per player', async () => {
  await freshDb();
  const { playerA, playerB, run } = await bootChallengeRun();

  // ---------------------------------------------------------------------
  // Phase 1 — getActiveGameRun returns only the caller's private state.
  // Each player sees a flat `.player` object, not a `.players` map.
  // ---------------------------------------------------------------------
  const activeA = await getActiveGameRun(playerA);
  const activeB = await getActiveGameRun(playerB);
  assert.equal(activeA.id, run.id);
  assert.equal(activeB.id, run.id);
  assert.equal(activeA.player.playerId, playerA, 'A must see their own player block');
  assert.equal(activeB.player.playerId, playerB, 'B must see their own player block');
  assert.ok(!activeA.players, 'getActiveGameRun must not expose a players map');
  assert.ok(!activeB.players, 'getActiveGameRun must not expose a players map');

  // ---------------------------------------------------------------------
  // Phase 2 — shop offers are per-player. Forcing A's offer to a known
  // single-item list must not change B's offer.
  // ---------------------------------------------------------------------
  const cheap = findCheapArtifact();
  assert.ok(cheap, 'precondition: price-1 artifact exists');

  const offerBBefore = await getShopOffer(run.id, playerB, 1);
  await forceShopOffer(run.id, playerA, 1, [cheap.id]);
  const offerBAfter = await getShopOffer(run.id, playerB, 1);
  assert.deepEqual(
    offerBAfter,
    offerBBefore,
    'mutating A\'s shop offer must not touch B\'s shop offer'
  );

  // ---------------------------------------------------------------------
  // Phase 3 — player A's buy affects only A's coins and A's loadout.
  // B's coins and B's loadout row count remain unchanged.
  // ---------------------------------------------------------------------
  const coinsABefore = await getCoins(run.id, playerA);
  const coinsBBefore = await getCoins(run.id, playerB);
  const bLoadoutCountBefore = await query(
    `SELECT COUNT(*) AS count FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [run.id, playerB]
  );

  await buyRunShopItem(playerA, run.id, cheap.id);

  const coinsAAfter = await getCoins(run.id, playerA);
  const coinsBAfter = await getCoins(run.id, playerB);
  const bLoadoutCountAfter = await query(
    `SELECT COUNT(*) AS count FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [run.id, playerB]
  );

  assert.ok(coinsAAfter < coinsABefore, 'A\'s coins must decrease after buy');
  assert.equal(coinsBAfter, coinsBBefore, 'B\'s coins must not change when A buys');
  assert.equal(
    Number(bLoadoutCountAfter.rows[0].count),
    Number(bLoadoutCountBefore.rows[0].count),
    'B\'s loadout row count must not change when A buys'
  );

  // A must own the new row; B must not.
  const boughtByA = await query(
    `SELECT player_id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND artifact_id = $2 AND round_number = 1 AND fresh_purchase = 1`,
    [run.id, cheap.id]
  );
  assert.ok(boughtByA.rowCount > 0, 'bought row must exist');
  for (const row of boughtByA.rows) {
    assert.equal(row.player_id, playerA, 'bought row must be owned by A, not B');
  }

  // ---------------------------------------------------------------------
  // Phase 4 — player B's refresh-shop affects only B's shop row and B's
  // coins. A's shop offer row for round 1 is untouched.
  // ---------------------------------------------------------------------
  const offerARoundBefore = await getShopOffer(run.id, playerA, 1);
  const coinsBBeforeRefresh = await getCoins(run.id, playerB);

  try {
    await refreshRunShop(playerB, run.id);
  } catch {
    // Refresh may fail on tight budget; irrelevant for the isolation invariant.
  }

  const offerARoundAfter = await getShopOffer(run.id, playerA, 1);
  const coinsABeforePhase4 = coinsAAfter;
  const coinsAAfterPhase4 = await getCoins(run.id, playerA);

  assert.deepEqual(
    offerARoundAfter,
    offerARoundBefore,
    'A\'s shop offer must not change when B refreshes'
  );
  assert.equal(
    coinsAAfterPhase4,
    coinsABeforePhase4,
    'A\'s coins must not change when B refreshes'
  );

  // B's coins must have decreased (or stayed equal if refresh threw).
  const coinsBAfterRefresh = await getCoins(run.id, playerB);
  assert.ok(
    coinsBAfterRefresh <= coinsBBeforeRefresh,
    'B\'s coins must not increase from a refresh'
  );

  // ---------------------------------------------------------------------
  // Phase 5 — getGameRun (the challenge-mode read path) returns the
  // aggregated players array (legitimate — each player's client shows
  // opponent lives/coins/wins in the UI), but NEVER returns opponent
  // loadout items, and the shop offer is scoped to the viewer.
  // ---------------------------------------------------------------------
  const viewedByA = await getGameRun(run.id, playerA);
  const viewedByB = await getGameRun(run.id, playerB);

  assert.ok(Array.isArray(viewedByA.players), 'getGameRun must return a players array');
  assert.equal(viewedByA.players.length, 2);
  assert.equal(viewedByB.players.length, 2);

  // The aggregated player blocks may legitimately include coins/wins for
  // both sides — that's the opponent-status UI. What must NOT be exposed
  // is any `loadoutItems` field at the top level or nested under the
  // opponent's player block.
  assert.ok(
    !('loadoutItems' in viewedByA),
    'getGameRun must not expose loadoutItems (legacy three-source leak)'
  );
  for (const p of viewedByA.players) {
    assert.ok(
      !('loadoutItems' in p),
      'per-player blocks in getGameRun must not include loadoutItems'
    );
  }

  // Shop offers in getGameRun are scoped to the viewer. A's view of its
  // own shop must match the direct read; B's view of its own shop must
  // match the direct read; they must NOT share.
  const directShopA = await getShopOffer(run.id, playerA, 1);
  const directShopB = await getShopOffer(run.id, playerB, 1);
  assert.deepEqual(viewedByA.shopOffer, directShopA, 'A\'s getGameRun view must match A\'s direct shop read');
  assert.deepEqual(viewedByB.shopOffer, directShopB, 'B\'s getGameRun view must match B\'s direct shop read');
});
