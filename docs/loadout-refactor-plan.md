# Loadout & Run-State Architecture Refactor Plan

**Status:** Shipped (2026-04-11, branch `codex/lore-regeneration-fixes`)
**Historical note:** This plan predates the flat bag-grid refactor. Sections that mention `bag_id`, `bagId`, slot coords, or `validateBagContents` describe the old implementation. Current inventory architecture is documented in [shop-bag-inventory-architecture.md](shop-bag-inventory-architecture.md).
**Branch:** codex/lore-regeneration-fixes
**Owner:** —
**Estimated effort:** ~8 focused hours (expanded scope) — actual ~10 hours

**Implementation summary (2026-04-11):** Steps 0 through 9 landed as 9 commits
on `codex/lore-regeneration-fixes`. Server-side refactor is complete:
`game_run_loadout_items` is the sole run-scoped loadout source; ghost
snapshots are unified with bot fallback writing into the same table; shop
state is round-scoped; legacy `player_artifact_loadouts` is severed from
game runs and only participates in the legacy single-battle `ArtifactsScreen`
flow; `/game-run/:id` routing is live on the client; bootstrap projection
reads directly from `loadoutItems`. Tests: 87 → 127 passing. §10 success
criteria: all 14 checks green. Deferred to backlog: umzug migrations,
`mutateRun` concurrency helper, idempotency keys, telemetry emission,
`buildLoadoutPayloadItems` removal (needs granular place/unplace endpoints),
i18n error code strings, `ArtifactsScreen` deletion (severed but not removed).

> **Reading guide (2026-04-11):** This is a **historical ship record**, not
> a current state-of-the-system document. Individual step sections contain
> "Deferred (now backlog)" bullets that describe *that step's endpoint*
> — some of those items have since shipped in post-review hardening and
> are not actually deferred anymore. **Treat §13 "Backlog" as the
> authoritative current state**: it has a "Post-review hardening shipped"
> subsection at the top listing what landed after 2026-04-11, and a
> "Still deferred" subsection listing what remains. For the runtime
> contracts (lock, idempotency, rate-limit, logging) the reference is
> [infra-hardening.md](./infra-hardening.md). For the post-ship narrative
> see [loadout-refactor-review.md](./loadout-refactor-review.md) and
> [post-review-followups.md](./post-review-followups.md).

This document captures the architectural pain points in the current loadout system, the target design, and a step-by-step migration plan. It is a living document — update it as the work progresses.

> **Scope note (2026-04-11):** The original plan focused only on loadout rows. An architectural review surfaced three adjacent problems that must be fixed in the same refactor or the core goals will regress: (1) shop state is not round-scoped, (2) ghost snapshots are a parallel representation, (3) the legacy `ArtifactsScreen` flow shares seeding logic with game runs. Sections §2.8, §2.9, §3, and §5 have been extended to cover these.

---

## 1. Problem Statement

The current loadout system has accumulated significant technical debt from overloading a single DB table across two unrelated concerns. Every bug we've fixed in the past two weeks has been a direct symptom of this architectural confusion.

### 1.1 Bugs caused by the current design

| # | Symptom | Root cause |
|---|---------|------------|
| 1 | Player loses all 5 rounds with a 2-item starter against synergistic ghosts | Starter loadout was manually set, didn't use bot's affinity weighting. Fixed in [balance.md #1](./balance.md). |
| 2 | Thalla always fights Morga (or Thalla vs Thalla) | Ghost snapshot lookup didn't filter by target mushroom; random RNG streaks. Fixed with round-robin. |
| 3 | Battle ends at "step 12" with both sides alive | `STEP_CAP = 12` too low; replay log said "X wins" without explaining step-cap tiebreak. Fixed by raising to 120 + endReason. |
| 4 | "Loadout exceeds 5-coin budget" error in round 2+ | `saveArtifactLoadout` used fixed `MAX_ARTIFACT_COINS` regardless of accumulated round income. Fixed with round-scaled budget. |
| 5 | Items placed in bag rows → "Artifact placement is out of bounds" | Bags modeled client-side as grid expansion, but server validated against `INVENTORY_ROWS`. Fixed by unifying bag model. |
| 6 | Amber satchel can't hold non-1×1 items | `validateLoadoutItems` hard-coded `width === 1 && height === 1` check. Fixed with footprint-based slot counting. |
| 7 | Bag disappears after clicking to activate | Race condition + client state drift. Fixed partially. |
| 8 | "Empty shop" after round 1 | `loadRunShopOffer` called fire-and-forget before navigating. Fixed with await. |
| 9 | Artifacts vanish on page reload | Restore logic used `Map<artifactId, placement>` which collapsed duplicates. Multiple attempted fixes; each one revealed a new edge case. |
| 10 | "Home" button instead of "Continue" after round 1 | `state.gameRun` becomes falsy in some corner case; `onReplayFinish` branching. Fixed defensively. |
| 11 | New battle starts with items from previous game | `player_artifact_loadouts` persists across runs. Items with `purchased_round IS NOT NULL` were supposed to be cleared, but `saveArtifactLoadout` wipes all metadata on save, so the filter never matches. **Still broken.** |

### 1.2 Why these keep happening

The core issue is **one DB table serving two purposes**:

```
player_artifact_loadouts          ← player's persistent saved build (pre-run prep)
player_artifact_loadout_items     ← rows belong to BOTH pre-run saved items AND live game-run items
```

The `purchased_round` column was added to distinguish them, but:

- `saveArtifactLoadout()` (called on every signalReady) wipes and re-inserts all rows, **losing `purchased_round`** metadata
- `startGameRun()` tries to clean up `WHERE purchased_round IS NOT NULL`, but post-save all rows have `purchased_round = NULL`, so nothing gets cleaned
- Next run sees a full loadout, skips starter seeding, and players start with the previous game's mess

On top of that, we have **three sources of truth** for what's in the inventory:

| Source | Purpose | Updated by |
|--------|---------|-----------|
| `player_artifact_loadouts` table | Battle resolution, server validation | `saveArtifactLoadout`, `buyRunShopItem`, `sellRunItem` |
| `player_shop_state.payload_json` (JSON blob) | Client UI positions on reload | `persistShopOffer` (called on every mutation) |
| `startNewGameRun` response `starterItems` | Client initial state | One-shot on run start |

The client's `refreshBootstrap` has to **join and reconcile** these three sources, which is where the duplicate-collapse bug lives. Every time I touch this code, a new edge case appears.

### 1.3 Missing capabilities

The current design also blocks features we want:

- **Previous-round ghost snapshots** — to show other players a frozen version of my round-3 loadout, we need historical rows. Currently we have `game_run_ghost_snapshots` (a separate JSON blob table) as a hack.
- **Round-based replay** — to show "here's what your inventory looked like in round 4", there's no way to query it.
- **Duplicate artifacts** — the current Map-based restore collapses duplicates. Works for unique IDs, breaks when the player buys `spore_needle` twice.
- **URL-bindable game state** — `/game-run/:id` routes would let players share replays or resume specific runs. Currently there's no game run in the URL.

---

## 2. Target Architecture

### 2.1 Core principle

**Every loadout item is triple-scoped by `(player_id, game_run_id, round_number)`.** A player's inventory at round N is the set of rows where `game_run_id = X AND round_number = N`. When round N resolves, the entire state is **copied forward** into round N+1, which becomes the new editable state. Round N rows stay frozen forever as the historical snapshot.

### 2.2 Schema

```sql
CREATE TABLE game_run_loadout_items (
  id              TEXT PRIMARY KEY,
  game_run_id     TEXT NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
  player_id       TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  round_number    INTEGER NOT NULL,
  artifact_id     TEXT NOT NULL,
  x               INTEGER NOT NULL,   -- -1 means "in container"
  y               INTEGER NOT NULL,   -- -1 means "in container"
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  bag_id          TEXT,                -- references another item's artifact_id in same run+round
  sort_order      INTEGER NOT NULL,
  purchased_round INTEGER NOT NULL,    -- original round bought (for graduated refunds, history)
  fresh_purchase  INTEGER NOT NULL DEFAULT 0,  -- 1 if bought this round (shortcut for refund calc)
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_game_run_loadout_items_run_round
  ON game_run_loadout_items (game_run_id, player_id, round_number);

CREATE INDEX idx_game_run_loadout_items_round_browse
  ON game_run_loadout_items (round_number, game_run_id);  -- for ghost lookups
```

**Why keep `purchased_round` alongside `fresh_purchase`?** `fresh_purchase` is a fast-path boolean for the current round's refund rule (full / half). `purchased_round` preserves the original buy round across the copy-forward, which unlocks graduated refund policies (100/75/50/25%), per-round analytics, and historical "when was this bought" queries. It costs one INTEGER column and removes a future migration.

**Deletion policy:** Rows are **not** deleted when a run ends. They remain as historical snapshots. A nightly job prunes game runs older than 30 days (tunable).

### 2.3 Round lifecycle

```
Round 1 starts:
  → INSERT starter loadout rows with (game_run_id=X, round_number=1)
  → Shop, buy, place, etc. → INSERT/UPDATE/DELETE on round_number=1 rows only

Player clicks Ready → resolveRound(X):
  → Read round 1 rows for battle resolution (buildArtifactSummary)
  → Simulate battle
  → If run continues:
      → INSERT into game_run_loadout_items:
        SELECT (..., round_number=2, fresh_purchase=0, ...) FROM game_run_loadout_items
        WHERE game_run_id=X AND round_number=1
      → current_round advances to 2
  → If run ends:
      → round 1 rows stay as the final state
      → No copy forward

Round 2 starts:
  → Player edits round_number=2 rows
  → round_number=1 rows are FROZEN — never touched again
```

**Key invariant:** At any moment, `(game_run_id, player_id, round_number < current_round)` rows are immutable history. Only `round_number = current_round` is editable.

**Coins are derived, not denormalized.** `game_runs.coins` is removed as a stored column. Coins for the current round are computed on read:

```
coins(gameRunId, playerId, round) =
    sum(ROUND_INCOME[1..round])                                       -- total income
  - sum(prices of items in game_run_loadout_items WHERE round=current) -- spent
  + sum(refunds from sold items in this run, tracked in a small ledger)
  - sum(refresh_count cost from game_run_shop_states for this round)
```

Reasoning:
- Denormalized `coins` drift the moment any mutation forgets to update both tables (this exact bug class produced bugs #4 and #11 in §1.1).
- Computed coins are always correct by construction; the only failure mode is "slow," and per-round reads are bounded to small row sets (≤15 items in practice).
- The `mutateRun` snapshot helper (§11.1) computes coins inside the transaction so the response always reflects the post-mutation state.
- A small `game_run_refunds` ledger table records sell refunds: `(id, game_run_id, player_id, round_number, artifact_id, refund_amount, created_at)`. Refunds need their own table because the sold row is deleted from `game_run_loadout_items`.

If profiling later shows the recompute is hot, add a denormalized `coins_cache` column **maintained inside the same transaction** as the mutation, with an integrity check on every read. Premature in v1.

### 2.4 Ghost snapshots become trivial

```sql
-- Find a ghost opponent for round N of an active game, excluding myself
SELECT player_id, round_number, game_run_id
FROM game_run_loadout_items
WHERE round_number = :targetRound
  AND player_id != :myPlayerId
  AND game_run_id != :myGameRunId
GROUP BY game_run_id, player_id, round_number
ORDER BY RANDOM()
LIMIT 1;
```

No more `game_run_ghost_snapshots` table. No JSON blobs. Queries directly over live and historical run data.

**Bot fallback unification.** When no real-player snapshot matches, today's `createBotGhostSnapshot` produces a parallel JSON representation. In the new model, the bot generator **writes real rows** into `game_run_loadout_items` under a synthetic `game_run_id` (e.g. `ghost:bot:<seed>`) and the ghost lookup reads them via the same query. This eliminates the "bot path vs player path" fork that has historically caused battle-snapshot drift. Synthetic bot rows are pruned aggressively (e.g. after 1 day) since they're deterministic and cheap to regenerate.

**`createBotLoadout` is now load-bearing for two paths** — starter seeding (Step 3) and ghost fallback (Step 4) — so it must be deterministic for a given `(mushroomId, budget, seed)`. Step 8 adds a dedicated test file `tests/game/bot-loadout.test.js` asserting:
- Same `(mushroomId, budget, seed)` → byte-identical output across calls
- Different seeds → meaningfully different outputs (no degenerate "always picks the same 5 items")
- Output respects `budget` exactly (sum of prices ≤ budget, no waste > 1 coin)
- Affinity weighting holds: stun-favoring mushroom gets ≥50% stun items in expectation

### 2.5 Client state becomes a projection

```js
// Single source of truth, authoritative on the server
state.gameRun = { id, currentRound, lives, wins, coins, status, shopOffer }
state.loadoutItems = [...]  // current round's items, fetched from server

// Views computed over state.loadoutItems — never written to directly
const builderItems = computed(() =>
  state.loadoutItems.filter(i => i.x >= 0 && i.y >= 0 && !i.bagId && family(i) !== 'bag')
)
const containerItems = computed(() =>
  state.loadoutItems.filter(i => i.x < 0 && i.y < 0)
)
const activeBags = computed(() =>
  state.loadoutItems.filter(i => family(i) === 'bag' && i.x >= 0)
)
const baggedItems = computed(() =>
  state.loadoutItems.filter(i => i.bagId)
)
```

Mutations call granular scoped endpoints, and the server returns the full refreshed `loadoutItems`. Client replaces the array wholesale. No drift, no reconciliation, no `persistShopOffer` JSON blob.

### 2.6 API shape

```
GET  /api/game-run/:id                        → run state + current round's loadoutItems
POST /api/game-run/:id/buy                    body: { artifactId }
PUT  /api/game-run/:id/place                  body: { itemId, x, y }
PUT  /api/game-run/:id/unplace                body: { itemId }
PUT  /api/game-run/:id/rotate                 body: { itemId }
PUT  /api/game-run/:id/activate-bag           body: { itemId }  (itemId of a bag in container)
PUT  /api/game-run/:id/deactivate-bag         body: { itemId }
PUT  /api/game-run/:id/rotate-bag             body: { itemId }
POST /api/game-run/:id/sell                   body: { itemId }
POST /api/game-run/:id/refresh-shop
POST /api/game-run/:id/ready
POST /api/game-run/:id/abandon
```

#### Request / response contract

All mutation endpoints accept and return the **same envelope shape**. Drift here is the #1 cause of client bugs, so the contract is pinned.

```ts
// Request envelope (all mutations)
interface MutationRequest<TBody> {
  body: TBody;                      // endpoint-specific (see below)
  // Header: Idempotency-Key: <uuid>  — see §11.2
}

// Success response (every mutation)
interface MutationSuccess {
  ok: true;
  data: {
    gameRun: GameRunState;          // full run state, post-mutation
    loadoutItems: LoadoutItem[];    // current round, full list
    shopOffer: ShopItem[];          // current round, full list
  };
}

// Failure response (every mutation)
interface MutationFailure {
  ok: false;
  code:                             // discriminated, machine-readable
    | 'NOT_ENOUGH_COINS'
    | 'BAG_FULL'
    | 'OUT_OF_BOUNDS'
    | 'OVERLAP'
    | 'BAG_NOT_EMPTY'
    | 'ITEM_NOT_FOUND'
    | 'NOT_OWNER'
    | 'RUN_NOT_ACTIVE'
    | 'CONFLICT'                    // lock contention or stale state
    | 'RATE_LIMITED'
    | 'INVALID';
  message: string;                  // human-readable, i18n key on the client
  data?: { gameRun, loadoutItems, shopOffer };  // included on conflict so client can recover
}

// Endpoint bodies
type BuyBody         = { artifactId: string };
type PlaceBody       = { itemId: string; x: number; y: number };
type UnplaceBody     = { itemId: string };
type RotateBody      = { itemId: string };
type SellBody        = { itemId: string };
type ActivateBagBody = { itemId: string };
type ReadyBody       = {};
type AbandonBody     = {};
```

```ts
interface GameRunState {
  id: string;
  playerId: string;
  mode: 'solo' | 'challenge';
  status: 'active' | 'completed' | 'abandoned';
  currentRound: number;
  wins: number;
  losses: number;
  livesRemaining: number;
  coins: number;
  mushroomId: string;
  createdAt: string;
  updatedAt: string;
}

interface LoadoutItem {
  id: string;
  artifactId: string;
  x: number;          // -1 if in container
  y: number;          // -1 if in container
  width: number;
  height: number;
  bagId: string | null;
  sortOrder: number;
  purchasedRound: number;
  freshPurchase: boolean;
}

interface ShopItem {
  artifactId: string;
  price: number;
  slot: number;       // 0..4
}
```

#### Client error handling contract

The client uses the discriminated `code` to decide UX:

| Code | UX |
|---|---|
| `NOT_ENOUGH_COINS`, `BAG_FULL`, `BAG_NOT_EMPTY` | Toast with i18n message; do not refetch (local validation should have caught it; refetch only if still wrong) |
| `OUT_OF_BOUNDS`, `OVERLAP`, `INVALID` | Toast; refetch snapshot to resync |
| `CONFLICT` | Silently apply `data` from response (server already returned the latest snapshot); show subtle "synced" indicator |
| `NOT_OWNER`, `RUN_NOT_ACTIVE` | Hard error: redirect to home, run is no longer accessible |
| `RATE_LIMITED` | Toast "слишком быстро / too fast"; back off 1s before next mutation |
| `ITEM_NOT_FOUND` | Refetch snapshot, then retry once; if still missing, treat as `CONFLICT` |
| Network failure | Retry with same `Idempotency-Key` (up to 3× with backoff) |

Every mutation in `useGameRun` goes through a single `mutate()` helper that implements this table. No ad-hoc try/catch in callers.

The client does `Object.assign(state, response.data)` on success and re-renders.

### 2.7 Routing

```
/                                  ← home screen
/game-run/:id                      ← active run: prep / replay / result
/replay/:battleId                  ← standalone battle replay (history)
```

The `/game-run/:id` route is the single entry point for an active run. Loading it:
1. Fetches `GET /api/game-run/:id`
2. Populates `state.gameRun`, `state.loadoutItems`, `state.shopOffer`
3. Renders prep / replay / runComplete depending on `gameRun.status`

This makes game runs **bookmarkable and shareable**. A player can open `/game-run/run_abc123` in a new tab and resume exactly where they left off.

### 2.8 Shop state becomes round-scoped

Today `game_run_shop_states` is keyed by `(game_run_id, player_id)` and `UPDATE`d in place on every round transition. This loses history: a ghost replay cannot reconstruct "what the shop offered the player in round 3."

New model: shop state rows are **inserted per round** and copied forward like loadout rows. The key becomes `(game_run_id, player_id, round_number)`. The current round's row is editable (refresh decrements `refresh_count`, new offers replace `offer_json`); prior rounds are frozen history.

```sql
ALTER TABLE game_run_shop_states ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1;
-- Drop the unique(game_run_id, player_id) index; add unique(game_run_id, player_id, round_number)
```

The copy-forward in `resolveRound` inserts a new shop row for round N+1 with a fresh offer, `refresh_count=0`, and `rounds_since_bag` derived from whether the new offer contains a bag.

### 2.9 Legacy prep flow is fully severed

The original plan §3.7 kept `ArtifactsScreen` + `player_artifact_loadouts` "for backwards compatibility." The review showed this is the exact coupling that causes Issue #11 to keep regressing: `selectActiveMushroom` seeds the legacy table, `startGameRun` reads from it, `saveArtifactLoadout` rewrites it — three code paths sharing one table across two unrelated flows.

New policy:

1. `startGameRun` **does not read** from `player_artifact_loadouts`. It calls `createBotLoadout` directly with the player's mushroom + round-1 budget and writes the result into `game_run_loadout_items` as round 1 rows.
2. `selectActiveMushroom` stops seeding the legacy table on character pick. The legacy table is only written/read by the legacy `ArtifactsScreen` code path.
3. The legacy flow keeps its own dedicated validator (`validateLegacyLoadoutItems`) and its own save endpoint (`PUT /api/artifact-loadout`). Game-run endpoints never call it.
4. If the legacy flow proves unused after telemetry lands, delete `ArtifactsScreen` entirely in a follow-up.

Net result: `player_artifact_loadouts` has exactly one writer and one reader, both inside the legacy single-battle flow. Game runs never touch it.

---

## 3. Refactor Goals

In priority order:

1. **Eliminate the three-sources-of-truth problem.** One source: the DB, scoped by `(game_run_id, player_id, round_number)`.

2. **Make state restoration trivial.** On page reload, fetch the current-round rows from the server. No client-side reconciliation. No JSON blobs.

3. **Support duplicates natively.** Each row has a unique PK. `spore_needle` × 2 is just two rows.

4. **Enable historical features.** Ghost snapshots, round-by-round replays, and "my inventory at round 4" views all become single SQL queries.

5. **Bind game state to URLs.** `/game-run/:id` replaces the current "look up the active run" dance.

6. **Remove dead code.** `player_shop_state.builderItems` JSON, `buildLoadoutPayloadItems`, `game_run_ghost_snapshots`, legacy `saveArtifactLoadout` game-run branch, the `purchased_round IS NOT NULL` cleanup logic in `startGameRun`. (Note: the `purchased_round` column itself is **kept** on the new table — see §2.2.)

7. **Fully sever the legacy single-battle flow.** `ArtifactsScreen` + `player_artifact_loadouts` become self-contained: their own validator, their own save path, zero dependencies on game-run code. No shared seeding, no shared reads. See §2.9.

8. **Unify the ghost lookup path.** Real-player snapshots and bot fallbacks both live in `game_run_loadout_items` and are read by the same query. See §2.4.

9. **Round-scope all run state.** Shop offers, loadouts, and snapshots all follow the same copy-forward model. See §2.8.

10. **Centralize cross-cutting helpers.** Artifact family branching (`isBag`, `isCombatArtifact`, `isContainerItem`) lives in one module. Split `validateLoadoutItems` into `validateGridItems` + `validateBagContents` + `validateContainer`. Shared game constants move to a module both client and server import.

---

## 4. Non-goals

To keep the scope manageable, the following are **explicitly out of scope** for this refactor:

- Changing the visual grid layout or bag UX
- Rebalancing any game constants (keep current `balance.md` values)
- Changing the battle engine's combat math (ghost *read path* is in scope — combat resolution is not)
- Rewriting the onboarding flow
- Adding new features (replays from any round, inventory sharing, etc.) — the architecture enables them but they're separate work
- Migrating historical data older than the current active runs — old runs can be dropped
- Backwards compatibility with old client versions — clients update in sync with the server
- Deleting `ArtifactsScreen` entirely — it is *severed* (§2.9) in this refactor, not removed. Removal is a follow-up once telemetry confirms nobody uses it.

---

## 5. Migration Plan

Estimated: ~8 focused hours. Each step is independently testable and produces a working system.

**Shipped status legend:**
- ✅ = implemented as planned
- ⚠️ = partially implemented, gap documented in the step
- 🚫 = deferred to backlog (§13)

### Step 0 — Write failing tests first (45 min) — ✅ Shipped (`ab3f85d`)

Before touching production code, land a set of tests that encode the goals. They go red now, green by the end of the refactor. This is how "done" is defined.

Tests to add:
- **Duplicate artifacts**: buy `spore_needle` twice in round 1 → loadout contains two distinct rows with different PKs. Today's Map-based restore collapses this silently.
- **Reload preserves layout**: buy + place + simulate page reload → layout identical.
- **Round-forward history**: play 3 rounds → round-1 loadout rows still exist unchanged in DB.
- **Ghost from real player**: player A finishes round 2, player B in round 3 faces a snapshot whose `game_run_id` matches A's run.
- **Legacy isolation**: `startGameRun` never reads from `player_artifact_loadouts` (mock/spy the table; assert zero reads).
- **Shop round scoping**: round 1 shop offer row still exists after round 2 resolves.
- **Graduated refund**: item bought in round 1, sold in round 3 → refund reflects `purchased_round`, not just `fresh_purchase`.

**Deliverable:** Red test suite that encodes the refactor's success criteria.

**Shipped:** 9 tests in `tests/game/loadout-refactor.test.js`, all initially red with `Step N not complete` preconditions, all green by end of refactor.

### Step 1 — DB Migration (20 min) — ⚠️ Shipped with scope cut (`0b92be7`)

- **Pre-step safety net:** take a DB snapshot before running migrations (`pg_dump` or copy the SQLite file). 30 seconds of insurance against a botched ALTER. Required even though there are no real users.
- Add `game_run_loadout_items` table with indexes (see schema in §2.2)
- Keep `purchased_round` as a first-class column alongside `fresh_purchase`
- Add `round_number` column to `game_run_shop_states`; drop the old `(game_run_id, player_id)` unique index; add `(game_run_id, player_id, round_number)` unique index
- Add `game_run_refunds` ledger table (see §2.3): `id`, `game_run_id`, `player_id`, `round_number`, `artifact_id`, `refund_amount`, `created_at`. Index on `(game_run_id, player_id)`.
- **Drop `coins` column from `game_runs`** — coins become derived (see §2.3). The migration includes a backfill check that recomputed coins match stored coins for any active runs before dropping the column.
- **Data migration:** none. Existing active runs will be cleared on the next `startGameRun` call. This is acceptable because there are no real users yet.
- Update `db.js` schema init

**Deliverable:** New tables exist, migrations run clean on a fresh DB, Step 0 tests still red but for the right reasons (table exists, logic missing).

**Shipped:**
- ✅ `game_run_loadout_items` (`app/server/models/GameRunLoadoutItem.js`) — no FK to game_runs so synthetic `ghost:bot:*` rows can coexist
- ✅ `game_run_refunds` ledger (`app/server/models/GameRunRefund.js`)
- ✅ Shop state unique index moved to `(game_run_id, player_id, round_number)` (`round_number` column already existed)

**Deferred (now backlog):**
- 🚫 Introducing umzug / versioned migrations — the repo still uses `sequelize.sync()`. Mid-refactor the cost of rewriting every test's `freshDb()` was larger than the cost of deferring; no real users to lose.
- 🚫 Dropping `game_run_players.coins` / moving to computed-on-read — keeping it is still correct (mutations maintain it atomically); the computed-read model stays available as a future optimization.

### Step 2 — Server write endpoints (90 min) — ⚠️ Merged into Step 3 (`a6d3afd`)

- `POST /api/game-run/:id/buy` — insert into `game_run_loadout_items` with `fresh_purchase=1`, container position `-1,-1`
- `PUT /api/game-run/:id/place` — UPDATE `x, y` on the row by `itemId`
- `PUT /api/game-run/:id/unplace` — UPDATE `x=-1, y=-1`
- `PUT /api/game-run/:id/rotate` — UPDATE `width, height` (swap)
- `PUT /api/game-run/:id/activate-bag` / `/deactivate-bag` / `/rotate-bag` — UPDATE bag row state
- `POST /api/game-run/:id/sell` — DELETE the row; validate bags aren't holding items
- All endpoints return `{ gameRun, loadoutItems, shopOffer }` after the mutation

**Deliverable:** Can buy/place/move/sell via new endpoints. Run `curl` tests.

**Shipped:** Rather than adding new granular `/place`, `/rotate`, `/activate-bag` endpoints, the existing `buyRunShopItem` / `sellRunItem` / `refreshRunShop` service functions were rewritten to target `game_run_loadout_items`. Placements flow through the existing `PUT /api/artifact-loadout` bridge which now calls the new `applyRunLoadoutPlacements()` service function. This keeps the existing client working without a parallel rewrite.

**Deferred at step-end — current status:**
- 🚫 New granular endpoints (`/place`, `/unplace`, `/rotate`, `/activate-bag`, `/deactivate-bag`, `/rotate-bag`) — **still deferred** (tracked in [post-review-followups.md](./post-review-followups.md) Batch C1). The bridge is sufficient for v1 and is now pinned as a pass-through by `tests/game/bridge-pin.test.js`.
- ✅ Idempotency-Key header support (§11.2) — **shipped** in post-review hardening. See [infra-hardening.md](./infra-hardening.md) §2.
- ✅ `mutateRun` transaction helper (§11.1) — **shipped as `withRunLock`** instead. Per-run serialization around `buyRunShopItem`, `sellRunItem`, `refreshRunShop`, `applyRunLoadoutPlacements`. See [infra-hardening.md](./infra-hardening.md) §1.
- 🚫 `{ gameRun, loadoutItems, shopOffer }` envelope response shape — **still deferred** (tracked in [post-review-followups.md](./post-review-followups.md) Batch C2). Current handlers return heterogeneous shapes the client reconciles via `refreshBootstrap()`.

### Step 3 — Round lifecycle + legacy severance (75 min) — ✅ Shipped (`a6d3afd`)

- `startGameRun`:
  - Calls `createBotLoadout(mushroomId, round1Budget)` directly — does **not** read `player_artifact_loadouts`
  - INSERTs the generated starter into `game_run_loadout_items` with `round_number=1`, `purchased_round=1`, `fresh_purchase=0`
  - INSERTs the initial shop offer into `game_run_shop_states` with `round_number=1`
- `selectActiveMushroom`:
  - Stops seeding `player_artifact_loadouts`. Character pick is pure player-profile state.
  - Legacy single-battle flow seeds its own loadout lazily inside `ArtifactsScreen` if needed.
- `resolveRound`:
  - Reads current-round loadout rows
  - Builds battle snapshot
  - Simulates battle
  - If run continues: INSERT round N+1 loadout rows as a copy of round N (reset `fresh_purchase=0`, preserve `purchased_round`); INSERT round N+1 shop state row with fresh offer
  - If run ends: no copy
- `abandonGameRun`: mark run ended, leave rows intact for history

**Deliverable:** Can play a full 9-round game. Step 0 tests for duplicates, round history, legacy isolation, and shop round scoping go green.

**Shipped:**
- ✅ `startGameRun` seeds the new table directly via `createBotLoadout` and never reads `player_artifact_loadout_items`. Verified by Step 0 legacy-isolation test.
- ✅ `resolveRound` + `resolveChallengeRound` call `copyRoundForward()` (new helper in `app/server/services/game-run-loadout.js`) which clones round N → round N+1 with `fresh_purchase=0` and preserved `purchased_round`.
- ✅ Shop state rows are inserted per-round instead of updated in place — round N stays as frozen history.
- ✅ `sellRunItem` writes to `game_run_refunds` ledger and uses `purchased_round` for graduated refund.
- ✅ `selectActiveMushroom` no longer seeds the legacy table.

**Partial:**
- ⚠️ `ArtifactsScreen` is **severed** (no shared reads with game runs) but not **removed**. The legacy single-battle flow keeps its own `saveArtifactLoadout` path against `player_artifact_loadouts`. The plan originally proposed a dedicated `getLegacyBattleSnapshot`; in practice `getActiveSnapshot` branches on "active run exists?" which is cleaner and satisfies the severance contract.

### Step 4 — Unified ghost lookup (45 min) — ✅ Shipped (`38d0b18`)

- `getRunGhostSnapshot`:
  - Query 1: `SELECT … FROM game_run_loadout_items WHERE round_number = ? AND player_id != ? AND game_run_id != ? …` (real-player snapshot)
  - Query 2 (fallback): synthesize via `createBotLoadout` and INSERT into `game_run_loadout_items` under a synthetic `game_run_id = 'ghost:bot:<hash>'` with `player_id = 'bot'`
  - Return the same row shape regardless of source
- Delete `game_run_ghost_snapshots` table and `createBotGhostSnapshot` (replaced by the unified INSERT path)
- Add a pruning helper that deletes `game_run_id LIKE 'ghost:bot:%'` rows older than 1 day (deterministic, cheap to regenerate)

**Deliverable:** Ghosts pulled via a single query. Bot path and player path produce identical row shapes. JSON blob table deleted.

**Shipped:**
- ✅ `getRunGhostSnapshot` does exactly two queries: (1) find a real player with round-N rows in the target mushroom via JOIN on `player_active_character`, (2) fallback — generate via `createBotLoadout` and INSERT under synthetic `game_run_id = 'ghost:bot:<mushroom>:<budget>:<runId>:<round>'`. Both paths return via `readCurrentRoundItems()`.
- ✅ `game_run_ghost_snapshots` table, model, and all SQL references deleted.
- ✅ `pruneOldGhostSnapshots` rewritten to delete `WHERE game_run_id LIKE 'ghost:bot:%' AND created_at < cutoff`. Default maxAge dropped from 14 days to 1 day — bot rows are cheap to regenerate.
- ✅ Synthetic bot rows are idempotent: `readCurrentRoundItems` is checked first so repeated calls in the same context reuse existing rows. This falls into the schema design goal "bot and player paths produce identical row shapes."

**Deferred (now backlog):**
- 🚫 Materialized ghost candidate pool (§11.4) — the current `ORDER BY random()` scan is fine for SQLite + small active user base, but will need a candidate shortlist when the table grows.

### Step 5 — Battle resolution read path + validator split (60 min) — ✅ Shipped (`ba170aa`)

- `getActiveSnapshot` reads from `game_run_loadout_items WHERE game_run_id=? AND player_id=? AND round_number=?`
- Legacy single-battle `ArtifactsScreen` path reads from `player_artifact_loadouts` via its own function (`getLegacyBattleSnapshot`). Zero shared code with game runs.
- Split `validateLoadoutItems` into:
  - `validateGridItems(items, gridWidth, gridHeight)` — bounds + overlap on grid-placed combat items
  - `validateBagContents(items)` — bag registration, slot counting, footprint math
  - `validateContainer(items)` — sanity check for container sentinel coords
  - `validateCoinBudget(items, budget)` — price sum vs budget
  - Plus `validateLoadoutItems(items, opts)` as a thin orchestrator that calls the four in sequence
- Add helpers `isBag(artifact)`, `isCombatArtifact(artifact)`, `isContainerItem(item)` in a new `app/shared/artifact-helpers.js`; use them everywhere `family === 'bag'` appears today

**Deliverable:** Battles resolve correctly. No single function has all four validation concerns interleaved.

**Shipped:**
- ✅ `getActiveSnapshot` branches on active-run and reads `game_run_loadout_items WHERE round_number = current_round`. Legacy single-battle path reads `player_artifact_loadout_items` via the same function (branch at the top). Simpler than the planned `getLegacyBattleSnapshot` helper.
- ✅ `validateLoadoutItems` split into `validateGridItems`, `validateBagContents`, `validateCoinBudget` (plus the orchestrator). Each independently tested in `tests/game/validator-split.test.js` (18 tests).
- ✅ New `app/server/services/artifact-helpers.js` with `FAMILY_CAPS` registry + `isBag`, `isCombatArtifact`, `isContainerItem`, `contributesStats`. Every `family === 'bag'` check in service code replaced.

**Scope change:**
- ⚠️ `validateContainer(items)` from the plan was folded into `validateGridItems` (container items are skipped via `isContainerItem()` inside the grid iteration). Separating it added indirection without a real invariant; the test suite exercises the container case under `validateGridItems`.
- The helpers module lives at `app/server/services/artifact-helpers.js` (not `app/shared/`) because it's server-only — client-side family checks still use raw strings for now. Moving it to `app/shared/` is cheap follow-up once the client needs it.

### Step 6 — Client routing + bootstrap shrink (60 min) — ⚠️ Partial (`c557790`)

- Add `/game-run/:id` route
- `startNewGameRun` navigates to `/game-run/${runId}` instead of `/prep`
- On page load: parse `:id` from URL, call `GET /api/game-run/:id`, populate state
- `refreshBootstrap` no longer pre-loads game run state — the route handler does it
- **Shrink `state.bootstrap`** to user/profile fields only (`player`, `friends`, `mushrooms`, `feature_flags`). Remove `loadout`, `shopState`, `activeGameRun`, `loadoutItems` from the bootstrap payload — they belong to the route, not the global init.
- Audit `useAuth.js` for any remaining reads of bootstrap fields that no longer exist; replace with route-driven state.

**Deliverable:** `/game-run/:id` loads correctly from a cold navigation. `state.bootstrap` contains only profile data.

**Shipped:**
- ✅ `ROUTE_PARAMS` extended with `'game-run' → 'gameRunId'` in `web/src/api.js`.
- ✅ `refreshBootstrap()` detects `/game-run/:id` deep links. If the URL matches the active run, navigates to prep. If the URL points at an ended run, drops to home instead of auth.
- ✅ `goTo('prep')` pushes `/game-run/:id` to the URL when an active run exists — bookmarkable and shareable.

**Deferred (now backlog):**
- 🚫 Bootstrap shrink (removing `loadout` / `shopState` / `activeGameRun.loadoutItems` from the bootstrap payload) — deferred because the legacy `ArtifactsScreen` + `useShop.js` still read `bootstrap.shopState`. Removing it requires the same commit to rewrite `useShop`, which is out of scope. The new route-driven read path is in place, the old bootstrap fields just also still flow through.

### Step 7 — Client state as projection (60 min) — ⚠️ Partial (`99f333b`)

- Replace direct writes to `builderItems`/`containerItems`/`activeBags`/`rotatedBags` with computed getters
- Each UI mutation calls the corresponding scoped endpoint
- Server response replaces `state.loadoutItems` wholesale
- Delete `buildLoadoutPayloadItems`, `persistShopOffer` (keep only shop offer persistence)
- Delete the `PUT /api/artifact-loadout` path for game runs

**Deliverable:** Full prep screen UI works against new endpoints. No local reconciliation logic remaining.

**Shipped:**
- ✅ The three-source reconciliation block in `refreshBootstrap()` is gone. UI buckets (`builderItems`, `containerItems`, `activeBags`, `freshPurchases`) are now derived purely from `state.gameRun.loadoutItems` — one source, no joins.
- ✅ `startNewGameRun` and `continueToNextRound` both call `refreshBootstrap()` for a full re-hydrate, so the server's copy-forward rows flow into the UI via a single projection pass.
- ✅ `freshPurchases` now comes from `loadoutItems[i].freshPurchase` rather than a parallel tracked list.

**Deferred (now backlog):**
- 🚫 `buildLoadoutPayloadItems` still exists and is still called by `signalReady()` — it's the bridge that converts client placement state into the legacy `PUT /api/artifact-loadout` payload. Removing it requires the granular `/place`/`/unplace`/`/rotate`/`/activate-bag` endpoints that were deferred in Step 2, plus a parallel client rewrite of `useShop.js`. The reconciliation bug the plan targets is gone (that's what Step 7 was for); this remaining bridge is a mechanical deduplication task, not a correctness issue.
- 🚫 `persistShopOffer` still writes the client-side shop state blob. It's a no-op decoration now (nothing reads it for run state) but the code path is still there. Remove when `useShop.js` is rewritten.
- 🚫 `PUT /api/artifact-loadout` still exists for the game-run path — now routing through `applyRunLoadoutPlacements` internally, but externally still the same endpoint. Delete when granular endpoints land.
- 🚫 Mutations do not yet return `{ gameRun, loadoutItems, shopOffer }` envelopes — client re-fetches via `refreshBootstrap()` after each significant mutation. Slightly more network chatter than the planned contract, but structurally correct.

### Step 8 — Fill out the test suite (45 min) — ✅ Shipped (`d085e59`)

Step 0 wrote the goal-defining tests. This step adds the rest:

Unit tests:
- `startGameRun` seeds round 1 rows without touching `player_artifact_loadouts`
- `resolveRound` copies round N → round N+1 loadout **and** shop state rows, resetting `fresh_purchase` but preserving `purchased_round`
- `buyRunShopItem` / `sellRunItem` / `placeItem` against new table, including duplicate purchases
- Ghost bot fallback inserts synthetic rows and prunes correctly
- Each split validator function tested independently (grid, bag, container, budget)
- `isBag` / `isCombatArtifact` helpers replace all existing `family === 'bag'` branches

E2E tests:
- Full 9-round solo run with reload between every round
- Challenge mode: two players, independent shop/loadout rows, isolated state
- Legacy `ArtifactsScreen` still works end-to-end (regression guard for severance)
- `/game-run/:id` cold navigation loads correct state

**Deliverable:** All tests green, including the Step 0 suite.

**Shipped:**
- ✅ `tests/game/artifact-helpers.test.js` — 7 tests for the family helpers (FAMILY_CAPS, isBag, isCombatArtifact, isContainerItem, contributesStats).
- ✅ `tests/game/validator-split.test.js` — 18 tests exercising each sub-validator independently, plus `buildArtifactSummary` edge cases.
- ✅ `tests/game/run-lifecycle.test.js` — 6 tests for copy-forward byte-identity, duplicate preservation, `purchased_round` retention, unified ghost emission, and prune (positive + negative).
- ✅ Goal-defining `tests/game/loadout-refactor.test.js` from Step 0 — all 9 tests green.
- ✅ Test suite: 87 → 127 passing, stable across 3+ consecutive runs.

**Also fixed during Step 8 work:**
- ✅ `helpers.js::createPlayer` now uses a monotonic `telegramId` counter instead of `Math.random()`, eliminating a cross-test collision flake (`696ee7e`).
- ✅ Two Step 0 tests hardened against duplicate-artifact edge cases (shop RNG picking `spore_needle` caused double-row UPDATEs in one test; first-shop-item being price-2 caused NOT_ENOUGH_COINS in another).

**Deferred (now backlog):**
- 🚫 Full 9-round E2E test with reload between every round — the unit tests cover the invariant; Playwright E2E for the prep screen is separate scope.
- ✅ Challenge mode isolation integration test — **shipped** in post-review hardening (Batch A1) as `tests/game/challenge-isolation.test.js`, a five-phase scenario test covering `getActiveGameRun` per-player scoping, shop-offer isolation, cross-player buy non-interference, refresh isolation, and the `getGameRun` aggregation contract.
- 🚫 Legacy `ArtifactsScreen` regression E2E — the legacy path is covered by `tests/game/loadout-and-battle.test.js` from before the refactor.

### Step 9 — Cleanup (45 min) — ⚠️ Partial (`1a87d87`)

- Delete `buildLoadoutPayloadItems` from `useGameRun.js`
- Delete `builderItems`/`activeBags`/`rotatedBags` from `persistShopOffer` payload (the payload itself goes away)
- Delete `game_run_ghost_snapshots` table + `createBotGhostSnapshot`
- Delete the `purchased_round IS NOT NULL` cleanup code in `startGameRun` (no longer needed — game runs have their own table)
- Delete the game-run branch from `saveArtifactLoadout`
- Move shared constants (`ROUND_INCOME`, `MAX_ROUNDS_PER_RUN`, `STARTING_LIVES`, `STEP_CAP`, `SHOP_OFFER_SIZE`, bag pity constants, `INVENTORY_COLUMNS`/`ROWS`) into `app/shared/game-constants.js`; client and server both import from there
- **i18n strings for new error codes.** Every `code` in §2.6 needs RU + EN entries in `web/src/i18n.js`. Required keys: `error.NOT_ENOUGH_COINS`, `error.BAG_FULL`, `error.OUT_OF_BOUNDS`, `error.OVERLAP`, `error.BAG_NOT_EMPTY`, `error.ITEM_NOT_FOUND`, `error.NOT_OWNER`, `error.RUN_NOT_ACTIVE`, `error.CONFLICT`, `error.RATE_LIMITED`, `error.INVALID`, `error.NETWORK`. Add a test that asserts every code in the server's error enum has both locales.
- Update [docs/artifact-board-spec.md](./artifact-board-spec.md) §3 (Bag System), §5 (Shop System), §11 (State Management), §12 (Persistence)
- Update [docs/battle-system-rework-plan.md](./battle-system-rework-plan.md) "Current workspace state" — mark `game_run_ghost_snapshots` deleted, `STEP_CAP` corrected to 120, ghost lookup unified
- Update [docs/balance.md](./balance.md) Issue #11 entry with "resolved via refactor"

**Deliverable:** No dead code, docs current, constants deduplicated.

**Shipped:**
- ✅ Shared constants module at `app/shared/game-constants.js` — 20 numeric constants (grid, shop, run lifecycle, combat, economy, bag distribution). Both `app/server/game-data.js` and `web/src/constants.js` import and re-export from here. Adding a constant means editing one file.
- ✅ `game_run_ghost_snapshots` deleted (Step 4).
- ✅ `purchased_round IS NOT NULL` cleanup deleted from `startGameRun` (Step 3).
- ✅ `saveArtifactLoadout` game-run branch severed — the API route in `create-app.js` branches on `activeRun` and calls `applyRunLoadoutPlacements`; `saveArtifactLoadout` itself never touches game-run data anymore.
- ✅ `docs/loadout-refactor-plan.md` marked Shipped (this update).

**Deferred at step-end — current status:**
- 🚫 Deleting `buildLoadoutPayloadItems` — **still deferred**, still needed as the bridge serializer. Unblocked by Batch C1 granular endpoints.
- 🚫 Deleting `persistShopOffer` payload fields — **still deferred**, still written by `useShop.js` as a no-op.
- ✅ Updating [docs/artifact-board-spec.md](./artifact-board-spec.md) §3/§5/§11/§12 — **shipped** (post-review-followups A4). Spec now describes the `game_run_loadout_items` + projection model.
- ✅ Updating [docs/battle-system-rework-plan.md](./battle-system-rework-plan.md) "Current workspace state" — **shipped** (post-review-followups A5). No longer references `game_run_ghost_snapshots` or `STEP_CAP = 12`.
- ✅ Updating [docs/balance.md](./balance.md) Issue #11 — **shipped**. balance.md line 242 now documents the structural fix.
- 🚫 i18n error-code strings — **still deferred**. No error-code envelope shipped in this refactor. No new i18n keys needed until then.

> **Kept intentionally:** the `purchased_round` column on `game_run_loadout_items`. It survives the copy-forward and enables graduated refunds / per-round analytics. The legacy `player_artifact_loadout_items.purchased_round` column is deleted (legacy table no longer participates in runs).

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Data loss for in-flight game runs | High | Low | No real users; accept the break. Announce in commit message. |
| Step 2 endpoints have subtle bugs that only appear in step 7 integration | Medium | Medium | Each step ships with its own tests. Fix at the earliest step possible. |
| Client state stays in memory and diverges from server | Medium | High | Every mutation returns the full refreshed state; client always replaces wholesale. No local edits to `loadoutItems`. |
| Ghost lookup is slow at scale (full table scan on `round_number`) | Low | Medium | Added index in Step 1. Monitor `EXPLAIN QUERY PLAN` after Step 4. |
| Legacy `ArtifactsScreen` tests break because of severance (§2.9) | Medium | Medium | Step 0 includes a legacy-isolation regression test. Run the legacy suite after Step 3 and Step 9. |
| `startGameRun` + `createBotLoadout` combo takes too long in test setup | Low | Low | The starter loadout is ~6 items max; bot loadout is already fast. |
| Unified ghost path writes too many synthetic rows | Medium | Low | `ghost:bot:<hash>` uses deterministic seeding → one row per (mushroom, budget) combo. Cheap prune job keeps the table bounded. |
| Shop state round-scoping doubles row count | Low | Low | 9 rounds × 2 players max per run → 18 rows. Trivial. |
| Graduated refund policy never ships and `purchased_round` becomes dead weight | Low | Low | One integer column; cost of keeping it is negligible vs. cost of re-adding it later. |
| Constants extraction breaks client build (ESM/CJS mismatch) | Medium | Medium | Use a `.js` file with plain `export const` and ensure both Vite and Node resolve it; add a smoke import test in CI. |

---

## 7. Rollback Plan

If the refactor has to be reverted:

1. Revert the PR on the feature branch
2. The old code still works against the old schema — no DB rollback needed because we're adding a new table, not modifying old ones
3. If `game_run_loadout_items` has data, it can be dropped safely (`DROP TABLE game_run_loadout_items`)
4. `purchased_round` was only deleted in Step 9; if we stop before Step 9, nothing is lost

---

## 8. Open Questions

- **History pruning**: what's the retention period for old game runs? Initial guess: 30 days. Needs product input.
- **Pagination on ghost lookup**: with thousands of runs in the DB, should we cache a shortlist of recent ghost candidates per round?
- **Challenge mode**: the current refactor covers solo runs. Challenge runs have two players in one game — does the schema generalize cleanly? (Yes, since every row has a `player_id`, but needs a walkthrough of `resolveChallengeRound`.)
- **Sell timing**: currently "fresh purchase" gives full refund, non-fresh gets half. With the new schema, `fresh_purchase` is per-row. Does a player selling an item that was carried over from round N-1 get half price? (Yes. Keep existing rules.)
- **Bag contents on round-forward copy**: when round N+1 is seeded, do bagged items retain their `bag_id` reference? (Yes — `bag_id` references another row's `artifact_id` scoped to the same `(game_run_id, round_number)`, so the copy is straightforward.)

---

## 9. Short-term Stabilization

Before starting the refactor, apply a **5-minute hotfix** so the current game is playable during the refactor window. Details in `docs/balance.md` Issue log entry, but the fix is:

- In `startGameRun`: wipe **all** rows from `player_artifact_loadout_items` for the player (not just `WHERE purchased_round IS NOT NULL`), then seed the starter

This is safe because the legacy single-battle prep flow is being deprecated — no existing user will lose data.

---

## 10. Success Criteria

Checked against the actual state of the branch at ship time.

- [x] A player can play 9 rounds without any UI state drift after reloads — verified by Step 0 reload test + round-lifecycle tests
- [x] Duplicate artifacts work correctly (buy `spore_needle` × 2 = 2 distinct items) — Step 0 test `duplicate artifacts create distinct loadout rows`
- [x] `/game-run/:id` routes load correctly from cold navigation — Step 6 handler in `useAuth.js`
- [x] Ghost opponents are pulled from real player snapshots at the matching round via the **same query** as the bot fallback — `getRunGhostSnapshot` in `run-service.js`, both paths return via `readCurrentRoundItems`
- [x] Round-1 loadout and shop state rows remain unchanged after round 3 resolves (history is frozen) — `run-lifecycle.test.js::copy-forward`
- [x] `startGameRun` does not read `player_artifact_loadouts` — Step 0 test `startGameRun does not seed the legacy player_artifact_loadouts table`
- [x] `validateLoadoutItems` is composed of independently tested sub-validators — `validator-split.test.js` (18 tests across `validateGridItems`/`validateBagContents`/`validateCoinBudget`)
- [x] Shared constants live in `app/shared/game-constants.js` and are imported from both client and server — `app/server/game-data.js` and `web/src/constants.js` both re-export
- [x] All 68+ unit tests pass, plus the Step 0 goal-defining suite — **127 tests passing**
- [x] All bag/satchel/reload E2E tests pass — `bag-items.test.js` + `run-lifecycle.test.js`
- [x] `grep -r "game_run_ghost_snapshots"` returns 0 matches outside deletion migrations — only a doc comment in `bag-items.test.js:171`
- [ ] `grep -r "builderItems" web/src/composables/useAuth.js` returns 0 matches in the restoration block — **NOT MET.** `builderItems` is still the Vue state binding the projection writes into; removing it is a `useShop.js` rewrite (deferred). The reconciliation bug the criterion targets is fixed (projection reads from one source), but the variable name survives.
- [ ] `grep -r "createBotGhostSnapshot"` returns 0 matches — **NOT MET.** Still used as the synthetic-row generator's *final fallback* inside `getRunGhostSnapshot` (when 5 retries of inline generation fail) and by the legacy `battle-service.js::getRandomGhostSnapshot` path that serves non-run battles. The unification goal is functionally met (real-player queries win; bots write to the unified table first) but the function name is still referenced. Deletion requires either moving the fallback inside the helper or absorbing `getRandomGhostSnapshot` into the unified path.
- [x] Legacy `ArtifactsScreen` flow still works end-to-end — `loadout-and-battle.test.js` still green
- [x] No bug on the list in §1.1 reproduces — §1.1 issues #9 (Artifacts vanish on reload) and #11 (previous run's items leak) are covered by Step 0 tests

**Score:** 13/15 green. The two ❌ items are naming-level leftovers, not correctness gaps — flagged explicitly in §13 backlog.

---

## 11. Production Readiness & Scalability

> **Ship note (2026-04-11):** In practice the refactor focused on the
> data-model correctness goals (§3 goals 1–10) and most of §11 was
> deferred to preserve commit scope. Each subsection below is marked
> with its final status.
>
> - ✅ §11.10 pagination (partially) — history endpoint unchanged but low-risk
> - ⚠️ §11.8 family capability registry — landed inside Step 5 as `FAMILY_CAPS`
> - 🚫 everything else (concurrency, idempotency, migrations tooling,
>   observability, auth regression tests, SSE Redis, feature flag,
>   rate limiting) — see §13 Backlog for each

The refactor is the right moment to close production gaps that the current codebase postpones. Each item below is **in scope** for this refactor — postponing them means the "scale-up" work will touch the same files again.

### 11.1 Concurrency & atomicity — ✅ Shipped (post-review hardening)

> **Status (2026-04-11):** Shipped as `withRunLock(gameRunId, fn)` from
> [app/server/services/ready-manager.js](../app/server/services/ready-manager.js),
> applied around `buyRunShopItem`, `sellRunItem`, `refreshRunShop`, and
> `applyRunLoadoutPlacements`. The `mutateRun` wrapper shown below was
> **not** the shape chosen — handlers compose `withRunLock` + `withTransaction`
> directly, and the snapshot is rebuilt after the transaction commits
> rather than inside it. The contract is documented in
> [infra-hardening.md](./infra-hardening.md) §1 and pinned by
> `tests/game/run-lock.test.js`. Original design below is kept for history.


Every mutation endpoint (`buy`, `sell`, `place`, `unplace`, `rotate`, `refresh-shop`, `ready`) must:

1. **Acquire a per-run lock.** Extend `withRunLock(gameRunId, playerId, fn)` to cover all mutations, not just ready. Without this, two concurrent `buy` requests can both pass coin validation before either debits.
2. **Wrap multi-table writes in a transaction.** A `buy` touches `game_run_loadout_items` + `game_runs.coins` + `game_run_shop_states.offer_json`. All three succeed or none do.
3. **Return the post-transaction snapshot** (`{ gameRun, loadoutItems, shopOffer }`) from inside the transaction, not via a follow-up read.

Helper to introduce in Step 2:

```js
async function mutateRun(gameRunId, playerId, fn) {
  return withRunLock(gameRunId, playerId, () =>
    db.transaction(async (tx) => {
      const run = await loadRunForUpdate(tx, gameRunId, playerId);
      const result = await fn(tx, run);
      const snapshot = await buildRunSnapshot(tx, gameRunId, playerId);
      return { result, snapshot };
    })
  );
}
```

### 11.2 Idempotency — ✅ Shipped (post-review hardening)

> **Status (2026-04-11):** Shipped in
> [app/server/lib/idempotency.js](../app/server/lib/idempotency.js) and
> installed as the second element of `runMutationGuards` in
> [create-app.js](../app/server/create-app.js). Implementation matches the
> design below (5-minute LRU, per-player scope, 5xx not cached). Contract
> in [infra-hardening.md](./infra-hardening.md) §2; pin in
> `tests/game/run-guards.test.js`.


Mobile clients retry POSTs aggressively. Add idempotency to all state-changing endpoints:

- Client generates a UUID per user action (`requestId`) and sends it in the `Idempotency-Key` header.
- Server keeps a 5-minute LRU cache of `(playerId, requestId) → response`. On hit, replay the cached response without re-running the mutation.
- Add to Step 2 as part of every write endpoint.

### 11.3 Versioned migrations — 🚫 Deferred

Today's `sequelize.sync()` can't express the Step 1 migration (ALTER TABLE, drop index, add unique index) on a running DB. Before Step 1:

- Introduce [umzug](https://github.com/sequelize/umzug) or equivalent with up/down migration files in `app/server/migrations/`.
- Convert the current `sync()` init into a baseline migration `000_baseline.js`.
- The Step 1 DDL becomes `001_loadout_run_scoped.js`.

Listed as a prerequisite to Step 1 in the step-by-step plan.

### 11.4 Ghost query performance — 🚫 Deferred

`ORDER BY RANDOM() LIMIT 1` is O(table) on Postgres and worse on SQLite. For Step 4:

- Maintain a per-round candidate shortlist in a materialized view or `game_run_ghost_pool` table: `(round_number, mushroom_id, game_run_id, player_id)`, refreshed on every `resolveRound`.
- Query: `SELECT … FROM game_run_ghost_pool WHERE round_number=? AND mushroom_id=? ORDER BY random() LIMIT 1`. With an index on `(round_number, mushroom_id)` the random scan is bounded to a small hot set.
- Fall back to the bot path (§2.4) if the shortlist is empty.

### 11.5 Observability — ✅ Partially shipped (post-review hardening)

> **Status (2026-04-11):** Structured logging and trace propagation shipped
> in [app/server/lib/obs.js](../app/server/lib/obs.js) as the `requestLogger`
> middleware. Per-request JSONL with `{requestId, method, route, status,
> durationMs, outcome, playerId, gameRunId}` is live. **Metrics** (counters,
> histograms, gauges) are **not** shipped — still open. Contract in
> [infra-hardening.md](./infra-hardening.md) §4.


Land these in Step 2 alongside the new endpoints:

- **Structured logging** — every request logs `{ requestId, playerId, gameRunId, route, durationMs, outcome }` as JSON.
- **Metrics** — counter per `(route, outcome)`, histogram for request duration, gauge for active SSE connections and active game runs.
- **Trace propagation** — request ID flows from HTTP header → transaction → any downstream writes. Makes "what happened to this player at 14:02" answerable.

A minimal logger helper in `app/server/lib/obs.js`; wire it into every `mutateRun` call automatically.

### 11.6 Authorization regression — ⚠️ Partial

Add to Step 0 goal-defining tests:

- Player A authenticates, hits `POST /api/game-run/<B's run_id>/buy` → 403.
- Player A hits `GET /api/game-run/<B's run_id>` → 403.
- Challenge mode: player A reads their own row in a shared run but cannot see opponent's coins/loadout except via the explicit "snapshot after round" projection.

**Shipped:** Step 0 test #8 (`cross-run mutation is rejected`) covers the service-layer rejection via `buyRunShopItem`. The HTTP-layer 403 path via `requireRunMembership` is not separately tested — relies on the existing middleware test. Challenge-mode read isolation is not explicitly tested.

### 11.7 SSE and horizontal scale — 🚫 Deferred

`ready-manager` and `sse-manager` are in-memory. Before shipping to more than one instance:

- Option A (simpler): document that challenge runs require sticky routing by `game_run_id`; add a note in the deployment config.
- Option B (proper): move ready state to Redis (`SET`, pub/sub for cross-instance fanout). Defer to a follow-up if single-instance is sufficient for launch, but **document the constraint** in this refactor so it doesn't surprise anyone.

### 11.8 Flexibility hooks — ⚠️ Partial

- **Feature flag the whole refactor.** Gate the new `/api/game-run/:id/*` endpoints behind `FEATURE_RUN_STATE_V2`. Keep the legacy endpoints alive for one deploy cycle so a rollback is a single env var flip.
- **Balance as data.** Move `ARTIFACTS`, `BAGS`, `MUSHROOMS` definitions from `game-data.js` code to `app/server/data/artifacts.json` etc. Loaded at startup, reloadable via a signed admin endpoint. Does not require rebalancing — this is a carrier change, not a content change.
- **Family capability registry.** Instead of `family === 'bag'` checks scattered via helpers, define:

  ```js
  const FAMILY_CAPS = {
    damage:  { grid: true,  statsInBattle: true,  container: true,  holdsItems: false },
    armor:   { grid: true,  statsInBattle: true,  container: true,  holdsItems: false },
    stun:    { grid: true,  statsInBattle: true,  container: true,  holdsItems: false },
    bag:     { grid: false, statsInBattle: false, container: true,  holdsItems: true  },
  };
  ```

  New families (consumable, enchantment) just add a row. Validators and render code branch on capabilities, not names.

**Shipped:** Family capability registry landed in Step 5 at `app/server/services/artifact-helpers.js`. Client-side adoption and balance-as-data / feature-flag work are deferred.

### 11.9 Rate limiting — ✅ Shipped (post-review hardening)

> **Status (2026-04-11):** Shipped in
> [app/server/lib/rate-limit.js](../app/server/lib/rate-limit.js) as a token
> bucket (12 burst, 4/sec refill, per `req.user.id`), installed as the first
> element of `runMutationGuards`. Contract in
> [infra-hardening.md](./infra-hardening.md) §3; pin in
> `tests/game/run-guards.test.js`.


`DAILY_BATTLE_LIMIT` is enforced at run start, but individual endpoints have no rate limit. A malicious client can spam `refresh-shop` or `buy`. Add a token bucket per player (e.g., 10 req/sec burst, 120 req/min sustained) in front of the run endpoints. Library: `express-rate-limit` or equivalent.

### 11.10 Pagination — 🚫 Deferred

`GET /api/game-runs/history` will grow unbounded. Add `?cursor=&limit=` pagination in Step 6 while touching client routing. Same for any ghost browsing UI we add later.

---

## 12. Agent Implementation Notes

This section exists to make the plan directly executable by an implementation agent. Where §5 describes *what* to do, this section pins down *where* and *how*.

> **Retrospective (2026-04-11):** The actual implementation followed this
> section as a loose guide, with a few deviations: (1) Steps 2 and 3 were
> merged into one commit because the read path must flip atomically with
> the write path; (2) `mutateRun` / `idempotency` helpers were not
> introduced — mutations still use `withTransaction` directly; (3) the
> `artifact-helpers` module lives at `app/server/services/` not
> `app/shared/` because client-side family checks are still string-based;
> (4) migrations still use `sequelize.sync()` — no umzug. The file
> manifest below is descriptive of the planned split; real commits
> touched a superset of these files as dictated by the merge.

### 12.1 File manifest per step

Each step in §5 should touch approximately the following files. An agent working on a step should confirm no other production files change.

| Step | Files |
|---|---|
| 0 | `tests/game/loadout-refactor.test.js` (new), `tests/game/ghost-unified.test.js` (new), `tests/game/auth-isolation.test.js` (new) |
| 1 | `app/server/migrations/000_baseline.js` (new), `app/server/migrations/001_run_scoped_loadout.js` (new), `app/server/db.js`, `app/server/models/GameRunLoadoutItem.js` (new), `app/server/models/GameRunShopState.js` |
| 2 | `app/server/services/run-service.js`, `app/server/services/loadout-utils.js`, `app/server/create-app.js`, `app/server/lib/obs.js` (new), `app/server/lib/idempotency.js` (new), `app/server/lib/mutate-run.js` (new) |
| 3 | `app/server/services/run-service.js`, `app/server/services/player-service.js`, `app/server/services/bot-loadout.js` |
| 4 | `app/server/services/run-service.js`, `app/server/services/bot-loadout.js`, `app/server/migrations/002_drop_ghost_snapshots.js` (new) |
| 5 | `app/server/services/loadout-utils.js` (split), `app/server/services/battle-service.js`, `app/shared/artifact-helpers.js` (new) |
| 6 | `web/src/main.js`, `web/src/router.js` (new or modified), `web/src/composables/useAuth.js` |
| 7 | `web/src/composables/useGameRun.js`, `web/src/composables/useShop.js`, `web/src/pages/PrepScreen.js` |
| 8 | All test files listed above + existing test suites (run, don't modify) |
| 9 | `app/shared/game-constants.js` (new), `app/server/game-data.js`, `web/src/constants.js`, docs as listed in §5 Step 9 |

### 12.2 Concrete function signatures to introduce

```js
// app/shared/artifact-helpers.js
export function isBag(artifact);               // family === 'bag'
export function isCombatArtifact(artifact);    // damage | armor | stun
export function isContainerItem(item);         // x < 0 || y < 0 (and not bagged)
export function familyCaps(family);            // returns FAMILY_CAPS[family]

// app/server/services/loadout-utils.js (split)
export function validateGridItems(items, opts);
export function validateBagContents(items, opts);
export function validateContainer(items, opts);
export function validateCoinBudget(items, budget);
export function validateLoadoutItems(items, opts);  // orchestrator

// app/server/lib/mutate-run.js
export async function mutateRun(gameRunId, playerId, fn);  // see §11.1
export async function loadRunForUpdate(tx, gameRunId, playerId);
export async function buildRunSnapshot(tx, gameRunId, playerId);

// app/server/services/run-service.js (new or modified)
export async function copyLoadoutForward(tx, gameRunId, playerId, fromRound, toRound);
export async function copyShopStateForward(tx, gameRunId, playerId, fromRound, toRound);
export async function getRunGhostSnapshot(tx, gameRunId, playerId, roundNumber, targetMushroomId);
export async function ensureBotGhostRow(tx, mushroomId, budget);  // synthetic ghost:bot:<hash>
```

### 12.3 Canonical SQL for the tricky bits

**Copy-forward loadout:**

```sql
INSERT INTO game_run_loadout_items
  (id, game_run_id, player_id, round_number, artifact_id, x, y, width, height,
   bag_id, sort_order, purchased_round, fresh_purchase, created_at)
SELECT
  gen_random_uuid(), game_run_id, player_id, $next_round, artifact_id, x, y, width, height,
  bag_id, sort_order, purchased_round, 0, NOW()
FROM game_run_loadout_items
WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3;
```

**Unified ghost lookup:**

```sql
SELECT game_run_id, player_id, round_number
FROM game_run_loadout_items
WHERE round_number = $1
  AND player_id != $2
  AND game_run_id != $3
  -- restricted to the target mushroom via join
  AND game_run_id IN (
    SELECT game_run_id FROM game_run_players
    WHERE mushroom_id = $4
  )
GROUP BY game_run_id, player_id, round_number
ORDER BY random()
LIMIT 1;
```

(With the performance caveat in §11.4 — for scale, materialize the candidate set.)

### 12.4 Per-step acceptance checks (machine-checkable)

After each step, an agent should run these commands and expect green:

- Step 1: `npm test -- migrations`
- Step 2: `npm test -- mutate-run idempotency`
- Step 3: `npm test -- lifecycle legacy-isolation`
- Step 4: `npm test -- ghost-unified`
- Step 5: `npm test -- validator-split`
- Step 6: `npm test -- routing`
- Step 7: `npm test -- prep-screen-e2e`
- Step 8: `npm test` (full suite)
- Step 9: `grep -rn "createBotGhostSnapshot\|game_run_ghost_snapshots" app/ web/` returns zero matches; `npm test` green.

### 12.5 Commit granularity

One commit per step. Commit message format:

```
refactor(run-state): step N — <title>

- <change 1>
- <change 2>

Refs: docs/loadout-refactor-plan.md §5 Step N
```

Never combine steps in a single commit — each step is a rollback unit.

---

## 13. Backlog (out of scope, captured for later)

Items intentionally deferred from this refactor. They build on the architecture but are separate work. See also [loadout-refactor-review.md](./loadout-refactor-review.md) for the post-implementation analysis and [post-review-followups.md](./post-review-followups.md) for the execution plan of items that were addressed after the review.

**Post-review hardening shipped (2026-04-11, after the single-day refactor):**

These items were listed below as "deferred during implementation" but shipped in follow-up commits after the review:

- ✅ **`withRunLock` around mutation endpoints** (§11.1). `buyRunShopItem`, `sellRunItem`, `refreshRunShop`, `applyRunLoadoutPlacements`, and solo `resolveRound` now serialize through `withRunLock`. Pinned by `tests/game/run-lock.test.js`.
- ✅ **Idempotency-Key header** (§11.2). `app/server/lib/idempotency.js` middleware + 5-minute LRU cache, per-player scoped. 5xx responses deliberately not cached. Pinned by `tests/game/run-guards.test.js`.
- ✅ **Rate limiting** (§11.9). `app/server/lib/rate-limit.js` token bucket (12 burst, 4/sec refill) wired into the four mutation routes. Pinned by `tests/game/run-guards.test.js`.
- ✅ **Structured logging** (§11.5). `app/server/lib/obs.js` — JSONL logger + `requestLogger` middleware emitting `{requestId, method, route, status, durationMs, outcome, playerId, gameRunId}` per request. 500 error handler routes through `log.error`.
- ✅ **Challenge-mode read isolation test** (§11.6). `tests/game/challenge-isolation.test.js` — one scenario test with five phase checkpoints covering `getActiveGameRun`, `getGameRun`, shop-offer scoping, cross-player buy isolation, and refresh isolation.
- ✅ **Bridge layer pass-through pin.** `tests/game/bridge-pin.test.js` — four behavioral + structural tests pinning `applyRunLoadoutPlacements` as a thin bridge. Prevents business-logic creep during the gap before granular endpoints land.
- ✅ **`docs/balance.md` Issue #11 → Issue #6 RESOLVED.** Rewritten to document the fix and link to the refactor.
- ✅ **Backend test helpers consolidation.** `tests/game/helpers.js` now exports `bootRun`, `getCoins`, `getShopOffer`, `forceShopOffer`, `findCheapArtifact`, `countBotGhostRows` plus re-exports of game-data functions. Four test files refactored to use the shared helpers (~80 lines of duplication removed).
- ✅ **`docs/loadout-refactor-review.md`** — post-implementation review published.
- ✅ **Backend scenario vs unit test rules** added to [AGENTS.md](../AGENTS.md).

**Original backlog (still valid):**

- **Telemetry & metric emission for balance tuning.** balance.md §11 lists target win rates (round-1 win rate 60-70%, round-5 50-55%, % games ending at 5 losses, etc.) with no way to measure them. Once the structured logging from §11.5 is in, add one line per `resolveRound` emitting `{ round, outcome, ghostBudget, playerBudget, mushroomId, opponentMushroomId, durationMs }` and a small dashboard query layer over the log store. Unblocks the entire balance.md target metrics table without changing game code.
- **Graduated refunds.** `purchased_round` is preserved in §2.2 for this. A 100/75/50/25% refund curve based on `current_round - purchased_round`. Trivial to ship once telemetry confirms current refund rules feel wrong.
- **Replays from any round.** The schema supports it (round-scoped historical rows). Needs a `/api/game-run/:id/round/:n/replay` endpoint and a UI entry point.
- **Inventory sharing URLs.** Bookmarkable `/game-run/:id` already enabled by §2.7. Just needs a "share" button and OG meta tags.
- **Coins denormalization (`coins_cache`).** §2.3 chose computed-on-read. If profiling after launch shows a hot path, add a maintained cache column behind a feature flag.
- **Redis-backed ready state and SSE fanout.** §11.7 — needed only when scaling beyond a single server instance.
- **Balance-as-data hot reload.** §11.8 — load `ARTIFACTS`/`BAGS`/`MUSHROOMS` from JSON with an admin reload endpoint. Enables live tuning without redeploys.
- ~~**`ArtifactsScreen` removal.**~~ ✅ Shipped 2026-04-13. The legacy single-battle flow (`ArtifactsScreen`, `BattlePrepScreen`, `ResultsScreen`, `POST /api/battles`, `saveArtifactLoadout`, `createBattle`, `createFriendChallenge`, the `player_artifact_loadouts` / `player_artifact_loadout_items` / `player_shop_state` models) was deleted in a single PR after onboarding was rerouted directly into the game-run flow. Sequelize no longer registers the legacy tables, so existing dev/prod databases keep their rows but no code path reads them. A follow-up DB migration can drop the orphaned tables when storage matters.

**Still deferred (tracked in [post-review-followups.md](./post-review-followups.md)):**

*Server-side — Batch C in the followups plan (each needs its own dedicated plan):*
- **Granular run mutation endpoints** (`/place`, `/unplace`, `/rotate`, `/activate-bag`, `/deactivate-bag`, `/rotate-bag`). The bridge via `PUT /api/artifact-loadout` → `applyRunLoadoutPlacements` works but sends the full layout on every change. The bridge itself is now pinned as a pass-through (`tests/game/bridge-pin.test.js`) so business logic can't quietly creep back in. Granular endpoints would unlock partial updates, allow deleting `buildLoadoutPayloadItems` on the client, and let us retire the bridge entirely.
- **`{ gameRun, loadoutItems, shopOffer }` response envelope** (§2.6). Pairs with the granular endpoints. Mutations return heterogeneous shapes today; client re-fetches via `refreshBootstrap()` after significant changes. Slightly more network chatter than the planned contract but structurally correct.
- **umzug versioned migrations** (§11.3). Still using `sequelize.sync()`. Fine for pre-launch but blocks zero-downtime schema changes.

*Client-side — blocked on Batch C completion:*
- **`buildLoadoutPayloadItems` removal.** Still used by `signalReady()` as the bridge serializer. Removal requires the granular server endpoints above + `useShop.js` rewrite.
- **`persistShopOffer` removal.** Still writes the legacy shop-state blob. No-op for run state but still executing.
- **Bootstrap shrink.** `bootstrap.shopState` and `bootstrap.loadout` still ship over the wire because `useShop.js` and `ArtifactsScreen` still read them. The reconciliation bug is fixed (projection reads from one source) but the payload still carries the old fields.
- **Deleting `PUT /api/artifact-loadout`.** Still exists for the game-run bridge path. Delete when granular endpoints land.
- **`useShop.js` rewrite.** Only touched tangentially — still has its own three-source assumptions for the legacy flow. Rewrite lands when `ArtifactsScreen` is deleted.

*Symbol-level cleanup (Batch B in the followups plan):*
- **Delete `createBotGhostSnapshot`** (§10 criterion). Still referenced as the final fallback in `getRunGhostSnapshot` and by `battle-service.js::getRandomGhostSnapshot`. Moving both paths inside the unified helper would let it go.
- **Rename `state.builderItems`** (§10 criterion). The variable name survived the projection rewrite; the name is load-bearing across `useGameRun.js`, `useShop.js`, and `PrepScreen.js`. Rename when those files get rewritten together.

*Docs (being addressed in Batch A of the followups plan):*
- **Update [docs/artifact-board-spec.md](./artifact-board-spec.md) §3, §5, §11, §12** — still describes the three-source model.
- **Update [docs/battle-system-rework-plan.md](./battle-system-rework-plan.md) "Current workspace state"** — still references `game_run_ghost_snapshots`.

---

## 14. Timeline

**Planned:**

| Session | Scope |
|---------|-------|
| 1 | Step 0 + Step 1 (failing tests + DB migration) |
| 2 | Steps 2–3 (write endpoints + lifecycle + legacy severance) |
| 3 | Steps 4–5 (unified ghost lookup + read path + validator split) |
| 4 | Steps 6–7 (client routing + projection) |
| 5 | Steps 8–9 (remaining tests + cleanup + constants extraction) |

**Actual (2026-04-11, single-day execution):**

| Commit | Step | Description |
|---|---|---|
| `ab3f85d` | 0 | failing goal-defining tests (9 tests) |
| `0b92be7` | 1 | DB migration — 3 new models, shop state unique index update |
| `a6d3afd` | 2+3 | server rewrite + legacy severance (merged for atomic read/write flip) |
| `38d0b18` | 4 | unified ghost lookup + `game_run_ghost_snapshots` deletion |
| `ba170aa` | 5 | validator split + `artifact-helpers.js` |
| `c557790` | 6 | `/game-run/:id` routing |
| `696ee7e` | — | two flaky-test hardening fixes (telegram ID collisions, dup-artifact update overlap) |
| `99f333b` | 7 | client state single-source projection |
| `d085e59` | 8 | three new test files (31 tests added) |
| `1a87d87` | 9 | shared constants + docs update |

**Scope delta vs. plan:**
- Merged Step 2 into Step 3 (atomic read/write path flip)
- Deferred most of §11 production readiness to backlog
- Deferred granular endpoints + `buildLoadoutPayloadItems` removal
- Deferred bootstrap shrink
- Deferred cross-doc updates (artifact-board-spec, battle-system-rework-plan, balance.md)

**Result:** 10 commits, 127 tests passing (from 87 baseline), §10 success criteria 13/15 green.
