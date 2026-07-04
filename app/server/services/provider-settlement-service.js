import {
  walletSettlementMatchesPurchaseStatus,
  walletSettlementRequiresClawback,
  walletSettlementRequiresGrant
} from '@microwavedev/backpack-game-core/modules/wallet';
import { query, withTransaction } from '../db.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';
import { WALLET_PURCHASE_PROVIDERS } from './wallet-service.js';

const PROVIDER_UNIT_SCALE = {
  telegram_stars: 1,
  btcpay: 100,
  nowpayments: 100
};

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function jsonText(value) {
  return JSON.stringify(value || {});
}

function firstPresent(...values) {
  return values.find((value) => value != null && value !== '') ?? null;
}

function normalizeProvider(provider) {
  const normalized = String(provider || '').trim();
  if (!WALLET_PURCHASE_PROVIDERS.has(normalized)) {
    throw httpError('Unknown wallet purchase provider', 400);
  }
  return normalized;
}

function normalizeCurrency(currency) {
  const normalized = String(currency || '').trim().toUpperCase();
  return normalized || null;
}

function decimalToMinorUnits(value, unitScale = 100) {
  if (value == null || value === '') return null;
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
  const nextDigit = Number(fractionText[decimals] || '0');
  return sign * (whole + fraction + (nextDigit >= 5 ? 1 : 0));
}

function normalizePriceAmount(provider, rawRecord = {}) {
  const minorAmount = firstPresent(
    rawRecord.priceAmountMinor,
    rawRecord.price_amount_minor,
    rawRecord.amountMinor,
    rawRecord.amount_minor
  );
  if (minorAmount != null) {
    const value = Number(minorAmount);
    return Number.isInteger(value) ? value : null;
  }

  const amount = firstPresent(
    rawRecord.priceAmount,
    rawRecord.price_amount,
    rawRecord.amount,
    rawRecord.invoiceAmount,
    rawRecord.invoice_amount,
    rawRecord.data?.price_amount,
    rawRecord.data?.amount
  );
  const unitScale = PROVIDER_UNIT_SCALE[provider] || 100;
  if (unitScale === 1) {
    const value = Number(amount);
    return Number.isInteger(value) ? value : null;
  }
  return decimalToMinorUnits(amount, unitScale);
}

function normalizeSettlementStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase();
  if (['settled', 'complete', 'completed', 'paid', 'finished', 'confirmed', 'sending'].includes(status)) {
    return 'completed';
  }
  if (status.includes('refund')) return 'refunded';
  if (['reversed', 'reverse'].includes(status)) return 'reversed';
  if (['chargeback', 'charged_back'].includes(status)) return 'chargeback';
  if (['disputed', 'dispute'].includes(status)) return 'disputed';
  if (['underpaid', 'under_paid'].includes(status)) return 'underpaid';
  if (['overpaid', 'over_paid'].includes(status)) return 'overpaid';
  if (['expired'].includes(status)) return 'expired';
  if (['failed', 'invalid'].includes(status)) return 'failed';
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
  return status || 'unknown';
}

function rowToSettlementImport(row) {
  return {
    id: row.id,
    provider: row.provider,
    sourceType: row.source_type,
    sourceRef: row.source_ref || null,
    importedBy: row.imported_by || null,
    recordCount: Number(row.record_count || 0),
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

function rowToSettlementRecord(row) {
  return {
    id: row.id,
    importId: row.import_id,
    provider: row.provider,
    localIntentId: row.local_intent_id || null,
    providerInvoiceId: row.provider_invoice_id || null,
    providerPaymentId: row.provider_payment_id || null,
    settlementStatus: row.settlement_status,
    priceAmount: row.price_amount == null ? null : Number(row.price_amount),
    priceCurrency: row.price_currency || null,
    settledAt: row.settled_at || null,
    raw: parseJson(row.raw_json, {}),
    createdAt: row.created_at
  };
}

function rowToIntent(row) {
  if (!row) return null;
  return {
    id: row.id,
    playerId: row.player_id,
    provider: row.provider,
    providerInvoiceId: row.provider_invoice_id || null,
    providerPaymentId: row.provider_payment_id || null,
    status: row.status,
    priceAmount: Number(row.price_amount || 0),
    priceCurrency: row.price_currency,
    walletAmount: Number(row.wallet_amount || 0),
    completedAt: row.completed_at || null,
    updatedAt: row.updated_at || null
  };
}

function rowToWalletTx(row) {
  if (!row) return null;
  return {
    id: row.id,
    playerId: row.player_id,
    delta: Number(row.delta || 0),
    currencyCode: row.currency_code,
    reason: row.reason,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
    createdAt: row.created_at
  };
}

function reportIssue(record, intent, issue, details = {}) {
  return {
    issue,
    record,
    intent,
    ...details
  };
}

export function normalizeProviderSettlementRecord(rawRecord = {}, {
  provider
} = {}) {
  const normalizedProvider = normalizeProvider(provider || rawRecord.provider);
  const settlementStatus = normalizeSettlementStatus(firstPresent(
    rawRecord.settlementStatus,
    rawRecord.settlement_status,
    rawRecord.payment_status,
    rawRecord.status,
    rawRecord.type
  ));
  const priceCurrency = normalizeCurrency(firstPresent(
    rawRecord.priceCurrency,
    rawRecord.price_currency,
    rawRecord.currency,
    rawRecord.invoiceCurrency,
    rawRecord.invoice_currency,
    rawRecord.data?.price_currency,
    rawRecord.data?.currency
  ));
  return {
    provider: normalizedProvider,
    localIntentId: firstPresent(
      rawRecord.localIntentId,
      rawRecord.local_intent_id,
      rawRecord.walletPurchaseIntentId,
      rawRecord.wallet_purchase_intent_id,
      rawRecord.intentId,
      rawRecord.intent_id,
      rawRecord.invoicePayload,
      rawRecord.invoice_payload,
      rawRecord.orderId,
      rawRecord.order_id,
      rawRecord.data?.intent_id,
      rawRecord.data?.order_id
    ),
    providerInvoiceId: firstPresent(
      rawRecord.providerInvoiceId,
      rawRecord.provider_invoice_id,
      rawRecord.invoiceId,
      rawRecord.invoice_id,
      rawRecord.order_id,
      rawRecord.orderId,
      rawRecord.data?.invoice_id
    ),
    providerPaymentId: firstPresent(
      rawRecord.providerPaymentId,
      rawRecord.provider_payment_id,
      rawRecord.paymentId,
      rawRecord.payment_id,
      rawRecord.id,
      rawRecord.data?.payment_id
    ),
    settlementStatus,
    priceAmount: normalizePriceAmount(normalizedProvider, rawRecord),
    priceCurrency,
    settledAt: firstPresent(
      rawRecord.settledAt,
      rawRecord.settled_at,
      rawRecord.paidAt,
      rawRecord.paid_at,
      rawRecord.createdAt,
      rawRecord.created_at,
      rawRecord.updatedAt,
      rawRecord.updated_at,
      rawRecord.data?.created_at
    ),
    raw: rawRecord
  };
}

async function findIntentForSettlementRecord(client, record) {
  if (record.localIntentId) {
    const byIntentId = await client.query(
      `SELECT * FROM wallet_purchase_intents
       WHERE id = $1 AND provider = $2
       LIMIT 1`,
      [record.localIntentId, record.provider]
    );
    if (byIntentId.rowCount) return rowToIntent(byIntentId.rows[0]);
  }
  if (record.providerInvoiceId) {
    const byInvoice = await client.query(
      `SELECT * FROM wallet_purchase_intents
       WHERE provider = $1 AND provider_invoice_id = $2
       LIMIT 1`,
      [record.provider, record.providerInvoiceId]
    );
    if (byInvoice.rowCount) return rowToIntent(byInvoice.rows[0]);
  }
  if (record.providerPaymentId) {
    const byPayment = await client.query(
      `SELECT * FROM wallet_purchase_intents
       WHERE provider = $1 AND provider_payment_id = $2
       LIMIT 1`,
      [record.provider, record.providerPaymentId]
    );
    if (byPayment.rowCount) return rowToIntent(byPayment.rows[0]);
  }
  return null;
}

async function walletTransactionForIntent(client, intentId, reason) {
  const result = await client.query(
    `SELECT *
     FROM player_wallet_transactions
     WHERE source_type = 'wallet_purchase_intent'
       AND source_id = $1
       AND reason = $2
     ORDER BY created_at ASC
     LIMIT 1`,
    [intentId, reason]
  );
  return result.rowCount ? rowToWalletTx(result.rows[0]) : null;
}

async function reconcileNormalizedSettlementRecords(records, { client }) {
  const categories = {
    providerSettlementsMissingLocalIntent: [],
    providerSettlementStatusMismatches: [],
    providerSettlementAmountMismatches: [],
    providerCompletedWithoutWalletGrant: [],
    providerReversalsMissingWalletClawback: []
  };
  const matched = [];

  for (const record of records) {
    const intent = await findIntentForSettlementRecord(client, record);
    if (!intent) {
      categories.providerSettlementsMissingLocalIntent.push(reportIssue(
        record,
        null,
        'provider_settlement_missing_local_intent'
      ));
      continue;
    }

    if (!walletSettlementMatchesPurchaseStatus(record.settlementStatus, intent.status)) {
      categories.providerSettlementStatusMismatches.push(reportIssue(
        record,
        intent,
        'provider_settlement_local_status_mismatch',
        { expectedLocalStatus: record.settlementStatus, actualLocalStatus: intent.status }
      ));
    }

    if (
      record.priceAmount != null &&
      record.priceCurrency &&
      (
        Number(record.priceAmount) !== Number(intent.priceAmount) ||
        normalizeCurrency(record.priceCurrency) !== normalizeCurrency(intent.priceCurrency)
      )
    ) {
      categories.providerSettlementAmountMismatches.push(reportIssue(
        record,
        intent,
        'provider_settlement_amount_mismatch',
        {
          expectedPriceAmount: intent.priceAmount,
          expectedPriceCurrency: intent.priceCurrency,
          providerPriceAmount: record.priceAmount,
          providerPriceCurrency: record.priceCurrency
        }
      ));
    }

    if (walletSettlementRequiresGrant(record.settlementStatus)) {
      const walletGrant = await walletTransactionForIntent(client, intent.id, 'wallet_purchase');
      if (!walletGrant) {
        categories.providerCompletedWithoutWalletGrant.push(reportIssue(
          record,
          intent,
          'provider_completed_without_wallet_grant'
        ));
      }
    }

    if (walletSettlementRequiresClawback(record.settlementStatus)) {
      const walletGrant = await walletTransactionForIntent(client, intent.id, 'wallet_purchase');
      const walletReversal = await walletTransactionForIntent(client, intent.id, 'wallet_purchase_reversal');
      if (walletGrant && !walletReversal) {
        categories.providerReversalsMissingWalletClawback.push(reportIssue(
          record,
          intent,
          'provider_reversal_missing_wallet_clawback',
          { walletGrant }
        ));
      }
    }

    matched.push({ record, intent });
  }

  const totalIssues = Object.values(categories).reduce((sum, rows) => sum + rows.length, 0);
  return {
    ok: totalIssues === 0,
    totalIssues,
    matchedCount: matched.length,
    categories,
    matched
  };
}

export async function importProviderSettlementRecords({
  provider,
  records = [],
  sourceType = 'json',
  sourceRef = null,
  importedBy = null,
  metadata = {},
  dryRun = false
} = {}) {
  const normalizedProvider = normalizeProvider(provider);
  if (!Array.isArray(records)) throw httpError('Provider settlement records must be an array', 400);
  const normalizedRecords = records.map((record) =>
    normalizeProviderSettlementRecord(record, { provider: normalizedProvider })
  );

  return withTransaction(async (client) => {
    const report = await reconcileNormalizedSettlementRecords(normalizedRecords, { client });
    if (dryRun) {
      return {
        dryRun: true,
        import: null,
        records: normalizedRecords,
        report,
        generatedAt: nowIso()
      };
    }

    const importId = createId('settlement_import');
    const createdAt = nowIso();
    await client.query(
      `INSERT INTO provider_settlement_imports
       (id, provider, source_type, source_ref, imported_by, record_count, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        importId,
        normalizedProvider,
        String(sourceType || 'json'),
        sourceRef,
        importedBy,
        normalizedRecords.length,
        jsonText(metadata),
        createdAt
      ]
    );

    const storedRecords = [];
    for (const record of normalizedRecords) {
      const recordId = createId('settlement_record');
      await client.query(
        `INSERT INTO provider_settlement_records
         (id, import_id, provider, local_intent_id, provider_invoice_id, provider_payment_id,
          settlement_status, price_amount, price_currency, settled_at, raw_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          recordId,
          importId,
          record.provider,
          record.localIntentId,
          record.providerInvoiceId,
          record.providerPaymentId,
          record.settlementStatus,
          record.priceAmount,
          record.priceCurrency,
          record.settledAt,
          jsonText(record.raw),
          createdAt
        ]
      );
      const inserted = await client.query(`SELECT * FROM provider_settlement_records WHERE id = $1`, [recordId]);
      storedRecords.push(rowToSettlementRecord(inserted.rows[0]));
    }

    const insertedImport = await client.query(`SELECT * FROM provider_settlement_imports WHERE id = $1`, [importId]);
    return {
      dryRun: false,
      import: rowToSettlementImport(insertedImport.rows[0]),
      records: storedRecords,
      report,
      generatedAt: nowIso()
    };
  });
}
