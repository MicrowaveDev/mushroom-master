// Phase 1 of the client row-id refactor (docs/client-row-id-refactor.md)
// pins the server-side half of the contract: buy returns the new row id,
// sell accepts an optional row id for duplicate disambiguation, and
// applyRunLoadoutPlacements honors a row id when the client sends one.
//
// These tests run at the service layer — no HTTP harness — so they pin
// the shape of the returned data and the DB mutations directly.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buyRunShopItem,
  sellRunItem,
  applyRunLoadoutPlacements,
  getActiveGameRun
} from '../../app/server/services/game-service.js';
import { query } from '../../app/server/db.js';
import { freshDb, bootRun, forceShopOffer } from './helpers.js';

test('[row-id] buyRunShopItem returns the newly inserted row id', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 5001 });
  await forceShopOffer(run.id, playerId, 1, ['bark_plate']);

  const result = await buyRunShopItem(playerId, run.id, 'bark_plate');

  assert.ok(typeof result.id === 'string' && result.id.length > 0, 'buy response must include the new row id');
  assert.equal(result.artifactId, 'bark_plate');

  // The returned id must point at an actual row in the current round.
  const row = await query(
    `SELECT id, artifact_id, x, y FROM game_run_loadout_items
     WHERE id = $1 AND game_run_id = $2 AND player_id = $3`,
    [result.id, run.id, playerId]
  );
  assert.equal(row.rowCount, 1);
  assert.equal(row.rows[0].artifact_id, 'bark_plate');
  assert.equal(row.rows[0].x, -1);
  assert.equal(row.rows[0].y, -1);
});

test('[row-id] sellRunItem with {id} deletes the exact row even when a duplicate exists', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 5002 });

  // Buy two copies of the same cheap artifact.
  await forceShopOffer(run.id, playerId, 1, ['bark_plate']);
  const first = await buyRunShopItem(playerId, run.id, 'bark_plate');
  await forceShopOffer(run.id, playerId, 1, ['bark_plate']);
  const second = await buyRunShopItem(playerId, run.id, 'bark_plate');
  assert.notEqual(first.id, second.id, 'two buys must yield two distinct row ids');

  // Sell the FIRST copy specifically by row id. The server must delete
  // exactly that row, not the more-recently-added one (which is what the
  // legacy artifactId path would pick via sort_order DESC).
  const sold = await sellRunItem(playerId, run.id, { id: first.id, artifactId: 'bark_plate' });
  assert.equal(sold.id, first.id, 'sell response must echo the row id that was deleted');

  // Only the SECOND copy must remain on the server.
  const remaining = await query(
    `SELECT id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND artifact_id = 'bark_plate'`,
    [run.id, playerId]
  );
  assert.equal(remaining.rowCount, 1);
  assert.equal(remaining.rows[0].id, second.id);
});

test('[row-id] sellRunItem without {id} falls back to last-by-sort-order (legacy shape)', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 5003 });

  await forceShopOffer(run.id, playerId, 1, ['bark_plate']);
  const first = await buyRunShopItem(playerId, run.id, 'bark_plate');
  await forceShopOffer(run.id, playerId, 1, ['bark_plate']);
  const second = await buyRunShopItem(playerId, run.id, 'bark_plate');

  // Legacy call shape: bare artifactId string. The server's fallback is to
  // delete the last-inserted matching row (via deleteOneByArtifactId), so
  // the SECOND copy is the one removed.
  const sold = await sellRunItem(playerId, run.id, 'bark_plate');
  assert.equal(sold.artifactId, 'bark_plate');

  const remaining = await query(
    `SELECT id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND artifact_id = 'bark_plate'`,
    [run.id, playerId]
  );
  assert.equal(remaining.rowCount, 1);
  assert.equal(remaining.rows[0].id, first.id, 'legacy fallback leaves the older row in place');
});

test('[row-id] applyRunLoadoutPlacements respects row id when disambiguating duplicates', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 5004 });

  // Two copies of spore_needle in the container (plus starter preset on grid).
  await forceShopOffer(run.id, playerId, 1, ['spore_needle']);
  const first = await buyRunShopItem(playerId, run.id, 'spore_needle');
  await forceShopOffer(run.id, playerId, 1, ['spore_needle']);
  const second = await buyRunShopItem(playerId, run.id, 'spore_needle');

  // Read the starter rows so the payload is complete.
  const active = await getActiveGameRun(playerId);
  const starterRows = active.loadoutItems.filter(
    (i) => i.x >= 0 && i.y >= 0 && !i.bagId
  );

  // Thalla starter: spore_lash (0,0) + spore_needle (1,0). The free grid
  // cells are (2,0) and every cell of y=1,2. We ask the server to place
  // our SECOND purchase at (2,0) by row id, and leave our FIRST purchase
  // in the container (x=-1,y=-1).
  const placements = [
    ...starterRows.map((r) => ({
      id: r.id,
      artifactId: r.artifactId,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height
    })),
    { id: first.id, artifactId: 'spore_needle', x: -1, y: -1, width: 1, height: 1 },
    { id: second.id, artifactId: 'spore_needle', x: 2, y: 0, width: 1, height: 1 }
  ];

  await applyRunLoadoutPlacements(playerId, run.id, placements);

  // Verify: the SECOND copy sits at (2,0), the FIRST copy is at (-1,-1).
  const firstAfter = await query(
    `SELECT x, y FROM game_run_loadout_items WHERE id = $1`,
    [first.id]
  );
  const secondAfter = await query(
    `SELECT x, y FROM game_run_loadout_items WHERE id = $1`,
    [second.id]
  );
  assert.equal(firstAfter.rows[0].x, -1, 'first spore_needle must stay in container');
  assert.equal(firstAfter.rows[0].y, -1);
  assert.equal(secondAfter.rows[0].x, 2, 'second spore_needle must be placed at (2,0)');
  assert.equal(secondAfter.rows[0].y, 0);
});

test('[row-id] applyRunLoadoutPlacements still works for legacy payloads without row ids', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 5005 });

  await forceShopOffer(run.id, playerId, 1, ['spore_needle']);
  await buyRunShopItem(playerId, run.id, 'spore_needle');

  // Legacy payload shape: no `id` field. Server must still honor the
  // placement via the sort-order bucket-shift fallback.
  const active = await getActiveGameRun(playerId);
  const starter = active.loadoutItems.filter((i) => i.x >= 0 && i.y >= 0);
  const placements = [
    ...starter.map((r) => ({
      artifactId: r.artifactId,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height
    })),
    { artifactId: 'spore_needle', x: 2, y: 0, width: 1, height: 1 }
  ];

  await applyRunLoadoutPlacements(playerId, run.id, placements);

  const rows = await query(
    `SELECT x, y FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
       AND artifact_id = 'spore_needle' AND x = 2 AND y = 0`,
    [run.id, playerId]
  );
  assert.equal(rows.rowCount, 1, 'legacy payload must still place the fresh purchase');
});
