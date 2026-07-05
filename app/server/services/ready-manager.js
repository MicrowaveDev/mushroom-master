import { createRunReadinessManager } from '@microwavedev/backpack-game-core/server';

const manager = createRunReadinessManager({ requiredReadyCount: 2 });

export const setReady = manager.setReady;
export const setUnready = manager.setUnready;
export const touchActivity = manager.touchActivity;
export const isReady = manager.isReady;
export const areBothReady = manager.readyStatus;
export const clearRound = manager.clearRound;
export const clearRun = manager.clearRun;
export const getIdleRunIds = manager.getIdleRunIds;
export const withRunLock = manager.withRunLock;
