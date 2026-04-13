# Flaky Tests — Investigation & Fix

**Last updated:** 2026-04-13

This document describes a cluster of flaky Playwright tests in
`tests/game/solo-run.spec.js`, the three root causes that were identified,
and the fixes that were landed.

---

## The symptoms (before the fix)

Three tests in `tests/game/solo-run.spec.js` failed intermittently when the
suite was run under `--workers=1`, but passed reliably in isolation:

- `solo-run.spec.js — [Req 5-C, 2-B] amber satchel (2x2 bag) activates from container and expands grid`
- `solo-run.spec.js — can sell bag from container after page reload`
- `solo-run.spec.js — can sell second bag from container when another bag is active (after reload)`

Failure rate was highest on **cold** first runs after killing the dev
server (~50%) and dropped to occasional on warm reruns.

---

## Root causes

Three independent issues stacked together.

### 1. Playwright HTML5 drag synthesis is unreliable in headless Chromium

Playwright's `page.dragTo()` synthesizes mouse events (mousedown →
mousemove → mouseup) rather than real `DragEvent` instances. In headless
Chromium this sometimes does *not* trigger the `dragstart` → `dragover`
→ `drop` chain the app's `@dragstart` / `@drop` handlers are bound to.
When it fails, `state.draggingArtifactId` is empty at drop time and
`onSellZoneDrop` bails silently.

This is a well-known Playwright issue around HTML5 drag. It is not a bug
in the app code.

### 2. Cold Vite compilation race

The Playwright harness was running against `vite dev`. The first test in
a freshly-started Vite session pays an on-demand compile + module graph
resolution cost that warm tests don't. During that window, the prep
screen's reactive state could lag the network response by enough
milliseconds that Playwright's next assertion arrived before Vue
committed the new container item.

### 3. No deterministic "prep ready" signal

Tests waited for `.prep-screen` to be visible, then interacted. But the
`.prep-screen` element exists as soon as the route mounts — *before*
`refreshBootstrap` finishes projecting `loadoutItems` into
`state.containerItems`. The UI was reachable, but not *ready*.

On top of that, the `findAndBuyBag` helper in solo-run.spec.js polled
the shop up to 30 times with 400ms sleeps, hoping RNG + pity would
eventually roll the target bag. That polling loop was the longest
window in which the cold-start race could land.

---

## The fix (landed 2026-04-13)

All three root causes are addressed:

### Fix 1 — Serve a prebuilt bundle for Playwright

[tests/game/playwright.config.js](../tests/game/playwright.config.js) no
longer runs `vite dev`. It runs `vite build && vite preview`, so the
frontend is served as a static bundle with no on-demand compilation.
[web/vite.config.js](../web/vite.config.js) gained a `preview.proxy` block
that mirrors the dev proxy so `/api` and `/data` still reach the backend.

Cost: one-time ~20-30s `vite build` per test run.
Benefit: every test sees an identical warm load — the cold-Vite race is
gone at the source.

The dev workflow (`npm run game:start`) is unchanged and still uses
`vite dev` with HMR.

### Fix 2 — Deterministic `prep-ready` data-testid

[web/src/composables/useAuth.js](../web/src/composables/useAuth.js)
exposes a new `state.bootstrapReady` flag. It is set to `false` at the
start of `refreshBootstrap` and flipped to `true` in the `finally`
block, *after* `loadoutItems → containerItems` projection completes.

[web/src/pages/PrepScreen.js](../web/src/pages/PrepScreen.js) sets
`data-testid="prep-ready"` on the `.prep-screen` root element, bound to
`state.bootstrapReady`.

Tests use a `waitForPrepReady(page)` helper that awaits the testid.
Every entry point and reload in `solo-run.spec.js` now uses this
instead of the old `.prep-screen` visibility check.

### Fix 3 — Test-only `force-shop` dev endpoint

`findAndBuyBag`'s polling loop is deleted. In its place, a new dev-only
endpoint deterministically overwrites the current round's shop offer:

```
POST /api/dev/game-run/:id/force-shop
Body: { artifactIds: ["amber_satchel"] }
```

Implementation: [run-service.js `forceRunShopForTest`](../app/server/services/run-service.js)
updates `game_run_shop_states.offer_json` directly. No coins are
charged, no `refresh_count` is incremented. Gated behind
`process.env.NODE_ENV !== 'production'` at the route layer, same
pattern as `/api/dev/reset`.

The spec helper `forceShopAndBuy(page, request, sessionKey, gameRunId, artifactId)`
calls this endpoint, reloads the page (so the UI re-hydrates with the
new offer), waits for prep-ready, then clicks the target shop item to
exercise the real buy flow.

### Fix 4 — `retries: 1` safety net

[tests/game/playwright.config.js](../tests/game/playwright.config.js) now
configures `retries: 1`. This is not a fix — it's a shock absorber for
any residual flake while the root-cause fixes bed in.

---

## What was *not* done, and why

- **Click-to-sell affordance.** The doc originally proposed adding a
  click target for selling container items, to eliminate the HTML5 drag
  dependency from tests. Not needed: the bag-sell tests use
  `sellContainerItemViaApi()` which hits the same `sellRunItem` service
  the click path would. Drag remains under test in the "full journey"
  test where it has always worked reliably (the flake was only in the
  container → sell-zone drop case).
- **Per-worker DB isolation for parallel runs.** The dev backend is
  still single-instance. Parallelizing Playwright would require
  DB-per-worker, which is a bigger refactor with no flake payoff now
  that the root causes are fixed.

---

## Operating note

If a flake reappears after this fix, investigate — don't retry-and-move-on.
The three root causes are now addressed at the source, so any new flake
likely points at a fourth cause that should be understood before it
accretes into the pile this doc used to describe.
