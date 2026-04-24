# Phase 3 + 4 — starter-bag artifact + absolute-coord items

Addendum to [`spec.md`](spec.md). Phase 2 is **skipped** — Phase 4's derived bag membership subsumes it. Phase 3 + Phase 4 ship together because the starter-bag artifact (Phase 3) and the absolute-coord item model (Phase 4) are tightly coupled: the starter bag only makes sense if items live in the same coord space as bags.

## Source-of-truth decisions (user-locked, 2026-04-24)

1. **Starter bag is movable.** It's a regular bag row with a fixed default anchor `(0, 0)`; the player can re-anchor it via chip drag exactly like any other bag.
2. **Bag drag does NOT carry items (for now).** Dragging/rotating/deactivating a bag with items inside first **unplaces** those items (returns them to the container). Future phase can add "drag bag with contents". Simpler state machine today.
3. **No DB migration.** No production database exists; schema changes are free. `game_run_loadout_items.bag_id` column is dropped outright.

## Acceptance criteria

- **AC1.** `starter_bag` is a new artifact (`family: 'bag'`, `width: 3`, `height: 3`, `slotCount: 9`, `starterOnly: true`, `price: 0`). Shared across all characters — the character's signature items still live in `STARTER_PRESETS`, the starter bag just holds them on the grid.
- **AC2.** On new game run, the server seeds the starter bag as an active bag row at anchor `(0, 0)` and then seeds the character's starter preset items at `(0, 0)` and `(1, 0)` — absolute unified-grid coords. No `bag_id` link.
- **AC3.** `game_run_loadout_items.bag_id` column is **removed**. Items persist as absolute `(x, y)` on the shared grid. Bag rows persist as absolute `(x, y)` too (the anchor, not the `(-1, -1)` sentinel), with `active = 1` when on the grid and `(-1, -1)` + `active = 0` when in the container.
- **AC4.** Client `builderItems` entries do not carry `bagId`. Bag membership is derived at read-time by `bagsContainingItem(item)` — iterates active bags, returns the set whose footprint overlaps any of the item's cells.
- **AC5.** `findFirstFitAnchor` / `bagAreaOverlaps` have no special base-inventory obstacle. The starter bag IS an active bag; it appears in `state.activeBags` and the packer avoids it like any other bag.
- **AC6.** `normalizePlacement` validates **per-cell coverage**: every cell an item occupies must lie inside some active bag's slot mask. Items at the edge between two adjacent bags are accepted because each of their cells is covered by one bag or the other.
- **AC7.** Bag chip drag, rotate, and deactivate no longer block on "bag not empty". Instead, they **unplace any item whose anchor cell overlaps the bag's current footprint** (items return to the container) before the bag moves/rotates/deactivates. The empty-bag chip guard + `--locked` styling is removed.
- **AC8.** Server-side `validateBagContents` is replaced by `validateItemCoverage`: every non-bag grid item must have every cell inside some active bag's slot mask. Bag rows themselves validate as before (`active=1` requires a valid anchor, `active=0` requires `(-1,-1)`). No `bag_id` references anywhere.
- **AC9.** `loadout-projection.js` drops its base-inventory obstacle and its slot-coord arithmetic. `packAnchors` still re-derives anchors on hydrate for any bag row that lacks persisted coords (defensive fallback for corrupted data); normal path reads anchors directly from the server row.
- **AC10.** All existing tests pass; E2E screenshots regenerated at mobile + desktop. `docs/game-requirements.md`, `docs/shop-bag-inventory-architecture.md`, and `docs/bag-item-placement-persistence.md` updated to reflect the final model (the transitional 2-A/2-F/etc. language moves to the final "unified grid with starter bag" formulation).

## Non-goals (stay deferred)

- **Phase 5** — per-bag effects, adjacency synergies, multi-bag membership stat aggregation. Phase 4 establishes the derivation infrastructure but nothing consumes `bagsContainingItem` for stats yet.
- **Bag drag carries items.** Explicitly decided by user to ship the "unplace items" variant for simplicity. Future phase revisits.
- **Per-character starter bags.** Shared `starter_bag` artifact for now; per-character variants (Reaper's Coffin, Ranger's Leather Bag, etc. à la BB) are a future customization pass.

## Implementation plan

### Step A — add `starter_bag` artifact
- **A.1.** Add `starter_bag` entry to [`app/server/game-data.js`](../../app/server/game-data.js) artifacts array. Family `bag`, shape 3×3 rectangle (all cells active), `starterOnly: true`, `price: 0`, neutral color.
- **A.2.** Exclude `starter_bag` from shop pools and bot loadouts (it's `starterOnly`).

### Step B — seed starter bag on run start
- **B.1.** Locate the starter-preset seeding call (likely in `app/server/services/run-service.js` or `game-run-loadout.js`). Before inserting the character's starter items, insert a `starter_bag` row at `x=0, y=0, active=1, rotated=0` with a fresh id.
- **B.2.** Starter items still insert at `(0, 0)` and `(1, 0)` absolute coords, with `bag_id = NULL`. They happen to be covered by the starter bag's footprint, but the persistence model doesn't care.

### Step C — drop `bag_id` column
- **C.1.** Remove `bag_id` from [`app/server/models/GameRunLoadoutItem.js`](../../app/server/models/GameRunLoadoutItem.js) and its index usage in `game-run-loadout.js`.
- **C.2.** Update the table schema (drop column) — since there's no production DB, just edit the model and let `sequelize.sync()` recreate the table. Test suite resets DB on every run.

### Step D — rewrite server validators
- **D.1.** [`app/server/services/loadout-utils.js`](../../app/server/services/loadout-utils.js): replace `validateBagContents` with `validateItemCoverage(gridItems, bagRows)`. For each non-bag item, check every cell lies inside some active bag's effective shape mask. Reject on orphan cells.
- **D.2.** `validateGridItems` becomes simpler: bounds `(x + width <= BAG_COLUMNS, y + height <= totalHeight)`, no overlap. No `bag_id` special cases.
- **D.3.** Bag rows: `active=1` → validate `(x, y)` against unified-grid bounds and no-overlap with the starter bag or other active bags. `active=0` → validate `(x, y) === (-1, -1)`.

### Step E — client: drop `bagId` from items
- **E.1.** `state.builderItems[i].bagId` → gone. Audit all readers and replace with `bagsContainingItem(item, state.activeBags, getArtifact)` when needed (mostly for rotate/deactivate guards).
- **E.2.** `isBaseInventoryCell` helper — removed. Cells previously in `(0..2, 0..2)` are now part of the starter bag's footprint like any other bag cell.
- **E.3.** `bagForCell` returns the first active bag covering the cell (pick first for display color; call sites that need all matches use `bagsContainingItem`). Starter bag gets first priority only when it's the unique overlap.
- **E.4.** `normalizePlacement` — drop the `INVENTORY_COLUMNS` vs `BAG_COLUMNS` branch. All cells are unified; per-cell coverage is checked against every active bag's mask.

### Step F — client: bag drag unplaces items
- **F.1.** `onBagChipDragStart` — drop the `canMoveBag` guard. Chip is always draggable.
- **F.2.** `onBagZoneDrop` — before re-anchoring, find every item whose top-left cell lies inside the bag's current footprint and return them to the container (same path `unplaceToContainer` uses). Then apply the new anchor.
- **F.3.** `rotateBag` — same: unplace items first, then rotate.
- **F.4.** `deactivateBag` — same: unplace items first, then move the bag back to the container.
- **F.5.** Chip CSS `--locked` styling + `bagDragBlocked` i18n string are removed.

### Step G — payload + projection
- **G.1.** [`useGameRun.js`](../../web/src/composables/useGameRun.js) `buildLoadoutPayloadItems`:
  - Bag rows: send `(x, y) = (anchorX, anchorY)` for active, `(-1, -1)` for container; `active` + `rotated` as today.
  - Items: send `(x, y)` absolute, no `bagId` field.
- **G.2.** [`loadout-projection.js`](../../web/src/composables/loadout-projection.js):
  - Bag rows: `active=1` → read `(x, y)` as anchor directly. Fall back to `packAnchors` only when the server row has `(-1, -1)` (corrupted state).
  - Items: read `(x, y)` absolute, no bagId lookup.

### Step H — tests
- **H.1.** Update [`tests/web/loadout-projection.test.js`](../../tests/web/loadout-projection.test.js): starter bag is pre-seeded; items are absolute coords; bagId is gone.
- **H.2.** Update [`tests/web/use-shop.test.js`](../../tests/web/use-shop.test.js): starter bag in state.activeBags; `bagId` field gone from `builderItems`; chip-drag tests confirm items unplace.
- **H.3.** Update [`tests/game/validator-split.test.js`](../../tests/game/validator-split.test.js): `validateItemCoverage` replaces `validateBagContents`; new tests for spanning items.
- **H.4.** Update E2E `solo-run.spec.js`: starter bag visible; alongside packing still works; items can now be placed at the edge between two bags.

### Step I — docs
- **I.1.** `docs/game-requirements.md`: fold §2-I / §2-J / §2-K / §2-L / §2-M into final (non-planned) requirements. Drop the transitional language in §2-A.
- **I.2.** `docs/shop-bag-inventory-architecture.md`: update the "unified grid" section — base inventory is now a starter bag. Drop the base-inv-as-obstacle mentions.
- **I.3.** `docs/bag-item-placement-persistence.md`: rewrite the "current contract" section for absolute coords. Keep the historical explanation behind a "Legacy (pre-Phase-4)" heading.

## Status

| Step | State | Notes |
|---|---|---|
| A — starter_bag artifact | **partial** | Artifact definition added to `app/server/game-data.js` (3×3 rectangle, `starterOnly`, price 0). Not seeded yet — run-service still seeds only the preset items. Adding the artifact is a catalog-only change; safe to ship on its own. |
| B — seed on run start | **deferred** | Running the seed change on top of the existing validator contract breaks ~20 persistence tests (they filter starter-like rows by `x >= 0` and don't send explicit `active: 1` on bag rows). See the test-update items below. |
| C — drop `bag_id` column | **deferred** | Schema change can happen freely (no prod DB). Blocked by Step D since validator + persist paths still read it. |
| D — rewrite server validators | **deferred** | `validateItemCoverage` is straightforward in isolation but requires every active bag (including starter) present in the validated payload. Current tests don't include starter_bag in their fixtures — 80+ failures surfaced in a first pass. |
| E — client drop `bagId` | **deferred** | Client-side compatible with Step D once the starter bag is part of `state.activeBags` (projection already threads anchor coords through). |
| F — bag drag unplaces items | **deferred** | Helper `unplaceItemsOverlappingBag` was drafted and reverted when the broader server-side changes were rolled back. Small client-side pass once Steps D + E land. |
| G — payload + projection | **deferred** | Payload changes depend on Step C (no `bagId` field) and Step D (active bag carries anchor coords). |
| H — tests | **deferred** | Empirical scope: ~120 tests need updates spread across `bag-active-persistence`, `bag-rotated-persistence`, `bag-items`, `validator-split`, `run-lifecycle`, `challenge-run`, `bot-loadout`, `round-resolution`, `shop-service`, `loadout-projection`, `use-shop`. Most updates are: (1) include starter_bag in fixtures, (2) replace "bag at (-1, -1) with active=0" expectations with "starter bag at (0, 0) with active=1", (3) replace `bagId` lookups with overlap derivation. |
| I — docs | **deferred** | Final wording in `docs/game-requirements.md` §2-F/G/H already describes the end state. `docs/bag-item-placement-persistence.md` needs a "Legacy" heading once Step C lands. |

### Implementation notes from the first pass

First implementation pass revealed that Phase 3+4 can't ship as one atomic commit without a dedicated test-update pass. The server-side changes (insertLoadoutItem supporting bag anchors, validators, seeding, shop-service sell check) and the client-side changes (dropping `bagId` threading, payload + projection rewrite, chip-drag unplace) are internally consistent, but existing tests encode the pre-Phase-3+4 invariants (bags always at `(-1, -1)`, items attributed by `bagId`). Those tests would all need updates in the same PR.

**Recommended split for the next session:**
1. **Ship A standalone** — starter_bag artifact definition only; nothing seeds or validates it yet. Already committed on this branch as part of Phase 1 follow-up.
2. **Scope a focused "unified storage" task** with its own `.agent/tasks/<id>/spec.md` that commits to:
   - Server: insertLoadoutItem + validators + seeding in one commit
   - Client: payload + projection + useShop + InventoryZone in a second commit
   - Tests: systematic fixture update in a third commit (likely the largest diff)
   - Each commit green on its own `npm test` before the next.

Alternatively, accept a single large PR with a ~200-file test update sweep — feasible but needs a dedicated session.
