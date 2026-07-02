import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, freshDb } from './helpers.js';
import { query } from '../../app/server/db.js';
import {
  createPurchaseIntent,
  getWalletState,
  processProviderWebhookEvent,
  reconcileWalletPayments
} from '../../app/server/services/wallet-service.js';
import {
  equipAsset,
  getPlayerCosmeticState,
  portraitAssetId
} from '../../app/server/services/asset-service.js';
import { lookupMoneySupportRecords } from '../../app/server/services/support-money-service.js';
import {
  listSupportActions,
  supportAdjustWallet,
  supportFreezeAsset,
  supportGrantAsset,
  supportMarkPurchaseRefunded,
  supportRevokeAsset,
  supportUnfreezeAsset
} from '../../app/server/services/support-ops-service.js';

test('[Req 4-Z] support wallet grant and revoke create immutable audit actions', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4701 });

  const grant = await supportAdjustWallet({
    actorId: 'support-agent',
    playerId: player.id,
    amount: 250,
    direction: 'grant',
    reason: 'failed_checkout_compensation',
    note: 'Manual compensation after provider callback delay',
    evidence: { ticket: 'SUP-1' }
  });
  assert.equal(grant.action.status, 'applied');
  assert.equal(grant.transaction.delta, 250);
  assert.equal((await getWalletState(player.id)).balance, 250);

  const revoke = await supportAdjustWallet({
    actorId: 'support-agent',
    playerId: player.id,
    amount: 50,
    direction: 'revoke',
    reason: 'mistaken_grant',
    note: 'Revoke excess compensation',
    evidence: { ticket: 'SUP-2' }
  });
  assert.equal(revoke.action.status, 'applied');
  assert.equal(revoke.transaction.delta, -50);
  assert.equal((await getWalletState(player.id)).balance, 200);

  const actions = await listSupportActions({ playerId: player.id });
  assert.equal(actions.length, 2);
  assert.deepEqual(actions.map((action) => action.actionType).sort(), ['wallet_grant', 'wallet_revoke']);

  const lookup = await lookupMoneySupportRecords({ query: grant.action.id, limit: 10 });
  assert.ok(lookup.supportActions.some((action) => action.id === grant.action.id));
  assert.ok(lookup.walletTransactions.some((tx) => tx.sourceId === grant.action.id));
});

test('[Req 4-Z, 14-F] support asset grant and revoke audit ownership changes', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4702 });
  const assetId = portraitAssetId('axilin', '1');

  const grant = await supportGrantAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'event_reward',
    note: 'Grant event portrait',
    evidence: { ticket: 'SUP-3' }
  });
  assert.equal(grant.action.status, 'applied');
  assert.equal(grant.instance.assetId, assetId);

  await equipAsset(player.id, assetId);
  const revoke = await supportRevokeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'mistaken_asset_grant',
    note: 'Wrong account',
    evidence: { ticket: 'SUP-4' }
  });
  assert.equal(revoke.action.status, 'applied');
  assert.equal(revoke.revoked.status, 'revoked');
  assert.equal(revoke.resetEquipment.assetId, portraitAssetId('axilin', 'default'));

  const active = await query(
    `SELECT * FROM player_asset_instances
     WHERE player_id = $1 AND asset_id = $2 AND status = 'active'`,
    [player.id, assetId]
  );
  assert.equal(active.rowCount, 0);
  const equipped = await query(
    `SELECT asset_id FROM player_equipped_assets
     WHERE player_id = $1 AND slot = 'portrait' AND target_id = 'axilin'`,
    [player.id]
  );
  assert.equal(equipped.rows[0].asset_id, portraitAssetId('axilin', 'default'));
});

test('[Req 4-Z, 14-F] support can freeze, unfreeze, and revoke disputed assets', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4704 });
  const assetId = portraitAssetId('axilin', '1');

  await supportGrantAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'event_reward',
    evidence: { ticket: 'SUP-6' }
  });
  await equipAsset(player.id, assetId);

  const freeze = await supportFreezeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'payment_dispute_opened',
    note: 'Pause asset while provider dispute is reviewed',
    evidence: { ticket: 'SUP-7', providerDisputeId: 'dispute-1' }
  });
  assert.equal(freeze.action.status, 'applied');
  assert.equal(freeze.action.actionType, 'asset_freeze');
  assert.equal(freeze.frozen.status, 'frozen');
  assert.equal(freeze.frozen.metadata.frozenReason, 'payment_dispute_opened');
  assert.equal(freeze.resetEquipment.assetId, portraitAssetId('axilin', 'default'));

  const activeAfterFreeze = await query(
    `SELECT * FROM player_asset_instances
     WHERE player_id = $1 AND asset_id = $2 AND status = 'active'`,
    [player.id, assetId]
  );
  assert.equal(activeAfterFreeze.rowCount, 0);
  const stateAfterFreeze = await getPlayerCosmeticState(player.id);
  assert.equal(stateAfterFreeze.ownedAssetIds.has(assetId), false);
  const equippedAfterFreeze = await query(
    `SELECT asset_id FROM player_equipped_assets
     WHERE player_id = $1 AND slot = 'portrait' AND target_id = 'axilin'`,
    [player.id]
  );
  assert.equal(equippedAfterFreeze.rows[0].asset_id, portraitAssetId('axilin', 'default'));

  const duplicateFreeze = await supportFreezeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'payment_dispute_still_open',
    evidence: { ticket: 'SUP-8' }
  });
  assert.equal(duplicateFreeze.action.status, 'noop');
  assert.equal(duplicateFreeze.alreadyFrozen, true);
  assert.equal(duplicateFreeze.frozen.status, 'frozen');

  const unfreeze = await supportUnfreezeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'payment_dispute_resolved',
    note: 'Provider closed dispute in player favor',
    evidence: { ticket: 'SUP-9' }
  });
  assert.equal(unfreeze.action.status, 'applied');
  assert.equal(unfreeze.action.actionType, 'asset_unfreeze');
  assert.equal(unfreeze.unfrozen.status, 'active');
  assert.equal(unfreeze.alreadyActive, false);
  const stateAfterUnfreeze = await getPlayerCosmeticState(player.id);
  assert.equal(stateAfterUnfreeze.ownedAssetIds.has(assetId), true);
  await equipAsset(player.id, assetId);

  await supportFreezeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'chargeback_confirmed',
    evidence: { ticket: 'SUP-10' }
  });
  const revoke = await supportRevokeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'chargeback_asset_removal',
    evidence: { ticket: 'SUP-11' }
  });
  assert.equal(revoke.action.status, 'applied');
  assert.equal(revoke.revoked.status, 'revoked');
  assert.equal(revoke.revoked.metadata.revokedPreviousStatus, 'frozen');

  const finalRows = await query(
    `SELECT status FROM player_asset_instances
     WHERE player_id = $1 AND asset_id = $2
     ORDER BY acquired_at DESC`,
    [player.id, assetId]
  );
  assert.deepEqual(finalRows.rows.map((row) => row.status), ['revoked']);

  const actions = await listSupportActions({ playerId: player.id, targetType: 'asset', targetId: assetId });
  assert.deepEqual(
    actions.map((action) => action.actionType).sort(),
    ['asset_freeze', 'asset_freeze', 'asset_freeze', 'asset_grant', 'asset_revoke', 'asset_unfreeze']
  );
});

test('[Req 4-Z, 14-F] support can target disputed asset instances directly', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4705 });
  const assetId = portraitAssetId('axilin', '1');
  const grant = await supportGrantAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId,
    reason: 'event_reward',
    evidence: { ticket: 'SUP-12' }
  });
  const assetInstanceId = grant.instance.id;
  await equipAsset(player.id, assetId);

  const mismatch = supportFreezeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetId: portraitAssetId('lomie', '1'),
    assetInstanceId,
    reason: 'wrong_asset_reference',
    evidence: { ticket: 'SUP-13' }
  });
  await assert.rejects(mismatch, /must match assetId/);

  const freeze = await supportFreezeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetInstanceId,
    reason: 'instance_dispute_opened',
    evidence: { ticket: 'SUP-14' }
  });
  assert.equal(freeze.action.status, 'applied');
  assert.equal(freeze.action.targetType, 'asset_instance');
  assert.equal(freeze.action.targetId, assetInstanceId);
  assert.equal(freeze.action.result.assetId, assetId);
  assert.equal(freeze.action.result.assetInstanceId, assetInstanceId);
  assert.equal(freeze.frozen.id, assetInstanceId);
  assert.equal(freeze.resetEquipment.assetId, portraitAssetId('axilin', 'default'));

  const instanceLookup = await lookupMoneySupportRecords({ query: assetInstanceId, limit: 10 });
  assert.ok(instanceLookup.assetInstances.some((row) => row.id === assetInstanceId));
  assert.ok(instanceLookup.supportActions.some((action) => action.id === freeze.action.id));

  const unfreeze = await supportUnfreezeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetInstanceId,
    reason: 'instance_dispute_resolved',
    evidence: { ticket: 'SUP-15' }
  });
  assert.equal(unfreeze.action.status, 'applied');
  assert.equal(unfreeze.action.targetType, 'asset_instance');
  assert.equal(unfreeze.unfrozen.id, assetInstanceId);
  assert.equal(unfreeze.unfrozen.status, 'active');

  await supportFreezeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetInstanceId,
    reason: 'instance_chargeback_confirmed',
    evidence: { ticket: 'SUP-16' }
  });
  const revoke = await supportRevokeAsset({
    actorId: 'support-agent',
    playerId: player.id,
    assetInstanceId,
    reason: 'instance_chargeback_removal',
    evidence: { ticket: 'SUP-17' }
  });
  assert.equal(revoke.action.status, 'applied');
  assert.equal(revoke.action.targetType, 'asset_instance');
  assert.equal(revoke.action.targetId, assetInstanceId);
  assert.equal(revoke.revoked.id, assetInstanceId);
  assert.equal(revoke.revoked.status, 'revoked');

  const instanceActions = await listSupportActions({
    playerId: player.id,
    targetType: 'asset_instance',
    targetId: assetInstanceId
  });
  assert.deepEqual(
    instanceActions.map((action) => action.actionType).sort(),
    ['asset_freeze', 'asset_freeze', 'asset_revoke', 'asset_unfreeze']
  );
});

test('[Req 4-Z] support can mark a completed purchase refunded with audit evidence', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4703 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'support-refund-intent'
  });
  const payload = {
    deliveryId: 'support-refund-settled',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'support-refund-payment'
  };
  await processProviderWebhookEvent('btcpay', payload, { rawBody: JSON.stringify(payload) });
  assert.equal((await getWalletState(player.id)).balance, 100);

  const refund = await supportMarkPurchaseRefunded({
    actorId: 'support-agent',
    intentId: intent.id,
    reason: 'manual_refund',
    note: 'Provider dashboard refund confirmed',
    evidence: { ticket: 'SUP-5', providerRefundId: 'refund-1' }
  });
  assert.equal(refund.action.status, 'applied');
  assert.equal(refund.intent.status, 'refunded');
  assert.equal(refund.clawback.status, 'completed');
  assert.equal(refund.transaction.delta, -100);
  assert.equal((await getWalletState(player.id)).balance, 0);

  const report = await reconcileWalletPayments({ limit: 10 });
  assert.equal(report.ok, true);
  assert.equal(report.total, 0);
  const lookup = await lookupMoneySupportRecords({ query: intent.id, limit: 10 });
  assert.ok(lookup.supportActions.some((action) => action.id === refund.action.id));
});
