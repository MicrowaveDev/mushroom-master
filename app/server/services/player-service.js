import { createMushroomPlayerServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { query, withTransaction } from '../db.js';
import {
  getMushroomById,
  getTier,
  mushrooms,
  STARTER_PRESET_VARIANTS
} from '../game-data.js';
import {
  computeCharacterLevel,
  createId,
  nowIso
} from '../lib/utils.js';
import { getSeasonLevel } from '../../shared/season-levels.js';
import { createBotGhostSnapshot } from './bot-loadout.js';
import {
  equipPortrait,
  getPlayerCosmeticState,
  getRuntimeAssetCatalog,
  getRuntimePortraitVariantsForResponse,
  parsePortraitAssetId,
  shapePortraitVariantsForCharacter
} from './asset-service.js';
import { getWalletState } from './wallet-service.js';

const playerServicePort = createMushroomPlayerServicePort({
  query,
  withTransaction,
  getMushroomById,
  getTier,
  mushrooms,
  starterPresetVariants: STARTER_PRESET_VARIANTS,
  computeCharacterLevel,
  createId,
  nowIso,
  getSeasonLevel,
  createBotGhostSnapshot,
  equipPortrait,
  getPlayerCosmeticState,
  getRuntimeAssetCatalog,
  getRuntimePortraitVariantsForResponse,
  parsePortraitAssetId,
  shapePortraitVariantsForCharacter,
  getWalletState,
  createChallengeRun: async (...args) => {
    const { createChallengeRun } = await import('./run-service.js');
    return createChallengeRun(...args);
  }
});

export const {
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
} = playerServicePort;
