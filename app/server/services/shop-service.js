import { createMushroomShopServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { withTransaction } from '../db.js';
import {
  BAG_BASE_CHANCE,
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  bags,
  combatArtifacts,
  getArtifactById,
  getArtifactPrice,
  getEligibleCharacterItems,
  getShopRefreshCost,
  SHOP_OFFER_SIZE
} from '../game-data.js';
import {
  computeCharacterLevel,
  createRng,
  nowIso,
  parseJson,
  runCurrencyFields
} from '../lib/utils.js';
import { isBag } from './artifact-helpers.js';
import { bagsContainingItem } from './loadout-utils.js';
import { withRunLock } from './ready-manager.js';
import {
  deleteLoadoutItemByIdScoped,
  deleteOneByArtifactId,
  insertLoadoutItem,
  insertRefund,
  nextSortOrder,
  readCurrentRoundItems
} from './game-run-loadout.js';

const shopServicePort = createMushroomShopServicePort({
  withTransaction,
  withRunLock,
  bagBaseChance: BAG_BASE_CHANCE,
  bagEscalationStep: BAG_ESCALATION_STEP,
  bagPityThreshold: BAG_PITY_THRESHOLD,
  bags,
  combatArtifacts,
  getArtifactById,
  getArtifactPrice,
  getEligibleCharacterItems,
  getShopRefreshCost,
  shopOfferSize: SHOP_OFFER_SIZE,
  computeCharacterLevel,
  createRng,
  nowIso,
  parseJson,
  runCurrencyFields,
  isBag,
  bagsContainingItem,
  deleteLoadoutItemByIdScoped,
  deleteOneByArtifactId,
  insertLoadoutItem,
  insertRefund,
  nextSortOrder,
  readCurrentRoundItems
});

export const {
  lookupEligibleCharacterItems,
  generateShopOffer,
  buyRunShopItem,
  refreshRunShop,
  forceRunShopForTest,
  sellRunItem
} = shopServicePort;
