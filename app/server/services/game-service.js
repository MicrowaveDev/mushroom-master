import { query } from '../db.js';
import { artifacts, DAILY_BATTLE_LIMIT, mushrooms } from '../game-data.js';
import { dayKey, nextUtcReset } from '../lib/utils.js';
import { getBattleHistory } from './battle-service.js';
import { getPlayerState } from './player-service.js';
import { getActiveGameRun, getShopState } from './run-service.js';

export { validateLoadoutItems } from './loadout-utils.js';
export { simulateBattle } from './battle-engine.js';
export {
  createBattle,
  getBattle,
  getBattleHistory
} from './battle-service.js';
export {
  acceptFriendChallenge,
  addFriendByCode,
  createFriendChallenge,
  createRunChallenge,
  declineFriendChallenge,
  getFriendChallenge,
  getFriends,
  getInventoryReviewSamples,
  getLeaderboard,
  getPlayerState,
  saveArtifactLoadout,
  saveLocalTestRun,
  selectActiveMushroom,
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
  pruneOldGhostSnapshots,
  refreshRunShop,
  resolveRound,
  saveShopState,
  sellRunItem,
  startGameRun
} from './run-service.js';

export async function getBootstrap(playerId) {
  const state = await getPlayerState(playerId);
  const history = await getBattleHistory(playerId, 10);
  const [dailyUsage, shopState, activeGameRun] = await Promise.all([
    query(
      `SELECT battle_starts FROM daily_rate_limits WHERE player_id = $1 AND day_key = $2`,
      [playerId, dayKey(new Date())]
    ),
    getShopState(playerId),
    getActiveGameRun(playerId)
  ]);
  return {
    ...state,
    mushrooms,
    artifacts,
    shopState,
    activeGameRun,
    battleLimit: {
      used: dailyUsage.rowCount ? Number(dailyUsage.rows[0].battle_starts) : 0,
      limit: DAILY_BATTLE_LIMIT,
      nextResetAt: nextUtcReset(new Date()).toISOString()
    },
    battleHistory: history
  };
}
