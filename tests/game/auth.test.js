import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  authenticateRequest,
  createTelegramAuthCode,
  loginWithWebSession,
  loginWithTelegram,
  pruneExpiredAuthRecords,
  verifyTelegramAuthCode,
  verifyTelegramInitData,
  confirmTelegramAuthCode
} from '../../app/server/auth.js';
import { freshDb } from './helpers.js';
import { query } from '../../app/server/db.js';
import { handleTelegramWebhook } from '../../app/server/bot-gateway.js';
import { profileRuntimeService } from '../../app/server/services/profile-runtime-service.js';

function createInitData(botToken, user) {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAEAAAE');
  params.set('user', JSON.stringify(user));
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

function createInitDataWithAuthDate(botToken, user, authDate) {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'AAEAAAE');
  params.set('user', JSON.stringify(user));
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('telegram auth and shared session bootstrap work', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'bot:test-token';
  await freshDb();
  const initData = createInitData(process.env.TELEGRAM_BOT_TOKEN, {
    id: 101,
    username: 'thalla_ru',
    first_name: 'Thalla',
    language_code: 'ru'
  });

  assert.equal(verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN), true);
  const login = await loginWithTelegram(initData, process.env.TELEGRAM_BOT_TOKEN);
  assert.ok(login.session.sessionKey);

  const next = () => Promise.resolve();
  const headerReq = {
    header(name) {
      return name.toLowerCase() === 'x-session-key' ? login.session.sessionKey : undefined;
    }
  };
  await authenticateRequest(headerReq, {}, next);
  assert.equal(headerReq.authenticated, true);
  assert.equal(headerReq.user.telegramUsername, 'thalla_ru');

  const bearerReq = {
    header(name) {
      return name.toLowerCase() === 'authorization' ? `Bearer ${login.session.sessionKey}` : undefined;
    }
  };
  await authenticateRequest(bearerReq, {}, next);
  assert.equal(bearerReq.authenticated, true);
  assert.equal(bearerReq.user.name, 'Thalla');
});

test('web auth creates a browser-playable session without Telegram initData', async () => {
  await freshDb();
  const login = await loginWithWebSession({
    clientId: 'browser-player-001',
    name: 'Browser',
    lastName: 'Player',
    lang: 'en'
  });

  assert.ok(login.session.sessionKey);
  assert.equal(login.session.provider, 'web');
  assert.equal(login.player.telegram_id, 'web:browser-player-001');
  assert.equal(login.player.name, 'Browser Player');

  const secondLogin = await loginWithWebSession({
    clientId: 'browser-player-001',
    name: 'Browser',
    lastName: 'Player',
    lang: 'en'
  });
  assert.equal(secondLogin.player.id, login.player.id);
});

test('shared profile runtime drives Mushroom login, bootstrap, and character selection', async () => {
  await freshDb();
  assert.equal(profileRuntimeService.contract, 'profile-runtime/v1');

  const login = await profileRuntimeService.login('web', {
    clientId: 'runtime-player-001',
    name: 'Runtime',
    lastName: 'Player',
    lang: 'en'
  });
  assert.ok(login.sessionKey);
  assert.equal(login.user.name, 'Runtime Player');

  const bootstrap = await profileRuntimeService.getBootstrap(login.user.id);
  assert.equal(bootstrap.player.id, login.user.id);
  assert.deepEqual(bootstrap.settings.tutorial, {
    versionSeen: 0,
    disabled: false,
    replayPending: false,
    seenStepIds: []
  });

  const updated = await profileRuntimeService.updateSettings(login.user.id, {
    tutorial: {
      versionSeen: 1,
      disabled: false,
      replayPending: true,
      seenStepIds: ['build_backpack']
    }
  });
  assert.equal(updated.settings.lang, 'en');
  assert.deepEqual(updated.settings.tutorial, {
    versionSeen: 1,
    disabled: false,
    replayPending: true,
    seenStepIds: ['build_backpack']
  });

  const selected = await profileRuntimeService.setActiveCharacter(login.user.id, 'thalla');
  assert.equal(selected.activeMushroomId, 'thalla');
});

test('browser fallback auth code can be confirmed through the bot start flow', async () => {
  await freshDb();
  const authCode = await createTelegramAuthCode();
  const pending = await verifyTelegramAuthCode(authCode.privateCode);
  assert.equal(pending.needsBotAuth, true);

  await confirmTelegramAuthCode(authCode.publicCode, {
      id: 202,
      username: 'lomie_en',
      first_name: 'Lomie',
      language_code: 'en'
  });

  const verified = await verifyTelegramAuthCode(authCode.privateCode);
  assert.equal(verified.success, true);
  assert.ok(verified.session.sessionKey);
});

test('telegram webhook confirms fallback auth code and replies to start command', async () => {
  await freshDb();
  const authCode = await createTelegramAuthCode();
  const calls = [];

  const result = await handleTelegramWebhook({
    message: {
      message_id: 1,
      text: `/start auth-${authCode.publicCode}`,
      chat: { id: 999, type: 'private' },
      from: {
        id: 202,
        username: 'lomie_en',
        first_name: 'Lomie',
        language_code: 'en'
      }
    }
  }, {
    token: 'bot:test',
    botUsername: 'MushroomBattlesBot',
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return {
        async json() {
          return { ok: true, result: true };
        }
      };
    }
  });

  assert.deepEqual(result, { kind: 'auth_confirmed', answered: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /sendMessage$/);
  assert.equal(calls[0].body.chat_id, 999);
  assert.match(calls[0].body.text, /Authentication confirmed/);

  const verified = await verifyTelegramAuthCode(authCode.privateCode);
  assert.equal(verified.success, true);
});

test('telegram auth rejects stale signed init data', () => {
  const botToken = 'bot:test-token';
  const staleInitData = createInitDataWithAuthDate(botToken, {
    id: 303,
    username: 'stale_user',
    first_name: 'Stale',
    language_code: 'en'
  }, Math.floor(Date.now() / 1000) - (25 * 60 * 60));

  assert.equal(verifyTelegramInitData(staleInitData, botToken), false);
});

test('[production-db] auth pruning removes expired sessions and browser auth codes', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'bot:test-token';
  await freshDb();
  const initData = createInitData(process.env.TELEGRAM_BOT_TOKEN, {
    id: 404,
    username: 'expired_auth',
    first_name: 'Expired',
    language_code: 'en'
  });
  const login = await loginWithTelegram(initData, process.env.TELEGRAM_BOT_TOKEN);
  const authCode = await createTelegramAuthCode();

  await query(`UPDATE sessions SET expires_at = '2020-01-01T00:00:00.000Z' WHERE session_key = $1`, [
    login.session.sessionKey
  ]);
  await query(`UPDATE auth_codes SET expires_at = '2020-01-01T00:00:00.000Z' WHERE private_code = $1`, [
    authCode.privateCode
  ]);

  const result = await pruneExpiredAuthRecords('2021-01-01T00:00:00.000Z');
  assert.equal(result.prunedSessions, 1);
  assert.equal(result.prunedAuthCodes, 1);

  const sessions = await query(`SELECT 1 FROM sessions WHERE session_key = $1`, [login.session.sessionKey]);
  assert.equal(sessions.rowCount, 0);
  const authCodes = await query(`SELECT 1 FROM auth_codes WHERE private_code = $1`, [authCode.privateCode]);
  assert.equal(authCodes.rowCount, 0);
});
