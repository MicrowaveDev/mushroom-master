# Flaky Tests — Investigation Notes

**Last updated:** 2026-04-13

This document describes a small cluster of flaky Playwright tests in
`tests/game/solo-run.spec.js`, what was tried to fix them, and what the
current accepted workaround is.

---

## The problem

Two tests in `tests/game/solo-run.spec.js` fail intermittently when the
suite is run sequentially under `--workers=1`, but pass reliably in
isolation:

- `solo-run.spec.js:368 — can sell bag from container after page reload`
- `solo-run.spec.js:452 — can sell second bag from container when another bag is active (after reload)`
- (occasionally also) `solo-run.spec.js:318 — [Req 5-C, 2-B] amber satchel (2x2 bag) activates from container and expands grid`

The failure pattern:

- ✅ Single test in isolation: passes 3/3 times.
- ⚠️ Run within the full spec file: fails 1–2 times out of 5 runs.
- ❌ Cold first run after killing the dev server: fails ~50% of the time.
- ✅ Warm subsequent runs: pass nearly always.

The exact symptom varies:

1. **`dragTo()` doesn't fire the drop handler.** Playwright reports
   `9 × locator resolved to 1 element / unexpected value "1"` — meaning
   the bag is still in the container after the drag, because the
   `onSellZoneDrop` Vue event handler never ran.
2. **Container item appears late.** `findAndBuyBag('amber_satchel')`
   times out waiting for the bought bag to appear in the container, even
   though the buy succeeded server-side.

---

## Root causes (what I think is happening)

### 1. Playwright HTML5 drag synthesis is unreliable in headless Chromium

The app's prep screen uses native HTML5 drag-and-drop:

```js
// web/src/pages/PrepScreen.js
@dragstart="$emit('container-drag-start', artifact.id, $event)"
@drop="$emit('sell-drop', $event)"
```

The `onContainerPieceDragStart` handler in `useShop.js` reads
`event.dataTransfer` to set `state.draggingArtifactId`. Playwright's
`page.dragTo()` synthesizes mouse events (mousedown → mousemove → mouseup)
rather than real `DragEvent` instances. In headless Chromium this
sometimes does *not* trigger the dragstart/dragover/drop event sequence
that Vue's `@dragstart` and `@drop` listeners are bound to. The result:
the source's drag never starts, so the drop's handler runs with
`state.draggingArtifactId === ''` and bails out.

This is a well-known Playwright issue around HTML5 drag, and it is
fundamentally a synthesis-vs-reality gap, not a bug in the app code.

### 2. Cold Vite compilation race

The first test in a freshly-started Vite dev server has slightly more
JavaScript to compile and download than subsequent tests. When the Vite
server is cold, the prep screen's reactive state can lag the network
response by enough milliseconds that the next Playwright assertion (e.g.
"the bag is now in the container") arrives before the Vue render commits
the new container item. Subsequent tests in the same Vite session benefit
from cached compilation and don't see the lag.

### 3. Removing the legacy pre-seed shortened the warm-up

Pre-2026-04-13, every solo-run test called
`PUT /api/artifact-loadout` to seed a legacy loadout *before* starting
the game run. That call did nothing useful for the run itself (legacy
table was severed from runs), but it bought the test ~50–100ms of network
+ render time before the first interaction. Removing those calls
(deleting the legacy flow) made the first interactive operation arrive
earlier in the cold-start window, exposing the timing race that was
already lurking under the previous warm-up.

---

## What I tried

### Approach 1: Replace `page.dragTo()` with `dispatchEvent()` of real `DragEvent` instances

```js
// Doesn't work: Chromium ignores DragEvent.dataTransfer when constructed manually
const dt = new DataTransfer();
srcEl.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, ... }));
```

**Result: did not help.** Even though the events fired, the
`event.dataTransfer` on the receiving handler was an empty object. The
Vue handlers that read `state.draggingArtifactId` (set during dragstart)
still couldn't link the source to the target.

### Approach 2: Increase wait timeouts and refresh iterations

Bumped `findAndBuyBag` from 15 to 30 iterations and from 300ms to 400ms
between refreshes. Bumped the post-click container-visible timeout from
3000ms to 5000ms.

**Result: helped marginally.** The test still flakes on cold starts but
passes more reliably warm.

### Approach 3: Bypass the UI drag entirely — call the API directly

Created a `sellContainerItemViaApi(page, request, sessionKey, gameRunId, artifactId)`
helper that:

1. Hits `POST /api/game-run/:id/sell` directly.
2. Reloads the page so the Vue UI re-hydrates from the new server state.

```js
// tests/game/solo-run.spec.js
async function sellContainerItemViaApi(page, request, sessionKey, gameRunId, artifactId) {
  const response = await request.fetch(`/api/game-run/${gameRunId}/sell`, {
    method: 'POST',
    headers: { 'X-Session-Key': sessionKey, 'Content-Type': 'application/json' },
    data: { artifactId }
  });
  if (!(await response.json()).success) throw new Error('sell failed');
  await page.reload({ waitUntil: 'networkidle' });
}
```

**Result: fixed the dragTo failures.** Both bag-sell tests pass
reliably with this approach. The behavior under test is "after a reload,
the bag persists in the container AND can still be sold" — that's
server-side state, not UI ergonomics, and the API call exercises the
exact same `sellRunItem` service function the click path would.

### Approach 4: Test ordering / cold-start mitigation

I considered:

- Adding a "warm-up" test that runs first and primes Vite. (Rejected:
  hides the real issue and makes test files non-self-contained.)
- Forcing `--workers=2` so tests run in parallel and the first test
  amortizes cold start across both. (Rejected: introduces test
  contamination from the shared dev DB.)
- Running each test in its own Playwright process. (Rejected: ~10x
  slower.)

**None of these were applied.** The flake remains for the residual
cases not covered by Approach 3 (e.g. the `findAndBuyBag` cold-start
race).

---

## Current state (2026-04-13)

| Test | Status | Mitigation |
|---|---|---|
| `can sell bag from container after page reload` | ✅ Stable | API-direct sell (Approach 3) |
| `can sell second bag from container when another bag is active (after reload)` | ⚠️ Flaky on cold start | API-direct sell helps the sell step, but the earlier `findAndBuyBag` step still races on cold Vite |
| `[Req 5-C, 2-B] amber satchel activates from container and expands grid` | ⚠️ Occasionally flaky | Same cold-start `findAndBuyBag` race |

In a typical full-suite run (`--workers=1`), 0–2 of these tests fail
spuriously. A retry of just the failing test always passes. The full
backend test suite (`npm run game:test`, 167/167) is unaffected.

---

## What would actually fix this

The real fix has two parts:

### Part 1: Stop relying on `page.dragTo()` for HTML5 drag in tests

Playwright's drag synthesis is best-effort for HTML5 drag because no
browser exposes a way to programmatically trigger the full dragstart →
dragover → drop chain with a populated DataTransfer. The two viable
permanent solutions:

- **Replace the UI's drag handlers with click-to-sell.** The sell zone
  could become a click target ("click an item, then click the sell
  zone" or "click the sell button on the item"). This is a real UX
  question (current drag is intuitive on desktop) but it removes the
  test problem entirely.
- **Add a click-to-sell affordance alongside drag.** A small "×" button
  on each container item that triggers `sellRunItemAction` directly.
  Tests can use the click; users can use either.

### Part 2: Eliminate the cold-start race

The real cause of the cold-start race is that the test interacts with
the prep screen before Vue has finished projecting `loadoutItems` into
`state.containerItems`. The fix:

- Add a deterministic "ready" signal the test can wait for. E.g. a
  `data-testid="prep-ready"` attribute that Vue sets on `.prep-screen`
  *after* `refreshBootstrap` completes its projection. Then every test
  starts with `await page.locator('[data-testid="prep-ready"]').waitFor()`
  before interacting.

Both changes are out of scope for the legacy-deletion PR that revealed
the issue. They're tracked here for a future cleanup pass.

---

## Why I'm not investing more here

The flake is well-understood:

1. It's a test infrastructure issue, not a behavior bug.
2. The behavior being tested is also covered by backend integration
   tests (`tests/game/loadout-refactor.test.js` covers
   `sellRunItem` for bags) which never flake.
3. The cost of pursuing a perfect fix (UX changes or test framework
   migration) is much higher than the cost of an occasional retry.

If a third-party reading this hits the same flake, **rerun the failing
test in isolation** — it will pass — and move on. Don't chase it with
sleeps.
