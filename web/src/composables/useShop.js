import { INVENTORY_COLUMNS, INVENTORY_ROWS, MAX_ARTIFACT_COINS, SHOP_OFFER_SIZE, REROLL_COST } from '../constants.js';
import { buildOccupancy, getArtifactPrice, pickRandomShopOffer, preferredOrientation } from '../artifacts/grid.js';

export function useShop(state, getArtifact, persistShopOffer, persistRunLoadout) {
  function bagLayout(bagId) {
    const bag = getArtifact(bagId);
    if (!bag) return { cols: INVENTORY_COLUMNS, rows: 1 };
    const rotated = state.rotatedBags.includes(bagId);
    const cols = rotated ? Math.min(bag.width, bag.height) : Math.max(bag.width, bag.height);
    const rows = rotated ? Math.max(bag.width, bag.height) : Math.min(bag.width, bag.height);
    return { cols: Math.min(cols, INVENTORY_COLUMNS), rows };
  }

  function bagRowCount(bagId) {
    return bagLayout(bagId).rows;
  }

  function effectiveRows() {
    return INVENTORY_ROWS + state.activeBags.reduce((sum, id) => sum + bagRowCount(id), 0);
  }

  function bagForRow(row) {
    let r = INVENTORY_ROWS;
    for (const bagId of state.activeBags) {
      const count = bagRowCount(bagId);
      if (row >= r && row < r + count) {
        return { bagId, startRow: r, rowCount: count, cols: bagLayout(bagId).cols };
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
    if (!state.activeBags.includes(bagId)) return;
    const bag = getArtifact(bagId);
    if (!bag || bag.width === bag.height) return;
    // Rotation changes this bag's rowCount, shifting later bags up or down.
    // Block if *anything* lives in this bag's rows OR any later bag — same
    // rationale as deactivateBag. Forces the player to empty downstream
    // bags first so their item y coords stay in sync with activeBags.
    let startRow = INVENTORY_ROWS;
    for (const id of state.activeBags) {
      if (id === bagId) break;
      startRow += bagRowCount(id);
    }
    const itemsBelowThisBag = state.builderItems.filter((i) => i.y >= startRow);
    if (itemsBelowThisBag.length) {
      state.error = state.lang === 'ru' ? 'Сначала уберите предметы из сумки' : 'Remove items from the bag first';
      return;
    }
    if (state.rotatedBags.includes(bagId)) {
      state.rotatedBags = state.rotatedBags.filter((id) => id !== bagId);
    } else {
      state.rotatedBags = [...state.rotatedBags, bagId];
    }
  }

  // Build the next builderItems array for placing a NEW (candidate) item
  // onto the grid. Used by container→grid flows only — never by inventory
  // moves. Must NOT filter existing items by artifactId: the player can
  // legitimately own multiple copies of the same artifact (Phase 2 in
  // solo-run-scenario.test.js), and filtering would silently delete any
  // already-placed duplicate from the grid. Check collisions against all
  // existing items; return null if the candidate doesn't fit.
  function normalizePlacement(artifact, x, y, width, height) {
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
    const candidate = { artifactId: artifact.id, x, y, width: w, height: h };
    return [...state.builderItems, candidate];
  }

  // Remove the first occurrence of `artifactId` from containerItems.
  // Using `.filter(id => id !== artifactId)` would delete every duplicate,
  // which is the same identity bug normalizePlacement used to have.
  function popOneFromContainer(artifactId) {
    const idx = state.containerItems.indexOf(artifactId);
    if (idx < 0) return state.containerItems;
    return [
      ...state.containerItems.slice(0, idx),
      ...state.containerItems.slice(idx + 1)
    ];
  }

  // Match a builderItem by its (x,y) anchor. Two items can't occupy the
  // same anchor (normalizePlacement enforces this), so (x,y) is a stable
  // per-instance identity for grid-placed items.
  function isSameInstance(a, b) {
    return a.x === b.x && a.y === b.y;
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
      state.error = state.lang === 'ru' ? 'Не помещается' : 'Does not fit here';
      return;
    }
    for (let dx = 0; dx < newWidth; dx += 1) {
      for (let dy = 0; dy < newHeight; dy += 1) {
        if (occupied.has(`${item.x + dx}:${item.y + dy}`)) {
          state.error = state.lang === 'ru' ? 'Не помещается' : 'Does not fit here';
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
    const ownedIds = new Set([...state.builderItems.map((i) => i.artifactId), ...state.containerItems]);
    state.shopOffer = pickRandomShopOffer(state.bootstrap?.artifacts || [], ownedIds);
    persistShopOffer();
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
    state.containerItems = [...state.containerItems, artifactId];
    state.freshPurchases = [...state.freshPurchases, artifactId];
    state.error = '';
    persistShopOffer();
    return true;
  }

  function getSellPrice(artifactId) {
    const artifact = getArtifact(artifactId);
    const full = getArtifactPrice(artifact);
    return state.freshPurchases.includes(artifactId) ? full : Math.max(1, Math.floor(full / 2));
  }

  function returnToShop(artifactId) {
    if (!state.containerItems.includes(artifactId)) return;
    state.containerItems = state.containerItems.filter((id) => id !== artifactId);
    state.freshPurchases = state.freshPurchases.filter((id) => id !== artifactId);
    if (!state.shopOffer.includes(artifactId)) {
      state.shopOffer = [...state.shopOffer, artifactId];
    }
    persistShopOffer();
  }

  function placeFromContainer(artifactId, x, y) {
    const artifact = getArtifact(artifactId);
    if (!artifact) return false;
    const preferred = preferredOrientation(artifact);
    const orientations = [preferred];
    if (artifact.width !== artifact.height) {
      orientations.push({ width: preferred.height, height: preferred.width });
    }
    for (const orientation of orientations) {
      const next = normalizePlacement(artifact, x, y, orientation.width, orientation.height);
      if (next) {
        state.builderItems = next;
        // Remove ONE instance of this artifactId from container — the
        // player may own multiple copies and we're only placing one.
        state.containerItems = popOneFromContainer(artifactId);
        state.error = '';
        persistShopOffer();
        return true;
      }
    }
    state.error = state.lang === 'ru' ? 'Не помещается' : 'Does not fit here';
    return false;
  }

  function activateBag(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact || artifact.family !== 'bag') return;
    if (state.activeBags.includes(artifactId)) return;
    state.activeBags = [...state.activeBags, artifactId];
    state.containerItems = state.containerItems.filter((id) => id !== artifactId);
    state.error = '';
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    else persistShopOffer();
  }

  function deactivateBag(artifactId) {
    if (!state.activeBags.includes(artifactId)) return;
    let startRow = INVENTORY_ROWS;
    for (const id of state.activeBags) {
      if (id === artifactId) break;
      startRow += bagRowCount(id);
    }
    // Block if *anything* lives in this bag's rows OR in later bags' rows:
    // deactivating a middle bag shifts later bags up and strands their items
    // at stale y coords. Forcing the player to empty downstream bags first
    // keeps the builderItems layout in sync with activeBags.
    const itemsBelowThisBag = state.builderItems.filter((i) => i.y >= startRow);
    if (itemsBelowThisBag.length) {
      state.error = state.lang === 'ru' ? 'Сначала уберите предметы из сумки' : 'Remove items from the bag first';
      return;
    }
    state.activeBags = state.activeBags.filter((id) => id !== artifactId);
    state.containerItems = [...state.containerItems, artifactId];
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    else persistShopOffer();
  }

  function autoPlaceFromContainer(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact) return;
    if (artifact.family === 'bag') {
      activateBag(artifactId);
      return;
    }
    const orientations = [preferredOrientation(artifact)];
    if (artifact.width !== artifact.height) {
      orientations.push({ width: orientations[0].height, height: orientations[0].width });
    }
    const rows = effectiveRows();
    for (const o of orientations) {
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < INVENTORY_COLUMNS; x += 1) {
          const next = normalizePlacement(artifact, x, y, o.width, o.height);
          if (next) {
            state.builderItems = next;
            // Pop ONE from container; owning a duplicate of an already-
            // placed artifact is legal and must not collapse on place.
            state.containerItems = popOneFromContainer(artifactId);
            state.error = '';
            persistShopOffer();
            return;
          }
        }
      }
    }
    state.error = state.lang === 'ru' ? 'Не помещается в инвентарь' : 'Does not fit in inventory';
  }

  // Unplace exactly ONE instance back to the container. Accepts either a
  // full item object {artifactId, x, y} (preferred — preserves identity
  // when multiple duplicates live on the grid) or a bare artifactId string
  // (falls back to removing the first grid copy by artifact id). The old
  // implementation used `.filter(i !== id)` which wiped every duplicate
  // off the grid and pushed only one copy to the container, silently
  // losing the rest.
  function unplaceToContainer(target) {
    const byInstance = typeof target === 'object' && target !== null;
    const artifactId = byInstance ? target.artifactId : target;
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
      const idx = state.builderItems.findIndex((it) => it.artifactId === artifactId);
      if (idx < 0) return;
      removed = state.builderItems[idx];
      state.builderItems = [
        ...state.builderItems.slice(0, idx),
        ...state.builderItems.slice(idx + 1)
      ];
    }
    // Duplicates ARE legal in the container — always push, never dedupe.
    state.containerItems = [...state.containerItems, removed.artifactId];
    persistShopOffer();
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
      persistShopOffer();
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

  function onContainerPieceDragStart(artifactId, event) {
    state.draggingArtifactId = artifactId;
    state.draggingSource = 'container';
    if (event.dataTransfer) {
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
