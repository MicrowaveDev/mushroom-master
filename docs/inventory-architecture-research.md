# Inventory & Bag Architecture — External Research and Recommendation

**Type:** Independent external research. Supplementary to the in-flight bag-grid-unification plan; not authoritative spec.
**Status:** Draft 2026-04-26, revised after reviewing in-flight plan artifacts.
**Triggering bug:** Red banner observed in dev: `Bagged item stone_cap is out of bounds for bag trefoil_sack`.

## 0. TL;DR

The "out of bounds for bag" error is the symptom of a **transitional model**: bags as parent containers with an internal slot-coord space, items referencing parents via `bag_id`. The team is migrating to a Backpack-Battles-aligned model — single shared grid, bags as first-class placed entities, derived many-to-many membership from tile overlap, no `bag_id`. Phase 1 (visual + coord unification) shipped 2026-04-24. Phase 3+4 (starter-bag artifact, absolute-coord items, drop `bag_id`) is **specced but deferred behind a ~120-test fixture sweep**.

This document adds three things to the existing plan:

1. **Open-source survey** of grid-inventory implementations (§4) — confirms BB has no clean off-the-shelf clone; FarrokhGames, GLoot, and ottoblep/backpack-battles-solver are the strongest reference points. Not vendor-ready; build it ourselves.
2. **Named diagnosis of the "out of bounds for bag" bug class** (§2, §3) — useful as a regression-test fixture for Phase 4.
3. **Notes on where the team's chosen design diverges from BB** (§5) — and why those divergences are sound choices, not gaps.

## 1. Where this fits in the existing plan

Authoritative artifacts (read these first):

- [`.agent/tasks/bag-grid-unification/spec.md`](../.agent/tasks/bag-grid-unification/spec.md) — phased plan + Phase-1 evidence
- [`.agent/tasks/bag-grid-unification/phase-3-4-spec.md`](../.agent/tasks/bag-grid-unification/phase-3-4-spec.md) — phases 3+4 detail and current blocker
- [`.agent/tasks/bag-grid-unification/research-backpack-battles.md`](../.agent/tasks/bag-grid-unification/research-backpack-battles.md) — internal BB findings
- [`game-requirements.md`](game-requirements.md) §2, items 2-A through 2-M — current spec including phase markers

Phase status as of 2026-04-26:

| Phase | State | What ships |
|---|---|---|
| 1 — Unified visual grid + unified anchor coords | **shipped** 2026-04-24 | One grid surface, `BAG_COLUMNS = 6`, alongside-anchor packer, base inv as virtual obstacle |
| 2 — Items spanning adjacent bags | **skipped** | Subsumed by Phase 4 |
| 3 — Starter-bag artifact replaces base inventory | **partial** | Artifact added to catalog; seeding deferred |
| 4 — Absolute-coord items + derived many-to-many membership | **scoped, deferred** | First impl pass surfaced ~120 test fixtures needing update |
| 5 — Per-bag effects + adjacency synergies at battle resolution | **deferred** | Hooks into Phase-4 derivation |

User-locked decisions (2026-04-24, in [`phase-3-4-spec.md`](../.agent/tasks/bag-grid-unification/phase-3-4-spec.md)):

- **Starter bag is movable** — same chip-drag as any other bag.
- **Bag drag does NOT carry items** — items unplace to container before bag moves/rotates/deactivates. Diverges from BB; chosen for simpler state machine.
- **No DB migration** — `bag_id` column dropped outright (no production database exists).

## 2. The "out of bounds for bag" bug class

The error string `Bagged item X is out of bounds for bag Y` does not appear in the current code (`grep` returns no matches). It is the bug class the v1 model **fails to detect** but doesn't currently throw. Two scenarios that produce visible symptoms:

1. **Implicit layout drift.** Bagged items are persisted with `bag_id` and `(slotX, slotY)` relative to the bag's anchor, but `validateBagContents` only checks total area against `bag.slotCount` — not whether two items in the same bag overlap, nor whether a single item's `(slotX + width, slotY + height)` fits inside `bag.cols × bag.rows`. When a Phase-1 follow-up adds a tighter validator, items that were tolerated under the loose check fail the new one.
2. **Bag swap / rotate edge cases.** Today rotation is blocked when the bag has items (`emptyBagOnly` guard). If the guard is bypassed (test seeding, partial state restore, future "rotate with contents" feature), the bag's effective shape changes but item slot coords don't — items can end up addressing slot cells the bag no longer covers.

Both scenarios disappear in the Phase-4 model (absolute coords + derived membership): there is no slot-coord space to be out of bounds of. The validator becomes `validateItemCoverage` (per-cell coverage of every item by some active bag), and rotation/move is preceded by unplacing overlapping items per the user-locked decision.

## 3. v1-state diagnosis (cross-check against the existing plan)

These are the seams the Phase-3+4 work targets. Listed here to pair with concrete file locations for anyone reading the plan cold.

### 3.1 Storage discriminated by `bag_id` presence

DB row (`game_run_loadout_items`):

```
id, game_run_id, player_id, round_number, artifact_id,
x, y, width, height,
bag_id,                        -- NULL = grid item; non-null = bagged
sort_order, purchased_round, fresh_purchase, active, rotated, created_at
```

Wire payload has four shapes (active bag, bagged item, grid item, container item) — each consumer must branch. Phase 4 collapses these to two (placed: absolute `(x, y)`; container: `(-1, -1)`).

### 3.2 Two validator paths, neither catches spatial-bag-bounds

| Validator | File | Checks |
|---|---|---|
| `validateGridItems` | [loadout-utils.js](../app/server/services/loadout-utils.js) | bag has no grid coords; bounds; pairwise overlap (grid items only) |
| `validateBagContents` | [loadout-utils.js](../app/server/services/loadout-utils.js) | no bag-in-bag; valid `bag_id` ref; bag is placed; capacity by `slotCount` |

Neither validates per-cell coverage of bagged items inside the bag's shape mask. Phase 4 replaces both with `validateItemCoverage` per [`phase-3-4-spec.md`](../.agent/tasks/bag-grid-unification/phase-3-4-spec.md) Step D.

### 3.3 Frontend defensive fallback hides the symptom

[`useGameRun.js`](../web/src/composables/useGameRun.js) in `buildLoadoutPayloadItems`: a bagged item with a `y` that no `activeBagLayout` entry covers is silently rewritten to `(-1, -1)` (container). No error surfaced to user. This is the v1 mitigation — Phase 4's per-cell coverage check makes it unnecessary because the placement either covers cells or it doesn't.

### 3.4 What Phase 1 already fixed

Per the [Phase 1 evidence section](../.agent/tasks/bag-grid-unification/spec.md):

- Unified anchor coords across base inventory and bags (no more `INVENTORY_ROWS` offset for bag virtual rows).
- `findFirstFitAnchor` + `bagAreaOverlaps` use unified coords with the base inventory as a virtual obstacle.
- `ArtifactGridBoard` renders one grid surface, not two stacked sections.
- `loadout-projection.packAnchors` mirrors the client packer — both ends agree on layout deterministically on hydrate.

What Phase 1 did **not** fix: the bagged-item storage contract (still slot coords + `bag_id`), the validator surface (still split), and the four-shape wire payload. These are Phase 3+4.

## 4. Open-source reference points

None are vendor-ready. All are useful reading for the Phase-4 implementation pass.

| Repo | Engine / Lang | Stars | Relevance |
|---|---|---|---|
| [ottoblep/backpack-battles-solver](https://github.com/ottoblep/backpack-battles-solver) | C++ | low | Greedy/random placement solver for BB. Confirms BB's flat model: items + bags as flat lists, no tree. Useful as a sanity check on the data shape. |
| [FarrokhGames/Inventory](https://github.com/FarrokhGames/Inventory) | Unity / C# | 283 | Diablo-2 style single-grid. Cleanest validator API to copy: `CanAdd / CanAddAt / CanSwap`. 75+ unit tests. Single-level only — does not solve nested containers, which is fine because Phase 4 doesn't either. |
| [peter-kish/gloot](https://github.com/peter-kish/gloot) | Godot 4 / GDScript | ~913, active | Constraint-stack composition pattern (`GridConstraint`, `WeightConstraint`, `ItemCountConstraint`). Good template for splitting `validateItemCoverage` from `validateCoinBudget` cleanly. |
| [alpapaydin/Godot-4-Grid-Inventory-with-Patterns](https://github.com/alpapaydin/Godot-4-Grid-Inventory-with-Patterns) | Godot 4 / GDScript | 25 | Shape masks (L, T, irregular). Mushroom already supports tetromino bags; this is forward-compat reference if irregular bags ever ship. |
| [Synock/UE5Inventory](https://github.com/Synock/UE5Inventory) | UE5 / C++ | 159 | Bags as equippable items that "extend inventory space" — flattens into the parent grid. Same end-state model as Phase 4. |
| [Backpack-Battles GitHub org](https://github.com/orgs/Backpack-Battles/repositories) | — | — | **Empty.** No open-source BB clone exists. |

TypeScript/JS ecosystem: nothing production-grade. The Phase-4 implementation is bespoke; no library short-cut available.

### Architectural reading

- Khalil Stemmler — [Make Illegal States Unrepresentable (TS DDD)](https://khalilstemmler.com/articles/typescript-domain-driven-design/make-illegal-states-unrepresentable/)
- Chris Krycho — [Making Illegal States Unrepresentable in TypeScript](https://v5.chriskrycho.com/journal/making-illegal-states-unrepresentable-in-ts/)
- Mimetrik Games — [Composite Pattern in game inventories](https://mimetrikgames.com/composite-design-pattern-what-it-is/)

These argue for what the team is already doing in Phase 4: a single coordinate space and validators that make orphan/out-of-bounds states unconstructable rather than caught.

## 5. Where the team diverges from BB (and why it's fine)

Three deliberate divergences, all locked in [`phase-3-4-spec.md`](../.agent/tasks/bag-grid-unification/phase-3-4-spec.md):

1. **Bag drag unplaces items instead of carrying them.** BB lifts the connected component as a rigid body. The mushroom team's choice: items return to the container before the bag moves. Trade-off: simpler state machine, no group-translation algebra, no need for "the rotated group doesn't fit anywhere" rejection UX. Cost: one extra player action per move. Reasonable for v1; can be revisited later without breaking the storage contract (purely a UI-state change).

2. **Single shared `starter_bag` artifact, not per-character class bags.** BB ships unique class bags (Reaper's Storage Coffin, Ranger's Leather Bag, etc.) with different shapes and tile counts. The mushroom team's choice: one 3×3 starter bag for all characters; signature items still come from `STARTER_PRESETS`. Trade-off: less character-flavor differentiation in the bag itself; preserves the existing 9-cell starting capacity exactly. Per-character starter bags are explicitly listed as a future customization pass.

3. **Typed bags (herb-only / fire-only) are out of scope.** BB has no typed bags — every bag accepts every item, and effects gate on item tags. The mushroom design hints at typed bags (the `trefoil_sack` name suggests an herb sack). External recommendation: if typed bags ship, encode them as **placement-time predicates** on the unified validator (`bag.acceptsPredicate(item)` checked against every item whose footprint touches the bag), not as a separate sub-container type. This composes cleanly on top of the Phase-4 derived-membership model.

Where this document originally proposed a TS "smart-constructor `Rucksack` value-object" pattern: that was a generic restatement of the Phase-4 invariants in a TypeScript idiom. The actual Phase-4 plan is JavaScript and uses imperative validators (`validateItemCoverage`, `validateGridItems`). The invariants are the same; the language idiom is a stylistic choice, not a substantive disagreement.

## 6. Suggested next steps

The structural fix is in [`phase-3-4-spec.md`](../.agent/tasks/bag-grid-unification/phase-3-4-spec.md). What this document suggests on top of that:

1. **Treat the ~120-test fixture sweep as the critical-path blocker for Phase 3+4.** Per the spec's "Implementation notes from the first pass": a focused task with three commits — server (insertLoadoutItem + validators + seeding), client (payload + projection + useShop + InventoryZone), tests (systematic fixture update). The phase docs are good; the bottleneck is dedicated session time for the sweep.
2. **Add an explicit regression test for the "out of bounds for bag" symptom** keyed to the Phase-4 `validateItemCoverage` invariant. Construct a fixture where a stale slot coord would address a cell outside any active bag's mask; assert the validator throws with a recognisable error string. Lives in [`tests/game/validator-split.test.js`](../tests/game/validator-split.test.js) (the file Phase 4 plans to expand anyway).
3. **Cross-link this document from [`research-backpack-battles.md`](../.agent/tasks/bag-grid-unification/research-backpack-battles.md)** so future engineers find the open-source survey alongside the internal BB analysis.
4. **Defer typed-bag predicates** to a separate task post-Phase 4 — they compose cleanly on derived membership but should not block the migration.

Until Phase 4 ships, the immediate "out of bounds for bag" symptom can be patched defensively at the UI boundary. That is a workaround. The structural fix is the bag-grid-unification migration the team has already designed.
