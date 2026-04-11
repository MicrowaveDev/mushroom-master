# Loadout Architecture Refactor Plan

**Status:** Planning
**Branch:** TBD
**Owner:** TBD
**Estimated effort:** ~6 focused hours

This document captures the architectural pain points in the current loadout system, the target design, and a step-by-step migration plan. It is a living document — update it as the work progresses.

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
  fresh_purchase  INTEGER NOT NULL DEFAULT 0,  -- 1 if bought this round (for refund calc)
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_game_run_loadout_items_run_round
  ON game_run_loadout_items (game_run_id, player_id, round_number);

CREATE INDEX idx_game_run_loadout_items_round_browse
  ON game_run_loadout_items (round_number, game_run_id);  -- for ghost lookups
```

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

Every mutation endpoint returns the same payload shape:

```json
{
  "success": true,
  "data": {
    "gameRun": { "id": "...", "currentRound": 2, "coins": 14, ... },
    "loadoutItems": [ ... ],
    "shopOffer": [ ... ]
  }
}
```

The client does `Object.assign(state, response.data)` and re-renders.

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

---

## 3. Refactor Goals

In priority order:

1. **Eliminate the three-sources-of-truth problem.** One source: the DB, scoped by `(game_run_id, player_id, round_number)`.

2. **Make state restoration trivial.** On page reload, fetch the current-round rows from the server. No client-side reconciliation. No JSON blobs.

3. **Support duplicates natively.** Each row has a unique PK. `spore_needle` × 2 is just two rows.

4. **Enable historical features.** Ghost snapshots, round-by-round replays, and "my inventory at round 4" views all become single SQL queries.

5. **Bind game state to URLs.** `/game-run/:id` replaces the current "look up the active run" dance.

6. **Remove dead code.** `purchased_round`, `player_shop_state.builderItems` JSON, `buildLoadoutPayloadItems`, `game_run_ghost_snapshots`, legacy `saveArtifactLoadout` game-run branch.

7. **Keep the legacy single-battle flow working.** `ArtifactsScreen` + `player_artifact_loadouts` are untouched for backwards compatibility with existing tests and the "build before entering a run" experience.

---

## 4. Non-goals

To keep the scope manageable, the following are **explicitly out of scope** for this refactor:

- Changing the visual grid layout or bag UX
- Rebalancing any game constants (keep current `balance.md` values)
- Changing the battle engine
- Rewriting the onboarding flow
- Adding new features (replays from any round, inventory sharing, etc.) — the architecture enables them but they're separate work
- Migrating historical data older than the current active runs — old runs can be dropped
- Backwards compatibility with old client versions — clients update in sync with the server

---

## 5. Migration Plan

Estimated: ~6 focused hours. Each step is independently testable and produces a working system.

### Step 1 — DB Migration (15 min)

- Add `game_run_loadout_items` table with indexes (see schema above)
- Add a `fresh_purchase` flag (replaces freshPurchases tracking)
- **Data migration:** none. Existing active runs will be cleared on the next `startGameRun` call. This is acceptable because there are no real users yet.
- Update `db.js` schema init

**Deliverable:** New table exists, migrations run clean on a fresh DB.

### Step 2 — Server write endpoints (90 min)

- `POST /api/game-run/:id/buy` — insert into `game_run_loadout_items` with `fresh_purchase=1`, container position `-1,-1`
- `PUT /api/game-run/:id/place` — UPDATE `x, y` on the row by `itemId`
- `PUT /api/game-run/:id/unplace` — UPDATE `x=-1, y=-1`
- `PUT /api/game-run/:id/rotate` — UPDATE `width, height` (swap)
- `PUT /api/game-run/:id/activate-bag` / `/deactivate-bag` / `/rotate-bag` — UPDATE bag row state
- `POST /api/game-run/:id/sell` — DELETE the row; validate bags aren't holding items
- All endpoints return `{ gameRun, loadoutItems, shopOffer }` after the mutation

**Deliverable:** Can buy/place/move/sell via new endpoints. Run `curl` tests.

### Step 3 — Round lifecycle (60 min)

- `startGameRun`:
  - INSERT starter loadout into `game_run_loadout_items` with `round_number=1`
  - No longer touches `player_artifact_loadouts`
- `resolveRound`:
  - Read current-round rows
  - Build battle snapshot from them
  - Simulate battle
  - If run continues: INSERT round N+1 rows as a copy of round N (minus `fresh_purchase` flag)
  - If run ends: no copy
- `abandonGameRun`: mark run ended, leave rows intact for history

**Deliverable:** Can play a full 9-round game, each round has its own frozen snapshot.

### Step 4 — Ghost lookup refactor (30 min)

- `getRunGhostSnapshot` queries `game_run_loadout_items` directly by round number
- Filters: different player, different game run, matching target mushroom
- Falls back to `createBotGhostSnapshot` if no real player row found
- Delete `game_run_ghost_snapshots` table + all references

**Deliverable:** Ghosts pulled from historical rows. Delete the JSON blob table.

### Step 5 — Battle resolution read path (30 min)

- `getActiveSnapshot` reads from `game_run_loadout_items WHERE game_run_id=? AND round_number=?`
- Fallback for legacy single-battle flow: read from `player_artifact_loadouts` only when no active game run

**Deliverable:** Battles resolve correctly using new data source.

### Step 6 — Client routing (45 min)

- Add `/game-run/:id` route
- `startNewGameRun` navigates to `/game-run/${runId}` instead of `/prep`
- On page load: parse `:id` from URL, call `GET /api/game-run/:id`, populate state
- `refreshBootstrap` no longer pre-loads game run state — the route handler does it

**Deliverable:** `/game-run/:id` loads correctly from a cold navigation.

### Step 7 — Client state as projection (60 min)

- Replace direct writes to `builderItems`/`containerItems`/`activeBags`/`rotatedBags` with computed getters
- Each UI mutation calls the corresponding scoped endpoint
- Server response replaces `state.loadoutItems` wholesale
- Delete `buildLoadoutPayloadItems`, `persistShopOffer` (keep only shop offer persistence)
- Delete the `PUT /api/artifact-loadout` path for game runs

**Deliverable:** Full prep screen UI works against new endpoints. No local reconciliation logic remaining.

### Step 8 — Tests (60 min)

Unit tests:
- `startGameRun` seeds round 1 rows for the active mushroom
- `resolveRound` copies round N → round N+1 rows
- `buyRunShopItem` / `sellRunItem` / `placeItem` against new table
- Ghost lookup returns historical rows from other players

E2E tests:
- Buy → place → reload → same layout
- Play 3 rounds → round 1 snapshot in DB is unchanged after round 3 resolved
- Previous-round ghost: player A finishes round 2, player B in round 3 faces A's round-2 snapshot
- Duplicates: buy same artifact twice, see two distinct items

**Deliverable:** All tests green. No legacy tests broken.

### Step 9 — Cleanup (30 min)

- Delete `purchased_round` column from `player_artifact_loadout_items` (nobody reads it anymore)
- Delete `buildLoadoutPayloadItems` from `useGameRun.js`
- Delete `builderItems`/`activeBags`/`rotatedBags` from `persistShopOffer` payload
- Delete `game_run_ghost_snapshots` table
- Update [docs/artifact-board-spec.md](./artifact-board-spec.md) §3 (Bag System), §5 (Shop System), §11 (State Management), §12 (Persistence)
- Update [docs/balance.md](./balance.md) Issue #11 entry with "resolved via refactor"

**Deliverable:** No dead code, docs current.

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Data loss for in-flight game runs | High | Low | No real users; accept the break. Announce in commit message. |
| Step 2 endpoints have subtle bugs that only appear in step 7 integration | Medium | Medium | Each step ships with its own tests. Fix at the earliest step possible. |
| Client state stays in memory and diverges from server | Medium | High | Every mutation returns the full refreshed state; client always replaces wholesale. No local edits to `loadoutItems`. |
| Ghost lookup is slow at scale (full table scan on `round_number`) | Low | Medium | Added index in Step 1. Monitor `EXPLAIN QUERY PLAN` after Step 4. |
| Removing `purchased_round` breaks a test I forgot about | Medium | Low | Run `grep -r purchased_round` before deletion in Step 9. |
| Legacy `ArtifactsScreen` tests break because they share schema | Low | Medium | Legacy flow keeps its own `player_artifact_loadouts` table. Tests should be unaffected. |
| `startGameRun` + `createBotLoadout` combo takes too long in test setup | Low | Low | The starter loadout is ~6 items max; bot loadout is already fast. |

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

The refactor is done when:

- [ ] A player can play 9 rounds without any UI state drift after reloads
- [ ] Duplicate artifacts work correctly (buy `spore_needle` × 2 = 2 distinct items)
- [ ] `/game-run/:id` routes load correctly from cold navigation
- [ ] Ghost opponents are pulled from real player snapshots at the matching round
- [ ] All 68+ unit tests pass
- [ ] All bag/satchel/reload E2E tests pass
- [ ] `grep -r "purchased_round"` returns 0 matches in `app/server`
- [ ] `grep -r "builderItems" web/src/composables/useAuth.js` returns 0 matches in the restoration block
- [ ] No bug on the list in §1.1 reproduces

---

## 11. Timeline

| Session | Scope |
|---------|-------|
| 1 | Steps 1–3 (DB + server write endpoints + lifecycle) |
| 2 | Steps 4–5 (ghost lookup + read path) |
| 3 | Steps 6–7 (client routing + projection) |
| 4 | Steps 8–9 (tests + cleanup) |

Can be compressed to a single focused day if no surprises.
