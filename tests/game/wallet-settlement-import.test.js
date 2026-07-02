import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, freshDb } from './helpers.js';
import { query } from '../../app/server/db.js';
import {
  completePurchaseIntent,
  createPurchaseIntent,
  getWalletState,
  processProviderWebhookEvent
} from '../../app/server/services/wallet-service.js';
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
