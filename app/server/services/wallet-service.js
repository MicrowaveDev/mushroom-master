import crypto from 'crypto';
import {
  WALLET_PURCHASE_STATUSES as CORE_WALLET_PURCHASE_STATUSES,
  canRecordWalletPurchaseStatus,
  createWalletPurchaseCheckoutMetadataPatch,
  createWalletPurchaseCompletionPlan,
  createWalletPurchaseIntentDraft,
  createWalletPurchaseReversalMutation,
  createWalletTransactionDraft,
  isWalletPurchaseClawbackStatus,
  isWalletPurchaseReviewStatus,
  normalizeWalletCurrencyCode,
  normalizeWalletGrantAmount,
  normalizeWalletSpendAmount,
  validateWalletDelta,
  shapeWalletPurchaseCheckout,
  walletPurchaseCheckoutIsResolved
} from '@microwavedev/backpack-game-core/modules/wallet';
import { query, withTransaction } from '../db.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';

export const WALLET_CURRENCY_CODE = 'soft_coin';

export const WALLET_PURCHASE_PROVIDERS = new Set([
  'telegram_stars',
  'btcpay',
  'nowpayments'
]);

export const WALLET_PAYMENT_SURFACES = {
  telegram_mini_app: ['telegram_stars'],
  web: ['telegram_stars', 'btcpay', 'nowpayments']
};

const PROVIDER_PRICE_CONFIG = {
  telegram_stars: { priceCurrency: 'XTR', unitScale: 1 },
  btcpay: { priceCurrency: 'USD', unitScale: 100 },
  nowpayments: { priceCurrency: 'USD', unitScale: 100 }
};

const BASE_WALLET_BUNDLES = [
  { id: 'coins_small', walletAmount: 100, priceUnits: 1 },
  { id: 'coins_medium', walletAmount: 550, priceUnits: 5 },
  { id: 'coins_large', walletAmount: 1200, priceUnits: 10 }
];

export const WALLET_PURCHASE_STATUSES = new Set(CORE_WALLET_PURCHASE_STATUSES);

const walletMutationLocks = new Map();
const purchaseIntentLocks = new Map();
const checkoutLocks = new Map();
const CHECKOUT_CLAIM_TTL_MS = 2 * 60 * 1000;
const CHECKOUT_WAIT_TIMEOUT_MS = 2500;
const CHECKOUT_WAIT_INTERVAL_MS = 25;
const PURCHASE_INTENT_EXPIRY_MS = 24 * 60 * 60 * 1000;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function getPaymentSupportLinks({ fallbackUrl = '' } = {}) {
  return {
    supportUrl: process.env.PAYMENT_SUPPORT_URL || process.env.PUBLIC_SUPPORT_URL || fallbackUrl || '',
    termsUrl: process.env.PAYMENT_TERMS_URL || process.env.PUBLIC_TERMS_URL || fallbackUrl || ''
  };
}

async function withKeyedLock(lockMap, lockKey, work) {
  const normalizedKey = String(lockKey || '');
  let releaseLock;
  const lockPromise = new Promise((resolve) => { releaseLock = resolve; });
  const previousLock = lockMap.get(normalizedKey) || Promise.resolve();
  lockMap.set(normalizedKey, lockPromise);
  await previousLock;
  try {
    return await work();
  } finally {
    if (lockMap.get(normalizedKey) === lockPromise) {
      lockMap.delete(normalizedKey);
    }
    releaseLock();
  }
}

export async function withWalletMutationLock(playerId, work) {
  return withKeyedLock(walletMutationLocks, `wallet:${playerId || ''}`, work);
}

function normalizeCurrencyCode(currencyCode = WALLET_CURRENCY_CODE) {
  return normalizeWalletCurrencyCode(currencyCode, { defaultCurrencyCode: WALLET_CURRENCY_CODE });
}

function providerConfig(provider) {
  const normalized = String(provider || 'telegram_stars').trim();
  if (!WALLET_PURCHASE_PROVIDERS.has(normalized)) {
    throw httpError('Unknown wallet purchase provider', 400);
  }
  return { provider: normalized, ...PROVIDER_PRICE_CONFIG[normalized] };
}

export function normalizePaymentSurface(surface = 'web') {
  const normalized = String(surface || 'web').trim();
  return Object.hasOwn(WALLET_PAYMENT_SURFACES, normalized) ? normalized : 'web';
}

export function getWalletPurchaseProviders(surface = 'web') {
  return [...WALLET_PAYMENT_SURFACES[normalizePaymentSurface(surface)]];
}

function assertProviderAllowedOnSurface(provider, surface = 'web') {
  const normalizedSurface = normalizePaymentSurface(surface);
  if (!getWalletPurchaseProviders(normalizedSurface).includes(provider)) {
    throw httpError('Wallet purchase provider is not available on this payment surface', 403);
  }
  return normalizedSurface;
}

function bundleForProvider(bundle, provider) {
  const config = providerConfig(provider);
  return {
    id: bundle.id,
    walletAmount: bundle.walletAmount,
    currencyCode: WALLET_CURRENCY_CODE,
    priceAmount: bundle.priceUnits * config.unitScale,
    priceCurrency: config.priceCurrency,
    provider: config.provider
  };
}

export function getWalletBundles(provider = null, { surface = 'web' } = {}) {
  const normalizedSurface = normalizePaymentSurface(surface);
  if (provider) {
    const normalizedProvider = providerConfig(provider).provider;
    assertProviderAllowedOnSurface(normalizedProvider, normalizedSurface);
    return BASE_WALLET_BUNDLES.map((bundle) => bundleForProvider(bundle, provider));
  }
  return getWalletPurchaseProviders(normalizedSurface).flatMap((purchaseProvider) =>
    BASE_WALLET_BUNDLES.map((bundle) => bundleForProvider(bundle, purchaseProvider))
  );
}

function findWalletBundle(bundleId, provider) {
  const bundle = BASE_WALLET_BUNDLES.find((candidate) => candidate.id === bundleId);
  if (!bundle) throw httpError('Unknown wallet bundle', 400);
  return bundleForProvider(bundle, provider);
}

function metadataJson(metadata) {
  return JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {});
}

function checkoutClaimTtlMs() {
  const value = Number(process.env.WALLET_CHECKOUT_CLAIM_TTL_MS || CHECKOUT_CLAIM_TTL_MS);
  return Number.isFinite(value) && value > 0 ? value : CHECKOUT_CLAIM_TTL_MS;
}

function checkoutWaitTimeoutMs() {
  const value = Number(process.env.WALLET_CHECKOUT_WAIT_TIMEOUT_MS || CHECKOUT_WAIT_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 0 ? value : CHECKOUT_WAIT_TIMEOUT_MS;
}

function checkoutWaitIntervalMs() {
  const value = Number(process.env.WALLET_CHECKOUT_WAIT_INTERVAL_MS || CHECKOUT_WAIT_INTERVAL_MS);
  return Number.isFinite(value) && value > 0 ? value : CHECKOUT_WAIT_INTERVAL_MS;
}

function purchaseIntentExpiryMs() {
  const value = Number(process.env.WALLET_PURCHASE_INTENT_EXPIRY_MS || PURCHASE_INTENT_EXPIRY_MS);
  return Number.isFinite(value) && value > 0 ? value : PURCHASE_INTENT_EXPIRY_MS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function centsToDecimalUnits(amount) {
  return Number((Number(amount || 0) / 100).toFixed(2));
}

function decimalStringToMinorUnits(value, unitScale = 100) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const sign = raw.startsWith('-') ? -1 : 1;
  const unsigned = raw.replace(/^[+-]/, '');
  const [wholeText, fractionText = ''] = unsigned.split('.');
  if (!/^\d+$/.test(wholeText || '0') || !/^\d*$/.test(fractionText)) return null;
  const decimals = Math.max(0, String(unitScale).length - 1);
  const whole = Number(wholeText || '0') * unitScale;
  const paddedFraction = `${fractionText}${'0'.repeat(decimals)}`.slice(0, decimals);
  const fraction = Number(paddedFraction || '0');
  const nextDigit = Number((fractionText[decimals] || '0'));
  const rounded = nextDigit >= 5 ? 1 : 0;
  return sign * (whole + fraction + rounded);
}

function normalizePriceCurrency(currency) {
  const normalized = String(currency || '').trim().toUpperCase();
  return normalized || null;
}

function normalizeProviderPriceAmount(provider, amount) {
  const { unitScale } = providerConfig(provider);
  if (unitScale === 1) {
    const value = Number(amount);
    return Number.isInteger(value) ? value : null;
  }
  return decimalStringToMinorUnits(amount, unitScale);
}

function rowToTransaction(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    currencyCode: row.currency_code,
    delta: Number(row.delta || 0),
    balanceAfter: Number(row.balance_after || 0),
    reason: row.reason,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
    idempotencyKey: row.idempotency_key || null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

function checkoutDataForIntent(intent) {
  return shapeWalletPurchaseCheckout(intent);
}

function rowToPurchaseIntent(row) {
  const intent = {
    id: row.id,
    playerId: row.player_id,
    provider: row.provider,
    providerInvoiceId: row.provider_invoice_id || null,
    providerPaymentId: row.provider_payment_id || null,
    currencyCode: row.currency_code,
    walletAmount: Number(row.wallet_amount || 0),
    priceAmount: Number(row.price_amount || 0),
    priceCurrency: row.price_currency,
    status: row.status,
    checkoutStatus: row.checkout_status || null,
    checkoutClaimedAt: row.checkout_claimed_at || null,
    idempotencyKey: row.idempotency_key || null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null
  };
  return {
    ...intent,
    checkout: checkoutDataForIntent(intent)
  };
}

function checkoutIsResolved(intent) {
  return walletPurchaseCheckoutIsResolved(intent);
}

async function getPurchaseIntentById(intentId) {
  const result = await query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [intentId]);
  if (!result.rowCount) throw httpError('Unknown wallet purchase intent', 404);
  return rowToPurchaseIntent(result.rows[0]);
}

async function waitForCheckoutResolution(intentId) {
  const timeoutMs = checkoutWaitTimeoutMs();
  const deadline = Date.now() + timeoutMs;
  let latest = await getPurchaseIntentById(intentId);
  while (latest.status === 'pending' && latest.checkoutStatus === 'creating' && !checkoutIsResolved(latest)) {
    if (Date.now() >= deadline) return latest;
    await sleep(Math.min(checkoutWaitIntervalMs(), Math.max(0, deadline - Date.now())));
    latest = await getPurchaseIntentById(intentId);
  }
  return latest;
}

async function claimCheckoutCreation(intentId) {
  const claimToken = createId('checkout_claim');
  const now = nowIso();
  const staleBefore = new Date(Date.now() - checkoutClaimTtlMs()).toISOString();
  const claimed = await query(
    `UPDATE wallet_purchase_intents
     SET checkout_status = 'creating',
         checkout_claim_token = $2,
         checkout_claimed_at = $3,
         updated_at = $3
     WHERE id = $1
       AND status = 'pending'
       AND (
         checkout_status IS NULL
         OR checkout_status = ''
         OR checkout_status = 'failed'
         OR (
           checkout_status = 'creating'
           AND (checkout_claimed_at IS NULL OR checkout_claimed_at < $4)
         )
       )
     RETURNING *`,
    [intentId, claimToken, now, staleBefore]
  );
  if (!claimed.rowCount) return null;
  return {
    claimToken,
    intent: rowToPurchaseIntent(claimed.rows[0])
  };
}

async function markCheckoutClaimFailed(intent, claimToken, error) {
  const failedAt = nowIso();
  const nextMetadata = {
    ...intent.metadata,
    checkoutError: {
      message: error?.message || 'Payment provider checkout creation failed',
      failedAt
    }
  };
  await query(
    `UPDATE wallet_purchase_intents
     SET checkout_status = 'failed',
         checkout_claim_token = NULL,
         checkout_claimed_at = NULL,
         metadata_json = $3,
         updated_at = $2
     WHERE id = $1 AND checkout_claim_token = $4`,
    [intent.id, failedAt, metadataJson(nextMetadata), claimToken]
  );
}

async function storeProviderCheckout(intent, claimToken, checkout) {
  const patch = createWalletPurchaseCheckoutMetadataPatch(intent, checkout);
  const updatedAt = nowIso();
  const updated = await query(
    `UPDATE wallet_purchase_intents
     SET provider_invoice_id = $2,
         metadata_json = $3,
         checkout_status = 'ready',
         checkout_claim_token = NULL,
         checkout_claimed_at = NULL,
         updated_at = $4
     WHERE id = $1 AND checkout_claim_token = $5
     RETURNING *`,
    [intent.id, patch.providerInvoiceId, metadataJson(patch.metadata), updatedAt, claimToken]
  );
  if (updated.rowCount) return rowToPurchaseIntent(updated.rows[0]);
  return getPurchaseIntentById(intent.id);
}

async function ensureProviderCheckout(intent, { fetchImpl = globalThis.fetch } = {}) {
  let latestIntent = await getPurchaseIntentById(intent.id);
  if (checkoutIsResolved(latestIntent) || latestIntent.status !== 'pending') return latestIntent;

  const claim = await claimCheckoutCreation(latestIntent.id);
  if (!claim) return waitForCheckoutResolution(latestIntent.id);

  latestIntent = claim.intent;
  try {
    const checkout = await createProviderCheckout(latestIntent, { fetchImpl });
    return await storeProviderCheckout(latestIntent, claim.claimToken, checkout);
  } catch (err) {
    await markCheckoutClaimFailed(latestIntent, claim.claimToken, err);
    throw err;
  }
}

async function ensureWalletBalanceRow(client, playerId, currencyCode = WALLET_CURRENCY_CODE) {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode);
  const existing = await client.query(
    `SELECT balance FROM player_wallet_balances WHERE player_id = $1 AND currency_code = $2`,
    [playerId, normalizedCurrency]
  );
  if (existing.rowCount) return Number(existing.rows[0].balance || 0);

  let initialBalance = 0;
  if (normalizedCurrency === WALLET_CURRENCY_CODE) {
    const player = await client.query(`SELECT COALESCE(spore, 0) AS spore FROM players WHERE id = $1`, [playerId]);
    initialBalance = player.rowCount ? Number(player.rows[0].spore || 0) : 0;
  }
  const now = nowIso();
  await client.query(
    `INSERT INTO player_wallet_balances (player_id, currency_code, balance, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (player_id, currency_code) DO NOTHING`,
    [playerId, normalizedCurrency, initialBalance, now]
  );
  const inserted = await client.query(
    `SELECT balance FROM player_wallet_balances WHERE player_id = $1 AND currency_code = $2`,
    [playerId, normalizedCurrency]
  );
  return inserted.rowCount ? Number(inserted.rows[0].balance || 0) : initialBalance;
}

async function applyCurrencyDelta(client, {
  playerId,
  currencyCode = WALLET_CURRENCY_CODE,
  delta,
  reason,
  sourceType = null,
  sourceId = null,
  idempotencyKey = null,
  metadata = {}
}) {
  const validation = validateWalletDelta({ currencyCode, delta, reason }, {
    defaultCurrencyCode: WALLET_CURRENCY_CODE
  });
  if (!validation.ok) throw httpError(validation.errors[0].message, 400);
  const normalizedCurrency = validation.currencyCode;
  const amount = validation.delta;

  if (idempotencyKey) {
    const existing = await client.query(
      `SELECT * FROM player_wallet_transactions
       WHERE player_id = $1 AND currency_code = $2 AND idempotency_key = $3
       LIMIT 1`,
      [playerId, normalizedCurrency, idempotencyKey]
    );
    if (existing.rowCount) {
      return rowToTransaction(existing.rows[0]);
    }
  }

  await ensureWalletBalanceRow(client, playerId, normalizedCurrency);

  const updatedAt = nowIso();
  const balanceResult = await client.query(
    `UPDATE player_wallet_balances
     SET balance = balance + $3, updated_at = $4
     WHERE player_id = $1
       AND currency_code = $2
       AND balance + $3 >= 0
     RETURNING balance`,
    [playerId, normalizedCurrency, amount, updatedAt]
  );
  if (!balanceResult.rowCount) {
    throw httpError('Not enough wallet balance', 400);
  }
  const balanceAfter = Number(balanceResult.rows[0]?.balance || 0);
  const {
    validation: _validation,
    ...transaction
  } = createWalletTransactionDraft({
    id: createId('wtx'),
    playerId,
    currencyCode: normalizedCurrency,
    delta: amount,
    balanceAfter,
    reason,
    sourceType,
    sourceId,
    idempotencyKey,
    metadata,
    createdAt: nowIso()
  });

  await client.query(
    `INSERT INTO player_wallet_transactions
     (id, player_id, currency_code, delta, balance_after, reason, source_type, source_id, idempotency_key, metadata_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      transaction.id,
      transaction.playerId,
      transaction.currencyCode,
      transaction.delta,
      transaction.balanceAfter,
      transaction.reason,
      transaction.sourceType,
      transaction.sourceId,
      transaction.idempotencyKey,
      metadataJson(transaction.metadata),
      transaction.createdAt
    ]
  );

  if (normalizedCurrency === WALLET_CURRENCY_CODE) {
    await client.query(
      `UPDATE players SET spore = $2, updated_at = $3 WHERE id = $1`,
      [playerId, balanceAfter, updatedAt]
    );
  }

  return transaction;
}

async function postJson(url, payload, { fetchImpl = globalThis.fetch, headers = {} } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw httpError('Payment provider fetch is unavailable', 503);
  }
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  if (!response.ok || json?.ok === false) {
    throw httpError(`Payment provider invoice creation failed: ${json?.description || json?.message || response.status}`, 502);
  }
  return json;
}

async function getJson(url, { fetchImpl = globalThis.fetch, headers = {} } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw httpError('Payment provider fetch is unavailable', 503);
  }
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers
    }
  });
  const json = await response.json();
  if (!response.ok || json?.ok === false) {
    throw httpError(`Payment provider lookup failed: ${json?.description || json?.message || response.status}`, 502);
  }
  return json;
}

function checkoutSetupRequired(provider, missing) {
  return {
    provider,
    setupRequired: missing,
    invoiceReady: false
  };
}

function testModeWithoutInjectedFetch(fetchImpl) {
  return process.env.NODE_ENV === 'test' && fetchImpl === globalThis.fetch;
}

async function createTelegramStarsCheckout(intent, { fetchImpl = globalThis.fetch } = {}) {
  if (testModeWithoutInjectedFetch(fetchImpl)) return checkoutSetupRequired('telegram_stars', ['test_fetchImpl']);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return checkoutSetupRequired('telegram_stars', ['TELEGRAM_BOT_TOKEN']);
  const invoice = checkoutDataForIntent(intent);
  const result = await postJson(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
    title: invoice.title,
    description: invoice.description,
    payload: intent.id,
    provider_token: '',
    currency: intent.priceCurrency,
    prices: invoice.prices
  }, { fetchImpl });
  return {
    type: 'telegram_invoice',
    provider: 'telegram_stars',
    invoiceLink: result.result,
    invoiceReady: true
  };
}

async function createBtcpayCheckout(intent, { fetchImpl = globalThis.fetch } = {}) {
  if (testModeWithoutInjectedFetch(fetchImpl)) return checkoutSetupRequired('btcpay', ['test_fetchImpl']);
  const serverUrl = String(process.env.BTCPAY_SERVER_URL || '').replace(/\/+$/, '');
  const storeId = process.env.BTCPAY_STORE_ID;
  const apiKey = process.env.BTCPAY_API_KEY;
  const missing = [
    !serverUrl && 'BTCPAY_SERVER_URL',
    !storeId && 'BTCPAY_STORE_ID',
    !apiKey && 'BTCPAY_API_KEY'
  ].filter(Boolean);
  if (missing.length) return checkoutSetupRequired('btcpay', missing);

  const json = await postJson(`${serverUrl}/api/v1/stores/${storeId}/invoices`, {
    amount: centsToDecimalUnits(intent.priceAmount),
    currency: intent.priceCurrency,
    metadata: {
      orderId: intent.id,
      walletPurchaseIntentId: intent.id,
      playerId: intent.playerId,
      bundleId: intent.metadata?.bundleId || null
    },
    checkout: {
      redirectURL: process.env.PUBLIC_GAME_URL || process.env.TELEGRAM_GAME_URL || undefined
    }
  }, {
    fetchImpl,
    headers: { Authorization: `token ${apiKey}` }
  });

  return {
    type: 'crypto_invoice',
    provider: 'btcpay',
    providerInvoiceId: json.id || json.invoiceId || intent.providerInvoiceId,
    checkoutUrl: json.checkoutLink || json.checkoutUrl || null,
    paymentUri: json.paymentUri || null,
    invoiceReady: true
  };
}

async function createNowPaymentsCheckout(intent, { fetchImpl = globalThis.fetch } = {}) {
  if (testModeWithoutInjectedFetch(fetchImpl)) return checkoutSetupRequired('nowpayments', ['test_fetchImpl']);
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const missing = [!apiKey && 'NOWPAYMENTS_API_KEY'].filter(Boolean);
  if (missing.length) return checkoutSetupRequired('nowpayments', missing);
  const baseUrl = process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io';
  const publicUrl = process.env.PUBLIC_GAME_URL || process.env.TELEGRAM_GAME_URL || '';
  const ipnCallbackUrl = publicUrl ? new URL('/api/wallet/purchase-webhook/nowpayments', publicUrl).toString() : undefined;

  const json = await postJson(`${baseUrl.replace(/\/+$/, '')}/v1/payment`, {
    price_amount: centsToDecimalUnits(intent.priceAmount),
    price_currency: String(intent.priceCurrency || 'USD').toLowerCase(),
    pay_currency: process.env.NOWPAYMENTS_DEFAULT_PAY_CURRENCY || 'btc',
    order_id: intent.id,
    order_description: `${intent.walletAmount} wallet coins`,
    ipn_callback_url: ipnCallbackUrl
  }, {
    fetchImpl,
    headers: { 'x-api-key': apiKey }
  });

  return {
    type: 'crypto_invoice',
    provider: 'nowpayments',
    providerInvoiceId: json.payment_id || json.invoice_id || json.id || intent.providerInvoiceId,
    checkoutUrl: json.invoice_url || json.payment_url || null,
    paymentUri: json.pay_address ? `${json.pay_currency || 'crypto'}:${json.pay_address}` : null,
    payAddress: json.pay_address || null,
    payAmount: json.pay_amount || null,
    payCurrency: json.pay_currency || null,
    invoiceReady: true
  };
}

async function createProviderCheckout(intent, options = {}) {
  if (intent.provider === 'telegram_stars') return createTelegramStarsCheckout(intent, options);
  if (intent.provider === 'btcpay') return createBtcpayCheckout(intent, options);
  if (intent.provider === 'nowpayments') return createNowPaymentsCheckout(intent, options);
  throw httpError('Unknown wallet purchase provider', 400);
}

function btcpayInvoiceLookupConfig() {
  const serverUrl = String(process.env.BTCPAY_SERVER_URL || '').replace(/\/+$/, '');
  const storeId = process.env.BTCPAY_STORE_ID;
  const apiKey = process.env.BTCPAY_API_KEY;
  if (!serverUrl || !storeId || !apiKey) return null;
  return { serverUrl, storeId, apiKey };
}

async function fetchProviderInvoicePaymentDetails(provider, providerInvoiceId, { fetchImpl = globalThis.fetch } = {}) {
  if (provider !== 'btcpay' || !providerInvoiceId || testModeWithoutInjectedFetch(fetchImpl)) return null;
  const config = btcpayInvoiceLookupConfig();
  if (!config) return null;
  const json = await getJson(
    `${config.serverUrl}/api/v1/stores/${config.storeId}/invoices/${encodeURIComponent(providerInvoiceId)}`,
    {
      fetchImpl,
      headers: { Authorization: `token ${config.apiKey}` }
    }
  );
  return extractProviderPaymentDetails(provider, json);
}

export async function grantCurrency(client, {
  playerId,
  currencyCode = WALLET_CURRENCY_CODE,
  amount,
  reason,
  sourceType = null,
  sourceId = null,
  idempotencyKey = null,
  metadata = {}
}) {
  const value = normalizeWalletGrantAmount(amount);
  if (!Number.isInteger(value)) {
    throw httpError('Wallet grant amount must be a positive integer', 400);
  }
  return applyCurrencyDelta(client, {
    playerId,
    currencyCode,
    delta: value,
    reason,
    sourceType,
    sourceId,
    idempotencyKey,
    metadata
  });
}

export async function spendCurrency(client, {
  playerId,
  currencyCode = WALLET_CURRENCY_CODE,
  amount,
  reason,
  sourceType = null,
  sourceId = null,
  idempotencyKey = null,
  metadata = {}
}) {
  const value = normalizeWalletSpendAmount(amount);
  if (!Number.isInteger(value)) {
    throw httpError('Wallet spend amount must be a positive integer', 400);
  }
  return applyCurrencyDelta(client, {
    playerId,
    currencyCode,
    delta: -value,
    reason,
    sourceType,
    sourceId,
    idempotencyKey,
    metadata
  });
}

export async function grantCurrencyForPlayer(params) {
  return withWalletMutationLock(params.playerId, () =>
    withTransaction((client) => grantCurrency(client, params))
  );
}

export async function spendCurrencyForPlayer(params) {
  return withWalletMutationLock(params.playerId, () =>
    withTransaction((client) => spendCurrency(client, params))
  );
}

export async function getWalletState(playerId, { limit = 10 } = {}) {
  return withTransaction(async (client) => {
    const balance = await ensureWalletBalanceRow(client, playerId, WALLET_CURRENCY_CODE);
    const tx = await client.query(
      `SELECT * FROM player_wallet_transactions
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [playerId, limit]
    );
    return {
      currencyCode: WALLET_CURRENCY_CODE,
      balance,
      balances: {
        [WALLET_CURRENCY_CODE]: balance
      },
      recentTransactions: tx.rows.map(rowToTransaction)
    };
  });
}

export async function auditWalletMirror({ limit = 100 } = {}) {
  const rowLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
  const rows = await query(
    `SELECT
       players.id AS player_id,
       COALESCE(players.spore, 0) AS legacy_balance,
       player_wallet_balances.balance AS wallet_balance,
       CASE
         WHEN player_wallet_balances.player_id IS NULL THEN 'missing_wallet_balance'
         ELSE 'mirror_mismatch'
       END AS issue
     FROM players
     LEFT JOIN player_wallet_balances
       ON player_wallet_balances.player_id = players.id
      AND player_wallet_balances.currency_code = $1
     WHERE player_wallet_balances.player_id IS NULL
        OR COALESCE(player_wallet_balances.balance, 0) != COALESCE(players.spore, 0)
     ORDER BY players.created_at ASC
     LIMIT $2`,
    [WALLET_CURRENCY_CODE, rowLimit]
  );
  const count = await query(
    `SELECT COUNT(*) AS count
     FROM players
     LEFT JOIN player_wallet_balances
       ON player_wallet_balances.player_id = players.id
      AND player_wallet_balances.currency_code = $1
     WHERE player_wallet_balances.player_id IS NULL
        OR COALESCE(player_wallet_balances.balance, 0) != COALESCE(players.spore, 0)`,
    [WALLET_CURRENCY_CODE]
  );
  return {
    currencyCode: WALLET_CURRENCY_CODE,
    total: Number(count.rows[0]?.count || 0),
    limit: rowLimit,
    items: rows.rows.map((row) => ({
      playerId: row.player_id,
      legacyBalance: Number(row.legacy_balance || 0),
      walletBalance: row.wallet_balance == null ? null : Number(row.wallet_balance),
      issue: row.issue
    }))
  };
}

function rowToReconciledIntent(row) {
  return {
    intentId: row.intent_id,
    playerId: row.player_id,
    provider: row.provider,
    providerInvoiceId: row.provider_invoice_id || null,
    providerPaymentId: row.provider_payment_id || null,
    currencyCode: row.currency_code,
    walletAmount: Number(row.wallet_amount || 0),
    status: row.status,
    completedAt: row.completed_at || null,
    transactionId: row.transaction_id || null,
    transactionDelta: row.transaction_delta == null ? null : Number(row.transaction_delta),
    transactionCurrencyCode: row.transaction_currency_code || null
  };
}

function rowToReconciledTransaction(row) {
  return {
    transactionId: row.transaction_id,
    playerId: row.player_id,
    currencyCode: row.currency_code,
    delta: Number(row.delta || 0),
    reason: row.reason,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
    intentStatus: row.intent_status || null,
    intentWalletAmount: row.intent_wallet_amount == null ? null : Number(row.intent_wallet_amount),
    createdAt: row.created_at
  };
}

function rowToRefundedPurchaseWithoutReversal(row) {
  return {
    intentId: row.intent_id,
    playerId: row.player_id,
    provider: row.provider,
    providerInvoiceId: row.provider_invoice_id || null,
    providerPaymentId: row.provider_payment_id || null,
    currencyCode: row.currency_code,
    walletAmount: Number(row.wallet_amount || 0),
    status: row.status,
    updatedAt: row.updated_at,
    grantTransactionId: row.grant_transaction_id || null,
    reversalTransactionId: row.reversal_transaction_id || null,
    clawbackStatus: parseJson(row.metadata_json, {})?.clawback?.status || null
  };
}

function rowToWebhookReconciliationIssue(row, issue) {
  const metadata = parseJson(row.metadata_json, {});
  const result = parseJson(row.result_json, {});
  return {
    webhookEventId: row.id,
    provider: row.provider,
    eventKey: row.event_key,
    issue,
    intentId: metadata.intentId || result?.intent?.id || null,
    providerInvoiceId: metadata.providerInvoiceId || result?.intent?.providerInvoiceId || null,
    processingStatus: row.processing_status,
    receivedAt: row.received_at,
    processedAt: row.processed_at || null
  };
}

async function processedWebhookIntentIssues(limit) {
  const events = await query(
    `SELECT *
     FROM payment_webhook_events
     WHERE processing_status = 'processed'
     ORDER BY received_at DESC
     LIMIT $1`,
    [limit]
  );
  const candidates = [];
  const intentIds = new Set();
  for (const row of events.rows) {
    const result = parseJson(row.result_json, {});
    if (result?.ignored) continue;
    const metadata = parseJson(row.metadata_json, {});
    const intentId = metadata.intentId || result?.intent?.id || null;
    if (!intentId) {
      candidates.push({ row, intentId: null });
      continue;
    }
    candidates.push({ row, intentId });
    intentIds.add(intentId);
  }

  const knownIntentIds = new Set();
  if (intentIds.size) {
    const ids = [...intentIds];
    const placeholders = ids.map((_id, index) => `$${index + 1}`).join(', ');
    const intents = await query(
      `SELECT wallet_purchase_intents.id,
              wallet_purchase_intents.status,
              reversal_transactions.id AS reversal_transaction_id
       FROM wallet_purchase_intents
       LEFT JOIN player_wallet_transactions AS reversal_transactions
         ON reversal_transactions.source_type = 'wallet_purchase_intent'
        AND reversal_transactions.source_id = wallet_purchase_intents.id
        AND reversal_transactions.reason = 'wallet_purchase_reversal'
       WHERE wallet_purchase_intents.id IN (${placeholders})`,
      ids
    );
    for (const row of intents.rows) {
      if (row.status === 'completed') knownIntentIds.add(row.id);
      if (
        ['refunded', 'reversed', 'chargeback'].includes(row.status) &&
        row.reversal_transaction_id
      ) {
        knownIntentIds.add(row.id);
      }
    }
  }

  return candidates
    .filter(({ intentId }) => !intentId || !knownIntentIds.has(intentId))
    .map(({ row, intentId }) => rowToWebhookReconciliationIssue(
      row,
      intentId ? 'webhook_intent_not_completed' : 'webhook_missing_intent'
    ));
}

export async function reconcileWalletPayments({ limit = 100 } = {}) {
  const rowLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
  const completedMissingGrant = await query(
    `SELECT
       wallet_purchase_intents.id AS intent_id,
       wallet_purchase_intents.player_id,
       wallet_purchase_intents.provider,
       wallet_purchase_intents.provider_invoice_id,
       wallet_purchase_intents.provider_payment_id,
       wallet_purchase_intents.currency_code,
       wallet_purchase_intents.wallet_amount,
       wallet_purchase_intents.status,
       wallet_purchase_intents.completed_at,
       player_wallet_transactions.id AS transaction_id,
       player_wallet_transactions.delta AS transaction_delta,
       player_wallet_transactions.currency_code AS transaction_currency_code
     FROM wallet_purchase_intents
     LEFT JOIN player_wallet_transactions
       ON player_wallet_transactions.source_type = 'wallet_purchase_intent'
      AND player_wallet_transactions.source_id = wallet_purchase_intents.id
      AND player_wallet_transactions.reason = 'wallet_purchase'
     WHERE wallet_purchase_intents.status = 'completed'
       AND player_wallet_transactions.id IS NULL
     ORDER BY wallet_purchase_intents.completed_at DESC
     LIMIT $1`,
    [rowLimit]
  );
  const grantsWithoutCompletedIntent = await query(
    `SELECT
       player_wallet_transactions.id AS transaction_id,
       player_wallet_transactions.player_id,
       player_wallet_transactions.currency_code,
       player_wallet_transactions.delta,
       player_wallet_transactions.reason,
       player_wallet_transactions.source_type,
       player_wallet_transactions.source_id,
       player_wallet_transactions.created_at,
       wallet_purchase_intents.status AS intent_status,
       wallet_purchase_intents.wallet_amount AS intent_wallet_amount
     FROM player_wallet_transactions
     LEFT JOIN wallet_purchase_intents
       ON wallet_purchase_intents.id = player_wallet_transactions.source_id
     LEFT JOIN player_wallet_transactions AS reversal_transactions
       ON reversal_transactions.source_type = 'wallet_purchase_intent'
      AND reversal_transactions.source_id = player_wallet_transactions.source_id
      AND reversal_transactions.reason = 'wallet_purchase_reversal'
     WHERE player_wallet_transactions.reason = 'wallet_purchase'
       AND player_wallet_transactions.source_type = 'wallet_purchase_intent'
       AND (
         wallet_purchase_intents.id IS NULL
         OR (
           wallet_purchase_intents.status != 'completed'
           AND NOT (
             wallet_purchase_intents.status IN ('refunded', 'reversed', 'chargeback')
             AND reversal_transactions.id IS NOT NULL
           )
         )
       )
     ORDER BY player_wallet_transactions.created_at DESC
     LIMIT $1`,
    [rowLimit]
  );
  const grantAmountMismatches = await query(
    `SELECT
       wallet_purchase_intents.id AS intent_id,
       wallet_purchase_intents.player_id,
       wallet_purchase_intents.provider,
       wallet_purchase_intents.provider_invoice_id,
       wallet_purchase_intents.provider_payment_id,
       wallet_purchase_intents.currency_code,
       wallet_purchase_intents.wallet_amount,
       wallet_purchase_intents.status,
       wallet_purchase_intents.completed_at,
       player_wallet_transactions.id AS transaction_id,
       player_wallet_transactions.delta AS transaction_delta,
       player_wallet_transactions.currency_code AS transaction_currency_code
     FROM wallet_purchase_intents
     JOIN player_wallet_transactions
       ON player_wallet_transactions.source_type = 'wallet_purchase_intent'
      AND player_wallet_transactions.source_id = wallet_purchase_intents.id
      AND player_wallet_transactions.reason = 'wallet_purchase'
     WHERE wallet_purchase_intents.status = 'completed'
       AND (
         player_wallet_transactions.delta != wallet_purchase_intents.wallet_amount
         OR player_wallet_transactions.currency_code != wallet_purchase_intents.currency_code
       )
     ORDER BY wallet_purchase_intents.completed_at DESC
     LIMIT $1`,
    [rowLimit]
  );
  const refundedMissingReversal = await query(
    `SELECT
       wallet_purchase_intents.id AS intent_id,
       wallet_purchase_intents.player_id,
       wallet_purchase_intents.provider,
       wallet_purchase_intents.provider_invoice_id,
       wallet_purchase_intents.provider_payment_id,
       wallet_purchase_intents.currency_code,
       wallet_purchase_intents.wallet_amount,
       wallet_purchase_intents.status,
       wallet_purchase_intents.updated_at,
       wallet_purchase_intents.metadata_json,
       grant_transactions.id AS grant_transaction_id,
       reversal_transactions.id AS reversal_transaction_id
     FROM wallet_purchase_intents
     LEFT JOIN player_wallet_transactions AS grant_transactions
       ON grant_transactions.source_type = 'wallet_purchase_intent'
      AND grant_transactions.source_id = wallet_purchase_intents.id
      AND grant_transactions.reason = 'wallet_purchase'
     LEFT JOIN player_wallet_transactions AS reversal_transactions
       ON reversal_transactions.source_type = 'wallet_purchase_intent'
      AND reversal_transactions.source_id = wallet_purchase_intents.id
      AND reversal_transactions.reason = 'wallet_purchase_reversal'
     WHERE wallet_purchase_intents.status IN ('refunded', 'reversed', 'chargeback')
       AND grant_transactions.id IS NOT NULL
       AND reversal_transactions.id IS NULL
     ORDER BY wallet_purchase_intents.updated_at DESC
     LIMIT $1`,
    [rowLimit]
  );
  const webhookIntentIssues = await processedWebhookIntentIssues(rowLimit);
  const categories = {
    completedIntentsMissingWalletGrant: completedMissingGrant.rows.map(rowToReconciledIntent),
    walletGrantsWithoutCompletedIntent: grantsWithoutCompletedIntent.rows.map(rowToReconciledTransaction),
    walletGrantAmountMismatches: grantAmountMismatches.rows.map(rowToReconciledIntent),
    refundedPurchasesMissingReversal: refundedMissingReversal.rows.map(rowToRefundedPurchaseWithoutReversal),
    processedWebhookIntentIssues: webhookIntentIssues
  };
  const total = Object.values(categories).reduce((sum, items) => sum + items.length, 0);
  return {
    ok: total === 0,
    total,
    limit: rowLimit,
    generatedAt: nowIso(),
    categories
  };
}

export async function expireStalePurchaseIntents({
  olderThanMs = null,
  limit = 100,
  dryRun = false,
  now = new Date()
} = {}) {
  const rowLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
  const expiryMs = olderThanMs == null ? purchaseIntentExpiryMs() : Number(olderThanMs);
  if (!Number.isFinite(expiryMs) || expiryMs <= 0) {
    throw httpError('Wallet purchase intent expiry must be a positive number of milliseconds', 400);
  }
  const runDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(runDate.getTime())) throw httpError('Invalid expiry run timestamp', 400);
  const cutoff = new Date(runDate.getTime() - expiryMs).toISOString();
  const activeClaimCutoff = new Date(runDate.getTime() - checkoutClaimTtlMs()).toISOString();
  const candidates = await query(
    `SELECT * FROM wallet_purchase_intents
     WHERE status = 'pending'
       AND created_at < $1
       AND (
         checkout_status IS NULL
         OR checkout_status != 'creating'
         OR checkout_claimed_at IS NULL
         OR checkout_claimed_at < $2
       )
     ORDER BY created_at ASC
     LIMIT $3`,
    [cutoff, activeClaimCutoff, rowLimit]
  );

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      expired: 0,
      candidateCount: candidates.rowCount,
      limit: rowLimit,
      olderThanMs: expiryMs,
      cutoffCreatedBefore: cutoff,
      activeClaimCutoff,
      generatedAt: runDate.toISOString(),
      candidates: candidates.rows.map(rowToPurchaseIntent)
    };
  }

  const expiredIntents = [];
  await withTransaction(async (client) => {
    for (const row of candidates.rows) {
      const expiredAt = nowIso();
      const currentMetadata = parseJson(row.metadata_json, {});
      const updated = await client.query(
        `UPDATE wallet_purchase_intents
         SET status = 'expired',
             checkout_claim_token = NULL,
             checkout_claimed_at = NULL,
             updated_at = $2,
             metadata_json = $3
         WHERE id = $1
           AND status = 'pending'
           AND created_at < $4
           AND (
             checkout_status IS NULL
             OR checkout_status != 'creating'
             OR checkout_claimed_at IS NULL
             OR checkout_claimed_at < $5
           )
         RETURNING *`,
        [
          row.id,
          expiredAt,
          metadataJson({
            ...currentMetadata,
            expiration: {
              source: 'local_expiry_job',
              expiredAt,
              olderThanMs: expiryMs,
              cutoffCreatedBefore: cutoff,
              previousCheckoutStatus: row.checkout_status || null
            }
          }),
          cutoff,
          activeClaimCutoff
        ]
      );
      if (updated.rowCount) {
        expiredIntents.push(rowToPurchaseIntent(updated.rows[0]));
      }
    }
  });

  return {
    ok: true,
    dryRun: false,
    expired: expiredIntents.length,
    candidateCount: candidates.rowCount,
    limit: rowLimit,
    olderThanMs: expiryMs,
    cutoffCreatedBefore: cutoff,
    activeClaimCutoff,
    generatedAt: runDate.toISOString(),
    expiredIntents
  };
}

export async function backfillMissingWalletBalancesFromPlayers({ limit = 500 } = {}) {
  const rowLimit = Math.max(1, Math.min(5000, Number(limit) || 500));
  return withTransaction(async (client) => {
    const rows = await client.query(
      `SELECT players.id, COALESCE(players.spore, 0) AS spore
       FROM players
       WHERE NOT EXISTS (
         SELECT 1 FROM player_wallet_balances
         WHERE player_wallet_balances.player_id = players.id
           AND player_wallet_balances.currency_code = $1
       )
       ORDER BY players.created_at ASC
       LIMIT $2`,
      [WALLET_CURRENCY_CODE, rowLimit]
    );
    const now = nowIso();
    for (const row of rows.rows) {
      await client.query(
        `INSERT INTO player_wallet_balances (player_id, currency_code, balance, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (player_id, currency_code) DO NOTHING`,
        [row.id, WALLET_CURRENCY_CODE, Number(row.spore || 0), now]
      );
    }
    return {
      currencyCode: WALLET_CURRENCY_CODE,
      inserted: rows.rowCount,
      playerIds: rows.rows.map((row) => row.id)
    };
  });
}

export async function createPurchaseIntent(playerId, {
  bundleId,
  provider = 'telegram_stars',
  idempotencyKey = null,
  surface = 'web',
  fetchImpl = globalThis.fetch
} = {}) {
  const normalizedSurface = normalizePaymentSurface(surface);
  const normalizedProvider = providerConfig(provider).provider;
  assertProviderAllowedOnSurface(normalizedProvider, normalizedSurface);
  const bundle = findWalletBundle(bundleId, normalizedProvider);
  const work = () => createPurchaseIntentUnlocked(playerId, {
    bundle,
    idempotencyKey,
    normalizedSurface,
    fetchImpl
  });
  if (!idempotencyKey) return work();
  return withKeyedLock(
    purchaseIntentLocks,
    `purchase-intent:${playerId}:${normalizedProvider}:${idempotencyKey}`,
    work
  );
}

async function createPurchaseIntentUnlocked(playerId, {
  bundle,
  idempotencyKey = null,
  normalizedSurface,
  fetchImpl = globalThis.fetch
} = {}) {
  const intent = await withTransaction(async (client) => {
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT * FROM wallet_purchase_intents
         WHERE player_id = $1 AND provider = $2 AND idempotency_key = $3
         LIMIT 1`,
        [playerId, bundle.provider, idempotencyKey]
      );
      if (existing.rowCount) return rowToPurchaseIntent(existing.rows[0]);
    }

    const now = nowIso();
    const id = createId('wpintent');
    const providerInvoiceId = createId(`invoice_${bundle.provider}`);
    const metadata = {
      bundleId: bundle.id,
      checkoutProvider: bundle.provider,
      paymentSurface: normalizedSurface
    };

    const draft = createWalletPurchaseIntentDraft({
      id,
      playerId,
      bundle,
      providerInvoiceId,
      idempotencyKey,
      metadata,
      createdAt: now
    });
    const inserted = await client.query(
      `INSERT INTO wallet_purchase_intents
       (id, player_id, provider, provider_invoice_id, currency_code, wallet_amount,
        price_amount, price_currency, status, idempotency_key, metadata_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       ON CONFLICT DO NOTHING`,
      [
        draft.id,
        draft.playerId,
        draft.provider,
        draft.providerInvoiceId,
        draft.currencyCode,
        draft.walletAmount,
        draft.priceAmount,
        draft.priceCurrency,
        draft.status,
        draft.idempotencyKey,
        metadataJson(draft.metadata),
        draft.createdAt
      ]
    );
    if (!inserted.rowCount) {
      const conflict = idempotencyKey
        ? await client.query(
          `SELECT * FROM wallet_purchase_intents
           WHERE player_id = $1 AND provider = $2 AND idempotency_key = $3
           LIMIT 1`,
          [playerId, bundle.provider, idempotencyKey]
        )
        : await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [id]);
      if (conflict.rowCount) return rowToPurchaseIntent(conflict.rows[0]);
      throw httpError('Could not create wallet purchase intent', 409);
    }

    const row = await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [id]);
    return rowToPurchaseIntent(row.rows[0]);
  });

  if (intent.checkout?.invoiceReady || intent.checkout?.setupRequired) return intent;

  return withKeyedLock(checkoutLocks, `checkout:${intent.id}`, async () => {
    return ensureProviderCheckout(intent, { fetchImpl });
  });
}

export async function completePurchaseIntent({
  provider,
  intentId = null,
  providerInvoiceId = null,
  providerPaymentId = null,
  priceAmount = null,
  priceCurrency = null,
  metadata = {}
} = {}) {
  const normalizedProvider = providerConfig(provider).provider;
  const initialLookup = intentId
    ? await query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [intentId])
    : await query(
      `SELECT * FROM wallet_purchase_intents WHERE provider = $1 AND provider_invoice_id = $2`,
      [normalizedProvider, providerInvoiceId]
    );
  if (!initialLookup.rowCount) throw httpError('Unknown wallet purchase intent', 404);
  if (initialLookup.rows[0].provider !== normalizedProvider) {
    throw httpError('Invalid wallet purchase provider', 400);
  }

  return withWalletMutationLock(initialLookup.rows[0].player_id, () => withTransaction(async (client) => {
    const lookup = intentId
      ? await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [intentId])
      : await client.query(
        `SELECT * FROM wallet_purchase_intents WHERE provider = $1 AND provider_invoice_id = $2`,
        [normalizedProvider, providerInvoiceId]
      );
    if (!lookup.rowCount) throw httpError('Unknown wallet purchase intent', 404);
    const row = lookup.rows[0];
    if (row.provider !== normalizedProvider) throw httpError('Invalid wallet purchase provider', 400);

    if (row.status === 'completed') {
      return {
        intent: rowToPurchaseIntent(row),
        transaction: null,
        alreadyCompleted: true
      };
    }
    if (row.status !== 'pending') throw httpError('Wallet purchase is not pending', 409);

    const paymentId = providerPaymentId || createId(`payment_${normalizedProvider}`);
    const completionPlan = createWalletPurchaseCompletionPlan(row, {
      provider: normalizedProvider,
      providerPaymentId: paymentId,
      priceAmount,
      priceCurrency,
      metadata
    });
    if (completionPlan.action === 'price_mismatch') {
      throw httpError('Invalid wallet purchase amount', 400);
    }
    if (!completionPlan.ok) throw httpError('Wallet purchase is not pending', 409);

    const completedAt = nowIso();
    const updatedIntent = await client.query(
      `UPDATE wallet_purchase_intents
       SET status = 'completed',
           provider_payment_id = $2,
           completed_at = $3,
           updated_at = $3,
           metadata_json = $4
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [
        row.id,
        completionPlan.providerPaymentId,
        completedAt,
        metadataJson(completionPlan.metadata)
      ]
    );
    if (!updatedIntent.rowCount) {
      const current = await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [row.id]);
      if (current.rows[0]?.status === 'completed') {
        return {
          intent: rowToPurchaseIntent(current.rows[0]),
          transaction: null,
          alreadyCompleted: true
        };
      }
      throw httpError('Wallet purchase is not pending', 409);
    }
    const completedRow = updatedIntent.rows[0];

    const transaction = await grantCurrency(client, completionPlan.grantMutation);

    return {
      intent: rowToPurchaseIntent(completedRow),
      transaction,
      alreadyCompleted: false
    };
  }));
}

export async function validateTelegramPreCheckout(preCheckoutQuery) {
  const intentId = preCheckoutQuery?.invoice_payload;
  const currency = preCheckoutQuery?.currency;
  const totalAmount = Number(preCheckoutQuery?.total_amount);
  if (!intentId) return { ok: false, errorMessage: 'Missing wallet purchase payload' };

  const result = await query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [intentId]);
  if (!result.rowCount) return { ok: false, errorMessage: 'Unknown wallet purchase' };
  const intent = result.rows[0];
  if (intent.provider !== 'telegram_stars') return { ok: false, errorMessage: 'Wrong payment provider' };
  if (intent.status !== 'pending') return { ok: false, errorMessage: 'Wallet purchase is not pending' };
  if (intent.price_currency !== currency || Number(intent.price_amount) !== totalAmount) {
    return { ok: false, errorMessage: 'Wallet purchase amount mismatch' };
  }
  return { ok: true, intent: rowToPurchaseIntent(intent) };
}

export async function completeTelegramSuccessfulPayment(successfulPayment) {
  return completePurchaseIntent({
    provider: 'telegram_stars',
    intentId: successfulPayment?.invoice_payload,
    providerPaymentId:
      successfulPayment?.telegram_payment_charge_id ||
      successfulPayment?.provider_payment_charge_id ||
      null,
    priceAmount: Number(successfulPayment?.total_amount),
    priceCurrency: successfulPayment?.currency,
    metadata: {
      telegramPaymentChargeId: successfulPayment?.telegram_payment_charge_id || null,
      providerPaymentChargeId: successfulPayment?.provider_payment_charge_id || null
    }
  });
}

function isCompletedProviderStatus(provider, payload) {
  if (provider === 'btcpay') {
    const type = String(payload?.type || '').toLowerCase();
    const status = String(payload?.status || payload?.invoiceStatus || '').toLowerCase();
    return type === 'invoicesettled' || ['settled', 'complete', 'completed', 'paid'].includes(status);
  }
  if (provider === 'nowpayments') {
    const status = String(payload?.payment_status || payload?.status || '').toLowerCase();
    return ['finished', 'confirmed', 'sending'].includes(status);
  }
  return false;
}

function firstPresent(...values) {
  return values.find((value) => value != null && value !== '') ?? null;
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortJsonValue(value[key]);
    return acc;
  }, {});
}

function stableJsonStringify(value) {
  return JSON.stringify(sortJsonValue(value || {}));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function providerWebhookRefs(payload = {}) {
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const intentId =
    metadata.walletPurchaseIntentId ||
    metadata.intentId ||
    metadata.orderId ||
    payload.walletPurchaseIntentId ||
    payload.order_id ||
    payload.orderId ||
    null;
  const providerInvoiceId =
    payload.invoiceId ||
    payload.invoice_id ||
    payload.payment_id ||
    null;
  const providerPaymentId =
    payload.paymentId ||
    payload.payment_id ||
    payload.providerPaymentId ||
    payload.id ||
    providerInvoiceId;
  return { metadata, intentId, providerInvoiceId, providerPaymentId };
}

function providerWebhookExplicitEventId(payload = {}) {
  return firstPresent(
    payload.deliveryId,
    payload.delivery_id,
    payload.eventId,
    payload.event_id,
    payload.webhookEventId,
    payload.webhook_event_id,
    payload.webhook?.deliveryId,
    payload.webhook?.eventId,
    payload.metadata?.deliveryId,
    payload.metadata?.eventId
  );
}

function providerWebhookPayloadText(payload = {}, rawBody = '') {
  return rawBody || stableJsonStringify(payload);
}

function providerWebhookEventIdentity(payload = {}, rawBody = '') {
  const payloadText = providerWebhookPayloadText(payload, rawBody);
  const payloadHash = sha256Text(payloadText);
  const explicitEventId = providerWebhookExplicitEventId(payload);
  return {
    payloadHash,
    explicitEventId: explicitEventId || null,
    eventKey: explicitEventId ? `event:${explicitEventId}` : `payload:${payloadHash}`
  };
}

function rowToPaymentWebhookEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    eventKey: row.event_key,
    payloadHash: row.payload_hash,
    processingStatus: row.processing_status,
    result: parseJson(row.result_json, null),
    errorMessage: row.error_message || null,
    receivedAt: row.received_at,
    processedAt: row.processed_at || null,
    metadata: parseJson(row.metadata_json, {})
  };
}

function extractProviderPaymentDetails(provider, payload = {}) {
  let amount = null;
  let currency = null;
  if (provider === 'btcpay') {
    amount = firstPresent(
      payload.amount,
      payload.price,
      payload.invoiceAmount,
      payload.payment?.amount,
      payload.invoice?.amount,
      payload.data?.amount,
      payload.data?.price
    );
    currency = firstPresent(
      payload.currency,
      payload.priceCurrency,
      payload.invoiceCurrency,
      payload.payment?.currency,
      payload.invoice?.currency,
      payload.data?.currency,
      payload.data?.priceCurrency
    );
  } else if (provider === 'nowpayments') {
    amount = firstPresent(
      payload.price_amount,
      payload.priceAmount,
      payload.invoice?.price_amount,
      payload.data?.price_amount
    );
    currency = firstPresent(
      payload.price_currency,
      payload.priceCurrency,
      payload.invoice?.price_currency,
      payload.data?.price_currency
    );
  }

  const priceAmount = normalizeProviderPriceAmount(provider, amount);
  const priceCurrency = normalizePriceCurrency(currency);
  return priceAmount == null || !priceCurrency ? null : { priceAmount, priceCurrency };
}

function purchaseStatusFromProviderWebhook(provider, payload = {}) {
  if (provider === 'btcpay') {
    const type = String(payload?.type || '').toLowerCase();
    const status = String(payload?.status || payload?.invoiceStatus || '').toLowerCase();
    if (type === 'invoiceexpired' || status === 'expired') return 'expired';
    if (type === 'invoiceinvalid' || ['invalid', 'failed'].includes(status)) return 'failed';
    if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
    if (type.includes('refund') || status === 'refunded') return 'refunded';
    if (status === 'reversed') return 'reversed';
    if (status === 'chargeback') return 'chargeback';
    if (status === 'disputed') return 'disputed';
    if (status === 'underpaid') return 'underpaid';
    if (status === 'overpaid') return 'overpaid';
  }
  if (provider === 'nowpayments') {
    const status = String(payload?.payment_status || payload?.status || '').toLowerCase();
    if (status === 'expired') return 'expired';
    if (status === 'failed') return 'failed';
    if (status === 'refunded') return 'refunded';
    if (status === 'reversed') return 'reversed';
    if (status === 'chargeback') return 'chargeback';
    if (status === 'disputed') return 'disputed';
    if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
    if (status === 'underpaid') return 'underpaid';
    if (status === 'overpaid') return 'overpaid';
  }
  return null;
}

async function beginPaymentWebhookEvent(provider, payload = {}, { rawBody = '' } = {}) {
  const normalizedProvider = providerConfig(provider).provider;
  const { payloadHash, explicitEventId, eventKey } = providerWebhookEventIdentity(payload, rawBody);
  const refs = providerWebhookRefs(payload);
  const now = nowIso();
  const metadata = {
    explicitEventId,
    intentId: refs.intentId,
    providerInvoiceId: refs.providerInvoiceId,
    providerPaymentId: refs.providerPaymentId,
    status: firstPresent(payload.payment_status, payload.status, payload.invoiceStatus, payload.type)
  };
  const id = createId('pwh');
  const inserted = await query(
    `INSERT INTO payment_webhook_events
     (id, provider, event_key, payload_hash, processing_status, metadata_json, received_at)
     VALUES ($1, $2, $3, $4, 'processing', $5, $6)
     ON CONFLICT DO NOTHING`,
    [id, normalizedProvider, eventKey, payloadHash, metadataJson(metadata), now]
  );
  if (inserted.rowCount) {
    const row = await query(`SELECT * FROM payment_webhook_events WHERE id = $1`, [id]);
    return { action: 'process', event: rowToPaymentWebhookEvent(row.rows[0]) };
  }

  const existing = await query(
    `SELECT * FROM payment_webhook_events
     WHERE provider = $1 AND event_key = $2
     LIMIT 1`,
    [normalizedProvider, eventKey]
  );
  const event = rowToPaymentWebhookEvent(existing.rows[0]);
  if (!event) throw httpError('Payment webhook event conflict could not be read', 409);
  if (event.payloadHash !== payloadHash) {
    throw httpError('Payment webhook replay payload mismatch', 409);
  }
  if (event.processingStatus === 'processed') {
    return { action: 'replay', event };
  }
  if (event.processingStatus === 'processing') {
    return { action: 'in_progress', event };
  }

  const retried = await query(
    `UPDATE payment_webhook_events
     SET processing_status = 'processing',
         error_message = NULL,
         metadata_json = $3,
         received_at = $4,
         processed_at = NULL
     WHERE provider = $1
       AND event_key = $2
       AND processing_status = 'failed'
     RETURNING *`,
    [normalizedProvider, eventKey, metadataJson(metadata), now]
  );
  if (retried.rowCount) {
    return { action: 'process', event: rowToPaymentWebhookEvent(retried.rows[0]) };
  }
  return { action: 'in_progress', event };
}

async function markPaymentWebhookEventProcessed(event, result) {
  const processedAt = nowIso();
  const intent = result?.intent && typeof result.intent === 'object' ? result.intent : {};
  const nextMetadata = {
    ...(event.metadata || {}),
    intentId: event.metadata?.intentId || intent.id || null,
    providerInvoiceId: event.metadata?.providerInvoiceId || intent.providerInvoiceId || null,
    providerPaymentId: event.metadata?.providerPaymentId || intent.providerPaymentId || null,
    intentStatus: intent.status || null
  };
  const updated = await query(
    `UPDATE payment_webhook_events
     SET processing_status = 'processed',
         result_json = $2,
         error_message = NULL,
         processed_at = $3,
         metadata_json = $4
     WHERE id = $1
     RETURNING *`,
    [event.id, metadataJson(result), processedAt, metadataJson(nextMetadata)]
  );
  return rowToPaymentWebhookEvent(updated.rows[0]);
}

async function markPaymentWebhookEventFailed(event, error) {
  const processedAt = nowIso();
  await query(
    `UPDATE payment_webhook_events
     SET processing_status = 'failed',
         error_message = $2,
         processed_at = $3
     WHERE id = $1`,
    [event.id, error?.message || 'Payment webhook processing failed', processedAt]
  );
}

async function recordPurchaseIntentStatus({
  provider,
  intentId = null,
  providerInvoiceId = null,
  status,
  metadata = {}
} = {}) {
  if (!canRecordWalletPurchaseStatus(status)) {
    throw httpError('Invalid wallet purchase status', 400);
  }
  const normalizedProvider = providerConfig(provider).provider;
  const initialLookup = intentId
    ? await query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [intentId])
    : await query(
      `SELECT * FROM wallet_purchase_intents WHERE provider = $1 AND provider_invoice_id = $2`,
      [normalizedProvider, providerInvoiceId]
    );
  if (!initialLookup.rowCount) {
    return { ignored: true, reason: 'unknown_intent', status };
  }
  if (initialLookup.rows[0].provider !== normalizedProvider) {
    throw httpError('Invalid wallet purchase provider', 400);
  }

  return withWalletMutationLock(initialLookup.rows[0].player_id, () => withTransaction(async (client) => {
    const lookup = intentId
      ? await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [intentId])
      : await client.query(
        `SELECT * FROM wallet_purchase_intents WHERE provider = $1 AND provider_invoice_id = $2`,
        [normalizedProvider, providerInvoiceId]
      );
    if (!lookup.rowCount) return { ignored: true, reason: 'unknown_intent', status };
    const row = lookup.rows[0];
    if (row.provider !== normalizedProvider) throw httpError('Invalid wallet purchase provider', 400);

    if (row.status === 'completed') {
      if (isWalletPurchaseClawbackStatus(status)) {
        return recordCompletedPurchaseClawback(client, row, {
          provider: normalizedProvider,
          status,
          metadata
        });
      }
      if (isWalletPurchaseReviewStatus(status)) {
        return recordCompletedPurchaseReviewStatus(client, row, {
          status,
          metadata
        });
      }
      return {
        intent: rowToPurchaseIntent(row),
        transaction: null,
        alreadyCompleted: true
      };
    }
    if (row.status === status || row.status !== 'pending') {
      return {
        intent: rowToPurchaseIntent(row),
        transaction: null,
        alreadyRecorded: true,
        ignored: true,
        reason: row.status
      };
    }

    const updatedAt = nowIso();
    const currentMetadata = parseJson(row.metadata_json, {});
    const updated = await client.query(
      `UPDATE wallet_purchase_intents
       SET status = $2,
           updated_at = $3,
           metadata_json = $4
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [
        row.id,
        status,
        updatedAt,
        metadataJson({
          ...currentMetadata,
          providerStatus: {
            status,
            receivedAt: updatedAt,
            payload: metadata
          }
        })
      ]
    );
    if (!updated.rowCount) {
      const current = await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [row.id]);
      return {
        intent: current.rowCount ? rowToPurchaseIntent(current.rows[0]) : rowToPurchaseIntent(row),
        transaction: null,
        alreadyRecorded: true,
        ignored: true,
        reason: current.rows[0]?.status || 'unknown'
      };
    }
    return {
      intent: rowToPurchaseIntent(updated.rows[0]),
      transaction: null,
      statusRecorded: true,
      ignored: true,
      reason: status
    };
  }));
}

async function recordCompletedPurchaseReviewStatus(client, row, {
  status,
  metadata = {}
}) {
  const reviewedAt = nowIso();
  const currentMetadata = parseJson(row.metadata_json, {});
  const updated = await client.query(
    `UPDATE wallet_purchase_intents
     SET status = $2,
         updated_at = $3,
         metadata_json = $4
     WHERE id = $1
       AND status = 'completed'
     RETURNING *`,
    [
      row.id,
      status,
      reviewedAt,
      metadataJson({
        ...currentMetadata,
        providerStatus: {
          status,
          receivedAt: reviewedAt,
          payload: metadata
        },
        supportReview: {
          status: 'required',
          reason: status,
          recordedAt: reviewedAt
        }
      })
    ]
  );
  return {
    intent: rowToPurchaseIntent(updated.rows[0] || row),
    transaction: null,
    statusRecorded: true,
    supportRequired: true,
    ignored: true,
    reason: status
  };
}

async function recordCompletedPurchaseClawback(client, row, {
  provider,
  status,
  metadata = {}
}) {
  const reversedAt = nowIso();
  const currentMetadata = parseJson(row.metadata_json, {});
  let transaction = null;
  let clawback = {
    status: 'not_attempted',
    reason: null,
    transactionId: null
  };

  try {
    transaction = await spendCurrency(client, createWalletPurchaseReversalMutation(row, {
      provider,
      status,
      payload: metadata
    }));
    clawback = {
      status: 'completed',
      reason: null,
      transactionId: transaction.id
    };
  } catch (err) {
    if (err?.message !== 'Not enough wallet balance') throw err;
    clawback = {
      status: 'insufficient_balance',
      reason: err.message,
      transactionId: null
    };
  }

  const updated = await client.query(
    `UPDATE wallet_purchase_intents
     SET status = $2,
         updated_at = $3,
         metadata_json = $4
     WHERE id = $1
       AND status = 'completed'
     RETURNING *`,
    [
      row.id,
      status,
      reversedAt,
      metadataJson({
        ...currentMetadata,
        providerStatus: {
          status,
          receivedAt: reversedAt,
          payload: metadata
        },
        clawback
      })
    ]
  );
  const intent = rowToPurchaseIntent(updated.rows[0] || row);
  return {
    intent,
    transaction,
    statusRecorded: true,
    reversalRecorded: true,
    clawbackStatus: clawback.status,
    supportRequired: clawback.status !== 'completed',
    ignored: true,
    reason: status
  };
}

export async function completeProviderWebhook(provider, payload = {}, { fetchImpl = globalThis.fetch } = {}) {
  const normalizedProvider = providerConfig(provider).provider;
  const { intentId, providerInvoiceId, providerPaymentId } = providerWebhookRefs(payload);
  if (!isCompletedProviderStatus(normalizedProvider, payload)) {
    const status = purchaseStatusFromProviderWebhook(normalizedProvider, payload);
    if (status) {
      return recordPurchaseIntentStatus({
        provider: normalizedProvider,
        intentId,
        providerInvoiceId,
        status,
        metadata: payload
      });
    }
    return { ignored: true, reason: 'not_completed' };
  }

  const paymentDetails =
    extractProviderPaymentDetails(normalizedProvider, payload) ||
    await fetchProviderInvoicePaymentDetails(normalizedProvider, providerInvoiceId, { fetchImpl });

  return completePurchaseIntent({
    provider: normalizedProvider,
    intentId,
    providerInvoiceId,
    providerPaymentId,
    priceAmount: paymentDetails?.priceAmount ?? null,
    priceCurrency: paymentDetails?.priceCurrency ?? null,
    metadata: payload
  });
}

export async function processProviderWebhookEvent(provider, payload = {}, {
  rawBody = '',
  fetchImpl = globalThis.fetch
} = {}) {
  const started = await beginPaymentWebhookEvent(provider, payload, { rawBody });
  if (started.action === 'replay') {
    return {
      ...(started.event.result || {}),
      webhookEvent: {
        id: started.event.id,
        provider: started.event.provider,
        eventKey: started.event.eventKey,
        duplicate: true,
        replayed: true
      }
    };
  }
  if (started.action === 'in_progress') {
    return {
      ignored: true,
      reason: 'duplicate_webhook_processing',
      webhookEvent: {
        id: started.event.id,
        provider: started.event.provider,
        eventKey: started.event.eventKey,
        duplicate: true,
        processing: true
      }
    };
  }

  try {
    const result = await completeProviderWebhook(provider, payload, { fetchImpl });
    const event = await markPaymentWebhookEventProcessed(started.event, result);
    return {
      ...result,
      webhookEvent: {
        id: event.id,
        provider: event.provider,
        eventKey: event.eventKey,
        duplicate: false,
        replayed: false
      }
    };
  } catch (err) {
    await markPaymentWebhookEventFailed(started.event, err);
    throw err;
  }
}
