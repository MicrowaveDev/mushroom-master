import { BAG_COLUMNS, INVENTORY_COLUMNS, INVENTORY_ROWS, MAX_ARTIFACT_COINS, SHOP_OFFER_SIZE, REROLL_COST } from '../constants.js';
import { buildOccupancy, getArtifactPrice, pickRandomShopOffer, preferredOrientation } from '../artifacts/grid.js';
import { getEffectiveShape, isCellInShape } from '../../../app/shared/bag-shape.js';
import { messages } from '../i18n.js';

export function useShop(state, getArtifact, persistRunLoadout, feedback = {}) {
  const haptics = {
    impact: typeof feedback.impact === 'function' ? feedback.impact : () => {},
    notify: typeof feedback.notify === 'function' ? feedback.notify : () => {},
    selectionChanged: typeof feedback.selectionChanged === 'function' ? feedback.selectionChanged : () => {}
  };

  function isBagRotated(bagId) {
    return state.rotatedBags.some((b) => b.artifactId === bagId);
  }

  function bagLayout(bagId) {
    const bag = getArtifact(bagId);
    if (!bag) return { cols: BAG_COLUMNS, rows: 1, shape: [] };
    const rotated = isBagRotated(bagId);
    const shape = getEffectiveShape(bag, rotated);
    const cols = shape.length > 0 ? shape[0].length : 0;
    const rows = shape.length;
    return { cols: Math.min(cols, BAG_COLUMNS), rows, shape };
  }

  // True iff (cx, cy) is inside the base inventory's fixed 3x3 rectangle.
  function isBaseInventoryCell(cx, cy) {
    return cx >= 0 && cx < INVENTORY_COLUMNS && cy >= 0 && cy < INVENTORY_ROWS;
  }

  // Total rows in the unified grid: max of the base inventory's height and
  // the bottom edge of the lowest active bag. Used by ArtifactGridBoard for
  // sizing and by bounds checks.
  function effectiveRows() {
    return Math.max(INVENTORY_ROWS, bagsBottomRow());
  }

  // Translate a unified-grid (cx, cy) cell coordinate to the active bag (if
  // any) whose footprint covers that cell. Returns null for cells in the
  // base inventory, for empty cells outside any bag, and for cells outside
  // every bag's bounding box. The base inventory is intentionally NOT a bag
  // (no bagId, items there have bagId=null).
  function bagForCell(cx, cy) {
    if (isBaseInventoryCell(cx, cy)) return null;
    for (const bag of state.activeBags) {
      const layout = bagLayout(bag.artifactId);
      const ax = bag.anchorX ?? 0;
      const ay = bag.anchorY ?? 0;
      if (cx >= ax && cx < ax + layout.cols && cy >= ay && cy < ay + layout.rows) {
        return {
          // Loadout row id of the bag. Stable identity used for bagged-item
          // persistence (docs/bag-item-placement-persistence.md) and for
          // matching items to bags during rotate / deactivate / re-anchor
          // relayout. Duplicate bags of the same artifact get distinct ids.
          bagRowId: bag.id,
          bagArtifactId: bag.artifactId,
          anchorX: ax,
          anchorY: ay,
          rowCount: layout.rows,
          cols: layout.cols,
          shape: layout.shape
        };
      }
    }
    return null;
  }

  // True iff a piece can NOT be placed in (cx, cy) — either it's an empty
  // cell outside both the base inventory and any bag, or it's a gap cell
  // inside a tetromino-shaped bag's bounding box.
  function isCellDisabled(cx, cy) {
    if (isBaseInventoryCell(cx, cy)) return false; // base inv cell, droppable
    const info = bagForCell(cx, cy);
    if (!info) return true; // empty cell outside both base inv and bags
    // Tetromino-shaped bags expose a per-cell mask; cells outside the mask
    // are visual gaps within the bag's bounding box.
    const localX = cx - info.anchorX;
    const localY = cy - info.anchorY;
    return !isCellInShape(info.shape, localX, localY);
  }

  // True iff the rectangle (anchorX, anchorY, cols, rows) in the unified grid
  // overlaps the base inventory (always at (0..INVENTORY_COLUMNS-1,
  // 0..INVENTORY_ROWS-1)) or any other already-anchored bag's bounding box.
  // Used by 2D first-fit packing and by the chip-drop validator.
  function bagAreaOverlaps(anchorX, anchorY, cols, rows, ignoreBagId = null) {
    // Base inventory obstacle — always present at top-left, never moves.
    // Per Req 2-F, bags share the same coord space as the base inventory and
    // must avoid its 3x3 footprint just like any other bag.
    const baseOverlapX = anchorX < INVENTORY_COLUMNS && 0 < anchorX + cols;
    const baseOverlapY = anchorY < INVENTORY_ROWS && 0 < anchorY + rows;
    if (baseOverlapX && baseOverlapY) return true;

    for (const other of state.activeBags) {
      if (other.id === ignoreBagId) continue;
      const oLayout = bagLayout(other.artifactId);
      const ox = other.anchorX ?? 0;
      const oy = other.anchorY ?? 0;
      const overlapX = anchorX < ox + oLayout.cols && ox < anchorX + cols;
      const overlapY = anchorY < oy + oLayout.rows && oy < anchorY + rows;
      if (overlapX && overlapY) return true;
    }
    return false;
  }

  // 2D first-fit packing: scan unified-grid coords top-to-bottom, left-to
  // -right for the first anchor where this bag's bounding box fits without
  // overlapping the base inventory or any other bag. Always succeeds: we
  // extend downward unbounded (BAG_COLUMNS-wide rows are added on demand).
  // A 2x1 bag with empty layout therefore anchors at (3, 0) — alongside the
  // base inventory — not at (0, 3) below it (Req 2-G).
  function findFirstFitAnchor(cols, rows, ignoreBagId = null) {
    // Worst-case: stack below everything currently placed (which includes
    // the base inventory's INVENTORY_ROWS).
    const maxY = Math.max(INVENTORY_ROWS, bagsBottomRow()) + rows;
    for (let ay = 0; ay <= maxY; ay += 1) {
      for (let ax = 0; ax + cols <= BAG_COLUMNS; ax += 1) {
        if (!bagAreaOverlaps(ax, ay, cols, rows, ignoreBagId)) {
          return { anchorX: ax, anchorY: ay };
        }
      }
    }
    return { anchorX: 0, anchorY: maxY };
  }

  // Bottom edge of the lowest active bag (= max anchorY + bag.rows). Used by
  // the unified-grid sizing helpers.
  function bagsBottomRow() {
    let max = 0;
    for (const bag of state.activeBags) {
      const layout = bagLayout(bag.artifactId);
      const bottom = (bag.anchorY ?? 0) + layout.rows;
      if (bottom > max) max = bottom;
    }
    return max;
  }

  // Build the current unified-grid layout for every active bag, keyed by
  // the bag's loadout row id (stable across duplicate-bag instances). Used
  // to translate builderItems' virtual (x, y) ↔ slot (x, y) when the layout
  // changes (rotate, re-anchor, deactivate).
  function buildActiveLayout(activeBags, rotatedIds) {
    const layout = new Map();
    for (const bag of activeBags) {
      const artifact = getArtifact(bag.artifactId);
      if (!artifact) continue;
      const rotated = rotatedIds.has(bag.id);
      const shape = getEffectiveShape(artifact, rotated);
      const cols = Math.min(BAG_COLUMNS, shape.length > 0 ? shape[0].length : 0);
      const rows = shape.length;
      const anchorX = bag.anchorX ?? 0;
      const anchorY = bag.anchorY ?? 0;
      layout.set(bag.id, {
        anchorX,
        anchorY,
        rowCount: rows,
        cols,
        shape
      });
    }
    return layout;
  }

  // Rebuild state.builderItems after the active-bag layout changed. Bagged
  // items keep their slot coords (derived from the OLD layout's anchor); their
  // on-screen virtual (x, y) is recomputed against the NEW layout. Items whose
  // bag no longer exists in the new layout get dropped back to the container
  // so the caller can decide what to do with them.
  function relayoutBaggedItems(oldLayout, newLayout) {
    const nextBuilder = [];
    const displaced = [];
    for (const item of state.builderItems) {
      if (!item.bagId) {
        nextBuilder.push(item);
        continue;
      }
      const oldBag = oldLayout.get(item.bagId);
      const newBag = newLayout.get(item.bagId);
      if (!oldBag || !newBag) {
        displaced.push(item);
        continue;
      }
      const slotX = item.x - oldBag.anchorX;
      const slotY = item.y - oldBag.anchorY;
      // If the new bag's footprint can't hold this item — bounding box
      // exceeded OR a cell in the item's footprint sits outside the
      // shape mask — displace it. The validator would reject the stale
      // layout on the next persist anyway.
      let fits = slotX >= 0
        && slotY >= 0
        && slotX + item.width <= newBag.cols
        && slotY + item.height <= newBag.rowCount;
      if (fits && newBag.shape) {
        for (let dx = 0; fits && dx < item.width; dx += 1) {
          for (let dy = 0; fits && dy < item.height; dy += 1) {
            if (!isCellInShape(newBag.shape, slotX + dx, slotY + dy)) {
              fits = false;
            }
          }
        }
      }
      if (!fits) {
        displaced.push(item);
        continue;
      }
      nextBuilder.push({
        ...item,
        x: newBag.anchorX + slotX,
        y: newBag.anchorY + slotY
      });
    }
    return { nextBuilder, displaced };
  }

  function rotateBag(bagId) {
    const activeBag = state.activeBags.find((b) => b.artifactId === bagId);
    if (!activeBag) return;
    const bag = getArtifact(bagId);
    if (!bag || bag.width === bag.height) return;
    // Block rotation if the rotated footprint would overflow the bag zone's
    // column budget OR overlap another active bag.
    const currentlyRotated = state.rotatedBags.some((b) => b.id === activeBag.id);
    const nextShape = getEffectiveShape(bag, !currentlyRotated);
    const nextCols = nextShape.length > 0 ? nextShape[0].length : 0;
    const nextRows = nextShape.length;
    const ax = activeBag.anchorX ?? 0;
    const ay = activeBag.anchorY ?? 0;
    if (ax + nextCols > BAG_COLUMNS || bagAreaOverlaps(ax, ay, nextCols, nextRows, activeBag.id)) {
      haptics.notify('error');
      return;
    }
    // Block only if THIS bag still holds items. Later bags are independent
    // — their slot coords are relative to their own bag, and relayoutBagged
    // Items recomputes their virtual y against the new layout.
    const itemsInThisBag = state.builderItems.filter((i) => i.bagId === activeBag.id);
    if (itemsInThisBag.length) {
      state.error = messages[state.lang].errorBagNotEmpty;
      haptics.notify('error');
      return;
    }
    const rotatedIds = new Set(state.rotatedBags.map((b) => b.id));
    const oldLayout = buildActiveLayout(state.activeBags, rotatedIds);
    // Toggle rotation.
    if (rotatedIds.has(activeBag.id)) rotatedIds.delete(activeBag.id);
    else rotatedIds.add(activeBag.id);
    const newLayout = buildActiveLayout(state.activeBags, rotatedIds);
    const { nextBuilder } = relayoutBaggedItems(oldLayout, newLayout);
    state.builderItems = nextBuilder;
    const idx = state.rotatedBags.findIndex((b) => b.id === activeBag.id);
    if (idx >= 0) {
      state.rotatedBags = [
        ...state.rotatedBags.slice(0, idx),
        ...state.rotatedBags.slice(idx + 1)
      ];
    } else {
      state.rotatedBags = [
        ...state.rotatedBags,
        { id: activeBag.id, artifactId: activeBag.artifactId }
      ];
    }
    // Persist immediately — same contract as activateBag / deactivateBag.
    // Pre-refactor, rotateBag only mutated client state and the rotation
    // vanished on every reload because no write was ever sent.
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    haptics.selectionChanged();
  }

  // Build the next builderItems array for placing a candidate item onto the
  // grid. Used by container→grid flows only — never by inventory moves.
  // Does not filter by artifactId: the player can legitimately own multiple
  // copies and filtering would silently delete duplicates. Collision checks
  // run against every existing item; returns null if the candidate doesn't
  // fit. The `rowId` argument is the loadout row id from the container
  // slot; it lives on the placed builderItem so downstream ops (sell,
  // drag, rotate) can target the exact server row.
  function normalizePlacement(artifact, x, y, width, height, rowId = null) {
    const w = width || artifact.width;
    const h = height || artifact.height;
    // Unified grid: every cell is BAG_COLUMNS-wide. Per-cell coverage check
    // (isCellDisabled below) rejects items that straddle outside both the
    // base inventory and any active bag's slot mask.
    if (x + w > BAG_COLUMNS || y + h > effectiveRows()) return null;
    const occupied = buildOccupancy(state.builderItems);
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) {
        if (occupied.has(`${x + dx}:${y + dy}`)) return null;
        if (isCellDisabled(x + dx, y + dy)) return null;
      }
    }
    // Tag the placed item with the bag's row id if its top-left cell lands
    // inside a bag (else null = base inventory). Phase 2 of the bag-grid
    // unification will extend this for items that span multiple bags; for
    // now items must fully fit in either the base inventory or one bag.
    const info = bagForCell(x, y);
    const bagId = info ? info.bagRowId : null;
    const candidate = { id: rowId, artifactId: artifact.id, x, y, width: w, height: h, bagId };
    return [...state.builderItems, candidate];
  }

  // Remove the first slot matching `artifactId` from containerItems and
  // return both the next array and the popped slot. The slot object
  // carries the loadout row id so the caller can thread it into whatever
  // state bucket receives the item (builderItems, activeBags, etc.).
  // Pre-refactor this was a string[] and the pop used indexOf on the id;
  // now it's Array<{ id, artifactId }> — see docs/client-row-id-refactor.md.
  function popOneFromContainer(artifactId) {
    const idx = state.containerItems.findIndex((slot) => slot.artifactId === artifactId);
    if (idx < 0) return { next: state.containerItems, removed: null };
    const removed = state.containerItems[idx];
    const next = [
      ...state.containerItems.slice(0, idx),
      ...state.containerItems.slice(idx + 1)
    ];
    return { next, removed };
  }

  // Match a builderItem by its loadout row id when available, falling back
  // to the (x,y) anchor otherwise. Row ids are stable across the entire
  // run once a row exists server-side; (x,y) is a stable per-instance key
  // for newly-placed items that haven't been reconciled yet.
  function isSameInstance(a, b) {
    if (a.id && b.id) return a.id === b.id;
    return a.x === b.x && a.y === b.y;
  }

  // True iff the container holds at least one slot with this artifactId.
  function containerHasArtifact(artifactId) {
    return state.containerItems.some((slot) => slot.artifactId === artifactId);
  }

  function rotatePlacedArtifact(item) {
    const artifact = state.bootstrap?.artifacts?.find((a) => a.id === item.artifactId);
    if (!artifact || artifact.width === artifact.height) return;
    const newWidth = item.height;
    const newHeight = item.width;
    // Exclude THIS instance (by anchor) from occupancy so the rotated
    // footprint can reuse its own cells. Must not filter by artifactId:
    // a duplicate at another position would also get erased and rebuilt.
    const others = state.builderItems.filter((it) => !isSameInstance(it, item));
    const occupied = buildOccupancy(others);
    if (item.x + newWidth > BAG_COLUMNS || item.y + newHeight > effectiveRows()) {
      state.error = messages[state.lang].errorDoesNotFit;
      haptics.notify('error');
      return;
    }
    for (let dx = 0; dx < newWidth; dx += 1) {
      for (let dy = 0; dy < newHeight; dy += 1) {
        if (occupied.has(`${item.x + dx}:${item.y + dy}`)) {
          state.error = messages[state.lang].errorDoesNotFit;
          haptics.notify('error');
          return;
        }
        // After rotation the new footprint may extend into a disabled
        // bag-zone cell (outside the bag's shape mask) — reject.
        if (isCellDisabled(item.x + dx, item.y + dy)) {
          state.error = messages[state.lang].errorDoesNotFit;
          haptics.notify('error');
          return;
        }
      }
    }
    state.builderItems = state.builderItems.map((it) =>
      isSameInstance(it, item) ? { ...it, width: newWidth, height: newHeight } : it
    );
    state.error = '';
    haptics.selectionChanged();
  }

  function computeUsedCoins() {
    const freshCost = state.freshPurchases.reduce((sum, id) => sum + getArtifactPrice(getArtifact(id)), 0);
    return freshCost + state.rerollSpent;
  }

  function rerollShop(free) {
    if (!free) {
      const remaining = Math.max(0, MAX_ARTIFACT_COINS - computeUsedCoins());
      if (remaining < REROLL_COST) {
        state.error = state.lang === 'ru'
          ? `Недостаточно монет для обновления (нужна ${REROLL_COST})`
          : `Not enough coins to reroll (need ${REROLL_COST})`;
        haptics.notify('error');
        return;
      }
      state.rerollSpent += REROLL_COST;
    }
    const ownedIds = new Set([
      ...state.builderItems.map((i) => i.artifactId),
      ...state.containerItems.map((slot) => slot.artifactId)
    ]);
    state.shopOffer = pickRandomShopOffer(state.bootstrap?.artifacts || [], ownedIds);

  }

  function buyFromShop(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact) return false;
    const price = getArtifactPrice(artifact);
    const remaining = Math.max(0, MAX_ARTIFACT_COINS - computeUsedCoins());
    if (price > remaining) {
      state.error = state.lang === 'ru'
        ? `Недостаточно монет (нужно ${price}, осталось ${remaining})`
        : `Not enough coins (need ${price}, left ${remaining})`;
      haptics.notify('error');
      return false;
    }
    state.shopOffer = state.shopOffer.filter((id) => id !== artifactId);
    // Legacy shop-buffer path: no server row id yet. Push a slot without
    // an id — the real buy flow in useGameRun stamps the row id onto the
    // container slot from the /buy response. See buyRunShopItem there.
    state.containerItems = [...state.containerItems, { id: null, artifactId }];
    state.freshPurchases = [...state.freshPurchases, artifactId];
    state.error = '';
    haptics.impact('light');

    return true;
  }

  function getSellPrice(artifactId) {
    const artifact = getArtifact(artifactId);
    const full = getArtifactPrice(artifact);
    return state.freshPurchases.includes(artifactId) ? full : Math.max(1, Math.floor(full / 2));
  }

  function returnToShop(artifactId) {
    if (!containerHasArtifact(artifactId)) return;
    const { next } = popOneFromContainer(artifactId);
    state.containerItems = next;
    // freshPurchases is decorative and artifactId-keyed by design. Any
    // remaining duplicates in the container re-earn a "fresh" badge from
    // the next buy.
    const freshIdx = state.freshPurchases.indexOf(artifactId);
    if (freshIdx >= 0) {
      state.freshPurchases = [
        ...state.freshPurchases.slice(0, freshIdx),
        ...state.freshPurchases.slice(freshIdx + 1)
      ];
    }
    if (!state.shopOffer.includes(artifactId)) {
      state.shopOffer = [...state.shopOffer, artifactId];
    }
    haptics.selectionChanged();

  }

  function placeFromContainer(artifactId, x, y) {
    const artifact = getArtifact(artifactId);
    if (!artifact) return false;
    const preferred = preferredOrientation(artifact);
    const orientations = [preferred];
    if (artifact.width !== artifact.height) {
      orientations.push({ width: preferred.height, height: preferred.width });
    }
    // Peek the first matching container slot so we can thread its row id
    // into the placed builderItem. The actual pop happens only after we
    // confirm the placement fits.
    const slot = state.containerItems.find((s) => s.artifactId === artifactId);
    const rowId = slot?.id ?? null;
    for (const orientation of orientations) {
      const next = normalizePlacement(artifact, x, y, orientation.width, orientation.height, rowId);
      if (next) {
        state.builderItems = next;
        state.containerItems = popOneFromContainer(artifactId).next;
        state.error = '';
        haptics.impact('light');
    
        return true;
      }
    }
    state.error = messages[state.lang].errorDoesNotFit;
    haptics.notify('error');
    return false;
  }

  function activateBag(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact || artifact.family !== 'bag') return;
    if (state.activeBags.some((b) => b.artifactId === artifactId)) return;
    const { next, removed } = popOneFromContainer(artifactId);
    if (!removed) return;
    // Auto-pack: 2D first-fit anchor assignment so bags pack side-by-side
    // when there's room instead of always stacking vertically below the
    // previous bag. The chip can be dragged later to override the anchor.
    const rotated = state.rotatedBags.some((b) => b.id === removed.id);
    const shape = getEffectiveShape(artifact, rotated);
    const cols = Math.min(BAG_COLUMNS, shape.length > 0 ? shape[0].length : 0);
    const rows = shape.length;
    const { anchorX, anchorY } = findFirstFitAnchor(cols, rows);
    state.activeBags = [...state.activeBags, { ...removed, anchorX, anchorY }];
    state.containerItems = next;
    state.error = '';
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    haptics.impact('medium');
  }

  function deactivateBag(artifactId) {
    const idx = state.activeBags.findIndex((b) => b.artifactId === artifactId);
    if (idx < 0) return;
    const removed = state.activeBags[idx];
    // Block only if THIS bag still holds items. Later bags' slot coords are
    // independent of bag ordering, so we can reshuffle virtual y for them
    // without touching storage — see relayoutBaggedItems.
    const itemsInThisBag = state.builderItems.filter((i) => i.bagId === removed.id);
    if (itemsInThisBag.length) {
      state.error = messages[state.lang].errorBagNotEmpty;
      haptics.notify('error');
      return;
    }
    const rotatedIds = new Set(state.rotatedBags.map((b) => b.id));
    const oldLayout = buildActiveLayout(state.activeBags, rotatedIds);
    const nextActive = [
      ...state.activeBags.slice(0, idx),
      ...state.activeBags.slice(idx + 1)
    ];
    const newLayout = buildActiveLayout(nextActive, rotatedIds);
    const { nextBuilder } = relayoutBaggedItems(oldLayout, newLayout);
    state.activeBags = nextActive;
    state.builderItems = nextBuilder;
    state.containerItems = [...state.containerItems, removed];
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    haptics.selectionChanged();
  }

  function autoPlaceFromContainer(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact) return;
    if (artifact.family === 'bag') {
      activateBag(artifactId);
      return;
    }
    const slot = state.containerItems.find((s) => s.artifactId === artifactId);
    const rowId = slot?.id ?? null;
    const orientations = [preferredOrientation(artifact)];
    if (artifact.width !== artifact.height) {
      orientations.push({ width: orientations[0].height, height: orientations[0].width });
    }
    const rows = effectiveRows();
    for (const o of orientations) {
      for (let y = 0; y < rows; y += 1) {
        // Unified grid: scan the full BAG_COLUMNS width. Per-cell coverage
        // check inside normalizePlacement filters out empty cells outside
        // the base inventory and any active bag.
        for (let x = 0; x < BAG_COLUMNS; x += 1) {
          const next = normalizePlacement(artifact, x, y, o.width, o.height, rowId);
          if (next) {
            state.builderItems = next;
            state.containerItems = popOneFromContainer(artifactId).next;
            state.error = '';
            haptics.impact('light');

            return;
          }
        }
      }
    }
    state.error = messages[state.lang].errorDoesNotFitInventory;
    haptics.notify('error');
  }

  // Unplace exactly ONE instance back to the container. Accepts either a
  // full item object (preferred — matches by row id when available,
  // otherwise by (x,y) anchor) or a bare artifactId string (fallback for
  // shop-drop-from-inventory which only knows the id).
  function unplaceToContainer(target) {
    const byInstance = typeof target === 'object' && target !== null;
    let removed = null;
    if (byInstance) {
      const idx = state.builderItems.findIndex((it) => isSameInstance(it, target));
      if (idx < 0) return;
      removed = state.builderItems[idx];
      state.builderItems = [
        ...state.builderItems.slice(0, idx),
        ...state.builderItems.slice(idx + 1)
      ];
    } else {
      const idx = state.builderItems.findIndex((it) => it.artifactId === target);
      if (idx < 0) return;
      removed = state.builderItems[idx];
      state.builderItems = [
        ...state.builderItems.slice(0, idx),
        ...state.builderItems.slice(idx + 1)
      ];
    }
    // Duplicates ARE legal in the container — always push, never dedupe.
    // The row id (if present) follows the item back to its container slot.
    state.containerItems = [
      ...state.containerItems,
      { id: removed.id ?? null, artifactId: removed.artifactId }
    ];
    haptics.selectionChanged();

  }

  // Drag-and-drop handlers
  function onInventoryCellDrop({ x, y }) {
    // Bag-chip drag (re-anchor an empty active bag) is dispatched here so
    // ArtifactGridBoard exposes a single cell-drop emit; the source of the
    // drag — chip vs container vs inventory piece — is the discriminator.
    if (state.draggingSource === 'bag-chip') {
      // Unified-grid coords flow straight through to onBagZoneDrop — there
      // is no separate bag-zone coord space anymore.
      onBagZoneDrop({ x, y });
      return;
    }
    const artifactId = state.draggingArtifactId;
    if (!artifactId) return;
    if (state.draggingSource === 'container') {
      placeFromContainer(artifactId, x, y);
    } else if (state.draggingSource === 'inventory') {
      // Use the instance captured at drag-start: the player may own two
      // copies of the same artifact, and matching by artifactId would
      // pick the wrong one (or wipe both). draggingItem is set by
      // onInventoryPieceDragStart.
      const dragged = state.draggingItem;
      if (!dragged) return;
      const others = state.builderItems.filter((i) => !isSameInstance(i, dragged));
      const occupied = buildOccupancy(others);
      const w = dragged.width;
      const h = dragged.height;
      if (x + w > BAG_COLUMNS || y + h > effectiveRows()) {
        haptics.notify('error');
        return;
      }
      for (let dx = 0; dx < w; dx += 1) {
        for (let dy = 0; dy < h; dy += 1) {
          if (occupied.has(`${x + dx}:${y + dy}`)) {
            haptics.notify('error');
            return;
          }
          // Bag rows may expose fewer cols than INVENTORY_COLUMNS — don't
          // drop into a disabled (greyed-out) cell, which would otherwise
          // persist and trip the server's occupancy check on the next save.
          if (isCellDisabled(x + dx, y + dy)) {
            haptics.notify('error');
            return;
          }
        }
      }
      // Recompute bagId for the new position — moving across the bag/grid
      // boundary changes the item's membership. Items moved to a base-grid
      // cell get bagId=null; into a bag cell, bagId = that bag's row id.
      const info = bagForCell(x, y);
      const nextBagId = info ? info.bagRowId : null;
      state.builderItems = [...others, { ...dragged, x, y, bagId: nextBagId }];
      haptics.selectionChanged();

    }
  }

  // True iff the bag chip can be dragged: only empty bags (no items inside)
  // can be re-anchored. UI uses this to gate dragstart and to render the
  // disabled tooltip "Empty the bag to move it".
  function canMoveBag(bagId) {
    return !state.builderItems.some((it) => it.bagId === bagId);
  }

  // Drag start from an active-bag chip. Suppressed when the bag still holds
  // items so the user doesn't accidentally lose layout state mid-arrangement.
  function onBagChipDragStart(bagId, event) {
    if (!canMoveBag(bagId)) {
      event?.preventDefault?.();
      state.error = messages[state.lang].errorBagNotEmpty;
      haptics.notify('error');
      return;
    }
    state.draggingArtifactId = '';
    state.draggingItem = null;
    state.draggingBagId = bagId;
    state.draggingSource = 'bag-chip';
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `bag:${bagId}`);
    }
  }

  // Drop a dragged bag chip onto a bag-zone cell. Sets the bag's anchor to
  // (x, y) (in bag-zone-local coords: x in [0, BAG_COLUMNS), y in [0, +∞)).
  // Rejected if the new footprint overlaps another active bag or overflows
  // BAG_COLUMNS. Empty-bag invariant is already enforced at dragstart, so
  // this drop only needs to validate geometry.
  function onBagZoneDrop({ x, y }) {
    const bagId = state.draggingBagId;
    if (!bagId) return;
    const idx = state.activeBags.findIndex((b) => b.id === bagId);
    if (idx < 0) return;
    const bag = state.activeBags[idx];
    const layout = bagLayout(bag.artifactId);
    if (x < 0 || y < 0 || x + layout.cols > BAG_COLUMNS) {
      haptics.notify('error');
      return;
    }
    if (bagAreaOverlaps(x, y, layout.cols, layout.rows, bagId)) {
      state.error = messages[state.lang].errorDoesNotFit;
      haptics.notify('error');
      return;
    }
    const rotatedIds = new Set(state.rotatedBags.map((b) => b.id));
    const oldLayout = buildActiveLayout(state.activeBags, rotatedIds);
    const nextActive = state.activeBags.map((b, i) =>
      i === idx ? { ...b, anchorX: x, anchorY: y } : b
    );
    const newLayout = buildActiveLayout(nextActive, rotatedIds);
    // Empty-bag invariant means relayoutBaggedItems has no work for THIS bag,
    // but other bags' items are unchanged — pass them through anyway so the
    // contract stays consistent with rotateBag/deactivateBag.
    state.activeBags = nextActive;
    const { nextBuilder } = relayoutBaggedItems(oldLayout, newLayout);
    state.builderItems = nextBuilder;
    state.error = '';
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    haptics.selectionChanged();
  }

  function onContainerDrop(event) {
    event.preventDefault();
    if (!state.draggingArtifactId) return;
    if (state.draggingSource === 'shop') {
      buyFromShop(state.draggingArtifactId);
    } else if (state.draggingSource === 'inventory') {
      // Pass the full instance so unplaceToContainer removes exactly the
      // dragged copy, not every duplicate that shares the artifactId.
      unplaceToContainer(state.draggingItem || state.draggingArtifactId);
    }
  }

  function onContainerDragOver(event) {
    if (state.draggingSource === 'shop' || state.draggingSource === 'inventory') event.preventDefault();
  }

  function onShopDrop(event) {
    event.preventDefault();
    if (!state.draggingArtifactId) return;
    if (state.draggingSource === 'container') {
      returnToShop(state.draggingArtifactId);
    } else if (state.draggingSource === 'inventory') {
      unplaceToContainer(state.draggingItem || state.draggingArtifactId);
      returnToShop(state.draggingArtifactId);
    }
  }

  function onShopDragOver(event) {
    if (state.draggingSource === 'container' || state.draggingSource === 'inventory') event.preventDefault();
  }

  function onShopPieceDragStart(artifactId, event) {
    const artifact = getArtifact(artifactId);
    const price = getArtifactPrice(artifact);
    const remaining = Math.max(0, MAX_ARTIFACT_COINS - computeUsedCoins());
    if (price > remaining) {
      event.preventDefault();
      state.error = state.lang === 'ru'
        ? `Недостаточно монет (нужно ${price}, осталось ${remaining})`
        : `Not enough coins (need ${price}, left ${remaining})`;
      haptics.notify('error');
      return;
    }
    state.draggingArtifactId = artifactId;
    state.draggingSource = 'shop';
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', artifactId);
    }
  }

  function onContainerPieceDragStart(slotOrArtifactId, event) {
    // Accept either a slot object `{ artifactId, rowId }` (preferred) or
    // a bare artifactId (legacy). Stashing the full slot lets the sell
    // zone target the exact server row when the container item gets
    // dropped onto it.
    const artifactId = typeof slotOrArtifactId === 'string'
      ? slotOrArtifactId
      : (slotOrArtifactId?.artifactId || slotOrArtifactId?.id);
    const rowId = typeof slotOrArtifactId === 'object' && slotOrArtifactId !== null
      ? (slotOrArtifactId.rowId || slotOrArtifactId.id || null)
      : null;
    state.draggingArtifactId = artifactId;
    state.draggingItem = rowId ? { id: rowId, artifactId } : null;
    state.draggingSource = 'container';
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', artifactId);
    }
  }

  function onInventoryPieceDragStart({ item, event }) {
    state.draggingArtifactId = item.artifactId;
    // Remember the exact instance being dragged (x/y anchor identifies it)
    // so the drop handler can target the right copy even if duplicates
    // with the same artifactId exist elsewhere on the grid.
    state.draggingItem = { ...item };
    state.draggingSource = 'inventory';
    if (event?.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function onDragEndAny() {
    state.draggingArtifactId = '';
    state.draggingItem = null;
    state.draggingBagId = '';
    state.draggingSource = '';
  }

  return {
    effectiveRows,
    rerollShop, buyFromShop, returnToShop, getSellPrice,
    activateBag, deactivateBag, rotateBag,
    autoPlaceFromContainer, unplaceToContainer,
    rotatePlacedArtifact,
    canMoveBag, onBagChipDragStart, onBagZoneDrop,
    onInventoryCellDrop, onInventoryPieceDragStart,
    onContainerDrop, onContainerDragOver, onContainerPieceDragStart,
    onShopDrop, onShopDragOver, onShopPieceDragStart,
    onDragEndAny
  };
}
