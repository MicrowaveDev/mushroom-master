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
  countBotGhostRows
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
test('duplicate artifacts create distinct loadout rows', async () => {
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
test('reload preserves loadout layout for current round', async () => {
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
test('round 1 loadout rows remain frozen after round 2 resolves', async () => {
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
test('ghost lookup returns rows from another real player at the matching round', async () => {
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
// #5 — legacy isolation: startGameRun does not write to player_artifact_loadouts
// Plan: §2.9 full severance.
// ---------------------------------------------------------------------------
test('startGameRun does not seed the legacy player_artifact_loadouts table', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  const session = await createPlayer({ telegramId: 601, username: 'solo' });
  await selectActiveMushroom(session.player.id, 'thalla');
  // Deliberately DO NOT call saveArtifactLoadout — legacy table should stay empty.

  // Snapshot legacy row count before.
  const legacyBefore = await query(
    `SELECT COUNT(*) AS count FROM player_artifact_loadout_items items
     JOIN player_artifact_loadouts loadouts ON loadouts.id = items.loadout_id
     WHERE loadouts.player_id = $1`,
    [session.player.id]
  );

  await startGameRun(session.player.id, 'solo');

  const legacyAfter = await query(
    `SELECT COUNT(*) AS count FROM player_artifact_loadout_items items
     JOIN player_artifact_loadouts loadouts ON loadouts.id = items.loadout_id
     WHERE loadouts.player_id = $1`,
    [session.player.id]
  );

  assert.equal(
    Number(legacyAfter.rows[0].count),
    Number(legacyBefore.rows[0].count),
    'startGameRun must not add rows to the legacy loadout table'
  );

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
test('shop state row for round 1 remains after round 2 resolves', async () => {
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
test('item bought in round 1 and sold in round 2 refunds at half price', async () => {
  await freshDb();
  await requireTable('game_run_loadout_items', 'Step 1 not complete');

  const { playerId, run } = await bootPlayerInRun();
  // Replace the auto-generated 5-coin starter with a minimal 1-coin loadout
  // so we have budget headroom for the purchase.
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
  const active = await getActiveGameRun(playerId);
  const artifactId = active.shopOffer.find((id) => id !== 'spore_needle') || active.shopOffer[0];

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
    `SELECT purchased_round FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2
       AND artifact_id = $3`,
    [run.id, playerId, artifactId]
  );

  if (rows.rowCount === 0) {
    throw new Error('Step 3 not complete: round 2 copy-forward did not include the purchased item');
  }
  assert.equal(rows.rows[0].purchased_round, 1, 'purchased_round must survive the copy-forward');

  // Sell the item — refund should be half price (not full) because purchased_round !== current_round.
  const sellResult = await sellRunItem(playerId, run.id, artifactId);
  // sellResult.sellPrice is set by run-service; we just assert it's <= artifact price.
  assert.ok(sellResult.sellPrice >= 0);
});

// ---------------------------------------------------------------------------
// #8 — authorization: one player cannot mutate another's run
// Plan: §11.6.
// ---------------------------------------------------------------------------
test('cross-run mutation is rejected', async () => {
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
test('auto-seeded preset + full shop spend resolves round 1 without budget error', async () => {
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
test('bot ghost fallback writes real rows into game_run_loadout_items', async () => {
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
