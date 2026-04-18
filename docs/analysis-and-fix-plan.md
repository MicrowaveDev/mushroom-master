# Comprehensive Analysis & Bug Fix Plan

**Date:** 2026-04-16
**Branch:** `codex/lore-regeneration-fixes`
**Last test run:** 28/28 pass (after Phase 0 fixes)

---

## 1. Bugs Found (from E2E failures + screenshot review)

### Bug A–D (Phase 0 — resolved)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| A: `.round-result-screen` not found | Tests stale after round-result removal | Tests updated |
| B: `resetDb()` Internal Server Error | Concurrent Playwright workers race on SQLite | `workers: 1` |
| C: `prep-ready` timeout | Cascading from Bug B (DB contamination) | Fixed by Bug B fix |
| D: Mushroom count mismatch | Dalamaru added, assertions stale | Updated to 6 |

### Bug E: Wiki detail page JSON parse error (NEW)

- **Evidence:** Screenshot `12-wiki-detail.png` shows red error banner: `Unexpected token '<', "<!doctype '..." is not valid JSON`
- **Root cause:** WikiScreen emits two separate arguments `$emit('open-wiki', 'characters', entry.slug)`, but main.js destructures via `$event[0]`, `$event[1]` — which indexes into the first string argument (`'c'`, `'h'`), calling `/api/wiki/c/h` → 404 → HTML fallback → JSON parse failure.
- **Fix:** Change WikiScreen to emit a single array argument `$emit('open-wiki', ['characters', entry.slug])` matching the `$event[0]/$event[1]` pattern used elsewhere in the codebase.

### Bug F: Legacy no-op `persistShopOffer` / `loadOrGenerateShopOffer` stubs (NEW)

- **Symptom:** Dead code scattered across 13+ call sites in useShop.js and useGameRun.js
- **Root cause:** Legacy 5-coin shop was deleted 2026-04-13, but the persistence hooks were left as no-ops to keep call sites valid. The legacy single-battle flow is gone — there is no longer a non-run shop to persist.
- **Fix:** Remove the stubs from useAuth.js, the constructor parameter from useShop/useGameRun, and all call sites. Dead code removal.

### Bug G: Bag deactivation test asserts "no crash" but not behavior (NEW)

- **Symptom:** `coverage-gaps.spec.js` tests that deactivating a non-empty bag doesn't crash, but doesn't assert the correct outcome (error message shown, bag remains active).
- **Root cause:** Test written conservatively before behavior was finalized.
- **Fix:** Align test assertion with actual behavior: verify the error message appears and the bag stays active.

---

## 2. Architecture Issues

### Issue 1: Test isolation — shared DB across parallel workers

**Status:** Mitigated (`workers: 1`) but not solved. Tests run ~3× slower than they could.

**Plan (Phase 3):** Per-worker SQLite databases. Each worker gets `SQLITE_STORAGE=tmp/test-worker-${workerIndex}.sqlite` and its own Express port (`3321 + workerIndex`). The `globalSetup` pre-builds the Vite bundle once; each worker's `beforeAll` starts its own backend.

### Issue 2: Monolithic `main.js` (~450 lines in setup)

All screen routing, composable wiring, watchers, and handlers live in one `setup()` function. Hard to navigate and debug.

**Plan (Phase 3):** Extract screen-specific handlers and dev-only screens into separate modules. Keep `main.js` as the orchestrator: state declaration, composable init, template.

### Issue 3: Monolithic `styles.css` (2,855 lines)

**Plan (Phase 3):** Split into per-screen CSS files: `prep.css`, `replay.css`, `home.css`, `auth.css`, `shared.css`. Import from `main.js` or individual page components.

### Issue 4: Single reactive state object (50+ fields)

Low priority. Works fine at current scale. Revisit when adding new game modes.

---

## 3. UX Improvements

### Phase 2: High-Impact UX

| # | Issue | Screen | Fix |
|---|-------|--------|-----|
| U1 | No feedback on invalid loadout at Ready | Prep | Show server validation error as actionable toast (budget exceeded, overlap, etc.) |
| U2 | Round result is sparse | Replay | Add opponent portrait, mushroom names, and loadout stat summary to the inline rewards card |
| U3 | Sell zone is plain text | Prep | Add sell icon, drag-over highlight with price preview, visual feedback |
| U4 | Shop items lack visual hierarchy | Prep | Price-tier border styling (1-coin: default, 2-coin: accent, 3-coin: gold), bag highlight |

### Phase 4: Polish

| # | Issue | Fix |
|---|-------|-----|
| U5 | No purchase animation | CSS flash animation on container item when bought |
| U6 | No bag expansion animation | Slide-down animation when bag rows appear |
| U10 | `prefers-reduced-motion` not wired | Add `@media (prefers-reduced-motion)` rules and honor `reducedMotion` setting |
| U11 | Hard-coded i18n strings | Replace inline ternaries with `t.key` pattern |
| U12 | No pluralization | Add basic plural helper for Russian (1/2-4/5+) |

---

## 4. Fix Plan — Status

### Phase 0: Critical Fixes (COMPLETED)

1. **Fix DB reset race condition** — `workers: 1` in playwright.config.js. **28/28 pass.**
2. **Align round-result flow** — Tests and code aligned (inline replay rewards).
3. **Fix "Authentication required" flash** — Suppress 401 errors during bootstrap.
4. **Update mushroom count assertions** — 6 mushrooms including Dalamaru.
5. **Add loading state to Ready button** — Pulsing "Loading..." during `actionInFlight`.
6. **Enrich replay rewards card** — Wins + lives on the inline rewards card.
7. **Differentiate win/loss in history** — Green/red/gold border-left styling.
8. **Auto-dismiss errors** — 5-second watcher clears `state.error`.
9. **Extract shared E2E helpers** — `e2e-helpers.js` with ~200 lines deduplicated.

### Phase 1: Bug Fixes (IN PROGRESS)

10. **Fix wiki detail JSON parse error** — WikiScreen emits array instead of separate args.
11. **Remove legacy `persistShopOffer` stubs** — Dead code removal across useAuth, useShop, useGameRun, main.js.
12. **Align bag deactivation test** — Assert error message + bag remains active in coverage-gaps.spec.js.

### Phase 2: High-Impact UX

13. **Actionable loadout validation feedback** — Surface server error details on Ready failure.
14. **Enrich round result display** — Opponent portrait + mushroom names + stat summary.
15. **Redesign sell zone** — Icon + drag-over highlight + price preview.
16. **Shop item visual hierarchy** — Price-tier styling (border + badge).

### Phase 3: Architecture

17. **Per-worker test isolation** — Separate SQLite files + Express ports per Playwright worker.
18. **Split main.js** — Extract handlers into focused modules.
19. **Split styles.css** — Per-screen CSS files.

### Phase 4: Polish

20. **Purchase animation** — CSS flash on container item.
21. **Bag expansion animation** — Slide-down for new bag rows.
22. **Wire `prefers-reduced-motion`** — Respect OS setting + in-app toggle.
23. **i18n cleanup** — Replace inline ternaries, add basic pluralization.
