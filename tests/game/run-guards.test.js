// Unit tests for the run-mutation guard middlewares: idempotency + rate limit.
// These exercise the middleware functions directly against fake req/res
// objects — no HTTP server needed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { idempotency, clearIdempotencyCache } from '../../app/server/lib/idempotency.js';
import { rateLimit, clearRateLimitBuckets } from '../../app/server/lib/rate-limit.js';

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function makeReq({ playerId = 'p1', key, path = '/api/game-run/r1/buy' } = {}) {
  return {
    user: { id: playerId },
    headers: key ? { 'idempotency-key': key } : {},
    path
  };
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test('idempotency: no header passes through untouched', () => {
  clearIdempotencyCache();
  const mw = idempotency();
  const req = makeReq({ key: undefined });
  const res = makeRes();
  let called = false;
  mw(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.body, null);
});

test('idempotency: first call runs handler, second replays cached response', () => {
  clearIdempotencyCache();
  const mw = idempotency();

  // First call: handler runs, response is captured via res.json()
  const req1 = makeReq({ key: 'uuid-1' });
  const res1 = makeRes();
  let handlerCalls = 0;
  mw(req1, res1, () => {
    handlerCalls++;
    res1.status(200).json({ success: true, data: { coins: 7 } });
  });
  assert.equal(handlerCalls, 1);
  assert.deepEqual(res1.body, { success: true, data: { coins: 7 } });

  // Second call with the same key: middleware short-circuits, handler not called
  const req2 = makeReq({ key: 'uuid-1' });
  const res2 = makeRes();
  let secondHandlerCalled = false;
  mw(req2, res2, () => { secondHandlerCalled = true; });
  assert.equal(secondHandlerCalled, false, 'handler must NOT run on replay');
  assert.deepEqual(res2.body, { success: true, data: { coins: 7 } });
  assert.equal(res2.headers['x-idempotent-replay'], '1');
  assert.equal(res2.statusCode, 200);
});

test('idempotency: scoped per playerId — same key across players does not collide', () => {
  clearIdempotencyCache();
  const mw = idempotency();

  const reqA = makeReq({ playerId: 'alice', key: 'shared-uuid' });
  const resA = makeRes();
  mw(reqA, resA, () => resA.status(200).json({ owner: 'alice' }));

  const reqB = makeReq({ playerId: 'bob', key: 'shared-uuid' });
  const resB = makeRes();
  let ranForBob = false;
  mw(reqB, resB, () => {
    ranForBob = true;
    resB.status(200).json({ owner: 'bob' });
  });
  assert.equal(ranForBob, true, 'bob must not see alice\'s cached response');
  assert.deepEqual(resB.body, { owner: 'bob' });
});

test('idempotency: 5xx responses are NOT cached (must be retryable)', () => {
  clearIdempotencyCache();
  const mw = idempotency();

  const req1 = makeReq({ key: 'retry-me' });
  const res1 = makeRes();
  mw(req1, res1, () => res1.status(500).json({ success: false, error: 'boom' }));
  assert.equal(res1.statusCode, 500);

  // Second call must re-run the handler, not replay the 500
  const req2 = makeReq({ key: 'retry-me' });
  const res2 = makeRes();
  let ranAgain = false;
  mw(req2, res2, () => {
    ranAgain = true;
    res2.status(200).json({ success: true });
  });
  assert.equal(ranAgain, true, '5xx responses must not be cached');
  assert.equal(res2.statusCode, 200);
});

test('idempotency: 4xx responses ARE cached (client error is deterministic)', () => {
  clearIdempotencyCache();
  const mw = idempotency();

  const req1 = makeReq({ key: 'bad-req' });
  const res1 = makeRes();
  mw(req1, res1, () => res1.status(400).json({ success: false, error: 'Not enough coins' }));

  const req2 = makeReq({ key: 'bad-req' });
  const res2 = makeRes();
  let ranAgain = false;
  mw(req2, res2, () => { ranAgain = true; });
  assert.equal(ranAgain, false, '4xx responses should replay, not re-run');
  assert.equal(res2.statusCode, 400);
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test('rate-limit: allows burst up to capacity', () => {
  clearRateLimitBuckets();
  const mw = rateLimit({ capacity: 3, refillPerSec: 0, force: true });

  let passes = 0;
  let rejects = 0;
  for (let i = 0; i < 5; i++) {
    const req = makeReq({ playerId: 'burst' });
    const res = makeRes();
    mw(req, res, () => { passes++; });
    if (res.statusCode === 429) rejects++;
  }
  assert.equal(passes, 3, 'exactly capacity requests should pass');
  assert.equal(rejects, 2, 'remaining should be 429');
});

test('rate-limit: 429 includes retry-after header and error body', () => {
  clearRateLimitBuckets();
  const mw = rateLimit({ capacity: 1, refillPerSec: 0, force: true });

  mw(makeReq({ playerId: 'exhausted' }), makeRes(), () => {});

  const res = makeRes();
  mw(makeReq({ playerId: 'exhausted' }), res, () => {
    throw new Error('handler must not run when rate-limited');
  });
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['retry-after'], '1');
  assert.equal(res.body.success, false);
});

test('rate-limit: scoped per playerId — one player\'s burst does not starve another', () => {
  clearRateLimitBuckets();
  const mw = rateLimit({ capacity: 2, refillPerSec: 0, force: true });

  // Drain alice's bucket
  mw(makeReq({ playerId: 'alice' }), makeRes(), () => {});
  mw(makeReq({ playerId: 'alice' }), makeRes(), () => {});
  const aliceRejected = makeRes();
  mw(makeReq({ playerId: 'alice' }), aliceRejected, () => {});
  assert.equal(aliceRejected.statusCode, 429);

  // Bob still has a full bucket
  let bobPassed = false;
  mw(makeReq({ playerId: 'bob' }), makeRes(), () => { bobPassed = true; });
  assert.equal(bobPassed, true, 'per-player isolation must hold');
});

test('rate-limit: tokens refill over time', async () => {
  clearRateLimitBuckets();
  // 1 token capacity, 10 refill/sec → ~100ms to get a new token
  const mw = rateLimit({ capacity: 1, refillPerSec: 10, force: true });

  mw(makeReq({ playerId: 'refill' }), makeRes(), () => {});
  const rejected = makeRes();
  mw(makeReq({ playerId: 'refill' }), rejected, () => {});
  assert.equal(rejected.statusCode, 429, 'immediate retry should be rejected');

  await new Promise((r) => setTimeout(r, 150));

  let passedAfterRefill = false;
  mw(makeReq({ playerId: 'refill' }), makeRes(), () => { passedAfterRefill = true; });
  assert.equal(passedAfterRefill, true, 'after refill window, request should pass');
});

test('rate-limit: unauthenticated requests bypass the limiter', () => {
  clearRateLimitBuckets();
  const mw = rateLimit({ capacity: 1, refillPerSec: 0, force: true });

  // First call: no user, passes
  let called = 0;
  mw({ user: null, headers: {} }, makeRes(), () => { called++; });
  mw({ user: undefined, headers: {} }, makeRes(), () => { called++; });
  assert.equal(called, 2, 'anonymous requests should not be rate-limited here');
});
