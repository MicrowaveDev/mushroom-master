import { query } from '../db.js';
import { artifacts, DAILY_BATTLE_LIMIT, mushroomsForResponse } from '../game-data.js';
import { dayKey, nextUtcReset } from '../lib/utils.js';
import { getBattleHistory } from './battle-service.js';
import { getPlayerState } from './player-service.js';
import { getActiveGameRun, getActiveGameRuns, getGameRunHistory } from './run-service.js';
import { getHomeFieldConfig } from './home-field-config.js';

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
  getActiveGameRuns,
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
  const [dailyUsage, activeGameRuns] = await Promise.all([
    query(
      `SELECT battle_starts FROM daily_rate_limits WHERE player_id = $1 AND day_key = $2`,
      [playerId, dayKey(new Date())]
    ),
    getActiveGameRuns(playerId)
  ]);
  const legacyActiveRun = activeGameRuns.find((run) => !run.mushroomId && run.mode === 'solo') || null;
  const normalizedActiveGameRuns = activeGameRuns.map((run) => (
    run === legacyActiveRun && state.activeMushroomId
      ? { ...run, mushroomId: state.activeMushroomId, player: { ...run.player, mushroomId: state.activeMushroomId } }
      : run
  ));
  const activeGameRun = normalizedActiveGameRuns.find((run) => run.mushroomId === state.activeMushroomId) || null;
  return {
    ...state,
    // Re-stamp portrait URLs with current mtime at response time so a file
    // replaced mid-session shows up on the next /api/bootstrap without a
    // server restart. See app/server/game-data.js portraitUrl().
    mushrooms: mushroomsForResponse(),
    artifacts,
    shopState: null,
    activeGameRun,
    activeGameRuns: normalizedActiveGameRuns,
    battleLimit: {
      used: dailyUsage.rowCount ? Number(dailyUsage.rows[0].battle_starts) : 0,
      limit: DAILY_BATTLE_LIMIT,
      nextResetAt: nextUtcReset(new Date()).toISOString()
    },
    battleHistory: history,
    gameRunHistory: runHistory,
    homeField: getHomeFieldConfig()
  };
}
