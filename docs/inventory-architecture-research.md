# Inventory & Bag Architecture — External Research and Recommendation

**Type:** Independent external research. Supplementary to the in-flight bag-grid-unification plan; not authoritative spec.
**Status:** Draft 2026-04-26. No code changes proposed in this document.
**Triggering bug:** Red banner observed in dev: `Bagged item stone_cap is out of bounds for bag trefoil_sack`.

## Relationship to existing work

A bag-grid-unification effort is already in flight in this repo. The authoritative artifacts are:

- [`.agent/tasks/bag-grid-unification/spec.md`](../.agent/tasks/bag-grid-unification/spec.md) — phased implementation plan
- [`.agent/tasks/bag-grid-unification/research-backpack-battles.md`](../.agent/tasks/bag-grid-unification/research-backpack-battles.md) — internal BB research
- [`.agent/tasks/bag-grid-unification/phase-3-4-spec.md`](../.agent/tasks/bag-grid-unification/phase-3-4-spec.md) — phases 3 and 4 detail
- [`game-requirements.md`](game-requirements.md) §2, items 2-F through 2-M — the spec for the target model

This document was written independently before the author had read those artifacts. Its conclusions converge with the existing plan (flat single grid, bags as first-class placed entities, derived many-to-many membership from tile overlap, drop `bag_id`). The value it adds over the existing work is:

- An **external open-source survey** of grid-inventory libraries and BB clones (§6) — not present in the internal research.
- An **explicit, named diagnosis of the "out of bounds for bag" bug class** (§1.2, §4) showing how it becomes structurally unrepresentable in the target model — useful as a regression-test fixture.
- A **typed-bag predicate proposal** (§3.2 invariant 3) for the herb-only / fire-only bag mechanic, which is stricter than what BB itself supports.

Where this document and the in-flight plan disagree on details, **the bag-grid-unification spec wins** — it reflects in-codebase reality and in-progress implementation. Treat the sections below as cross-checking evidence and as a consolidated entry point for engineers who need the "why" before reading the phase docs.

---

## 0. TL;DR

The "out of bounds for bag" error is not a coordinate off-by-one. It is the symptom of a **mismodel**: the codebase treats bags as **parent containers with their own coordinate space** (virtual rows past `INVENTORY_ROWS`, items reference parent via `bagId`, no spatial position stored within the bag). **Backpack Battles itself — the reference design we are emulating — does not work that way.** In BB, bags and items are **siblings on a single global grid**; "in a bag" is a **derived spatial-intersection query**, never a stored parent-child relationship. Adopting BB's flat model makes the entire bug class structurally unrepresentable.

Recommended target: **single immutable rucksack value-object** with a smart constructor that enforces (a) every placement is a subset of legal cells, (b) placements are pairwise disjoint, (c) typed-bag predicates evaluated at placement boundary. Mutations return `Result<Rucksack, PlacementError>` and yield a new value. Bag-content membership is a derived query (`itemsInBag(bag) := placements.filter(p => !disjoint(p.cells, bag.cells))`), never persisted.

---

## 1. What's in the code today

Cited from a full backend + frontend audit (Explore agent run 2026-04-26).

### 1.1 Two coordinate spaces, no formal bridge

- **Main grid:** Cartesian `(x, y)` with `x ∈ [0, INVENTORY_COLUMNS-1]`, `y ∈ [0, INVENTORY_ROWS-1]`. Validated by [`validateGridItems`](../app/server/services/loadout-utils.js).
- **Container sentinel:** `(x = -1, y = -1)` means "purchased but unplaced". Skipped from occupancy checks.
- **Virtual bag rows (frontend-only):** Active bags expand the grid downward by `rotated ? max(w, h) : min(w, h)` rows past `INVENTORY_ROWS`. Computed in [`useGameRun.js` activeBagLayout](../web/src/composables/useGameRun.js).
- **Bag-internal coordinates:** **DO NOT EXIST.** Bagged items are persisted with `bagId` set but no `(x, y)` within the bag. Layout inside the bag is implicit (sort order? render order? unspecified).

### 1.2 Validation only checks capacity, not layout

- [`validateBagContents`](../app/server/services/loadout-utils.js) sums `width × height` of all items with the same `bagId` and rejects if total exceeds `bag.slotCount`.
- It does **not** check whether two items in the same bag would overlap, nor whether any item exceeds the bag's spatial dimensions.
- Consequence: the error message `Bagged item X is out of bounds for bag Y` has **no source in the current repo** — a `grep` shows no match. The string either lives in a not-yet-merged validator that would need spatial coordinates that aren't stored, or in a freshly seeded bag (e.g. `trefoil_sack`, also not in current `game-data.js`) whose dimensions don't match an item placed before it shrank or was swapped.

### 1.3 Three state buckets that replicate the same items

Frontend maintains:

- `state.builderItems` — items placed on grid OR in a bag (distinguished by `bagId` presence)
- `state.containerItems` — purchased, unplaced items
- `state.activeBags` / `state.rotatedBags` — bags currently active

The projection in [`loadout-projection.js`](../web/src/composables/loadout-projection.js) and the payload builder in [`useGameRun.js`](../web/src/composables/useGameRun.js) round-trip every item through this three-bucket split. The **silent fallback at `useGameRun.js:77-86`** rewrites a bagged item with stale `y` to `(-1, -1)` (container) — no error surfaced to user.

### 1.4 Frontend computes bag layout, backend has no equivalent

Only the frontend knows the mapping from virtual row `y` to a specific bag. Backend stores `bagId` directly and validates capacity without needing the mapping. If the two ever drift (frontend shows item in bag A, backend stores `bagId = B`), there is no canonical truth.

### 1.5 Persistence shape today

DB row in `game_run_loadout_items`:

```
id, game_run_id, player_id, round_number, artifact_id,
x, y, width, height,           -- (-1,-1) for bagged items and unplaced bags
bag_id,                        -- NULL or parent bag's artifact_id
sort_order, purchased_round, fresh_purchase, active, rotated, created_at
```

Wire payload (client → `PUT /api/artifact-loadout`) varies shape by item kind:

```jsonc
{ "id": "...", "artifactId": "moss_pouch",  "x": -1, "y": -1, "width": 1, "height": 2, "active": 1, "rotated": 0 }
{ "id": "...", "artifactId": "stone_cap",                       "width": 1, "height": 2, "bagId": "moss_pouch" }
{ "id": "...", "artifactId": "spore_needle", "x":  0, "y":  0, "width": 1, "height": 1 }
{ "id": null,  "artifactId": "bark_plate",   "x": -1, "y": -1, "width": 1, "height": 1 }
```

Note the four distinct shapes. Each is a special case the consumer must branch on.

### 1.6 Where validators live

| Validator | File | Checks |
|---|---|---|
| `validateGridItems` | [loadout-utils.js](../app/server/services/loadout-utils.js) | bag has no grid coords; bounds; pairwise overlap |
| `validateBagContents` | [loadout-utils.js](../app/server/services/loadout-utils.js) | no bag-in-bag; bagId references a real bag; bag is placed; capacity by `slotCount` |
| `validateCoinBudget` | [loadout-utils.js](../app/server/services/loadout-utils.js) | total cost ≤ budget |
| `validateLoadoutItems` | [loadout-utils.js](../app/server/services/loadout-utils.js) | orchestrator |
| Insert normalization | [game-run-loadout.js](../app/server/services/game-run-loadout.js) | force bagged items to `(-1, -1)` at write |
| Frontend silent fallback | [useGameRun.js](../web/src/composables/useGameRun.js) | rewrite bagged item with stale `y` to container |

### 1.7 Existing documentation

- [`game-requirements.md`](game-requirements.md) §2 (Inventory & Grid), §5 (Bags) specify base grid size, bag dimensions/prices/drop probabilities, and that bags don't contribute stats. **Silent on bag-internal layout, collision rules, or what happens when a bag is rotated/swapped with items inside.**
- [`bag-active-persistence.md`](bag-active-persistence.md) — `active` flag persistence only.
- [`bag-rotated-persistence.md`](bag-rotated-persistence.md) — `rotated` flag persistence only.
- No `inventory-specification.md` or equivalent.

---

## 2. How Backpack Battles models bags

Sources: [BB Wiki — Bag](https://backpackbattles.wiki.gg/wiki/Bag), [BB Wiki — Game Mechanics](https://backpackbattles.wiki.gg/wiki/Game_Mechanics), [Steam: "What constitutes 'inside' a bag?"](https://steamcommunity.com/app/2427700/discussions/0/7204142836198230648/), [Steam: "Drag and move entire backpack"](https://steamcommunity.com/app/2427700/discussions/0/3882724699535730613/), [Steam: "Rotate Groups"](https://steamcommunity.com/app/2427700/discussions/3/3882724699533329711/).

The single most important finding from the research:

> **BB does not use bag-in-bag containment.** Items and bags are siblings on the same global grid. An item is "in" a bag iff their footprints share at least one cell. Membership is computed at lookup, not stored.

Concrete consequences observable in BB:

1. **One global grid.** The rucksack is a single `Map<(x, y), ItemId>`. Bags are items on that grid like everything else.
2. **"In a bag" = footprint intersection, derived.** No parent pointer. No sub-grid. No second coordinate space.
3. **An item can be in multiple bags simultaneously.** Falls out of (2) for free — and the wiki confirms it ("items can benefit from multiple different bags").
4. **An item only counts once per bag.** Set membership semantics — touching multiple cells of the same bag does not multi-count.
5. **Bag effects are predicates over tags of touching items**, not container types. *Holdall:* "+8 Block per **Neutral** item inside." *Fire Pit:* "+4 max HP per **Fire** item inside." Every bag accepts every item; effects gate themselves on tags of overlapping items.
6. **Pick up a bag → lift the touching items as a rigid group.** No "auto-eject", no orphaning. Rotating or moving a bag rotates/moves the entire connected component. If the new placement is illegal, the whole drop is rejected and the group snaps back. ([Steam thread](https://steamcommunity.com/app/2427700/discussions/0/3882724699535730613/))

This is why **BB has no "bagged item is out of bounds for bag" bug class**: there is no bag-internal coordinate to be out of bounds of.

### 2.1 Typed bags ("Trefoil Sack only takes herbs")

The mushroom design appears stricter than BB — BB has no `acceptsTags: [...]` typed bags. Where you *do* want one, the right encoding is **a placement-time predicate on the rucksack's smart constructor**, not a separate sub-container type. See §3.3.

---

## 3. Recommended target architecture

### 3.1 Core types

```ts
type Cell = `${number},${number}`;            // branded, hashable

interface Item {
  id: ItemId;
  kind: 'artifact' | 'bag';
  tags: ReadonlySet<string>;                  // 'damage' | 'armor' | 'stun' | 'herb' | ...
  shape: ReadonlySet<Cell>;                   // relative offsets from anchor (canonical orientation)
  acceptsPredicate?: (other: Item) => boolean;  // bags only
}

interface Placement {
  itemId: ItemId;
  anchor: [number, number];
  rotation: 0 | 90 | 180 | 270;
}

interface Rucksack {
  cells: ReadonlySet<Cell>;                   // legal cells (3×3 today; can grow as a unit)
  placements: ReadonlyMap<ItemId, Placement>;
  occupied: ReadonlyMap<Cell, ItemId>;        // derived; rebuilt on construction
}
```

### 3.2 Invariants enforced in the smart constructor

(parse, don't validate — illegal states unrepresentable)

1. For every placement `p` of item `i`, `translate(i.shape, p.anchor, p.rotation) ⊆ cells`. → **grid-bounds bug class dies.**
2. For every two placements, footprints disjoint. → **overlap bug class dies.**
3. For every bag `b` with `acceptsPredicate`, every item whose footprint touches `b`'s footprint must satisfy `b.acceptsPredicate(item)`. → **wrong-type-in-bag rejected at the boundary.**

Mutations return `Result<Rucksack, PlacementError>` and yield a *new* `Rucksack`. No in-place edits, no reconciliation pass.

### 3.3 Derived queries (no storage)

```ts
itemsInBag(rucksack, bagId) =
  [...rucksack.placements.values()].filter(p =>
    !disjoint(footprint(p), footprint(rucksack.placements.get(bagId)))
  );
```

A typed bag's stat contribution is `bag.effect(itemsInBag(rucksack, bag.id))` — a pure function over the spatial intersection at evaluation time.

### 3.4 Group operations (rotate / move bag with contents)

`rotateBag(rucksack, bagId, newRotation)` and `moveBag(rucksack, bagId, newAnchor)`:

1. Compute the connected component of items whose footprints touch the bag's footprint (transitively, if you want chain-touching; non-transitively for BB's exact rules).
2. Compute the new footprint of the entire group under the rotation/move.
3. Construct a candidate `Rucksack` with the group repositioned. If the smart constructor rejects, return `Err(PlacementError)`. If it accepts, return `Ok(newRucksack)`.

**No half-applied state. No orphaned items.** The compiler forces the caller to handle the failure case.

### 3.5 Bag swap / shrink

`swapBag(rucksack, oldBagId, newBag, anchor)` returns `Result<{ rucksack: Rucksack; displaced: Item[] }, PlacementError>`:

- Remove the old bag.
- Try to re-place each previously-touching item; items that no longer fit are returned in `displaced[]` for the caller to refund / drop in the container / refuse the swap.
- The compiler forces the choice — there is no silent orphan.

---

## 4. Why this kills the bug class structurally

| Today's failure mode | Why it can't happen in the proposed model |
|---|---|
| `Bagged item X out of bounds for bag Y` | No bag-internal coordinate exists. "In bag Y" is `cells ∩ Y.cells ≠ ∅`. |
| Bag rotation invalidates contents | Group-pickup: rotate the connected component as a rigid body. Smart constructor either accepts the new placement or rejects the whole rotation. |
| Bag swapped for smaller bag, contents orphaned | `swapBag` returns `displaced[]`; caller must handle. |
| Frontend `activeBagLayout` drifts from backend | There *is* no virtual-row layout. Frontend renders `placements`; backend validates `placements`. Same data, one shape. |
| Three state buckets out of sync | One bucket: `placements`. "Container" (purchased, unplaced) is `Map<ItemId, Item> unplaced` — separate by intent, not shape. |
| Stale `y` silently rewritten to `(-1, -1)` | No `y` to be stale. A move that fails returns `Err` to the caller; the UI can show an error or revert. |

---

## 5. Schema migration shape

Schema changes are minimal because the existing columns already cover the new model.

- **Drop (semantically):** virtual-row interpretation of `y`; the `(-1, -1)` sentinel for *active* bags; the implicit "bagged means no x/y" rule.
- **Keep:** the `game_run_loadout_items` table; `(x, y, rotated, active)` map directly to `Placement`. Use `(x = -1, y = -1)` for unplaced items only (purchased but not placed) — bags get real `(x, y)` like every item.
- **Drop column (eventually):** `bag_id` becomes redundant — derived from spatial intersection. Keep transitionally as a denormalized cache if needed for migration, then remove.
- **Add:** a single `validatePlacements(items)` enforcing the four invariants above. **Delete** `validateGridItems` + `validateBagContents` — they collapse into one function.
- **Frontend:** delete `activeBagLayout`, the bag-bar special render, the `y >= INVENTORY_ROWS` branch in [`useGameRun.js`](../web/src/composables/useGameRun.js). Bags render in-grid like every other item; "active vs container" is just "has a placement vs doesn't."
- **Tests:** port [`tests/game/bag-items.test.js`](../tests/game/bag-items.test.js) and [`tests/game/validator-split.test.js`](../tests/game/validator-split.test.js) to assert against the new flat model. Keep regression tests for past failures (bag coords normalization, grid-y outside grid) — they should still pass under the new model and remain valuable as integration coverage.

---

## 6. Open-source reference points

None are vendor-ready. All are useful reading.

- [ottoblep/backpack-battles-solver](https://github.com/ottoblep/backpack-battles-solver) — C++ placement solver for BB. Confirms BB's flat model: items + bags are flat lists, no tree.
- [FarrokhGames/Inventory](https://github.com/FarrokhGames/Inventory) — Unity/C#, Diablo-2 style. Cleanest single-grid validator API to copy (`CanAdd / CanAddAt / CanSwap`), 75+ unit tests.
- [peter-kish/gloot](https://github.com/peter-kish/gloot) — Godot 4. Cleanest constraint-stack composition.
- [alpapaydin/Godot-4-Grid-Inventory-with-Patterns](https://github.com/alpapaydin/Godot-4-Grid-Inventory-with-Patterns) — clean shape-mask reference (Tetris-style L/T pieces).
- [Backpack-Battles GitHub org](https://github.com/orgs/Backpack-Battles/repositories) — empty. No open-source BB clone exists.
- TypeScript/JS ecosystem: nothing production-grade. Build it; the core is ~300 lines.

### Architectural reading

- Khalil Stemmler — [Make Illegal States Unrepresentable (TS DDD)](https://khalilstemmler.com/articles/typescript-domain-driven-design/make-illegal-states-unrepresentable/)
- Chris Krycho — [Making Illegal States Unrepresentable in TypeScript](https://v5.chriskrycho.com/journal/making-illegal-states-unrepresentable-in-ts/)
- Mimetrik Games — [Composite Pattern in game inventories](https://mimetrikgames.com/composite-design-pattern-what-it-is/)

---

## 7. Suggested next steps

The structural fix is already planned and partially shipped — see [`.agent/tasks/bag-grid-unification/spec.md`](../.agent/tasks/bag-grid-unification/spec.md). What this document suggests on top of that:

1. **Add an explicit regression test** for the "out of bounds for bag" symptom keyed to a Phase-4 invariant ("every item cell overlaps either the base inventory or some active bag's slot mask"). The test should fail on the v1 model with a deliberately broken bag/item pair and pass once Phase 4 ships absolute coords + derived membership.
2. **Cross-link this document from [`.agent/tasks/bag-grid-unification/research-backpack-battles.md`](../.agent/tasks/bag-grid-unification/research-backpack-battles.md)** so future engineers find the open-source survey alongside the internal BB analysis.
3. **Defer typed-bag predicates** (the herb-only / fire-only mechanic) to a separate task once Phase 4 lands. They compose cleanly on top of the derived-membership model but don't block the migration.

Until Phase 4 ships, the immediate "out of bounds for bag" symptom can be patched defensively by ensuring the UI never constructs invalid placements — but that is a workaround. The structural fix is the bag-grid-unification migration.
