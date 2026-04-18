// Idempotency-Key support for state-mutating routes.
//
// Clients (especially mobile) retry POST/PUT calls aggressively. Without
// deduplication a network hiccup can cause a "buy" to fire twice, double-
// debiting coins and inserting two loadout rows. The fix is a client-
// generated UUID in the `Idempotency-Key` header + a short-lived server
// cache keyed on (playerId, requestId) → { status, body }.
//
// First call executes the handler and stores the response. Repeats within
// the TTL replay the stored response byte-for-byte. Responses with 5xx
// status are NOT cached — transient failures should be retryable.

const cache = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 2000;

function keyFor(playerId, requestId) {
  return `${playerId}:${requestId}`;
}

function prune() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expires < now) cache.delete(k);
  }
  // Hard cap to prevent unbounded growth if prune misses
  if (cache.size > MAX_ENTRIES) {
    const overflow = cache.size - MAX_ENTRIES;
    let i = 0;
    for (const k of cache.keys()) {
      if (i++ >= overflow) break;
      cache.delete(k);
    }
  }
}

export function idempotency() {
  return function idempotencyMiddleware(req, res, next) {
    const key = req.headers['idempotency-key'];
    const playerId = req.user?.id;
    if (!key || !playerId) return next();

    prune();
    const cacheKey = keyFor(playerId, key);
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) {
      res.setHeader('x-idempotent-replay', '1');
      return res.status(hit.status).json(hit.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 500) {
        cache.set(cacheKey, {
          expires: Date.now() + TTL_MS,
          status: res.statusCode,
          body
        });
      }
      return originalJson(body);
    };
    next();
  };
}

export function clearIdempotencyCache() {
  cache.clear();
}
