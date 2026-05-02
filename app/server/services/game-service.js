import { query } from '../db.js';
import { artifacts, DAILY_BATTLE_LIMIT, mushroomsForResponse } from '../game-data.js';
import { dayKey, nextUtcReset } from '../lib/utils.js';
import { getBattleHistory } from './battle-service.js';
import { getPlayerState } from './player-service.js';
import { getActiveGameRun, getGameRunHistory } from './run-service.js';

export { validateLoadoutItems } from './loadout-utils.js';
export { simulateBattle } from './battle-engine.js';
export {
  getBattle,
  getBattleHistory
} from './battle-service.js';
export {
  acceptFriendChallenge,
  addFriendByCode,
  createRunChallenge,
  declineFriendChallenge,
  getFriendChallenge,
  getFriends,
  getInventoryReviewSamples,
  getLeaderboard,
  getPlayerState,
  saveLocalTestRun,
  selectActiveMushroom,
  switchPortrait,
  switchPreset,
  updateSettings
} from './player-service.js';
export {
  abandonGameRun,
  applyRunLoadoutPlacements,
  buyRunShopItem,
  createChallengeRun,
  generateShopOffer,
  getActiveGameRun,
  getGameRun,
  getGameRunHistory,
  pruneCompletedRuns,
  pruneOldGhostSnapshots,
  refreshRunShop,
  forceRunShopForTest,
  resolveRound,
  sellRunItem,
  startGameRun
} from './run-service.js';

export async function getBootstrap(playerId) {
  const state = await getPlayerState(playerId);
  const [history, runHistory] = await Promise.all([
    getBattleHistory(playerId, 10),
    getGameRunHistory(playerId, 10)
  ]);
  const [dailyUsage, activeGameRun] = await Promise.all([
    query(
      `SELECT battle_starts FROM daily_rate_limits WHERE player_id = $1 AND day_key = $2`,
      [playerId, dayKey(new Date())]
    ),
    getActiveGameRun(playerId)
  ]);
  return {
    ...state,
    // Re-stamp portrait URLs with current mtime at response time so a file
    // replaced mid-session shows up on the next /api/bootstrap without a
    // server restart. See app/server/game-data.js portraitUrl().
    mushrooms: mushroomsForResponse(),
    artifacts,
    shopState: null,
    activeGameRun,
    battleLimit: {
      used: dailyUsage.rowCount ? Number(dailyUsage.rows[0].battle_starts) : 0,
      limit: DAILY_BATTLE_LIMIT,
      nextResetAt: nextUtcReset(new Date()).toISOString()
    },
    battleHistory: history,
    gameRunHistory: runHistory
  };
}
