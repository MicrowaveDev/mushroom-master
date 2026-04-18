# Infra Hardening Reference

**Type:** Reference (not a plan).
**Scope:** Operational contracts for run-state mutation endpoints.

This document is the permanent home for the four cross-cutting contracts that
were deferred during the run-state refactor and later shipped as post-review
hardening. The narrative of *why* they were deferred and *when* they landed
lives in [loadout-refactor-review.md §5.1/§5.5/§5.6](./loadout-refactor-review.md)
and [post-review-followups.md](./post-review-followups.md). This file
describes *what the system does now* so future contributors do not have to
reconstruct the contracts from commit history.

All four contracts apply to the same set of mutation endpoints:

- `PUT /api/artifact-loadout` (legacy bridge into `applyRunLoadoutPlacements`)
- `POST /api/game-run/:id/buy`
- `POST /api/game-run/:id/sell`
- `POST /api/game-run/:id/refresh-shop`

Wire-up lives in [app/server/create-app.js](../app/server/create-app.js) as
`const runMutationGuards = [rateLimit(), idempotency()]`, spread into each
route ahead of the handler. `requestLogger()` is installed globally on the
app.

---

## 1. Per-run serialization (`withRunLock`)

**Contract:** every mutation that touches a game run is serialized against
all other mutations for the same `gameRunId`. Concurrent calls queue; they
do not interleave.

**Why this exists:** the transaction boundary inside each mutation guarantees
atomicity (a single call either commits or rolls back) but not serialization.
Without a lock, two concurrent `buy` calls from the same player could both
read `coins = 5`, both validate, and both debit — the second write wins but
both rows land. `withRunLock` closes that race by forcing the second call to
wait for the first to finish.

**Where:** [app/server/services/ready-manager.js](../app/server/services/ready-manager.js)
exports `withRunLock(gameRunId, fn)`. It is applied inside
[run-service.js](../app/server/services/run-service.js) around:

- `buyRunShopItem`
- `sellRunItem`
- `refreshRunShop`
- `applyRunLoadoutPlacements`

**Rule for new mutations:** any new service function that writes to
`game_run_*` tables **must** be wrapped in `withRunLock`. The rate-limit and
idempotency middleware run before the handler and cannot substitute for
serialization — they deduplicate by request key, not by resource.

**Pin:** [tests/game/run-lock.test.js](../tests/game/run-lock.test.js) asserts
that two concurrent `buy` calls produce one committed row and one rejected
call, not two partial writes.

---

## 2. Idempotency-Key

**Contract:** state-mutating routes accept an `Idempotency-Key` request
header. If the client sends the same `(playerId, key)` pair a second time
within 5 minutes, the server replays the first response byte-for-byte and
adds an `x-idempotent-replay: 1` header. The handler is **not** re-executed.

**Why this exists:** mobile clients retry POSTs aggressively on flaky
networks. Without dedup, a successful `buy` that looks failed to the client
will double-debit coins and double-insert rows.

**What gets cached:** any response with a status below 500. 5xx responses
are treated as transient and remain retryable.

**Cache bounds:**

- TTL: 5 minutes per entry
- Hard cap: 2,000 entries (oldest evicted on overflow)
- Store: in-process `Map` in [app/server/lib/idempotency.js](../app/server/lib/idempotency.js)
  — **single-instance only**. Multi-instance deployments need a shared store
  (Redis) before horizontal scaling.

**Client responsibility:** generate a fresh UUID per logical intent, not per
retry. Reusing keys across distinct intents silently returns stale
responses. If no key is provided, the middleware is a no-op and the handler
runs normally.

---

## 3. Rate limiting

**Contract:** each authenticated player has a token bucket. Every mutation
consumes one token. Empty bucket → HTTP 429 with `retry-after: 1`.

**Tuning:**

- Burst capacity: **12 tokens**
- Refill rate: **4 tokens/second** (~240 req/min sustained)
- Scope: per `req.user.id`
- Store: in-process `Map` in [app/server/lib/rate-limit.js](../app/server/lib/rate-limit.js)
  — single-instance only (same caveat as idempotency)

**Why these numbers:** honest UI interactions (drag-place, buy, sell, refresh)
never exceed the burst capacity; scripted abuse is capped at the sustained
rate. Tune from real traffic — the constants are at the top of the module.

**Ordering:** rate limiting runs **before** idempotency in `runMutationGuards`.
A rate-limited request never reaches the idempotency cache, so a client
hitting 429 and retrying with the same key will still be rate-limited.

---

## 4. Structured request logging

**Contract:** every HTTP request emits one structured JSON log line on
response finish, via the `requestLogger` middleware in
[app/server/lib/obs.js](../app/server/lib/obs.js).

**Request ID propagation:**

- Inbound `x-request-id` header is honored if present; otherwise the server
  generates `req_<12 hex chars>`.
- The id is attached to `req.requestId` for handler use and echoed back in
  the response `x-request-id` header so clients can correlate.

**Log line fields:**

| Field | Meaning |
|---|---|
| `ts` | ISO timestamp |
| `level` | `info` / `warn` / `error` |
| `kind` | `http` for request logs |
| `requestId` | propagated id |
| `method`, `route`, `status` | standard |
| `durationMs` | wall-clock, two decimals |
| `outcome` | `ok` (2xx/3xx) / `client_error` (4xx) / `server_error` (5xx) |
| `playerId` | `req.user?.id`, nullable |
| `gameRunId` | `req.params?.id`, nullable |

**Silencing:** logging is disabled when `NODE_ENV=test` or `LOG_SILENT=1` so
test output stays clean. Do not add console.log calls in the request path —
use `log.info` / `log.warn` / `log.error` from the same module so the JSON
envelope stays consistent.

**Rule for handlers:** when logging from inside a handler, always include
`requestId: req.requestId` so the entry correlates to the HTTP line. Ad-hoc
log calls without the request id are harder to trace across services.

---

## Deployment notes

The idempotency cache, rate-limit buckets, and per-run lock map are all
**process-local**. The current deployment is single-instance, so this is
safe. Before moving to multiple instances, each of the three needs a shared
store (Redis is the natural fit) or the mutation routes must be pinned to
one instance by `gameRunId` hashing.

---

## Change log

- **2026-04-11** — initial hardening pass shipped (commit `3099561` and
  follow-ups). Pulled contracts out of `loadout-refactor-review.md` §5 and
  `post-review-followups.md` into this reference after the narrative docs
  stabilized.
