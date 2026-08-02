import { createMushroomGameApiClient } from '../api.js';
import { getArtifactPrice } from '../artifacts/grid.js';
import { messages } from '../i18n.js';
import { normalizeRotation } from '../../../app/shared/bag-shape.js';
import { calculateSeasonAbandonPenalty, calculateSeasonPoints } from '../../../app/shared/season-levels.js';
import {
  gameRunCompletionResultViewState,
  gameRunReadyResultViewState,
  gameRunRoundTransitionViewState,
  gameRunStartResultViewState,
  runShopBuyResultViewState,
  runShopRefreshResultViewState,
  runShopSellResultViewState
} from '@microwavedev/backpack-game-core/client-view-model';
import { projectLoadoutItems } from './loadout-projection.js';

export function useGameRun(state, goTo, getArtifact, refreshBootstrap, loadReplay, feedback = {}) {
  let loadoutSaveQueue = Promise.resolve();
  const haptics = {
    impact: typeof feedback.impact === 'function' ? feedback.impact : () => {},
    notify: typeof feedback.notify === 'function' ? feedback.notify : () => {},
    selectionChanged: typeof feedback.selectionChanged === 'function' ? feedback.selectionChanged : () => {}
  };

  function gameApi() {
    return createMushroomGameApiClient(state.sessionKey);
  }

  function buildLoadoutPayloadItems() {
    const rotationForRowId = (rowId) => {
      const entry = rowId != null ? state.rotatedBags.find((b) => b.id === rowId) : null;
      return normalizeRotation(entry?.rotation ?? (entry ? 1 : 0));
    };
    const withId = (entry, id) => (id ? { id, ...entry } : entry);
    const payload = [];

    for (const bag of state.activeBags) {
      const artifact = getArtifact(bag.artifactId);
      if (!artifact) continue;
      payload.push(withId({
        artifactId: bag.artifactId,
        x: bag.anchorX ?? 0,
        y: bag.anchorY ?? 0,
        width: artifact.width, height: artifact.height,
        active: 1,
        rotated: rotationForRowId(bag.id)
      }, bag.id));
    }
    for (const slot of state.containerItems) {
      const artifact = getArtifact(slot.artifactId);
      if (!artifact || artifact.family !== 'bag') continue;
      payload.push(withId({
        artifactId: slot.artifactId, x: -1, y: -1,
        width: artifact.width, height: artifact.height,
        active: 0,
        rotated: rotationForRowId(slot.id)
      }, slot.id));
    }

    for (const item of state.builderItems) {
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

  function enqueueRunLoadoutSave({ strict = false } = {}) {
    if (!state.gameRun || !state.bootstrap?.activeMushroomId) return Promise.resolve(null);
    const snapshot = {
      gameRunId: state.gameRun.id,
      roundNumber: state.gameRun.currentRound,
      mushroomId: state.bootstrap.activeMushroomId,
      items: buildLoadoutPayloadItems()
    };
    const request = loadoutSaveQueue.then(() => {
      const api = gameApi();
      return api.request(api.routePath('artifactLoadout'), {
        method: 'PUT',
        body: snapshot
      });
    });
    loadoutSaveQueue = request.catch(() => null);
    return strict ? request : loadoutSaveQueue;
  }

  function projectRunLoadout(run) {
    const allArtifacts = state.bootstrap?.artifacts || [];
    const bagsSet = new Set(allArtifacts.filter((a) => a.family === 'bag').map((a) => a.id));
    const artifactById = new Map(allArtifacts.map((a) => [a.id, a]));
    const projected = projectLoadoutItems(run.loadoutItems || [], bagsSet, (id) => artifactById.get(id));
    state.builderItems = projected.builderItems;
    state.containerItems = projected.containerItems;
    state.activeBags = projected.activeBags;
    state.rotatedBags = projected.rotatedBags;
    state.freshPurchases = projected.freshPurchases;
  }

  function attachActiveRunToBootstrap(run) {
    if (!state.bootstrap) return;
    const activeGameRuns = Array.isArray(state.bootstrap.activeGameRuns)
      ? state.bootstrap.activeGameRuns.filter((item) => item.mushroomId !== run.mushroomId)
      : [];
    activeGameRuns.push(run);
    state.bootstrap.activeGameRun = run;
    state.bootstrap.activeGameRuns = activeGameRuns;
    if (state.bootstrap.battleLimit) {
      const currentUsed = Number(state.bootstrap.battleLimit.used || 0) + 1;
      const limit = Number(state.bootstrap.battleLimit.limit || currentUsed);
      state.bootstrap.battleLimit = {
        ...state.bootstrap.battleLimit,
        used: Math.min(limit, currentUsed)
      };
    }
  }

  async function startNewGameRun(mode = 'solo', options = {}) {
    if (state.startingRun) return;
    state.startingRun = true;
    try {
      state.error = '';
      const data = await gameApi().postRoute('gameRunStart', {}, { mode });
      const viewState = gameRunStartResultViewState(data);
      state.gameRun = viewState.run;
      state.gameRunRounds = viewState.rounds;
      state.gameRunShopOffer = viewState.shopOffer;
      state.gameRunRefreshCount = viewState.refreshCount;
      state.gameRunResult = viewState.result;
      state.fusionRevealQueue = viewState.fusionRevealQueue;
      projectRunLoadout(viewState.run);
      attachActiveRunToBootstrap(viewState.run);
      goTo('prep', {}, { skipTransition: !!options.skipTransition });
    } catch (error) {
      state.error = error.message || 'Could not start game run';
    } finally {
      state.startingRun = false;
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
        await enqueueRunLoadoutSave({ strict: true });
      }
      const api = gameApi();
      const data = await api.request(api.routePath('gameRunReady', { gameRunId: state.gameRun.id }), {
        method: 'POST'
      });
      haptics.impact('medium');
      if (data.waiting) return;
      const viewState = gameRunReadyResultViewState(data, {
        run: state.gameRun,
        previousRounds: state.gameRunRounds
      });
      state.gameRunResult = viewState.result;
      state.gameRunRounds = viewState.rounds;
      state.gameRun = viewState.run;
      // Spec: docs/user-flows.md Flow B Step 3 — post-Ready lands directly
      // on the replay screen, which autoplays the battle and then renders
      // an inline rewards card (Spore/Mycelium/Rating) next to the Continue
      // button. There is no separate round-result screen — the player sees
      // the battle happen and gets the rewards in context.
      if (viewState.shouldLoadReplay && loadReplay) {
        await loadReplay(viewState.battleId, { battle: viewState.battle });
      } else if (viewState.shouldShowComplete) {
        // No battleId (shouldn't happen) — fall through to the summary.
        goTo('runComplete', { gameRunId: viewState.completionGameRunId || state.gameRun.id });
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
    const resolvedRun = state.gameRunResult;
    const viewState = gameRunRoundTransitionViewState(resolvedRun, { run: state.gameRun });
    state.gameRunResult = viewState.result;
    state.gameRunRefreshCount = viewState.refreshCount;

    if (!viewState.shouldRefreshBootstrap) {
      const allArtifacts = state.bootstrap?.artifacts || [];
      const bagsSet = new Set(allArtifacts.filter((a) => a.family === 'bag').map((a) => a.id));
      const artifactById = new Map(allArtifacts.map((a) => [a.id, a]));
      const projected = projectLoadoutItems(viewState.loadoutItems, bagsSet, (id) => artifactById.get(id));
      state.builderItems = projected.builderItems;
      state.containerItems = projected.containerItems;
      state.activeBags = projected.activeBags;
      state.rotatedBags = projected.rotatedBags;
      state.freshPurchases = projected.freshPurchases;
      state.gameRunShopOffer = viewState.shopOffer;
      state.gameRun = viewState.run;
      if (state.bootstrap?.activeGameRun?.id === state.gameRun.id) {
        state.bootstrap.activeGameRun = {
          ...state.bootstrap.activeGameRun,
          ...state.gameRun
        };
      }
    } else if (refreshBootstrap) {
      // Fallback for older server payloads.
      await refreshBootstrap();
    }

    state.fusionRevealQueue = viewState.fusionRevealQueue;
    goTo('prep');
  }

  async function loadRunShopOffer() {
    if (!state.gameRun) return;
    try {
      const data = await gameApi().getRoute('gameRun', { gameRunId: state.gameRun.id });
      if (data.shopOffer) state.gameRunShopOffer = data.shopOffer;
    } catch { /* ignore */ }
  }

  async function loadRunSummary(runId, options = {}) {
    if (!runId) return;
    try {
      state.error = '';
      const data = await gameApi().getRoute('gameRun', { gameRunId: runId });
      state.gameRunSummary = data;
      goTo('runSummary', { gameRunId: runId }, options.routeOptions || {});
    } catch (error) {
      state.error = error.message || 'Could not load game summary';
    }
  }

  async function loadRunComplete(runId, options = {}) {
    if (!runId) return;
    try {
      state.error = '';
      const data = await gameApi().getRoute('gameRun', { gameRunId: runId });
      if (data.status !== 'completed' && data.status !== 'abandoned') {
        state.gameRun = data;
        state.gameRunResult = null;
        goTo('prep', {}, options.routeOptions || {});
        return;
      }
      const viewState = gameRunCompletionResultViewState(data);
      state.gameRun = viewState.run;
      state.gameRunResult = viewState.result;
      state.gameRunRounds = viewState.rounds;
      goTo('runComplete', { gameRunId: data.id }, options.routeOptions || {});
    } catch (error) {
      state.error = error.message || 'Could not load completed run';
      goTo('home');
    }
  }

  function previewAbandonPenalty() {
    return calculateSeasonAbandonPenalty({
      endReason: 'abandoned',
      roundsCompleted: state.gameRun?.player?.completedRounds || 0
    });
  }

  function requestAbandonRun() {
    if (!state.gameRun) return;
    const player = state.gameRun.player || {};
    const currentPoints = calculateSeasonPoints({
      wins: player.wins || 0,
      losses: player.losses || 0,
      roundsCompleted: player.completedRounds || 0
    });
    const penalty = previewAbandonPenalty();
    state.pendingAbandonCurrentPoints = currentPoints;
    state.pendingAbandonPenalty = penalty;
    state.pendingAbandonNetPoints = currentPoints + penalty;
    state.abandonConfirmOpen = true;
  }

  function cancelAbandonRun() {
    state.abandonConfirmOpen = false;
  }

  async function confirmAbandonRun() {
    if (!state.gameRun) return;
    try {
      state.actionInFlight = true;
      state.error = '';
      const api = gameApi();
      const data = await api.request(api.routePath('gameRunAbandon', { gameRunId: state.gameRun.id }), {
        method: 'POST'
      });
      state.abandonConfirmOpen = false;
      const viewState = gameRunCompletionResultViewState(data);
      state.gameRun = viewState.run;
      state.gameRunResult = viewState.result;
      state.gameRunRounds = viewState.rounds;
      state.gameRunShopOffer = viewState.shopOffer;
      await refreshBootstrap();
      goTo('runComplete', { gameRunId: data.id });
    } catch (error) {
      state.error = error.message || 'Could not abandon game run';
      haptics.notify('error');
    } finally {
      state.actionInFlight = false;
    }
  }

  async function refreshRunShop() {
    if (!state.gameRun) return;
    try {
      state.error = '';
      const api = gameApi();
      const data = await api.request(api.routePath('gameRunRefreshShop', { gameRunId: state.gameRun.id }), {
        method: 'POST'
      });
      const viewState = runShopRefreshResultViewState(data, { run: state.gameRun });
      state.gameRunShopOffer = viewState.shopOffer;
      state.gameRunRefreshCount = viewState.refreshCount;
      state.gameRun = viewState.run;
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
      const data = await gameApi().postRoute('gameRunSell', { gameRunId: state.gameRun.id }, payload);
      const viewState = runShopSellResultViewState(data, {
        run: state.gameRun,
        builderItems: state.builderItems,
        containerItems: state.containerItems,
        activeBags: state.activeBags,
        freshPurchases: state.freshPurchases,
        target
      });
      state.gameRun = viewState.run;
      state.builderItems = viewState.builderItems;
      state.containerItems = viewState.containerItems;
      state.activeBags = viewState.activeBags;
      state.freshPurchases = viewState.freshPurchases;
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
      const data = await gameApi().postRoute('gameRunBuy', { gameRunId: state.gameRun.id }, { artifactId });
      const viewState = runShopBuyResultViewState(data, {
        run: state.gameRun,
        containerItems: state.containerItems,
        freshPurchases: state.freshPurchases,
        artifactId
      });
      state.gameRun = viewState.run;
      state.gameRunShopOffer = viewState.shopOffer;
      state.containerItems = viewState.containerItems;
      state.freshPurchases = viewState.freshPurchases;
      haptics.impact('light');
      return true;

    } catch (error) {
      state.error = error.message || 'Could not buy item';
      haptics.notify('error');
      return false;
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
    await enqueueRunLoadoutSave();
  }

  return {
    startNewGameRun, resumeGameRun, signalReady,
    continueToNextRound, requestAbandonRun, cancelAbandonRun, confirmAbandonRun, loadRunShopOffer, loadRunSummary, loadRunComplete,
    refreshRunShop, sellRunItemAction, buyRunShopItem,
    getRunRefreshCost, getRunSellPrice, persistRunLoadout,
    onSellZoneDragOver, onSellZoneDragLeave, onSellZoneDrop
  };
}
