import fs from 'fs/promises';
import path from 'path';
import {
  normalizeAssetGachaSimulationTrials,
  simulateAssetGachaPackOdds
} from '@microwavedev/backpack-game-core/modules/gacha/simulation';
import {
  DEFAULT_GACHA_ADMIN_FIXTURE_SCHEMA_VERSION,
  buildGachaAdminPackDraftDiff,
  catalogWithGachaAdminPlanRows,
  createGachaAdminReleaseChecklist,
  gachaAdminAssetPolicyRecommendationsFromChecklist,
  gachaAdminPlanAssetId,
  gachaAdminPlanCatalogAssetFromRow,
  gachaAdminPromotedPlanMetadata,
  gachaAdminPromotionPackItemMetadata,
  normalizeGachaAdminFixture,
  normalizeGachaAdminPlanItemIds,
  resolveGachaAdminPlanItemAssetContract,
  summarizeGachaAdminFixtureOperations,
  summarizeGachaAdminPlanItems
} from '@microwavedev/backpack-game-core/modules/gacha/admin-validation';
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

const SEASON_STATUSES = new Set(['draft', 'active', 'future', 'expired', 'disabled']);
const PACK_STATUSES = new Set(['active', 'future', 'expired', 'disabled']);
const REVIEW_STATUSES = new Set(['draft', 'in_review', 'approved', 'rejected']);
const PLAN_ITEM_STATUSES = new Set(['planned', 'ready', 'rejected', 'archived']);
const ASSET_RARITIES = new Set(['common', 'rare', 'epic', 'legendary', 'secret']);
const PLAN_IMAGE_MIME_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp']
]);
const GACHA_PLAN_TARGET_PER_CHARACTER = 5;
const MAX_GACHA_PLAN_IMAGE_BYTES = 1_500_000;
const ITEM_FIELDS = new Set(['asset_id', 'rarity', 'drop_weight', 'copy_limit', 'item_order', 'metadata_json']);
const GACHA_FIXTURE_SCHEMA_VERSION = DEFAULT_GACHA_ADMIN_FIXTURE_SCHEMA_VERSION;

function jsonText(value, fallback = {}) {
  if (value === undefined) return fallback === null ? null : JSON.stringify(fallback);
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback === null ? null : JSON.stringify(fallback);
    try {
      JSON.parse(trimmed);
    } catch {
      throw new Error('Gacha admin JSON field must be valid JSON');
    }
    return trimmed;
  }
  return JSON.stringify(value);
}

function requiredText(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function optionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function optionalDate(value, label) {
  const normalized = optionalText(value);
  if (!normalized) return null;
  if (Number.isNaN(new Date(normalized).getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
  return normalized;
}

function positiveInteger(value, label, fallback = null) {
  if ((value === undefined || value === null || value === '') && fallback !== null) return fallback;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) throw new Error(`${label} must be a positive integer`);
  return numeric;
}

function optionalPositiveInteger(value, label) {
  if (value === undefined || value === null || value === '') return null;
  return positiveInteger(value, label);
}

function normalizeRarity(value, fallback = 'common') {
  const normalized = String(value || fallback || '').trim();
  if (!ASSET_RARITIES.has(normalized)) throw new Error('Gacha plan item rarity is invalid');
  return normalized;
}

function normalizeStatus(value, allowed, label, fallback = null) {
  const normalized = String(value || fallback || '').trim();
  if (!allowed.has(normalized)) throw new Error(`${label} has invalid status`);
  return normalized;
}

function normalizeActor(actorId) {
  return requiredText(actorId, 'Gacha admin actor');
}

function normalizeEvidence(evidence = {}) {
  return evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? evidence : {};
}

function normalizeReason(reason, fallback = 'gacha_admin_action') {
  return String(reason || '').trim() || fallback;
}

function normalizeNote(note = '') {
  return String(note || '').trim();
}

function gachaAdminInputError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
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

function rowToSeason(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: parseJson(row.name_json, {}),
    status: row.status,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    metadata: parseJson(row.metadata_json, {}),
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToCollection(row) {
  if (!row) return null;
  return {
    id: row.id,
    seasonId: row.season_id,
    name: parseJson(row.name_json, {}),
    status: row.status,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    metadata: parseJson(row.metadata_json, {}),
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToPack(row) {
  if (!row) return null;
  return {
    id: row.id,
    seasonId: row.season_id,
    collectionId: row.collection_id,
    name: parseJson(row.name_json, {}),
    status: row.status,
    reviewStatus: row.review_status,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    rollPriceCurrencyCode: row.roll_price_currency_code,
    rollPriceAmount: Number(row.roll_price_amount),
    rollSize: Number(row.roll_size),
    rarityTableVersion: row.rarity_table_version || null,
    rarityWeights: parseJson(row.rarity_weights_json, null),
    slots: parseJson(row.slots_json, null),
    guarantees: parseJson(row.guarantees_json, null),
    pityRules: parseJson(row.pity_rules_json, null),
    duplicatePolicy: parseJson(row.duplicate_policy_json, null),
    burnRules: parseJson(row.burn_rules_json, null),
    metadata: parseJson(row.metadata_json, {}),
    createdBy: row.created_by || null,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToPackItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    packId: row.pack_id,
    assetId: row.asset_id,
    rarity: row.rarity,
    dropWeight: Number(row.drop_weight),
    copyLimit: row.copy_limit === null || row.copy_limit === undefined ? null : Number(row.copy_limit),
    itemOrder: Number(row.item_order || 0),
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToPlanItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    seasonId: row.season_id,
    characterId: row.character_id,
    assetId: row.asset_id,
    imagePath: row.image_path,
    fileName: row.file_name || null,
    mimeType: row.mime_type,
    rarity: row.rarity,
    dropWeight: Number(row.drop_weight),
    status: row.status,
    metadata: parseJson(row.metadata_json, {}),
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowPackToRuntimePack(row, itemRows = []) {
  const pack = {
    id: row.id,
    seasonId: row.season_id,
    collectionId: row.collection_id,
    name: parseJson(row.name_json, {}),
    status: row.status,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    rollPriceCurrencyCode: row.roll_price_currency_code,
    rollPriceAmount: Number(row.roll_price_amount),
    rollSize: Number(row.roll_size || 1),
    rarityTableVersion: row.rarity_table_version || `${row.id}:admin:${row.updated_at || row.created_at || 'v1'}`,
    reviewStatus: row.review_status,
    source: 'database',
    metadata: parseJson(row.metadata_json, {}),
    items: itemRows
      .sort((a, b) => Number(a.item_order || 0) - Number(b.item_order || 0) || String(a.id).localeCompare(String(b.id)))
      .map((item) => ({
        assetId: item.asset_id,
        rarity: item.rarity,
        dropWeight: Number(item.drop_weight),
        ...(item.copy_limit === null || item.copy_limit === undefined ? {} : { copyLimit: Number(item.copy_limit) }),
        metadata: parseJson(item.metadata_json, {})
      }))
  };
  const jsonFields = [
    ['rarityWeights', row.rarity_weights_json],
    ['slots', row.slots_json],
    ['guarantees', row.guarantees_json],
    ['pityRules', row.pity_rules_json],
    ['duplicatePolicy', row.duplicate_policy_json],
    ['burnRules', row.burn_rules_json]
  ];
  for (const [key, raw] of jsonFields) {
    const parsed = parseJson(raw, undefined);
    if (parsed !== undefined && parsed !== null) pack[key] = parsed;
  }
  return pack;
}

function catalogAssetOptions(catalog = getAssetCatalog()) {
  return catalog.map((asset) => ({
    assetId: asset.assetId,
    mushroomId: asset.mushroomId,
    portraitId: asset.portraitId,
    name: asset.name,
    rarity: asset.rarity,
    dropWeight: asset.dropWeight,
    price: asset.price,
    currencyCode: asset.currencyCode,
    acquisitionMode: asset.acquisitionMode,
    packId: asset.packId
  }));
}

function planCharacterOptions() {
  return Object.keys(PORTRAIT_VARIANTS).map((characterId) => ({
    id: characterId,
    label: characterId[0].toUpperCase() + characterId.slice(1)
  }));
}

function assertKnownCharacter(characterId) {
  const normalized = requiredText(characterId, 'Gacha plan item character');
  if (!PORTRAIT_VARIANTS[normalized]) throw new Error('Gacha plan item character is invalid');
  return normalized;
}

function gachaPlanPublicRoot() {
  return process.env.GACHA_PLAN_PUBLIC_ROOT
    ? path.resolve(process.env.GACHA_PLAN_PUBLIC_ROOT)
    : path.join(repoRoot, 'web/public/gacha-plan');
}

function safePathSegment(value, label) {
  const normalized = requiredText(value, label);
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) throw new Error(`${label} contains unsupported characters`);
  return normalized;
}

function assertImageSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    if (!buffer.subarray(0, 4).equals(png)) throw new Error('Gacha plan image data is invalid');
  }
  if (mimeType === 'image/jpeg') {
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) throw new Error('Gacha plan image data is invalid');
  }
  if (mimeType === 'image/webp') {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error('Gacha plan image data is invalid');
    }
  }
}

function decodePlanImage(imageData) {
  const raw = requiredText(imageData, 'Gacha plan imageData');
  const match = raw.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);
  if (!match) throw new Error('Gacha plan imageData must be a png, jpeg, or webp data URL');
  const mimeType = match[1];
  const extension = PLAN_IMAGE_MIME_EXTENSIONS.get(mimeType);
  if (!extension) throw new Error('Gacha plan image type is unsupported');
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new Error('Gacha plan image data is required');
  if (buffer.length > MAX_GACHA_PLAN_IMAGE_BYTES) {
    throw new Error(`Gacha plan image exceeds ${MAX_GACHA_PLAN_IMAGE_BYTES} bytes`);
  }
  assertImageSignature(buffer, mimeType);
  return { buffer, mimeType, extension };
}

function planAssetId(characterId, itemId) {
  return gachaAdminPlanAssetId(characterId, itemId);
}

async function writePlanImageFile({ seasonId, itemId, imageData }) {
  const { buffer, mimeType, extension } = decodePlanImage(imageData);
  const safeSeasonId = safePathSegment(seasonId, 'Gacha season id');
  const safeItemId = safePathSegment(itemId, 'Gacha plan item id');
  const relativePath = `/gacha-plan/${safeSeasonId}/${safeItemId}.${extension}`;
  const absolutePath = path.join(gachaPlanPublicRoot(), safeSeasonId, `${safeItemId}.${extension}`);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return { imagePath: relativePath, mimeType, absolutePath };
}

async function deletePlanImageFile(imagePath) {
  const normalized = String(imagePath || '');
  if (!normalized.startsWith('/gacha-plan/')) return;
  const root = gachaPlanPublicRoot();
  const absolutePath = path.resolve(root, normalized.replace(/^\/gacha-plan\//, ''));
  if (!absolutePath.startsWith(path.resolve(root) + path.sep)) return;
  await fs.rm(absolutePath, { force: true }).catch(() => {});
}

function planItemInsertPayload(payload = {}, actorId) {
  const now = nowIso();
  const id = optionalText(payload.id) || createId('gachaplan');
  const characterId = assertKnownCharacter(payload.characterId ?? payload.character_id);
  return {
    id,
    season_id: requiredText(payload.seasonId ?? payload.season_id, 'Gacha plan item seasonId'),
    character_id: characterId,
    asset_id: optionalText(payload.assetId ?? payload.asset_id) || planAssetId(characterId, id),
    image_path: requiredText(payload.imagePath ?? payload.image_path, 'Gacha plan item imagePath'),
    file_name: optionalText(payload.fileName ?? payload.file_name),
    mime_type: requiredText(payload.mimeType ?? payload.mime_type, 'Gacha plan item mimeType'),
    rarity: normalizeRarity(payload.rarity),
    drop_weight: positiveInteger(payload.dropWeight ?? payload.drop_weight, 'Gacha plan item dropWeight', 100),
    status: normalizeStatus(payload.status || 'planned', PLAN_ITEM_STATUSES, 'Gacha plan item'),
    metadata_json: jsonText(payload.metadata ?? payload.metadataJson, {}),
    created_by: actorId,
    created_at: now,
    updated_at: now
  };
}

function planItemUpdateFields(payload = {}) {
  const fields = {};
  if (payload.seasonId !== undefined || payload.season_id !== undefined) fields.season_id = requiredText(payload.seasonId ?? payload.season_id, 'Gacha plan item seasonId');
  if (payload.characterId !== undefined || payload.character_id !== undefined) fields.character_id = assertKnownCharacter(payload.characterId ?? payload.character_id);
  if (payload.assetId !== undefined || payload.asset_id !== undefined) fields.asset_id = requiredText(payload.assetId ?? payload.asset_id, 'Gacha plan item assetId');
  if (payload.rarity !== undefined) fields.rarity = normalizeRarity(payload.rarity);
  if (payload.dropWeight !== undefined || payload.drop_weight !== undefined) fields.drop_weight = positiveInteger(payload.dropWeight ?? payload.drop_weight, 'Gacha plan item dropWeight');
  if (payload.status !== undefined) fields.status = normalizeStatus(payload.status, PLAN_ITEM_STATUSES, 'Gacha plan item');
  if (payload.metadata !== undefined || payload.metadataJson !== undefined) fields.metadata_json = jsonText(payload.metadata ?? payload.metadataJson, {});
  return fields;
}

async function planAssetIdAvailable(client, assetId, itemId) {
  if (getAssetCatalog().some((asset) => asset.assetId === assetId)) {
    throw gachaAdminInputError('Gacha plan item generated assetId conflicts with an existing catalog asset');
  }
  const existingPlan = await client.query(
    `SELECT id FROM asset_gacha_plan_items
     WHERE asset_id = $1 AND id <> $2
     LIMIT 1`,
    [assetId, itemId]
  );
  if (existingPlan.rowCount) {
    throw gachaAdminInputError('Gacha plan item generated assetId conflicts with another plan item');
  }
  const existingPackItem = await client.query(
    `SELECT id FROM asset_gacha_pack_items
     WHERE asset_id = $1
     LIMIT 1`,
    [assetId]
  );
  if (existingPackItem.rowCount) {
    throw gachaAdminInputError('Gacha plan item generated assetId conflicts with an existing pack item');
  }
}

async function planItemHasPackLink(client, planRow) {
  const metadata = parseJson(planRow.metadata_json, {});
  if ((Array.isArray(metadata.promotedPackIds) && metadata.promotedPackIds.length) ||
    (metadata.promotedPackItemIds && typeof metadata.promotedPackItemIds === 'object' && Object.keys(metadata.promotedPackItemIds).length) ||
    metadata.lastPromotedPackId) {
    return true;
  }
  const linked = await client.query(
    `SELECT id FROM asset_gacha_pack_items
     WHERE asset_id = $1
     LIMIT 1`,
    [planRow.asset_id]
  );
  return linked.rowCount > 0;
}

async function applyPlanItemAssetContract(client, beforeRow, fields, payload = {}) {
  const characterChanging = fields.character_id && fields.character_id !== beforeRow.character_id;
  let result;
  try {
    result = resolveGachaAdminPlanItemAssetContract({
      beforeRow,
      fields,
      payload,
      hasPackLink: characterChanging ? await planItemHasPackLink(client, beforeRow) : false
    });
  } catch (err) {
    throw gachaAdminInputError(err.message);
  }
  if (result.assetIdToReserve) {
    await planAssetIdAvailable(client, result.assetIdToReserve, beforeRow.id);
  }
  for (const key of Object.keys(fields)) delete fields[key];
  Object.assign(fields, result.fields);
  return result.fields;
}

function summarizeGachaPlanItems(planItems = []) {
  const targetPerCharacter = Number(process.env.GACHA_PLAN_TARGET_PER_CHARACTER || GACHA_PLAN_TARGET_PER_CHARACTER);
  return summarizeGachaAdminPlanItems(planItems, {
    characterOptions: planCharacterOptions(),
    targetPerCharacter
  });
}

function createChecklist({ runtimePack, validation, seasonRow = null, collectionRow = null, catalog = getAssetCatalog() }) {
  return createGachaAdminReleaseChecklist({
    runtimePack,
    validation,
    seasonRow,
    collectionRow,
    catalog,
    currencyCode: WALLET_CURRENCY_CODE
  });
}

function normalizePreviewTrials(value) {
  return normalizeAssetGachaSimulationTrials(value, {
    defaultTrials: 1000,
    maxTrials: 100000
  });
}

function simulateRuntimePack(runtimePack, { trials = 1000, seed = null, catalog = getAssetCatalog() } = {}) {
  const trialCount = normalizePreviewTrials(trials);
  const seedValue = seed || `${runtimePack.id}:${runtimePack.updatedAt || runtimePack.rarityTableVersion || 'draft'}:${trialCount}`;
  return simulateAssetGachaPackOdds(runtimePack, {
    catalog,
    odds: { active: true },
    trials: trialCount,
    seed: seedValue,
    source: runtimePack.source || 'database',
    maxTrials: 100000
  });
}

async function draftDiffForPack(client, runtimePack) {
  const basePackId = runtimePack.metadata?.basePackId || runtimePack.metadata?.clonedFromPackId || null;
  if (!basePackId || basePackId === runtimePack.id) return null;
  const baseRow = await findOne(client, 'asset_gacha_packs', basePackId);
  if (!baseRow) {
    return buildGachaAdminPackDraftDiff({ draftPack: runtimePack, basePackId });
  }
  const baseRuntime = rowPackToRuntimePack(baseRow, await selectPackItems(client, basePackId));
  return buildGachaAdminPackDraftDiff({ basePack: baseRuntime, draftPack: runtimePack, basePackId });
}

async function insertAdminAction(client, {
  actorId,
  actionType,
  targetType,
  targetId,
  status = 'applied',
  reason = 'gacha_admin_action',
  note = '',
  evidence = {},
  result = {}
}) {
  const id = createId('support');
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
      nowIso()
    ]
  );
  const inserted = await client.query(`SELECT * FROM support_actions WHERE id = $1`, [id]);
  return rowToSupportAction(inserted.rows[0]);
}

async function findOne(client, table, id) {
  const result = await client.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] || null;
}

async function requireRow(client, table, id, label) {
  const row = await findOne(client, table, id);
  if (!row) throw new Error(`Unknown ${label}`);
  return row;
}

async function ensureIdUnused(client, table, id, label) {
  if (await findOne(client, table, id)) throw new Error(`${label} already exists`);
}

async function selectPackItems(client, packId) {
  const result = await client.query(
    `SELECT *
     FROM asset_gacha_pack_items
     WHERE pack_id = $1
     ORDER BY item_order ASC, id ASC`,
    [packId]
  );
  return result.rows;
}

async function validateCollectionSeason(client, seasonId, collectionId) {
  const collection = await requireRow(client, 'asset_gacha_collections', collectionId, 'gacha collection');
  if (collection.season_id !== seasonId) throw new Error('Gacha collection must belong to the selected season');
  return collection;
}

function seasonInsertPayload(payload = {}, actorId) {
  const now = nowIso();
  const id = requiredText(payload.id, 'Gacha season id');
  return {
    id,
    name_json: jsonText(payload.name ?? payload.nameJson, {}),
    status: normalizeStatus(payload.status || 'draft', SEASON_STATUSES, 'Gacha season'),
    starts_at: optionalDate(payload.startsAt ?? payload.starts_at, 'Gacha season startsAt'),
    ends_at: optionalDate(payload.endsAt ?? payload.ends_at, 'Gacha season endsAt'),
    metadata_json: jsonText(payload.metadata ?? payload.metadataJson, {}),
    created_by: actorId,
    created_at: now,
    updated_at: now
  };
}

function collectionInsertPayload(payload = {}, actorId) {
  const now = nowIso();
  return {
    id: requiredText(payload.id, 'Gacha collection id'),
    season_id: requiredText(payload.seasonId ?? payload.season_id, 'Gacha collection seasonId'),
    name_json: jsonText(payload.name ?? payload.nameJson, {}),
    status: normalizeStatus(payload.status || 'draft', SEASON_STATUSES, 'Gacha collection'),
    starts_at: optionalDate(payload.startsAt ?? payload.starts_at, 'Gacha collection startsAt'),
    ends_at: optionalDate(payload.endsAt ?? payload.ends_at, 'Gacha collection endsAt'),
    metadata_json: jsonText(payload.metadata ?? payload.metadataJson, {}),
    created_by: actorId,
    created_at: now,
    updated_at: now
  };
}

function packInsertPayload(payload = {}, actorId, {
  allowApproved = false,
  approvalError = 'Gacha pack approval must use a transition action'
} = {}) {
  const now = nowIso();
  const reviewStatus = normalizeStatus(payload.reviewStatus || payload.review_status || 'draft', REVIEW_STATUSES, 'Gacha pack review');
  if (reviewStatus === 'approved' && !allowApproved) throw new Error(approvalError);
  return {
    id: requiredText(payload.id, 'Gacha pack id'),
    season_id: requiredText(payload.seasonId ?? payload.season_id, 'Gacha pack seasonId'),
    collection_id: requiredText(payload.collectionId ?? payload.collection_id, 'Gacha pack collectionId'),
    name_json: jsonText(payload.name ?? payload.nameJson, {}),
    status: normalizeStatus(payload.status || 'disabled', PACK_STATUSES, 'Gacha pack'),
    review_status: reviewStatus,
    starts_at: optionalDate(payload.startsAt ?? payload.starts_at, 'Gacha pack startsAt'),
    ends_at: optionalDate(payload.endsAt ?? payload.ends_at, 'Gacha pack endsAt'),
    roll_price_currency_code: optionalText(payload.rollPriceCurrencyCode ?? payload.roll_price_currency_code) || WALLET_CURRENCY_CODE,
    roll_price_amount: positiveInteger(payload.rollPriceAmount ?? payload.roll_price_amount, 'Gacha pack rollPriceAmount', 1),
    roll_size: positiveInteger(payload.rollSize ?? payload.roll_size, 'Gacha pack rollSize', 1),
    rarity_table_version: optionalText(payload.rarityTableVersion ?? payload.rarity_table_version),
    rarity_weights_json: jsonText(payload.rarityWeights ?? payload.rarity_weights_json, null),
    slots_json: jsonText(payload.slots ?? payload.slots_json, null),
    guarantees_json: jsonText(payload.guarantees ?? payload.guarantees_json, null),
    pity_rules_json: jsonText(payload.pityRules ?? payload.pity_rules_json, null),
    duplicate_policy_json: jsonText(payload.duplicatePolicy ?? payload.duplicate_policy_json, null),
    burn_rules_json: jsonText(payload.burnRules ?? payload.burn_rules_json, null),
    metadata_json: jsonText(payload.metadata ?? payload.metadataJson, {}),
    created_by: actorId,
    reviewed_by: reviewStatus === 'approved'
      ? (optionalText(payload.reviewedBy ?? payload.reviewed_by) || actorId)
      : null,
    reviewed_at: reviewStatus === 'approved'
      ? (optionalDate(payload.reviewedAt ?? payload.reviewed_at, 'Gacha pack reviewedAt') || now)
      : null,
    created_at: now,
    updated_at: now
  };
}

function itemInsertPayload(payload = {}, packId) {
  const now = nowIso();
  return {
    id: optionalText(payload.id) || createId('gachaitem'),
    pack_id: packId,
    asset_id: requiredText(payload.assetId ?? payload.asset_id, 'Gacha pack item assetId'),
    rarity: requiredText(payload.rarity, 'Gacha pack item rarity'),
    drop_weight: positiveInteger(payload.dropWeight ?? payload.drop_weight, 'Gacha pack item dropWeight'),
    copy_limit: optionalPositiveInteger(payload.copyLimit ?? payload.copy_limit, 'Gacha pack item copyLimit'),
    item_order: Number.isInteger(Number(payload.itemOrder ?? payload.item_order ?? 0))
      ? Number(payload.itemOrder ?? payload.item_order ?? 0)
      : (() => { throw new Error('Gacha pack item itemOrder must be an integer'); })(),
    metadata_json: jsonText(payload.metadata ?? payload.metadataJson, {}),
    created_at: now,
    updated_at: now
  };
}

function seasonUpdateFields(payload = {}) {
  const fields = {};
  if (payload.name !== undefined || payload.nameJson !== undefined) fields.name_json = jsonText(payload.name ?? payload.nameJson, {});
  if (payload.status !== undefined) fields.status = normalizeStatus(payload.status, SEASON_STATUSES, 'Gacha season');
  if (payload.startsAt !== undefined || payload.starts_at !== undefined) fields.starts_at = optionalDate(payload.startsAt ?? payload.starts_at, 'Gacha season startsAt');
  if (payload.endsAt !== undefined || payload.ends_at !== undefined) fields.ends_at = optionalDate(payload.endsAt ?? payload.ends_at, 'Gacha season endsAt');
  if (payload.metadata !== undefined || payload.metadataJson !== undefined) fields.metadata_json = jsonText(payload.metadata ?? payload.metadataJson, {});
  return fields;
}

function collectionUpdateFields(payload = {}) {
  const fields = {};
  if (payload.seasonId !== undefined || payload.season_id !== undefined) fields.season_id = requiredText(payload.seasonId ?? payload.season_id, 'Gacha collection seasonId');
  if (payload.name !== undefined || payload.nameJson !== undefined) fields.name_json = jsonText(payload.name ?? payload.nameJson, {});
  if (payload.status !== undefined) fields.status = normalizeStatus(payload.status, SEASON_STATUSES, 'Gacha collection');
  if (payload.startsAt !== undefined || payload.starts_at !== undefined) fields.starts_at = optionalDate(payload.startsAt ?? payload.starts_at, 'Gacha collection startsAt');
  if (payload.endsAt !== undefined || payload.ends_at !== undefined) fields.ends_at = optionalDate(payload.endsAt ?? payload.ends_at, 'Gacha collection endsAt');
  if (payload.metadata !== undefined || payload.metadataJson !== undefined) fields.metadata_json = jsonText(payload.metadata ?? payload.metadataJson, {});
  return fields;
}

function packUpdateFields(payload = {}) {
  const fields = {};
  if (payload.seasonId !== undefined || payload.season_id !== undefined) fields.season_id = requiredText(payload.seasonId ?? payload.season_id, 'Gacha pack seasonId');
  if (payload.collectionId !== undefined || payload.collection_id !== undefined) fields.collection_id = requiredText(payload.collectionId ?? payload.collection_id, 'Gacha pack collectionId');
  if (payload.name !== undefined || payload.nameJson !== undefined) fields.name_json = jsonText(payload.name ?? payload.nameJson, {});
  if (payload.status !== undefined) fields.status = normalizeStatus(payload.status, PACK_STATUSES, 'Gacha pack');
  if (payload.reviewStatus !== undefined || payload.review_status !== undefined) {
    throw new Error('Gacha pack review status must use a transition action');
  }
  if (payload.startsAt !== undefined || payload.starts_at !== undefined) fields.starts_at = optionalDate(payload.startsAt ?? payload.starts_at, 'Gacha pack startsAt');
  if (payload.endsAt !== undefined || payload.ends_at !== undefined) fields.ends_at = optionalDate(payload.endsAt ?? payload.ends_at, 'Gacha pack endsAt');
  if (payload.rollPriceCurrencyCode !== undefined || payload.roll_price_currency_code !== undefined) {
    fields.roll_price_currency_code = requiredText(payload.rollPriceCurrencyCode ?? payload.roll_price_currency_code, 'Gacha pack rollPriceCurrencyCode');
  }
  if (payload.rollPriceAmount !== undefined || payload.roll_price_amount !== undefined) {
    fields.roll_price_amount = positiveInteger(payload.rollPriceAmount ?? payload.roll_price_amount, 'Gacha pack rollPriceAmount');
  }
  if (payload.rollSize !== undefined || payload.roll_size !== undefined) {
    fields.roll_size = positiveInteger(payload.rollSize ?? payload.roll_size, 'Gacha pack rollSize');
  }
  if (payload.rarityTableVersion !== undefined || payload.rarity_table_version !== undefined) {
    fields.rarity_table_version = optionalText(payload.rarityTableVersion ?? payload.rarity_table_version);
  }
  if (payload.rarityWeights !== undefined || payload.rarity_weights_json !== undefined) fields.rarity_weights_json = jsonText(payload.rarityWeights ?? payload.rarity_weights_json, null);
  if (payload.slots !== undefined || payload.slots_json !== undefined) fields.slots_json = jsonText(payload.slots ?? payload.slots_json, null);
  if (payload.guarantees !== undefined || payload.guarantees_json !== undefined) fields.guarantees_json = jsonText(payload.guarantees ?? payload.guarantees_json, null);
  if (payload.pityRules !== undefined || payload.pity_rules_json !== undefined) fields.pity_rules_json = jsonText(payload.pityRules ?? payload.pity_rules_json, null);
  if (payload.duplicatePolicy !== undefined || payload.duplicate_policy_json !== undefined) fields.duplicate_policy_json = jsonText(payload.duplicatePolicy ?? payload.duplicate_policy_json, null);
  if (payload.burnRules !== undefined || payload.burn_rules_json !== undefined) fields.burn_rules_json = jsonText(payload.burnRules ?? payload.burn_rules_json, null);
  if (payload.metadata !== undefined || payload.metadataJson !== undefined) fields.metadata_json = jsonText(payload.metadata ?? payload.metadataJson, {});
  return fields;
}

function itemUpdateFields(payload = {}) {
  const fields = {};
  if (payload.assetId !== undefined || payload.asset_id !== undefined) fields.asset_id = requiredText(payload.assetId ?? payload.asset_id, 'Gacha pack item assetId');
  if (payload.rarity !== undefined) fields.rarity = requiredText(payload.rarity, 'Gacha pack item rarity');
  if (payload.dropWeight !== undefined || payload.drop_weight !== undefined) fields.drop_weight = positiveInteger(payload.dropWeight ?? payload.drop_weight, 'Gacha pack item dropWeight');
  if (payload.copyLimit !== undefined || payload.copy_limit !== undefined) fields.copy_limit = optionalPositiveInteger(payload.copyLimit ?? payload.copy_limit, 'Gacha pack item copyLimit');
  if (payload.itemOrder !== undefined || payload.item_order !== undefined) {
    const itemOrder = Number(payload.itemOrder ?? payload.item_order);
    if (!Number.isInteger(itemOrder)) throw new Error('Gacha pack item itemOrder must be an integer');
    fields.item_order = itemOrder;
  }
  if (payload.metadata !== undefined || payload.metadataJson !== undefined) fields.metadata_json = jsonText(payload.metadata ?? payload.metadataJson, {});
  return fields;
}

async function applyUpdate(client, table, id, fields) {
  const entries = Object.entries(fields);
  if (!entries.length) return;
  entries.push(['updated_at', nowIso()]);
  const setClause = entries.map(([field], index) => `${field} = $${index + 2}`).join(', ');
  await client.query(
    `UPDATE ${table}
     SET ${setClause}
     WHERE id = $1`,
    [id, ...entries.map(([, value]) => value)]
  );
}

async function validationForPackRow(client, packRow) {
  const items = await selectPackItems(client, packRow.id);
  const runtimePack = rowPackToRuntimePack(packRow, items);
  const catalog = await getRuntimeAssetCatalog({ client, planAssetVisibility: 'all' });
  return {
    runtimePack,
    validation: validateAssetPack(runtimePack, { catalog }),
    shapedPack: shapeAssetPack(runtimePack, { includeAssets: true, catalog }),
    catalog
  };
}

function normalizeFixtureArray(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function normalizeGachaFixture(input = {}) {
  return normalizeGachaAdminFixture(input, { schemaVersion: GACHA_FIXTURE_SCHEMA_VERSION });
}

function packImportUpdateFields(payload = {}, { actorId, allowApproved = false } = {}) {
  const payloadWithoutReview = { ...payload };
  delete payloadWithoutReview.reviewStatus;
  delete payloadWithoutReview.review_status;
  delete payloadWithoutReview.reviewedBy;
  delete payloadWithoutReview.reviewed_by;
  delete payloadWithoutReview.reviewedAt;
  delete payloadWithoutReview.reviewed_at;
  delete payloadWithoutReview.items;
  const fields = packUpdateFields(payloadWithoutReview);
  if (payload.reviewStatus !== undefined || payload.review_status !== undefined) {
    const reviewStatus = normalizeStatus(
      payload.reviewStatus ?? payload.review_status,
      REVIEW_STATUSES,
      'Gacha pack review'
    );
    if (reviewStatus === 'approved' && !allowApproved) {
      throw new Error('Approved gacha fixture import requires allowApproved=true');
    }
    fields.review_status = reviewStatus;
    fields.reviewed_by = reviewStatus === 'approved'
      ? (optionalText(payload.reviewedBy ?? payload.reviewed_by) || actorId)
      : null;
    fields.reviewed_at = reviewStatus === 'approved'
      ? (optionalDate(payload.reviewedAt ?? payload.reviewed_at, 'Gacha pack reviewedAt') || nowIso())
      : null;
  }
  return fields;
}

function mergeRowFields(row, fields) {
  return { ...(row || {}), ...(fields || {}), updated_at: nowIso() };
}

async function insertFixtureSeasonRow(client, row) {
  await client.query(
    `INSERT INTO asset_gacha_seasons
     (id, name_json, status, starts_at, ends_at, metadata_json, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [row.id, row.name_json, row.status, row.starts_at, row.ends_at, row.metadata_json, row.created_by, row.created_at, row.updated_at]
  );
}

async function insertFixtureCollectionRow(client, row) {
  await client.query(
    `INSERT INTO asset_gacha_collections
     (id, season_id, name_json, status, starts_at, ends_at, metadata_json, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [row.id, row.season_id, row.name_json, row.status, row.starts_at, row.ends_at, row.metadata_json, row.created_by, row.created_at, row.updated_at]
  );
}

async function insertFixturePackRow(client, row) {
  await client.query(
    `INSERT INTO asset_gacha_packs
     (id, season_id, collection_id, name_json, status, review_status, starts_at, ends_at,
      roll_price_currency_code, roll_price_amount, roll_size, rarity_table_version,
      rarity_weights_json, slots_json, guarantees_json, pity_rules_json, duplicate_policy_json,
      burn_rules_json, metadata_json, created_by, reviewed_by, reviewed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
    [
      row.id,
      row.season_id,
      row.collection_id,
      row.name_json,
      row.status,
      row.review_status,
      row.starts_at,
      row.ends_at,
      row.roll_price_currency_code,
      row.roll_price_amount,
      row.roll_size,
      row.rarity_table_version,
      row.rarity_weights_json,
      row.slots_json,
      row.guarantees_json,
      row.pity_rules_json,
      row.duplicate_policy_json,
      row.burn_rules_json,
      row.metadata_json,
      row.created_by,
      row.reviewed_by,
      row.reviewed_at,
      row.created_at,
      row.updated_at
    ]
  );
}

async function insertFixturePackItemRow(client, row) {
  await client.query(
    `INSERT INTO asset_gacha_pack_items
     (id, pack_id, asset_id, rarity, drop_weight, copy_limit, item_order, metadata_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [row.id, row.pack_id, row.asset_id, row.rarity, row.drop_weight, row.copy_limit, row.item_order, row.metadata_json, row.created_at, row.updated_at]
  );
}

async function insertFixturePlanItemRow(client, row) {
  await client.query(
    `INSERT INTO asset_gacha_plan_items
     (id, season_id, character_id, asset_id, image_path, file_name, mime_type,
      rarity, drop_weight, status, metadata_json, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      row.id,
      row.season_id,
      row.character_id,
      row.asset_id,
      row.image_path,
      row.file_name,
      row.mime_type,
      row.rarity,
      row.drop_weight,
      row.status,
      row.metadata_json,
      row.created_by,
      row.created_at,
      row.updated_at
    ]
  );
}

function planItemFixtureUpdateFields(payload = {}) {
  const fields = planItemUpdateFields(payload);
  if (payload.imagePath !== undefined || payload.image_path !== undefined) fields.image_path = requiredText(payload.imagePath ?? payload.image_path, 'Gacha plan item imagePath');
  if (payload.fileName !== undefined || payload.file_name !== undefined) fields.file_name = optionalText(payload.fileName ?? payload.file_name);
  if (payload.mimeType !== undefined || payload.mime_type !== undefined) fields.mime_type = requiredText(payload.mimeType ?? payload.mime_type, 'Gacha plan item mimeType');
  return fields;
}

function planCatalogAssetFromRow(row, catalog = []) {
  return gachaAdminPlanCatalogAssetFromRow(row, {
    catalog,
    currencyCode: WALLET_CURRENCY_CODE
  });
}

function catalogWithFixturePlanRows(catalog, planRows) {
  return catalogWithGachaAdminPlanRows(catalog, planRows, {
    currencyCode: WALLET_CURRENCY_CODE
  });
}

function fixturePackResult(packRow, itemRows, { seasonRow, collectionRow, catalog }) {
  const runtimePack = rowPackToRuntimePack(packRow, itemRows);
  const validation = validateAssetPack(runtimePack, { catalog });
  const releaseChecklist = createChecklist({
    runtimePack,
    validation,
    seasonRow,
    collectionRow,
    catalog
  });
  return {
    packId: packRow.id,
    reviewStatus: packRow.review_status,
    validation,
    releaseChecklist
  };
}

function assertApprovedImportReady(result) {
  if (result.reviewStatus !== 'approved') return;
  if (!result.validation.ok) {
    throw gachaAdminInputError(`Approved gacha fixture pack ${result.packId} failed validation: ${result.validation.errors.map((issue) => issue.code).join(', ')}`);
  }
  if (!result.releaseChecklist.ok) {
    throw gachaAdminInputError(`Approved gacha fixture pack ${result.packId} failed release checklist: ${result.releaseChecklist.blockers.map((issue) => issue.code).join(', ')}`);
  }
}

async function selectFixturePackRows(client) {
  const [seasons, collections, packs, items, planItems] = await Promise.all([
    client.query(`SELECT * FROM asset_gacha_seasons ORDER BY starts_at ASC, id ASC`),
    client.query(`SELECT * FROM asset_gacha_collections ORDER BY season_id ASC, starts_at ASC, id ASC`),
    client.query(`SELECT * FROM asset_gacha_packs ORDER BY season_id ASC, collection_id ASC, starts_at ASC, id ASC`),
    client.query(`SELECT * FROM asset_gacha_pack_items ORDER BY pack_id ASC, item_order ASC, id ASC`),
    client.query(`SELECT * FROM asset_gacha_plan_items ORDER BY season_id ASC, character_id ASC, created_at ASC, id ASC`)
  ]);
  return { seasons: seasons.rows, collections: collections.rows, packs: packs.rows, items: items.rows, planItems: planItems.rows };
}

function assetPolicyRecommendationsFromChecklist(releaseChecklist) {
  return gachaAdminAssetPolicyRecommendationsFromChecklist(releaseChecklist);
}

async function previewForPackRow(client, packRow, { trials = 1000, seed = null } = {}) {
  const { runtimePack, validation, shapedPack, catalog } = await validationForPackRow(client, packRow);
  const seasonRow = await findOne(client, 'asset_gacha_seasons', packRow.season_id);
  const collectionRow = await findOne(client, 'asset_gacha_collections', packRow.collection_id);
  const releaseChecklist = createChecklist({
    runtimePack,
    validation,
    seasonRow,
    collectionRow,
    catalog
  });
  return {
    pack: rowToPack(packRow),
    runtimePack,
    validation,
    preview: shapedPack,
    releaseChecklist,
    assetPolicyRecommendations: assetPolicyRecommendationsFromChecklist(releaseChecklist),
    simulation: validation.ok ? simulateRuntimePack(runtimePack, { trials, seed, catalog }) : null,
    diff: await draftDiffForPack(client, runtimePack)
  };
}

async function cloneApprovedPackDraft(client, packRow, {
  actorId,
  reason,
  note,
  evidence
}) {
  if (packRow.review_status !== 'approved') {
    return { row: packRow, cloned: false, action: null };
  }
  const now = nowIso();
  const draftId = createId('gachapack');
  const before = rowToPack(packRow);
  const metadata = {
    ...parseJson(packRow.metadata_json, {}),
    basePackId: packRow.id,
    clonedFromPackId: packRow.id,
    clonedFromReviewStatus: packRow.review_status,
    clonedAt: now
  };
  await client.query(
    `INSERT INTO asset_gacha_packs
     (id, season_id, collection_id, name_json, status, review_status, starts_at, ends_at,
      roll_price_currency_code, roll_price_amount, roll_size, rarity_table_version,
      rarity_weights_json, slots_json, guarantees_json, pity_rules_json, duplicate_policy_json,
      burn_rules_json, metadata_json, created_by, reviewed_by, reviewed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17, $18, $19, NULL, NULL, $20, $20)`,
    [
      draftId,
      packRow.season_id,
      packRow.collection_id,
      packRow.name_json,
      packRow.status,
      packRow.starts_at,
      packRow.ends_at,
      packRow.roll_price_currency_code,
      packRow.roll_price_amount,
      packRow.roll_size,
      packRow.rarity_table_version,
      packRow.rarity_weights_json,
      packRow.slots_json,
      packRow.guarantees_json,
      packRow.pity_rules_json,
      packRow.duplicate_policy_json,
      packRow.burn_rules_json,
      JSON.stringify(metadata),
      actorId,
      now
    ]
  );
  const itemRows = await selectPackItems(client, packRow.id);
  for (const item of itemRows) {
    await client.query(
      `INSERT INTO asset_gacha_pack_items
       (id, pack_id, asset_id, rarity, drop_weight, copy_limit, item_order, metadata_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [
        createId('gachaitem'),
        draftId,
        item.asset_id,
        item.rarity,
        item.drop_weight,
        item.copy_limit,
        item.item_order,
        item.metadata_json,
        now
      ]
    );
  }
  const clonedRow = await requireRow(client, 'asset_gacha_packs', draftId, 'gacha pack');
  const action = await insertAdminAction(client, {
    actorId,
    actionType: 'gacha_pack_clone_draft',
    targetType: 'gacha_pack',
    targetId: packRow.id,
    reason,
    note,
    evidence,
    result: {
      before,
      after: rowToPack(clonedRow),
      draftPackId: draftId
    }
  });
  return { row: clonedRow, cloned: true, action };
}

async function editablePackRow(client, packId, options) {
  const packRow = await requireRow(client, 'asset_gacha_packs', packId, 'gacha pack');
  if (packRow.review_status !== 'approved') return { row: packRow, cloned: false, cloneAction: null };
  if (options.allowClone === false) throw new Error('Approved gacha packs must be edited through a cloned draft');
  const clone = await cloneApprovedPackDraft(client, packRow, options);
  return { row: clone.row, cloned: true, cloneAction: clone.action };
}

export async function listGachaAdminCatalog() {
  const [seasons, collections, packs, items, planItems, runtimeCatalog] = await Promise.all([
    query(`SELECT * FROM asset_gacha_seasons ORDER BY starts_at ASC, id ASC`),
    query(`SELECT * FROM asset_gacha_collections ORDER BY season_id ASC, starts_at ASC, id ASC`),
    query(`SELECT * FROM asset_gacha_packs ORDER BY season_id ASC, collection_id ASC, starts_at ASC, id ASC`),
    query(`SELECT * FROM asset_gacha_pack_items ORDER BY pack_id ASC, item_order ASC, id ASC`),
    query(`SELECT * FROM asset_gacha_plan_items ORDER BY season_id ASC, character_id ASC, created_at ASC, id ASC`),
    getRuntimeAssetCatalog({ planAssetVisibility: 'all' })
  ]);
  const itemsByPack = new Map();
  for (const item of items.rows) {
    const rows = itemsByPack.get(item.pack_id) || [];
    rows.push(item);
    itemsByPack.set(item.pack_id, rows);
  }
  const seasonsById = new Map(seasons.rows.map((row) => [row.id, row]));
  const collectionsById = new Map(collections.rows.map((row) => [row.id, row]));
  const shapedPlanItems = planItems.rows.map(rowToPlanItem);
  return {
    seasons: seasons.rows.map(rowToSeason),
    collections: collections.rows.map(rowToCollection),
    packs: packs.rows.map((row) => {
      const runtimePack = rowPackToRuntimePack(row, itemsByPack.get(row.id) || []);
      const validation = validateAssetPack(runtimePack, { catalog: runtimeCatalog });
      return {
        ...rowToPack(row),
        validation,
        releaseChecklist: createChecklist({
          runtimePack,
          validation,
          seasonRow: seasonsById.get(row.season_id) || null,
          collectionRow: collectionsById.get(row.collection_id) || null,
          catalog: runtimeCatalog
        }),
        itemCount: runtimePack.items.length
      };
    }),
    items: items.rows.map(rowToPackItem),
    planItems: shapedPlanItems,
    planSummary: summarizeGachaPlanItems(shapedPlanItems),
    planCharacters: planCharacterOptions(),
    assetOptions: catalogAssetOptions(runtimeCatalog)
  };
}

export async function exportGachaAdminFixture() {
  const rows = await selectFixturePackRows({ query });
  const itemsByPack = new Map();
  for (const item of rows.items) {
    const list = itemsByPack.get(item.pack_id) || [];
    list.push(rowToPackItem(item));
    itemsByPack.set(item.pack_id, list);
  }
  const packs = rows.packs.map((pack) => ({
    ...rowToPack(pack),
    items: itemsByPack.get(pack.id) || []
  }));
  return {
    schemaVersion: GACHA_FIXTURE_SCHEMA_VERSION,
    exportedAt: nowIso(),
    source: 'database',
    counts: {
      seasons: rows.seasons.length,
      collections: rows.collections.length,
      planItems: rows.planItems.length,
      packs: rows.packs.length,
      items: rows.items.length
    },
    seasons: rows.seasons.map(rowToSeason),
    collections: rows.collections.map(rowToCollection),
    planItems: rows.planItems.map(rowToPlanItem),
    packs
  };
}

export async function importGachaAdminFixture({
  actorId,
  fixture = {},
  dryRun = true,
  allowApproved = false,
  reason,
  note = '',
  evidence = {}
} = {}) {
  const actor = normalizeActor(actorId);
  const normalizedFixture = normalizeGachaFixture(fixture);
  const actionReason = normalizeReason(reason, 'gacha_fixture_import');
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);
  const shouldWrite = dryRun === false;
  return withTransaction(async (client) => {
    const operations = [];
    const seasonRows = new Map();
    const collectionRows = new Map();
    const planRows = new Map();
    const packRows = new Map();
    const itemRowsByPack = new Map();

    for (const season of normalizedFixture.seasons) {
      const row = seasonInsertPayload(season, actor);
      const existing = await findOne(client, 'asset_gacha_seasons', row.id);
      if (existing) {
        const fields = seasonUpdateFields(season);
        if (shouldWrite) await applyUpdate(client, 'asset_gacha_seasons', row.id, fields);
        const after = shouldWrite
          ? await requireRow(client, 'asset_gacha_seasons', row.id, 'gacha season')
          : mergeRowFields(existing, fields);
        seasonRows.set(row.id, after);
        operations.push({ type: 'season', id: row.id, action: Object.keys(fields).length ? 'update' : 'noop' });
      } else {
        if (shouldWrite) await insertFixtureSeasonRow(client, row);
        seasonRows.set(row.id, row);
        operations.push({ type: 'season', id: row.id, action: 'create' });
      }
    }

    for (const collection of normalizedFixture.collections) {
      const row = collectionInsertPayload(collection, actor);
      if (!seasonRows.has(row.season_id)) await requireRow(client, 'asset_gacha_seasons', row.season_id, 'gacha season');
      const existing = await findOne(client, 'asset_gacha_collections', row.id);
      if (existing) {
        const fields = collectionUpdateFields(collection);
        if (fields.season_id && !seasonRows.has(fields.season_id)) {
          await requireRow(client, 'asset_gacha_seasons', fields.season_id, 'gacha season');
        }
        if (shouldWrite) await applyUpdate(client, 'asset_gacha_collections', row.id, fields);
        const after = shouldWrite
          ? await requireRow(client, 'asset_gacha_collections', row.id, 'gacha collection')
          : mergeRowFields(existing, fields);
        collectionRows.set(row.id, after);
        operations.push({ type: 'collection', id: row.id, action: Object.keys(fields).length ? 'update' : 'noop' });
      } else {
        if (shouldWrite) await insertFixtureCollectionRow(client, row);
        collectionRows.set(row.id, row);
        operations.push({ type: 'collection', id: row.id, action: 'create' });
      }
    }

    for (const planItem of normalizedFixture.planItems) {
      const row = planItemInsertPayload(planItem, actor);
      if (!seasonRows.has(row.season_id)) await requireRow(client, 'asset_gacha_seasons', row.season_id, 'gacha season');
      const existing = await findOne(client, 'asset_gacha_plan_items', row.id);
      if (existing) {
        const fields = planItemFixtureUpdateFields(planItem);
        await applyPlanItemAssetContract(client, existing, fields, planItem);
        if (fields.season_id && !seasonRows.has(fields.season_id)) {
          await requireRow(client, 'asset_gacha_seasons', fields.season_id, 'gacha season');
        }
        if (shouldWrite) await applyUpdate(client, 'asset_gacha_plan_items', row.id, fields);
        const after = shouldWrite
          ? await requireRow(client, 'asset_gacha_plan_items', row.id, 'gacha plan item')
          : mergeRowFields(existing, fields);
        planRows.set(row.id, after);
        operations.push({ type: 'plan_item', id: row.id, action: Object.keys(fields).length ? 'update' : 'noop' });
      } else {
        if (shouldWrite) await insertFixturePlanItemRow(client, row);
        planRows.set(row.id, row);
        operations.push({ type: 'plan_item', id: row.id, action: 'create' });
      }
    }

    for (const pack of normalizedFixture.packs) {
      const row = packInsertPayload(pack, actor, {
        allowApproved,
        approvalError: 'Approved gacha fixture import requires allowApproved=true'
      });
      if (!seasonRows.has(row.season_id)) await requireRow(client, 'asset_gacha_seasons', row.season_id, 'gacha season');
      const fixtureCollection = collectionRows.get(row.collection_id);
      if (fixtureCollection) {
        if (fixtureCollection.season_id !== row.season_id) {
          throw new Error('Gacha collection must belong to the selected season');
        }
      } else {
        await validateCollectionSeason(client, row.season_id, row.collection_id);
      }
      const existing = await findOne(client, 'asset_gacha_packs', row.id);
      if (existing) {
        const fields = packImportUpdateFields(pack, { actorId: actor, allowApproved });
        const finalSeasonId = fields.season_id || existing.season_id;
        const finalCollectionId = fields.collection_id || existing.collection_id;
        if (!seasonRows.has(finalSeasonId)) await requireRow(client, 'asset_gacha_seasons', finalSeasonId, 'gacha season');
        const finalCollection = collectionRows.get(finalCollectionId);
        if (finalCollection) {
          if (finalCollection.season_id !== finalSeasonId) throw new Error('Gacha collection must belong to the selected season');
        } else if (fields.season_id || fields.collection_id) {
          await validateCollectionSeason(client, finalSeasonId, finalCollectionId);
        }
        if (shouldWrite) await applyUpdate(client, 'asset_gacha_packs', row.id, fields);
        const after = shouldWrite
          ? await requireRow(client, 'asset_gacha_packs', row.id, 'gacha pack')
          : mergeRowFields(existing, fields);
        packRows.set(row.id, after);
        operations.push({ type: 'pack', id: row.id, action: Object.keys(fields).length ? 'update' : 'noop' });
      } else {
        if (shouldWrite) await insertFixturePackRow(client, row);
        packRows.set(row.id, row);
        operations.push({ type: 'pack', id: row.id, action: 'create' });
      }
    }

    const packResults = [];
    for (const pack of normalizedFixture.packs) {
      const packId = requiredText(pack.id, 'Gacha fixture pack id');
      const itemPayloads = normalizeFixtureArray(pack.items, `Gacha fixture pack ${packId} items`);
      const existingItems = await selectPackItems(client, packId);
      const itemRows = [];
      for (const [index, item] of itemPayloads.entries()) {
        itemRows.push(itemInsertPayload({ itemOrder: index, ...item }, packId));
      }
      if (shouldWrite) {
        await client.query(`DELETE FROM asset_gacha_pack_items WHERE pack_id = $1`, [packId]);
        for (const row of itemRows) {
          await insertFixturePackItemRow(client, row);
        }
        itemRowsByPack.set(packId, await selectPackItems(client, packId));
      } else {
        itemRowsByPack.set(packId, itemRows);
      }
      operations.push({
        type: 'pack_items',
        id: packId,
        action: 'replace',
        beforeCount: existingItems.length,
        afterCount: itemRows.length
      });
      const packRow = packRows.get(packId) || await requireRow(client, 'asset_gacha_packs', packId, 'gacha pack');
      const seasonRow = seasonRows.get(packRow.season_id) || await findOne(client, 'asset_gacha_seasons', packRow.season_id);
      const collectionRow = collectionRows.get(packRow.collection_id) || await findOne(client, 'asset_gacha_collections', packRow.collection_id);
      const catalog = catalogWithFixturePlanRows(
        await getRuntimeAssetCatalog({ client, planAssetVisibility: 'all' }),
        [...planRows.values()]
      );
      const result = fixturePackResult(packRow, itemRowsByPack.get(packId) || [], { seasonRow, collectionRow, catalog });
      assertApprovedImportReady(result);
      packResults.push(result);
    }

    const summary = summarizeGachaAdminFixtureOperations(operations);
    let action = null;
    if (shouldWrite) {
      action = await insertAdminAction(client, {
        actorId: actor,
        actionType: 'gacha_fixture_import',
        targetType: 'gacha_fixture',
        targetId: null,
        reason: actionReason,
        note: actionNote,
        evidence: actionEvidence,
        result: {
          schemaVersion: normalizedFixture.schemaVersion,
          allowApproved,
          summary,
          packResults: packResults.map((result) => ({
            packId: result.packId,
            reviewStatus: result.reviewStatus,
            validationOk: result.validation.ok,
            releaseReady: result.releaseChecklist.ok
          }))
        }
      });
    }
    return {
      schemaVersion: normalizedFixture.schemaVersion,
      dryRun: !shouldWrite,
      allowApproved,
      summary,
      operations,
      packResults,
      action
    };
  });
}

export async function createGachaPlanItem({ actorId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_plan_item_create');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  const itemId = optionalText(payload.id) || createId('gachaplan');
  const seasonId = requiredText(payload.seasonId ?? payload.season_id, 'Gacha plan item seasonId');
  const file = await writePlanImageFile({
    seasonId,
    itemId,
    imageData: payload.imageData ?? payload.image_data
  });
  try {
    return await withTransaction(async (client) => {
      await requireRow(client, 'asset_gacha_seasons', seasonId, 'gacha season');
      await ensureIdUnused(client, 'asset_gacha_plan_items', itemId, 'Gacha plan item');
      const row = planItemInsertPayload({
        ...payload,
        id: itemId,
        seasonId,
        imagePath: file.imagePath,
        mimeType: file.mimeType
      }, actor);
      await client.query(
        `INSERT INTO asset_gacha_plan_items
         (id, season_id, character_id, asset_id, image_path, file_name, mime_type,
          rarity, drop_weight, status, metadata_json, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          row.id,
          row.season_id,
          row.character_id,
          row.asset_id,
          row.image_path,
          row.file_name,
          row.mime_type,
          row.rarity,
          row.drop_weight,
          row.status,
          row.metadata_json,
          row.created_by,
          row.created_at,
          row.updated_at
        ]
      );
      const item = rowToPlanItem(await requireRow(client, 'asset_gacha_plan_items', row.id, 'gacha plan item'));
      const action = await insertAdminAction(client, {
        actorId: actor,
        actionType: 'gacha_plan_item_create',
        targetType: 'gacha_plan_item',
        targetId: row.id,
        reason: actionReason,
        note: actionNote,
        evidence: actionEvidence,
        result: { before: null, after: item }
      });
      return { item, action };
    });
  } catch (error) {
    await fs.rm(file.absolutePath, { force: true }).catch(() => {});
    throw error;
  }
}

export async function updateGachaPlanItem({ actorId, itemId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_plan_item_update');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const beforeRow = await requireRow(client, 'asset_gacha_plan_items', itemId, 'gacha plan item');
    const before = rowToPlanItem(beforeRow);
    const fields = planItemUpdateFields(payload);
    await applyPlanItemAssetContract(client, beforeRow, fields, payload);
    if (fields.season_id) await requireRow(client, 'asset_gacha_seasons', fields.season_id, 'gacha season');
    await applyUpdate(client, 'asset_gacha_plan_items', itemId, fields);
    const after = rowToPlanItem(await requireRow(client, 'asset_gacha_plan_items', itemId, 'gacha plan item'));
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_plan_item_update',
      targetType: 'gacha_plan_item',
      targetId: itemId,
      status: Object.keys(fields).length ? 'applied' : 'noop',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after }
    });
    return { item: after, action };
  });
}

export async function deleteGachaPlanItem({ actorId, itemId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_plan_item_delete');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  const result = await withTransaction(async (client) => {
    const beforeRow = await requireRow(client, 'asset_gacha_plan_items', itemId, 'gacha plan item');
    const before = rowToPlanItem(beforeRow);
    await client.query(`DELETE FROM asset_gacha_plan_items WHERE id = $1`, [itemId]);
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_plan_item_delete',
      targetType: 'gacha_plan_item',
      targetId: itemId,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after: null }
    });
    return { item: before, action };
  });
  await deletePlanImageFile(result.item.imagePath);
  return result;
}

export async function createGachaSeason({ actorId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_season_create');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const row = seasonInsertPayload(payload, actor);
    await ensureIdUnused(client, 'asset_gacha_seasons', row.id, 'Gacha season');
    await client.query(
      `INSERT INTO asset_gacha_seasons
       (id, name_json, status, starts_at, ends_at, metadata_json, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [row.id, row.name_json, row.status, row.starts_at, row.ends_at, row.metadata_json, row.created_by, row.created_at, row.updated_at]
    );
    const inserted = await requireRow(client, 'asset_gacha_seasons', row.id, 'gacha season');
    const season = rowToSeason(inserted);
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_season_create',
      targetType: 'gacha_season',
      targetId: row.id,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before: null, after: season }
    });
    return { season, action };
  });
}

export async function updateGachaSeason({ actorId, seasonId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_season_update');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const beforeRow = await requireRow(client, 'asset_gacha_seasons', seasonId, 'gacha season');
    const before = rowToSeason(beforeRow);
    const fields = seasonUpdateFields(payload);
    await applyUpdate(client, 'asset_gacha_seasons', seasonId, fields);
    const after = rowToSeason(await requireRow(client, 'asset_gacha_seasons', seasonId, 'gacha season'));
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_season_update',
      targetType: 'gacha_season',
      targetId: seasonId,
      status: Object.keys(fields).length ? 'applied' : 'noop',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after }
    });
    return { season: after, action };
  });
}

export async function createGachaCollection({ actorId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_collection_create');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const row = collectionInsertPayload(payload, actor);
    await requireRow(client, 'asset_gacha_seasons', row.season_id, 'gacha season');
    await ensureIdUnused(client, 'asset_gacha_collections', row.id, 'Gacha collection');
    await client.query(
      `INSERT INTO asset_gacha_collections
       (id, season_id, name_json, status, starts_at, ends_at, metadata_json, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [row.id, row.season_id, row.name_json, row.status, row.starts_at, row.ends_at, row.metadata_json, row.created_by, row.created_at, row.updated_at]
    );
    const collection = rowToCollection(await requireRow(client, 'asset_gacha_collections', row.id, 'gacha collection'));
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_collection_create',
      targetType: 'gacha_collection',
      targetId: row.id,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before: null, after: collection }
    });
    return { collection, action };
  });
}

export async function updateGachaCollection({ actorId, collectionId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_collection_update');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const before = rowToCollection(await requireRow(client, 'asset_gacha_collections', collectionId, 'gacha collection'));
    const fields = collectionUpdateFields(payload);
    if (fields.season_id) await requireRow(client, 'asset_gacha_seasons', fields.season_id, 'gacha season');
    await applyUpdate(client, 'asset_gacha_collections', collectionId, fields);
    const after = rowToCollection(await requireRow(client, 'asset_gacha_collections', collectionId, 'gacha collection'));
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_collection_update',
      targetType: 'gacha_collection',
      targetId: collectionId,
      status: Object.keys(fields).length ? 'applied' : 'noop',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after }
    });
    return { collection: after, action };
  });
}

export async function createGachaPack({ actorId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_pack_create');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const row = packInsertPayload(payload, actor);
    await requireRow(client, 'asset_gacha_seasons', row.season_id, 'gacha season');
    await validateCollectionSeason(client, row.season_id, row.collection_id);
    await ensureIdUnused(client, 'asset_gacha_packs', row.id, 'Gacha pack');
    await client.query(
      `INSERT INTO asset_gacha_packs
       (id, season_id, collection_id, name_json, status, review_status, starts_at, ends_at,
        roll_price_currency_code, roll_price_amount, roll_size, rarity_table_version,
        rarity_weights_json, slots_json, guarantees_json, pity_rules_json, duplicate_policy_json,
        burn_rules_json, metadata_json, created_by, reviewed_by, reviewed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        row.id,
        row.season_id,
        row.collection_id,
        row.name_json,
        row.status,
        row.review_status,
        row.starts_at,
        row.ends_at,
        row.roll_price_currency_code,
        row.roll_price_amount,
        row.roll_size,
        row.rarity_table_version,
        row.rarity_weights_json,
        row.slots_json,
        row.guarantees_json,
        row.pity_rules_json,
        row.duplicate_policy_json,
        row.burn_rules_json,
        row.metadata_json,
        row.created_by,
        row.reviewed_by,
        row.reviewed_at,
        row.created_at,
        row.updated_at
      ]
    );
    const pack = rowToPack(await requireRow(client, 'asset_gacha_packs', row.id, 'gacha pack'));
    const validation = (await validationForPackRow(client, await requireRow(client, 'asset_gacha_packs', row.id, 'gacha pack'))).validation;
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_pack_create',
      targetType: 'gacha_pack',
      targetId: row.id,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before: null, after: pack, validation }
    });
    return { pack, validation, action };
  });
}

export async function updateGachaPack({ actorId, packId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_pack_update');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const editable = await editablePackRow(client, packId, {
      actorId: actor,
      allowClone: payload.cloneDraft !== false,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence
    });
    const targetId = editable.row.id;
    const before = rowToPack(editable.row);
    const fields = packUpdateFields(payload);
    const finalSeasonId = fields.season_id || editable.row.season_id;
    const finalCollectionId = fields.collection_id || editable.row.collection_id;
    if (fields.season_id) await requireRow(client, 'asset_gacha_seasons', finalSeasonId, 'gacha season');
    if (fields.season_id || fields.collection_id) await validateCollectionSeason(client, finalSeasonId, finalCollectionId);
    await applyUpdate(client, 'asset_gacha_packs', targetId, fields);
    const afterRow = await requireRow(client, 'asset_gacha_packs', targetId, 'gacha pack');
    const after = rowToPack(afterRow);
    const validation = (await validationForPackRow(client, afterRow)).validation;
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_pack_update',
      targetType: 'gacha_pack',
      targetId,
      status: Object.keys(fields).length ? 'applied' : 'noop',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after, validation, clonedFromPackId: editable.cloned ? packId : null }
    });
    return {
      pack: after,
      validation,
      action,
      cloned: editable.cloned,
      clonedFromPackId: editable.cloned ? packId : null,
      cloneAction: editable.cloneAction
    };
  });
}

export async function createGachaPackItem({ actorId, packId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_pack_item_create');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const editable = await editablePackRow(client, packId, {
      actorId: actor,
      allowClone: payload.cloneDraft !== false,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence
    });
    const row = itemInsertPayload(payload, editable.row.id);
    await ensureIdUnused(client, 'asset_gacha_pack_items', row.id, 'Gacha pack item');
    await client.query(
      `INSERT INTO asset_gacha_pack_items
       (id, pack_id, asset_id, rarity, drop_weight, copy_limit, item_order, metadata_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [row.id, row.pack_id, row.asset_id, row.rarity, row.drop_weight, row.copy_limit, row.item_order, row.metadata_json, row.created_at, row.updated_at]
    );
    const item = rowToPackItem(await requireRow(client, 'asset_gacha_pack_items', row.id, 'gacha pack item'));
    const validation = (await validationForPackRow(client, await requireRow(client, 'asset_gacha_packs', editable.row.id, 'gacha pack'))).validation;
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_pack_item_create',
      targetType: 'gacha_pack_item',
      targetId: row.id,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before: null, after: item, validation, clonedFromPackId: editable.cloned ? packId : null }
    });
    return { item, packId: editable.row.id, validation, action, cloned: editable.cloned, clonedFromPackId: editable.cloned ? packId : null, cloneAction: editable.cloneAction };
  });
}

export async function updateGachaPackItem({ actorId, packId, itemId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_pack_item_update');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const editable = await editablePackRow(client, packId, {
      actorId: actor,
      allowClone: payload.cloneDraft !== false,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence
    });
    let targetItemId = itemId;
    if (editable.cloned) {
      const original = await requireRow(client, 'asset_gacha_pack_items', itemId, 'gacha pack item');
      const cloneItems = await selectPackItems(client, editable.row.id);
      const match = cloneItems.find((item) =>
        item.asset_id === original.asset_id &&
        Number(item.item_order || 0) === Number(original.item_order || 0)
      ) || cloneItems.find((item) => item.asset_id === original.asset_id);
      if (!match) throw new Error('Unknown cloned gacha pack item');
      targetItemId = match.id;
    }
    const beforeRow = await requireRow(client, 'asset_gacha_pack_items', targetItemId, 'gacha pack item');
    if (beforeRow.pack_id !== editable.row.id) throw new Error('Gacha pack item must belong to the selected pack');
    const before = rowToPackItem(beforeRow);
    const fields = itemUpdateFields(payload);
    const unsafeFields = Object.keys(fields).filter((field) => !ITEM_FIELDS.has(field));
    if (unsafeFields.length) throw new Error('Gacha pack item update contains unsupported fields');
    await applyUpdate(client, 'asset_gacha_pack_items', targetItemId, fields);
    const after = rowToPackItem(await requireRow(client, 'asset_gacha_pack_items', targetItemId, 'gacha pack item'));
    const validation = (await validationForPackRow(client, await requireRow(client, 'asset_gacha_packs', editable.row.id, 'gacha pack'))).validation;
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_pack_item_update',
      targetType: 'gacha_pack_item',
      targetId: targetItemId,
      status: Object.keys(fields).length ? 'applied' : 'noop',
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after, validation, clonedFromPackId: editable.cloned ? packId : null }
    });
    return { item: after, packId: editable.row.id, validation, action, cloned: editable.cloned, clonedFromPackId: editable.cloned ? packId : null, cloneAction: editable.cloneAction };
  });
}

export async function deleteGachaPackItem({ actorId, packId, itemId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_pack_item_delete');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const editable = await editablePackRow(client, packId, {
      actorId: actor,
      allowClone: payload.cloneDraft !== false,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence
    });
    let targetItemId = itemId;
    if (editable.cloned) {
      const original = await requireRow(client, 'asset_gacha_pack_items', itemId, 'gacha pack item');
      const cloneItems = await selectPackItems(client, editable.row.id);
      const match = cloneItems.find((item) =>
        item.asset_id === original.asset_id &&
        Number(item.item_order || 0) === Number(original.item_order || 0)
      ) || cloneItems.find((item) => item.asset_id === original.asset_id);
      if (!match) throw new Error('Unknown cloned gacha pack item');
      targetItemId = match.id;
    }
    const beforeRow = await requireRow(client, 'asset_gacha_pack_items', targetItemId, 'gacha pack item');
    if (beforeRow.pack_id !== editable.row.id) throw new Error('Gacha pack item must belong to the selected pack');
    const before = rowToPackItem(beforeRow);
    await client.query(`DELETE FROM asset_gacha_pack_items WHERE id = $1`, [targetItemId]);
    const validation = (await validationForPackRow(client, await requireRow(client, 'asset_gacha_packs', editable.row.id, 'gacha pack'))).validation;
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_pack_item_delete',
      targetType: 'gacha_pack_item',
      targetId: targetItemId,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after: null, validation, clonedFromPackId: editable.cloned ? packId : null }
    });
    return { item: before, packId: editable.row.id, validation, action, cloned: editable.cloned, clonedFromPackId: editable.cloned ? packId : null, cloneAction: editable.cloneAction };
  });
}

export async function replaceGachaPackItems({ actorId, packId, items = [], reason, note = '', evidence = {}, cloneDraft = true } = {}) {
  const actor = normalizeActor(actorId);
  if (!Array.isArray(items)) throw new Error('Gacha pack items must be an array');
  const actionReason = normalizeReason(reason, 'gacha_pack_items_replace');
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const editable = await editablePackRow(client, packId, {
      actorId: actor,
      allowClone: cloneDraft !== false,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence
    });
    const before = (await selectPackItems(client, editable.row.id)).map(rowToPackItem);
    await client.query(`DELETE FROM asset_gacha_pack_items WHERE pack_id = $1`, [editable.row.id]);
    const inserted = [];
    for (const [index, item] of items.entries()) {
      const row = itemInsertPayload({ itemOrder: index, ...item }, editable.row.id);
      await client.query(
        `INSERT INTO asset_gacha_pack_items
         (id, pack_id, asset_id, rarity, drop_weight, copy_limit, item_order, metadata_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [row.id, row.pack_id, row.asset_id, row.rarity, row.drop_weight, row.copy_limit, row.item_order, row.metadata_json, row.created_at, row.updated_at]
      );
      inserted.push(rowToPackItem(await requireRow(client, 'asset_gacha_pack_items', row.id, 'gacha pack item')));
    }
    const validation = (await validationForPackRow(client, await requireRow(client, 'asset_gacha_packs', editable.row.id, 'gacha pack'))).validation;
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_pack_items_replace',
      targetType: 'gacha_pack',
      targetId: editable.row.id,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after: inserted, validation, clonedFromPackId: editable.cloned ? packId : null }
    });
    return { items: inserted, packId: editable.row.id, validation, action, cloned: editable.cloned, clonedFromPackId: editable.cloned ? packId : null, cloneAction: editable.cloneAction };
  });
}

function normalizedPlanItemIds(value) {
  return normalizeGachaAdminPlanItemIds(value);
}

async function selectReadyPlanItemsForPromotion(client, {
  seasonId,
  planItemIds = []
}) {
  const ids = normalizedPlanItemIds(planItemIds);
  const params = [seasonId];
  let filter = '';
  if (ids.length) {
    const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ');
    filter = ` AND id IN (${placeholders})`;
    params.push(...ids);
  }
  const result = await client.query(
    `SELECT *
     FROM asset_gacha_plan_items
     WHERE season_id = $1
       AND status = 'ready'
       ${filter}
     ORDER BY character_id ASC, created_at ASC, id ASC`,
    params
  );
  if (ids.length && result.rowCount !== ids.length) {
    throw new Error('Some gacha plan items are unknown, not ready, or belong to a different season');
  }
  if (!result.rowCount) throw new Error('No ready gacha plan items are available for this season');
  return result.rows;
}

function promotionPackItemMetadata(planRow, packRow, existingMetadata = {}) {
  return gachaAdminPromotionPackItemMetadata(planRow, packRow, existingMetadata);
}

function promotedPlanMetadata(planRow, packItem, packRow) {
  return gachaAdminPromotedPlanMetadata(planRow, packItem, packRow, { now: nowIso() });
}

export async function promoteGachaPlanItemsToPack({ actorId, packId, payload = {}, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const actionReason = normalizeReason(reason || payload.reason, 'gacha_plan_promote_pack_items');
  const actionNote = normalizeNote(note || payload.note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const editable = await editablePackRow(client, packId, {
      actorId: actor,
      allowClone: payload.cloneDraft !== false,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence
    });
    const targetSeasonId = requiredText(payload.seasonId ?? payload.season_id ?? editable.row.season_id, 'Gacha plan promotion seasonId');
    if (targetSeasonId !== editable.row.season_id) {
      throw new Error('Gacha plan promotion season must match the selected pack season');
    }
    const planRows = await selectReadyPlanItemsForPromotion(client, {
      seasonId: targetSeasonId,
      planItemIds: payload.planItemIds ?? payload.plan_item_ids
    });
    const before = (await selectPackItems(client, editable.row.id)).map(rowToPackItem);
    const existingByAssetId = new Map(before.map((item) => [item.assetId, item]));
    let nextOrder = before.reduce((max, item) => Math.max(max, Number(item.itemOrder || 0)), -1) + 1;
    const inserted = [];
    const updated = [];
    for (const planRow of planRows) {
      const existing = existingByAssetId.get(planRow.asset_id);
      if (existing) {
        const metadata = promotionPackItemMetadata(planRow, editable.row, existing.metadata || {});
        await client.query(
          `UPDATE asset_gacha_pack_items
           SET rarity = $2,
               drop_weight = $3,
               metadata_json = $4,
               updated_at = $5
           WHERE id = $1`,
          [
            existing.id,
            planRow.rarity,
            planRow.drop_weight,
            JSON.stringify(metadata),
            nowIso()
          ]
        );
        const after = rowToPackItem(await requireRow(client, 'asset_gacha_pack_items', existing.id, 'gacha pack item'));
        updated.push(after);
        await client.query(
          `UPDATE asset_gacha_plan_items
           SET metadata_json = $2,
               updated_at = $3
           WHERE id = $1`,
          [planRow.id, JSON.stringify(promotedPlanMetadata(planRow, after, editable.row)), nowIso()]
        );
        continue;
      }

      const row = itemInsertPayload({
        assetId: planRow.asset_id,
        rarity: planRow.rarity,
        dropWeight: planRow.drop_weight,
        itemOrder: nextOrder,
        metadata: promotionPackItemMetadata(planRow, editable.row)
      }, editable.row.id);
      nextOrder += 1;
      await client.query(
        `INSERT INTO asset_gacha_pack_items
         (id, pack_id, asset_id, rarity, drop_weight, copy_limit, item_order, metadata_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [row.id, row.pack_id, row.asset_id, row.rarity, row.drop_weight, row.copy_limit, row.item_order, row.metadata_json, row.created_at, row.updated_at]
      );
      const insertedItem = rowToPackItem(await requireRow(client, 'asset_gacha_pack_items', row.id, 'gacha pack item'));
      inserted.push(insertedItem);
      await client.query(
        `UPDATE asset_gacha_plan_items
         SET metadata_json = $2,
             updated_at = $3
         WHERE id = $1`,
        [planRow.id, JSON.stringify(promotedPlanMetadata(planRow, insertedItem, editable.row)), nowIso()]
      );
    }
    const after = (await selectPackItems(client, editable.row.id)).map(rowToPackItem);
    const validation = (await validationForPackRow(client, await requireRow(client, 'asset_gacha_packs', editable.row.id, 'gacha pack'))).validation;
    if (!validation.ok) {
      throw new Error(`Gacha pack validation failed after plan promotion: ${validation.errors.map((issue) => issue.code).join(', ')}`);
    }
    const action = await insertAdminAction(client, {
      actorId: actor,
      actionType: 'gacha_plan_promote_pack_items',
      targetType: 'gacha_pack',
      targetId: editable.row.id,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: {
        before,
        after,
        inserted,
        updated,
        planItemIds: planRows.map((row) => row.id),
        validation,
        clonedFromPackId: editable.cloned ? packId : null
      }
    });
    return {
      pack: rowToPack(editable.row),
      packId: editable.row.id,
      items: after,
      inserted,
      updated,
      validation,
      action,
      cloned: editable.cloned,
      clonedFromPackId: editable.cloned ? packId : null,
      cloneAction: editable.cloneAction
    };
  });
}

export async function validateGachaAdminPack({ packId } = {}) {
  const row = await requireRow({ query }, 'asset_gacha_packs', packId, 'gacha pack');
  const preview = await previewForPackRow({ query }, row, { trials: 1000 });
  return {
    pack: preview.pack,
    runtimePack: preview.runtimePack,
    validation: preview.validation,
    preview: preview.preview,
    releaseChecklist: preview.releaseChecklist,
    assetPolicyRecommendations: preview.assetPolicyRecommendations,
    diff: preview.diff
  };
}

export async function previewGachaAdminPack({ packId, trials = 1000, seed = null } = {}) {
  const row = await requireRow({ query }, 'asset_gacha_packs', packId, 'gacha pack');
  return previewForPackRow({ query }, row, { trials, seed });
}

export async function transitionGachaPack({ actorId, packId, action, reason, note = '', evidence = {} } = {}) {
  const actor = normalizeActor(actorId);
  const normalizedAction = requiredText(action, 'Gacha pack transition action');
  const actionReason = normalizeReason(reason, `gacha_pack_${normalizedAction}`);
  const actionNote = normalizeNote(note);
  const actionEvidence = normalizeEvidence(evidence);
  return withTransaction(async (client) => {
    const beforeRow = await requireRow(client, 'asset_gacha_packs', packId, 'gacha pack');
    const before = rowToPack(beforeRow);
    const fields = {};
    const now = nowIso();
    let preview = await previewForPackRow(client, beforeRow, { trials: 1000 });
    let validation = preview.validation;
    if (['approve', 'publish'].includes(normalizedAction) && !validation.ok) {
      throw new Error(`Gacha pack validation failed: ${validation.errors.map((issue) => issue.code).join(', ')}`);
    }
    if (['approve', 'publish'].includes(normalizedAction) && !preview.releaseChecklist.ok) {
      throw new Error(`Gacha pack release checklist failed: ${preview.releaseChecklist.blockers.map((issue) => issue.code).join(', ')}`);
    }
    switch (normalizedAction) {
      case 'submit_review':
        fields.review_status = 'in_review';
        fields.reviewed_by = null;
        fields.reviewed_at = null;
        break;
      case 'reopen':
        fields.review_status = 'draft';
        fields.reviewed_by = null;
        fields.reviewed_at = null;
        break;
      case 'reject':
        fields.review_status = 'rejected';
        fields.reviewed_by = actor;
        fields.reviewed_at = now;
        break;
      case 'approve':
        fields.review_status = 'approved';
        fields.reviewed_by = actor;
        fields.reviewed_at = now;
        break;
      case 'publish':
        fields.review_status = 'approved';
        fields.status = 'active';
        fields.reviewed_by = actor;
        fields.reviewed_at = now;
        break;
      case 'expire':
        fields.status = 'expired';
        break;
      case 'disable':
        fields.status = 'disabled';
        break;
      case 'activate':
        fields.status = 'active';
        break;
      case 'schedule':
        fields.status = 'future';
        break;
      default:
        throw new Error('Unknown gacha pack transition action');
    }
    await applyUpdate(client, 'asset_gacha_packs', packId, fields);
    const afterRow = await requireRow(client, 'asset_gacha_packs', packId, 'gacha pack');
    preview = await previewForPackRow(client, afterRow, { trials: 1000 });
    validation = preview.validation;
    const after = rowToPack(afterRow);
    const audit = await insertAdminAction(client, {
      actorId: actor,
      actionType: `gacha_pack_${normalizedAction}`,
      targetType: 'gacha_pack',
      targetId: packId,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after, validation, releaseChecklist: preview.releaseChecklist }
    });
    return {
      pack: after,
      validation,
      releaseChecklist: preview.releaseChecklist,
      preview: preview.preview,
      simulation: preview.simulation,
      assetPolicyRecommendations: preview.assetPolicyRecommendations,
      diff: preview.diff,
      action: audit
    };
  });
}
