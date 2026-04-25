import { apiJson } from '../api.js';
import { getArtifactPrice } from '../artifacts/grid.js';
import { INVENTORY_COLUMNS, INVENTORY_ROWS } from '../constants.js';
import { messages } from '../i18n.js';

export function useGameRun(state, goTo, getArtifact, refreshBootstrap, loadReplay, feedback = {}) {
  const haptics = {
    impact: typeof feedback.impact === 'function' ? feedback.impact : () => {},
    notify: typeof feedback.notify === 'function' ? feedback.notify : () => {},
    selectionChanged: typeof feedback.selectionChanged === 'function' ? feedback.selectionChanged : () => {}
  };

  function buildLoadoutPayloadItems() {
    // Map frontend state to server loadout payload.
    //
    // Every payload entry carries an `id` when the client knows the server
    // row id — the server uses it to target that exact row even when
    // duplicates exist. Entries without an id fall back to the server's
    // artifactId + sort-order matching (for freshly-bought items whose
    // /buy response id wasn't captured yet, etc.). See
    // docs/client-row-id-refactor.md.
    //
    // - Base grid items (y < INVENTORY_ROWS): grid coordinates + id
    // - Items inside a bag (virtual y >= INVENTORY_ROWS on the client):
    //     bagId = the bag's loadout row id, x/y = slot coords within the
    //     bag (0 ≤ x < bag.cols, 0 ≤ y < bag.rows). The virtual y is an
    //     on-screen encoding, never a storage shape; the server stores
    //     slot coords so bag reorder/rotate/deactivate never invalidates
    //     persisted rows. See docs/bag-item-placement-persistence.md.
    // - Bags (active and container): (-1,-1) + id + active + rotated
    const isRotatedRowId = (rowId) =>
      rowId != null && state.rotatedBags.some((b) => b.id === rowId);

    // Active bag layout in unified-grid coords. The server stores bagged-item
    // slot coords (x in [0, bag.cols), y in [0, bag.rows)) — independent of
    // anchor — so anchor changes don't invalidate persisted rows. Anchors
    // are NOT persisted; on reload they're re-derived by the client's
    // 2D first-fit packer (see useShop.activateBag and loadout-projection's
    // packAnchors). Both packers treat the base inventory as a virtual
    // obstacle so anchors can land alongside it (Req 2-G).
    const activeBagLayout = [];
    for (const bag of state.activeBags) {
      const artifact = getArtifact(bag.artifactId);
      if (!artifact) continue;
      const rotated = isRotatedRowId(bag.id);
      const cols = rotated ? Math.max(artifact.width, artifact.height) : Math.min(artifact.width, artifact.height);
      const rows = rotated ? Math.min(artifact.width, artifact.height) : Math.max(artifact.width, artifact.height);
      const anchorX = bag.anchorX ?? 0;
      const anchorY = bag.anchorY ?? 0;
      activeBagLayout.push({
        bagRowId: bag.id,
        bagArtifactId: bag.artifactId,
        anchorX,
        anchorY,
        rowCount: rows,
        colCount: cols
      });
    }

    const withId = (entry, id) => (id ? { id, ...entry } : entry);
    const payload = [];

    // Bags (including container bags) must be declared before bagged items
    // reference them. Bags carry the container sentinel (-1,-1). The
    // `active` and `rotated` fields are the only things that distinguish
    // bag states on the wire — the server persists them into
    // game_run_loadout_items.{active,rotated} so the next hydrate routes
    // the bag back to the correct bucket and orientation. See
    // docs/bag-active-persistence.md and docs/bag-rotated-persistence.md.
    for (const bag of state.activeBags) {
      const artifact = getArtifact(bag.artifactId);
      if (!artifact) continue;
      payload.push(withId({
        artifactId: bag.artifactId, x: -1, y: -1,
        width: artifact.width, height: artifact.height,
        active: 1,
        rotated: isRotatedRowId(bag.id) ? 1 : 0
      }, bag.id));
    }
    for (const slot of state.containerItems) {
      const artifact = getArtifact(slot.artifactId);
      if (!artifact || artifact.family !== 'bag') continue;
      payload.push(withId({
        artifactId: slot.artifactId, x: -1, y: -1,
        width: artifact.width, height: artifact.height,
        active: 0,
        rotated: isRotatedRowId(slot.id) ? 1 : 0
      }, slot.id));
    }

    // Placed grid items and bagged items
    for (const item of state.builderItems) {
      // In the unified grid, an item is bagged whenever its top-left cell
      // lands in an active bag's footprint — base inventory cells are at
      // (0..INVENTORY_COLUMNS-1, 0..INVENTORY_ROWS-1) and have bagId=null.
      const info = activeBagLayout.find((b) =>
        item.y >= b.anchorY && item.y < b.anchorY + b.rowCount &&
        item.x >= b.anchorX && item.x < b.anchorX + b.colCount
      );
      if (info) {
        // Convert unified virtual (x, y) → bag-local slot (x, y). The server
        // stores slot coords so anchor changes / rotate / deactivate in
        // later rounds can't shift these rows out of place.
        payload.push(withId({
          artifactId: item.artifactId,
          x: item.x - info.anchorX,
          y: item.y - info.anchorY,
          width: item.width, height: item.height,
          bagId: info.bagRowId
        }, item.id));
        continue;
      }
      // No bag covers the item's anchor — must be a base inventory item.
      // Defensive fallback: if the item's full footprint doesn't fit inside
      // the base inventory rectangle (stale state from a deactivated/moved/
      // rotated bag etc.), push it to the container sentinel so the next
      // hydrate reconciles. The check must include width/height — a 2x1
      // anchored at (2,2) has its anchor inside the 3x3 base but its right
      // cell (3,2) outside, and falling through would emit invalid coords
      // the server rightly rejects as out-of-bounds.
      const fullyInBaseInv = item.x >= 0 && item.y >= 0
        && item.x + item.width <= INVENTORY_COLUMNS
        && item.y + item.height <= INVENTORY_ROWS;
      if (!fullyInBaseInv) {
        payload.push(withId({
          artifactId: item.artifactId, x: -1, y: -1,
          width: item.width, height: item.height
        }, item.id));
        continue;
      }
      payload.push(withId({
        artifactId: item.artifactId,
        x: item.x, y: item.y,
        width: item.width, height: item.height
      }, item.id));
    }

    // Non-bag container items (not placed)
    for (const slot of state.containerItems) {
      const artifact = getArtifact(slot.artifactId);
      if (!artifact || artifact.family === 'bag') continue;
      payload.push(withId({
        artifactId: slot.artifactId, x: -1, y: -1,
        width: artifact.width, height: artifact.height
      }, slot.id));
    }
    return payload;
  }

  async function startNewGameRun(mode = 'solo') {
    try {
      state.error = '';
      const data = await apiJson('/api/game-run/start', { method: 'POST', body: JSON.stringify({ mode }) }, state.sessionKey);
      state.gameRun = data;
      state.gameRunShopOffer = data.shopOffer || [];
      state.gameRunRefreshCount = 0;
      state.gameRunResult = null;
      // Fetch the full run state from the server (the new run-scoped read
      // path) and let refreshBootstrap project loadoutItems into the UI
      // buckets. Guarantees starter + any future round-forward rows
      // reach the prep screen via one source of truth (§2.5 projection).
      if (refreshBootstrap) await refreshBootstrap();
      goTo('prep');
    } catch (error) {
      state.error = error.message || 'Could not start game run';
    }
  }

  function resumeGameRun() {
    if (!state.gameRun) return;
    state.gameRunResult = null;
    goTo('prep');
  }

  async function signalReady() {
    if (!state.gameRun || state.actionInFlight) return;
    state.actionInFlight = true;
    try {
      state.error = '';
      if (state.bootstrap?.activeMushroomId) {
        await apiJson('/api/artifact-loadout', {
          method: 'PUT',
          body: JSON.stringify({ mushroomId: state.bootstrap.activeMushroomId, items: buildLoadoutPayloadItems() })
        }, state.sessionKey);
      }
      const data = await apiJson(`/api/game-run/${state.gameRun.id}/ready`, { method: 'POST' }, state.sessionKey);
      haptics.impact('medium');
      if (data.waiting) return;
      state.gameRunResult = data;
      if (data.status === 'completed' || data.status === 'abandoned') {
        state.gameRun = { ...state.gameRun, status: data.status, endReason: data.endReason, completionBonus: data.completionBonus || null };
      }
      // Spec: docs/user-flows.md Flow B Step 3 — post-Ready lands directly
      // on the replay screen, which autoplays the battle and then renders
      // an inline rewards card (Spore/Mycelium/Rating) next to the Continue
      // button. There is no separate round-result screen — the player sees
      // the battle happen and gets the rewards in context.
      const battleId = data.lastRound?.battleId;
      if (battleId && loadReplay) {
        await loadReplay(battleId);
      } else if (state.gameRun?.status === 'completed' || state.gameRun?.status === 'abandoned') {
        // No battleId (shouldn't happen) — fall through to the summary.
        goTo('runComplete');
      } else {
        goTo('prep');
      }
    } catch (error) {
      state.error = error.message || 'Could not resolve round';
      haptics.notify('error');
    } finally {
      state.actionInFlight = false;
    }
  }

  async function continueToNextRound() {
    if (!state.gameRunResult || !state.gameRun) return;
    state.gameRunResult = null;
    state.gameRunRefreshCount = 0;
    // Full re-hydrate from the server — picks up the copy-forward round N+1
    // loadout rows and the new round's shop offer in one round-trip.
    // Replaces the old "partial merge + loadRunShopOffer" pattern which
    // could drift when the server's copy-forward produced a different
    // layout than the client last sent (§2.5 projection).
    if (refreshBootstrap) await refreshBootstrap();
    goTo('prep');
  }

  async function loadRunShopOffer() {
    if (!state.gameRun) return;
    try {
      const data = await apiJson(`/api/game-run/${state.gameRun.id}`, {}, state.sessionKey);
      if (data.shopOffer) state.gameRunShopOffer = data.shopOffer;
    } catch { /* ignore */ }
  }

  async function abandonRun() {
    if (!state.gameRun) return;
    try {
      await apiJson(`/api/game-run/${state.gameRun.id}/abandon`, { method: 'POST' }, state.sessionKey);
      state.gameRun = null;
      state.gameRunResult = null;
      state.gameRunShopOffer = [];
      await refreshBootstrap();
      goTo('home');
    } catch (error) {
      state.error = error.message || 'Could not abandon game run';
    }
  }

  async function refreshRunShop() {
    if (!state.gameRun) return;
    try {
      state.error = '';
      const data = await apiJson(`/api/game-run/${state.gameRun.id}/refresh-shop`, { method: 'POST' }, state.sessionKey);
      state.gameRunShopOffer = data.shopOffer;
      state.gameRunRefreshCount = data.refreshCount;
      state.gameRun = { ...state.gameRun, player: { ...state.gameRun.player, coins: data.coins } };
      haptics.selectionChanged();
    } catch (error) {
      state.error = error.message || 'Not enough coins';
      haptics.notify('error');
    }
  }

  /**
   * Sell a loadout item. Accepts either a full item/slot object (preferred
   * — carries the row id so the server can delete the exact duplicate
   * the user clicked) or a bare artifactId string (legacy fallback —
   * server picks the last-inserted matching row). The identity-by-
   * artifactId filters on the other state buckets are gone: we prune by
   * row id where we have one and fall back to first-match-by-artifactId
   * only when the target was supplied as a bare string. See
   * docs/client-row-id-refactor.md.
   */
  async function sellRunItemAction(target) {
    if (!state.gameRun) return;
    const byInstance = typeof target === 'object' && target !== null;
    const rowId = byInstance ? target.id : null;
    const artifactIdFallback = byInstance ? target.artifactId : target;
    try {
      state.error = '';
      const payload = rowId
        ? { id: rowId, artifactId: artifactIdFallback }
        : { artifactId: artifactIdFallback };
      const data = await apiJson(
        `/api/game-run/${state.gameRun.id}/sell`,
        { method: 'POST', body: JSON.stringify(payload) },
        state.sessionKey
      );
      state.gameRun = { ...state.gameRun, player: { ...state.gameRun.player, coins: data.coins } };

      // The server's response always includes the row id that was deleted.
      const deletedRowId = data.id || rowId || null;
      const deletedArtifactId = data.artifactId || artifactIdFallback;

      // Prune builderItems: prefer row id, fall back to first-match artifactId.
      if (deletedRowId) {
        const idx = state.builderItems.findIndex((i) => i.id === deletedRowId);
        if (idx >= 0) {
          state.builderItems = [
            ...state.builderItems.slice(0, idx),
            ...state.builderItems.slice(idx + 1)
          ];
        }
      } else {
        const idx = state.builderItems.findIndex((i) => i.artifactId === deletedArtifactId);
        if (idx >= 0) {
          state.builderItems = [
            ...state.builderItems.slice(0, idx),
            ...state.builderItems.slice(idx + 1)
          ];
        }
      }

      // Prune containerItems similarly.
      if (deletedRowId) {
        const idx = state.containerItems.findIndex((s) => s.id === deletedRowId);
        if (idx >= 0) {
          state.containerItems = [
            ...state.containerItems.slice(0, idx),
            ...state.containerItems.slice(idx + 1)
          ];
        }
      } else {
        const idx = state.containerItems.findIndex((s) => s.artifactId === deletedArtifactId);
        if (idx >= 0) {
          state.containerItems = [
            ...state.containerItems.slice(0, idx),
            ...state.containerItems.slice(idx + 1)
          ];
        }
      }

      // activeBags: same treatment.
      if (deletedRowId) {
        const idx = state.activeBags.findIndex((b) => b.id === deletedRowId);
        if (idx >= 0) {
          state.activeBags = [
            ...state.activeBags.slice(0, idx),
            ...state.activeBags.slice(idx + 1)
          ];
        }
      } else {
        const idx = state.activeBags.findIndex((b) => b.artifactId === deletedArtifactId);
        if (idx >= 0) {
          state.activeBags = [
            ...state.activeBags.slice(0, idx),
            ...state.activeBags.slice(idx + 1)
          ];
        }
      }

      // freshPurchases is an artifactId string list (decorative UI).
      const freshIdx = state.freshPurchases.indexOf(deletedArtifactId);
      if (freshIdx >= 0) {
        state.freshPurchases = [
          ...state.freshPurchases.slice(0, freshIdx),
          ...state.freshPurchases.slice(freshIdx + 1)
        ];
      }
      haptics.impact('light');

    } catch (error) {
      state.error = error.message || 'Could not sell item';
      haptics.notify('error');
    }
  }

  async function buyRunShopItem(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact || !state.gameRun) return;
    const price = getArtifactPrice(artifact);
    if (price > state.gameRun.player.coins) {
      state.error = messages[state.lang].errorNotEnoughCoins;
      haptics.notify('error');
      return;
    }
    try {
      state.error = '';
      const data = await apiJson(`/api/game-run/${state.gameRun.id}/buy`, { method: 'POST', body: JSON.stringify({ artifactId }) }, state.sessionKey);
      state.gameRun = { ...state.gameRun, player: { ...state.gameRun.player, coins: data.coins } };
      state.gameRunShopOffer = data.shopOffer;
      // The server returns the newly-inserted row id so the container slot
      // carries it immediately. Any action taken against this item before
      // the next bootstrap — place, sell, drag — can target the exact row.
      state.containerItems = [...state.containerItems, { id: data.id || null, artifactId }];
      state.freshPurchases = [...state.freshPurchases, artifactId];
      haptics.impact('light');

    } catch (error) {
      state.error = error.message || 'Could not buy item';
      haptics.notify('error');
    }
  }

  function getRunRefreshCost() {
    return state.gameRunRefreshCount < 3 ? 1 : 2;
  }

  function getRunSellPrice(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact) return 0;
    const price = getArtifactPrice(artifact);
    const isFresh = state.freshPurchases.includes(artifactId);
    return isFresh ? price : Math.floor(price / 2);
  }

  function onSellZoneDragOver(event) {
    event.preventDefault();
    state.sellDragOver = true;
  }

  function onSellZoneDragLeave() {
    state.sellDragOver = false;
  }

  function onSellZoneDrop(event) {
    event.preventDefault();
    state.sellDragOver = false;
    // Prefer the full dragged-instance handle (carries a row id) so the
    // server can disambiguate duplicates. Fall back to the bare
    // draggingArtifactId / dataTransfer text for the shop-drag path,
    // which never has a row id anyway.
    const target = state.draggingItem
      || state.draggingArtifactId
      || event.dataTransfer?.getData('text/plain');
    if (target) sellRunItemAction(target);
    state.draggingArtifactId = '';
    state.draggingItem = null;
    state.draggingSource = '';
  }

  async function persistRunLoadout() {
    if (!state.gameRun || !state.bootstrap?.activeMushroomId) return;
    try {
      await apiJson('/api/artifact-loadout', {
        method: 'PUT',
        body: JSON.stringify({ mushroomId: state.bootstrap.activeMushroomId, items: buildLoadoutPayloadItems() })
      }, state.sessionKey);
    } catch { /* best-effort persist */ }
  }

  return {
    startNewGameRun, resumeGameRun, signalReady,
    continueToNextRound, abandonRun, loadRunShopOffer,
    refreshRunShop, sellRunItemAction, buyRunShopItem,
    getRunRefreshCost, getRunSellPrice, persistRunLoadout,
    onSellZoneDragOver, onSellZoneDragLeave, onSellZoneDrop
  };
}
