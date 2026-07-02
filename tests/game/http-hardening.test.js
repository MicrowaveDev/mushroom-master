import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../app/server/create-app.js';
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
