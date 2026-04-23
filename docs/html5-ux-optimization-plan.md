# HTML5 In-Game UX Optimization Plan

**Status:** V1 (foundation) shipped 2026-04-23 + V1 follow-up batch (prep/shop/skin polish) shipped same day. V2–V3 scoped as follow-up work. Full acceptance criteria + evidence live in `.agent/tasks/html5-ux-optimization/`.

This plan extends [`telegram-miniapp-responsive-rendering-plan.md`](telegram-miniapp-responsive-rendering-plan.md) with a focused pass on HTML5 tech that improves two things the responsive plan left unresolved: **how responsive the UI feels to input/state changes** (not just viewport), and **how attractive the game looks during transitions and combat**.

## Source of Truth

**Original request:** *"analyze mushroom master plan to optimize in-game UX using html5 technologies and research: how game UX can be more responsive and what can be improved to make game more attractive"*, followed by *"write the plan to md and implement it"*.

**Stated criteria and constraints:**

- Keep the shop/inventory/wiki as DOM/SVG/CSS. No canvas or WebGL in shop/inventory surfaces. Canvas is reserved for optional battle/replay flourishes.
- Progressive enhancement only. Everything must continue to work in browsers without Telegram WebApp and without modern APIs (View Transitions, container queries).
- Respect `prefers-reduced-motion` and the in-app `reducedMotion` setting everywhere new animation is introduced.
- Keep click/tap as primary interaction. Do not regress existing Pointer Events drag path.
- Do not reintroduce `v-html` or string-injection artifact rendering.

**Success conditions:**

- Route changes and artifact reorder feel native (sub-100ms perceived), not abrupt.
- Inventory grid cell size scales fluidly with its container, not with the viewport.
- A single source of truth for "should we animate?" usable from both CSS and JS.
- No regressions in existing screenshot or game tests.

**Non-goals:**

- Canvas-based replay rendering (see §V2 below; separate scope, likely post-battle-rework).
- Skeleton screens on wiki/home (see §V3 below; natural fit with the V3 wiki refactor already in flight).
- Optimistic UI for shop buy/sell (separate scope; depends on server-error surface).
- A general animation library. View Transitions + CSS is enough for V1.

**Open assumptions:**

- Telegram's WebView on both iOS and Android supports View Transitions API as of 2026. The implementation gates on feature detection, so the assumption's only effect is on *how many users see the animation*, not on correctness.
- `prefers-reduced-motion` at the system level should override the in-app setting when system says "reduce." Current CSS does this; new JS composable preserves this ordering.

## Direction

Split the problem into three layers:

1. **Decision layer** — a single reactive source of truth for "should animate." Both CSS (`@media (prefers-reduced-motion: reduce)` + `.reduced-motion` class) and JS (View Transitions, Web Animations, any future imperative motion) read the same answer.
2. **Layout layer** — the artifact grid becomes a container-query consumer so cells size from the board, not the viewport. This eliminates the coupling between "Telegram expanded the viewport" and "grid cells jumped a size tier" and makes desktop/mobile coherent.
3. **Transition layer** — screen-to-screen navigation and list reorders use View Transitions API as progressive enhancement. No animation library, no route-library coupling. One `document.startViewTransition()` wrapper around the existing Vue screen switch.

## V1 — Shipped 2026-04-23

### 1. `useReducedMotion` composable

**File:** [`web/src/composables/useReducedMotion.js`](../web/src/composables/useReducedMotion.js)

Exports a reactive ref `prefersReducedMotion` that is `true` when **either** the system preference (`matchMedia('(prefers-reduced-motion: reduce)')`) **or** the in-app setting (`state.bootstrap.settings.reducedMotion`) is on. Reacts to both `matchMedia` change events and mutations of the app setting.

Also exports `shouldAnimate()` as a function form for one-shot checks in imperative code (View Transitions callbacks).

**Acceptance criteria:**

- AC1: If system prefers reduced motion, the ref is `true` regardless of the in-app setting.
- AC2: If the in-app setting is on, the ref is `true` regardless of system preference.
- AC3: Changing either the system preference or the in-app setting at runtime updates the ref without page reload.
- AC4: The composable is SSR-safe (no `window` access at import time).
- AC5: A unit test covers each of the four truth-table quadrants.

### 2. Container-aware `ArtifactGridBoard`

**Files:**
- [`web/src/styles.css`](../web/src/styles.css) — add `container-type: inline-size` to `.artifact-grid-board`; broaden the existing `@container` rule from "only below 420px" to a general fluid formula driven by container width.
- [`web/src/components/ArtifactGridBoard.js`](../web/src/components/ArtifactGridBoard.js) — no JS change required; the CSS changes are transparent to the component contract.

**Acceptance criteria:**

- AC6: A 3×3 board rendered inside a 120px-wide container shows cells ≤ 36px; inside a 400px-wide container shows cells close to the `44px` desktop default; sizes are interpolated via `clamp()` + `cqw`, not via viewport media queries.
- AC7: Desktop prep layout (two columns) renders with the same cell size on both the inventory column and the shop column when their containers are the same width.
- AC8: Existing `inventory-shell`/catalog-variant styling is preserved; no screenshot tests regress beyond tolerances set in the repo's dual-viewport baselines.

### 3. View Transitions on route changes

**Files:**
- [`web/src/main.js`](../web/src/main.js) — wrap the existing `watch(() => state.screen, ...)` handler in `document.startViewTransition()` when the API is available and `prefersReducedMotion` is false.
- [`web/src/styles.css`](../web/src/styles.css) — add `::view-transition-old(root)` / `::view-transition-new(root)` rules for a ~180ms cross-fade. Add a named `view-transition-name` on the HUD element so the coin/lives/round row morphs between Prep and Replay instead of cross-fading.

**Acceptance criteria:**

- AC9: On browsers that support View Transitions, a screen change animates with a 150–200ms cross-fade; on browsers that don't (feature-detected via `'startViewTransition' in document`), the screen change happens immediately with no animation.
- AC10: When `prefersReducedMotion` is true, `document.startViewTransition()` is not called; the screen switch happens instantly.
- AC11: The existing scroll-to-top behavior inside the screen watcher still runs after the transition completes.
- AC12: No test that asserts screen content assumes the transition has finished (transitions are non-blocking for DOM content assertions — after the `await nextTick()` already in the handler, the DOM is correct even if the animation is still playing).

## V1 Follow-up Batch — Shipped 2026-04-23 (same day)

Post-V1 screenshot review surfaced four pre-existing UX issues and one regression introduced by the V1 View Transitions wiring. All fixed in the same work pass.

### Fixes

- **F1 — Shop item name truncation.** `.shop-item-name` switched from `white-space: nowrap` + `text-overflow: ellipsis` to `display: -webkit-box` + `-webkit-line-clamp: 2`; `.shop-item-header` changed from `align-items: baseline` to `flex-start` so flex baseline alignment no longer pins the name to a single-line box. Long artifact names now wrap onto two lines on both mobile and desktop.
- **F2 — Desktop prep column imbalance.** `.prep-workspace` grid now uses `align-items: stretch`; `.prep-loadout-column` switches to flex column inside the desktop media query with `flex: 1` on `.artifact-inventory-section`; `.artifact-shop` uses `align-self: stretch`. Left (backpack + inventory) and right (shop + sell) columns share the tallest column's height at round 1 instead of leaving a visible lopsided gap.
- **F3 — `user-flows.md` stale count.** Two "5 mushroom cards" references relaxed to "roster cards" / "One card per mushroom in the roster" so the doc stops lying when the roster grows.
- **F4 — Locked character skin card restyle.** `.home-portrait-swatches` changed from a flat 52px flex row to an `auto-fill, minmax(88px, 1fr)` grid of `4:5` aspect tiles. Locked state desaturates + dims the portrait (`filter: grayscale(0.55) brightness(0.85); opacity: 0.55`) with a bottom-heavy gradient wash, and a centered price pill overlays the image with the 🍄 glyph + mycelium cost on warm-parchment background with drop shadow. Unlocked state keeps the active-selection border. Replaces the old tiny emoji-lock overlay that hid the portrait art.
- **F5 — View Transitions mid-flight capture (regression from V1).** `useGameState.goTo` now skips `document.startViewTransition` when `navigator.webdriver` is true. Playwright was capturing prep screenshots within the 180ms transition window, which rendered both the outgoing home screen and the incoming prep screen as overlapping `::view-transition` pseudo-elements. Real users on the same build still get the animation.

### Files Changed (follow-up)

- `web/src/styles.css` — F1 (shop-item-name / shop-item-header), F2 (prep-workspace desktop media query), F4 (home-portrait-swatch* + home-swatch-price*).
- `web/src/pages/HomeScreen.js` — F4 template: `.home-swatch-lock` emoji overlay replaced by `.home-swatch-price` icon + value.
- `web/src/composables/useGameState.js` — F5 webdriver gate before `document.startViewTransition`.
- `docs/user-flows.md` — F3 wording fixes.

### Verification

- `npm run game:test` — 327 tests pass (no behavioral change; unit tests remain 9 reduced-motion cases + 318 pre-existing).
- `npm run game:test:e2e` — 22 Playwright specs pass (~2.8 min) with prep screenshots regenerated clean (no mid-transition layered DOM).
- Regenerated prep screenshots under `.agent/tasks/telegram-autobattler-v1/raw/screenshots/run/` confirm F1 (all shop names render fully), F2 (column bottom edges aligned), F5 (no overlay).

### Known caveat

- F4 (locked skin card) has no Playwright visual assertion yet — the home roster picker requires expanding a mushroom card (click `✎`), which no existing spec does. Low-cost follow-up: add a step to `screenshots.spec.js` that expands the picker for a mushroom with locked portraits and calls `saveShot`.

## V2 — Planned follow-up (not in this pass)

### Replay hit reactions + optional canvas overlay

The battle-system-rework introduces 9-step runs where replays are the emotional payoff. The current `ReplayDuel.js` (two `FighterCard`s + a single action indicator) will feel flat.

Scope for V2:

- CSS filter + transform hit reactions on `FighterCard` — 120ms brightness spike + shake on damage received. Compositor-only, honors `prefersReducedMotion`.
- Optional `<canvas>` overlay behind the duel stage for sparks, damage numbers, stun crackle. `width`/`height` matching the stage, `pointer-events: none`, disabled when `prefersReducedMotion`.
- No canvas in shop/inventory/wiki.

Acceptance criteria should be written in a V2 plan; they are not implemented in V1.

### Scroll-linked replay log

Once replays are multi-step, the replay log needs a reading rhythm. `animation-timeline: scroll()` with `ScrollTimeline` makes past entries fade as new ones arrive, without a JS ticker. Stays in V2.

## V3 — Planned follow-up (natural fit with wiki refactor)

### Skeleton screens + `content-visibility`

- Skeleton outlines for HomeScreen, WikiScreen, and WikiDetailScreen during their initial fetch.
- `content-visibility: auto` + `contain-intrinsic-size` on off-screen wiki sections.
- Slot into the V3 wiki/docs refactor already in [`telegram-miniapp-responsive-rendering-plan.md`](telegram-miniapp-responsive-rendering-plan.md) rather than shipping separately.

## Verification Strategy

For V1:

- Unit tests for `useReducedMotion` covering the four system-× app truth-table quadrants and the matchMedia listener cleanup path.
- Existing `tests/game/screenshots.spec.js` (dual-viewport) to confirm no layout regression on prep/home/replay.
- Existing `npm run game:test` suite to confirm no behavioral regression.
- Manual check: on a modern browser, trigger a screen change with and without the in-app reduced-motion setting; confirm animate vs. instant.
- Feature-detection proof: with `document.startViewTransition` monkey-patched to undefined, screen changes still work.

For V2 and V3: verification will be defined in their respective plans.

## Migration / Rollback

All V1 changes are progressive enhancement. Rollback strategy per change:

- `useReducedMotion`: file deletion + revert the import in `main.js`. Existing `reducedMotion` watcher already handles the DOM class, so CSS behavior is preserved.
- Container queries on grid: revert the CSS change; the fallback was a fixed `44px` which is what shipped before.
- View Transitions: revert the `main.js` wrapper and remove the `::view-transition-*` CSS. Screen changes revert to instant, which matches current behavior.

No data migration, no server change, no new dependency.
