# Backpack Battles — architecture reference

Research summary for the bag-grid-unification task. The user wants our model "very close to Backpack Battles in future". This file captures what BB actually does so the plan + DB schema can grow toward it without retroactive rewrites.

Sources: [backpackbattles.wiki.gg/Bag](https://backpackbattles.wiki.gg/wiki/Bag), [backpackbattles.wiki.gg/Game_Mechanics](https://backpackbattles.wiki.gg/wiki/Game_Mechanics), [Steam — "What constitutes 'inside' a bag?"](https://steamcommunity.com/app/2427700/discussions/0/7204142836198230648/), [TheGamer — Beginner Tips](https://www.thegamer.com/backpack-battles-beginner-tips-tricks/), and other community wikis.

## Findings — what BB actually does

1. **No static base inventory.** The play area is a single shared grid (~63 reachable tiles). Each class starts with **one preplaced unique "class bag"** (Reaper's Storage Coffin, Ranger's Leather Bag, etc.) that exposes 12–14 tiles. There is no fixed rectangular backpack underneath.
2. **Bags are first-class items on the shared grid.** Bags themselves are placed entities with their own footprint. Activating a bag = placing it on the grid. Removing it = picking it up.
3. **Bags are freely positioned.** Not anchored to fixed slots. A bag can be moved anywhere on the grid the player wants.
4. **Bags are rectangular** (Fanny Pack 1×2, Sack of Surprises 2×2, etc.) — no tetromino-shaped bags surfaced in fan docs (uncertain whether late-game bags break this; we should keep the shape-mask plumbing we already have for forward compat).
5. **Items have varied shapes** — 1×1, 1×2, 2×2, irregular L-shapes, etc. — and can rotate (R / right-click / mouse-wheel).
6. **Items are placed on the shared grid, not "into" a bag.** Their position is an absolute `(x, y)` on the shared grid. Bag membership is a runtime property, not a stored relationship.
7. **Bag membership is many-to-many, derived from tile overlap.** An item is "in" every bag whose tiles it touches — a 2-tile item straddling two adjacent bags is in *both*, gets each bag's effect once. (Dev-confirmed in the Steam thread linked above.)
8. **Picking up a bag carries its items.** When the player drags a bag, every item currently overlapping its footprint translates with it. Items don't get re-anchored individually.
9. **Per-bag effects.** Bags grant effects to items inside them — Fanny Pack makes contents trigger 10% faster, others give stat bonuses. With many-to-many membership, one item may receive multiple bags' effects simultaneously.
10. **Adjacency synergies are separate from bags.** Pan gains damage when adjacent to Food-category items, etc. — adjacency is "touching tiles," independent of whose bag those tiles belong to.

## Architectural implications for our codebase

### What aligns with BB already
- Bags as artifacts with shapes (we support tetromino shapes ahead of BB; keep).
- Anchor-based placement + 2D first-fit packer.
- Bag rotation.
- Empty-bag guard for re-anchoring.

### What needs to change (in priority order)
- **Drop the "base inventory" as a special fixed obstacle** — replace it with a **starter bag** (per character, like a class bag) that's pre-activated at run start. The starter bag is just a bag; the player can theoretically pick it up if no items are inside. (We may keep it locked-in-place for v1 — see Phase 3 below.)
- **Items lose their `bagId`**. They have absolute `(x, y)` on the shared grid. Bag membership is derived at runtime from tile overlap.
- **Bag membership becomes many-to-many.** A helper `bagsContainingItem(item)` returns the set of bags whose footprint overlaps any of the item's cells. Used for stat aggregation, per-bag effects, save validation.
- **Bag drag semantics**: dragging a bag translates the bag + every item whose cells fall inside the bag's pre-drag footprint. The "empty bag only" guard goes away — bags can be moved with their items.
- **Persistence**: items store absolute coords (`x, y, width, height, rotated`) — no `bag_id` column. Bag rows store their own anchor coords (`x, y`) and `rotated` flag.

### What stays essentially the same
- Shop / container / buy / sell flows. Items still come from the shop into the container, then get placed on the grid.
- Validators still enforce bounds + non-overlap + coin budget. The contents-of-a-bag check is dropped (no bagId means there's nothing to check); a new "every item cell overlaps SOME bag" check replaces it.
- Combat resolution still consumes a flat list of placed items + their stats. Bag effects are computed at battle-start by aggregating per-bag rules over the derived membership.

### Database schema — current vs target

**Current (`game_run_loadout_items`)**:

| col | meaning |
|---|---|
| `x, y` | base-grid coords if `bag_id IS NULL`; slot coords inside `bag_id` if not; `(-1, -1)` for container/inactive bags |
| `bag_id` | non-null = this row is a bagged item; references another row in the same round |
| `active`, `rotated` | bag-row state |

**Target (BB-aligned)**:

| col | meaning |
|---|---|
| `x, y` | absolute coords on the shared grid for every placed entity (bags + items); `(-1, -1)` for container |
| `rotated` | rotation state (every entity, not just bags) |
| `active` | for bag rows: 1 = on the grid, 0 = in container |
| ~~`bag_id`~~ | **dropped** — bag membership derived from overlap |

This is additive-then-subtractive: we can add absolute-coord support alongside the existing slot-coord encoding, migrate code incrementally, then drop `bag_id` once nothing reads it.

## Mapping back to the phased plan

| Plan phase | BB alignment |
|---|---|
| **Phase 1 (current)** — Unified grid, base inv as virtual obstacle, alongside-anchor packer | Stepping stone. Visually matches BB; underlying coords still slot-based; "base inventory" is a temporary pre-bag stand-in. **No schema change.** |
| **Phase 2 (planned)** — Items can span adjacent bags with primary `bagId` attribution | Stepping stone toward many-to-many membership. Server validator relaxes the per-bag bounds check; client computes per-cell coverage. **No schema change.** |
| **Phase 3 (new, BB-aligned)** — Replace base inventory with a "starter bag" artifact | Adds a starter-bag artifact + per-character mapping. Base inv becomes a regular bag (initially locked in place). Validators stop special-casing base inv. **No schema change** (the starter bag is just another bag row). |
| **Phase 4 (new, BB-aligned)** — Absolute-coord items, derived many-to-many membership | The "real" BB model. Migration: add `x_abs, y_abs` columns (or re-interpret `x, y` for items; trickier), populate from existing slot-coord rows on read, drop `bag_id` reads, then drop the column. **Schema migration.** |
| **Phase 5 (BB-aligned)** — Per-bag effects + adjacency synergies in battle resolution | Hooks into the new derived-membership model. Battle service queries `bagsContainingItem` per item, applies effects. **No schema change beyond what Phase 4 brings.** |

Phase 1 ships now (mostly already done). Phases 2–5 are separate task specs; they should be opened only when the user is ready to commit to BB-style multi-bag membership and the schema migration that goes with it.

## Open questions for the user (when Phases 3+ get scheduled)

- **Starter bag locked or movable?** BB lets you pick up the class bag. We could ship the starter bag as **immovable** (acts like a base inventory) and unlock it later, or as movable from day one (matches BB).
- **Bag drag carries items, or does the user empty the bag first?** BB carries items. Our current empty-bag guard would be replaced by "pick up bag + contents".
- **Schema migration path**: column additions vs reinterpretation of existing `x, y` for items. Both work; the choice is "smaller diff vs cleaner data model."

## What this means for Phase 1 (unchanged)

Phase 1 stays as the bag-grid-unification plan describes:
- Unified visual grid, no separate sections.
- Base inventory at fixed `(0..2, 0..2)` as a virtual obstacle.
- Bags pack alongside via the 2D first-fit packer.
- Items still use slot coords + `bagId`; persistence contract unchanged.

The "base inventory as virtual obstacle" model is **temporary scaffolding** that disappears in Phase 3 (replaced by a real starter bag). Phase 1 doesn't lock us out of the BB-aligned end state — it just delays the schema work.
