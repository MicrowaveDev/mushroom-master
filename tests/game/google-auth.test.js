import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { OAuth2Client } from 'google-auth-library';
import { createGoogleLogin, googleAuthConfig } from '../../app/server/google-auth.js';
import { createApp } from '../../app/server/create-app.js';
import { profileRuntimeService } from '../../app/server/services/profile-runtime-service.js';
import { loginWithWebSession, upsertTelegramPlayer, logoutSession } from '../../app/server/auth.js';
import { query } from '../../app/server/db.js';
import { freshDb } from './helpers.js';

const clientId = 'test.apps.googleusercontent.com';

test('Google configuration defaults off and rejects incomplete opt-in', () => {
  assert.deepEqual(googleAuthConfig({}), { enabled: false, clientId: '', loginUri: '' });
  assert.throws(() => googleAuthConfig({ ENABLE_GOOGLE_AUTH: '1' }), /GOOGLE_CLIENT_ID/);
  assert.equal(googleAuthConfig({ ENABLE_GOOGLE_AUTH: '1', GOOGLE_CLIENT_ID: clientId }).loginUri,
    'https://mushroombattles.com/api/auth/google/callback');
});

test('verified Google users keep their player, language and progress without merging other providers', async () => {
  await freshDb();
  const login = createGoogleLogin({ getConfig: () => ({ enabled: true, clientId }), oauthClient: {
    async verifyIdToken(options) {
      assert.equal(options.audience, clientId);
      assert.equal(options.idToken, 'signed');
      return { getPayload: () => ({ sub: '123', name: 'Google Player' }) };
    }
  } });
  const telegram = await upsertTelegramPlayer({ id: '123', first_name: 'Google Player' });
  const browser = await loginWithWebSession({ clientId: 'google:123' });
  const first = await login({ credential: 'signed', lang: 'en' });
  assert.notEqual(first.player.id, telegram.player.id);
  assert.notEqual(first.player.id, browser.player.id);
  assert.equal(first.session.provider, 'google');
  await query('UPDATE players SET spore = 17 WHERE id = $1', [first.player.id]);
  const returning = await login({ credential: 'signed' });
  assert.equal(returning.player.id, first.player.id);
  assert.equal(returning.player.spore, 17);
  assert.equal(returning.player.lang, 'en');
  assert.notEqual(returning.session.sessionKey, first.session.sessionKey);
  assert.ok((await profileRuntimeService.completeLogin(returning)).sessionKey);
  await logoutSession(returning.session.sessionKey);
  assert.equal((await query('SELECT * FROM sessions WHERE session_key = $1', [returning.session.sessionKey])).rowCount, 0);
});

test('Google callback validates CSRF and token before issuing an authenticated browser session', async (t) => {
  const previous = { ENABLE_GOOGLE_AUTH: process.env.ENABLE_GOOGLE_AUTH, GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.ENABLE_GOOGLE_AUTH = 'true';
  process.env.GOOGLE_CLIENT_ID = clientId;
  await freshDb();
  let calls = 0;
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async ({ idToken, audience }) => {
    calls++;
    assert.equal(audience, clientId);
    if (idToken !== 'valid') throw new Error('bad signature');
    return { getPayload: () => ({ sub: '456', name: 'Test Google Player' }) };
  });
  const app = await createApp();
  const config = await request(app).get('/api/app-config');
  assert.equal(config.body.data.googleAuthEnabled, true);
  assert.equal(config.body.data.googleClientId, clientId);
  const post = (token = 'valid') => request(app).post('/api/auth/google/callback')
    .set('Cookie', 'g_csrf_token=csrf').type('form').send({ g_csrf_token: 'csrf', credential: token });
  const csrfFailure = await request(app).post('/api/auth/google/callback').type('form').send({ credential: 'valid', g_csrf_token: 'csrf' });
  assert.equal(csrfFailure.status, 403);
  assert.equal(calls, 0);
  assert.equal((await post('invalid')).status, 401);
  assert.equal((await query('SELECT * FROM sessions')).rowCount, 0);
  const success = await post();
  assert.equal(success.status, 200);
  assert.equal(success.headers['cache-control'], 'no-store');
  assert.match(success.headers['content-security-policy'], /script-src 'nonce-/);
  const session = (await query("SELECT * FROM sessions WHERE provider = 'google'")).rows[0];
  assert.ok(session);
  assert.ok(success.text.includes(session.session_key));
  assert.match(success.text, /localStorage.setItem\("sessionKey"/);
  const bootstrap = await request(app).get('/api/bootstrap').set('x-session-key', session.session_key);
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.body.data.activeMushroomId, null);
  process.env.ENABLE_GOOGLE_AUTH = 'false';
  assert.equal((await post()).status, 403);
  assert.equal(calls, 2);
});
