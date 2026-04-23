# Task Spec — HTML5 UX Optimization V1

## Original Task Statement

User asked to (a) analyze the mushroom-master plan and research how to make the in-game UX more responsive and attractive using HTML5 technologies, then (b) "write the plan to md and implement it."

The plan doc lives at [`docs/html5-ux-optimization-plan.md`](../../../docs/html5-ux-optimization-plan.md). This task covers **V1 only** — the foundational changes shipped in the same pass the plan lands. V2 (canvas replay flourishes, hit reactions) and V3 (skeleton screens, `content-visibility`) are explicitly deferred.

## Acceptance Criteria

IDs are stable and referenced from evidence.json.

- **AC1** — `useReducedMotion` ref is `true` when `matchMedia('(prefers-reduced-motion: reduce)').matches` is `true`, regardless of in-app setting.
- **AC2** — `useReducedMotion` ref is `true` when `state.bootstrap.settings.reducedMotion` is `true`, regardless of system preference.
- **AC3** — Changing either source at runtime updates the ref (no reload).
- **AC4** — Composable is SSR-safe (importing the module does not throw in an environment without `window`).
- **AC5** — Unit tests cover the four quadrants of system × app preference.
- **AC6** — `.artifact-grid-board` declares `container-type: inline-size`; a 3×3 board inside a 120px container produces sub-40px cells, inside a ~400px container produces cells at or near `44px`, driven by `clamp()` + `cqw`, not viewport media queries.
- **AC7** — Cell size is consistent across inventory and shop-item mini boards when their containers share a width.
- **AC8** — Existing prep/home/replay screenshot baselines do not regress.
- **AC9** — On a browser with `startViewTransition` available and reduced-motion **off**, a screen change from `home` to `prep` runs a ~180ms cross-fade. On a browser without the API, the same change runs instantly with no animation.
- **AC10** — When `prefersReducedMotion` is `true`, `document.startViewTransition` is not called; the transition is instant.
- **AC11** — `window.scrollTo(0, 0)` still fires after every screen change, inside or outside a transition.
- **AC12** — Existing game tests pass without modification.

## Constraints

- No new runtime dependency. Vue 3 + browser primitives only.
- No canvas, no WebGL in V1.
- No `v-html`, no string-injection rendering.
- Must preserve existing Pointer Events drag path (`useTouch.js`).
- Must preserve existing haptic feedback wiring.
- Must not break non-Telegram (browser/dev) mode.

## Non-Goals

- Skeleton screens (V3).
- Canvas replay overlay (V2).
- Optimistic UI on shop buy/sell (separate follow-up).
- View transitions for list-item reorder *inside* a screen (stretch; only applies to route-level in V1).

## Open Assumptions

- Telegram WebView on iOS + Android has `startViewTransition` in 2026. Feature detection gates correctness.
- System `prefers-reduced-motion` is the dominant signal; in-app setting is additive.

## Verification Plan

- Unit tests for `useReducedMotion` in `tests/web/use-reduced-motion.test.js`.
- `npm run game:test` for the backend + unit suite.
- `npm run game:build` to verify the Vite bundle builds with the new modules.
- Manual browser check for the View Transitions animation (captured as note in `evidence.md`, since Playwright doesn't assert animation).
- Screenshot regression is out-of-scope for this pass (no layout change is intended); if a screenshot test fails it's a bug.
