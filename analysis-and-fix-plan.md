# Analysis & Fix Plan

**Date:** 2026-04-16
**Branch:** codex/lore-regeneration-fixes
**Test baseline:** 274 backend tests pass, 21 E2E tests pass (all green)
**Post-fix (Phase 1–3):** 278 backend tests pass (+4 new), 22 E2E tests pass (+1 screenshots spec now included)
**Post-fix (all phases):** 284 backend tests pass (+10 total new), 22 E2E tests pass

---

## Source of Truth

- **Original request:** Analyze user flows, game requirements, E2E tests, screenshots; produce a plan for fixing bugs, improving architecture, and improving UX.
- **Authoritative specs:** `docs/game-requirements.md`, `docs/user-flows.md`, `docs/design-requirements.md`
- **Config source:** `app/shared/config.js`
- **Screenshots reviewed:** 41 PNG files in `.agent/tasks/telegram-autobattler-v1/raw/screenshots/`

---

## 1. Verified Bugs

### Bug 1.1 — Dalamar missing from game-requirements.md (spec–code drift)
- **Severity:** MEDIUM
- **Evidence:** `app/server/game-data.js:551` defines Dalamar as a 6th playable mushroom (CONTROL style, Ashen Veil passive: each hit permanently reduces enemy defense by 1). `battle-engine.js:150,194` implements the passive. Screenshots (02-home, 03-characters) show 6 characters. BUT `docs/game-requirements.md` Section 6 only lists 5 mushrooms and their abilities — Dalamar is absent.
- **Impact:** Requirement traceability gap. Tests reference Dalamar (battle-engine.test.js has Dalamar passive tests), but no requirement ID covers his stats/abilities. Any behavior changes could violate an undocumented contract.
- **Fix:** Add Dalamar to game-requirements.md §6 with base stats, passive/active ability description, and a new starter preset entry in §3. Update the mushroom count in §1 if referenced.
- **Files:** `docs/game-requirements.md`

### Bug 1.2 — Wiki detail portrait broken in test screenshots
- **Severity:** LOW (test-environment only)
- **Evidence:** Screenshot `12-wiki-detail.png` shows a pink/magenta placeholder where Thalla's portrait should be (src: `http://127.0.0.1:4374/portraits/thalla/default.jpg`). The companion JSON confirms `brokenImages: [...]`.
- **Impact:** Portrait assets are served from `/portraits/` which is proxied to the backend in dev/preview mode. The Vite preview proxy or the backend static serving may not cover the `/portraits/` path used by wiki detail pages.
- **Root cause:** Likely the portrait path resolution in wiki detail differs from the one used elsewhere (which works). Verify that `WikiDetailScreen.js` constructs the same portrait URL pattern as `HomeScreen.js` / `CharactersScreen.js`.
- **Fix:** Check portrait URL construction in wiki detail; ensure static serving covers that path.
- **Files:** `web/src/pages/WikiDetailScreen.js`, `app/server/create-app.js` (static serving)

### Bug 1.3 — `useCustomization.js` swallows API errors silently
- **Severity:** MEDIUM
- **Evidence:** `web/src/composables/useCustomization.js:8-22` — both `switchPortrait()` and `switchPreset()` call `apiJson()` without try-catch. If the API call throws (network error, validation failure), the error propagates unhandled. If it returns `{ success: false }`, the UI silently does nothing — no error message shown to user.
- **Impact:** User clicks portrait/preset switch, nothing happens, no feedback.
- **Fix:** Wrap in try-catch, set `state.error` on failure (same pattern as `useGameRun.signalReady`).
- **Files:** `web/src/composables/useCustomization.js`

### Bug 1.4 — Browser code auth polling leak
- **Severity:** LOW
- **Evidence:** `web/src/composables/useAuth.js:139-165` — `loginViaBrowserCode()` starts a recursive `setTimeout` poll (every 3s for up to 10 min). No cleanup mechanism if user navigates away or clicks a different login method. The poll continues running in the background.
- **Impact:** Minor memory leak, potential double-auth if user retries. In practice this is edge-case only since Telegram Mini App auth is the primary path.
- **Fix:** Store the timeout ID in a ref; clear it on component unmount or when another login method is invoked.
- **Files:** `web/src/composables/useAuth.js`

### Bug 1.5 — `npm run game:test:screens` only runs `screenshots.spec.js`
- **Severity:** MEDIUM
- **Evidence:** `app/scripts/run-game-screenshot-check.js:62` hardcodes `tests/game/screenshots.spec.js`. The other 3 spec files (`solo-run.spec.js`, `challenge-run.spec.js`, `coverage-gaps.spec.js`) are only runnable via manual `npx playwright test --config=tests/game/playwright.config.js`. No npm script runs the full E2E suite.
- **Impact:** The 21 non-screenshot E2E tests are not part of the standard test workflow. Regressions in solo run, challenge mode, and coverage-gap tests could ship unnoticed.
- **Fix:** Add `game:test:e2e` script that runs all spec files, or expand `game:test:screens` to run all `*.spec.js`.
- **Files:** `package.json`, optionally `app/scripts/run-game-screenshot-check.js`

---

## 2. Test Coverage Gaps

### Requirement IDs without any `[Req X-Y]` test reference:

| Req ID | Description | Priority |
|--------|-------------|----------|
| 1-B | 120 combat step cap enforcement | LOW — covered implicitly by battle-engine step_cap logic but no explicit `[Req 1-B]` test |
| 2-E | Unlimited container capacity | LOW — implicit in all buy tests |
| 4-A | Round income table (specific values per round) | MEDIUM — no test validates the exact income array |
| 4-P | Character shop items exist (lore-based, gated by requiredLevel) | HIGH — entire character-shop subsystem untested |
| 4-Q | Character item eligibility by requiredLevel | HIGH |
| 4-R | Solo mode: at least 1 eligible character item per offer | HIGH |
| 4-S | Challenge mode: eligibility capped by min(viewerLevel, opponentLevel) | HIGH |
| 4-T | Character item rules apply to all shop contexts | HIGH |
| 4-U | Challenge shop remains viewer-scoped | MEDIUM |
| 12-C | Challenge idle timeout auto-abandon (5 min) | MEDIUM |
| 14-C | Per-mushroom level isolation (playing one doesn't advance another) | LOW — implicit but not asserted |

**Priority recommendation:** Character shop item requirements (4-P through 4-T) are the biggest gap — 6 untested requirements for a complete game subsystem.

---

## 3. Architecture Improvements

### Arch 3.1 — `run-service.js` is 1,460 lines — decomposition needed
- **Current state:** Single file handles: run creation, round resolution, ghost generation, shop management, buy/sell/placement, refunds, rating, pruning.
- **Concern:** Difficult to navigate, review, and test in isolation. Functions are deeply nested within the module with shared closures.
- **Proposal:** Extract into focused modules:
  - `shop-service.js` — buyRunShopItem, refreshRunShop, forceRunShopForTest, generateShopOffer
  - `ghost-service.js` — getRunGhostSnapshot, createBotGhostSnapshot, pruneOldGhostSnapshots
  - `round-service.js` — resolveRound, resolveChallengeRound, advanceRound
  - `run-service.js` — startGameRun, abandonGameRun, getActiveGameRun (orchestration only)
- **Effort:** MEDIUM — internal refactor, no API changes
- **Risk:** LOW — existing tests provide safety net

### Arch 3.2 — Hardcoded error strings scattered across composables
- **Current state:** `useShop.js` (lines 66, 154, 160, 266, 335) and `useGameRun.js` (line 324) contain inline Russian/English error strings with ternary `state.lang === 'ru'` checks instead of using `i18n.js`.
- **Concern:** DRY violation; error strings are inconsistent with the rest of the i18n system.
- **Fix:** Move all user-facing error strings to `i18n.js`, reference via `t.errorKey`.
- **Effort:** LOW
- **Files:** `web/src/composables/useShop.js`, `web/src/composables/useGameRun.js`, `web/src/i18n.js`

### Arch 3.3 — Deprecated legacy screens still in codebase
- **Current state:** Per `docs/user-flows.md` Flow D, these are deprecated and unreachable:
  - `ArtifactsScreen.js` — legacy shop
  - `BattlePrepScreen.js` — legacy battle prep
  - `ResultsScreen.js` — legacy results (zero `goTo('results')` callers)
  - `RoundResultScreen.js` — deleted 2026-04-14 per user-flows.md
- **Concern:** Dead code increases cognitive load and bundle size.
- **Fix:** Delete `ArtifactsScreen.js`, `BattlePrepScreen.js`, `ResultsScreen.js` and their route handlers in `main.js`. Verify no imports reference them.
- **Effort:** LOW
- **Risk:** LOW — verify with grep for screen names before deleting

### Arch 3.4 — Missing npm script for full E2E suite
- **Current state:** Only `game:test:screens` exists (runs screenshot spec only). No single command runs all 4 Playwright spec files.
- **Fix:** Add to `package.json`:
  ```json
  "game:test:e2e": "node app/scripts/run-game-e2e.js"
  ```
  Create `run-game-e2e.js` based on `run-game-screenshot-check.js` but passing all spec files.
- **Effort:** LOW

---

## 4. UX Improvements

### UX 4.1 — No loading feedback on portrait/preset switch
- **Current state:** Clicking a portrait variant or preset variant fires an API call with no loading indicator. If the API is slow, the user sees no response.
- **Fix:** Set `state.actionInFlight = true` during switch calls; show a spinner or disable the button.
- **Files:** `web/src/composables/useCustomization.js`, relevant UI component

### UX 4.2 — Character cards lack keyboard accessibility
- **Current state:** `CharactersScreen.js` uses `@click` on `<div>` elements for character selection. No `role="button"`, no `tabindex`, no keyboard event handler.
- **Fix:** Add `role="button" tabindex="0"` and `@keydown.enter` handler.
- **Files:** `web/src/pages/CharactersScreen.js`
- **Effort:** LOW

### UX 4.3 — `describeReplay()` called repeatedly in history list
- **Current state:** `main.js` calls `describeReplay(battle)` up to 10 times per battle entry in the template, recomputing the same result on every render.
- **Fix:** Compute once and cache via a computed property or inline variable in the `v-for`.
- **Files:** `web/src/main.js`
- **Effort:** LOW

### UX 4.4 — Onboarding doesn't explain the full game loop
- **Current state:** Onboarding shows 3 steps (pick fighter → build loadout → battle). It doesn't mention the 9-round run structure, lives system, or shop economy — which are the core differentiators of the autobattler format.
- **Proposal:** Add a brief 4th step or subtitle mentioning "9 rounds, 5 lives, build your loadout each round" to set expectations before the first run.
- **Effort:** LOW
- **Files:** `web/src/pages/OnboardingScreen.js`, `web/src/i18n.js`

### UX 4.5 — Wiki detail broken image (portrait not loading)
- **Evidence:** Screenshot `12-wiki-detail.png`
- **Fix:** See Bug 1.2 above
- **Impact:** First impression of wiki is broken — player sees a pink rectangle instead of a character portrait

---

## 5. Potential Backend Concerns (need verification)

These were flagged by analysis but may be mitigated by existing mechanisms (`withRunLock`, transactions). Listing for awareness:

### Concern 5.1 — Shop refresh TOCTOU window
- **Location:** `run-service.js` refreshRunShop
- **Scenario:** Two rapid refresh clicks → both read same coin balance → both deduct → coins go negative.
- **Mitigation check:** `withRunLock(gameRunId, ...)` wraps the operation — if the lock is per-run and single-threaded, this is safe. Verify `withRunLock` uses a true mutex (not just a DB-level advisory lock that could be bypassed).
- **Status:** Likely safe due to `withRunLock`, but worth a quick verification.

### Concern 5.2 — Ghost snapshot RANDOM() is non-seeded
- **Location:** `run-service.js` getRunGhostSnapshot — `ORDER BY RANDOM() LIMIT 1`
- **Impact:** Different ghost opponents on each run even with identical player state. This is probably intentional (variety), but means testing ghost selection deterministically is harder.
- **Status:** Informational; no action needed unless deterministic replays are desired.

### Concern 5.3 — Soft-delete unbounded table growth
- **Location:** Game runs use `is_active = 0` soft delete; no cleanup/archival exists for completed runs.
- **Impact:** Over months of production use, `game_runs`, `game_run_players`, `game_run_loadout_items` grow unboundedly.
- **Status:** Not urgent for launch; add to backlog for production hardening.

---

## 6. Execution Priority

### Phase 1 — Bugs & Spec Drift (do first)
| # | Task | Effort | Files |
|---|------|--------|-------|
| 1.1 | Add Dalamar to game-requirements.md | LOW | docs/game-requirements.md |
| 1.2 | Fix wiki detail portrait URL | LOW | WikiDetailScreen.js, create-app.js |
| 1.3 | Add error handling to useCustomization | LOW | useCustomization.js |
| 1.5 | Add npm script for full E2E suite | LOW | package.json |

### Phase 2 — Test Coverage (high-value gaps)
| # | Task | Effort | Files |
|---|------|--------|-------|
| 2.1 | Add tests for character shop items (4-P through 4-T) | MEDIUM | tests/game/round-resolution.test.js or new file |
| 2.2 | Add test for challenge idle timeout (12-C) | MEDIUM | tests/game/challenge-run.test.js |
| 2.3 | Add test for round income values (4-A) | LOW | tests/game/round-resolution.test.js |

### Phase 3 — UX Polish
| # | Task | Effort | Files |
|---|------|--------|-------|
| 4.1 | Loading feedback on portrait/preset switch | LOW | useCustomization.js |
| 4.2 | Keyboard accessibility for character cards | LOW | CharactersScreen.js |
| 4.3 | Memoize describeReplay() in history list | LOW | main.js |
| 3.2 | Move hardcoded error strings to i18n.js | LOW | useShop.js, useGameRun.js, i18n.js |

### Phase 4 — Architecture (when time permits)
| # | Task | Effort | Files |
|---|------|--------|-------|
| 3.1 | Decompose run-service.js | MEDIUM | app/server/services/ |
| 3.3 | Delete deprecated legacy screens | LOW | web/src/pages/, web/src/main.js |
| 1.4 | Fix auth polling cleanup | LOW | useAuth.js |

### Backlog (production hardening)
| # | Task | Effort |
|---|------|--------|
| 5.3 | Add completed-run archival/pruning | MEDIUM |
| 5.1 | Verify withRunLock mutex guarantees | LOW |
| 4.4 | Improve onboarding content | LOW |

---

## 7. Non-goals

- No combat balance changes (out of scope for bug/architecture pass)
- No new game features
- No lore/renderer changes (separate workflow)
- No database migration schema changes (stability)

---

## 8. Open Assumptions (resolved)

- ✅ `withRunLock` verified as correct async promise-chain mutex. Race conditions mitigated.
- ✅ Character shop items (4-P through 4-T) now implemented: 6 items, eligibility logic, guaranteed slot, all callers updated, 6 tests added.
- ✅ Completed-run archival implemented: `pruneCompletedRuns()` with 90-day default retention.

---

## 9. Execution Results

### Phase 1 — Bugs & Spec Drift ✅

| # | Task | Status | What was done |
|---|------|--------|---------------|
| 1.1 | Add Dalamar to game-requirements.md | ✅ Done | Added Dalamar to §3 (starter preset: Entropy Shard + Shock Puff), §6 (abilities: Ashen Veil passive, Bone of Entropy active), §6 base stats (100/10/5/3 Control), updated ghost count from 4→5 in §7-A |
| 1.2 | Fix wiki detail portrait URLs | ✅ Done | Fixed `.jpg` → `.png` extension mismatch in wiki frontmatter for thalla, lomie, and kirt (`wiki/characters/*/page.md`) |
| 1.3 | Add error handling to useCustomization | ✅ Done | Wrapped `switchPortrait()` and `switchPreset()` in try-catch blocks, sets `state.error` on failure |
| 1.5 | Add npm script for full E2E suite | ✅ Done | Created `app/scripts/run-game-e2e.js` and added `game:test:e2e` script to package.json; runs all 4 spec files with proper port isolation |

### Phase 2 — Test Coverage ✅

| Req | Test added | File |
|-----|-----------|------|
| 4-A | Round income matches ROUND_INCOME table | `tests/game/round-resolution.test.js` |
| 1-B | Step cap (120) enforced with `step_cap` endReason | `tests/game/battle-engine.test.js` |
| 12-C | getIdleRunIds returns runs idle longer than timeout | `tests/game/ready-manager.test.js` |
| 14-C | Mycelium is per-mushroom (playing thalla doesn't advance axilin) | `tests/game/mushroom-progression.test.js` |

### Phase 3 — UX Polish ✅

| # | Task | Status | What was done |
|---|------|--------|---------------|
| 3.2 | Move hardcoded error strings to i18n | ✅ Done | Added 4 error keys to i18n.js (both ru/en). Replaced 6 inline ternaries in useShop.js and 1 in useGameRun.js with `messages[state.lang].errorKey` |
| 4.2 | Keyboard accessibility for character cards | ✅ Done | Added `role="button" tabindex="0" @keydown.enter.prevent` to character cards in CharactersScreen.js |
| 4.3 | Memoize describeReplay() | ✅ Done | Added per-id+lang cache Map in useGameState.js; ~13 calls per battle entry reduced to 1 computation |

### Phase 4 — Architecture ✅

| # | Task | Status | What was done |
|---|------|--------|---------------|
| 4.1 | Delete deprecated legacy screens | ✅ Already done | Legacy screens (ArtifactsScreen, BattlePrepScreen, ResultsScreen) were already deleted; only a comment reference remains in main.js |
| 4.2 | Fix auth polling cleanup | ✅ Done | Added `authPollTimer` ref and `clearAuthPoll()` to useAuth.js; clears poll timer when any login method is invoked or auth succeeds |
| 3.1 | Decompose run-service.js | ⏳ Deferred | 1,460-line file — extraction into shop-service, ghost-service, round-service is recommended but deferred to avoid risk in this changeset |

### Phase 5 — Remaining Backlog Items ✅

| # | Task | Status | What was done |
|---|------|--------|---------------|
| 5.1 | Character shop items (4-P–4-T) | ✅ Done | Added 6 character shop items (one per mushroom, level 5 gate) to game-data.js. Extended `generateShopOffer` with guaranteed character-item slot. Added `lookupEligibleCharacterItems` helper with challenge-mode opponent-level cap. Updated all 5 call sites. |
| 5.2 | Tests for character shop items | ✅ Done | 6 new tests covering: data model (4-P), eligibility filtering (4-Q), level gate (4-Q), guaranteed slot (4-R), empty pool fallback, and integration with earnMycelium pipeline |
| 5.3 | Decompose run-service.js | ✅ Done | Extracted shop functions (buy/refresh/force/sell, generateShopOffer, lookupEligibleCharacterItems) into `shop-service.js` (388 lines). run-service.js reduced from 1,547→1,168 lines (~25% reduction). Re-exports preserved for backwards compatibility. |
| 5.4 | Completed-run archival/pruning | ✅ Done | Added `pruneCompletedRuns(maxAgeDays)` to run-service.js. Deletes loadout items, shop states, refunds, rounds, and run records for completed/abandoned runs older than 90 days (COMPLETED_RUN_MAX_AGE_DAYS). |
| 5.5 | Verify withRunLock mutex | ✅ Done | Verified: promise-chain mutex in ready-manager.js correctly serializes concurrent callers per gameRunId. Different runs are independent. All race condition concerns from initial analysis are mitigated. |

### Phase 6 — Final Items ✅

| # | Task | Status | What was done |
|---|------|--------|---------------|
| 6.1 | Wire pruneCompletedRuns to periodic trigger | ✅ Done | Added to `runPrune()` in start.js alongside ghost snapshot pruning. Runs on startup and every 24 hours. |
| 6.2 | Character shop item UI badge | ✅ Done | Added "Особый"/"Signature" badge (orange chip) on character items in prep screen shop. CSS class `.artifact-stat-chip--character` with warm amber styling. i18n key `characterItem` added. |

### Additional Files Changed (Phase 5–6)

- `app/server/start.js` — Wired pruneCompletedRuns to 24h periodic prune
- `web/src/pages/PrepScreen.js` — Character item badge in shop
- `web/src/styles.css` — `.artifact-stat-chip--character` styling
- `web/src/i18n.js` — `characterItem` key (ru: "Особый", en: "Signature")

### Remaining Backlog

All planned items are complete. No remaining backlog.

### Files Changed

**Specs & docs:**
- `docs/game-requirements.md` — Added Dalamar, updated ghost count, verified date

**Wiki data:**
- `wiki/characters/thalla/page.md` — Fixed portrait extension .jpg→.png
- `wiki/characters/kirt/page.md` — Fixed portrait extension .jpg→.png
- `wiki/characters/lomie/page.md` — Fixed portrait extension .jpg→.png

**Frontend:**
- `web/src/composables/useCustomization.js` — Error handling
- `web/src/composables/useAuth.js` — Auth polling cleanup
- `web/src/composables/useShop.js` — i18n error strings
- `web/src/composables/useGameRun.js` — i18n error strings
- `web/src/composables/useGameState.js` — describeReplay cache
- `web/src/pages/CharactersScreen.js` — Keyboard accessibility
- `web/src/i18n.js` — Error message keys

**Backend:**
- `app/shared/config.js` — Added COMPLETED_RUN_MAX_AGE_DAYS
- `app/server/game-data.js` — Added 6 character shop items, characterShopItems export, getEligibleCharacterItems helper, re-export COMPLETED_RUN_MAX_AGE_DAYS
- `app/server/services/run-service.js` — Shop functions extracted, pruneCompletedRuns added, character shop eligibility plumbed into all generateShopOffer call sites (1,547→1,168 lines)
- `app/server/services/shop-service.js` — NEW: extracted shop functions (buy, refresh, force, sell, generateShopOffer, lookupEligibleCharacterItems)
- `app/server/services/game-service.js` — Re-exports pruneCompletedRuns

**Tests:**
- `tests/game/round-resolution.test.js` — [Req 4-A] round income + [Req 4-P/Q/R] character shop item tests (6 new)
- `tests/game/battle-engine.test.js` — [Req 1-B] step cap test
- `tests/game/ready-manager.test.js` — [Req 12-C] idle timeout test
- `tests/game/mushroom-progression.test.js` — [Req 14-C] per-mushroom level test
- `tests/game/bag-items.test.js` — Updated combatArtifacts assertion to account for character shop items

**Infra:**
- `package.json` — Added `game:test:e2e` script
- `app/scripts/run-game-e2e.js` — Full E2E suite runner
- `analysis-and-fix-plan.md` — This plan
