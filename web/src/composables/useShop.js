import { BAG_COLUMNS, BAG_ROWS, MAX_ARTIFACT_COINS, SHOP_OFFER_SIZE, REROLL_COST } from '../constants.js';
import { buildOccupancy, getArtifactPrice, pickRandomShopOffer, preferredOrientation } from '../artifacts/grid.js';
import { getEffectiveShape, isCellInShape, normalizeRotation } from '../../../app/shared/bag-shape.js';
import { messages } from '../i18n.js';

export function useShop(state, getArtifact, persistRunLoadout, feedback = {}) {
  const haptics = {
    impact: typeof feedback.impact === 'function' ? feedback.impact : () => {},
    notify: typeof feedback.notify === 'function' ? feedback.notify : () => {},
    selectionChanged: typeof feedback.selectionChanged === 'function' ? feedback.selectionChanged : () => {}
  };

  function bagRotation(bagId, rowId = null) {
    const entry = state.rotatedBags.find((b) => (rowId ? b.id === rowId : b.artifactId === bagId));
    return normalizeRotation(entry?.rotation ?? (entry ? 1 : 0));
  }

  function bagLayout(bagId, rowId = null) {
    const bag = getArtifact(bagId);
    if (!bag) return { cols: BAG_COLUMNS, rows: 1, shape: [] };
    const shape = getEffectiveShape(bag, bagRotation(bagId, rowId));
    const cols = shape.length > 0 ? shape[0].length : 0;
    const rows = shape.length;
    return { cols: Math.min(cols, BAG_COLUMNS), rows, shape };
  }

  // Total rows in the unified grid: at least `BAG_ROWS` so the rendered
  // grid is always 6×6, expanding further if an active bag's footprint
  // extends below row BAG_ROWS - 1.
  function effectiveRows() {
    return Math.max(BAG_ROWS, bagsBottomRow());
  }

  // Translate a unified-grid cell to the first active bag whose shape mask
  // covers it. Membership can be many-to-many; this helper picks one bag for
  // display while validators check coverage per cell.
  function bagForCell(cx, cy) {
    for (const bag of state.activeBags) {
      const layout = bagLayout(bag.artifactId, bag.id);
      const ax = bag.anchorX ?? 0;
      const ay = bag.anchorY ?? 0;
      if (cx >= ax && cx < ax + layout.cols && cy >= ay && cy < ay + layout.rows) {
        const localX = cx - ax;
        const localY = cy - ay;
        if (!isCellInShape(layout.shape, localX, localY)) continue;
        return {
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
    return !bagForCell(cx, cy);
  }

  function containerKeyForCell(cx, cy) {
    const info = bagForCell(cx, cy);
    return info ? info.bagRowId : null;
  }

  function footprintInOneContainer(x, y, w, h) {
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) {
        if (containerKeyForCell(x + dx, y + dy) == null) return false;
      }
    }
    return true;
  }

  function shapeCellsAt(anchorX, anchorY, shape) {
    const cells = new Set();
    for (let dy = 0; dy < shape.length; dy += 1) {
      const row = shape[dy] || [];
      for (let dx = 0; dx < row.length; dx += 1) {
        if (row[dx]) cells.add(`${anchorX + dx}:${anchorY + dy}`);
      }
    }
    return cells;
  }

  function rectangularShape(cols, rows) {
    return Array.from({ length: rows }, () => Array(cols).fill(1));
  }

  function bagAreaOverlaps(anchorX, anchorY, cols, rows, ignoreBagId = null, candidateShape = null) {
    const candidateCells = shapeCellsAt(anchorX, anchorY, candidateShape || rectangularShape(cols, rows));
    for (const other of state.activeBags) {
      if (other.id === ignoreBagId) continue;
      const oLayout = bagLayout(other.artifactId, other.id);
      const ox = other.anchorX ?? 0;
      const oy = other.anchorY ?? 0;
      const otherCells = shapeCellsAt(ox, oy, oLayout.shape);
      if (setsOverlap(candidateCells, otherCells)) return true;
    }
    return false;
  }

  // 2D first-fit packing: scan unified-grid coords top-to-bottom, left-to
  // -right for the first anchor where this bag's bounding box fits without
  // overlapping the base inventory or any other bag. Always succeeds: we
  // extend downward unbounded (BAG_COLUMNS-wide rows are added on demand).
  // A 2x1 bag with empty layout therefore anchors at (3, 0) — alongside the
  // base inventory — not at (0, 3) below it (Req 2-G).
  function findFirstFitAnchor(cols, rows, ignoreBagId = null, shape = null) {
    // Worst-case: stack below everything currently placed.
    const maxY = Math.max(0, bagsBottomRow()) + rows;
    for (let ay = 0; ay <= maxY; ay += 1) {
      for (let ax = 0; ax + cols <= BAG_COLUMNS; ax += 1) {
        if (!bagAreaOverlaps(ax, ay, cols, rows, ignoreBagId, shape)) {
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
      const layout = bagLayout(bag.artifactId, bag.id);
      const bottom = (bag.anchorY ?? 0) + layout.rows;
      if (bottom > max) max = bottom;
    }
    return max;
  }

  function bagCellSet(bag, rotatedOverride = null) {
    const artifact = getArtifact(bag.artifactId);
    if (!artifact) return new Set();
    const rotation = rotatedOverride == null
      ? bagRotation(bag.artifactId, bag.id)
      : normalizeRotation(rotatedOverride);
    const shape = getEffectiveShape(artifact, rotation);
    const ax = bag.anchorX ?? 0;
    const ay = bag.anchorY ?? 0;
    const cells = new Set();
    for (let dy = 0; dy < shape.length; dy += 1) {
      const row = shape[dy] || [];
      for (let dx = 0; dx < row.length; dx += 1) {
        if (row[dx]) cells.add(`${ax + dx}:${ay + dy}`);
      }
    }
    return cells;
  }

  function itemCellSet(item) {
    const cells = new Set();
    for (let dx = 0; dx < item.width; dx += 1) {
      for (let dy = 0; dy < item.height; dy += 1) {
        cells.add(`${item.x + dx}:${item.y + dy}`);
      }
    }
    return cells;
  }

  function setsOverlap(a, b) {
    for (const key of a) {
      if (b.has(key)) return true;
    }
    return false;
  }

  function unplaceItemsOverlappingBag(bag, rotatedOverride = null) {
    const bagCells = bagCellSet(bag, rotatedOverride);
    const nextBuilder = [];
    const displaced = [];
    for (const item of state.builderItems) {
      if (setsOverlap(itemCellSet(item), bagCells)) displaced.push(item);
      else nextBuilder.push(item);
    }
    if (!displaced.length) return;
    state.builderItems = nextBuilder;
    state.containerItems = [
      ...state.containerItems,
      ...displaced.map((item) => ({ id: item.id ?? null, artifactId: item.artifactId }))
    ];
  }

  function normalizeArtifactTarget(target) {
    return typeof target === 'object' && target !== null
      ? {
          artifactId: target.artifactId || target.id,
          rowId: target.rowId || target.id || null
        }
      : { artifactId: target, rowId: null };
  }

  function sameBagTarget(bag, artifactId, rowId = null) {
    return rowId ? bag.id === rowId : bag.artifactId === artifactId;
  }

  function rotateBag(target) {
    const { artifactId: bagId, rowId } = normalizeArtifactTarget(target);
    const activeBag = state.activeBags.find((b) => sameBagTarget(b, bagId, rowId));
    if (!activeBag) return;
    const bag = getArtifact(bagId);
    if (!bag || bag.width === bag.height) return;
    // Block rotation if the rotated footprint would overflow the bag zone's
    // column budget OR overlap another active bag.
    const currentRotation = bagRotation(activeBag.artifactId, activeBag.id);
    const nextRotation = (currentRotation + 1) % 4;
    const nextShape = getEffectiveShape(bag, nextRotation);
    const nextCols = nextShape.length > 0 ? nextShape[0].length : 0;
    const nextRows = nextShape.length;
    const { anchorX, anchorY } = findFirstFitAnchor(nextCols, nextRows, activeBag.id, nextShape);
    if (anchorX + nextCols > BAG_COLUMNS || bagAreaOverlaps(anchorX, anchorY, nextCols, nextRows, activeBag.id, nextShape)) {
      haptics.notify('error');
      return;
    }
    unplaceItemsOverlappingBag(activeBag);
    unplaceItemsOverlappingBag({ ...activeBag, anchorX, anchorY }, nextRotation);
    state.activeBags = state.activeBags.map((bag) => (
      bag.id === activeBag.id ? { ...bag, anchorX, anchorY } : bag
    ));
    const idx = state.rotatedBags.findIndex((b) => b.id === activeBag.id);
    if (nextRotation === 0) {
      state.rotatedBags = state.rotatedBags.filter((entry) => entry.id !== activeBag.id);
    } else if (idx >= 0) {
      state.rotatedBags = state.rotatedBags.map((entry, entryIndex) => (
        entryIndex === idx ? { id: activeBag.id, artifactId: activeBag.artifactId, rotation: nextRotation } : entry
      ));
    } else {
      state.rotatedBags = [
        ...state.rotatedBags,
        { id: activeBag.id, artifactId: activeBag.artifactId, rotation: nextRotation }
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
    if (!footprintInOneContainer(x, y, w, h)) return null;
    const candidate = { id: rowId, artifactId: artifact.id, x, y, width: w, height: h };
    return [...state.builderItems, candidate];
  }

  function rectCellKeys(x, y, w, h) {
    const cells = [];
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) {
        cells.push(`${x + dx}:${y + dy}`);
      }
    }
    return cells;
  }

  function canMovePlacedItemTo(item, x, y) {
    const others = state.builderItems.filter((it) => !isSameInstance(it, item));
    const occupied = buildOccupancy(others);
    const w = item.width;
    const h = item.height;
    if (x + w > BAG_COLUMNS || y + h > effectiveRows()) return false;
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) {
        if (occupied.has(`${x + dx}:${y + dy}`)) return false;
        if (isCellDisabled(x + dx, y + dy)) return false;
      }
    }
    return footprintInOneContainer(x, y, w, h);
  }

  function placementPreviewAt(x, y) {
    if (state.draggingSource === 'bag-chip') {
      const bagId = state.draggingBagId;
      const bag = state.activeBags.find((activeBag) => activeBag.id === bagId);
      if (!bag) return null;
      const layout = bagLayout(bag.artifactId, bag.id);
      const cells = Array.from(shapeCellsAt(x, y, layout.shape));
      const valid = x >= 0
        && y >= 0
        && x + layout.cols <= BAG_COLUMNS
        && !bagAreaOverlaps(x, y, layout.cols, layout.rows, bagId, layout.shape);
      return {
        cells,
        valid,
        artifactId: bag.artifactId,
        family: 'bag'
      };
    }

    if (state.draggingSource === 'container') {
      const artifactId = state.draggingArtifactId;
      const artifact = getArtifact(artifactId);
      if (!artifact || artifact.family === 'bag') return null;
      const slot = state.containerItems.find((s) => s.artifactId === artifactId);
      const rowId = slot?.id ?? null;
      const preferred = preferredOrientation(artifact);
      const orientations = [preferred];
      if (artifact.width !== artifact.height) {
        orientations.push({ width: preferred.height, height: preferred.width });
      }
      const validOrientation = orientations.find((orientation) =>
        normalizePlacement(artifact, x, y, orientation.width, orientation.height, rowId)
      );
      const display = validOrientation || orientations[0];
      return {
        cells: rectCellKeys(x, y, display.width, display.height),
        valid: Boolean(validOrientation),
        artifactId,
        family: artifact.family
      };
    }

    if (state.draggingSource === 'inventory' && state.draggingItem) {
      const item = state.draggingItem;
      const artifact = getArtifact(item.artifactId);
      return {
        cells: rectCellKeys(x, y, item.width, item.height),
        valid: canMovePlacedItemTo(item, x, y),
        artifactId: item.artifactId,
        family: artifact?.family || 'damage'
      };
    }

    return null;
  }

  // Remove the first slot matching `artifactId` from containerItems and
  // return both the next array and the popped slot. The slot object
  // carries the loadout row id so the caller can thread it into whatever
  // state bucket receives the item (builderItems, activeBags, etc.).
  // Pre-refactor this was a string[] and the pop used indexOf on the id;
  // now it's Array<{ id, artifactId }> — see docs/client-row-id-refactor.md.
  function popOneFromContainer(artifactId, rowId = null) {
    const idx = state.containerItems.findIndex((slot) =>
      rowId ? slot.id === rowId : slot.artifactId === artifactId
    );
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

  function activateBag(target) {
    const { artifactId, rowId } = normalizeArtifactTarget(target);
    const artifact = getArtifact(artifactId);
    if (!artifact || artifact.family !== 'bag') return;
    if (state.activeBags.some((b) => sameBagTarget(b, artifactId, rowId))) return;
    const { next, removed } = popOneFromContainer(artifactId, rowId);
    if (!removed) return;
    // Auto-pack: 2D first-fit anchor assignment so bags pack side-by-side
    // when there's room instead of always stacking vertically below the
    // previous bag. The chip can be dragged later to override the anchor.
    const rotation = bagRotation(artifactId, removed.id);
    const shape = getEffectiveShape(artifact, rotation);
    const cols = Math.min(BAG_COLUMNS, shape.length > 0 ? shape[0].length : 0);
    const rows = shape.length;
    const { anchorX, anchorY } = findFirstFitAnchor(cols, rows, null, shape);
    state.activeBags = [...state.activeBags, { ...removed, anchorX, anchorY }];
    state.containerItems = next;
    state.error = '';
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    haptics.impact('medium');
  }

  function deactivateBag(target) {
    const { artifactId, rowId } = normalizeArtifactTarget(target);
    const idx = state.activeBags.findIndex((b) => sameBagTarget(b, artifactId, rowId));
    if (idx < 0) return;
    const removed = state.activeBags[idx];
    unplaceItemsOverlappingBag(removed);
    const nextActive = [
      ...state.activeBags.slice(0, idx),
      ...state.activeBags.slice(idx + 1)
    ];
    state.activeBags = nextActive;
    state.containerItems = [...state.containerItems, removed];
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    haptics.selectionChanged();
  }

  function autoPlaceFromContainer(target) {
    const { artifactId, rowId } = normalizeArtifactTarget(target);
    const artifact = getArtifact(artifactId);
    if (!artifact) return;
    if (artifact.family === 'bag') {
      activateBag({ artifactId, id: rowId });
      return;
    }
    const slot = state.containerItems.find((s) =>
      rowId ? s.id === rowId : s.artifactId === artifactId
    );
    const targetRowId = slot?.id ?? null;
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
          const next = normalizePlacement(artifact, x, y, o.width, o.height, targetRowId);
          if (next) {
            state.builderItems = next;
            state.containerItems = popOneFromContainer(artifactId, targetRowId).next;
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
          // Don't drop into a disabled grid cell; that would persist and
          // trip the server's coverage check on the next save.
          if (isCellDisabled(x + dx, y + dy)) {
            haptics.notify('error');
            return;
          }
        }
      }
      if (!footprintInOneContainer(x, y, w, h)) {
        haptics.notify('error');
        return;
      }
      state.builderItems = [...others, { ...dragged, x, y }];
      haptics.selectionChanged();

    }
  }

  function canMoveBag(bagId) {
    return !!bagId;
  }

  function onBagChipDragStart(bagId, event) {
    state.draggingArtifactId = '';
    state.draggingItem = null;
    state.draggingBagId = bagId;
    state.draggingSource = 'bag-chip';
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `bag:${bagId}`);
    }
  }

  function onBagZoneDrop({ x, y }) {
    const bagId = state.draggingBagId;
    if (!bagId) return;
    const idx = state.activeBags.findIndex((b) => b.id === bagId);
    if (idx < 0) return;
    const bag = state.activeBags[idx];
    const layout = bagLayout(bag.artifactId, bag.id);
    if (x < 0 || y < 0 || x + layout.cols > BAG_COLUMNS) {
      haptics.notify('error');
      return;
    }
    if (bagAreaOverlaps(x, y, layout.cols, layout.rows, bagId, layout.shape)) {
      state.error = messages[state.lang].errorDoesNotFit;
      haptics.notify('error');
      return;
    }
    unplaceItemsOverlappingBag(bag);
    const nextActive = state.activeBags.map((b, i) =>
      i === idx ? { ...b, anchorX: x, anchorY: y } : b
    );
    state.activeBags = nextActive;
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
    placementPreviewAt,
    canMoveBag, onBagChipDragStart, onBagZoneDrop,
    onInventoryCellDrop, onInventoryPieceDragStart,
    onContainerDrop, onContainerDragOver, onContainerPieceDragStart,
    onShopDrop, onShopDragOver, onShopPieceDragStart,
    onDragEndAny
  };
}
