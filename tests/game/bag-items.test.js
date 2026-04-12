import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLoadoutItems,
  startGameRun,
  sellRunItem,
  saveArtifactLoadout,
  selectActiveMushroom,
  resolveRound,
  getBattle,
  getGameRunHistory,
  getPlayerState
} from '../../app/server/services/game-service.js';
import {
  artifacts,
  bags,
  combatArtifacts,
  getArtifactById,
  ROUND_INCOME,
  runRewardTable,
  getCompletionBonus
} from '../../app/server/game-data.js';
import { freshDb, createPlayer, seedRunLoadout } from './helpers.js';
import { query } from '../../app/server/db.js';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

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

test('[Req 3-D, 5-F] combatArtifacts excludes bags and starter-only items', () => {
  assert.ok(combatArtifacts.length > 0);
  assert.ok(combatArtifacts.every((a) => a.family !== 'bag' && !a.starterOnly));
  const starterOnly = artifacts.filter((a) => a.starterOnly);
  assert.equal(
    combatArtifacts.length + bags.length + starterOnly.length,
    artifacts.length
  );
});

// --- Bag in loadout validation ---

test('[Req 5-A] validateLoadoutItems accepts bag on grid', () => {
  const items = [
    { artifactId: 'moss_pouch', x: 0, y: 0, width: 1, height: 2 },
    { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 }
  ];
  const result = validateLoadoutItems(items, 10);
  assert.equal(result.items.length, 2);
});

test('[Req 2-B] validateLoadoutItems accepts artifact inside bag', () => {
  const items = [
    { artifactId: 'moss_pouch', x: 0, y: 0, width: 1, height: 2 },
    { artifactId: 'spore_needle', bagId: 'moss_pouch', width: 1, height: 1 }
  ];
  const result = validateLoadoutItems(items, 10);
  assert.equal(result.items.length, 2);
});

test('[Req 5-A] validateLoadoutItems rejects bag inside bag', () => {
  const items = [
    { artifactId: 'amber_satchel', x: 0, y: 0, width: 2, height: 2 },
    { artifactId: 'moss_pouch', bagId: 'amber_satchel', width: 1, height: 2 }
  ];
  assert.throws(
    () => validateLoadoutItems(items, 20),
    /Bags cannot contain other bags/
  );
});

test('[Req 5-B, 5-C] validateLoadoutItems rejects items exceeding bag slotCount', () => {
  const items = [
    { artifactId: 'moss_pouch', x: 0, y: 0, width: 1, height: 2 },
    { artifactId: 'spore_needle', bagId: 'moss_pouch', width: 1, height: 1 },
    { artifactId: 'bark_plate', bagId: 'moss_pouch', width: 1, height: 1 },
    { artifactId: 'shock_puff', bagId: 'moss_pouch', width: 1, height: 1 } // 3rd item, but slotCount=2
  ];
  assert.throws(
    () => validateLoadoutItems(items, 20),
    /full/
  );
});

test('[Req 5-A] validateLoadoutItems rejects item in bag not on grid', () => {
  const items = [
    { artifactId: 'spore_needle', bagId: 'moss_pouch', width: 1, height: 1 }
    // moss_pouch not in the loadout
  ];
  assert.throws(
    () => validateLoadoutItems(items, 10),
    /not placed on the grid/
  );
});

test('[Req 5-F] buildArtifactSummary excludes bags from combat stats', () => {
  const items = [
    { artifactId: 'moss_pouch', x: 0, y: 0, width: 1, height: 2 },
    { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 }
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
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);

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

// --- Sell non-empty bag ---

test('[Req 4-L] sellRunItem blocks selling non-empty bag', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');

  const run = await startGameRun(session.player.id, 'solo');

  // Seed a bag with an item inside it directly into the run-scoped table.
  await seedRunLoadout(session.player.id, run.id, [
    { artifactId: 'moss_pouch', x: 0, y: 0, width: 1, height: 2 },
    { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1, bagId: 'moss_pouch' }
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
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);

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
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');
  const result = await resolveRound(session.player.id, run.id);
  const battle = await getBattle(result.lastRound.battleId, session.player.id);

  const stepEvents = battle.events.filter((e) => e.type === 'step_start');
  assert.ok(stepEvents.length > 0);
  assert.ok(stepEvents[0].step >= 1);
  assert.equal(stepEvents[0].type, 'step_start');

  // Verify no round_start events exist
  const roundEvents = battle.events.filter((e) => e.type === 'round_start');
  assert.equal(roundEvents.length, 0);
});

// --- Game run history ---

test('[Req 1-E] getGameRunHistory returns completed runs', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);

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
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);

  await startGameRun(session.player.id, 'solo');

  const history = await getGameRunHistory(session.player.id);
  assert.equal(history.length, 0);
});

// --- Coin carry-over ---

test('[Req 4-B, 4-C] coins carry over between rounds', async () => {
  await freshDb();
  const session = await createPlayer();
  await selectActiveMushroom(session.player.id, 'thalla');
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);

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
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);

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
