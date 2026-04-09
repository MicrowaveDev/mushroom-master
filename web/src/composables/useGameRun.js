import { apiJson } from '../api.js';
import { getArtifactPrice } from '../artifacts/grid.js';

export function useGameRun(state, goTo, getArtifact, refreshBootstrap, persistShopOffer) {
  async function startNewGameRun(mode = 'solo') {
    try {
      state.error = '';
      const data = await apiJson('/api/game-run/start', { method: 'POST', body: JSON.stringify({ mode }) }, state.sessionKey);
      state.gameRun = data;
      state.gameRunShopOffer = data.shopOffer || [];
      state.gameRunRefreshCount = 0;
      state.gameRunResult = null;
      state.builderItems = [];
      state.containerItems = [];
      state.freshPurchases = [];
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
      if (state.bootstrap?.activeMushroomId && state.builderItems.length) {
        await apiJson('/api/artifact-loadout', {
          method: 'PUT',
          body: JSON.stringify({ mushroomId: state.bootstrap.activeMushroomId, items: state.builderItems })
        }, state.sessionKey);
      }
      const data = await apiJson(`/api/game-run/${state.gameRun.id}/ready`, { method: 'POST' }, state.sessionKey);
      if (data.waiting) return;
      state.gameRunResult = data;
      if (data.status === 'completed' || data.status === 'abandoned') {
        state.gameRun = { ...state.gameRun, status: data.status, endReason: data.endReason };
        goTo('runComplete');
      } else {
        goTo('roundResult');
      }
    } catch (error) {
      state.error = error.message || 'Could not resolve round';
    } finally {
      state.actionInFlight = false;
    }
  }

  function continueToNextRound() {
    if (!state.gameRunResult || !state.gameRun) return;
    const result = state.gameRunResult;
    state.gameRun = {
      ...state.gameRun,
      currentRound: result.currentRound,
      status: result.status,
      player: result.player
    };
    state.gameRunResult = null;
    state.gameRunRefreshCount = 0;
    state.freshPurchases = [];
    loadRunShopOffer();
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

  return {
    startNewGameRun, resumeGameRun, signalReady,
    continueToNextRound, abandonRun, loadRunShopOffer,
    refreshRunShop, sellRunItemAction, buyRunShopItem,
    getRunRefreshCost, getRunSellPrice,
    onSellZoneDragOver, onSellZoneDragLeave, onSellZoneDrop
  };
}
