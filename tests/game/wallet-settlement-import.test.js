import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, freshDb } from './helpers.js';
import { query } from '../../app/server/db.js';
import {
  completeTelegramSuccessfulPayment,
  completePurchaseIntent,
  createPurchaseIntent,
  getWalletState,
  processProviderWebhookEvent
} from '../../app/server/services/wallet-service.js';
import { parseProviderSettlementInput } from '../../app/server/services/provider-settlement-adapters.js';
import {
  importProviderSettlementRecords,
  normalizeProviderSettlementRecord
} from '../../app/server/services/provider-settlement-service.js';

test('[Req 4-Z] provider settlement import stores clean external reconciliation records', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4801 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'settlement-clean'
  });
  await completePurchaseIntent({
    provider: 'btcpay',
    providerInvoiceId: intent.providerInvoiceId,
    providerPaymentId: 'settlement-clean-payment'
  });

  const result = await importProviderSettlementRecords({
    provider: 'btcpay',
    sourceRef: 'btcpay-clean-export.json',
    importedBy: 'ops-agent',
    records: [
      {
        invoiceId: intent.providerInvoiceId,
        paymentId: 'settlement-clean-payment',
        status: 'settled',
        amount: '1.00',
        currency: 'USD',
        settledAt: '2026-07-02T12:00:00.000Z'
      }
    ]
  });

  assert.equal(result.report.ok, true);
  assert.equal(result.report.totalIssues, 0);
  assert.equal(result.report.matchedCount, 1);
  assert.equal(result.import.provider, 'btcpay');
  assert.equal(result.import.recordCount, 1);
  assert.equal(result.records[0].settlementStatus, 'completed');
  assert.equal(result.records[0].priceAmount, 100);

  const stored = await query(`SELECT COUNT(*) AS count FROM provider_settlement_records`);
  assert.equal(Number(stored.rows[0].count), 1);
});

test('[Req 4-Z] provider settlement import reports missing local intents and local mismatch categories', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4802 });
  const pendingIntent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'settlement-pending-mismatch'
  });

  const result = await importProviderSettlementRecords({
    provider: 'btcpay',
    dryRun: true,
    records: [
      {
        invoiceId: pendingIntent.providerInvoiceId,
        paymentId: 'settlement-pending-payment',
        status: 'settled',
        amount: '2.00',
        currency: 'USD'
      },
      {
        invoiceId: 'provider-only-invoice',
        paymentId: 'provider-only-payment',
        status: 'settled',
        amount: '1.00',
        currency: 'USD'
      }
    ]
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.import, null);
  assert.equal(result.report.ok, false);
  assert.equal(result.report.categories.providerSettlementsMissingLocalIntent.length, 1);
  assert.equal(result.report.categories.providerSettlementStatusMismatches.length, 1);
  assert.equal(result.report.categories.providerSettlementAmountMismatches.length, 1);
  assert.equal(result.report.categories.providerCompletedWithoutWalletGrant.length, 1);

  const stored = await query(`SELECT COUNT(*) AS count FROM provider_settlement_imports`);
  assert.equal(Number(stored.rows[0].count), 0, 'dry-run import must not persist rows');
});

test('[Req 4-Z] provider refund settlement records require local wallet clawback', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4803 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'settlement-refund-missing-clawback'
  });
  const settledPayload = {
    deliveryId: 'settlement-refund-settled',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'settlement-refund-payment'
  };
  await processProviderWebhookEvent('btcpay', settledPayload, { rawBody: JSON.stringify(settledPayload) });
  assert.equal((await getWalletState(player.id)).balance, 100);

  const result = await importProviderSettlementRecords({
    provider: 'btcpay',
    dryRun: true,
    records: [
      {
        invoiceId: intent.providerInvoiceId,
        paymentId: 'settlement-refund-payment',
        status: 'refunded',
        amount: '1.00',
        currency: 'USD'
      }
    ]
  });

  assert.equal(result.report.ok, false);
  assert.equal(result.report.categories.providerSettlementStatusMismatches.length, 1);
  assert.equal(result.report.categories.providerReversalsMissingWalletClawback.length, 1);
  assert.equal(result.report.categories.providerReversalsMissingWalletClawback[0].walletGrant.delta, 100);
});

test('[Req 4-Z] settlement normalizer handles provider status and minor amount shapes', () => {
  assert.deepEqual(
    normalizeProviderSettlementRecord({
      provider: 'nowpayments',
      payment_status: 'finished',
      payment_id: 'pay-1',
      price_amount: '5.50',
      price_currency: 'usd'
    }),
    {
      provider: 'nowpayments',
      localIntentId: null,
      providerInvoiceId: null,
      providerPaymentId: 'pay-1',
      settlementStatus: 'completed',
      priceAmount: 550,
      priceCurrency: 'USD',
      settledAt: null,
      raw: {
        provider: 'nowpayments',
        payment_status: 'finished',
        payment_id: 'pay-1',
        price_amount: '5.50',
        price_currency: 'usd'
      }
    }
  );
});

test('[Req 4-Z] provider settlement adapters parse BTCPay CSV exports', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4804 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'settlement-btcpay-csv'
  });
  await completePurchaseIntent({
    provider: 'btcpay',
    providerInvoiceId: intent.providerInvoiceId,
    providerPaymentId: 'btcpay-csv-payment'
  });

  const input = parseProviderSettlementInput([
    'Order ID,Invoice ID,Payment ID,Status,Amount,Currency,Settled At',
    `${intent.id},${intent.providerInvoiceId},btcpay-csv-payment,Settled,1.00,USD,2026-07-02T14:00:00.000Z`
  ].join('\n'), {
    provider: 'btcpay',
    format: 'csv',
    sourceRef: 'btcpay-settlement.csv'
  });

  assert.equal(input.format, 'csv');
  assert.equal(input.rawRecordCount, 1);
  assert.equal(input.records[0].localIntentId, intent.id);
  assert.equal(input.records[0].providerInvoiceId, intent.providerInvoiceId);

  const result = await importProviderSettlementRecords({
    provider: 'btcpay',
    records: input.records,
    sourceType: input.format,
    dryRun: true
  });

  assert.equal(result.report.ok, true);
  assert.equal(result.report.matchedCount, 1);
});

test('[Req 4-Z] Telegram Stars settlement rows reconcile by invoice payload intent id', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4805 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'telegram_stars',
    surface: 'telegram_mini_app',
    idempotencyKey: 'settlement-telegram-stars'
  });
  await completeTelegramSuccessfulPayment({
    invoice_payload: intent.id,
    telegram_payment_charge_id: 'tg-charge-1',
    total_amount: intent.priceAmount,
    currency: 'XTR'
  });

  const input = parseProviderSettlementInput(JSON.stringify({
    payments: [{
      invoice_payload: intent.id,
      telegram_payment_charge_id: 'tg-charge-1',
      total_amount: intent.priceAmount,
      currency: 'XTR',
      status: 'paid'
    }]
  }), {
    provider: 'telegram_stars',
    sourceRef: 'telegram-stars-payments.json'
  });
  const result = await importProviderSettlementRecords({
    provider: 'telegram_stars',
    records: input.records,
    dryRun: true
  });

  assert.equal(result.report.ok, true);
  assert.equal(result.report.matchedCount, 1);
  assert.equal(result.records[0].localIntentId, intent.id);
  assert.equal(result.records[0].priceAmount, intent.priceAmount);
});

test('[Req 4-Z] provider settlement adapters parse NOWPayments JSON payloads', () => {
  const input = parseProviderSettlementInput(JSON.stringify({
    data: [{
      order_id: 'intent-now-1',
      payment_id: 'now-payment-1',
      payment_status: 'finished',
      price_amount: '5.50',
      price_currency: 'usd',
      updated_at: '2026-07-02T15:00:00.000Z'
    }]
  }), {
    provider: 'nowpayments',
    sourceRef: 'nowpayments-payments.json'
  });

  assert.equal(input.format, 'json');
  assert.equal(input.records[0].localIntentId, 'intent-now-1');
  assert.equal(input.records[0].providerInvoiceId, 'now-payment-1');
  assert.equal(input.records[0].payment_status, 'finished');
  assert.equal(input.records[0].price_amount, '5.50');
});
