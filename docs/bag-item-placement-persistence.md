# Bag item placement persistence

## Current contract (slot-coord architecture)

`game_run_loadout_items.x, y, bag_id` are shared across three different
kinds of rows, discriminated by `bag_id`:

```
bag_id IS NULL      &&  x >= 0                            → base-grid item
bag_id IS NULL      &&  x = -1, y = -1                    → container item OR bag row
bag_id IS NOT NULL  &&  0 <= x,y < bag.cols, bag.rows     → bagged item; (x, y) are SLOT coords inside the bag
```

`bag_id` on a bagged row references the **loadout row id** of the bag in
the same `(game_run_id, player_id, round_number)` tuple. It is not an
artifact id. Two `moss_pouch` rows in the same round are two distinct
bags, each identified by its own `id`, and their bagged items are
disambiguated by which `id` they reference.

Bag cols and rows are computed from the bag artifact's canonical
`(width, height)` plus the bag row's `rotated` flag (same logic as the
client-side `useShop.bagLayout`): `cols = rotated ? min(w,h) :
max(w,h)`, `rows = rotated ? max(w,h) : min(w,h)`. Slot coords are
always expressed in the bag's *effective* orientation.

## Why slot coords, not virtual grid coords

The storage used to overload `(x, y)` with **virtual grid coords** for
bagged items — `y = INVENTORY_ROWS + bag-offset + slot-row-within-bag`.
Virtual y was an encoding of "which active bag this item lives in" plus
"which slot inside that bag." That encoding broke whenever the active-bag
layout changed: deactivating or rotating an earlier bag, reordering
bags, or restoring from a round where active bags were listed in a
different order all re-pointed existing `y` values at the wrong bag.

Every bag persistence bug this repo has seen came from that same
structural tension, in three flavors:

1. **Bag activation** — closed by
   [bag-active-persistence.md](./bag-active-persistence.md).
2. **Bag rotation** — closed by
   [bag-rotated-persistence.md](./bag-rotated-persistence.md).
3. **Bagged item placement** — this doc. Both a round-2 "scrambled
   inventory" crash and the later deactivate-stranded-items OOB 500
   traced back to virtual y being a layout-dependent encoding.

Slot coords remove the layout dependency: a bagged item's storage is
`(slot_x, slot_y, bag_row_id)`, which is orthogonal to how any other bag
is arranged. The client reconstructs a virtual render y on hydrate by
adding the bag's current `startRow` — that's purely a presentational
concern now, not a storage concern.

## Round trip

### Write path — `PUT /api/artifact-loadout`

Client-side
[`buildLoadoutPayloadItems`](../web/src/composables/useGameRun.js) walks
`state.builderItems` and, for items inside a bag, converts the client's
virtual y back into a slot coord:

```js
const slotY = item.y - info.startRow;
payload.push(withId({
  artifactId: item.artifactId,
  x: item.x,
  y: slotY,
  width: item.width, height: item.height,
  bagId: info.bagRowId   // loadout row id of the bag, not artifactId
}, item.id));
```

Server-side `applyRunPlacements` (in
[game-run-loadout.js](../app/server/services/game-run-loadout.js))
matches payload entries to existing rows by `id` (or artifactId
fallback) and UPDATEs `x, y, bag_id, width, height, active, rotated`.
Validation runs against the full projected layout:

- `validateGridItems` enforces base-grid bounds and overlap on non-bagged
  rows (`!item.bagId`).
- `validateBagContents` catalogs bag rows by row id (every bag row MUST
  carry its loadout row id), then for each bagged item resolves `bagId`
  to a bag row, enforces slot bounds
  (`0 <= x, y; x+w <= bag.cols; y+h <= bag.rows`), checks per-bag
  overlap, and caps total footprint at the bag's `slotCount`.

An invalid bagged-item write — slot coords outside the bag's footprint,
duplicate slot occupation, orphan `bag_id`, bag-inside-bag, or a bag row
missing its id — is rejected before any DB write.

### Copy-forward — round N → N+1

[`copyRoundForward`](../app/server/services/game-run-loadout.js) mints
fresh row ids per round, so bag row ids change even when the payload
stays identical. The helper runs in two passes:

1. Insert every non-bagged row (grid items, containers, **bag rows
   themselves**) and record `oldId → newId` in a map.
2. Insert every bagged row, remapping its `bag_id` through that map so
   the round N+1 bagged item points at the round N+1 bag row, not the
   now-defunct round N one. A bagged row whose `bag_id` doesn't resolve
   in the map is corrupt; copy-forward throws rather than carrying the
   dangling reference forward.

### Projection — client hydrate

[`projectLoadoutItems`](../web/src/composables/loadout-projection.js)
runs in two passes:

1. Register every bag row: active bags get an entry in a
   `rowId → { startRow, cols, rows }` map, with `startRow`
   accumulating in iteration order. Inactive bags route to the
   container.
2. For every bagged item, resolve `bagId` via the map. If it resolves to
   an active bag AND slot coords fall inside that bag's effective
   footprint, push a builderItem at virtual `(x, startRow + y)` and keep
   `bagId = row id` so downstream ops can disambiguate duplicates.
   Otherwise, drop to the container:
   - `bagId` points at an inactive bag (not in the active-bag layout
     map) → container.
   - slot coords out of bounds → container (covers stale rotation +
     malformed rows).

The fallback is defensive, not a legacy-format compatibility shim — no
items are dropped, and the user can re-place anything that wound up in
the container.

## Architecture

### State ownership

| Slice                       | Column                | Who writes                                                         |
|-----------------------------|-----------------------|--------------------------------------------------------------------|
| Bag is activated            | `active INTEGER`      | `applyRunPlacements` (full-state sync, default 0)                  |
| Bag is rotated              | `rotated INTEGER`     | `applyRunPlacements` / client `rotateBag → persistRunLoadout`      |
| Bag row itself              | `x=-1, y=-1`          | `insertLoadoutItem` normalizes bag rows at the write layer         |
| Bagged item membership      | `bag_id`              | client → server as the bag's loadout row id (same round)           |
| Bagged item position        | `x`, `y`              | slot coords in the bag's effective orientation                     |
| Bagged item footprint       | `width`, `height`     | `applyRunPlacements` — already persisted for rotation support      |
| Bagged row id stability     | `id` (row PK)         | `insertLoadoutItem` creates fresh per-round; `copyRoundForward` remaps `bag_id` |

### Validation split

The server runs placement validation in two coord-aware passes:

1. `validateGridItems(projected.filter(i => !i.bagId))` — base-grid
   bounds, canonical footprint, overlap. Bagged items are excluded, so
   their slot-y never trips the base-grid height check.
2. `validateBagContents(projected)` — bagId resolution, no nested bags,
   per-bag slot bounds, per-bag overlap, slotCount ceiling.

Slot bounds ARE validated on the server now, unlike the previous
architecture which trusted the client to pick a valid cell. The check
is cheap (rotation-aware cols/rows from the bag artifact) and it makes
the write contract honest: `bag_id IS NOT NULL` implies
`0 <= x < bag.cols && 0 <= y < bag.rows` or the write is rejected.

### Client bagId identity

`state.builderItems[i].bagId` is the bag's loadout row id for bagged
items (`null` for base-grid items). That matches `state.activeBags[j].id`
for the bag it lives in, so bag rotate / deactivate can precisely
identify "items in this bag" without y-range arithmetic:

```js
const itemsInThisBag = state.builderItems.filter((i) => i.bagId === activeBag.id);
```

The client sets `bagId` at placement time via `bagForRow(y).bagRowId`
inside `normalizePlacement` and inside the inventory-to-bag-cell drag
handler. The projection sets it on hydrate. Either source produces the
same field on the same items.

### Bag rotate / deactivate guardrail

Both ops block only when the *current* bag holds items. Later bags are
independent — their slot coords don't change when an earlier bag's
rowCount changes, so the client's `relayoutBaggedItems` just recomputes
their virtual y against the new layout. Before the refactor these ops
blocked on any downstream item, because virtual y had to stay in sync
with the activeBags ordering.

### Round transition stays dumb

`copyRoundForward` still copies every row verbatim, with one wrinkle:
the `bag_id` remap. Adding any new per-row column requires no changes
here as long as `readCurrentRoundItems` and `insertLoadoutItem`
round-trip it.

## Related docs

- [bag-active-persistence.md](./bag-active-persistence.md) — the
  `active` column refactor.
- [bag-rotated-persistence.md](./bag-rotated-persistence.md) — the
  `rotated` column refactor.
- [client-row-id-refactor.md](./client-row-id-refactor.md) — row id
  threading that makes duplicate-bag and duplicate-item identity
  unambiguous.
- [loadout-refactor-plan.md](./loadout-refactor-plan.md) §2.3 — the
  copy-forward model.

## Non-goals

- **Schema migration.** `x, y, bag_id` column types stay as-is; only
  their semantic interpretation for bagged rows changes. No `ALTER
  TABLE` required. No production data exists yet.
- **Validating non-rectangular bag footprints.** All current bags are
  rectangular; the slot-bounds check is sufficient. If a future bag
  has an L-shape or offset rows, extend `validateBagContents` with a
  shape-aware check; storage doesn't change.
- **Adding a `placement_kind` discriminator column.** Possible future
  cleanup if the `x, y, bag_id` overloading becomes painful. Not
  needed now — the discriminator is `bag_id IS NOT NULL` and the three
  cases are covered by the validator split.

## Test plan

- **Server unit (validator)** —
  [validator-split.test.js](../tests/game/validator-split.test.js)
  pins: slot-bounds rejection, per-bag overlap rejection, duplicate-bag
  disambiguation by row id, slotCount ceiling, rejection of bagId that
  isn't a row id, rejection of a bag row missing its loadout id.
- **Server scenario (copy-forward)** —
  [bag-items.test.js](../tests/game/bag-items.test.js)
  `[Req 12-D, 5-A]` drives the full round-trip: `PUT /artifact-loadout`
  with slot coords and a bag row id, `resolveRound`, then asserts the
  round-2 row has a new bag row id, the bagged item's `bag_id` remapped
  to that new id, and slot coords `(0, 0)` survived unchanged.
- **Client projection** —
  [loadout-projection.test.js](../tests/web/loadout-projection.test.js)
  pins: slot-to-virtual y reconstruction (single bag, multi-bag,
  duplicate bags), inactive-bag fallback, out-of-bounds fallback.
- **Client composable (relayout)** —
  [use-shop.test.js](../tests/web/use-shop.test.js) pins: deactivating
  an empty earlier bag succeeds and shifts a later bag's items up by
  the removed bag's rowCount; rotating an empty earlier bag succeeds
  and shifts a later bag's items by the rowCount delta; deactivating
  a non-empty bag is still blocked.

## Open follow-ups

- If bag layouts ever grow non-rectangular shapes (L-shape, offset
  rows), extend the bounds check in `validateBagContents` with a
  shape-aware occupancy map. Storage doesn't change.
