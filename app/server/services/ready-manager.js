import { createReadyManagerExports } from '@microwavedev/backpack-game-core/server';

const readyManager = createReadyManagerExports({
  requiredReadyCount: 2
});

export const setReady = readyManager.setReady;
export const setUnready = readyManager.setUnready;
export const touchActivity = readyManager.touchActivity;
export const isReady = readyManager.isReady;
export const areBothReady = readyManager.areBothReady;
export const clearRound = readyManager.clearRound;
export const clearRun = readyManager.clearRun;
export const getIdleRunIds = readyManager.getIdleRunIds;
export const withRunLock = readyManager.withRunLock;
