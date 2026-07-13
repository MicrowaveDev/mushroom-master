import { createMushroomProviderSettlementServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/economy';
import { query, withTransaction } from '../db.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';
import { WALLET_PURCHASE_PROVIDERS } from './wallet-service.js';

const providerSettlementServicePort = createMushroomProviderSettlementServicePort({
  query,
  withTransaction,
  createId,
  nowIso,
  parseJson,
  walletPurchaseProviders: WALLET_PURCHASE_PROVIDERS
});

export const {
  normalizeProviderSettlementRecord,
  importProviderSettlementRecords
} = providerSettlementServicePort;
