# Shop, Bag, Inventory Runtime Architecture

Current contract: one flat grid. Bags are placed artifacts that provide usable cells. Combat artifacts are placed artifacts that consume cells. There is no `bag_id` and no bag-local coordinate system.

See also:

- [game-requirements.md](game-requirements.md)
- [inventory-architecture-research.md](inventory-architecture-research.md)
- [bag-item-placement-persistence.md](bag-item-placement-persistence.md)
- [bag-active-persistence.md](bag-active-persistence.md)
- [bag-rotated-persistence.md](bag-rotated-persistence.md)

## State Buckets

| Bucket | Shape | Meaning |
|---|---|---|
| `shopOffer` | `string[]` | Current round shop artifact ids |
| `containerItems` | `{ id, artifactId }[]` | Owned but unplaced rows, including inactive bags |
| `activeBags` | `{ id, artifactId, anchorX, anchorY }[]` | Active bag rows and their absolute anchors |
| `builderItems` | `{ id, artifactId, x, y, width, height }[]` | Placed non-bag artifacts with absolute grid coords |
| `rotatedBags` | `{ id, artifactId }[]` | Rotated bag rows |
| `freshPurchases` | `string[]` | Bought-this-round artifact ids for refund display |

`id` is the server `game_run_loadout_items.id` when known. Duplicate artifacts are legal; row id is the identity.

## Coordinates

The prep grid is `BAG_COLUMNS` wide and at least `BAG_ROWS` tall. It grows downward if active bag footprints extend beyond that.

The starter bag is a normal active bag seeded at `(0, 0)` with size `3x3`. There is no special base-inventory storage rule anymore; the old base grid is now just the starter bag footprint.

Rows use this contract:

| Row kind | Coordinates | Flags |
|---|---|---|
| Active bag | absolute anchor `(x, y)` | `active = 1` |
| Inactive bag | `(-1, -1)` | `active = 0` |
| Placed artifact | absolute top-left `(x, y)` | `active = 0` |
| Container artifact | `(-1, -1)` | `active = 0` |

## Placement Rules

An artifact may be placed when:

1. Its footprint is inside the grid width.
2. Its footprint does not overlap another placed artifact.
3. Every occupied cell is covered by at least one active bag shape cell.

An artifact may span several bags. Membership is derived when needed by comparing item cells to bag cells.

Bags may be placed when:

1. They are active.
2. Their effective shape fits inside `BAG_COLUMNS`.
3. Their shape cells do not overlap another active bag's shape cells.

Inactive bags must stay at `(-1, -1)`.

## Client Flow

Buying creates a server row and puts the item in `containerItems`.

Activating a bag removes one matching container slot, finds the first non-overlapping anchor, and pushes an `activeBags` row.

Placing an artifact removes one matching container slot and pushes a `builderItems` row with absolute coordinates.

Moving, rotating, or deactivating a bag unplaces any overlapping artifacts back to the container before applying the bag change. This keeps bag movement simple and avoids stale placement references.

`buildLoadoutPayloadItems` sends the same flat row contract to the server. It does not emit `bagId`.

## Server Validation

`validateLoadoutItems` orchestrates:

1. `validateBagPlacement` for active/inactive bag rows and bag overlap.
2. `validateGridItems` for non-bag artifact bounds and artifact overlap.
3. `validateItemCoverage` for per-cell coverage by active bag shapes.
4. `validateCoinBudget`.

Failures map to `400 Bad Request`.

## Persistence

`game_run_loadout_items` is the source of truth for the current round. Round copy-forward duplicates rows and preserves absolute coordinates, `active`, `rotated`, `purchased_round`, and refund state.

`bag_id` is obsolete. Historical docs that mention bag-local slot coordinates describe the previous architecture.
