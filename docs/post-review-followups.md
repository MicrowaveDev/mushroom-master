# Post-Review Follow-ups

**Status:** Batch A shipped 2026-04-11 — awaiting user decision on Batch C
**Owner:** —
**Parent:** [loadout-refactor-review.md](./loadout-refactor-review.md)

**Progress:**
- ✅ Batch A (A1–A5) shipped in one session
- ⏸️ Batch B blocked on client-side refactor schedule
- ⏸️ Batch C paused — each item needs its own dedicated plan, user decides when to start
- ⏸️ Batch D tracked, not scheduled

This is the execution plan for the items that remained open after the run-state refactor's post-implementation review. The top-5 pre-launch items (concurrency lock, idempotency, rate limiting, structured logging, balance.md Issue #11) already shipped in earlier commits. This document tracks what's left.

Items are ordered **high-priority → low-priority** and grouped by execution batch. The rule is: start at the top, work down, stop only when hitting a real multi-day refactor that deserves its own plan.

---

## Batch A — cheap, high-value cleanup (target: 1 session)

These close the "post-refactor debt" loop without touching production flows. Each is 1–2 hours.

### A1 — Challenge-mode read isolation integration test ✅ SHIPPED

**Why:** §11.6 Authorization was partially shipped — service-level rejection is tested via `tests/game/loadout-refactor.test.js::cross-run mutation is rejected`, but there's no integration test asserting that **read** paths also isolate challenge-mode participants. The invariant is: in a shared challenge run, player A cannot see player B's coins or loadout except through the explicit ghost-snapshot projection.

**Scope:**
- New scenario test in `tests/game/challenge-isolation.test.js` (one long `test()` with phase checkpoints, per the new "Backend Scenario vs Unit Test Rules" in AGENTS.md)
- Phases:
  1. Create challenge run with two players
  2. Each player buys a distinct item
  3. Player A fetches their own state — sees their own loadout, not B's
  4. Player A attempts to read B's rows directly via service layer — rejected or empty
  5. After round resolve, each player's round-2 state contains only their own copy-forward rows
- Use existing helpers (`bootRun`, `getCoins`, `getShopOffer`) where possible; add a `bootChallengeRun` helper if the two-player setup is long enough to duplicate.

**Acceptance:**
- [x] One new scenario test, green on full suite run — `tests/game/challenge-isolation.test.js`
- [x] Uses shared helpers from `tests/game/helpers.js` (`getCoins`, `getShopOffer`, `forceShopOffer`, `findCheapArtifact`)
- [x] Local `bootChallengeRun` helper added inside the test file (not promoted to `helpers.js` until a second caller exists, per AGENTS.md "don't over-generalize")

**Shipped:** Five-phase scenario test covering `getActiveGameRun` per-player scoping, shop-offer isolation, cross-player buy non-interference, refresh isolation, and `getGameRun` aggregation contract (`players` array exposed but `loadoutItems` never).

---

### A2 — Pin the bridge layer as a pass-through ✅ SHIPPED

**Why:** The `PUT /api/artifact-loadout` → `applyRunLoadoutPlacements` shim is load-bearing (see review §5.2). It was introduced as a temporary bridge while granular endpoints were deferred, but it has no test asserting it stays a thin pass-through. A future author can quietly add business logic to it and re-create the multi-source problem the refactor solved.

**Scope:**
- Add a test asserting `applyRunLoadoutPlacements` does nothing beyond (a) validate the active run + player membership and (b) delegate to `applyLegacyPlacements` to write rows. No coin math, no shop mutation, no cross-table side effects.
- Add a code comment at the top of `applyRunLoadoutPlacements` explicitly marking it as "temporary bridge — if you're adding logic here, write granular endpoints instead."
- Add a note in `AGENTS.md` under a new **Bridge Layer Rules** subsection (optional — only if the comment isn't enough).

**Acceptance:**
- [x] New test file `tests/game/bridge-pin.test.js` with four tests asserting the bridge's contract
- [x] Code comment on `applyRunLoadoutPlacements` in `app/server/services/run-service.js` explicitly marking it as a temporary pass-through
- [x] No behavior change

**Shipped:** Four pins:
1. `applyRunLoadoutPlacements` does not touch `game_run_players.coins`
2. Does not touch `game_run_shop_states`
3. Does not write to `game_run_refunds`
4. Structural pin: body stays under 30 non-blank, non-comment lines (current: ~18). Threshold breaks loudly if someone drops in business logic.

---

### A3 — Sync `loadout-refactor-plan.md` §13 backlog with review ✅ SHIPPED

**Why:** The plan's §13 backlog says the concurrency lock, idempotency, rate limiting, structured logging, and balance.md updates are still open. They aren't — they shipped after the review. A future reader of the plan will think the system is less production-ready than it actually is.

**Scope:**
- Strike-through or remove the completed items from `docs/loadout-refactor-plan.md` §13 "Deferred during implementation (2026-04-11)"
- Add a dated "Post-review hardening" block at the top of §13 listing what shipped after 2026-04-11
- Cross-link to `docs/loadout-refactor-review.md` and `docs/post-review-followups.md` so the three documents agree

**Acceptance:**
- [x] §13 accurately reflects current state
- [x] Shipped items moved to a "Post-review hardening shipped" subsection
- [x] No contradictions between plan, review, and this followups doc — plan now cross-links to both

**Shipped:** New "Post-review hardening shipped (2026-04-11)" block at the top of §13 listing 10 items. Old "Deferred during implementation" block rewritten as "Still deferred (tracked in post-review-followups.md)" and grouped by batch.

---

### A4 — Update `docs/artifact-board-spec.md` §3/§5/§11/§12 ✅ SHIPPED

**Why:** The spec still describes the three-source model (`player_artifact_loadouts` + JSON blob + `startNewGameRun` response). Anyone reading it as current architecture will be wrong about every read/write path in the game-run flow. This is active misinformation, not stale documentation.

**Scope:**
- §3 Bag System — verify still accurate (the bag model didn't change, only its storage location)
- §5 Shop System — update to describe round-scoped shop state rows
- §11 State Management — replace the three-sources diagram with the `game_run_loadout_items` + projection model
- §12 Persistence — describe the new table, severance from `player_artifact_loadouts`, and the round copy-forward

**Acceptance:**
- [x] §11 and §12 rewritten to match the `game_run_loadout_items` + projection model
- [x] No references to `game_run_ghost_snapshots`; `persistShopOffer` explicitly scoped to legacy-only
- [x] Cross-links to `loadout-refactor-plan.md` and `post-review-followups.md` added in §3, §11, §12

**Shipped:**
- §3 "State Restoration on Reload" rewritten — the old two-source join algorithm is gone, replaced with the single-source projection (`state.gameRun.loadoutItems` + computed `builderItems`/`containerItems`/etc). The "Persistence: Client → Server Mapping" subsection now opens with a prominent status note explaining the bridge is temporary.
- §5 mode-comparison table updated — "State on reload" now says "Server `game_run_loadout_items` (single source, round-scoped)" for game-run mode. New "Storage table" row differentiates game-run vs legacy.
- §5 "Starter Loadout" rewritten — `startGameRun` calls `createBotLoadout` directly; `selectActiveMushroom` no longer seeds the legacy table.
- §11 "State Management" rewritten — new structure splits "authoritative (game run)" from "projected" from "legacy shop" from "transient UI". State Reset Points table updated.
- §12 "Persistence" rewritten — three game-run tables listed with mutators, coins storage strategy documented, mutation safety via `withRunLock` cited. `persistShopOffer` section explicitly scoped to legacy only.

---

### A5 — Update `docs/battle-system-rework-plan.md` "Current workspace state" ✅ SHIPPED

**Why:** Still references the deleted `game_run_ghost_snapshots` table. One-paragraph fix.

**Scope:**
- Find the "Current workspace state" section, remove references to the deleted table, note the unified ghost path at `getRunGhostSnapshot` in `run-service.js`
- Update `STEP_CAP` reference if it still says 12 (it's 120 now)

**Acceptance:**
- [x] No references to `game_run_ghost_snapshots` except the one explicitly calling it out as deleted
- [x] `STEP_CAP` value matches `app/shared/game-constants.js` (120, not 12)

**Shipped:**
- Line 61 "Current state" bullet corrected: `BATTLE_ROUND_CAP` → `STEP_CAP` renaming is a shipped historical event, not future work; value is now 120, not 12.
- §"Current workspace state (post-rework)" backend section rewritten to match post-refactor reality — new service modules (`run-service.js`, `battle-service.js`, `game-run-loadout.js`, `artifact-helpers.js`), split validators (`loadout-utils.js`), shared constants module, new observability/idempotency/rate-limit helpers. Models section now lists `game_run_loadout_items` + `game_run_refunds` as new tables and explicitly flags `game_run_ghost_snapshots` as deleted.

---

## Batch B — defer until client-side refactor is scheduled

These are real work (~0.5 day each) but require touching the frontend. They're not pre-launch blockers.

### B1 — Rename `state.builderItems` + kill `createBotGhostSnapshot` references (§10 criteria) 🚫 DEFERRED

**Why:** Two of the original §10 success criteria are still red (13/15). They're naming-level leftovers, not correctness gaps, but they're visible in the criteria list.

**Blocking:** `state.builderItems` is load-bearing across `useGameRun.js`, `useShop.js`, and `PrepScreen.js`. A clean rename needs those three files touched together, which is a client-side refactor pass. `createBotGhostSnapshot` is still used as the final fallback inside `getRunGhostSnapshot` and by `battle-service.js::getRandomGhostSnapshot`.

**When to do:** Same commit that rewrites `useShop.js` (see B2).

---

## Batch C — multi-day refactors (deserve their own plan)

These are real work. **Do not start them without user confirmation** — each one is a 1–2 day commitment and benefits from its own dedicated plan document.

### C1 — Granular run endpoints 🚫 NEEDS DEDICATED PLAN

**Effort:** ~1–2 days
**What:** Add `POST /api/game-run/:id/place`, `/unplace`, `/rotate`, `/activate-bag`, `/deactivate-bag`, `/rotate-bag`. Each takes a single `itemId` + optional coords. Unblocks deletion of `buildLoadoutPayloadItems` and the `PUT /api/artifact-loadout` bridge, plus the response envelope refactor (C2).

### C2 — Mutation response envelope 🚫 NEEDS DEDICATED PLAN

**Effort:** ~0.5 day, pairs with C1
**What:** Every mutation returns `{ gameRun, loadoutItems, shopOffer }`. Client stops re-fetching via `refreshBootstrap()`. Removes network chatter; matches original §2.6 contract.

### C3 — Bootstrap shrink 🚫 NEEDS DEDICATED PLAN

**Effort:** ~0.5 day, blocked on C1 + `useShop.js` rewrite
**What:** Remove `loadout`/`shopState`/`activeGameRun.loadoutItems` from the bootstrap payload. Currently still shipped over the wire because `useShop.js` and `ArtifactsScreen` still read them.

### C4 — umzug versioned migrations 🚫 NEEDS DEDICATED PLAN

**Effort:** ~1 day
**What:** Replace `sequelize.sync()` with umzug migration files. Required for zero-downtime schema changes, blocks any post-launch schema work. Every test's `freshDb()` needs to be updated to run the migration chain instead of sync.

---

## Batch D — post-launch hygiene (track, don't do)

- `artifact-helpers.js` → `app/shared/` (needs client adoption of `FAMILY_CAPS`)
- Delete `ArtifactsScreen` entirely (needs telemetry confirming zero usage)
- Materialized ghost candidate pool — only matters at scale
- Redis-backed SSE/ready state — only matters beyond single-instance

---

## Execution order

1. **Batch A** in order: A1 → A2 → A3 → A4 → A5. All in one session.
2. **STOP** and check in with the user before Batch C. Each C item deserves its own plan.
3. Batch B waits until a client-side refactor is scheduled.
4. Batch D is tracked here but not scheduled.
