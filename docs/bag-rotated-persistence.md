# Bag rotation persistence

## Problem

Rotating a bag (click the ↻ button on an active bag chip) toggles the
bag's footprint between its two orientations — e.g. moss_pouch flips
between 1 row × 2 cols and 2 rows × 1 col. The rotation is client-only
state: it lives in `state.rotatedBags`, and every reload resets it
because:

1. The server has no column tracking which bags are rotated.
2. [useAuth.js](../web/src/composables/useAuth.js) reads `rotatedBags`
   from a `bootstrap.shopState` blob that's been null since the
   2026-04-13 legacy deletion, so the hydration branch is dead code.
3. [useShop.js](../web/src/composables/useShop.js) `rotateBag` never
   calls `persistRunLoadout`, unlike its sibling `activateBag` which
   does. So even if the hydration worked, no write would ever be sent.

This is the same class of bug as the bag-active gap closed in
[bag-active-persistence.md](./bag-active-persistence.md). The pattern
from that refactor (column on the loadout row, threaded through
read/write, routed through the existing `PUT /api/artifact-loadout`
full-state sync) applies cleanly here.

## Scope: what the refactor touches

Only the persistence pathway. Neither battle resolution nor layout
validation cares about rotation — they read `width`/`height` directly
off the loadout row, which the client already updates when it rotates.
So this is pure UI persistence, same as the active column.

There is one notable shape change: `state.rotatedBags` is currently a
flat `string[]` of artifactIds, which can't represent "one moss_pouch
rotated, another moss_pouch not rotated". The duplicate-aware
identity refactor (see [client-row-id-refactor.md](./client-row-id-refactor.md))
already established row id as the identity of a bag instance, so the
right shape is `Array<{ id, artifactId }>` — matching `state.activeBags`.

## Design

### Column: `rotated INTEGER NOT NULL DEFAULT 0`

Same pattern as `active`: a boolean on `game_run_loadout_items`. Bag
rows use it, non-bag rows leave it at 0. `sequelize.sync()` picks it
up for fresh databases; stale dev databases need the same `rm
tmp/telegram-autobattler-dev.sqlite` step we called out last time.

### Write path

Three writers set `rotated`:

1. **`insertLoadoutItem`** — defaults to 0. Takes an optional
   `rotated` param so copy-forward can preserve it.
2. **`copyRoundForward`** — passes `item.rotated` into the next
   round's row, same as it now does with `active`.
3. **`applyRunPlacements`** — the `PUT /api/artifact-loadout` UPDATE
   includes `rotated = $N`. Explicit `rotated: 1` / `rotated: 0`
   updates the row; omitted `rotated` preserves the current value for
   compatibility with partial or older payloads. Non-bag rows ignore
   the field.

### Read path

`readCurrentRoundItems` adds `rotated` to its SELECT and maps it onto
the row shape as a boolean. `getActiveGameRun` already spreads the row
shape into `loadoutItems[]`, so the client sees `i.rotated` for free.

### Client

1. **Hydration** — the projection in
   [loadout-projection.js](../web/src/composables/loadout-projection.js)
   gains a new `rotatedBags` output bucket built from any bag row
   where `i.rotated` is truthy. The dead `bootstrap.shopState` read
   in useAuth.js goes away.
2. **`state.rotatedBags`** — promote from `string[]` to
   `Array<{ id, artifactId }>`. Every reader that does
   `.includes(bagId)` flips to `.some((b) => b.artifactId === bagId)`.
3. **`rotateBag`** — already mutates `state.rotatedBags`; the new
   part is calling `persistRunLoadout` at the end, mirroring
   `activateBag` / `deactivateBag`. That's the one-line fix that
   closes the write side of the round-trip.
4. **`buildLoadoutPayloadItems`** — when emitting a bag entry, send
   the row's explicit rotation state so the server can persist it.

### `rotateBag` guardrails

Current behavior: rotating a bag unplaces any artifacts overlapping the
bag's old footprint back to the container, then toggles the rotation if
the new footprint fits and does not overlap another active bag.

## Non-goals

- Changing the rotation semantics (which orientation is "default" or
  "rotated"). That's in [useShop.js](../web/src/composables/useShop.js)
  `bagLayout` and stays as-is.
- Persisting the rotation of bags that aren't currently in
  `state.activeBags`. Container bags don't render rotation on their
  chip so the state is moot until they get activated again. The
  column can hold the bit for any bag row, but the client only emits
  rotated=1 for bags that are both rotated and active.
- Migrating existing dev sqlite databases. Pre-production, same
  caveat as bag-active.

## Test plan

1. **Server: `applyRunPlacements` persists explicit `rotated=1` and
   explicit `rotated=0` on a bag entry.** Extend
   [bag-active-persistence.test.js](../tests/game/bag-active-persistence.test.js)
   or add a sibling file.
2. **Server: `copyRoundForward` preserves `rotated` across round
   transitions.**
3. **Server: `getActiveGameRun` exposes `rotated` as a boolean in
   `loadoutItems[]`.**
4. **Projection: a bag row with `rotated=true` lands in
   `state.rotatedBags`.** Extend
   [loadout-projection.test.js](../tests/web/loadout-projection.test.js).
5. **Projection: duplicates hydrate into separate entries.** Two
   moss_pouches with different rotation bits must produce two
   distinct slots in `rotatedBags`.
6. **Composable: `rotateBag` calls `persistRunLoadout`.** Verify via a
   spy/capture on the injected `persistRunLoadout` function in
   [use-shop.test.js](../tests/web/use-shop.test.js). Previously
   `rotateBag` never called it; this test pins the fix.

## Rollout

One commit, same structure as the bag-active refactor. Same
`rm tmp/*.sqlite` caveat for stale dev databases. Done when all 263
tests still pass plus the 6 new ones, and the Playwright e2e's
bag-activation-persists test (which doesn't currently exercise
rotation) still passes unchanged.
