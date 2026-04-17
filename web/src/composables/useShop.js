import { INVENTORY_COLUMNS, INVENTORY_ROWS, MAX_ARTIFACT_COINS, SHOP_OFFER_SIZE, REROLL_COST } from '../constants.js';
import { buildOccupancy, getArtifactPrice, pickRandomShopOffer, preferredOrientation } from '../artifacts/grid.js';
import { messages } from '../i18n.js';

export function useShop(state, getArtifact, persistRunLoadout) {
  function isBagRotated(bagId) {
    return state.rotatedBags.some((b) => b.artifactId === bagId);
  }

  function bagLayout(bagId) {
    const bag = getArtifact(bagId);
    if (!bag) return { cols: INVENTORY_COLUMNS, rows: 1 };
    const rotated = isBagRotated(bagId);
    const cols = rotated ? Math.min(bag.width, bag.height) : Math.max(bag.width, bag.height);
    const rows = rotated ? Math.max(bag.width, bag.height) : Math.min(bag.width, bag.height);
    return { cols: Math.min(cols, INVENTORY_COLUMNS), rows };
  }

  function bagRowCount(bagId) {
    return bagLayout(bagId).rows;
  }

  function effectiveRows() {
    return INVENTORY_ROWS + state.activeBags.reduce((sum, bag) => sum + bagRowCount(bag.artifactId), 0);
  }

  function bagForRow(row) {
    let r = INVENTORY_ROWS;
    for (const bag of state.activeBags) {
      const count = bagRowCount(bag.artifactId);
      if (row >= r && row < r + count) {
        return {
          bagId: bag.artifactId,
          startRow: r,
          rowCount: count,
          cols: bagLayout(bag.artifactId).cols
        };
      }
      r += count;
    }
    return null;
  }

  function isCellDisabled(cx, cy) {
    const info = bagForRow(cy);
    if (cy >= INVENTORY_ROWS && !info) return true;
    if (!info) return false;
    return cx >= info.cols;
  }

  function rotateBag(bagId) {
    const activeBag = state.activeBags.find((b) => b.artifactId === bagId);
    if (!activeBag) return;
    const bag = getArtifact(bagId);
    if (!bag || bag.width === bag.height) return;
    // Rotation changes this bag's rowCount, shifting later bags up or down.
    // Block if *anything* lives in this bag's rows OR any later bag — same
    // rationale as deactivateBag. Forces the player to empty downstream
    // bags first so their item y coords stay in sync with activeBags.
    let startRow = INVENTORY_ROWS;
    for (const b of state.activeBags) {
      if (b.artifactId === bagId) break;
      startRow += bagRowCount(b.artifactId);
    }
    const itemsBelowThisBag = state.builderItems.filter((i) => i.y >= startRow);
    if (itemsBelowThisBag.length) {
      state.error = messages[state.lang].errorBagNotEmpty;
      return;
    }
    // Toggle the rotated slot. rotatedBags is Array<{id, artifactId}> so
    // duplicates are disambiguated — see docs/bag-rotated-persistence.md.
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
    if (x + w > INVENTORY_COLUMNS || y + h > effectiveRows()) return null;
    const occupied = buildOccupancy(state.builderItems);
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) {
        if (occupied.has(`${x + dx}:${y + dy}`)) return null;
        if (isCellDisabled(x + dx, y + dy)) return null;
      }
    }
    const candidate = { id: rowId, artifactId: artifact.id, x, y, width: w, height: h };
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
    if (item.x + newWidth > INVENTORY_COLUMNS || item.y + newHeight > effectiveRows()) {
      state.error = messages[state.lang].errorDoesNotFit;
      return;
    }
    for (let dx = 0; dx < newWidth; dx += 1) {
      for (let dy = 0; dy < newHeight; dy += 1) {
        if (occupied.has(`${item.x + dx}:${item.y + dy}`)) {
          state.error = messages[state.lang].errorDoesNotFit;
          return;
        }
      }
    }
    state.builderItems = state.builderItems.map((it) =>
      isSameInstance(it, item) ? { ...it, width: newWidth, height: newHeight } : it
    );
    state.error = '';
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
      return false;
    }
    state.shopOffer = state.shopOffer.filter((id) => id !== artifactId);
    // Legacy shop-buffer path: no server row id yet. Push a slot without
    // an id — the real buy flow in useGameRun stamps the row id onto the
    // container slot from the /buy response. See buyRunShopItem there.
    state.containerItems = [...state.containerItems, { id: null, artifactId }];
    state.freshPurchases = [...state.freshPurchases, artifactId];
    state.error = '';

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
    
        return true;
      }
    }
    state.error = messages[state.lang].errorDoesNotFit;
    return false;
  }

  function activateBag(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact || artifact.family !== 'bag') return;
    if (state.activeBags.some((b) => b.artifactId === artifactId)) return;
    const { next, removed } = popOneFromContainer(artifactId);
    if (!removed) return;
    state.activeBags = [...state.activeBags, removed];
    state.containerItems = next;
    state.error = '';
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
  }

  function deactivateBag(artifactId) {
    const idx = state.activeBags.findIndex((b) => b.artifactId === artifactId);
    if (idx < 0) return;
    let startRow = INVENTORY_ROWS;
    for (let i = 0; i < idx; i += 1) {
      startRow += bagRowCount(state.activeBags[i].artifactId);
    }
    // Block if *anything* lives in this bag's rows OR in later bags' rows:
    // deactivating a middle bag shifts later bags up and strands their items
    // at stale y coords. Forcing the player to empty downstream bags first
    // keeps the builderItems layout in sync with activeBags.
    const itemsBelowThisBag = state.builderItems.filter((i) => i.y >= startRow);
    if (itemsBelowThisBag.length) {
      state.error = messages[state.lang].errorBagNotEmpty;
      return;
    }
    const removed = state.activeBags[idx];
    state.activeBags = [
      ...state.activeBags.slice(0, idx),
      ...state.activeBags.slice(idx + 1)
    ];
    state.containerItems = [...state.containerItems, removed];
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
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
        for (let x = 0; x < INVENTORY_COLUMNS; x += 1) {
          const next = normalizePlacement(artifact, x, y, o.width, o.height, rowId);
          if (next) {
            state.builderItems = next;
            state.containerItems = popOneFromContainer(artifactId).next;
            state.error = '';
        
            return;
          }
        }
      }
    }
    state.error = messages[state.lang].errorDoesNotFitInventory;
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

  }

  // Drag-and-drop handlers
  function onInventoryCellDrop({ x, y }) {
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
      if (x + w > INVENTORY_COLUMNS || y + h > effectiveRows()) return;
      for (let dx = 0; dx < w; dx += 1) {
        for (let dy = 0; dy < h; dy += 1) {
          if (occupied.has(`${x + dx}:${y + dy}`)) return;
          // Bag rows may expose fewer cols than INVENTORY_COLUMNS — don't
          // drop into a disabled (greyed-out) cell, which would otherwise
          // persist and trip the server's occupancy check on the next save.
          if (isCellDisabled(x + dx, y + dy)) return;
        }
      }
      state.builderItems = [...others, { ...dragged, x, y }];
  
    }
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
    state.draggingSource = '';
  }

  return {
    effectiveRows,
    rerollShop, buyFromShop, returnToShop, getSellPrice,
    activateBag, deactivateBag, rotateBag,
    autoPlaceFromContainer, unplaceToContainer,
    rotatePlacedArtifact,
    onInventoryCellDrop, onInventoryPieceDragStart,
    onContainerDrop, onContainerDragOver, onContainerPieceDragStart,
    onShopDrop, onShopDragOver, onShopPieceDragStart,
    onDragEndAny
  };
}
