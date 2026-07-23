import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../app/server/create-app.js';
import { loginWithWebSession } from '../../app/server/auth.js';
import { clearRateLimitBuckets } from '../../app/server/lib/rate-limit.js';
import { freshDb } from './helpers.js';

async function withEnv(overrides, work) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  try {
    return await work();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('http responses include baseline production hardening headers', async () => {
  await freshDb();
  const app = await createApp();
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
  assert.match(response.headers['permissions-policy'], /camera=\(\)/);
});

test('[Req 4-Z] app config exposes payment support links for wallet UI', async () => {
  await withEnv({
    PAYMENT_SUPPORT_URL: 'https://support.example/pay',
    PAYMENT_TERMS_URL: 'https://terms.example/pay'
  }, async () => {
    await freshDb();
    const app = await createApp();
    const response = await request(app).get('/api/app-config');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.paymentSupport, {
      supportUrl: 'https://support.example/pay',
      termsUrl: 'https://terms.example/pay'
    });
  });
});

test('[telegram-auth] verification polling has a separate sustainable rate-limit bucket', async () => {
  await withEnv({ RATE_LIMIT_FORCE: 'true' }, async () => {
    await freshDb();
    clearRateLimitBuckets();
    const app = await createApp();
    const ip = '203.0.113.42';
    const created = await request(app)
      .post('/api/auth/telegram/code')
      .set('x-forwarded-for', ip)
      .send({});

    assert.equal(created.status, 200);
    const privateCode = created.body.data.privateCode;
    for (let i = 0; i < 12; i++) {
      const response = await request(app)
        .post('/api/auth/telegram/verify-code')
        .set('x-forwarded-for', ip)
        .send({ privateCode });
      assert.equal(response.status, 200);
      assert.equal(response.body.needsBotAuth, true);
    }
  });
});

test('[Req 4-Z] paid asset routes use separate abuse-control buckets', async () => {
  await withEnv({ RATE_LIMIT_FORCE: 'true' }, async () => {
    await freshDb();
    clearRateLimitBuckets();
    const login = await loginWithWebSession({
      clientId: 'rate-limit-paid-assets',
      name: 'Rate',
      lastName: 'Limit',
      lang: 'en'
    });
    const app = await createApp();
    const auth = { 'x-session-key': login.session.sessionKey };

    for (let i = 0; i < 30; i++) {
      const response = await request(app).get('/api/assets/catalog').set(auth);
      assert.equal(response.status, 200);
    }
    const catalogRejected = await request(app).get('/api/assets/catalog').set(auth);
    assert.equal(catalogRejected.status, 429);

    for (let i = 0; i < 4; i++) {
      const response = await request(app)
        .post('/api/wallet/purchase-intents')
        .set(auth)
        .send({ bundleId: 'coins_small', provider: 'btcpay', surface: 'web' });
      assert.equal(response.status, 200);
    }
    const checkoutRejected = await request(app)
      .post('/api/wallet/purchase-intents')
      .set(auth)
      .send({ bundleId: 'coins_small', provider: 'btcpay', surface: 'web' });
    assert.equal(checkoutRejected.status, 429);

    for (let i = 0; i < 8; i++) {
      const response = await request(app).post('/api/assets/unknown.purchase/purchase').set(auth).send({});
      assert.equal(response.status, 404);
    }
    const purchaseRejected = await request(app).post('/api/assets/unknown.purchase/purchase').set(auth).send({});
    assert.equal(purchaseRejected.status, 429);

    for (let i = 0; i < 6; i++) {
      const response = await request(app).post('/api/assets/packs/missing-pack/roll').set(auth).send({});
      assert.equal(response.status, 403);
    }
    const rollRejected = await request(app).post('/api/assets/packs/missing-pack/roll').set(auth).send({});
    assert.equal(rollRejected.status, 429);

    for (let i = 0; i < 20; i++) {
      const response = await request(app).get('/api/assets/packs/missing-pack/odds').set(auth);
      assert.equal(response.status, 404);
    }
    const oddsRejected = await request(app).get('/api/assets/packs/missing-pack/odds').set(auth);
    assert.equal(oddsRejected.status, 429);
  });
});
