import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, freshDb } from './helpers.js';
import {
  createPurchaseIntent,
  grantCurrencyForPlayer,
  processProviderWebhookEvent
} from '../../app/server/services/wallet-service.js';
import {
  portraitAssetId,
  purchaseAsset
} from '../../app/server/services/asset-service.js';
import { lookupMoneySupportRecords } from '../../app/server/services/support-money-service.js';

test('[Req 4-Z] money support lookup resolves provider refs into wallet and asset context', async () => {
  await freshDb();
  const { player } = await createPlayer({
    telegramId: 4501,
    username: 'support_lookup'
  });
  await grantCurrencyForPlayer({
    playerId: player.id,
    amount: 1000,
    reason: 'support_lookup_seed',
    sourceType: 'test',
    sourceId: 'support-lookup-seed',
    idempotencyKey: 'support-lookup-seed'
  });
  const assetId = portraitAssetId('axilin', '1');
  await purchaseAsset(player.id, assetId, { idempotencyKey: 'support-lookup-asset' });

  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'support-lookup-intent'
  });
  const webhookPayload = {
    deliveryId: 'support-lookup-delivery',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'support-lookup-payment'
  };
  await processProviderWebhookEvent('btcpay', webhookPayload, {
    rawBody: JSON.stringify(webhookPayload)
  });

  const byInvoice = await lookupMoneySupportRecords({
    query: intent.providerInvoiceId,
    limit: 10
  });
  assert.equal(byInvoice.players[0].id, player.id);
  assert.equal(byInvoice.walletBalances[0].playerId, player.id);
  assert.ok(byInvoice.purchaseIntents.some((row) => row.id === intent.id));
  assert.ok(byInvoice.walletTransactions.some((row) => row.sourceId === intent.id && row.reason === 'wallet_purchase'));
  assert.ok(byInvoice.paymentWebhookEvents.some((row) => row.metadata.intentId === intent.id));
  assert.ok(byInvoice.assetInstances.some((row) => row.assetId === assetId));

  const byAsset = await lookupMoneySupportRecords({
    query: assetId,
    limit: 10
  });
  assert.ok(byAsset.assetInstances.some((row) => row.assetId === assetId));
  assert.ok(byAsset.purchaseIntents.some((row) => row.id === intent.id));
  assert.ok(byAsset.walletTransactions.some((row) => row.sourceId === 'support-lookup-seed'));
});
