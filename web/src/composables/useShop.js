import { BAG_COLUMNS, BAG_ROWS, MAX_ARTIFACT_COINS, SHOP_OFFER_SIZE, REROLL_COST } from '../constants.js';
import { buildOccupancy, getArtifactPrice, pickRandomShopOffer } from '../artifacts/grid.js';
import {
  createPrepGridController,
  planPrepActivateBag,
  planPrepDeactivateBag,
  planPrepMoveActiveBag,
  planPrepMovePlacedItem,
  planPrepPlaceFromContainer,
  planPrepRotateBag
} from '@microwavedev/backpack-game-core/client-view-model';
import { messages } from '../i18n.js';

export function useShop(state, getArtifact, persistRunLoadout, feedback = {}) {
  const haptics = {
    impact: typeof feedback.impact === 'function' ? feedback.impact : () => {},
    notify: typeof feedback.notify === 'function' ? feedback.notify : () => {},
    selectionChanged: typeof feedback.selectionChanged === 'function' ? feedback.selectionChanged : () => {}
  };
  const prepGrid = createPrepGridController({
    state,
    getArtifact,
    columns: BAG_COLUMNS,
    minRows: BAG_ROWS
  });

  function prepPlanOptions() {
    return {
      state,
      getArtifact,
      columns: BAG_COLUMNS,
      minRows: BAG_ROWS
    };
  }

  function applyPrepPlan(plan) {
    if (Object.prototype.hasOwnProperty.call(plan, 'builderItems')) state.builderItems = plan.builderItems;
    if (Object.prototype.hasOwnProperty.call(plan, 'containerItems')) state.containerItems = plan.containerItems;
    if (Object.prototype.hasOwnProperty.call(plan, 'activeBags')) state.activeBags = plan.activeBags;
    if (Object.prototype.hasOwnProperty.call(plan, 'rotatedBags')) state.rotatedBags = plan.rotatedBags;
  }

  // Total rows in the unified grid: at least `BAG_ROWS` so the rendered
  // grid is always 6×6, expanding further if an active bag's footprint
  // extends below row BAG_ROWS - 1.
  function effectiveRows() {
    return prepGrid.effectiveRows();
  }

  function normalizeArtifactTarget(target) {
    return typeof target === 'object' && target !== null
      ? {
          artifactId: target.artifactId || target.id,
          rowId: target.rowId || target.id || null
        }
      : { artifactId: target, rowId: null };
  }

  function rotateBag(target) {
    const plan = planPrepRotateBag({ ...prepPlanOptions(), target });
    if (!plan.ok) {
      if (plan.reason === 'does_not_fit') haptics.notify('error');
      return;
    }
    applyPrepPlan(plan);
    // Persist immediately — same contract as activateBag / deactivateBag.
    // Pre-refactor, rotateBag only mutated client state and the rotation
    // vanished on every reload because no write was ever sent.
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    haptics.selectionChanged();
  }

  function placementPreviewAt(x, y) {
    return prepGrid.placementPreviewAt(x, y);
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
        if (prepGrid.isCellDisabled(item.x + dx, item.y + dy)) {
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
    const plan = planPrepPlaceFromContainer({ ...prepPlanOptions(), artifactId, x, y });
    if (plan.ok) {
      applyPrepPlan(plan);
      state.error = '';
      haptics.impact('light');
      return true;
    }
    state.error = messages[state.lang].errorDoesNotFit;
    haptics.notify('error');
    return false;
  }

  function activateBag(target) {
    const plan = planPrepActivateBag({ ...prepPlanOptions(), target });
    if (!plan.ok) return;
    applyPrepPlan(plan);
    state.error = '';
    if (state.gameRun && persistRunLoadout) persistRunLoadout();
    haptics.impact('medium');
  }

  function deactivateBag(target) {
    const plan = planPrepDeactivateBag({ ...prepPlanOptions(), target });
    if (!plan.ok) return;
    applyPrepPlan(plan);
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
    const rows = effectiveRows();
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < BAG_COLUMNS; x += 1) {
        const plan = planPrepPlaceFromContainer({
          ...prepPlanOptions(),
          target: { artifactId, id: targetRowId },
          x,
          y
        });
        if (plan.ok) {
          applyPrepPlan(plan);
          state.error = '';
          haptics.impact('light');
          return true;
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
      const plan = planPrepMovePlacedItem({ ...prepPlanOptions(), item: dragged, x, y });
      if (!plan.ok) {
        haptics.notify('error');
        return;
      }
      applyPrepPlan(plan);
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
    const plan = planPrepMoveActiveBag({ ...prepPlanOptions(), bagId, x, y });
    if (!plan.ok) {
      state.error = messages[state.lang].errorDoesNotFit;
      haptics.notify('error');
      return;
    }
    applyPrepPlan(plan);
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
