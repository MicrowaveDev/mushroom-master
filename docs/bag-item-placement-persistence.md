# Bag Item Placement Persistence

Status: current flat-grid contract. The previous slot-coordinate contract using `bag_id` has been removed.

## Row Contract

All placed rows use absolute coordinates in the same `BAG_COLUMNS`-wide grid.

| Row kind | `x`, `y` | Notes |
|---|---|---|
| Active bag | absolute bag anchor | `active = 1`; shape cells provide placement coverage |
| Inactive bag | `-1`, `-1` | bag is in the container |
| Placed artifact | absolute artifact anchor | contributes combat stats if covered |
| Container artifact | `-1`, `-1` | owned but not placed |

There are no bag-local item coordinates. There is no persisted owning bag id.

## Why Flat Coordinates

Bag-local storage made placement depend on an owning bag row. That blocked items from spanning multiple bags and created stale references whenever bags moved, rotated, or were copied forward.

The flat model stores only what the board needs:

- bag cells are derived from active bag rows;
- artifact cells are derived from absolute item rows;
- coverage is checked per cell;
- membership is derived by overlap when the game needs to know which bag contains an item.

This matches Backpack Battles-style placement: bags define board cells, items occupy board cells.

## Write Path

`buildLoadoutPayloadItems` serializes:

1. active bags with absolute anchors and `active: 1`;
2. inactive bags with `(-1, -1)` and `active: 0`;
3. placed artifacts with absolute `(x, y, width, height)`;
4. container artifacts with `(-1, -1)`.

`applyRunPlacements` matches rows by id when possible, falls back to artifact order for legacy/fresh rows, validates the full projected board, then updates the matched rows.

## Validation

`validateLoadoutItems` runs:

1. `validateBagPlacement`;
2. `validateGridItems`;
3. `validateItemCoverage`;
4. `validateCoinBudget`.

`validateItemCoverage` rejects any placed artifact cell not covered by an active bag shape. Items may span multiple bags if every cell is covered.

## Round Copy

`copyRoundForward` duplicates the current round rows into the next round. Coordinates remain absolute. No id remapping is needed for item membership, because membership is derived from geometry.

## Historical Note

Older notes and tests may mention slot coords, `bag_id`, `validateBagContents`, or bag-local ownership. Those names refer to the previous architecture and should not be copied into new code.
