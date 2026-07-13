import { createRunRuntimeService } from '@microwavedev/backpack-game-core/modules/run';
import {
  abandonGameRun,
  buyRunShopItem,
  getActiveGameRun,
  getGameRun,
  getGameRunHistory,
  refreshRunShop,
  resolveRound,
  sellRunItem,
  startGameRun
} from './run-service.js';

export const runRuntimeService = createRunRuntimeService({
  adapters: {
    startRun: ({ playerId, input }) => startGameRun(playerId, input?.mode || 'solo'),
    getRun: ({ playerId, runId }) => getGameRun(runId, playerId),
    getActiveRun: ({ playerId, input }) => getActiveGameRun(playerId, input?.characterId || null),
    listRunHistory: ({ playerId, input }) => getGameRunHistory(playerId, input?.limit || 20),
    abandonRun: ({ playerId, runId }) => abandonGameRun(playerId, runId),
    refreshShop: ({ playerId, runId }) => refreshRunShop(playerId, runId),
    buyItem: ({ playerId, runId, assetId }) => buyRunShopItem(playerId, runId, assetId),
    sellItem: ({ playerId, runId, item }) => sellRunItem(playerId, runId, item),
    resolveRound: ({ playerId, runId }) => resolveRound(playerId, runId)
  }
});
