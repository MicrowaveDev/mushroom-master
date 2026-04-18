# Loadout & Run-State Refactor — Post-Implementation Review

**Plan:** [loadout-refactor-plan.md](./loadout-refactor-plan.md)
**Branch:** `codex/lore-regeneration-fixes`
**Shipped:** 2026-04-11 (single-day execution, 10 commits)
**Reviewer:** —

> **Reference contracts extracted:** the §5.1/§5.5/§5.6 hardening items
> (concurrency lock, structured logging, idempotency) shipped after this
> review and are now documented as permanent contracts in
> [infra-hardening.md](./infra-hardening.md). Read this file for the
> narrative; read that file for the current rules.

---

## 1. Outcome at a glance

| Metric | Planned | Actual |
|---|---|---|
| Effort | ~8 focused hours | ~10 hours |
| Commits | 10 (one per step) | 10 (Steps 2+3 merged, +1 flake fix) |
| Tests | "all green + Step 0 suite" | 87 → 127 passing |
| §10 success criteria | 15/15 | 13/15 (2 naming-level leftovers) |
| §1.1 bug list resolution | All 11 | All 11 (verified for #9, #11) |

**Verdict:** The refactor met its **correctness** goals end-to-end. It deliberately under-shipped on **production-readiness** scaffolding (§11) to keep the diff bounded. The three-sources-of-truth problem that motivated the work is gone; the deferred items are scaling/operability concerns, not regressions.

---

## 2. What was delivered

### Architectural wins (the reason this refactor existed)

1. **Single source of truth.** `game_run_loadout_items` is now the only run-scoped loadout store. Bootstrap, battle resolution, ghost lookup, and client projection all read from the same rows. The reconciliation block in `refreshBootstrap()` is gone.
2. **Round-scoped history.** Loadout *and* shop state rows are inserted per round and copied forward. Round N rows are immutable history once round N+1 starts. Unlocks ghost replays, per-round analytics, and graduated refunds (latter still backlog).
3. **Unified ghost lookup.** Real-player snapshots and bot fallback both live in `game_run_loadout_items` and are read by the same query. The `game_run_ghost_snapshots` table is deleted. The bot/player code fork that historically caused snapshot drift no longer exists.
4. **Legacy severance.** `startGameRun` no longer reads `player_artifact_loadouts`. `selectActiveMushroom` no longer seeds it. The legacy `ArtifactsScreen` flow is its own self-contained world. **Issue #11 (items leak between runs) is structurally impossible now**, not just patched.
5. **Bookmarkable runs.** `/game-run/:id` is live; deep links resolve to the active run or bounce home cleanly if the run ended.
6. **Validator split.** `validateLoadoutItems` is an orchestrator over `validateGridItems` / `validateBagContents` / `validateCoinBudget`. Each is independently tested. `FAMILY_CAPS` registry replaces scattered `family === 'bag'` branches on the server.
7. **Shared constants module.** `app/shared/game-constants.js` is the single home for 20 numeric constants both client and server import.

### Test coverage delta

- 87 → 127 passing (+40 tests, +46%).
- New files: `loadout-refactor.test.js` (Step 0 goal-defining, 9 tests), `validator-split.test.js` (18 tests), `run-lifecycle.test.js` (6 tests), `artifact-helpers.test.js` (7 tests).
- Two pre-existing flakes fixed along the way (telegram ID collision, dup-artifact RNG edge case).

---

## 3. Where the plan deviated

These were judgment calls made during execution, not failures.

| Deviation | Why it was made | Verdict |
|---|---|---|
| **Steps 2 & 3 merged into one commit** (`a6d3afd`) | The read path and write path must flip atomically — splitting them leaves the system in a half-state where either reads see new tables but writes hit old ones, or vice versa. | **Right call.** A "rollback unit" that's structurally broken isn't a rollback unit. |
| **No granular `/place` `/unplace` `/rotate` endpoints** — instead, the existing `PUT /api/artifact-loadout` was rewritten to bridge into `applyRunLoadoutPlacements()` | Building granular endpoints required a parallel client rewrite of `useShop.js`. Bridge approach kept the existing UI working without a full-stack flip. | **Right call for v1, but it's a debt anchor.** The bridge is what keeps `buildLoadoutPayloadItems` alive on the client (§10 criterion ❌) and forces full-layout-on-every-change network chatter. |
| **`artifact-helpers.js` lives at `app/server/services/`, not `app/shared/`** | Client-side family checks are still string-based; moving the module would have required a parallel client adoption pass. | **Acceptable.** Cheap follow-up when the client needs it. |
| **`mutateRun` / `withRunLock` / idempotency helpers not introduced** | Required new infra (`app/server/lib/`) and a refactor of every mutation site. Out of scope for the data-model refactor. | **Risky deferral.** See §5. |
| **Migrations still use `sequelize.sync()`** (no umzug) | Mid-refactor rewrite of every test's `freshDb()` was larger than the cost of deferring. No real users to lose. | **Right call given user count.** Becomes blocking before launch. |
| **`coins` column kept on `game_run_players`** instead of becoming computed-on-read | Atomically maintained inside transactions today. Computed-on-read is still available as a future optimization. | **Right call.** The denormalization risk the plan flagged is mitigated by the transaction boundary. |
| **Mutations don't return `{ gameRun, loadoutItems, shopOffer }` envelope** — client re-fetches via `refreshBootstrap()` | Changing every endpoint's response shape would have rippled through every client caller. | **Acceptable for v1.** Slightly more network chatter; structurally correct. |

---

## 4. What went well

- **Step 0 paid off.** Writing 9 failing tests *first* meant "done" was machine-checkable from day one. Every step ended with a clear set of red→green transitions, not vibes.
- **Single-day execution.** The plan estimated 5 sessions; the work landed in one focused day with ~10 commits. Plan-driven refactors compress well when the architecture is decided up-front.
- **No correctness regressions.** All pre-existing tests stayed green. The two test fixes during Step 8 (`696ee7e`) were latent bugs, not refactor breakage.
- **The "merged Step 2/3" judgment held.** The atomic read/write flip avoided the half-state failure mode the plan was structured around.
- **Severance worked structurally.** Issue #11 wasn't fixed by patching `saveArtifactLoadout`; it was made impossible by removing the shared writer. This is the difference the refactor was supposed to make.
- **Test count grew with the change**, not after it. +40 tests landed inside the refactor commits, not as a follow-up cleanup.

---

## 5. What didn't go well / open risks

### 5.1 Concurrency safety is unchanged from pre-refactor

`mutateRun` + per-run lock (§11.1) was deferred. Concurrent `buy` calls from the same player can still race past coin validation before either debits. The transaction boundary catches *atomicity* but not *serialization*. This is the same exposure the codebase had before the refactor — but the refactor was the moment to close it, and didn't.

**Mitigation status:** None. Single-player + low concurrency masks the issue today.

**Recommendation:** Land `withRunLock(gameRunId, playerId, fn)` around `buyRunShopItem`, `sellRunItem`, `applyRunLoadoutPlacements`, and `refreshRunShop` as a one-commit follow-up. This is a half-day of work and closes a real exposure before launch.

### 5.2 The bridge layer is now load-bearing

`PUT /api/artifact-loadout` → `applyRunLoadoutPlacements` was meant to be a temporary shim while the granular endpoints landed. They didn't land. Today the bridge:

- Keeps `buildLoadoutPayloadItems` alive on the client (§10 criterion ❌)
- Forces every placement change to send the full layout
- Means `useShop.js` and `ArtifactsScreen` still read `bootstrap.shopState` (deferred bootstrap shrink)
- Blocks deletion of the legacy `PUT /api/artifact-loadout` endpoint

**Risk:** "Temporary" shims become permanent. The bridge has no test asserting it stays a thin pass-through; future authors can quietly add logic to it and recreate the multi-source problem.

**Recommendation:** Either schedule the granular endpoints as the next refactor, or add a code comment + test pinning the bridge as a pure pass-through (no business logic). Don't let it accrete.

### 5.3 Two §10 success criteria are visibly red

The plan ships with **13/15 green**, and the two ❌ items (`builderItems` variable name, `createBotGhostSnapshot` function name) are explicitly called out as naming-level leftovers, not correctness gaps. That's honest, but it leaves a `grep` that returns matches for symbols the plan said would be gone. A future reader of the plan needs to read §10 carefully to understand these are intentional.

**Recommendation:** Either rename them in a 30-minute follow-up commit, or move them out of §10 success criteria into §13 backlog so the criteria list reads 15/15.

### 5.4 Doc drift is now larger than before

The refactor deliberately deferred:
- `docs/artifact-board-spec.md` §3/§5/§11/§12 (still describes the three-source model)
- `docs/battle-system-rework-plan.md` "Current workspace state" (still references the deleted ghost snapshots table)
- `docs/balance.md` Issue #11 (still says "Still broken")

These are higher-stakes than the plan's "Deferred (now backlog)" framing implies — `balance.md` Issue #11 actively misleads anyone reading it as a current bug list.

**Recommendation:** Tackle the `balance.md` Issue #11 update immediately (one-line change). Tackle the spec/plan updates as part of the next docs sweep.

### 5.5 No observability landed

Structured logging + metrics (§11.5) were deferred entirely. There is no per-route timing, no per-outcome counter, no trace propagation. Once production traffic starts, "what happened to this player at 14:02" is currently unanswerable.

**Recommendation:** Land `app/server/lib/obs.js` with a minimal structured logger before any production traffic. This is half a day; without it, the next bug investigation is going to hurt.

### 5.6 Idempotency gap on retries

§11.2 deferred. Mobile clients retrying a `buy` POST can double-debit and double-insert. Probability is low (network is reliable today) but the failure mode is silent and irreversible from the user's perspective.

**Recommendation:** Land `Idempotency-Key` header + 5-minute LRU dedupe cache before mobile testing.

---

## 6. Lessons learned

1. **"Failing tests first" was the highest-leverage practice.** 45 minutes in Step 0 paid back across every subsequent step by removing the "is this done?" ambiguity. Repeat for the next refactor.
2. **Atomic cutover beats step-by-step purity.** Splitting the read path (Step 2) from the write path (Step 3) would have produced two non-shippable intermediate states. Merging them was right. The next plan should mark such pairs explicitly as "ship together" rather than as separate steps.
3. **Bridges need test pins.** A "temporary" bridge layer with no test asserting its temporariness becomes permanent. Add a pass-through assertion next time, or commit to deleting it in the same refactor.
4. **Production readiness items are not optional and don't get cheaper.** §11 was scoped into the plan and then deferred wholesale. The same files will be reopened to add concurrency, idempotency, and observability — exactly the cost the plan tried to avoid. Next refactor: either fence §11 items into the same commits as the related Step, or split them into a dedicated parallel "ops readiness" PR with its own owner. Don't list them as in-scope and then defer.
5. **Single-day refactors work when the plan is decided up-front.** The plan was ~1,000 lines before any code was written. That looks like overkill but compressed execution time dramatically. Repeat for refactors of comparable scope.
6. **Naming-level cleanups need a separate commit at the end.** `builderItems` and `createBotGhostSnapshot` could have been killed in a 30-minute follow-up; instead they're sitting in §10 as red boxes. Budget a "rename pass" commit at the end of every refactor.
7. **`balance.md` Issue #11 should have been updated in the same commit that fixed it.** Deferring docs updates creates actively misleading documentation, not just stale documentation. Tighter rule next time: if a refactor resolves a known bug entry, the bug-list update is part of the same commit.

---

## 7. Recommended follow-ups (priority order)

| # | Item | Effort | Why now |
|---|---|---|---|
| 1 | Update `balance.md` Issue #11 to "resolved" | 5 min | Currently misleading |
| 2 | Add `withRunLock` around mutation endpoints (§11.1) | 0.5 day | Closes real concurrency exposure |
| 3 | Land structured logging (§11.5) | 0.5 day | Required before production traffic |
| 4 | Add `Idempotency-Key` support (§11.2) | 0.5 day | Required before mobile traffic |
| 5 | Rename `builderItems` / kill `createBotGhostSnapshot` references | 0.5 day | Closes §10 to 15/15 |
| 6 | Granular `/place` `/unplace` `/rotate` endpoints + delete bridge | 1–2 days | Removes the load-bearing shim |
| 7 | umzug versioned migrations (§11.3) | 1 day | Required for zero-downtime schema changes |
| 8 | Update `artifact-board-spec.md` §3/§5/§11/§12 | 1–2 hours | Spec drift |
| 9 | Rate limiting (§11.9) | 0.5 day | Cheap, unblocks public endpoint exposure |
| 10 | Delete `ArtifactsScreen` entirely (telemetry-gated) | 0.5 day | Final dead-code removal |

Items 1–5 are pre-launch. Items 6–10 are post-launch hygiene.

---

## 8. Score

| Dimension | Score | Notes |
|---|---|---|
| Architectural goals (§3) | 10/10 | All ten goals met or structurally enabled |
| §10 success criteria | 13/15 | Two naming-level leftovers, no correctness gaps |
| §1.1 bug list resolution | 11/11 | Issue #11 is now structurally impossible |
| Production readiness (§11) | 2/10 | Mostly deferred; only §11.6 (auth) and §11.8 (FAMILY_CAPS) partially landed |
| Test coverage growth | 9/10 | +40 tests, two flakes fixed, no E2E for prep screen |
| Documentation hygiene | 4/10 | Plan itself is well-annotated; downstream docs (balance.md, artifact-board-spec.md) are now stale |
| Plan adherence | 9/10 | Deviations were judgment calls with explicit rationale |

**Overall:** A successful **architectural** refactor that left **operational** debt on the table. The deferrals were tracked honestly in §13 backlog, which is the difference between "debt" and "rot" — but the items above need to be scheduled, not just listed.
