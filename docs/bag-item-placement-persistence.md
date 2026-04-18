# Bag item placement persistence

## Problem

A player enters prep for round 1, buys and activates a bag, places a few
combat artifacts into it alongside base-grid items, clicks Ready, and
watches the battle replay. When the next prep screen opens for round 2,
the inventory is scrambled: items pile into the top-left of the base
grid, the bag's virtual rows render empty, some figures render at
half-cell width, and rotation buttons appear on pieces that should not
have them.

Observed state (user screenshot, 2026-04-18):

- 9 base-grid cells contain 7–10 rendered pieces instead of the expected
  1–3 starter + placed items.
- The active bag chip ("Янтарная сумка") shows at the bottom, but the
  bag's two dashed rows are empty.
- Some pieces overflow into an implicit 4th column that CSS Grid
  materializes at render time.

Round 1 prep looks fine. The corruption only appears from round 2
onwards — i.e. only after one full `Ready → resolveRound → continueToNextRound`
cycle.

## Why it's a *class* of bug, not a one-off

Every bag persistence bug this repo has seen comes from the same
structural tension:

> The client keeps rich per-bag state (activation, rotation, per-slot
> placement) that drives the UI, and the server owns durable truth for
> the loadout grid. If any slice of that state is *only* on the client,
> the next page reload or round transition drops it on the floor.

The canonical fix is: move the slice into a column on
`game_run_loadout_items`, route it through the `PUT /api/artifact-loadout`
full-state sync and the `copyRoundForward` helper, and project it back
onto the client on hydrate.

Prior bugs that fit this shape:

1. **Bag activation** — closed by
   [bag-active-persistence.md](./bag-active-persistence.md). Added the
   `active INTEGER NOT NULL DEFAULT 0` column. Before the fix, every bag
   landed in the container on hydrate because there was no server-side
   signal for "this bag is activated".
2. **Bag rotation** — closed by
   [bag-rotated-persistence.md](./bag-rotated-persistence.md). Added the
   `rotated INTEGER NOT NULL DEFAULT 0` column and plumbed
   `persistRunLoadout` into `rotateBag` (previously a pure client
   mutation). Before the fix, rotating an active bag reset on every
   reload.
3. **Bagged item placement** — this doc. The *item* inside the bag was
   being persisted, but not the item's coordinates *within* the bag's
   virtual rows. See below.

The bag-active and bag-rotated refactors both called out that
`rotatedBags` / activation lives on the loadout row. This fix extends
the same treatment to the `x, y` of bagged items — the last piece of
per-bag layout that was still client-only between writes.

## Root cause

Bagged items (items inside a bag, not the bag itself) live in
`state.builderItems` with virtual `y` coordinates past the base grid:
`y = INVENTORY_ROWS` is the first row of the first active bag,
`y = INVENTORY_ROWS + 1` is the second, and so on. The grid renderer
([`ArtifactGridBoard`](../web/src/components/ArtifactGridBoard.js))
places every piece from `state.builderItems` via
`grid-column: x+1 / span width; grid-row: y+1 / span height`, so valid
coords render inside the bag's row band.

The `PUT /api/artifact-loadout` payload for a bagged item used to omit
the coords entirely:

```js
// web/src/composables/useGameRun.js — before the fix
if (item.y >= INVENTORY_ROWS) {
  const info = activeBagLayout.find(/* ...this item's bag... */);
  if (info) {
    payload.push(withId({
      artifactId: item.artifactId,
      width: item.width, height: item.height,
      bagId: info.bagId
      // no x, no y
    }, item.id));
    continue;
  }
}
```

The server's `applyRunPlacements` reconciler defaults missing coords to
`-1`:

```js
// app/server/services/game-run-loadout.js
proposed.x = Number(entry.x ?? -1);
proposed.y = Number(entry.y ?? -1);
```

So clicking Ready persisted every bagged item as
`(x = -1, y = -1, bag_id = '…')`. Round resolution ran
`copyRoundForward`, which duplicated every column verbatim into the
round N+1 row set. `getActiveGameRun` returned those rows on the next
`refreshBootstrap`, and the projection routed them through the
"`item.bagId` → push into `builderItems` with `item.x`/`item.y`" branch.

`builderItems` then contained bagged entries with `x=-1, y=-1`. Inside
the grid renderer, `grid-column: 0 / span 1` is an invalid line
reference — CSS Grid silently falls through to its auto-placement
algorithm, which fills the next empty cell starting at the top-left of
the explicit grid. Multiple invalid entries stacked into whatever cells
were free around the base-grid starter preset, producing the observed
scramble. Some items also caused an implicit column to materialize
when `span` exceeded the remaining explicit columns, giving the
half-width pieces at the right edge of row 2.

Validation never caught this at write time because
`validateGridItems` filters out bagged items (`!item.bagId`) and
`validateBagContents` doesn't look at `x`/`y` at all — only at
`bagId`, `width`, `height`, and the bag's slot capacity. An `x=-1`
bagged item is "valid" by the server's contract.

## Fix

Two coordinated changes, one per side of the round-trip:

### Client: persist the virtual coords

[`buildLoadoutPayloadItems`](../web/src/composables/useGameRun.js) now
emits `x` and `y` alongside `bagId` when a bagged item is in the
payload:

```js
if (info) {
  payload.push(withId({
    artifactId: item.artifactId,
    x: item.x, y: item.y,
    width: item.width, height: item.height,
    bagId: info.bagId
  }, item.id));
  continue;
}
```

The server already accepts these fields (no validation change needed):

- `validateGridItems` skips bagged items on the filter at the call
  site, so virtual `y >= INVENTORY_ROWS` never trips the "out of
  bounds" check.
- `validateBagContents` is coord-agnostic.
- `applyRunPlacements` writes `proposed.x = entry.x, proposed.y =
  entry.y` with no family-specific branching.

From here forward, a bagged item's placement survives `PUT
/artifact-loadout`, survives `copyRoundForward`, and rehydrates cleanly
on the next prep.

### Client: defuse legacy rows on hydrate

[`projectLoadoutItems`](../web/src/composables/loadout-projection.js)
now detects the legacy shape (`bagId` set and `x < 0` or `y < 0`) and
routes those items into `containerItems` instead of `builderItems`:

```js
if (item.bagId) {
  if (item.x < 0 || item.y < 0) {
    containerItems.push({ id: item.id, artifactId: item.artifactId });
  } else {
    builderItems.push({ /* ... */ });
  }
  // ...
}
```

This handles the in-flight runs that had already persisted broken rows
before the fix shipped. The player sees a clean base grid on the next
reload, the bagged items come back as unplaced container items, and the
*next* Ready writes them with valid coords under the new contract. The
degradation is graceful — no items are dropped — and self-heals on the
next save cycle.

## Architecture

### State ownership after all three bag fixes

Per-bag state now has a single source of truth on each row of
`game_run_loadout_items`:

| Slice                     | Column                | Who writes                                                          |
|---------------------------|-----------------------|---------------------------------------------------------------------|
| Bag is activated          | `active INTEGER`      | `applyRunPlacements`, default 0; copy-forward preserves             |
| Bag is rotated            | `rotated INTEGER`     | `applyRunPlacements`, default 0; `rotateBag` → `persistRunLoadout`  |
| Bag grid coords (sentinel)| `x=-1, y=-1`          | `insertLoadoutItem` normalizes bag rows at the write layer          |
| Bagged item placement     | `x`, `y`, `bag_id`    | `applyRunPlacements` — x, y carry virtual row coords (this fix)     |
| Bagged item footprint     | `width`, `height`     | `applyRunPlacements` — already persisted for rotation support       |
| Bagged item membership    | `bag_id`              | `applyRunPlacements` — references the bag row's `artifact_id`       |

Non-bag grid items use `x, y` directly as base-grid coords
(`0 ≤ y < INVENTORY_ROWS`). Bagged items use `x, y` as virtual coords
past the base grid (`y ≥ INVENTORY_ROWS`). The column does double duty,
and the discriminator is `bag_id IS NOT NULL`.

### Contract: what the `x, y` on a row means

```
bag_id IS NULL     &&  x >= 0             → grid-placed combat artifact
bag_id IS NULL     &&  x = -1 && y = -1   → container (unplaced)
bag_id IS NULL     && family = 'bag'      → bag row; always (-1, -1)
bag_id IS NOT NULL && x >= 0               → bagged item; x, y are virtual bag-row coords
bag_id IS NOT NULL && x < 0 || y < 0       → LEGACY / corrupt; treat as container
```

The last row is the fallback branch the projection handles today. A
future cleanup (see *Non-goals*) could drop it if we run a one-shot
backfill.

### Validation split

The server enforces placement rules in two passes so the two coord
conventions don't collide:

1. `validateGridItems(projected.filter(i => !i.bagId))` — bounds and
   overlap for base-grid items only. Bagged items are excluded by the
   filter, so their `y >= INVENTORY_ROWS` never trips the base-grid
   bounds check.
2. `validateBagContents(projected)` — bagged items are checked for
   bag membership (`bag_id` resolves to a bag row in this same
   loadout), no nested bags, and `sum(width * height) ≤ bag.slotCount`.

Bagged item coords are intentionally *not* validated for being
"inside the bag's visual footprint". The client is trusted to pick a
valid virtual cell, and the projection falls back to container on any
malformed read. This keeps the server's validation surface small and
stable across UI iterations — for example, changing how bag layouts
wrap their slots doesn't require a server change.

### Round transition

`copyRoundForward` is deliberately dumb: it reads every column of every
row in round N and re-inserts with `round_number = N+1`. The bag
persistence columns (`active`, `rotated`, `x`, `y`, `bag_id`,
`width`, `height`) all ride along for free. Adding a new per-bag
column in the future requires no changes here as long as
`readCurrentRoundItems` and `insertLoadoutItem` round-trip it.

## Related docs

- [bag-active-persistence.md](./bag-active-persistence.md) — the
  `active` column refactor; first in this series.
- [bag-rotated-persistence.md](./bag-rotated-persistence.md) — the
  `rotated` column refactor; same pattern.
- [client-row-id-refactor.md](./client-row-id-refactor.md) — row id
  threading that lets duplicate bags / duplicate bagged items resolve
  to distinct rows in the full-state sync.
- [loadout-refactor-plan.md](./loadout-refactor-plan.md) §2.3 — the
  copy-forward model that carries every column across round
  boundaries.

## Non-goals

- **Validating that bagged items' virtual coords fall inside their
  bag's footprint.** The projection fallback absorbs malformed reads,
  and the server's slot-count check already prevents over-packing.
  Stricter coord validation would tie the server to the client's
  layout choice.
- **Backfilling existing broken rows via migration.** Pre-production
  data only; the projection fallback auto-heals the visible state on
  the next page reload, and the next Ready re-persists with valid
  coords. If this ever ships to production players, one-shot SQL would
  be `UPDATE game_run_loadout_items SET x = 0, y = 3 WHERE bag_id IS
  NOT NULL AND x < 0` — but keep in mind `y = 3` assumes the first
  active bag starts there, which isn't universally true, so a
  migration would need to join through `active` bag rows ordered by
  `sort_order` to compute each row's correct virtual y.
- **Persisting bag-item slot ordering beyond coords.** The bag's
  renderer already derives visual slot from `x, y`; there's no
  additional ordering state to persist.

## Test plan

All three layers of the round-trip have pinned tests.

1. **SQLite write + copy-forward (server)** —
   [`bag-items.test.js`](../tests/game/bag-items.test.js)
   `[Req 12-D, 5-A] bagged item coords survive PUT /artifact-loadout + copy-forward to round 2`
   drives the exact flow from the bug report: PUT with bagged-item
   coords, `resolveRound`, then `SELECT` round 2's row and assert
   `y = INVENTORY_ROWS`, `x = 0`, `bag_id = 'moss_pouch'` all survive.
2. **Projection valid path (client)** —
   [`loadout-projection.test.js`](../tests/web/loadout-projection.test.js)
   `[projection] bagged items with valid virtual coords land in builderItems with bagId`
   asserts the happy path: `y = 3` bagged items go into `builderItems`
   and preserve their coords.
3. **Projection fallback (client)** — same file,
   `[regression] legacy bagged items at (-1,-1) fall back to containerItems instead of breaking the grid`
   pins the defensive branch: bagId + invalid coords → container.
4. **Existing coverage still holds.** The bag-active and bag-rotated
   test suites exercise activation/rotation round-trips with bagged
   items present; they continue to pass under the new payload shape
   because the `active` / `rotated` columns are orthogonal to coords.

## Open TODOs / follow-ups

- Consider moving the `x >= 0` check out of the projection and into
  `validateBagContents` once we're confident all writers emit coords.
  This would turn the silent fallback into a loud rejection, which is
  closer to the spirit of the other validation passes. Leave as-is
  until the legacy-row branch is demonstrably unused.
- If bag layouts ever grow a non-rectangular shape (L-shape, offset
  rows), the projection will need a virtual-coord → bag-slot mapping
  check to catch stale rows left behind after a bag rotation. Today
  that's handled preemptively by the `rotateBag` guardrail blocking
  rotation when the bag or any later bag holds items.
