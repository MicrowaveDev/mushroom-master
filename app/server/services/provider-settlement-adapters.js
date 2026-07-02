import { WALLET_PURCHASE_PROVIDERS } from './wallet-service.js';

const JSON_RECORD_KEYS = ['records', 'data', 'payments', 'invoices', 'items', 'rows', 'transactions'];
const INPUT_FORMATS = new Set(['auto', 'json', 'csv']);

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
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

function normalizeInputFormat(format = 'auto', sourceRef = '') {
  const normalized = String(format || 'auto').trim().toLowerCase();
  if (!INPUT_FORMATS.has(normalized)) throw httpError('Unsupported settlement import format', 400);
  if (normalized !== 'auto') return normalized;
  return String(sourceRef || '').toLowerCase().endsWith('.csv') ? 'csv' : 'json';
}

function canonicalKey(key) {
  return String(key || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getValue(record, keys) {
  if (!record || typeof record !== 'object') return null;
  for (const key of keys) {
    if (Object.hasOwn(record, key) && record[key] != null && record[key] !== '') return record[key];
  }
  const canonical = new Map(Object.entries(record).map(([key, value]) => [canonicalKey(key), value]));
  for (const key of keys) {
    const value = canonical.get(canonicalKey(key));
    if (value != null && value !== '') return value;
  }
  return null;
}

function scopedValue(record, keys) {
  return firstPresent(
    getValue(record, keys),
    getValue(record?.data, keys),
    getValue(record?.invoice, keys),
    getValue(record?.payment, keys),
    getValue(record?.metadata, keys),
    getValue(record?.successful_payment, keys),
    getValue(record?.successfulPayment, keys)
  );
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const source = String(text || '').replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (inQuotes) throw httpError('Invalid CSV settlement import: unclosed quoted field', 400);
  row.push(field);
  rows.push(row);

  const nonEmptyRows = rows.filter((cells) => cells.some((cell) => String(cell || '').trim() !== ''));
  if (!nonEmptyRows.length) return [];
  const headers = nonEmptyRows[0].map((header, index) => String(header || `column_${index + 1}`).trim());
  return nonEmptyRows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header || `column_${index + 1}`] = cells[index] == null ? '' : String(cells[index]).trim();
    });
    return record;
  });
}

function recordsFromJson(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') {
    throw httpError('Settlement JSON must be an array or an object containing records', 400);
  }
  for (const key of JSON_RECORD_KEYS) {
    if (Array.isArray(value[key])) return value[key];
  }
  throw httpError('Settlement JSON must be an array or contain records/data/payments/invoices/items/rows/transactions array', 400);
}

function normalizeBtcpayStatus(record) {
  const type = String(scopedValue(record, ['type', 'eventType', 'event_type']) || '').trim().toLowerCase();
  const status = scopedValue(record, ['settlementStatus', 'status', 'invoiceStatus', 'paymentStatus']);
  if (type === 'invoicesettled' || type === 'invoicepaymentsettled') return 'settled';
  if (type === 'invoiceexpired') return 'expired';
  if (type === 'invoiceinvalid') return 'failed';
  if (type.includes('refund')) return 'refunded';
  return status;
}

function adaptBtcpaySettlementRecord(record) {
  return {
    ...record,
    provider: 'btcpay',
    localIntentId: scopedValue(record, [
      'localIntentId',
      'walletPurchaseIntentId',
      'intentId',
      'orderId',
      'order_id',
      'metadataOrderId'
    ]),
    providerInvoiceId: scopedValue(record, [
      'providerInvoiceId',
      'invoiceId',
      'invoice_id',
      'invoice',
      'id',
      'InvoiceId',
      'Invoice ID'
    ]),
    providerPaymentId: scopedValue(record, [
      'providerPaymentId',
      'paymentId',
      'payment_id',
      'PaymentId',
      'Payment ID',
      'transactionId',
      'Transaction ID'
    ]),
    status: normalizeBtcpayStatus(record),
    amount: scopedValue(record, [
      'priceAmount',
      'price_amount',
      'amount',
      'price',
      'invoiceAmount',
      'Invoice Amount',
      'Amount',
      'total',
      'Total'
    ]),
    currency: scopedValue(record, [
      'priceCurrency',
      'price_currency',
      'currency',
      'invoiceCurrency',
      'Invoice Currency',
      'Currency'
    ]),
    settledAt: scopedValue(record, [
      'settledAt',
      'settled_at',
      'paidAt',
      'paid_at',
      'paymentDate',
      'Payment Date',
      'createdTime',
      'CreatedTime',
      'createdAt',
      'updatedAt'
    ]),
    sourceRecord: record
  };
}

function adaptNowPaymentsSettlementRecord(record) {
  return {
    ...record,
    provider: 'nowpayments',
    localIntentId: scopedValue(record, [
      'localIntentId',
      'walletPurchaseIntentId',
      'intentId',
      'orderId',
      'order_id'
    ]),
    providerInvoiceId: scopedValue(record, [
      'providerInvoiceId',
      'invoiceId',
      'invoice_id',
      'payment_id',
      'paymentId',
      'id'
    ]),
    providerPaymentId: scopedValue(record, [
      'providerPaymentId',
      'paymentId',
      'payment_id',
      'id'
    ]),
    payment_status: scopedValue(record, ['payment_status', 'paymentStatus', 'status']),
    price_amount: scopedValue(record, ['price_amount', 'priceAmount', 'amount', 'Amount']),
    price_currency: scopedValue(record, ['price_currency', 'priceCurrency', 'currency', 'Currency']),
    settledAt: scopedValue(record, ['actually_paid_at', 'settledAt', 'created_at', 'updated_at', 'createdAt', 'updatedAt']),
    sourceRecord: record
  };
}

function adaptTelegramStarsSettlementRecord(record) {
  return {
    ...record,
    provider: 'telegram_stars',
    localIntentId: scopedValue(record, [
      'localIntentId',
      'walletPurchaseIntentId',
      'intentId',
      'invoice_payload',
      'invoicePayload',
      'payload'
    ]),
    providerPaymentId: scopedValue(record, [
      'providerPaymentId',
      'telegram_payment_charge_id',
      'telegramPaymentChargeId',
      'provider_payment_charge_id',
      'providerPaymentChargeId',
      'paymentId',
      'payment_id'
    ]),
    status: scopedValue(record, ['settlementStatus', 'status', 'payment_status']) || 'completed',
    priceAmountMinor: scopedValue(record, [
      'priceAmountMinor',
      'total_amount',
      'totalAmount',
      'amount',
      'Amount'
    ]),
    priceCurrency: scopedValue(record, ['priceCurrency', 'currency']) || 'XTR',
    settledAt: scopedValue(record, ['settledAt', 'paidAt', 'createdAt', 'date']),
    sourceRecord: record
  };
}

export function adaptProviderSettlementRecords(provider, records = []) {
  const normalizedProvider = normalizeProvider(provider);
  if (!Array.isArray(records)) throw httpError('Provider settlement records must be an array', 400);
  if (normalizedProvider === 'btcpay') return records.map(adaptBtcpaySettlementRecord);
  if (normalizedProvider === 'nowpayments') return records.map(adaptNowPaymentsSettlementRecord);
  if (normalizedProvider === 'telegram_stars') return records.map(adaptTelegramStarsSettlementRecord);
  return records;
}

export function parseProviderSettlementInput(text, {
  provider,
  format = 'auto',
  sourceRef = ''
} = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const inputFormat = normalizeInputFormat(format, sourceRef);
  const rawRecords = inputFormat === 'csv'
    ? parseCsv(text)
    : recordsFromJson(JSON.parse(String(text || '')));
  return {
    provider: normalizedProvider,
    format: inputFormat,
    adapter: normalizedProvider,
    rawRecordCount: rawRecords.length,
    records: adaptProviderSettlementRecords(normalizedProvider, rawRecords)
  };
}
