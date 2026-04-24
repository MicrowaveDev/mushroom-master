# Bag-grid unification

## Source of truth

**Original request (verbatim, across the conversation):**

> "грибная лоза can be placed in the right side, but it placed in the bottom, cover it with e2e tests"
>
> "it should be more columns available to place bags, and we also need ability to drag n drop bags to reorganize it"
>
> "(a), and it should be able to move bag only if its empty, mention it in the ui"
>
> "why we need spacing? base bag should work as regular bag, and other bags just added to the grid along with a base bag"
>
> "and items can be placed in several bags if its on the edge"

**What "shipped" means here**: the prep-phase grid renders the base inventory and any active bags as a single coherent surface; bags can pack alongside the inventory (not just below it); items that straddle the boundary between adjacent bags are accepted; and the existing visual + persistence guarantees stay intact.

### Acceptance criteria

- **AC1.** The prep-phase loadout panel renders **one grid**, not two stacked sections. There is no horizontal divider, no margin, and no spacing between the base inventory rows and the bag rows; bag-zone cells flow directly out of the inventory grid.
- **AC2.** Bag anchor coords live in the **same coordinate space** as the base inventory: `anchorX ∈ [0, BAG_COLUMNS)`, `anchorY ∈ [0, ∞)`. The base inventory's `INVENTORY_COLUMNS × INVENTORY_ROWS` rectangle at `(0, 0)` acts as a virtual obstacle for the 2D first-fit packer.
- **AC3.** Activating two bags whose footprints fit alongside the base inventory anchors them in the empty cells of rows 0..INVENTORY_ROWS-1 before extending the grid downward. Example: with the base inventory at cols 0..2, a 2×1 `moss_pouch` packs at `(3, 0)`, not `(0, 3)`.
- **AC4.** Items placed at the boundary between two adjacent bags (or between the base inventory and an adjacent bag) are accepted as long as **every cell** the item occupies is in either the base inventory or an active bag's slot mask. The item is **attributed to one primary bag** for storage (the bag whose anchor is closest to the item's top-left corner; `null` if the top-left lands in the base inventory).
- **AC5.** All existing invariants survive: bag rotation/deactivation/removal still respect the empty-bag guard; `validateGridItems` / `validateBagContents` / `validateCoinBudget` still run server-side; reload still re-derives anchors deterministically via `loadout-projection`'s 2D packer.
- **AC6.** Game requirements (`docs/game-requirements.md` §2-F, §2-G, new §2-H) are updated to describe the unified-grid model. The architecture overview (`docs/shop-bag-inventory-architecture.md`) is updated to match.
- **AC7.** All 336+ existing tests still pass; new unit tests cover the unified packer (base-inventory obstacle, alongside-inventory anchors) and per-cell coverage validation; the bag-zone E2E spec is updated to the unified layout and screenshots regenerated at mobile + desktop.

### Constraints

- **C1.** Anchor persistence stays out of scope (anchors are still re-derived via `packAnchors` on every hydrate, matching v1 of the bag-zone work). Drag-customised anchors don't survive reload.
- **C2.** The bagged-item storage contract in `bag-item-placement-persistence.md` continues to hold for items wholly inside a single bag: `(slotX, slotY)` relative to the bag's anchor, with `bagId` pointing at the bag's loadout row id. This minimises blast radius and keeps `validateBagContents` (server) honest.
- **C3.** No DB schema changes. Adding `anchor_x` / `anchor_y` columns or a multi-bag join table is deliberately deferred — they come with the next phase if/when needed.
- **C4.** No changes to battle resolution, replay, ghost loadouts, or the shop pity/escalation logic. The unification is purely a prep-UI + projection refactor.

### Non-goals

- **NG1.** Letting the player MOVE the base inventory (the 3×3 sub-rectangle at the top-left is fixed; it doesn't have a chip in the active-bags bar).
- **NG2.** Letting the player ROTATE the base inventory (same reason).
- **NG3.** Animating the layout (bag re-anchoring, auto-pack, etc. — out of scope; they swap instantly).
- **NG4.** Persisting the user's drag-customised anchors across reload (Phase 1 of the original bag-zone work already deferred this; it stays deferred here).

### Open assumptions

- **A1.** "Items can span several bags on the edge" is interpreted as **per-cell coverage validation**: every cell the item occupies must be in either the base inventory or an active bag's slot mask, and the item is attributed to one primary bag for storage. The slotX/slotY for that bag may go negative or exceed the bag's bounds when the item spills into adjacent cells; the server-side `validateBagContents` will be relaxed to accept this with a documented invariant. (Confirm with user if a different interpretation is meant — see Phase 2 below.)
- **A2.** The "primary bag" attribution rule is "the bag whose footprint contains the item's top-left cell, falling back to `null` (= base inventory) if the top-left lands there". This matters for shop-side and persistence semantics.

---

## Reading guide

This is a **plan document** describing how to get from the current bag-zone-local layout to a unified-grid layout. It describes work-in-progress, not the system's final shape. After Phase 1 ships:
- **Final spec** lives in `docs/game-requirements.md` (§2-F, §2-G, new §2-H) and `docs/shop-bag-inventory-architecture.md`.
- **Storage contract** stays in `docs/bag-item-placement-persistence.md`.
- This file becomes a historical record; the "Status" section at the bottom tracks ship state per phase.

---

## Phase 1 — Visual + coord unification (ships first)

Combines what the original conversation called Phase A and Phase B. They're tightly coupled: rendering one grid without unified anchor coords would still force bags below the inventory; unified anchors without one rendered grid would leave a confusing visual gap.

### Step 1.1 ✅ — `findFirstFitAnchor` + `bagAreaOverlaps` use unified coords

[useShop.js](../../web/src/composables/useShop.js).

- `bagAreaOverlaps(anchorX, anchorY, cols, rows, ignoreBagId)` gains a virtual obstacle: the base inventory rectangle `(0, 0, INVENTORY_COLUMNS, INVENTORY_ROWS)`. Always treated as occupied; ignored only when `ignoreBagId` is the sentinel `'__base_inventory__'` (we never re-anchor the base, but the parameter keeps the function symmetric with the bag check).
- `findFirstFitAnchor(cols, rows)` scans `(0..BAG_COLUMNS - cols)` × `(0..maxY)` instead of bag-zone-local coords. The first anchor whose footprint doesn't overlap the base inventory or any other bag wins.

**Verification**: unit test confirming `moss_pouch` (2×1) anchors at `(3, 0)` when the base inventory is the only obstacle; `amber_satchel` (2×2) added next anchors at `(3, 1)` (right of inventory, below moss).

### Step 1.2 ✅ — `bagForCell` + `isCellDisabled` use unified coords

[useShop.js](../../web/src/composables/useShop.js).

- `bagForCell(cx, cy)` returns `null` when `(cx, cy)` is inside the base inventory's rectangle, the bag entry when `(cx, cy)` is inside an active bag's slot mask, and `null` otherwise (empty bag area).
- `isCellDisabled(cx, cy)`:
  - **Base inventory cell** (`cx < INVENTORY_COLUMNS && cy < INVENTORY_ROWS`): `false` (regular inventory cell, droppable).
  - **Inside a bag's mask**: `false`.
  - **Outside the base inventory and outside every bag's mask**: `true` (empty bag area, no item placement; chip drag still targets it via `onBagZoneDrop`).

**Verification**: extend the existing `[bag-shape] container drop into a non-shape cell` use-shop test to also assert that drops onto cells in the empty bag area (e.g. `(5, 0)` when no bag covers it) are rejected.

### Step 1.3 ✅ — `relayoutBaggedItems` drops the `INVENTORY_ROWS` offset

[useShop.js](../../web/src/composables/useShop.js).

- Slot ↔ virtual conversion becomes `slotX = vx - anchorX`, `slotY = vy - anchorY`. No `INVENTORY_ROWS` offset.
- Same change in `normalizePlacement`'s tagging of `bagId`.

### Step 1.4 ✅ — `effectiveRows` / new `unifiedRows`

[useShop.js](../../web/src/composables/useShop.js).

- `effectiveRows()` → `Math.max(INVENTORY_ROWS, max(anchorY + bag.rows for all bags))`.
- `bagZoneRows()` removed (or kept as an alias for back-compat during the transition; remove in a follow-up cleanup commit).

### Step 1.5 ✅ — `useGameRun.js` payload converts virtual → slot without offset

[useGameRun.js](../../web/src/composables/useGameRun.js) `buildLoadoutPayloadItems`.

- `activeBagLayout[i].startRow` becomes `bag.anchorY` (was `INVENTORY_ROWS + anchorY`).
- Bagged-item conversion: `payload.x = item.x - info.anchorX`, `payload.y = item.y - info.startRow`. Same formulas, the `startRow` change is the only edit.

### Step 1.6 ✅ — `loadout-projection.js` `packAnchors` mirrors the unified packer

[loadout-projection.js](../../web/src/composables/loadout-projection.js).

- `packAnchors` gains the same base-inventory obstacle as `findFirstFitAnchor`.
- Slot → virtual: `vx = bag.anchorX + sx`, `vy = bag.anchorY + sy`. No `INVENTORY_ROWS` offset.

### Step 1.7 ✅ — `ArtifactGridBoard` renders one grid

[ArtifactGridBoard.js](../../web/src/components/ArtifactGridBoard.js).

- Remove the `artifact-grid-section` split. One background grid + one pieces overlay.
- Grid dimensions: `BAG_COLUMNS × totalRows` (from `unifiedRows()`).
- Cell classification at render time (per-cell, not per-section):
  - `(cx < INVENTORY_COLUMNS && cy < INVENTORY_ROWS)` → standard inventory cell.
  - `bagForCell(cx, cy)` matches → bag slot cell with bag color.
  - Else → empty bag area cell (faint dashed).
- `bagRowForBagZoneCell` → `bagForCell` (same lookup, just a rename); also handles the multi-bag-per-row case by checking `enabledCells.includes(cx)`.

### Step 1.8 ✅ — `InventoryZone` + `PrepScreen` props rename

- `InventoryZone` exposes `totalRows` instead of `bagZoneRows` (or accept both during transition).
- `PrepScreen.bagRows` emits row entries with **global virtual y** (`anchorY + i`, not `INVENTORY_ROWS + anchorY + i`).
- `PrepScreen.bagZoneRows` becomes `PrepScreen.totalRows` returning `Math.max(INVENTORY_ROWS, max(anchorY + rows))`.

### Step 1.9 ✅ — Update existing tests

Files touched:
- [tests/web/use-shop.test.js](../../tests/web/use-shop.test.js) — packed anchors now `(3, 0)` and `(3, 1)` for moss + amber, not `(0, 0)` and `(2, 0)`. Item virtual coords change accordingly.
- [tests/web/loadout-projection.test.js](../../tests/web/loadout-projection.test.js) — same anchor changes.
- [tests/game/solo-run.spec.js](../../tests/game/solo-run.spec.js) — bag-zone E2E asserts cells at `(3, 0)` and `(3, 1)` are slot cells.

### Step 1.10 ✅ — New unit tests

- 2D packer with base-inventory obstacle: anchor placement of moss+amber lands alongside, not below.
- Per-cell `isCellDisabled` for the four cell categories (base inv, bag slot, bag mask gap, empty bag area).
- A bag whose effective `cols + anchorX > BAG_COLUMNS` is rejected by `findFirstFitAnchor` → falls back to a row that fits.

### Step 1.11 ✅ — Update `docs/game-requirements.md` (Req 2-F, 2-G, new 2-H)

See "Requirements changes" section below.

### Step 1.12 ✅ — Update `docs/shop-bag-inventory-architecture.md`

- Replace the "two zones" section with "one unified grid".
- Coordinate-systems section: drop the `INVENTORY_ROWS` offset everywhere; anchors are unified.
- Persistence section: server still stores slot coords inside the primary bag — the only change client-side is the offset removal.

### Step 1.13 ✅ — Run full test suite, regenerate screenshots, write evidence

- `npm test` — expect ≥ 336 + new passing.
- E2E spec → 3 fresh screenshots in `.agent/tasks/telegram-autobattler-v1/raw/screenshots/run/bag-zone-*.png`.
- Self-review: open the desktop screenshot, confirm bags pack alongside inventory.

---

## Phase 2 — Items spanning multiple bags (separate ship)

Per **AC4** + **A1**. Phase 2 ships only after Phase 1 lands and verifies clean.

### What changes

- Client-side `normalizePlacement` validates **per-cell coverage** instead of single-bag fit: every cell the item occupies must be in either the base inventory or an active bag's slot mask. Placement at the boundary between two bags is now accepted.
- Client tags the placed item with a **primary bag** = the bag whose footprint contains the item's top-left cell; falls back to `null` (= base inventory cell) when the top-left lands in the base.
- Server `validateBagContents` is relaxed: a bagged item with `bagId = X` may have `(slotX + width, slotY + height)` extending past `bag.cols / bag.rows` as long as the spill cells, projected back to unified coords, land in another active bag (validation needs the full active-bag layout for the round, not just the primary bag).
  - Add a new helper `validateMultiBagSpillover` that iterates active bags in the round and confirms each spillover cell lands in another bag's mask. Throw on orphan cells.

### Why this is its own phase

- Server validator changes ripple to bot loadout generation, ghost snapshots, replay rehydration, and battle resolution (which assumes per-bag stat attribution).
- Bagged-item ↔ bag rotation interaction needs a fresh design pass: today rotating a bag never invalidates items because slot coords are bag-local. With spillover, rotating bag A could leave bag B's spilled-into cells uncovered → orphan items.
  - Likely resolution: extend `rotateBag`'s "block when bag has items" check to ALSO check "block when any other bag has items spilling INTO this bag's footprint". Same for `deactivateBag`.
- Tests need new scenarios in `tests/game/validator-split.test.js` and the round-resolution paths.

### Phase 2 acceptance criteria (deferred to dedicated spec)

- An item placed at `(2, 0)` with width 2 (cells `(2, 0)` and `(3, 0)`) is accepted when bag A covers `(2, 0)` (= base inv? no — base inv is at cols 0..2, so `(2, 0)` IS base inv; pick a clearer example) and bag B covers `(3, 0)`. Storage: `bagId = null` (top-left in base inv), `(x, y) = (2, 0)`.
- Rotating bag B is blocked when items from bag A (or base inv) extend into bag B's cells, with `errorBagNotEmpty`.
- Server validator accepts spillover, rejects orphan cells.

If user wants Phase 2 sooner, copy this section into `.agent/tasks/bag-multi-bag-items/spec.md` and design the validator changes there.

---

## Requirements changes (Phase 1)

`docs/game-requirements.md` §2 receives:

- **Updated 2-F** describing the unified grid (no separate inventory + bag zone), the `BAG_COLUMNS` width, the 2D first-fit packer that treats the base inventory as a virtual obstacle, and bags' ability to anchor alongside the inventory in cols 3..5 of rows 0..2.
- **Updated 2-G** unchanged in spirit (chip drag with empty-bag guard) but anchor coords described in unified terms.
- **New 2-H**: items can be placed at the boundary between adjacent bags; per-cell coverage validation; primary-bag attribution rule. Marked **planned (Phase 2)** until that phase ships.

---

## Status

| Phase | State | Acceptance covered | BB alignment |
|---|---|---|---|
| Phase 1 — Unified grid (base inv as obstacle) | **shipped** (2026-04-24) | AC1 ✓, AC2 ✓, AC3 ✓, AC5 ✓, AC6 ✓, AC7 ✓ | Visual match. Underlying coords still slot-based. |
| Phase 2 — Items spanning adjacent bags (primary `bagId` attribution) | **deferred** | AC4 (partial) | Stepping stone toward many-to-many membership. No schema change. |
| Phase 3 — Replace base inventory with a starter-bag artifact | **deferred** | n/a (new ACs in dedicated spec) | Removes "base inv" special-case. No schema change (starter bag is a regular bag row). |
| Phase 4 — Absolute-coord items + derived many-to-many bag membership | **deferred** | n/a (new ACs in dedicated spec) | Full BB model. **Schema migration**: drop `bag_id`, items use absolute `(x, y)`. |
| Phase 5 — Per-bag effects + adjacency synergies at battle resolution | **deferred** | n/a (new ACs in dedicated spec) | Hooks into Phase 4's derived membership. |

The end state matches Backpack Battles: a single shared grid where every placed entity (bags + items) lives in unified coords, bag membership is derived from tile overlap and is many-to-many, and "base inventory" is just a starter bag. See [research-backpack-battles.md](research-backpack-battles.md) for the BB findings and how each phase lines up.

Update this table as phases ship. Each later phase needs its own spec under `.agent/tasks/<task>/spec.md` before any code lands — the design questions in the research doc need user decisions first.

## Phase 1 — evidence (shipped 2026-04-24)

Files touched (client):
- [`web/src/constants.js`](../../web/src/constants.js), [`app/shared/config.js`](../../app/shared/config.js) — `BAG_COLUMNS = 6`.
- [`web/src/composables/useShop.js`](../../web/src/composables/useShop.js) — `findFirstFitAnchor` + `bagAreaOverlaps` with base-inventory virtual obstacle; `bagForCell` / `isCellDisabled` for unified coords; `effectiveRows` = `max(INVENTORY_ROWS, bagsBottomRow())`; `relayoutBaggedItems` drops the `INVENTORY_ROWS` offset; `normalizePlacement` / `rotatePlacedArtifact` / `autoPlaceFromContainer` / `onInventoryCellDrop` use `BAG_COLUMNS` uniformly; `onBagZoneDrop` receives unified coords.
- [`web/src/composables/useGameRun.js`](../../web/src/composables/useGameRun.js) — payload builder converts bagged items to slot coords without the `INVENTORY_ROWS` offset; added `INVENTORY_COLUMNS` import for the base-inv fallback check (regression caught by the bag-activation E2E).
- [`web/src/composables/loadout-projection.js`](../../web/src/composables/loadout-projection.js) — `packAnchors` mirrors the client packer (base-inv obstacle) and reconstructs virtual coords without the offset.
- [`web/src/components/ArtifactGridBoard.js`](../../web/src/components/ArtifactGridBoard.js) — rewritten: one grid block, `BAG_COLUMNS × max(INVENTORY_ROWS, totalRows)`. Cells tagged `--base-inv`, `--bag`, `--bag-disabled`, `--bag-empty` by per-cell classification.
- [`web/src/pages/PrepScreen.js`](../../web/src/pages/PrepScreen.js) + [`web/src/components/prep/InventoryZone.js`](../../web/src/components/prep/InventoryZone.js) — pass `totalRows` to the board; `bagRows` emits unified-row entries.
- [`web/src/styles.css`](../../web/src/styles.css) — drop section-divider rules; `--bag-empty` drop-target styling moved to top-level.

Files touched (docs):
- [`docs/game-requirements.md`](../../docs/game-requirements.md) — §2-F / §2-G / §2-H rewritten for unified grid; new §2-I (Phase 2), §2-J (Phase 4), §2-K (Phase 3), §2-L (Phase 4), §2-M (Phase 5); schema-implications table.
- [`docs/shop-bag-inventory-architecture.md`](../../docs/shop-bag-inventory-architecture.md) — "three zones" → "unified grid"; coord-systems section drops the `INVENTORY_ROWS` offset; drop-target dispatch section collapsed.
- [`docs/user-flows.md`](../../docs/user-flows.md) — Flow B Step 2 references unified grid + the 2-G alongside-packing and 2-H chip-drag contracts.
- [`docs/bag-item-placement-persistence.md`](../../docs/bag-item-placement-persistence.md) — forward pointer to Phase 4 of this plan.

Tests:
- Unit: 337 pass (6 new chip-drag tests + updated anchor expectations for 5 existing bag-layout tests; projection anchor tests updated for base-inv obstacle).
- E2E: 3 pass — `bag activation, expansion, and reload persistence`, `items, bags, and sell state all survive page reload`, `[Req 2-F, 2-G, 2-H] unified grid packs bags alongside the base inventory`.
- Screenshots regenerated at mobile + desktop in `.agent/tasks/telegram-autobattler-v1/raw/screenshots/run/bag-zone-*.png`.

Acceptance criteria status: AC1 ✓ (single unified grid, no divider/spacing), AC2 ✓ (unified anchor coords), AC3 ✓ (2×1 bag anchors at `(3, 0)` alongside inventory), AC5 ✓ (empty-bag guard, validators run server-side, reload re-derives anchors), AC6 ✓ (requirements + architecture doc match), AC7 ✓ (all tests green + new unit + E2E + screenshots). AC4 **deferred to Phase 2** as documented.
