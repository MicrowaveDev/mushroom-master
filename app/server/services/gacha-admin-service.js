import fs from 'fs/promises';
import path from 'path';
import { createMushroomGachaAdminServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/economy';
import { repoRoot } from '../../shared/repo-root.js';
import { query, withTransaction } from '../db.js';
import { PORTRAIT_VARIANTS } from '../game-data.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';
import {
  getAssetCatalog,
  getRuntimeAssetCatalog,
  shapeAssetPack,
  validateAssetPack
} from './asset-service.js';
import { WALLET_CURRENCY_CODE } from './wallet-service.js';

function gachaPlanPublicRoot() {
  return process.env.GACHA_PLAN_PUBLIC_ROOT
    ? path.resolve(process.env.GACHA_PLAN_PUBLIC_ROOT)
    : path.join(repoRoot, 'web/public/gacha-plan');
}

async function writePlanImage({ seasonId, itemId, buffer, extension }) {
  const imagePath = `/gacha-plan/${seasonId}/${itemId}.${extension}`;
  const absolutePath = path.join(gachaPlanPublicRoot(), seasonId, `${itemId}.${extension}`);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return { imagePath };
}

async function deletePlanImage(imagePath) {
  const normalized = String(imagePath || '');
  if (!normalized.startsWith('/gacha-plan/')) return;
  const root = path.resolve(gachaPlanPublicRoot());
  const absolutePath = path.resolve(root, normalized.replace(/^\/gacha-plan\//, ''));
  if (!absolutePath.startsWith(`${root}${path.sep}`)) return;
  await fs.rm(absolutePath, { force: true }).catch(() => {});
}

async function recordAdminAction(client, {
  actorId,
  actionType,
  targetType,
  targetId,
  status,
  reason,
  note,
  evidence,
  result
}) {
  const id = createId('support');
  const createdAt = nowIso();
  await client.query(
    `INSERT INTO support_actions
     (id, actor_id, action_type, player_id, target_type, target_id, status,
      reason, note, evidence_json, result_json, created_at)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      actorId,
      actionType,
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
    playerId: null,
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

const gachaAdminServicePort = createMushroomGachaAdminServicePort({
  query,
  withTransaction,
  characterVariants: PORTRAIT_VARIANTS,
  createId,
  nowIso,
  parseJson,
  getAssetCatalog,
  getRuntimeAssetCatalog,
  shapeAssetPack,
  validateAssetPack,
  walletCurrencyCode: WALLET_CURRENCY_CODE,
  writePlanImage,
  deletePlanImage,
  recordAdminAction,
  env: process.env
});

export const {
  listGachaAdminCatalog,
  exportGachaAdminFixture,
  importGachaAdminFixture,
  createGachaPlanItem,
  updateGachaPlanItem,
  deleteGachaPlanItem,
  createGachaSeason,
  updateGachaSeason,
  createGachaCollection,
  updateGachaCollection,
  createGachaPack,
  updateGachaPack,
  createGachaPackItem,
  updateGachaPackItem,
  deleteGachaPackItem,
  replaceGachaPackItems,
  promoteGachaPlanItemsToPack,
  validateGachaAdminPack,
  previewGachaAdminPack,
  transitionGachaPack
} = gachaAdminServicePort;
