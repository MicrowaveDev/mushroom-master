# Shop, Bag, Inventory — Runtime Architecture

How the three prep-phase surfaces (shop, container/backpack, unified grid) work together at runtime: the state buckets, the data flow between them, the coordinate systems, and the validator that enforces the invariants.

For game-design rationale and acceptance rules see [game-requirements.md §2 (Inventory & Grid), §4 (Economy), §5 (Bags)](game-requirements.md). For the storage contract and historical justification of slot coords see [bag-item-placement-persistence.md](bag-item-placement-persistence.md), [bag-active-persistence.md](bag-active-persistence.md), [bag-rotated-persistence.md](bag-rotated-persistence.md).

## The three surfaces

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   SHOP (per-round offers)   │  │   CONTAINER (backpack)      │
│   shopOffer: artifactId[]   │  │   containerItems:           │
│                             │  │     {id, artifactId}[]      │
│   buy ───────────────────── │ ─→  add slot (id from /buy)    │
│   ←─── sell (refund coins)  │  │                             │
└─────────────────────────────┘  └─────┬───────────────────────┘
                                       │
                       activate (bag)  │  place (non-bag)
                                       ↓
┌─────────────────────────────────────────────────────────────┐
│   UNIFIED GRID (BAG_COLUMNS = 6 wide, height = max(         │
│     INVENTORY_ROWS, max(anchorY + bag.rows)))               │
│                                                             │
│   ┌───────────────┐                                         │
│   │ BASE INVENTORY│   ← always (0..INVENTORY_COLUMNS-1,     │
│   │   3 × 3       │     0..INVENTORY_ROWS-1) — virtual      │
│   └───────────────┘     obstacle for the bag packer         │
│                                                             │
│   activeBags[i] anchors at (anchorX, anchorY) anywhere in   │
│   the unified grid that doesn't collide with the base       │
│   inventory or another bag's footprint.                     │
└─────────────────────────────────────────────────────────────┘
                                ↓
                          BATTLE PHASE
            (only grid-placed + bag-placed items contribute stats — Req 2-D)
```

**Shop** — per-round random offer of `SHOP_OFFER_SIZE = 5` artifact ids, with `BAG_BASE_CHANCE` + escalation/pity producing bags every few rounds (Req 5-D).

**Container (backpack)** — unlimited holding area for purchased-but-unplaced items. Items here do **not** count toward combat stats (Req 2-C).

**Unified grid** — one continuous surface, `BAG_COLUMNS = 6` wide (Req 2-F). The **base inventory** is the fixed `INVENTORY_COLUMNS × INVENTORY_ROWS = 3 × 3 = 9`-cell rectangle anchored at `(0, 0)` — it's always there and acts as a virtual obstacle to the bag packer. **Bags** are added to the same grid; each active bag has a 2D anchor `(anchorX, anchorY)` in unified-grid coords. A bag may anchor alongside the base inventory (e.g. at `(3, 0)` for a 2-wide bag) or below it; the packer prefers the topmost-leftmost free fit. Cells outside both the base inventory and any active bag's slot mask are **empty bag area** — visible but not droppable for items (only chip drag can re-anchor a bag onto them).

## Client state buckets

All buckets live on the reactive root state (`web/src/main.js` `setup()`):

| Bucket | Shape | Meaning |
|---|---|---|
| `shopOffer` | `string[]` (artifactIds) | Current round's shop offer |
| `containerItems` | `{id, artifactId}[]` | Purchased but unplaced (includes inactive bags) |
| `builderItems` | `{id, artifactId, x, y, width, height, bagId?}[]` | Placed items (grid + bag-zone) |
| `activeBags` | `{id, artifactId, anchorX, anchorY}[]` | Bags with their bag-zone anchor |
| `rotatedBags` | `{id, artifactId}[]` | Which active bags are in the rotated orientation |
| `freshPurchases` | `string[]` | Bought-this-round ids — controls full-price refunds |
| `rerollSpent` | `number` | Coins spent on shop refresh this round |
| `draggingArtifactId` / `draggingItem` / `draggingBagId` / `draggingSource` | strings + objects | DnD context for the next drop handler |

`builderItems[i].id` is the **server loadout row id** when known; absent on freshly placed items until the next persist round-trip stamps it back. `bagId` on a builderItem is the **loadout row id of the bag** the item belongs to (not the bag's artifactId — duplicates would collide). See [client-row-id-refactor.md](client-row-id-refactor.md) for the row-id contract.

## Lifecycle

### 1. Buy from shop → container

Real flow ([useGameRun.js](../web/src/composables/useGameRun.js) `buyRunShopItem`):
1. Client `POST /api/game-run/:id/buy { artifactId }`.
2. Server validates coin budget, allocates a `GameRunLoadoutItem` row, returns the `{id}`.
3. Client appends `{id, artifactId}` to `containerItems`, ids the artifactId in `freshPurchases`.
4. `persistRunLoadout` is *not* called — the buy endpoint is its own write.

Legacy buffered shop ([useShop.js](../web/src/composables/useShop.js) `buyFromShop`) appends with `id: null`; `persistRunLoadout` then claims a server row.

### 2. Place a non-bag item from container → inventory or bag-zone cell

Triggered by clicking on a container item (auto-place) or DnD onto a cell:
1. `placeFromContainer(artifactId, x, y)` or `autoPlaceFromContainer(artifactId)` (scans for a fit).
2. `normalizePlacement` validates: bounds (`INVENTORY_COLUMNS` for `y < 3`, `BAG_COLUMNS` for `y ≥ 3`), no overlap, no disabled bag-mask cells.
3. `bagForCell(x, y)` resolves the cell's `bagId` (null for inventory cells, a bag's loadout row id for bag-zone cells).
4. New entry pushed to `builderItems` with `(x, y, width, height, bagId)`.
5. `popOneFromContainer` removes one matching slot (preserves duplicates).
6. `persistRunLoadout` writes the new layout to the server.

### 3. Activate a bag → container → unified grid (with auto-pack)

`activateBag(artifactId)`:
1. Pop the matching slot from `containerItems`.
2. Compute the bag's effective shape (rotation-aware); `cols = min(BAG_COLUMNS, shape.cols)`, `rows = shape.rows`.
3. **2D first-fit packer** (`findFirstFitAnchor`) scans the unified grid top-to-bottom, left-to-right for the first `(anchorX, anchorY)` whose `cols × rows` rectangle doesn't overlap (a) the base inventory at `(0..INVENTORY_COLUMNS-1, 0..INVENTORY_ROWS-1)`, or (b) any other active bag's bounding box.
4. Push `{...slot, anchorX, anchorY}` onto `activeBags`. Persist.

A 2×1 `moss_pouch` activated against an empty layout anchors at `(3, 0)` — alongside the base inventory in row 0 — not at `(0, 3)` below it (Req 2-G).

### 4. Re-anchor a bag (chip drag, Req 2-H)

Only **empty** bags can move — a non-empty bag's items would lose their slot identity:
1. `canMoveBag(bagId)` checks `state.builderItems.some(it => it.bagId === bagId)` (true if any item references this bag).
2. `onBagChipDragStart` aborts via `event.preventDefault()` if the chip is locked. The chip's `draggable` attribute is also bound to `canMoveBag` so the browser never starts a drag in the first place; the dragstart handler is a defence-in-depth.
3. The bag chip's title shows the i18n strings `bagDragHint` (movable) or `bagDragBlocked` (locked).
4. Drop fires `onInventoryCellDrop({x, y})` (the same emit ArtifactGridBoard uses for piece drops); the handler dispatches by `state.draggingSource === 'bag-chip'` to `onBagZoneDrop({x, y})` (no offset — coords are already unified).
5. `onBagZoneDrop` validates: `anchorX + cols ≤ BAG_COLUMNS`, no overlap with the base inventory or other active bags. On reject, sets `state.error` to `errorDoesNotFit`.
6. On accept, re-builds the active layout; `relayoutBaggedItems` recomputes virtual `(x, y)` for any items in this bag (which can't happen since it's empty, but the contract is consistent with `rotateBag` / `deactivateBag`).

### 5. Rotate / deactivate a bag

`rotateBag(artifactId)` and `deactivateBag(artifactId)` enforce the same empty-bag invariant: blocked with `errorBagNotEmpty` if the bag still holds items. They also use `relayoutBaggedItems` (a no-op for an empty bag, but kept for contract symmetry).

`rotateBag` additionally validates that the rotated footprint stays inside `BAG_COLUMNS` and doesn't overlap another active bag.

### 6. Sell from container → coins back

Item sold via the sell zone or the container's `×` button:
1. `sellRunItemAction(slot)` → `POST /api/game-run/:id/sell { id | artifactId }`.
2. Server refunds: full price if `freshPurchase=1` this round, else `Math.max(1, floor(price/2))` (Req 4-J/K).
3. Client removes the slot from `containerItems`. Bag selling is blocked server-side if the bag still holds items (Req 4-L).

## Coordinate systems

There are **two coord systems in client memory** (virtual + slot) and **one on the server** (slot only). The client deliberately keeps virtual coords for rendering ergonomics; the server never sees them.

### Base inventory cells (virtual = slot)
```
x ∈ [0, INVENTORY_COLUMNS)   y ∈ [0, INVENTORY_ROWS)
```
Items here have `bagId = null`. Stored on the server with the same `(x, y)`.

### Bag cells (virtual ≠ slot)

A bag at anchor `(ax, ay)` covers unified-grid cells:
```
x ∈ [ax, ax + bag.cols)        y ∈ [ay, ay + bag.rows)
```

A bagged item with **virtual** coords `(vx, vy)` decomposes into **slot** coords:
```
slotX = vx - bag.anchorX
slotY = vy - bag.anchorY
```

The server stores `(slotX, slotY) ∈ [0, bag.cols) × [0, bag.rows)`. The client reconstructs virtual coords on hydrate by adding the bag's anchor (which the projection re-derives via the same 2D first-fit packer).

**Why two systems**: the server contract is rotation/anchor-stable — re-anchoring or rotating a bag doesn't invalidate any persisted bagged-item rows. The client uses unified virtual coords because the renderer treats the base inventory and all active bags as one continuous grid.

### Drop-target dispatch

`ArtifactGridBoard` emits a single `cell-drop` event with unified `(x, y)`. The parent (`useShop.onInventoryCellDrop`) dispatches by drag source: `bag-chip` drags route to `onBagZoneDrop` (re-anchor a bag); piece drags route to `placeFromContainer` / inventory-piece drag handler. There's no separate "bag-zone-local" coord system — every drop happens in unified coords.

## Persistence and projection

**Outgoing** ([useGameRun.js](../web/src/composables/useGameRun.js) `buildLoadoutPayloadItems`): walks `state.activeBags` to build an `activeBagLayout` with each bag's `{anchorX, anchorY, startRow, colCount, rowCount}`, then maps each `builderItem`:
- `y < INVENTORY_ROWS` → grid item, payload `(x, y)` as-is.
- `y ≥ INVENTORY_ROWS` and a matching bag covers `(x, y)` → bagged item, payload `x = vx - anchorX`, `y = vy - startRow`, `bagId = bag.bagRowId`.
- Stale bagged items (bag deactivated, mismatched coords) → fall back to container sentinel `(-1, -1)` so the next hydrate reconciles.

Bag rows themselves carry `(x = -1, y = -1)` plus `active`, `rotated` flags. Anchors are **not** persisted in v1.

**Incoming** ([loadout-projection.js](../web/src/composables/loadout-projection.js)):
- Pass 1: collect bag descriptors `{id, artifactId, cols, rows}` from `active=1` rows. Hand them to `packAnchors` (the projection-side mirror of `findFirstFitAnchor`) which assigns `anchorX, anchorY` deterministically from declaration order.
- Pass 2: route bagged items — `virtualX = bag.anchorX + slotX`, `virtualY = bag.startRow + slotY`. Out-of-bounds slot coords (bag deactivated, footprint shrunk by rotation, etc.) fall back to `containerItems`.

The projection's packer is a **byte-for-byte equivalent** of the client's `findFirstFitAnchor`. Bags get the same anchors after a reload as they had right after the user activated them in declaration order. **Drag-customised anchors do not survive a reload**; they re-pack to the auto-pack arrangement. Persisting anchors would require either new `anchor_x` / `anchor_y` columns or extending the `(x, y)` semantic for `active=1` bag rows; both are tracked as future work.

## Validators (server-side)

[loadout-utils.js](../app/server/services/loadout-utils.js) runs three validators in sequence on every persist:

1. **`validateGridItems`** — bounds + overlap for non-bag, non-bagged items in the base grid. Rejects bag rows that don't carry the `(-1, -1)` sentinel.
2. **`validateBagContents`** — for each bagged item: `bagId` resolves to a placed bag; slot `(x, y)` fits inside the bag's effective shape mask (rotation-aware); no two bagged items overlap inside the same bag; total slot usage ≤ `slotCount`.
3. **`validateCoinBudget`** — sum of artifact prices ≤ `MAX_ARTIFACT_COINS` (factoring in starter preset cost).

Failures throw and are mapped to a `400 Bad Request` by the loadout endpoint. The client catches and renders `state.error`.

## Cross-references

- Game rules: [game-requirements.md §2 / §4 / §5](game-requirements.md)
- Item-coords storage contract: [bag-item-placement-persistence.md](bag-item-placement-persistence.md)
- Bag activation persistence: [bag-active-persistence.md](bag-active-persistence.md)
- Bag rotation persistence: [bag-rotated-persistence.md](bag-rotated-persistence.md)
- Row-id identity: [client-row-id-refactor.md](client-row-id-refactor.md)
- High-level board spec: [artifact-board-spec.md](artifact-board-spec.md)
