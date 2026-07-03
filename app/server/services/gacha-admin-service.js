import { query, withTransaction } from '../db.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';
import {
  getAssetCatalog,
  shapeAssetPack,
  validateAssetPack
} from './asset-service.js';
import { WALLET_CURRENCY_CODE } from './wallet-service.js';

const SEASON_STATUSES = new Set(['draft', 'active', 'future', 'expired', 'disabled']);
const PACK_STATUSES = new Set(['active', 'future', 'expired', 'disabled']);
const REVIEW_STATUSES = new Set(['draft', 'in_review', 'approved', 'rejected']);
const ITEM_FIELDS = new Set(['asset_id', 'rarity', 'drop_weight', 'copy_limit', 'item_order', 'metadata_json']);

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

function packInsertPayload(payload = {}, actorId) {
  const now = nowIso();
  const reviewStatus = normalizeStatus(payload.reviewStatus || payload.review_status || 'draft', REVIEW_STATUSES, 'Gacha pack review');
  if (reviewStatus === 'approved') throw new Error('Gacha pack approval must use a transition action');
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
    reviewed_by: null,
    reviewed_at: null,
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
  return {
    runtimePack,
    validation: validateAssetPack(runtimePack),
    shapedPack: shapeAssetPack(runtimePack, { includeAssets: true })
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
  const [seasons, collections, packs, items] = await Promise.all([
    query(`SELECT * FROM asset_gacha_seasons ORDER BY starts_at ASC, id ASC`),
    query(`SELECT * FROM asset_gacha_collections ORDER BY season_id ASC, starts_at ASC, id ASC`),
    query(`SELECT * FROM asset_gacha_packs ORDER BY season_id ASC, collection_id ASC, starts_at ASC, id ASC`),
    query(`SELECT * FROM asset_gacha_pack_items ORDER BY pack_id ASC, item_order ASC, id ASC`)
  ]);
  const itemsByPack = new Map();
  for (const item of items.rows) {
    const rows = itemsByPack.get(item.pack_id) || [];
    rows.push(item);
    itemsByPack.set(item.pack_id, rows);
  }
  return {
    seasons: seasons.rows.map(rowToSeason),
    collections: collections.rows.map(rowToCollection),
    packs: packs.rows.map((row) => {
      const runtimePack = rowPackToRuntimePack(row, itemsByPack.get(row.id) || []);
      return {
        ...rowToPack(row),
        validation: validateAssetPack(runtimePack),
        itemCount: runtimePack.items.length
      };
    }),
    items: items.rows.map(rowToPackItem),
    assetOptions: getAssetCatalog().map((asset) => ({
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
    }))
  };
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
        $13, $14, $15, $16, $17, $18, $19, $20, NULL, NULL, $21, $22)`,
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

export async function validateGachaAdminPack({ packId } = {}) {
  const row = await requireRow({ query }, 'asset_gacha_packs', packId, 'gacha pack');
  const { runtimePack, validation, shapedPack } = await validationForPackRow({ query }, row);
  return {
    pack: rowToPack(row),
    runtimePack,
    validation,
    preview: shapedPack
  };
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
    let validation = (await validationForPackRow(client, beforeRow)).validation;
    if (['approve', 'publish'].includes(normalizedAction) && !validation.ok) {
      throw new Error(`Gacha pack validation failed: ${validation.errors.map((issue) => issue.code).join(', ')}`);
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
    validation = (await validationForPackRow(client, afterRow)).validation;
    const after = rowToPack(afterRow);
    const audit = await insertAdminAction(client, {
      actorId: actor,
      actionType: `gacha_pack_${normalizedAction}`,
      targetType: 'gacha_pack',
      targetId: packId,
      reason: actionReason,
      note: actionNote,
      evidence: actionEvidence,
      result: { before, after, validation }
    });
    return { pack: after, validation, action: audit };
  });
}
