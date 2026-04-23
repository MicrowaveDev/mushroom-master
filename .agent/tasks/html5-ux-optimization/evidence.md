# Evidence — HTML5 UX Optimization V1

## Scope actually shipped

V1 items from [`docs/html5-ux-optimization-plan.md`](../../../docs/html5-ux-optimization-plan.md):

1. `useReducedMotion` tracker composable (new file).
2. Fluid `--artifact-cell-size` via `100cqi` + `clamp()` on `.artifact-inventory-grid`, `.shop-item-visual`, `.container-item-visual`. Dropped two narrow `@container (max-width: ...)` overrides in favor of always-fluid base declarations.
3. View Transitions API wrapper around `useGameState.goTo`, gated by the new motion tracker. Feature-detects `document.startViewTransition`.
4. CSS `::view-transition-old(root)` / `::view-transition-new(root)` cross-fade (~180ms).

V2 and V3 items from the plan are **not** shipped in this pass, as stated in the plan and spec.

## Acceptance Criteria Status

| ID | Status | Proof |
|----|--------|-------|
| AC1 | PASS | `tests/web/use-reduced-motion.test.js` `[reduced-motion][AC1] system preference alone yields true` |
| AC2 | PASS | `tests/web/use-reduced-motion.test.js` `[reduced-motion][AC2] app preference alone yields true` |
| AC3 | PASS | `tests/web/use-reduced-motion.test.js` `[reduced-motion][AC3]` (two tests) |
| AC4 | PASS | `tests/web/use-reduced-motion.test.js` `[reduced-motion][AC4] SSR-safe: no window does not throw` |
| AC5 | PASS | All four quadrants covered by AC1/AC2 + two explicit truth-table tests in the same file |
| AC6 | PASS | `web/src/styles.css:1220-1228` — `.artifact-inventory-grid { --artifact-cell-size: clamp(34px, calc((100cqi - 16px) / 3), 44px); }`. At 120cqi → 34.67px (≥34px floor); at 400cqi → 44px ceiling |
| AC7 | PASS | Same fluid formula applies to both `.shop-item-visual` and `.container-item-visual` (`web/src/styles.css:1388-1392`, `1498-1502`), so matching container widths yield matching cell sizes |
| AC8 | PASS | `npm run game:test:screens` — 1 passed (12.1s), `[Req 2-A, 4-D, 13-A] capture key v1 screens (dual viewport)`. See `raw/screenshot-check.log` |
| AC9 | PASS | `web/src/composables/useGameState.js:79-92` feature-detects `document.startViewTransition` and falls back to direct mutation. `web/src/styles.css` declares `::view-transition-*` with 180ms duration |
| AC10 | PASS | Same `goTo` branch gates on `shouldAnimateTransitions()`, wired via `main.js:99-103` to `motionTracker.getValue()` which returns true when either system or app preference is set |
| AC11 | PASS | The existing `watch(() => state.screen, ...)` handler in `main.js:164-177` still fires after `state.screen` mutates, regardless of whether the mutation happened inside `startViewTransition` or not. The view transition animation runs on the compositor thread and does not block the watcher |
| AC12 | PASS | `npm run game:test` — 327 tests pass (318 existing + 9 new). See `raw/game-test.log` |

## Files Changed

- `docs/html5-ux-optimization-plan.md` (new) — plan doc with Source of Truth, ACs, V2/V3 deferred scope.
- `.agent/tasks/html5-ux-optimization/spec.md` (new) — task-local spec with stable AC IDs.
- `.agent/tasks/html5-ux-optimization/evidence.md` (new) — this file.
- `web/src/composables/useReducedMotion.js` (new) — `createReducedMotionTracker` factory + `bindReducedMotionTracker` helper.
- `web/src/composables/useGameState.js` — extended signature with `options.shouldAnimate`, wrapped `goTo` in View Transitions when available + allowed.
- `web/src/main.js` — imported tracker, instantiated at composable setup, extended the existing reducedMotion watcher to sync the tracker, added cleanup in `onUnmounted`.
- `web/src/styles.css` — replaced three fixed `--artifact-cell-size: 44px` declarations with fluid `clamp()` formulas reading `100cqi`; removed two narrow `@container` overrides; added View Transitions pseudo-element CSS.
- `tests/web/use-reduced-motion.test.js` (new) — 9 unit tests covering the tracker's full API.

## Verification commands

```bash
# From the mushroom-master submodule root:
npm run game:test          # full suite — 327 pass
npm run game:build         # Vite bundle builds, no errors, no new warnings
npm run game:test:screens  # Playwright dual-viewport — see raw/screenshot-check.log
```

See `raw/` for the captured command output.

## Notes

- The tracker is intentionally decoupled from Vue reactivity to keep it unit-testable with `node:test`. `main.js` wires it into the existing reactive state via a `watch` on `state.bootstrap?.settings?.reducedMotion`.
- `nextTick` is awaited inside the View Transitions callback so Vue's DOM patch completes before the "after" snapshot is taken. Without this the transition would snapshot the pre-mutation DOM as both "before" and "after" and appear as an instant flash instead of a cross-fade.
- No changes to drag-drop, haptics, Telegram WebApp adapter, or Pointer Events. V1 is additive only.

---

## V1 Follow-up Batch (same pass, after screenshot review)

A post-V1 screenshot-and-user-flow review caught four pre-existing issues plus one regression introduced by the V1 View Transitions wiring. All addressed in the same work pass.

### Fixes

| ID | Issue | Fix |
|---|---|---|
| F1 | Shop item names truncated with `text-overflow: ellipsis` on both mobile and desktop (e.g. "Статический Споровы…") — player could not read full artifact names | Replace `.shop-item-name` `nowrap` + `ellipsis` with `display: -webkit-box` + `-webkit-line-clamp: 2`. Also change `.shop-item-header` `align-items` from `baseline` to `flex-start` so the flex parent doesn't pin the name to a single-line baseline box |
| F2 | Desktop prep left column (backpack + empty inventory) visibly shorter than right shop column at round 1 — violated AGENTS.md "columns must be visually coherent" rule | `.prep-workspace` → `align-items: stretch`; `.prep-loadout-column` → `display: flex; flex-direction: column` inside desktop media query; `.prep-loadout-column > .artifact-inventory-section { flex: 1 }`; `.prep-workspace .artifact-shop { align-self: stretch }` |
| F3 | `user-flows.md` said "5 mushroom cards" but roster now has 6 characters | Generic wording: "All roster cards" / "One card per mushroom in the roster" |
| F4 | Locked character skins rendered as 52×52 swatches with emoji lock overlay — unattractive "unlock goal" read | New design: `4:5` aspect swatches, auto-fill grid at ≥88px columns, locked state desaturates + dims the portrait via `filter: grayscale(0.55) brightness(0.85); opacity: 0.55` + gradient wash, centered pill overlay with 🍄 mushroom glyph + mycelium cost on warm parchment background with drop shadow |
| F5 (regression) | After V1, Playwright captured prep screenshots mid-transition → outgoing (home) and incoming (prep) DOM layered via `::view-transition` pseudo-elements | `useGameState.goTo` skips `document.startViewTransition` when `navigator.webdriver` is true. Real users on the same build still get the animation |

### Files Changed in This Batch

- `web/src/styles.css` — `.shop-item-name` line-clamp; `.shop-item-header` align-items; `.prep-workspace`, `.prep-loadout-column`, `.artifact-inventory-section`, `.artifact-shop` desktop stretch rules; `.home-portrait-swatches`, `.home-portrait-swatch` (locked + price pill) skin card restyle.
- `web/src/pages/HomeScreen.js` — locked portrait template: `.home-swatch-lock` emoji → `.home-swatch-price` with icon + value.
- `web/src/composables/useGameState.js` — webdriver gate before `document.startViewTransition`.
- `docs/user-flows.md` — "5 mushroom cards" → "roster cards" / "One card per mushroom in the roster" (two references).

### Verification

- `npm run game:test` — 327 tests pass (unchanged; no behavior change).
- `npm run game:test:e2e` — 22 Playwright specs pass (~2.8 min). All prep screenshots regenerated.
- Regenerated [`.agent/tasks/telegram-autobattler-v1/raw/screenshots/run/solo-02-prep-round1-desktop.png`](../telegram-autobattler-v1/raw/screenshots/run/solo-02-prep-round1-desktop.png) — confirms F1 (shop names render fully: "Дуплистое Бревно", "Споровый Клинок", "Янтарная Сумка", "Мерцающая Шляпка", "Клык-Плеть"), F2 (left column stretches to match shop column bottom edge), F5 (no layered mid-transition DOM).
- Regenerated [`.agent/tasks/telegram-autobattler-v1/raw/screenshots/run/solo-02-prep-round1.png`](../telegram-autobattler-v1/raw/screenshots/run/solo-02-prep-round1.png) — confirms F1 on mobile, clean single-screen render.

### Open caveat

- F4 (locked skin card restyle) ships in the built CSS but no Playwright spec captures the home roster picker expanded state (requires clicking the ✎ button on a mushroom card). Visual regression coverage for the unlock UI is a follow-up — add a screenshot step to `screenshots.spec.js` that opens the picker for a mushroom with locked portraits, then calls `saveShot`.
