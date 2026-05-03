import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLoadoutItems,
  startGameRun,
  sellRunItem,
  selectActiveMushroom,
  resolveRound,
  getBattle,
  getGameRunHistory,
  getPlayerState,
  buyRunShopItem,
  applyRunLoadoutPlacements
} from '../../app/server/services/game-service.js';
import {
  artifacts,
  bags,
  combatArtifacts,
  characterShopItems,
  getArtifactById,
  ROUND_INCOME,
  runRewardTable,
  getCompletionBonus
} from '../../app/server/game-data.js';
import { freshDb, createPlayer, seedRunLoadout, forceShopOffer } from './helpers.js';
import { query } from '../../app/server/db.js';

const starterBag = { id: 'starter_bag', artifactId: 'starter_bag', x: 0, y: 0, width: 3, height: 3, active: 1 };

// --- Bag data tests ---

test('[Req 5-A, 5-B, 5-C] bag items exist in artifacts with family=bag', () => {
  assert.ok(bags.length >= 2);
  const mossPouch = getArtifactById('moss_pouch');
  assert.equal(mossPouch.family, 'bag');
  assert.equal(mossPouch.slotCount, 2);
  assert.equal(mossPouch.price, 2);

  const amberSatchel = getArtifactById('amber_satchel');
  assert.equal(amberSatchel.family, 'bag');
  assert.equal(amberSatchel.slotCount, 4);
  assert.equal(amberSatchel.price, 3);
});

test('[Req 3-D, 5-F] combatArtifacts excludes bags, starter-only, and character shop items', () => {
  assert.ok(combatArtifacts.length > 0);
  assert.ok(combatArtifacts.every((a) => a.family !== 'bag' && !a.starterOnly && !a.characterItem));
  const starterOnly = artifacts.filter((a) => a.starterOnly);
  assert.equal(
    combatArtifacts.length + bags.length + starterOnly.length + characterShopItems.length,
    artifacts.length
  );
});

// --- Bag in loadout validation ---

test('[Req 5-A] validateLoadoutItems accepts inactive bag alongside placed item', () => {
  const items = [
    starterBag,
    { id: 'bag', artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { id: 'item', artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 }
  ];
  const result = validateLoadoutItems(items, 10);
  assert.equal(result.items.length, 3);
});

test('[Req 5-A] validateLoadoutItems rejects inactive bag with grid coordinates', () => {
  const items = [
    { artifactId: 'moss_pouch', x: 0, y: 0, width: 1, height: 2 }
  ];
  assert.throws(
    () => validateLoadoutItems(items, 10),
    /Inactive bag moss_pouch must use container coordinates/
  );
});

test('[Req 2-B] validateLoadoutItems accepts artifact inside active bag', () => {
  const items = [
    starterBag,
    { id: 'bag', artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: 1 },
    { id: 'inside', artifactId: 'spore_needle', x: 3, y: 0, width: 1, height: 1 }
  ];
  const result = validateLoadoutItems(items, 10);
  assert.equal(result.items.length, 3);
});

test('[Req 5-A] validateLoadoutItems rejects overlapping active bags', () => {
  const items = [
    starterBag,
    { id: 'inner', artifactId: 'moss_pouch', x: 1, y: 0, width: 1, height: 2, active: 1 }
  ];
  assert.throws(
    () => validateLoadoutItems(items, 20),
    /Bag placements cannot overlap/
  );
});

test('[Req 5-B, 5-C] validateLoadoutItems rejects uncovered item cells', () => {
  const items = [
    starterBag,
    { id: 'a', artifactId: 'spore_needle', x: 4, y: 0, width: 1, height: 1 }
  ];
  assert.throws(
    () => validateLoadoutItems(items, 20),
    /uncovered cell/
  );
});

test('[Req 5-A] validateLoadoutItems rejects item outside active bag coverage', () => {
  const items = [
    { id: 'orphan', artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ];
  assert.throws(
    () => validateLoadoutItems(items, 10),
    /uncovered cell/
  );
});

test('[Req 5-F] buildArtifactSummary excludes bags from combat stats', () => {
  const items = [
    starterBag,
    { id: 'item', artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 }
  ];
  const result = validateLoadoutItems(items, 10);
  // Bags have empty bonus, so totals should only reflect spore_needle (damage: 2)
  assert.equal(result.totals.damage, 2);
});

// --- Shop offer bag distribution ---

test('[Req 5-D] shop offer on game run start includes bag tracking', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const run = await startGameRun(session.player.id, 'solo');
  assert.ok(run.shopOffer.length > 0);

  // Check rounds_since_bag is stored in the shop state
  const shopState = await query(
    'SELECT rounds_since_bag FROM game_run_shop_states WHERE game_run_id = $1',
    [run.id]
  );
  assert.ok(shopState.rowCount);
  assert.ok(typeof shopState.rows[0].rounds_since_bag === 'number');
});

// --- Bag placement is persisted as flat grid anchors ---

test('[Req 5-A] applyRunLoadoutPlacements accepts active bag grid coordinates', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');

  await forceShopOffer(run.id, session.player.id, 1, ['moss_pouch']);
  await buyRunShopItem(session.player.id, run.id, 'moss_pouch');

  await applyRunLoadoutPlacements(session.player.id, run.id, [
    { artifactId: 'spore_lash', x: 0, y: 0, width: 1, height: 1 },
    { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 },
    { artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: 1 }
  ]);

  const row = await query(
    `SELECT x, y, active FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND artifact_id = 'moss_pouch'`,
    [run.id, session.player.id]
  );
  assert.equal(row.rowCount, 1);
  assert.equal(row.rows[0].x, 3);
  assert.equal(row.rows[0].y, 0);
  assert.equal(Number(row.rows[0].active), 1);
});

// Regression: a round-2 save hit the server with a stale item below the
// active bag footprint. The flat grid can be taller than the starter bag,
// but every occupied artifact cell must still be covered by some active bag.
test('[regression] applyRunLoadoutPlacements rejects a grid item outside active bag coverage', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');

  // Buy a non-bag artifact so we have something to place in a bogus row.
  await forceShopOffer(run.id, session.player.id, 1, ['bark_plate']);
  await buyRunShopItem(session.player.id, run.id, 'bark_plate');

  // Send bark_plate at y=3 (first row below the starter bag). The server
  // must reject it with a 400-mappable validation error.
  await assert.rejects(
    () => applyRunLoadoutPlacements(session.player.id, run.id, [
      { artifactId: 'spore_lash', x: 0, y: 0, width: 1, height: 1 },
      { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 },
      { artifactId: 'bark_plate', x: 0, y: 3, width: 1, height: 1 }
    ]),
    /uncovered cell/
  );
});

// Defense-in-depth: even if a caller bypasses applyRunLoadoutPlacements and
// writes via insertLoadoutItem directly (buy, starter preset, copy-forward),
// bag coords must still be normalized to (-1,-1) at the DB write layer.
test('[Req 5-A] insertLoadoutItem normalizes bag coords to (-1,-1) on buy', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');

  await forceShopOffer(run.id, session.player.id, 1, ['moss_pouch']);
  await buyRunShopItem(session.player.id, run.id, 'moss_pouch');

  const row = await query(
    `SELECT x, y FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND artifact_id = 'moss_pouch'`,
    [run.id, session.player.id]
  );
  assert.equal(row.rowCount, 1);
  assert.equal(row.rows[0].x, -1);
  assert.equal(row.rows[0].y, -1);
});

// Regression: user reported round-2 prep showing a scrambled inventory after
// a round-1 battle. The flat fix stores absolute coordinates for every placed
// artifact; copy-forward should preserve those coordinates without bag_id
// remapping.
test('[Req 12-D, 5-A] absolute bag/item coords survive PUT /artifact-loadout + copy-forward to round 2', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');

  await forceShopOffer(run.id, session.player.id, 1, ['moss_pouch', 'bark_plate']);
  await buyRunShopItem(session.player.id, run.id, 'moss_pouch');
  await buyRunShopItem(session.player.id, run.id, 'bark_plate');

  const rows = await query(
    `SELECT id, artifact_id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND artifact_id IN ('moss_pouch', 'bark_plate')`,
    [run.id, session.player.id]
  );
  const mossRowId = rows.rows.find((r) => r.artifact_id === 'moss_pouch').id;
  const barkRowId = rows.rows.find((r) => r.artifact_id === 'bark_plate').id;
  const current = await query(
    `SELECT id, artifact_id, x, y, width, height FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND artifact_id IN ('starter_bag', 'spore_lash', 'spore_needle')`,
    [run.id, session.player.id]
  );
  const starterEntries = current.rows.map((r) => ({
    id: r.id,
    artifactId: r.artifact_id,
    x: Number(r.x),
    y: Number(r.y),
    width: Number(r.width),
    height: Number(r.height),
    active: r.artifact_id === 'starter_bag' ? 1 : undefined
  }));

  // Activate the pouch at (3,0) and place bark_plate in the pouch's first
  // absolute cell. The placed item has no bag_id.
  await applyRunLoadoutPlacements(session.player.id, run.id, [
    ...starterEntries,
    { id: mossRowId, artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: 1 },
    { id: barkRowId, artifactId: 'bark_plate', x: 3, y: 0, width: 1, height: 1 }
  ]);

  const round1Placed = await query(
    `SELECT x, y FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND id = $3`,
    [run.id, session.player.id, barkRowId]
  );
  assert.equal(round1Placed.rowCount, 1, 'one placed item must be persisted');
  assert.equal(round1Placed.rows[0].x, 3);
  assert.equal(round1Placed.rows[0].y, 0);

  const resolveResult = await resolveRound(session.player.id, run.id);
  if (resolveResult.status !== 'active') return; // Unlikely with 5 starting lives, but guard anyway.

  const round2Moss = await query(
    `SELECT id, x, y, active FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2
       AND artifact_id = 'moss_pouch'`,
    [run.id, session.player.id]
  );
  assert.equal(round2Moss.rowCount, 1, 'round 2 must have its own pouch row');
  assert.notEqual(round2Moss.rows[0].id, mossRowId, 'copy-forward mints fresh ids per round');
  assert.equal(round2Moss.rows[0].x, 3);
  assert.equal(round2Moss.rows[0].y, 0);
  assert.equal(Number(round2Moss.rows[0].active), 1);

  const round2Placed = await query(
    `SELECT id, x, y, width, height FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2
       AND artifact_id = 'bark_plate'`,
    [run.id, session.player.id]
  );
  assert.equal(round2Placed.rowCount, 1, 'copy-forward preserves the placed artifact');
  assert.notEqual(round2Placed.rows[0].id, barkRowId, 'copy-forward mints fresh item ids per round');
  assert.equal(round2Placed.rows[0].x, 3);
  assert.equal(round2Placed.rows[0].y, 0);
});

// --- Sell non-empty bag ---

test('[Req 4-L] sellRunItem blocks selling non-empty bag', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const run = await startGameRun(session.player.id, 'solo');

  // Seed an active bag with an item overlapping its footprint directly into
  // the run-scoped table. Membership is derived from absolute coordinates.
  await seedRunLoadout(session.player.id, run.id, [
    { id: 'pouch_row', artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: 1 },
    { id: 'inside_pouch', artifactId: 'spore_needle', x: 3, y: 0, width: 1, height: 1 }
  ]);

  await assert.rejects(
    () => sellRunItem(session.player.id, run.id, 'moss_pouch'),
    /contains items/
  );
});

// --- Ghost snapshot saved after round ---

test('[Req 7-G] round loadout rows remain after each solo round (unified snapshot, §2.4)', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const run = await startGameRun(session.player.id, 'solo');
  // Round 1 starts empty — seed a deterministic row so the ghost snapshot
  // has something to preserve.
  await seedRunLoadout(session.player.id, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
  await resolveRound(session.player.id, run.id);

  // Under the unified ghost model the round-1 loadout rows in
  // game_run_loadout_items ARE the ghost snapshot — future runs read them
  // directly (no separate game_run_ghost_snapshots table).
  const round1Rows = await query(
    `SELECT player_id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [run.id, session.player.id]
  );
  assert.ok(round1Rows.rowCount >= 1);
  assert.equal(round1Rows.rows[0].player_id, session.player.id);
});

// --- Step naming in replay events ---

test('[Req 13-A] replay events use step_start type and step field', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const run = await startGameRun(session.player.id, 'solo');
  const result = await resolveRound(session.player.id, run.id);
  const battle = await getBattle(result.lastRound.battleId, session.player.id);

  const stepEvents = battle.events.filter((e) => e.type === 'step_start');
  assert.ok(stepEvents.length > 0);
  assert.ok(stepEvents[0].step >= 1);
  assert.equal(stepEvents[0].type, 'step_start');
  assert.deepEqual(battle.roundResult, {
    roundNumber: result.lastRound.roundNumber,
    battleId: result.lastRound.battleId,
    outcome: result.lastRound.outcome,
    rewards: result.lastRound.rewards,
    ratingBefore: result.lastRound.ratingBefore,
    ratingAfter: result.lastRound.ratingAfter,
    coinsIncome: 5
  });

  // Verify no round_start events exist
  const roundEvents = battle.events.filter((e) => e.type === 'round_start');
  assert.equal(roundEvents.length, 0);
});

// --- Game run history ---

test('[Req 1-E] getGameRunHistory returns completed runs', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const { abandonGameRun } = await import('../../app/server/services/game-service.js');

  const run = await startGameRun(session.player.id, 'solo');
  await abandonGameRun(session.player.id, run.id);

  const history = await getGameRunHistory(session.player.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].id, run.id);
  assert.equal(history[0].status, 'abandoned');
});

test('[Req 1-G] getGameRunHistory excludes active runs', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  await startGameRun(session.player.id, 'solo');

  const history = await getGameRunHistory(session.player.id);
  assert.equal(history.length, 0);
});

test('[Req 1-A] bootstrap.gameRunHistory lists one entry per run, not per battle', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const { abandonGameRun, getBootstrap } = await import('../../app/server/services/game-service.js');

  // Play one full round (creates one battle inside the run), then abandon.
  const run = await startGameRun(session.player.id, 'solo');
  await resolveRound(session.player.id, run.id);
  await abandonGameRun(session.player.id, run.id);

  const bootstrap = await getBootstrap(session.player.id);
  // Single run played → exactly one row in gameRunHistory, regardless of how
  // many battles were created inside the run. This is the home-screen "Игры"
  // contract per game-requirements.md §1-A.
  assert.equal(bootstrap.gameRunHistory.length, 1);
  assert.equal(bootstrap.gameRunHistory[0].id, run.id);
  // The mushroom used in the run is exposed for portrait rendering on the home.
  assert.equal(bootstrap.gameRunHistory[0].mushroomId, 'thalla');
});

// --- Coin carry-over ---

test('[Req 4-B, 4-C] coins carry over between rounds', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const run = await startGameRun(session.player.id, 'solo');
  assert.equal(run.player.coins, ROUND_INCOME[0]);

  const result = await resolveRound(session.player.id, run.id);
  // Coins should be previous coins + next round income
  assert.equal(result.player.coins, ROUND_INCOME[0] + ROUND_INCOME[1]);
});

// --- Full run completion with bonus ---

test('[Req 9-B] full run pays completion bonus based on wins', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const run = await startGameRun(session.player.id, 'solo');
  const sporeBefore = (await getPlayerState(session.player.id)).player.spore;

  let result;
  let totalPerRoundSpore = 0;
  for (let i = 0; i < 9; i++) {
    result = await resolveRound(session.player.id, run.id);
    totalPerRoundSpore += runRewardTable[result.lastRound.outcome].spore;
    if (result.status !== 'active') break;
  }

  const sporeAfter = (await getPlayerState(session.player.id)).player.spore;
  const completionBonus = getCompletionBonus(result.player.wins);

  // Total spore = per-round rewards + completion bonus
  assert.equal(sporeAfter, sporeBefore + totalPerRoundSpore + completionBonus.spore);
});
