import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, freshDb } from './helpers.js';
import { query } from '../../app/server/db.js';
import { createId, nowIso } from '../../app/server/lib/utils.js';
import {
  completePurchaseIntent,
  createPurchaseIntent,
  expireStalePurchaseIntents,
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

test('[Req 4-Z] wallet payment reconciliation is clean after a completed refund clawback', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4603 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'reconcile-refund-clean'
  });
  const settledPayload = {
    deliveryId: 'reconcile-refund-clean-settled',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'reconcile-refund-clean-payment'
  };
  await processProviderWebhookEvent('btcpay', settledPayload, { rawBody: JSON.stringify(settledPayload) });
  const refundPayload = {
    deliveryId: 'reconcile-refund-clean-refunded',
    status: 'refunded',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'reconcile-refund-clean-payment'
  };
  await processProviderWebhookEvent('btcpay', refundPayload, { rawBody: JSON.stringify(refundPayload) });

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

test('[Req 4-Z] stale pending wallet purchase intents expire without touching terminal purchases', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4604 });
  const runAt = new Date('2026-07-02T12:00:00.000Z');
  const oldTimestamp = new Date(runAt.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const freshTimestamp = new Date(runAt.getTime() - 30 * 60 * 1000).toISOString();

  const oldPending = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'expire-old-pending'
  });
  const freshPending = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'expire-fresh-pending'
  });
  const completed = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'expire-completed'
  });
  await completePurchaseIntent({
    provider: 'btcpay',
    providerInvoiceId: completed.providerInvoiceId,
    providerPaymentId: 'expire-completed-payment'
  });

  await query(
    `UPDATE wallet_purchase_intents
     SET created_at = $2, updated_at = $2
     WHERE id IN ($1, $3)`,
    [oldPending.id, oldTimestamp, completed.id]
  );
  await query(
    `UPDATE wallet_purchase_intents
     SET created_at = $2, updated_at = $2
     WHERE id = $1`,
    [freshPending.id, freshTimestamp]
  );

  const dryRun = await expireStalePurchaseIntents({
    olderThanMs: 24 * 60 * 60 * 1000,
    now: runAt,
    dryRun: true
  });
  assert.equal(dryRun.expired, 0);
  assert.deepEqual(dryRun.candidates.map((intent) => intent.id), [oldPending.id]);

  const result = await expireStalePurchaseIntents({
    olderThanMs: 24 * 60 * 60 * 1000,
    now: runAt
  });
  assert.equal(result.expired, 1);
  assert.equal(result.expiredIntents[0].id, oldPending.id);
  assert.equal(result.expiredIntents[0].metadata.expiration.source, 'local_expiry_job');

  const statuses = await query(
    `SELECT id, status FROM wallet_purchase_intents
     WHERE id IN ($1, $2, $3)
     ORDER BY id ASC`,
    [oldPending.id, freshPending.id, completed.id]
  );
  const byId = new Map(statuses.rows.map((row) => [row.id, row.status]));
  assert.equal(byId.get(oldPending.id), 'expired');
  assert.equal(byId.get(freshPending.id), 'pending');
  assert.equal(byId.get(completed.id), 'completed');
});

test('[Req 4-Z] stale intent expiry skips active checkout creation claims', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4605 });
  const runAt = new Date('2026-07-02T12:00:00.000Z');
  const oldTimestamp = new Date(runAt.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const freshClaimTimestamp = runAt.toISOString();
  const staleClaimTimestamp = new Date(runAt.getTime() - 5 * 60 * 1000).toISOString();
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'expire-active-claim'
  });

  await query(
    `UPDATE wallet_purchase_intents
     SET created_at = $2,
         updated_at = $2,
         checkout_status = 'creating',
         checkout_claim_token = 'active-expiry-test-claim',
         checkout_claimed_at = $3
     WHERE id = $1`,
    [intent.id, oldTimestamp, freshClaimTimestamp]
  );

  const skipped = await expireStalePurchaseIntents({
    olderThanMs: 24 * 60 * 60 * 1000,
    now: runAt
  });
  assert.equal(skipped.expired, 0);

  await query(
    `UPDATE wallet_purchase_intents
     SET checkout_claimed_at = $2
     WHERE id = $1`,
    [intent.id, staleClaimTimestamp]
  );
  const expired = await expireStalePurchaseIntents({
    olderThanMs: 24 * 60 * 60 * 1000,
    now: runAt
  });
  assert.equal(expired.expired, 1);
  assert.equal(expired.expiredIntents[0].id, intent.id);
});
