import { query, resetDb } from '../../app/server/db.js';
import { upsertTelegramPlayer } from '../../app/server/auth.js';
import {
  selectActiveMushroom,
  startGameRun
} from '../../app/server/services/game-service.js';
import { createId, nowIso } from '../../app/server/lib/utils.js';
import { artifacts, getArtifactById, getArtifactPrice } from '../../app/server/game-data.js';

// Re-exports so test files don't need to dynamic-import game-data inside
// test bodies. See AGENTS.md "Backend Scenario vs Unit Test Rules".
export { artifacts, getArtifactById, getArtifactPrice };

export async function freshDb() {
  process.env.NODE_ENV = 'test';
  await resetDb();
}

let telegramIdCounter = 100000;

export async function createPlayer(overrides = {}) {
  // Monotonic IDs prevent cross-test collisions even when freshDb() is
  // skipped. Randomized IDs caused intermittent "sell item from previous
  // round" flakiness when two tests happened to draw the same ID.
  const user = {
    id: overrides.telegramId || telegramIdCounter++,
    username: overrides.username || 'tester',
    first_name: overrides.firstName || 'Test',
    last_name: overrides.lastName || 'Player',
    language_code: overrides.lang || 'ru'
  };
  return upsertTelegramPlayer(user, 'telegram_test');
}

export async function saveSetup(playerId, mushroomId, _items) {
  // saveArtifactLoadout (legacy) was deleted 2026-04-13. Tests that need a
  // deterministic loadout should call seedRunLoadout(playerId, runId, items)
  // after starting the game run instead.
  await selectActiveMushroom(playerId, mushroomId);
}

/**
 * Boot a player into an active solo run. Round 1 starts with an empty
 * run-scoped inventory — tests that need a deterministic loadout should
 * call `seedRunLoadout` after `bootRun`.
 *
 * Pass a different `mushroomId` for character-specific tests.
 */
export async function bootRun({
  telegramId,
  username,
  mushroomId = 'thalla'
} = {}) {
  const session = await createPlayer({ telegramId, username });
  await selectActiveMushroom(session.player.id, mushroomId);
  const run = await startGameRun(session.player.id, 'solo');
  return { playerId: session.player.id, run };
}

/**
 * Current coins for a player inside a run. Used by concurrency/ledger tests
 * that assert on post-mutation balance.
 */
export async function getCoins(gameRunId, playerId) {
  const r = await query(
    `SELECT coins FROM game_run_players WHERE game_run_id = $1 AND player_id = $2`,
    [gameRunId, playerId]
  );
  return r.rowCount ? r.rows[0].coins : null;
}

/**
 * Read the round-scoped shop offer for a player. Returns `null` when the
 * row doesn't exist yet (e.g. before startGameRun or after run end).
 */
export async function getShopOffer(gameRunId, playerId, roundNumber) {
  const r = await query(
    `SELECT offer_json FROM game_run_shop_states
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3`,
    [gameRunId, playerId, roundNumber]
  );
  return r.rowCount ? JSON.parse(r.rows[0].offer_json) : null;
}

/**
 * Deterministically replace the shop offer for a specific round. Useful when
 * a test needs to force a particular artifact into the shop to exercise a
 * buy path. The write bypasses the refresh cost and RNG.
 */
export async function forceShopOffer(gameRunId, playerId, roundNumber, artifactIds) {
  await query(
    `UPDATE game_run_shop_states SET offer_json = $1
     WHERE game_run_id = $2 AND player_id = $3 AND round_number = $4`,
    [JSON.stringify(artifactIds), gameRunId, playerId, roundNumber]
  );
}

/**
 * Find a cheap, dupable, non-bag 1×1 artifact suitable for buy/duplicate
 * tests. Excludes `spore_needle` by default because it's the conventional
 * seed starter — using it as the "cheap dupe" collides with seed rows.
 *
 * @param {string[]} excludeIds - extra artifact ids to exclude
 * @param {number} price - target price (default 1 for maximum budget headroom)
 */
export function findCheapArtifact(excludeIds = ['spore_needle'], price = 1) {
  const excluded = new Set(excludeIds);
  return artifacts.find(
    (a) =>
      !excluded.has(a.id) &&
      a.family !== 'bag' &&
      a.width === 1 &&
      a.height === 1 &&
      getArtifactPrice(a) === price
  );
}

/**
 * Count synthetic bot ghost rows in the unified loadout table. Used to
 * assert the §2.4 invariant: bot fallback writes into game_run_loadout_items
 * rather than a parallel table.
 */
export async function countBotGhostRows() {
  const r = await query(
    `SELECT COUNT(*) AS count FROM game_run_loadout_items WHERE game_run_id LIKE 'ghost:bot:%'`
  );
  return Number(r.rows[0].count);
}

export async function seedRunLoadout(playerId, gameRunId, items) {
  await query(
    `DELETE FROM game_run_loadout_items WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1`,
    [gameRunId, playerId]
  );
  for (const [index, item] of items.entries()) {
    await query(
      `INSERT INTO game_run_loadout_items
         (id, game_run_id, player_id, round_number, artifact_id, x, y, width, height,
          bag_id, sort_order, purchased_round, fresh_purchase, created_at)
       VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, 1, 0, $11)`,
      [
        createId('grlitem'),
        gameRunId,
        playerId,
        item.artifactId,
        item.x ?? 0,
        item.y ?? 0,
        item.width ?? 1,
        item.height ?? 1,
        item.bagId || null,
        index,
        nowIso()
      ]
    );
  }
}
