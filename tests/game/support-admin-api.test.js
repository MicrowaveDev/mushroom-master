import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../app/server/create-app.js';
import { createPlayer, freshDb } from './helpers.js';
import {
  createPurchaseIntent,
  getWalletState,
  processProviderWebhookEvent,
  reconcileWalletPayments
} from '../../app/server/services/wallet-service.js';
import { portraitAssetId } from '../../app/server/services/asset-service.js';

async function withEnv(overrides, work) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  try {
    return await work();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const supportHeaders = {
  authorization: 'Bearer support-test-token',
  'x-support-actor-id': 'support-agent-api'
};

test('[Req 4-Z] support admin API requires configured token and actor id', async () => {
  await freshDb();
  const app = await createApp();

  const missingConfig = await request(app)
    .get('/api/admin/support/actions')
    .set('x-support-actor-id', 'support-agent-api');
  assert.equal(missingConfig.status, 503);

  await withEnv({ SUPPORT_ADMIN_API_TOKEN: 'support-test-token' }, async () => {
    const missingToken = await request(app)
      .get('/api/admin/support/actions')
      .set('x-support-actor-id', 'support-agent-api');
    assert.equal(missingToken.status, 403);

    const missingActor = await request(app)
      .get('/api/admin/support/actions')
      .set('authorization', 'Bearer support-test-token');
    assert.equal(missingActor.status, 400);

    const ok = await request(app)
      .get('/api/admin/support/actions')
      .set(supportHeaders);
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.data, []);
  });
});

test('[Req 4-Z] support admin API can grant wallet currency and search support packet', async () => {
  await withEnv({ SUPPORT_ADMIN_API_TOKEN: 'support-test-token' }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4711 });
    const app = await createApp();

    const grant = await request(app)
      .post('/api/admin/support/actions/wallet-grant')
      .set(supportHeaders)
      .send({
        playerId: player.id,
        amount: 75,
        reason: 'api_compensation',
        note: 'Support API smoke grant',
        evidence: { ticket: 'SUP-API-1' }
      });
    assert.equal(grant.status, 200);
    assert.equal(grant.body.data.action.actorId, 'support-agent-api');
    assert.equal(grant.body.data.action.actionType, 'wallet_grant');
    assert.equal(grant.body.data.transaction.delta, 75);
    assert.equal((await getWalletState(player.id)).balance, 75);

    const packet = await request(app)
      .get('/api/admin/support/money-lookup')
      .set(supportHeaders)
      .query({ query: player.id, limit: 10 });
    assert.equal(packet.status, 200);
    assert.ok(packet.body.data.players.some((row) => row.id === player.id));
    assert.ok(packet.body.data.supportActions.some((row) => row.id === grant.body.data.action.id));
    assert.ok(packet.body.data.walletTransactions.some((row) => row.sourceId === grant.body.data.action.id));
  });
});

test('[Req 4-Z, 14-F] support admin API can grant and revoke assets', async () => {
  await withEnv({ SUPPORT_ADMIN_API_TOKEN: 'support-test-token' }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4712 });
    const app = await createApp();
    const assetId = portraitAssetId('axilin', '1');

    const grant = await request(app)
      .post('/api/admin/support/actions/asset-grant')
      .set(supportHeaders)
      .send({
        playerId: player.id,
        assetId,
        reason: 'api_event_reward',
        evidence: { ticket: 'SUP-API-2' }
      });
    assert.equal(grant.status, 200);
    assert.equal(grant.body.data.action.actionType, 'asset_grant');
    assert.equal(grant.body.data.instance.assetId, assetId);

    const revoke = await request(app)
      .post('/api/admin/support/actions/asset-revoke')
      .set(supportHeaders)
      .send({
        playerId: player.id,
        assetId,
        reason: 'api_event_reversal',
        evidence: { ticket: 'SUP-API-3' }
      });
    assert.equal(revoke.status, 200);
    assert.equal(revoke.body.data.action.actionType, 'asset_revoke');
    assert.equal(revoke.body.data.revoked.status, 'revoked');
  });
});

test('[Req 4-Z] support admin API can mark completed purchases refunded', async () => {
  await withEnv({ SUPPORT_ADMIN_API_TOKEN: 'support-test-token' }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4713 });
    const app = await createApp();
    const intent = await createPurchaseIntent(player.id, {
      bundleId: 'coins_small',
      provider: 'btcpay',
      surface: 'web',
      idempotencyKey: 'support-admin-api-refund'
    });
    const payload = {
      deliveryId: 'support-admin-api-refund-settled',
      type: 'InvoiceSettled',
      invoiceId: intent.providerInvoiceId,
      paymentId: 'support-admin-api-payment'
    };
    await processProviderWebhookEvent('btcpay', payload, { rawBody: JSON.stringify(payload) });
    assert.equal((await getWalletState(player.id)).balance, 100);

    const refund = await request(app)
      .post('/api/admin/support/actions/purchase-refund')
      .set(supportHeaders)
      .send({
        intentId: intent.id,
        reason: 'api_manual_refund',
        evidence: { ticket: 'SUP-API-4', providerRefundId: 'refund-api-1' }
      });
    assert.equal(refund.status, 200);
    assert.equal(refund.body.data.action.actionType, 'purchase_refund');
    assert.equal(refund.body.data.intent.status, 'refunded');
    assert.equal(refund.body.data.clawback.status, 'completed');
    assert.equal((await getWalletState(player.id)).balance, 0);
    assert.equal((await reconcileWalletPayments({ limit: 10 })).ok, true);
  });
});
