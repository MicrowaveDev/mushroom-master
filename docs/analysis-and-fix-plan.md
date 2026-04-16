# Comprehensive Analysis & Bug Fix Plan

**Date:** 2026-04-16
**Branch:** `codex/lore-regeneration-fixes`
**Last test run:** 4 failed, 2 flaky, 21 passed (27 total)

---

## 1. Current Bugs (from E2E test failures)

### Bug A: `.round-result-screen` not found after clicking Ready

- **Failing tests:** `solo-run.spec.js:150`, `coverage-gaps.spec.js:368`
- **Symptom:** After clicking "Ready", the test expects `.round-result-screen` but the page snapshot shows the prep screen still visible (or the home screen in coverage-gaps). The page snapshot shows "Authentication required" text alongside the prep content.
- **Root cause:** The tests reference `.round-result-screen` but the current architecture routes post-Ready directly to the replay screen (per recent refactoring that "dropped round-result screen"). The tests are stale — they still expect a dedicated round-result screen that was removed.
- **Evidence:** The screenshot `solo-04-round-result.png` shows a simple "Defeat" card with Continue/View Replay buttons, confirming the screen did exist at one point. But the page snapshot in the error context shows the user stuck on prep, suggesting the flow now goes prep -> replay directly.

### Bug B: `resetDb()` returns Internal Server Error

- **Failing tests:** `challenge-run.spec.js:28`, `screenshots.spec.js:19`, `coverage-gaps.spec.js:15`
- **Symptom:** `/api/dev/reset` returns `{"success":false,"error":"Internal server error"}`
- **Root cause:** Concurrent Playwright workers (4 workers) all call `resetDb()` at the same time. The SQLite database handle gets closed by one worker's reset while another is still using it (`SQLITE_MISUSE`). The docs say a mutex was added to fix this, but the errors persist — the mutex may not be working correctly under the current parallel worker count, or a race remains in the coalescing logic.

### Bug C: `prep-ready` testid timeout after navigation

- **Failing test:** `solo-run.spec.js:327` (amber satchel test)
- **Symptom:** `[data-testid="prep-ready"]` never appears. Page snapshot shows the home screen (not prep screen) — 6 mushroom cards, "Start Game" button.
- **Root cause:** The test navigates to home, clicks "Start Game", but the page never transitions to prep. The page snapshot shows "Authentication required" text alongside the home content — this suggests the session bootstrap isn't completing properly, likely cascading from the DB reset race condition (Bug B). The test's DB state is contaminated by a concurrent worker's reset.

### Bug D: Dalamaru character count mismatch

- **Status:** Reportedly fixed (assertion updated to 6), but the screenshots confirm 6 mushrooms are now shown (Dalamaru was added). All tests referencing mushroom counts should use 6.

---

## 2. Architecture Issues

### Issue 1: Test isolation — shared DB across parallel workers

The biggest systemic problem. All 4 Playwright workers share one SQLite database and one Express server. `resetDb()` drops and recreates all tables, which is inherently destructive to any concurrent worker.

**Recommendation:** Use per-worker database isolation. Options:
- a) Serial test execution (`workers: 1`) — simple but slow
- b) Per-worker DB files (each worker gets its own SQLite path + Express port)
- c) Transaction-based isolation (wrap each test in a transaction, rollback at end)

### Issue 2: Round-result screen vs inline replay

The test suite and `user-flows.md` spec describe a round-result screen as a distinct step (Flow B Step 3), but the codebase appears to have been refactored to show replay directly. The spec, tests, and code are out of sync:
- `user-flows.md` says: "Post-Ready landing screen is the round-result summary"
- Tests look for `.round-result-screen`
- Recent commits mention "dropped round-result screen"

**Recommendation:** Decide the canonical flow and align all three (spec, tests, code).

### Issue 3: Single reactive state object

All 50+ state fields live in one `reactive({})` object. This works but creates tight coupling — every component re-renders on any state change. As the game grows, this becomes a performance and maintainability concern.

**Recommendation:** Not urgent, but consider splitting into domain-specific reactive stores (auth, gameRun, shop, social) when the next major UI work happens.

### Issue 4: Monolithic CSS (2,841 lines in one file)

All styles in a single `web/src/styles.css`. Finding and modifying styles for specific components requires searching through the entire file.

**Recommendation:** Co-locate styles with components or split by screen. Low priority.

---

## 3. UX Improvements

### High Priority

| # | Issue | Screen | Impact |
|---|-------|--------|--------|
| U1 | No loading indicators on async actions | Prep, Shop | Users click "Ready" or buy items with no feedback — app appears frozen during network calls |
| U2 | Round result screen is sparse | Round Result | The defeat/victory card shows raw numbers with no visual context — no character portrait, no opponent info, no battle summary |
| U3 | Home screen shows only losses | Home | Post-run screenshot shows 5 consecutive "Defeat" entries — there's no differentiation between win/loss visually (all look the same except text) |
| U4 | "Authentication required" visible on authenticated pages | All | Page snapshots consistently show "Authentication required" paragraph alongside authenticated content — this appears to be a flash of unauthenticated state during bootstrap |
| U5 | Error messages don't auto-dismiss | Global | `state.error` persists until the next action overwrites it |

### Medium Priority

| # | Issue | Screen | Impact |
|---|-------|--------|--------|
| U6 | No visual confirmation on purchase | Prep/Shop | Item moves to container silently — no animation, sound, or highlight |
| U7 | Bag expansion has no visual cue | Prep | Dashed border for expanded cells is subtle — new players may not realize the grid grew |
| U8 | Sell zone is plain text | Prep | "Sell" as plain text in a box — no icon, no drag-over highlight feedback visible |
| U9 | Shop items lack visual hierarchy | Prep | All items look the same regardless of price or rarity — a 1-coin and 3-coin item are equally prominent |
| U10 | Challenge prep: waiting text is too subtle | Challenge Prep | Small text at bottom-left — could be a more prominent banner |

### Low Priority (Polish)

| # | Issue | Notes |
|---|-------|-------|
| U11 | No keyboard accessibility for drag-drop | Required for a11y compliance but Telegram Mini App is touch-primary |
| U12 | No `prefers-reduced-motion` media query | Despite having a `reducedMotion` setting in state |
| U13 | Hard-coded i18n strings in templates | Some components use inline ternaries instead of the i18n system |
| U14 | No undo for bag rotation/deactivation | Permanent action with no confirmation |

---

## 4. Fix Plan — Status

### Completed

1. **Fix DB reset race condition** — Set `workers: 1` in playwright.config.js. Root cause: all 4 Playwright workers shared one SQLite DB and Express server; concurrent `resetDb()` calls caused SQLITE_MISUSE. Serializing workers eliminates the race. **Result: 28/28 tests pass (was 4 failed, 2 flaky).**
2. **Align round-result flow** — Already aligned. The test code was updated before this analysis; stale error-context files in test-results/ were misleading. The `.round-result-screen` class no longer exists in code or tests (only as a negative `toHaveCount(0)` assertion in coverage-gaps.spec.js).
3. **Fix "Authentication required" flash** — Suppress 401 errors during bootstrap in useAuth.js. A 401 is an expected state (expired/invalid session) that redirects to auth — not an error to display.
4. **Update mushroom count assertions** — Already correct. `home-mushroom-row` asserts 6 (including Dalamaru). Onboarding portrait count asserts 5 (`.slice(0, 5)` is intentional in OnboardingScreen.js).
5. **Add loading state to Ready button** — Button now shows "Loading..."/"Загрузка..." text with a pulsing animation while `actionInFlight` is true.
6. **Enrich replay rewards card** — Added wins and lives remaining to the inline rewards card on the replay screen, so players see their run status alongside round rewards.
7. **Differentiate win/loss in history** — Already implemented. `home-battle-item--win` (green), `home-battle-item--loss` (red), `home-battle-item--draw` (gold) CSS classes with border-left styling.
8. **Auto-dismiss errors** — Added a 5-second watcher on `state.error` in main.js that auto-clears the error message.
9. **Extract shared E2E test helpers** — Created `tests/game/e2e-helpers.js` with shared `resetDevDb`, `createSession`, `api`, `waitForPrepReady`, `MOBILE_VIEWPORT`. Removed ~200 lines of duplicated boilerplate across 4 spec files.

### Remaining (future work)

9. **Improve test isolation** — Per-worker SQLite databases with unique ports
10. **Add `data-testid` attributes** — More deterministic selectors for key interactive elements
11. **Extract shared test helpers** — DRY up `resetDevDb`, `createSession`, `api`, `saveShot` across 4 spec files (they are copy-pasted)

### Phase 4: Polish (when time allows)

12. **Shop item visual hierarchy** — Price badge styling, rarity indicators
13. **Bag activation animation** — Visual expansion effect when bag is placed
14. **Sell zone redesign** — Icon + drag-over highlight + confirmation
15. **a11y audit** — Focus management, ARIA labels, keyboard navigation
