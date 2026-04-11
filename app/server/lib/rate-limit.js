// Token bucket rate limiter for run-state mutation endpoints.
//
// Each player gets a bucket of CAPACITY tokens that refills at REFILL_PER_SEC.
// Bursts up to CAPACITY are allowed; sustained throughput caps at the refill
// rate. Rejected requests get HTTP 429 with a Retry-After header.
//
// Global enforcement means a malicious client can't spam `refresh-shop` or
// `buy` to grief the server. Honest clients never notice.

const DEFAULT_CAPACITY = 12;          // burst
const DEFAULT_REFILL_PER_SEC = 4;     // sustained: ~240 req/min

const buckets = new Map();

function getBucket(playerId, now, capacity, refillPerSec) {
  let bucket = buckets.get(playerId);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefill: now };
    buckets.set(playerId, bucket);
    return bucket;
  }
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.lastRefill = now;
  return bucket;
}

export function rateLimit({
  capacity = DEFAULT_CAPACITY,
  refillPerSec = DEFAULT_REFILL_PER_SEC
} = {}) {
  return function rateLimitMiddleware(req, res, next) {
    const playerId = req.user?.id;
    if (!playerId) return next();

    const bucket = getBucket(playerId, Date.now(), capacity, refillPerSec);
    if (bucket.tokens < 1) {
      res.setHeader('retry-after', '1');
      res.status(429).json({ success: false, error: 'Too many requests' });
      return;
    }
    bucket.tokens -= 1;
    next();
  };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}
