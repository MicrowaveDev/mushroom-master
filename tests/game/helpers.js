import { resetDb } from '../../app/server/db.js';
import { upsertTelegramPlayer } from '../../app/server/auth.js';
import { saveArtifactLoadout, selectActiveMushroom } from '../../app/server/services/game-service.js';

export async function freshDb() {
  process.env.NODE_ENV = 'test';
  await resetDb();
}

export async function createPlayer(overrides = {}) {
  const user = {
    id: overrides.telegramId || Math.floor(1000 + Math.random() * 9000),
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
