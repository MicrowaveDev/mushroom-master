import { apiJson } from '../api.js';
import { getArtifactPrice } from '../artifacts/grid.js';
import { INVENTORY_ROWS } from '../constants.js';

export function useGameRun(state, goTo, getArtifact, refreshBootstrap, persistShopOffer, loadReplay) {
  function buildLoadoutPayloadItems() {
    // Map frontend state to server loadout payload.
    // - Base grid items (y < INVENTORY_ROWS): sent with grid coordinates
    // - Items in bag rows (y >= INVENTORY_ROWS): sent with bagId, no coords
    // - Bags: sent with no grid coordinates (they provide slots, not cells)
    const activeBagLayout = [];
    let r = INVENTORY_ROWS;
    for (const bagId of state.activeBags) {
      const bag = getArtifact(bagId);
      if (!bag) continue;
      const rotated = state.rotatedBags.includes(bagId);
      const rows = rotated ? Math.max(bag.width, bag.height) : Math.min(bag.width, bag.height);
      activeBagLayout.push({ bagId, startRow: r, rowCount: rows });
      r += rows;
    }

    const payload = [];
    // Bags (including container bags) must be declared before bagged items reference them.
    // Bags live off the main grid — rendered in the active-bags bar — so they carry the
    // container sentinel (-1,-1), not grid coordinates.
    for (const bagId of state.activeBags) {
      const bag = getArtifact(bagId);
      if (!bag) continue;
      payload.push({ artifactId: bagId, x: -1, y: -1, width: bag.width, height: bag.height });
    }
    // Unactivated bags in container
    for (const artifactId of state.containerItems) {
      const artifact = getArtifact(artifactId);
      if (!artifact || artifact.family !== 'bag') continue;
      payload.push({ artifactId, x: -1, y: -1, width: artifact.width, height: artifact.height });
    }
    // Placed grid items and bagged items
    for (const item of state.builderItems) {
      if (item.y >= INVENTORY_ROWS) {
        const info = activeBagLayout.find((b) => item.y >= b.startRow && item.y < b.startRow + b.rowCount);
        if (info) {
          payload.push({ artifactId: item.artifactId, width: item.width, height: item.height, bagId: info.bagId });
          continue;
        }
      }
      payload.push({ artifactId: item.artifactId, x: item.x, y: item.y, width: item.width, height: item.height });
    }
    // Non-bag container items (not placed)
    for (const artifactId of state.containerItems) {
      const artifact = getArtifact(artifactId);
      if (!artifact || artifact.family === 'bag') continue;
      payload.push({ artifactId, x: -1, y: -1, width: artifact.width, height: artifact.height });
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
    } catch (error) {
      state.error = error.message || 'Not enough coins';
    }
  }

  async function sellRunItemAction(artifactId) {
    if (!state.gameRun) return;
    try {
      state.error = '';
      const data = await apiJson(`/api/game-run/${state.gameRun.id}/sell`, { method: 'POST', body: JSON.stringify({ artifactId }) }, state.sessionKey);
      state.gameRun = { ...state.gameRun, player: { ...state.gameRun.player, coins: data.coins } };
      state.builderItems = state.builderItems.filter((i) => i.artifactId !== artifactId);
      state.containerItems = state.containerItems.filter((id) => id !== artifactId);
      state.activeBags = state.activeBags.filter((id) => id !== artifactId);
      state.freshPurchases = state.freshPurchases.filter((id) => id !== artifactId);
      persistShopOffer();
    } catch (error) {
      state.error = error.message || 'Could not sell item';
    }
  }

  async function buyRunShopItem(artifactId) {
    const artifact = getArtifact(artifactId);
    if (!artifact || !state.gameRun) return;
    const price = getArtifactPrice(artifact);
    if (price > state.gameRun.player.coins) {
      state.error = state.lang === 'ru' ? 'Недостаточно монет' : 'Not enough coins';
      return;
    }
    try {
      state.error = '';
      const data = await apiJson(`/api/game-run/${state.gameRun.id}/buy`, { method: 'POST', body: JSON.stringify({ artifactId }) }, state.sessionKey);
      state.gameRun = { ...state.gameRun, player: { ...state.gameRun.player, coins: data.coins } };
      state.gameRunShopOffer = data.shopOffer;
      state.containerItems = [...state.containerItems, artifactId];
      state.freshPurchases = [...state.freshPurchases, artifactId];
      persistShopOffer();
    } catch (error) {
      state.error = error.message || 'Could not buy item';
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
    const artifactId = state.draggingArtifactId || event.dataTransfer?.getData('text/plain');
    if (artifactId) sellRunItemAction(artifactId);
    state.draggingArtifactId = '';
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
