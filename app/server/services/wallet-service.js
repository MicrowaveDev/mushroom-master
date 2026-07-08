import {
  createMushroomWalletServicePort,
  WALLET_CURRENCY_CODE,
  WALLET_PAYMENT_SURFACES,
  WALLET_PURCHASE_PROVIDERS,
  WALLET_PURCHASE_STATUSES
} from '@microwavedev/backpack-game-core/server/ports/mushroom/economy';
import { query, withTransaction } from '../db.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';

const walletServicePort = createMushroomWalletServicePort({
  query,
  withTransaction,
  createId,
  nowIso,
  parseJson,
  env: process.env,
  defaultFetch: globalThis.fetch
});

export {
  WALLET_CURRENCY_CODE,
  WALLET_PAYMENT_SURFACES,
  WALLET_PURCHASE_PROVIDERS,
  WALLET_PURCHASE_STATUSES
};

export const {
  auditWalletMirror,
  backfillMissingWalletBalancesFromPlayers,
  completeProviderWebhook,
  completePurchaseIntent,
  completeTelegramSuccessfulPayment,
  createPurchaseIntent,
  expireStalePurchaseIntents,
  getPaymentSupportLinks,
  getWalletBundles,
  getWalletPurchaseProviders,
  getWalletState,
  grantCurrency,
  grantCurrencyForPlayer,
  normalizePaymentSurface,
  processProviderWebhookEvent,
  reconcileWalletPayments,
  spendCurrency,
  spendCurrencyForPlayer,
  validateTelegramPreCheckout,
  withWalletMutationLock
} = walletServicePort;
