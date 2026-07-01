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

export const WALLET_PURCHASE_STATUSES = new Set([
  'pending',
  'completed',
  'expired',
  'failed',
  'refunded',
  'underpaid',
  'overpaid',
  'cancelled'
]);

const walletMutationLocks = new Map();
const purchaseIntentLocks = new Map();
const checkoutLocks = new Map();

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
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
  return String(currencyCode || WALLET_CURRENCY_CODE).trim() || WALLET_CURRENCY_CODE;
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
  const storedCheckout = intent.metadata?.checkout && typeof intent.metadata.checkout === 'object'
    ? intent.metadata.checkout
    : {};
  if (intent.provider === 'telegram_stars') {
    return {
      type: 'telegram_invoice',
      provider: intent.provider,
      title: `${intent.walletAmount} wallet coins`,
      description: `${intent.walletAmount} profile wallet coins`,
      payload: intent.id,
      currency: intent.priceCurrency,
      prices: [
        { label: `${intent.walletAmount} wallet coins`, amount: intent.priceAmount }
      ],
      ...storedCheckout
    };
  }
  return {
    type: 'crypto_invoice',
    provider: intent.provider,
    invoiceId: intent.providerInvoiceId,
    checkoutUrl: null,
    paymentUri: null,
    priceAmount: intent.priceAmount,
    priceCurrency: intent.priceCurrency,
    ...storedCheckout
  };
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
  const normalizedCurrency = normalizeCurrencyCode(currencyCode);
  const amount = Number(delta);
  if (!Number.isInteger(amount) || amount === 0) {
    throw httpError('Wallet delta must be a non-zero integer', 400);
  }
  if (!reason) throw httpError('Wallet transaction reason is required', 400);

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
  const transaction = {
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
  };

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
  const value = Number(amount);
  if (!Number.isInteger(value) || value <= 0) {
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
  const value = Number(amount);
  if (!Number.isInteger(value) || value <= 0) {
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

    await client.query(
      `INSERT INTO wallet_purchase_intents
       (id, player_id, provider, provider_invoice_id, currency_code, wallet_amount,
        price_amount, price_currency, status, idempotency_key, metadata_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $11)`,
      [
        id,
        playerId,
        bundle.provider,
        providerInvoiceId,
        bundle.currencyCode,
        bundle.walletAmount,
        bundle.priceAmount,
        bundle.priceCurrency,
        idempotencyKey,
        metadataJson(metadata),
        now
      ]
    );

    const row = await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [id]);
    return rowToPurchaseIntent(row.rows[0]);
  });

  if (intent.checkout?.invoiceReady || intent.checkout?.setupRequired) return intent;

  return withKeyedLock(checkoutLocks, `checkout:${intent.id}`, async () => {
    const latest = await query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [intent.id]);
    if (!latest.rowCount) throw httpError('Unknown wallet purchase intent', 404);
    const latestIntent = rowToPurchaseIntent(latest.rows[0]);
    if (latestIntent.checkout?.invoiceReady || latestIntent.checkout?.setupRequired) return latestIntent;
    if (latestIntent.status !== 'pending') return latestIntent;

    const checkout = await createProviderCheckout(latestIntent, { fetchImpl });
    const nextMetadata = {
      ...latestIntent.metadata,
      checkout
    };
    const providerInvoiceId = checkout.providerInvoiceId || latestIntent.providerInvoiceId;
    await query(
      `UPDATE wallet_purchase_intents
       SET provider_invoice_id = $2,
           metadata_json = $3,
           updated_at = $4
       WHERE id = $1 AND status = 'pending'`,
      [latestIntent.id, providerInvoiceId, metadataJson(nextMetadata), nowIso()]
    );
    const updated = await query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [latestIntent.id]);
    return rowToPurchaseIntent(updated.rows[0]);
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

    const expectedAmount = Number(row.price_amount || 0);
    const receivedAmount = priceAmount == null ? expectedAmount : Number(priceAmount);
    const expectedCurrency = normalizePriceCurrency(row.price_currency);
    const receivedCurrency = normalizePriceCurrency(priceCurrency) || expectedCurrency;
    if (receivedAmount !== expectedAmount || receivedCurrency !== expectedCurrency) {
      throw httpError('Invalid wallet purchase amount', 400);
    }

    const paymentId = providerPaymentId || createId(`payment_${normalizedProvider}`);
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
        paymentId,
        completedAt,
        metadataJson({ ...parseJson(row.metadata_json, {}), completion: metadata })
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

    const transaction = await grantCurrency(client, {
      playerId: completedRow.player_id,
      currencyCode: completedRow.currency_code,
      amount: Number(completedRow.wallet_amount || 0),
      reason: 'wallet_purchase',
      sourceType: 'wallet_purchase_intent',
      sourceId: completedRow.id,
      idempotencyKey: `wallet_purchase:${completedRow.id}`,
      metadata: {
        provider: normalizedProvider,
        providerInvoiceId: completedRow.provider_invoice_id,
        providerPaymentId: paymentId
      }
    });

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
    if (status === 'refunded') return 'refunded';
    if (status === 'underpaid') return 'underpaid';
    if (status === 'overpaid') return 'overpaid';
  }
  if (provider === 'nowpayments') {
    const status = String(payload?.payment_status || payload?.status || '').toLowerCase();
    if (status === 'expired') return 'expired';
    if (status === 'failed') return 'failed';
    if (status === 'refunded') return 'refunded';
    if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
    if (status === 'underpaid') return 'underpaid';
    if (status === 'overpaid') return 'overpaid';
  }
  return null;
}

async function recordPurchaseIntentStatus({
  provider,
  intentId = null,
  providerInvoiceId = null,
  status,
  metadata = {}
} = {}) {
  if (!WALLET_PURCHASE_STATUSES.has(status) || ['pending', 'completed'].includes(status)) {
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
