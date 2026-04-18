import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  authenticateRequest,
  createTelegramAuthCode,
  loginWithTelegram,
  verifyTelegramAuthCode,
  verifyTelegramInitData,
  confirmTelegramAuthCode
} from '../../app/server/auth.js';
import { freshDb } from './helpers.js';

function createInitData(botToken, user) {
  const params = new URLSearchParams();
  params.set('auth_date', '1710000000');
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
