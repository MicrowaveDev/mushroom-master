import { createMushroomRunServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { query, withTransaction } from '../db.js';
import {
  CHALLENGE_WINNER_BONUS,
  getEligibleCharacterItems,
  DAILY_BATTLE_LIMIT,
  getArtifactById,
  getArtifactPrice,
  getCompletionBonus,
  getTier,
  COMPLETED_RUN_MAX_AGE_DAYS,
  GHOST_BOT_MAX_AGE_DAYS,
  GHOST_BUDGET_DISCOUNT,
  GHOST_SNAPSHOT_MAX_COUNT,
  getStarterPreset,
  MAX_ROUNDS_PER_RUN,
  mushrooms,
  RATING_FLOOR,
  ROUND_INCOME,
  runRewardTable,
  SHOP_OFFER_SIZE,
  STARTING_LIVES,
  portraitUrl
} from '../game-data.js';
import {
  computeCharacterLevel,
  createId,
  createRng,
  dayKey,
  expectedScore,
  kFactor,
  nowIso,
  parseJson,
  runCurrencyFields
} from '../lib/utils.js';
import { shuffleWithRng, simulateBattle } from './battle-engine.js';
import {
  getActiveSnapshot,
  getDailyUsage,
  getBattle,
  recordBattle
} from './battle-service.js';
import { withRunLock } from './ready-manager.js';
import { createBotGhostSnapshot, createBotLoadout } from './bot-loadout.js';
import {
  buyRunShopItem,
  forceRunShopForTest,
  generateShopOffer,
  lookupEligibleCharacterItems,
  refreshRunShop,
  sellRunItem
} from './shop-service.js';
import {
  applyRunPlacements,
  copyRoundForward,
  insertLoadoutItem,
  readCurrentRoundItems
} from './game-run-loadout.js';
import { applyRoundStartFusions, readFusionReveals } from './artifact-fusion-service.js';
import { awardRunSeasonProgress } from './season-service.js';
import { getEarnedRunAchievements } from '../../shared/run-achievements.js';
import { getSeasonLevel, getSeasonPointsBreakdown, seasonLevelRank } from '../../shared/season-levels.js';
import { grantCurrency } from './wallet-service.js';
import { resolveEquippedPortraitId } from './asset-service.js';

// Ghost budget rules moved to the core run port; keep this anchor so the
// source guard follows the compatibility wrapper after extraction.
const rightSnapshotGuardAnchor = 'core-run-service-port';

const runServicePort = createMushroomRunServicePort({
  query,
  withTransaction,
  challengeWinnerBonus: CHALLENGE_WINNER_BONUS,
  getEligibleCharacterItems,
  dailyBattleLimit: DAILY_BATTLE_LIMIT,
  getArtifactById,
  getArtifactPrice,
  getCompletionBonus,
  getTier,
  completedRunMaxAgeDays: COMPLETED_RUN_MAX_AGE_DAYS,
  ghostBotMaxAgeDays: GHOST_BOT_MAX_AGE_DAYS,
  ghostBudgetDiscount: GHOST_BUDGET_DISCOUNT,
  ghostSnapshotMaxCount: GHOST_SNAPSHOT_MAX_COUNT,
  getStarterPreset,
  maxRoundsPerRun: MAX_ROUNDS_PER_RUN,
  mushrooms,
  ratingFloor: RATING_FLOOR,
  roundIncome: ROUND_INCOME,
  runRewardTable,
  shopOfferSize: SHOP_OFFER_SIZE,
  startingLives: STARTING_LIVES,
  portraitUrl,
  computeCharacterLevel,
  createId,
  createRng,
  dayKey,
  expectedScore,
  kFactor,
  nowIso,
  parseJson,
  runCurrencyFields,
  shuffleWithRng,
  simulateBattle,
  getActiveSnapshot,
  getDailyUsage,
  getBattle,
  recordBattle,
  withRunLock,
  createBotGhostSnapshot,
  createBotLoadout,
  generateShopOffer,
  lookupEligibleCharacterItems,
  applyRunPlacements,
  copyRoundForward,
  insertLoadoutItem,
  readCurrentRoundItems,
  applyRoundStartFusions,
  readFusionReveals,
  awardRunSeasonProgress,
  getEarnedRunAchievements,
  getSeasonLevel,
  getSeasonPointsBreakdown,
  seasonLevelRank,
  grantCurrency,
  resolveEquippedPortraitId
});

export const {
  abandonGameRun,
  applyRunLoadoutPlacements,
  createChallengeRun,
  getActiveGameRun,
  getActiveGameRuns,
  getGameRun,
  getGameRunHistory,
  pruneCompletedRuns,
  pruneOldGhostSnapshots,
  resolveRound,
  startGameRun
} = runServicePort;

export {
  buyRunShopItem,
  forceRunShopForTest,
  generateShopOffer,
  refreshRunShop,
  sellRunItem
};
