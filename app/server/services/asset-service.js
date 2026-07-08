import {
  createMushroomAssetServicePort,
  WALLET_CURRENCY_CODE
} from '@microwavedev/backpack-game-core/server/ports/mushroom/economy';
import { query, withTransaction } from '../db.js';
import {
  PORTRAIT_VARIANTS,
  portraitVariantsForResponse,
  portraitUrl
} from '../game-data.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';
import {
  spendCurrency,
  withWalletMutationLock
} from './wallet-service.js';
import { withMutationClaim } from './mutation-claim-service.js';

const assetServicePort = createMushroomAssetServicePort({
  query,
  withTransaction,
  PORTRAIT_VARIANTS,
  portraitVariantsForResponse,
  portraitUrl,
  createId,
  nowIso,
  parseJson,
  spendCurrency,
  WALLET_CURRENCY_CODE,
  withWalletMutationLock,
  withMutationClaim,
  env: process.env
});

export const {
  activeGachaPackIds,
  assetGachaDbPacksEnabled,
  assetPolicy,
  burnAssetPackDuplicates,
  chooseWeightedAssetCandidate,
  computePackPityState,
  directBuyPolicy,
  equipAsset,
  equipPortrait,
  getAssetById,
  getAssetCatalog,
  getAssetPack,
  getAssetPacks,
  getAssetPacksForPlayer,
  getDatabaseAssetPacks,
  getPackOdds,
  getPackOddsForRuntime,
  getPlayerCosmeticState,
  getRuntimeAssetById,
  getRuntimeAssetCatalog,
  getRuntimeAssetPack,
  getRuntimeAssetPacks,
  getRuntimePortraitVariantsForResponse,
  isAssetGachaEnabled,
  parsePortraitAssetId,
  portraitAssetId,
  purchaseAsset,
  resolveAssetPackRollCandidates,
  resolveEquippedPortraitId,
  rollAssetPack,
  selectAssetPackRollResults,
  shapeAssetPack,
  shapePortraitVariant,
  shapePortraitVariantsForCharacter,
  validateAssetPack
} = assetServicePort;
