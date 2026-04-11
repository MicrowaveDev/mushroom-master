// Bridge pin: `applyRunLoadoutPlacements` is a pass-through shim.
//
// The `PUT /api/artifact-loadout` → `applyRunLoadoutPlacements` layer exists
// only as a temporary bridge to the new run-scoped loadout table. It is
// load-bearing (keeps the client working) but has no reason to ever contain
// business logic.
//
// These tests exist to break loudly if a future author quietly adds coin
// math, shop mutations, refund handling, or any other business logic to the
// bridge. When that happens the multi-source-of-truth problem the refactor
// solved will start re-accumulating — the whole point of the severance is
// that there's one writer per table.
//
// If the bridge actually needs to do more work, the right move is to write
// granular endpoints (see docs/post-review-followups.md Batch C1), not to
// fatten this shim.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { query } from '../../app/server/db.js';
import {
  startGameRun,
  applyRunLoadoutPlacements,
  selectActiveMushroom
} from '../../app/server/services/game-service.js';
import { freshDb, createPlayer, seedRunLoadout, getCoins } from './helpers.js';

// ---------------------------------------------------------------------------
// Behavioral pin: mutations to game_run_refunds, game_run_players.coins, and
// game_run_shop_states must NOT happen through this code path. If they do,
// the bridge has grown business logic and needs to be split into a dedicated
// endpoint.
// ---------------------------------------------------------------------------

test('bridge: applyRunLoadoutPlacements does not touch coins', async () => {
  await freshDb();
  const session = await createPlayer({ telegramId: 4101, username: 'bridge_coins' });
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');
  await seedRunLoadout(session.player.id, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);

  const coinsBefore = await getCoins(run.id, session.player.id);

  // Re-place the existing item — legitimate use of the bridge.
  await applyRunLoadoutPlacements(session.player.id, run.id, [
    { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 }
  ]);

  const coinsAfter = await getCoins(run.id, session.player.id);
  assert.equal(
    coinsAfter,
    coinsBefore,
    'bridge must never adjust coins — coin math belongs in buyRunShopItem / sellRunItem'
  );
});

test('bridge: applyRunLoadoutPlacements does not touch shop state', async () => {
  await freshDb();
  const session = await createPlayer({ telegramId: 4102, username: 'bridge_shop' });
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');
  await seedRunLoadout(session.player.id, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);

  const shopBefore = await query(
    `SELECT offer_json, refresh_count, rounds_since_bag FROM game_run_shop_states
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [run.id, session.player.id]
  );

  await applyRunLoadoutPlacements(session.player.id, run.id, [
    { artifactId: 'spore_needle', x: 2, y: 0, width: 1, height: 1 }
  ]);

  const shopAfter = await query(
    `SELECT offer_json, refresh_count, rounds_since_bag FROM game_run_shop_states
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [run.id, session.player.id]
  );

  assert.deepEqual(
    shopAfter.rows[0],
    shopBefore.rows[0],
    'bridge must never mutate shop state — shop mutations belong in refreshRunShop / buyRunShopItem'
  );
});

test('bridge: applyRunLoadoutPlacements does not write to game_run_refunds', async () => {
  await freshDb();
  const session = await createPlayer({ telegramId: 4103, username: 'bridge_refunds' });
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');
  await seedRunLoadout(session.player.id, run.id, [
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);

  await applyRunLoadoutPlacements(session.player.id, run.id, [
    { artifactId: 'spore_needle', x: 3, y: 0, width: 1, height: 1 }
  ]);

  const refunds = await query(
    `SELECT COUNT(*) AS count FROM game_run_refunds WHERE game_run_id = $1`,
    [run.id]
  );
  assert.equal(
    Number(refunds.rows[0].count),
    0,
    'bridge must never create refund rows — refund logic belongs in sellRunItem'
  );
});

// ---------------------------------------------------------------------------
// Structural pin: the bridge body is intentionally small. If it grows past
// a sanity threshold of ~30 non-blank lines, that's a strong signal that
// business logic is creeping in. The pin catches that without pretending
// to parse the function properly — a simple line count is enough to prompt
// "wait, did I just add a 40-line coin validator to the bridge?"
//
// When the bridge is deleted (Batch C1), this test goes away with it.
// ---------------------------------------------------------------------------

test('bridge: applyRunLoadoutPlacements body stays small (structural pin)', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'app/server/services/run-service.js'),
    'utf-8'
  );

  const lines = source.split('\n');
  const startIdx = lines.findIndex((l) => l.includes('export async function applyRunLoadoutPlacements('));
  assert.ok(startIdx >= 0, 'could not locate applyRunLoadoutPlacements in source');

  // Scan forward from the signature until matching closing brace at column 0.
  let endIdx = -1;
  let depth = 0;
  let started = false;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') { depth--; }
    }
    if (started && depth === 0) { endIdx = i; break; }
  }
  assert.ok(endIdx > startIdx, 'could not find end of applyRunLoadoutPlacements body');

  const bodyLines = lines
    .slice(startIdx, endIdx + 1)
    .filter((l) => l.trim() !== '' && !l.trim().startsWith('//'));

  // Current body is ~18 lines. Threshold gives headroom for minor structural
  // changes (e.g. an extra validation branch) but breaks loudly if someone
  // drops in a 20-line coin math block.
  assert.ok(
    bodyLines.length <= 30,
    `applyRunLoadoutPlacements body is ${bodyLines.length} lines; threshold is 30. ` +
    `If you need more logic, write a granular endpoint — see docs/post-review-followups.md Batch C1.`
  );
});
