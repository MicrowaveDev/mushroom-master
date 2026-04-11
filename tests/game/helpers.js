import { query, resetDb } from '../../app/server/db.js';
import { upsertTelegramPlayer } from '../../app/server/auth.js';
import { saveArtifactLoadout, selectActiveMushroom } from '../../app/server/services/game-service.js';
import { createId, nowIso } from '../../app/server/lib/utils.js';

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

export async function saveSetup(playerId, mushroomId, items) {
  await selectActiveMushroom(playerId, mushroomId);
  await saveArtifactLoadout(playerId, mushroomId, items);
}

/**
 * Seed a deterministic loadout into the run-scoped table for an active run.
 * Must be called AFTER startGameRun — replaces whatever starter was generated.
 * This is the preferred way to set up test scenarios with specific items,
 * since the legacy saveArtifactLoadout → startGameRun seeding path is gone
 * after §2.9 severance.
 */
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
