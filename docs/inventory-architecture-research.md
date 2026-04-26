# Inventory & Bag Architecture

**Type:** research-backed architecture recommendation.
**Status:** Draft 2026-04-26.
**Scope:** simplify the bag-grid model so artifacts can span bags without `bag_id` or bag-local coordinates.

## Decision

Use one flat grid:

- bags are placed pieces that provide usable cells
- artifacts are placed pieces that occupy cells
- container pieces use `(-1, -1)`
- bag membership is derived from cell overlap, not stored
- a placed artifact is valid only when every occupied cell is covered by an active bag

This removes the old `Bagged item stone_cap is out of bounds for bag trefoil_sack` failure class. That error came from the former `validateBagContents` path because an item could be stored in a bag-local coordinate space that later disagreed with the bag shape. In the flat model there is no bag-local coordinate space.

## Minimal Model

```js
PlacedPiece = { id, artifactId, x, y, width, height, rotated }
ContainerPiece = { id, artifactId, x: -1, y: -1 }
```

Bag rows and artifact rows use the same coordinate contract. The old `bag_id` column disappears; membership is a query:

```js
bagsContainingItem(item, activeBags) =
  activeBags.filter((bag) => overlaps(cells(item), cells(bag)))
```

The starter inventory is just a pre-placed `starter_bag` at `(0, 0)`.

## Validator Core

Keep the engine small and explicit:

1. `cells(piece)` returns occupied grid cells from `x`, `y`, dimensions, rotation, and optional shape mask.
2. `overlaps(a, b)` checks whether two cell sets intersect.
3. `validateBagPlacement(bags)` checks bag bounds and bag-bag overlap.
4. `validateItemPlacement(items)` checks item bounds and item-item overlap.
5. `validateItemCoverage(items, bags)` checks every item cell is covered by at least one active bag cell.
6. `bagsContainingItem(item, bags)` derives runtime membership for effects and UI.

Optional typed bags, such as herb-only or fire-only bags, should be predicates on derived membership, not nested containers:

```js
validateBagPredicates(item, bagsContainingItem(item, bags))
```

## Mutation Rules

Every user action should be proposal-based:

```text
current state -> proposed state -> validators -> commit or reject
```

Current Phase 3+4 choice: moving, rotating, or deactivating a bag unplaces affected artifacts to the container first. The bag does not carry contents yet.

This is simpler than Backpack Battles but keeps the same storage model. A future "bag carries contents" interaction can translate the bag and overlapping artifacts together before running the same validators.

## Why This Handles Spanning

An artifact crossing two adjacent bags is valid when its own cells do not overlap another artifact and each occupied cell is covered by at least one bag. It does not need one primary bag:

```text
item cells: A B
bag 1 covers: A
bag 2 covers: B
result: valid, membership = [bag1, bag2]
```

Per-bag effects then apply once per overlapping bag, independent of how many cells overlap.

## Research Summary

No ready-to-use TypeScript/JavaScript Backpack Battles engine surfaced. Build locally.

Useful references:

| Project | Takeaway |
|---|---|
| [peter-kish/gloot](https://github.com/peter-kish/gloot) | Best architecture reference: inventory plus composable constraints. Copy the constraint-stack idea, not the Godot code. |
| [ape1121/Godot-4-Grid-Inventory-with-Patterns](https://github.com/ape1121/Godot-4-Grid-Inventory-with-Patterns) | Good reference for shape masks, rotation, drag/drop, and save/load. |
| [expressobits/inventory-system](https://github.com/expressobits/inventory-system) | Larger Godot inventory system; useful confirmation that grid logic and UI logic should stay separate. |
| [Backpack Battles bag docs](https://backpack-battles.fandom.com/wiki/Bag) | Bags are placed on the inventory grid and empty bags can be rearranged. This supports treating bags as grid pieces, not parents. |
| [SteamDB Backpack Battles](https://steamdb.info/app/2427700/items/) | Confirms the game is centered on arranging items in a backpack grid, but does not expose reusable source architecture. |

Backpack Battles is a product reference, not a vendorable architecture. Its useful lesson is flat placement plus derived relationships.

## Implementation Plan

Use the existing Phase 3+4 plan as the authoritative task plan:

- [`.agent/tasks/bag-grid-unification/phase-3-4-spec.md`](../.agent/tasks/bag-grid-unification/phase-3-4-spec.md)
- [`docs/game-requirements.md`](game-requirements.md) §2

Recommended split:

1. **Server:** add starter-bag seeding, remove `bag_id`, persist bag anchors, replace `validateBagContents` with `validateItemCoverage`.
2. **Client:** remove `bagId`, send absolute coordinates, derive `bagsContainingItem`, remove base-inventory special cases.
3. **Tests:** update fixtures to include the starter bag, absolute item coords, and spanning-artifact coverage.
4. **Docs:** update persistence and game-requirement docs after code lands.

Regression tests:

- A placed artifact fully inside one bag is valid.
- A placed artifact spanning two adjacent bags is valid.
- A placed artifact with any uncovered cell is rejected.
- Two artifacts cannot overlap even if they touch different bags.
- Moving or rotating a bag unplaces affected artifacts before validation.
- Typed-bag predicates, when added later, reject only after coverage membership is derived.

## Non-Goals

- No external engine adoption.
- No nested bag containers.
- No `bag_id` compatibility path; no production database exists.
- No typed-bag implementation until the flat model ships.
- No bag-carries-contents interaction until after the simpler unplace-first rule is stable.
