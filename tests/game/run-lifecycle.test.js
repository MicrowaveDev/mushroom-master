// Integration tests for the run lifecycle on the new game_run_loadout_items
// table: copy-forward correctness, ghost prune, duplicate preservation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../app/server/db.js';
import {
  resolveRound,
  pruneOldGhostSnapshots
} from '../../app/server/services/game-service.js';
import {
  freshDb,
  bootRun,
  seedRunLoadout,
  countBotGhostRows
} from './helpers.js';

test('[Req 11-A] copy-forward: round N rows are byte-identical in round N+1 except fresh_purchase', async () => {
  await freshDb();
  const { playerId, run } = await bootRun();
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
    { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
  ]);

  const round1 = await query(
    `SELECT artifact_id, x, y, width, height, purchased_round
     FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
     ORDER BY sort_order ASC`,
    [run.id, playerId]
  );
  assert.equal(round1.rowCount, 3);

  const result = await resolveRound(playerId, run.id);
  if (result.status !== 'active') return;

  const round2 = await query(
    `SELECT artifact_id, x, y, width, height, purchased_round, fresh_purchase
     FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2
     ORDER BY sort_order ASC`,
    [run.id, playerId]
  );
  assert.equal(round2.rowCount, 3);

  for (let i = 0; i < round1.rowCount; i++) {
    assert.equal(round2.rows[i].artifact_id, round1.rows[i].artifact_id);
    assert.equal(round2.rows[i].x, round1.rows[i].x);
    assert.equal(round2.rows[i].y, round1.rows[i].y);
    assert.equal(round2.rows[i].purchased_round, round1.rows[i].purchased_round);
    // fresh_purchase is ALWAYS reset on copy-forward, even if the original
    // was already 0. Nothing should arrive in round N+1 as "fresh".
    assert.equal(round2.rows[i].fresh_purchase, 0);
  }
});

test('[Req 11-A] copy-forward: duplicate artifacts survive as two distinct rows', async () => {
  await freshDb();
  const { playerId, run } = await bootRun();
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
    { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 }
  ]);

  const result = await resolveRound(playerId, run.id);
  if (result.status !== 'active') return;

  const round2 = await query(
    `SELECT COUNT(*) AS count FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2 AND artifact_id = 'spore_needle'`,
    [run.id, playerId]
  );
  assert.equal(Number(round2.rows[0].count), 2, 'duplicate artifacts must survive copy-forward as two rows');
});

test('[Req 11-A] copy-forward: purchased_round is preserved (not reset to N+1)', async () => {
  await freshDb();
  const { playerId, run } = await bootRun();
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);

  // Manually mark the seeded row as purchased in round 1 with purchased_round=1.
  // seedRunLoadout already does this.
  const result = await resolveRound(playerId, run.id);
  if (result.status !== 'active') return;

  const round2 = await query(
    `SELECT purchased_round FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2 AND artifact_id = 'spore_needle'`,
    [run.id, playerId]
  );
  assert.equal(round2.rows[0].purchased_round, 1, 'purchased_round must survive the copy-forward');
});

test('[Req 7-G] bot ghost rows appear in game_run_loadout_items after a solo round', async () => {
  await freshDb();
  const { playerId, run } = await bootRun();
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
  await resolveRound(playerId, run.id);

  assert.ok(
    (await countBotGhostRows()) > 0,
    'bot ghost fallback must write rows to the unified table'
  );
});

test('[Req 7-H] pruneOldGhostSnapshots deletes synthetic ghost:bot rows older than maxAge', async () => {
  await freshDb();
  const { playerId, run } = await bootRun();
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
  await resolveRound(playerId, run.id);

  // Backdate the ghost rows so they look old.
  const oldTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await query(
    `UPDATE game_run_loadout_items SET created_at = $1 WHERE game_run_id LIKE 'ghost:bot:%'`,
    [oldTimestamp]
  );

  // The rowCount reported by sqlite may be unreliable for DELETEs; we assert
  // on the actual table state rather than the return value.
  assert.ok((await countBotGhostRows()) > 0, 'precondition: ghost rows exist');

  await pruneOldGhostSnapshots(1);

  assert.equal(await countBotGhostRows(), 0, 'ghost rows must be deleted');
});

test('[Req 7-H] pruneOldGhostSnapshots does not touch real-player rows', async () => {
  await freshDb();
  const { playerId, run } = await bootRun();
  await seedRunLoadout(playerId, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);

  // Backdate the player's own rows.
  const oldTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await query(
    `UPDATE game_run_loadout_items SET created_at = $1 WHERE game_run_id = $2`,
    [oldTimestamp, run.id]
  );

  await pruneOldGhostSnapshots(1);

  const leftover = await query(
    `SELECT COUNT(*) AS count FROM game_run_loadout_items WHERE game_run_id = $1`,
    [run.id]
  );
  assert.ok(Number(leftover.rows[0].count) > 0, 'real player rows must not be pruned');
});
