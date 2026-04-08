import { INVENTORY_COLUMNS, INVENTORY_ROWS, MAX_ARTIFACT_COINS, SHOP_OFFER_SIZE, REROLL_COST } from '../constants.js';
import { buildOccupancy, getArtifactPrice, pickRandomShopOffer, preferredOrientation } from '../artifacts/grid.js';

export function useShop(state, getArtifact, persistShopOffer) {
  function normalizePlacement(artifact, x, y, width, height) {
    const w = width || artifact.width;
    const h = height || artifact.height;
    const candidate = { artifactId: artifact.id, x, y, width: w, height: h };
    const next = state.builderItems.filter((item) => item.artifactId !== artifact.id);
    const occupied = buildOccupancy(next);
    if (x + w > INVENTORY_COLUMNS || y + h > INVENTORY_ROWS) return null;
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) {
        if (occupied.has(`${x + dx}:${y + dy}`)) return null;
      }
    }
    next.push(candidate);
    return next;
  }

  function rotatePlacedArtifact(item) {
    const artifact = state.bootstrap?.artifacts?.find((a) => a.id === item.artifactId);
    if (!artifact || artifact.width === artifact.height) return;
    const newWidth = item.height;
    const newHeight = item.width;
    const others = state.builderItems.filter((it) => it.artifactId !== item.artifactId);
    const occupied = buildOccupancy(others);
    if (item.x + newWidth > INVENTORY_COLUMNS || item.y + newHeight > INVENTORY_ROWS) {
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
      it.artifactId === item.artifactId ? { ...it, width: newWidth, height: newHeight } : it
    );
    state.error = '';
  }

  function removeArtifact(artifactId) {
    state.builderItems = state.builderItems.filter((item) => item.artifactId !== artifactId);
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
        state.containerItems = state.containerItems.filter((id) => id !== artifactId);
        state.error = '';
        persistShopOffer();
        return true;
      }
    }
    state.error = state.lang === 'ru' ? 'Не помещается' : 'Does not fit here';
    return false;
  }

  function autoPlaceFromContainer(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact) return;
    const orientations = [preferredOrientation(artifact)];
    if (artifact.width !== artifact.height) {
      orientations.push({ width: orientations[0].height, height: orientations[0].width });
    }
    for (const o of orientations) {
      for (let y = 0; y < INVENTORY_ROWS; y += 1) {
        for (let x = 0; x < INVENTORY_COLUMNS; x += 1) {
          const next = normalizePlacement(artifact, x, y, o.width, o.height);
          if (next) {
            state.builderItems = next;
            state.containerItems = state.containerItems.filter((id) => id !== artifactId);
            state.error = '';
            persistShopOffer();
            return;
          }
        }
      }
    }
    state.error = state.lang === 'ru' ? 'Не помещается в инвентарь' : 'Does not fit in inventory';
  }

  function unplaceToContainer(artifactId) {
    if (!state.builderItems.some((i) => i.artifactId === artifactId)) return;
    state.builderItems = state.builderItems.filter((i) => i.artifactId !== artifactId);
    if (!state.containerItems.includes(artifactId)) {
      state.containerItems = [...state.containerItems, artifactId];
    }
    persistShopOffer();
  }

  // Drag-and-drop handlers
  function onInventoryCellDrop({ x, y }) {
    const artifactId = state.draggingArtifactId;
    if (!artifactId) return;
    if (state.draggingSource === 'container') {
      placeFromContainer(artifactId, x, y);
    } else if (state.draggingSource === 'inventory') {
      const item = state.builderItems.find((i) => i.artifactId === artifactId);
      if (!item) return;
      const others = state.builderItems.filter((i) => i.artifactId !== artifactId);
      const occupied = buildOccupancy(others);
      const w = item.width;
      const h = item.height;
      if (x + w > INVENTORY_COLUMNS || y + h > INVENTORY_ROWS) return;
      for (let dx = 0; dx < w; dx += 1) {
        for (let dy = 0; dy < h; dy += 1) {
          if (occupied.has(`${x + dx}:${y + dy}`)) return;
        }
      }
      state.builderItems = [...others, { ...item, x, y }];
      persistShopOffer();
    }
  }

  function onContainerDrop(event) {
    event.preventDefault();
    if (!state.draggingArtifactId) return;
    if (state.draggingSource === 'shop') {
      buyFromShop(state.draggingArtifactId);
    } else if (state.draggingSource === 'inventory') {
      unplaceToContainer(state.draggingArtifactId);
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
      unplaceToContainer(state.draggingArtifactId);
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
    state.draggingSource = 'inventory';
    if (event?.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function onDragEndAny() {
    state.draggingArtifactId = '';
    state.draggingSource = '';
  }

  return {
    rerollShop, buyFromShop, returnToShop, getSellPrice,
    autoPlaceFromContainer, unplaceToContainer, removeArtifact,
    rotatePlacedArtifact,
    onInventoryCellDrop, onInventoryPieceDragStart,
    onContainerDrop, onContainerDragOver, onContainerPieceDragStart,
    onShopDrop, onShopDragOver, onShopPieceDragStart,
    onDragEndAny
  };
}
