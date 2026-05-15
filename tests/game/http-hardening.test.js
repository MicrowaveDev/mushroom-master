import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../app/server/create-app.js';
import { freshDb } from './helpers.js';

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
