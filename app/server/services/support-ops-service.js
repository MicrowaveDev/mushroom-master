import { createMushroomSupportOpsServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/economy';
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

async function recordSupportAction(client, {
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
  const createdAt = nowIso();
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
      JSON.stringify(evidence || {}),
      JSON.stringify(result || {}),
      createdAt
    ]
  );
  return {
    id,
    actorId,
    actionType,
    playerId,
    targetType,
    targetId,
    status,
    reason,
    note,
    evidence: evidence || {},
    result: result || {},
    createdAt
  };
}

const supportOpsServicePort = createMushroomSupportOpsServicePort({
  query,
  withTransaction,
  createId,
  nowIso,
  parseJson,
  grantCurrency,
  spendCurrency,
  walletCurrencyCode: WALLET_CURRENCY_CODE,
  getRuntimeAssetById,
  parsePortraitAssetId,
  recordSupportAction
});

export const {
  supportAdjustWallet,
  supportGrantAsset,
  supportRevokeAsset,
  supportFreezeAsset,
  supportUnfreezeAsset,
  supportMarkPurchaseRefunded,
  listSupportActions
} = supportOpsServicePort;
