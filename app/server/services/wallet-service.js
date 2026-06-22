import { query, withTransaction } from '../db.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';

export const WALLET_CURRENCY_CODE = 'soft_coin';

export const WALLET_PURCHASE_PROVIDERS = new Set([
  'telegram_stars',
  'btcpay',
  'nowpayments'
]);

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

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
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

export function getWalletBundles(provider = null) {
  if (provider) {
    return BASE_WALLET_BUNDLES.map((bundle) => bundleForProvider(bundle, provider));
  }
  return [...WALLET_PURCHASE_PROVIDERS].flatMap((purchaseProvider) =>
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
      ]
    };
  }
  return {
    type: 'crypto_invoice',
    provider: intent.provider,
    invoiceId: intent.providerInvoiceId,
    checkoutUrl: null,
    paymentUri: null,
    priceAmount: intent.priceAmount,
    priceCurrency: intent.priceCurrency
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

  const current = await client.query(
    `SELECT balance FROM player_wallet_balances WHERE player_id = $1 AND currency_code = $2`,
    [playerId, normalizedCurrency]
  );
  const currentBalance = Number(current.rows[0]?.balance || 0);
  const nextBalance = currentBalance + amount;
  if (nextBalance < 0) {
    throw httpError('Not enough wallet balance', 400);
  }
  await client.query(
    `UPDATE player_wallet_balances
     SET balance = $3, updated_at = $4
     WHERE player_id = $1 AND currency_code = $2`,
    [playerId, normalizedCurrency, nextBalance, nowIso()]
  );

  const balanceRow = await client.query(
    `SELECT balance FROM player_wallet_balances WHERE player_id = $1 AND currency_code = $2`,
    [playerId, normalizedCurrency]
  );
  const balanceAfter = Number(balanceRow.rows[0]?.balance || 0);
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
      [playerId, balanceAfter, nowIso()]
    );
  }

  return transaction;
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
  return withTransaction((client) => grantCurrency(client, params));
}

export async function spendCurrencyForPlayer(params) {
  return withTransaction((client) => spendCurrency(client, params));
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

export async function createPurchaseIntent(playerId, {
  bundleId,
  provider = 'telegram_stars',
  idempotencyKey = null
} = {}) {
  const bundle = findWalletBundle(bundleId, provider);
  return withTransaction(async (client) => {
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
      checkoutProvider: bundle.provider
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
  return withTransaction(async (client) => {
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
    const receivedCurrency = priceCurrency || row.price_currency;
    if (receivedAmount !== expectedAmount || receivedCurrency !== row.price_currency) {
      throw httpError('Invalid wallet purchase amount', 400);
    }

    const paymentId = providerPaymentId || createId(`payment_${normalizedProvider}`);
    const completedAt = nowIso();
    await client.query(
      `UPDATE wallet_purchase_intents
       SET status = 'completed',
           provider_payment_id = $2,
           completed_at = $3,
           updated_at = $3,
           metadata_json = $4
       WHERE id = $1`,
      [
        row.id,
        paymentId,
        completedAt,
        metadataJson({ ...parseJson(row.metadata_json, {}), completion: metadata })
      ]
    );

    const transaction = await grantCurrency(client, {
      playerId: row.player_id,
      currencyCode: row.currency_code,
      amount: Number(row.wallet_amount || 0),
      reason: 'wallet_purchase',
      sourceType: 'wallet_purchase_intent',
      sourceId: row.id,
      idempotencyKey: `wallet_purchase:${row.id}`,
      metadata: {
        provider: normalizedProvider,
        providerInvoiceId: row.provider_invoice_id,
        providerPaymentId: paymentId
      }
    });

    const completed = await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [row.id]);
    return {
      intent: rowToPurchaseIntent(completed.rows[0]),
      transaction,
      alreadyCompleted: false
    };
  });
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

export async function completeProviderWebhook(provider, payload = {}) {
  const normalizedProvider = providerConfig(provider).provider;
  if (!isCompletedProviderStatus(normalizedProvider, payload)) {
    return { ignored: true, reason: 'not_completed' };
  }

  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const intentId =
    metadata.walletPurchaseIntentId ||
    metadata.intentId ||
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
    payload.id ||
    providerInvoiceId;

  return completePurchaseIntent({
    provider: normalizedProvider,
    intentId,
    providerInvoiceId,
    providerPaymentId,
    metadata: payload
  });
}
