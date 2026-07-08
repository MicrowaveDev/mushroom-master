import { createMushroomGameServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { query } from '../db.js';
import { artifacts, DAILY_BATTLE_LIMIT, mushroomsForResponse } from '../game-data.js';
import { dayKey, nextUtcReset } from '../lib/utils.js';
import { getBattleHistory } from './battle-service.js';
import { getPlayerState } from './player-service.js';
import { getActiveGameRuns, getGameRunHistory } from './run-service.js';
import { getHomeFieldConfig } from './home-field-config.js';
import {
  directBuyPolicy,
  getAssetPacksForPlayer,
  getRuntimeAssetCatalog,
  isAssetGachaEnabled
} from './asset-service.js';

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
export {
  burnAssetPackDuplicates,
  equipAsset,
  equipPortrait,
  getAssetCatalog,
  getRuntimeAssetCatalog,
  getPackOdds,
  getPackOddsForRuntime,
  purchaseAsset,
  rollAssetPack
} from './asset-service.js';
export {
  completeProviderWebhook,
  completePurchaseIntent,
  createPurchaseIntent,
  getPaymentSupportLinks,
  getWalletBundles,
  getWalletState,
  grantCurrencyForPlayer,
  processProviderWebhookEvent,
  spendCurrencyForPlayer,
  validateTelegramPreCheckout
} from './wallet-service.js';

const gameServicePort = createMushroomGameServicePort({
  query,
  artifacts,
  dailyBattleLimit: DAILY_BATTLE_LIMIT,
  mushroomsForResponse,
  dayKey,
  nextUtcReset,
  getBattleHistory,
  getPlayerState,
  getActiveGameRuns,
  getGameRunHistory,
  getHomeFieldConfig,
  directBuyPolicy,
  getAssetPacksForPlayer,
  getRuntimeAssetCatalog,
  isAssetGachaEnabled
});

export const {
  getBootstrap
} = gameServicePort;
