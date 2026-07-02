import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, freshDb } from './helpers.js';
import { query } from '../../app/server/db.js';
import { createId, nowIso } from '../../app/server/lib/utils.js';
import {
  createPurchaseIntent,
  grantCurrencyForPlayer,
  processProviderWebhookEvent,
  reconcileWalletPayments
} from '../../app/server/services/wallet-service.js';

test('[Req 4-Z] wallet payment reconciliation is clean after a normal provider completion', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4601 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'reconcile-clean'
  });
  const payload = {
    deliveryId: 'reconcile-clean-delivery',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'reconcile-clean-payment'
  };
  await processProviderWebhookEvent('btcpay', payload, { rawBody: JSON.stringify(payload) });

  const report = await reconcileWalletPayments({ limit: 10 });
  assert.equal(report.ok, true);
  assert.equal(report.total, 0);
});

test('[Req 4-Z] wallet payment reconciliation reports local payment mismatches', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4602 });

  const missingGrant = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'reconcile-missing-grant'
  });
  const now = nowIso();
  await query(
    `UPDATE wallet_purchase_intents
     SET status = 'completed',
         provider_payment_id = $2,
         completed_at = $3,
         updated_at = $3
     WHERE id = $1`,
    [missingGrant.id, 'reconcile-manual-payment', now]
  );

  const pendingIntent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'reconcile-pending-grant'
  });
  await grantCurrencyForPlayer({
    playerId: player.id,
    amount: pendingIntent.walletAmount,
    reason: 'wallet_purchase',
    sourceType: 'wallet_purchase_intent',
    sourceId: pendingIntent.id,
    idempotencyKey: 'reconcile-bad-pending-grant'
  });

  await query(
    `INSERT INTO payment_webhook_events
     (id, provider, event_key, payload_hash, processing_status, result_json, received_at, processed_at, metadata_json)
     VALUES ($1, 'btcpay', 'event:reconcile-missing-intent', 'hash-reconcile-missing-intent',
       'processed', $2, $3, $3, $4)`,
    [
      createId('pwh'),
      JSON.stringify({ alreadyCompleted: false }),
      nowIso(),
      JSON.stringify({ providerInvoiceId: 'unknown-provider-invoice' })
    ]
  );

  const report = await reconcileWalletPayments({ limit: 10 });
  assert.equal(report.ok, false);
  assert.equal(report.total, 3);
  assert.ok(report.categories.completedIntentsMissingWalletGrant.some((row) => row.intentId === missingGrant.id));
  assert.ok(report.categories.walletGrantsWithoutCompletedIntent.some((row) => row.sourceId === pendingIntent.id));
  assert.ok(report.categories.processedWebhookIntentIssues.some((row) => row.issue === 'webhook_missing_intent'));
});
