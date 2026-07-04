import { query, withTransaction } from '../db.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';
import {
  grantCurrency,
  spendCurrency,
  WALLET_CURRENCY_CODE
} from './wallet-service.js';
import {
  getRuntimeAssetById,
  parsePortraitAssetId
} from './asset-service.js';

function jsonText(value) {
  return JSON.stringify(value || {});
}

function normalizeActor(actorId) {
  const value = String(actorId || '').trim();
  if (!value) throw new Error('Support actor is required');
  return value;
}

function normalizeNote(note = '') {
  return String(note || '').trim();
}

function normalizeReason(reason = '') {
  return String(reason || '').trim() || 'support_action';
}

function normalizeEvidence(evidence = {}) {
  return evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? evidence : {};
}

function normalizeAssetInstanceId(assetInstanceId) {
  const value = String(assetInstanceId || '').trim();
  return value || null;
}

function rowToSupportAction(row) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actionType: row.action_type,
    playerId: row.player_id || null,
    targetType: row.target_type,
    targetId: row.target_id || null,
    status: row.status,
    reason: row.reason || null,
    note: row.note || '',
    evidence: parseJson(row.evidence_json, {}),
    result: parseJson(row.result_json, {}),
    createdAt: row.created_at
  };
}

async function insertSupportAction(client, {
  id,
  actorId,
  actionType,
  playerId = null,
  targetType,
  targetId = null,
  status,
  reason = null,
  note = '',
  evidence = {},
  result = {}
}) {
  await client.query(
    `INSERT INTO support_actions
     (id, actor_id, action_type, player_id, target_type, target_id, status,
      reason, note, evidence_json, result_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      actorId,
      actionType,
      playerId,
      targetType,
      targetId,
      status,
      reason,
      note,
      jsonText(evidence),
      jsonText(result),
      nowIso()
    ]
  );
  const inserted = await client.query(`SELECT * FROM support_actions WHERE id = $1`, [id]);
  return rowToSupportAction(inserted.rows[0]);
}

async function assetInstanceByStatus(client, playerId, assetId, status) {
  const existing = await client.query(
    `SELECT *
     FROM player_asset_instances
     WHERE player_id = $1
       AND asset_id = $2
       AND status = $3
     ORDER BY acquired_at DESC
     LIMIT 1`,
    [playerId, assetId, status]
  );
  return existing.rows[0] || null;
}

async function activeAssetInstance(client, playerId, assetId) {
  return assetInstanceByStatus(client, playerId, assetId, 'active');
}

async function assetInstanceById(client, playerId, assetInstanceId) {
  const existing = await client.query(
    `SELECT *
     FROM player_asset_instances
     WHERE id = $1
       AND player_id = $2
     LIMIT 1`,
    [assetInstanceId, playerId]
  );
  return existing.rows[0] || null;
}

function rowToAssetInstance(row) {
  if (!row) return null;
  return {
    id: row.id,
    playerId: row.player_id,
    assetId: row.asset_id,
    acquisitionSource: row.acquisition_source,
    acquisitionSourceId: row.acquisition_source_id || null,
    status: row.status,
    acquiredAt: row.acquired_at,
    metadata: parseJson(row.metadata_json, {})
  };
}

async function resolveSupportAssetTarget(client, {
  playerId,
  assetId,
  assetInstanceId,
  actionName
}) {
  const normalizedInstanceId = normalizeAssetInstanceId(assetInstanceId);
  let resolvedAssetId = String(assetId || '').trim();
  let requestedInstance = null;

  if (normalizedInstanceId) {
    requestedInstance = await assetInstanceById(client, playerId, normalizedInstanceId);
    if (!requestedInstance) throw new Error('Unknown asset instance');
    if (resolvedAssetId && requestedInstance.asset_id !== resolvedAssetId) {
      throw new Error('Asset instance must match assetId');
    }
    resolvedAssetId = requestedInstance.asset_id;
  }

  if (!resolvedAssetId) {
    throw new Error(`Support asset ${actionName} requires assetId or assetInstanceId`);
  }

  const asset = await getRuntimeAssetById(resolvedAssetId, { client });
  if (!asset) throw new Error('Unknown asset');

  return {
    asset,
    assetInstanceId: normalizedInstanceId,
    requestedInstance
  };
}

function supportAssetActionTarget(asset, assetInstanceId) {
  return assetInstanceId
    ? { targetType: 'asset_instance', targetId: assetInstanceId }
    : { targetType: 'asset', targetId: asset.assetId };
}

async function resetDisabledPortraitEquipment(client, playerId, asset, assetInstanceId = null) {
  if (asset?.slot !== 'portrait' || asset?.targetType !== 'character') return null;
  const parsed = parsePortraitAssetId(asset.assetId);
  const targetId = asset.targetId || parsed?.mushroomId || null;
  if (!targetId) return null;
  const defaultAssetId = `portrait.${targetId}.default`;
  const now = nowIso();
  if (assetInstanceId) {
    const matchingEquipment = await client.query(
      `SELECT id FROM player_equipped_assets
       WHERE player_id = $1
         AND slot = 'portrait'
         AND target_type = 'character'
         AND target_id = $2
         AND asset_id = $3
         AND asset_instance_id = $4
       LIMIT 1`,
      [playerId, targetId, asset.assetId, assetInstanceId]
    );
    if (!matchingEquipment.rowCount) return null;
  }
  const params = [playerId, targetId, defaultAssetId, now, asset.assetId];
  const instanceClause = assetInstanceId ? 'AND asset_instance_id = $6' : '';
  if (assetInstanceId) params.push(assetInstanceId);
  await client.query(
    `UPDATE player_equipped_assets
     SET asset_instance_id = NULL,
         asset_id = $3,
         equipped_at = $4
     WHERE player_id = $1
       AND slot = 'portrait'
       AND target_type = 'character'
       AND target_id = $2
       AND asset_id = $5
       ${instanceClause}`,
    params
  );
  await client.query(
    `UPDATE player_mushrooms
     SET active_portrait = 'default'
     WHERE player_id = $1
       AND mushroom_id = $2
       AND active_portrait = $3`,
    [playerId, targetId, asset.variantId || parsed?.variantId || '']
  );
  return { slot: 'portrait', targetId, assetId: defaultAssetId };
}

async function updatePurchaseIntentSupportMetadata(client, intentRow, {
  status,
  evidence,
  supportActionId,
  clawback
}) {
  const updatedAt = nowIso();
  const currentMetadata = parseJson(intentRow.metadata_json, {});
  const updated = await client.query(
    `UPDATE wallet_purchase_intents
     SET status = $2,
         updated_at = $3,
         metadata_json = $4
     WHERE id = $1
     RETURNING *`,
    [
      intentRow.id,
      status,
      updatedAt,
      jsonText({
        ...currentMetadata,
        providerStatus: {
          status,
          receivedAt: updatedAt,
          payload: evidence
        },
        supportAction: {
          id: supportActionId,
          recordedAt: updatedAt
        },
        ...(clawback ? { clawback } : {})
      })
    ]
  );
  return updated.rows[0];
}

export async function supportAdjustWallet({
  actorId,
  playerId,
  amount,
  direction = 'grant',
  reason,
  note = '',
  evidence = {}
} = {}) {
  const actor = normalizeActor(actorId);
  const value = Number(amount);
  if (!playerId) throw new Error('Support wallet action requires playerId');
  if (!Number.isInteger(value) || value <= 0) throw new Error('Support wallet amount must be a positive integer');
  const normalizedDirection = direction === 'revoke' ? 'revoke' : 'grant';
  const actionId = createId('support');
  const actionType = normalizedDirection === 'revoke' ? 'wallet_revoke' : 'wallet_grant';
  const actionReason = normalizeReason(reason);
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);

  return withTransaction(async (client) => {
    const transaction = normalizedDirection === 'revoke'
      ? await spendCurrency(client, {
        playerId,
        currencyCode: WALLET_CURRENCY_CODE,
        amount: value,
        reason: 'support_wallet_revoke',
        sourceType: 'support_action',
        sourceId: actionId,
        idempotencyKey: `support:${actionId}`,
        metadata: { reason: actionReason, note: actionNote, evidence: actionEvidence }
      })
      : await grantCurrency(client, {
        playerId,
        currencyCode: WALLET_CURRENCY_CODE,
        amount: value,
        reason: 'support_wallet_grant',
        sourceType: 'support_action',
        sourceId: actionId,
        idempotencyKey: `support:${actionId}`,
        metadata: { reason: actionReason, note: actionNote, evidence: actionEvidence }
      });

    const action = await insertSupportAction(client, {
      id: actionId,
      actorId: actor,
      actionType,
      playerId,
      targetType: 'wallet',
      targetId: WALLET_CURRENCY_CODE,
      status: 'applied',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { transaction }
    });
    return { action, transaction };
  });
}

export async function supportGrantAsset({
  actorId,
  playerId,
  assetId,
  reason,
  note = '',
  evidence = {}
} = {}) {
  const actor = normalizeActor(actorId);
  if (!playerId) throw new Error('Support asset grant requires playerId');
  const actionId = createId('support');
  const actionReason = normalizeReason(reason);
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);

  return withTransaction(async (client) => {
    const asset = await getRuntimeAssetById(assetId, { client });
    if (!asset) throw new Error('Unknown asset');
    const existing = await activeAssetInstance(client, playerId, asset.assetId);
    let instance = rowToAssetInstance(existing);
    let alreadyOwned = Boolean(existing);
    if (!existing) {
      const now = nowIso();
      const instanceId = createId('asset');
      await client.query(
        `INSERT INTO player_asset_instances
         (id, player_id, asset_id, acquisition_source, acquisition_source_id, status, acquired_at, metadata_json)
         VALUES ($1, $2, $3, 'support_grant', $4, 'active', $5, $6)`,
        [
          instanceId,
          playerId,
          asset.assetId,
          actionId,
          now,
          jsonText({ reason: actionReason, supportActionId: actionId })
        ]
      );
      const inserted = await client.query(`SELECT * FROM player_asset_instances WHERE id = $1`, [instanceId]);
      instance = rowToAssetInstance(inserted.rows[0]);
      alreadyOwned = false;
    }

    const action = await insertSupportAction(client, {
      id: actionId,
      actorId: actor,
      actionType: 'asset_grant',
      playerId,
      targetType: 'asset',
      targetId: asset.assetId,
      status: alreadyOwned ? 'noop' : 'applied',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { assetId: asset.assetId, instance, alreadyOwned }
    });
    return { action, asset, instance, alreadyOwned };
  });
}

export async function supportRevokeAsset({
  actorId,
  playerId,
  assetId,
  assetInstanceId,
  reason,
  note = '',
  evidence = {}
} = {}) {
  const actor = normalizeActor(actorId);
  if (!playerId) throw new Error('Support asset revoke requires playerId');
  const actionId = createId('support');
  const actionReason = normalizeReason(reason);
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);

  return withTransaction(async (client) => {
    const target = await resolveSupportAssetTarget(client, {
      playerId,
      assetId,
      assetInstanceId,
      actionName: 'revoke'
    });
    const { asset } = target;
    const actionTarget = supportAssetActionTarget(asset, target.assetInstanceId);
    const requestedInstance = target.requestedInstance;
    const existing = requestedInstance
      ? (['active', 'frozen'].includes(requestedInstance.status) ? requestedInstance : null)
      : await activeAssetInstance(client, playerId, asset.assetId)
        || await assetInstanceByStatus(client, playerId, asset.assetId, 'frozen');
    let revoked = null;
    let resetEquipment = null;
    if (existing) {
      await client.query(
        `UPDATE player_asset_instances
         SET status = 'revoked',
             metadata_json = $2
         WHERE id = $1
           AND status = $3`,
        [
          existing.id,
          jsonText({
            ...parseJson(existing.metadata_json, {}),
            revokedBySupportActionId: actionId,
            revokedReason: actionReason,
            revokedAt: nowIso(),
            revokedPreviousStatus: existing.status
          }),
          existing.status
        ]
      );
      const updated = await client.query(`SELECT * FROM player_asset_instances WHERE id = $1`, [existing.id]);
      revoked = rowToAssetInstance(updated.rows[0]);
      resetEquipment = await resetDisabledPortraitEquipment(
        client,
        playerId,
        asset,
        target.assetInstanceId ? existing.id : null
      );
    }

    const action = await insertSupportAction(client, {
      id: actionId,
      actorId: actor,
      actionType: 'asset_revoke',
      playerId,
      targetType: actionTarget.targetType,
      targetId: actionTarget.targetId,
      status: revoked ? 'applied' : 'noop',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: {
        assetId: asset.assetId,
        assetInstanceId: target.assetInstanceId || revoked?.id || null,
        requestedInstance: rowToAssetInstance(requestedInstance),
        revoked,
        resetEquipment
      }
    });
    return { action, asset, revoked, resetEquipment };
  });
}

export async function supportFreezeAsset({
  actorId,
  playerId,
  assetId,
  assetInstanceId,
  reason,
  note = '',
  evidence = {}
} = {}) {
  const actor = normalizeActor(actorId);
  if (!playerId) throw new Error('Support asset freeze requires playerId');
  const actionId = createId('support');
  const actionReason = normalizeReason(reason || 'support_asset_freeze');
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);

  return withTransaction(async (client) => {
    const target = await resolveSupportAssetTarget(client, {
      playerId,
      assetId,
      assetInstanceId,
      actionName: 'freeze'
    });
    const { asset } = target;
    const actionTarget = supportAssetActionTarget(asset, target.assetInstanceId);
    const requestedInstance = target.requestedInstance;
    const existing = requestedInstance
      ? (requestedInstance.status === 'active' ? requestedInstance : null)
      : await activeAssetInstance(client, playerId, asset.assetId);
    const existingFrozen = requestedInstance
      ? (requestedInstance.status === 'frozen' ? requestedInstance : null)
      : existing ? null : await assetInstanceByStatus(client, playerId, asset.assetId, 'frozen');
    let frozen = null;
    let resetEquipment = null;
    if (existing) {
      await client.query(
        `UPDATE player_asset_instances
         SET status = 'frozen',
             metadata_json = $2
         WHERE id = $1
           AND status = 'active'`,
        [
          existing.id,
          jsonText({
            ...parseJson(existing.metadata_json, {}),
            frozenBySupportActionId: actionId,
            frozenReason: actionReason,
            frozenAt: nowIso()
          })
        ]
      );
      const updated = await client.query(`SELECT * FROM player_asset_instances WHERE id = $1`, [existing.id]);
      frozen = rowToAssetInstance(updated.rows[0]);
      resetEquipment = await resetDisabledPortraitEquipment(
        client,
        playerId,
        asset,
        target.assetInstanceId ? existing.id : null
      );
    }

    const action = await insertSupportAction(client, {
      id: actionId,
      actorId: actor,
      actionType: 'asset_freeze',
      playerId,
      targetType: actionTarget.targetType,
      targetId: actionTarget.targetId,
      status: frozen ? 'applied' : 'noop',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: {
        assetId: asset.assetId,
        assetInstanceId: target.assetInstanceId || frozen?.id || existingFrozen?.id || null,
        requestedInstance: rowToAssetInstance(requestedInstance),
        frozen: frozen || rowToAssetInstance(existingFrozen),
        alreadyFrozen: Boolean(existingFrozen),
        resetEquipment
      }
    });
    return {
      action,
      asset,
      frozen: frozen || rowToAssetInstance(existingFrozen),
      alreadyFrozen: Boolean(existingFrozen),
      resetEquipment
    };
  });
}

export async function supportUnfreezeAsset({
  actorId,
  playerId,
  assetId,
  assetInstanceId,
  reason,
  note = '',
  evidence = {}
} = {}) {
  const actor = normalizeActor(actorId);
  if (!playerId) throw new Error('Support asset unfreeze requires playerId');
  const actionId = createId('support');
  const actionReason = normalizeReason(reason || 'support_asset_unfreeze');
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);

  return withTransaction(async (client) => {
    const target = await resolveSupportAssetTarget(client, {
      playerId,
      assetId,
      assetInstanceId,
      actionName: 'unfreeze'
    });
    const { asset } = target;
    const actionTarget = supportAssetActionTarget(asset, target.assetInstanceId);
    const requestedInstance = target.requestedInstance;
    const active = requestedInstance
      ? (requestedInstance.status === 'active' ? requestedInstance : null)
      : await activeAssetInstance(client, playerId, asset.assetId);
    const existing = requestedInstance
      ? (requestedInstance.status === 'frozen' ? requestedInstance : null)
      : active ? null : await assetInstanceByStatus(client, playerId, asset.assetId, 'frozen');
    let unfrozen = rowToAssetInstance(active);
    let alreadyActive = Boolean(active);
    if (existing) {
      await client.query(
        `UPDATE player_asset_instances
         SET status = 'active',
             metadata_json = $2
         WHERE id = $1
           AND status = 'frozen'`,
        [
          existing.id,
          jsonText({
            ...parseJson(existing.metadata_json, {}),
            unfrozenBySupportActionId: actionId,
            unfrozenReason: actionReason,
            unfrozenAt: nowIso()
          })
        ]
      );
      const updated = await client.query(`SELECT * FROM player_asset_instances WHERE id = $1`, [existing.id]);
      unfrozen = rowToAssetInstance(updated.rows[0]);
      alreadyActive = false;
    }

    const action = await insertSupportAction(client, {
      id: actionId,
      actorId: actor,
      actionType: 'asset_unfreeze',
      playerId,
      targetType: actionTarget.targetType,
      targetId: actionTarget.targetId,
      status: existing ? 'applied' : 'noop',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: {
        assetId: asset.assetId,
        assetInstanceId: target.assetInstanceId || unfrozen?.id || null,
        requestedInstance: rowToAssetInstance(requestedInstance),
        unfrozen,
        alreadyActive
      }
    });
    return { action, asset, unfrozen, alreadyActive };
  });
}

export async function supportMarkPurchaseRefunded({
  actorId,
  intentId,
  reason,
  note = '',
  evidence = {},
  clawback = true
} = {}) {
  const actor = normalizeActor(actorId);
  if (!intentId) throw new Error('Support refund action requires intentId');
  const actionId = createId('support');
  const actionReason = normalizeReason(reason || 'support_refund');
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);

  return withTransaction(async (client) => {
    const lookup = await client.query(`SELECT * FROM wallet_purchase_intents WHERE id = $1`, [intentId]);
    if (!lookup.rowCount) throw new Error('Unknown wallet purchase intent');
    const intent = lookup.rows[0];
    let transaction = null;
    let clawbackResult = null;

    if (intent.status === 'completed' && clawback) {
      try {
        transaction = await spendCurrency(client, {
          playerId: intent.player_id,
          currencyCode: intent.currency_code,
          amount: Number(intent.wallet_amount || 0),
          reason: 'wallet_purchase_reversal',
          sourceType: 'wallet_purchase_intent',
          sourceId: intent.id,
          idempotencyKey: `wallet_purchase_reversal:${intent.id}:support:${actionId}`,
          metadata: {
            provider: intent.provider,
            status: 'refunded',
            supportActionId: actionId,
            providerInvoiceId: intent.provider_invoice_id,
            providerPaymentId: intent.provider_payment_id,
            evidence: actionEvidence
          }
        });
        clawbackResult = { status: 'completed', transactionId: transaction.id };
      } catch (err) {
        if (err?.message !== 'Not enough wallet balance') throw err;
        clawbackResult = { status: 'insufficient_balance', reason: err.message };
      }
    } else if (intent.status === 'completed') {
      clawbackResult = { status: 'skipped' };
    }

    const updatedIntent = intent.status === 'refunded'
      ? intent
      : await updatePurchaseIntentSupportMetadata(client, intent, {
        status: 'refunded',
        evidence: actionEvidence,
        supportActionId: actionId,
        clawback: clawbackResult
      });
    const supportRequired = clawbackResult?.status === 'insufficient_balance' || !clawback;
    const action = await insertSupportAction(client, {
      id: actionId,
      actorId: actor,
      actionType: 'purchase_refund',
      playerId: intent.player_id,
      targetType: 'wallet_purchase_intent',
      targetId: intent.id,
      status: intent.status === 'refunded' ? 'noop' : 'applied',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: {
        intentId: intent.id,
        previousStatus: intent.status,
        nextStatus: updatedIntent.status || 'refunded',
        transaction,
        clawback: clawbackResult,
        supportRequired
      }
    });
    return {
      action,
      intent: {
        id: updatedIntent.id,
        playerId: updatedIntent.player_id,
        status: updatedIntent.status,
        provider: updatedIntent.provider,
        providerInvoiceId: updatedIntent.provider_invoice_id || null,
        providerPaymentId: updatedIntent.provider_payment_id || null
      },
      transaction,
      clawback: clawbackResult,
      supportRequired
    };
  });
}

export async function listSupportActions({ playerId = null, targetType = null, targetId = null, limit = 25 } = {}) {
  const rowLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const clauses = [];
  const params = [];
  if (playerId) {
    params.push(playerId);
    clauses.push(`player_id = $${params.length}`);
  }
  if (targetType) {
    params.push(targetType);
    clauses.push(`target_type = $${params.length}`);
  }
  if (targetId) {
    params.push(targetId);
    clauses.push(`target_id = $${params.length}`);
  }
  params.push(rowLimit);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT *
     FROM support_actions
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(rowToSupportAction);
}
