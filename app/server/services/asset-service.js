import crypto from 'crypto';
import {
  advanceAssetGachaPackPityState,
  assetGachaBurnableDuplicateRows,
  assetGachaPackRollSize,
  chooseWeightedAssetGachaCandidate,
  computeAssetGachaPackPityState,
  evaluateAssetAcquisitionPolicy,
  getAssetGachaPackAvailability,
  hashAssetGachaCandidatePool,
  normalizeAssetGachaBurnRules,
  normalizeAssetGachaDuplicatePolicy,
  resolveAssetGachaRollCandidates,
  selectAssetGachaBurnTargets,
  selectAssetGachaRollResults,
  shapeAssetGachaPack,
  validateAssetGachaPack
} from '@microwavedev/backpack-game-core/modules/gacha';
import { query, withTransaction } from '../db.js';
import {
  PORTRAIT_VARIANTS,
  portraitVariantsForResponse,
  portraitUrl
} from '../game-data.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';
import {
  spendCurrency,
  WALLET_CURRENCY_CODE,
  withWalletMutationLock
} from './wallet-service.js';
import { withMutationClaim } from './mutation-claim-service.js';

const PORTRAIT_PACK_ID = 'season_1_portraits';
const VALID_PACK_STATUSES = new Set(['active', 'future', 'expired', 'disabled']);
const MIN_ASSET_PACK_ROLL_SIZE = 1;
const MAX_ASSET_PACK_ROLL_SIZE = 10;
const ASSET_RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'secret'];
const SUPPORTED_PITY_RESET_SCOPES = new Set(['pack']);
const SUPPORTED_DUPLICATE_POLICY_MODES = new Set(['unowned_only', 'allow_duplicates']);
const SUPPORTED_BURN_TARGET_DUPLICATE_POLICIES = new Set(['allow_duplicates', 'unowned_first', 'unowned_only']);
const MAX_BURN_TARGET_COUNT = 10;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parseCsvEnv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseJsonEnv(name, fallback = {}) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function assetGachaCoreOptions(extra = {}) {
  return {
    validRarities: ASSET_RARITY_ORDER,
    validPackStatuses: [...VALID_PACK_STATUSES],
    supportedPityResetScopes: [...SUPPORTED_PITY_RESET_SCOPES],
    supportedDuplicatePolicyModes: [...SUPPORTED_DUPLICATE_POLICY_MODES],
    supportedBurnTargetDuplicatePolicies: [...SUPPORTED_BURN_TARGET_DUPLICATE_POLICIES],
    minRollSize: MIN_ASSET_PACK_ROLL_SIZE,
    maxRollSize: MAX_ASSET_PACK_ROLL_SIZE,
    maxBurnTargetCount: MAX_BURN_TARGET_COUNT,
    currencyCode: WALLET_CURRENCY_CODE,
    ...extra
  };
}

export function isAssetGachaEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.ASSET_GACHA_ENABLED || '').toLowerCase());
}

export function directBuyPolicy() {
  return process.env.ASSET_GACHA_DIRECT_BUY_POLICY || 'allow';
}

function configuredActiveGachaPackIds() {
  const configured = parseCsvEnv(process.env.ASSET_GACHA_ACTIVE_PACK_IDS);
  return configured.length ? configured : null;
}

export function activeGachaPackIds() {
  return configuredActiveGachaPackIds() || [PORTRAIT_PACK_ID];
}

export function assetGachaDbPacksEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.ASSET_GACHA_DB_PACKS_ENABLED || '').toLowerCase());
}

function rarityForPortraitVariant(variant) {
  const cost = Number(variant.cost || 0);
  if (cost >= 1500) return { rarity: 'epic', dropWeight: 10 };
  if (cost >= 500) return { rarity: 'rare', dropWeight: 30 };
  return { rarity: 'common', dropWeight: 100 };
}

function acquisitionPolicyForAsset(assetId, price) {
  const overrides = parseJsonEnv('ASSET_CATALOG_POLICY_JSON', {});
  const override = overrides[assetId] && typeof overrides[assetId] === 'object' ? overrides[assetId] : {};
  const configuredDefault = process.env.ASSET_CATALOG_DEFAULT_PAID_MODE;
  const defaultMode = price > 0 && ['direct', 'gacha', 'both'].includes(configuredDefault)
    ? configuredDefault
    : price > 0 ? 'both' : 'direct';
  const acquisitionMode = ['direct', 'gacha', 'both'].includes(override.acquisitionMode)
    ? override.acquisitionMode
    : defaultMode;
  const packId = Object.hasOwn(override, 'packId')
    ? override.packId
    : (price > 0 && acquisitionMode !== 'direct' ? PORTRAIT_PACK_ID : null);
  return { acquisitionMode, packId };
}

export function portraitAssetId(mushroomId, portraitId = 'default') {
  return `portrait.${mushroomId}.${portraitId}`;
}

export function parsePortraitAssetId(assetId) {
  const portraitMatch = String(assetId || '').match(/^portrait\.([^.]+)\.(.+)$/);
  if (portraitMatch) return { mushroomId: portraitMatch[1], portraitId: portraitMatch[2] };
  const planMatch = String(assetId || '').match(/^planned_portrait\.([^.]+)\.(.+)$/);
  if (planMatch) {
    return {
      mushroomId: planMatch[1],
      portraitId: planPortraitVariantId(planMatch[2]),
      planItemId: planMatch[2]
    };
  }
  return null;
}

export function getAssetCatalog() {
  const assets = [];
  for (const [mushroomId, variants] of Object.entries(PORTRAIT_VARIANTS)) {
    for (const variant of variants) {
      const price = Number(variant.cost || 0);
      const rarity = rarityForPortraitVariant(variant);
      const assetId = portraitAssetId(mushroomId, variant.id);
      const acquisition = acquisitionPolicyForAsset(assetId, price);
      assets.push({
        assetId,
        slot: 'portrait',
        targetType: 'character',
        targetId: mushroomId,
        variantId: variant.id,
        name: variant.name,
        path: portraitUrl(mushroomId, variant.id),
        price,
        currencyCode: WALLET_CURRENCY_CODE,
        acquisitionMode: acquisition.acquisitionMode,
        packId: acquisition.packId,
        rarity: price > 0 ? rarity.rarity : null,
        dropWeight: price > 0 ? rarity.dropWeight : 0,
        maxCopiesPerPlayer: 1
      });
    }
  }
  return assets;
}

export function getAssetById(assetId) {
  return getAssetCatalog().find((asset) => asset.assetId === assetId) || null;
}

function planPortraitVariantId(planItemId) {
  return `plan_${String(planItemId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function assetByIdFromCatalog(catalog, assetId) {
  return (catalog || []).find((asset) => asset.assetId === assetId) || null;
}

function planAssetName(row, metadata = {}) {
  if (metadata.name && typeof metadata.name === 'object') return metadata.name;
  const character = String(row.character_id || '').trim();
  const label = character ? character[0].toUpperCase() + character.slice(1) : 'Character';
  const fallback = row.file_name
    ? `${label} ${String(row.file_name).replace(/\.[^.]+$/, '')}`
    : `${label} season portrait`;
  return { en: fallback, ru: fallback };
}

function rowToPlanAsset(row, packIds = []) {
  const metadata = parseJson(row.metadata_json, {});
  return {
    assetId: row.asset_id,
    slot: 'portrait',
    targetType: 'character',
    targetId: row.character_id,
    variantId: planPortraitVariantId(row.id),
    name: planAssetName(row, metadata),
    path: row.image_path,
    price: null,
    currencyCode: WALLET_CURRENCY_CODE,
    acquisitionMode: 'gacha',
    packId: metadata.primaryPackId || packIds[0] || null,
    packIds,
    rarity: row.rarity || 'common',
    dropWeight: Number(row.drop_weight || 1),
    maxCopiesPerPlayer: 1,
    source: 'gacha_plan',
    planItemId: row.id,
    status: row.status
  };
}

function normalizePlanAssetVisibility(value) {
  if (value === 'all' || value === 'admin') return 'all';
  return 'runtime';
}

function visiblePlanRowsQuery(planAssetVisibility) {
  if (planAssetVisibility === 'all') {
    return {
      text: `SELECT *
       FROM asset_gacha_plan_items
       WHERE status = 'ready'
       ORDER BY season_id ASC, character_id ASC, created_at ASC, id ASC`,
      params: []
    };
  }
  return {
    text: `SELECT *
     FROM asset_gacha_plan_items pi
     WHERE pi.status = 'ready'
       AND EXISTS (
         SELECT 1
         FROM asset_gacha_pack_items item
         JOIN asset_gacha_packs p ON p.id = item.pack_id
         JOIN asset_gacha_seasons s ON s.id = p.season_id
         JOIN asset_gacha_collections c ON c.id = p.collection_id
         WHERE item.asset_id = pi.asset_id
           AND p.review_status = 'approved'
           AND p.status IN ('active', 'future', 'expired')
           AND s.status IN ('active', 'future', 'expired')
           AND c.status IN ('active', 'future', 'expired')
       )
     ORDER BY pi.season_id ASC, pi.character_id ASC, pi.created_at ASC, pi.id ASC`,
    params: []
  };
}

function visiblePlanPackLinksQuery(placeholders, planAssetVisibility) {
  if (planAssetVisibility === 'all') {
    return `SELECT DISTINCT asset_id, pack_id
     FROM asset_gacha_pack_items
     WHERE asset_id IN (${placeholders})
     ORDER BY pack_id ASC`;
  }
  return `SELECT DISTINCT item.asset_id, item.pack_id
   FROM asset_gacha_pack_items item
   JOIN asset_gacha_packs p ON p.id = item.pack_id
   JOIN asset_gacha_seasons s ON s.id = p.season_id
   JOIN asset_gacha_collections c ON c.id = p.collection_id
   WHERE item.asset_id IN (${placeholders})
     AND p.review_status = 'approved'
     AND p.status IN ('active', 'future', 'expired')
     AND s.status IN ('active', 'future', 'expired')
     AND c.status IN ('active', 'future', 'expired')
   ORDER BY item.pack_id ASC`;
}

export async function getRuntimeAssetCatalog({ client = null, planAssetVisibility = 'runtime' } = {}) {
  const staticAssets = getAssetCatalog();
  const visibility = normalizePlanAssetVisibility(planAssetVisibility);
  const planRowsQuery = visiblePlanRowsQuery(visibility);
  const planRows = await runAssetCatalogQuery(
    client,
    planRowsQuery.text,
    planRowsQuery.params
  );
  if (!planRows.rowCount) return staticAssets;

  const assetIds = planRows.rows.map((row) => row.asset_id);
  const placeholders = assetIds.map((_, index) => `$${index + 1}`).join(', ');
  const packLinks = await runAssetCatalogQuery(
    client,
    visiblePlanPackLinksQuery(placeholders, visibility),
    assetIds
  );
  const packIdsByAssetId = new Map();
  for (const row of packLinks.rows) {
    const list = packIdsByAssetId.get(row.asset_id) || [];
    list.push(row.pack_id);
    packIdsByAssetId.set(row.asset_id, list);
  }

  return [
    ...staticAssets,
    ...planRows.rows.map((row) => rowToPlanAsset(row, packIdsByAssetId.get(row.asset_id) || []))
  ];
}

export async function getRuntimeAssetById(assetId, { client = null, planAssetVisibility = 'runtime' } = {}) {
  return assetByIdFromCatalog(await getRuntimeAssetCatalog({ client, planAssetVisibility }), assetId);
}

export async function getRuntimePortraitVariantsForResponse({ client = null, planAssetVisibility = 'runtime' } = {}) {
  const variantsByCharacter = portraitVariantsForResponse();
  const runtimeCatalog = await getRuntimeAssetCatalog({ client, planAssetVisibility });
  for (const asset of runtimeCatalog) {
    if (asset.source !== 'gacha_plan' || asset.slot !== 'portrait' || asset.targetType !== 'character') continue;
    const list = variantsByCharacter[asset.targetId] || [];
    if (list.some((variant) => variant.id === asset.variantId)) continue;
    list.push({
      id: asset.variantId,
      cost: asset.price,
      path: asset.path,
      name: asset.name,
      source: asset.source,
      assetId: asset.assetId,
      rarity: asset.rarity,
      packId: asset.packId
    });
    variantsByCharacter[asset.targetId] = list;
  }
  return variantsByCharacter;
}

function configuredRollPriceAmount() {
  const value = Number(process.env.ASSET_GACHA_ROLL_PRICE_AMOUNT || 500);
  return Number.isInteger(value) && value > 0 ? value : 500;
}

function configuredRollSize() {
  const value = Number(process.env.ASSET_GACHA_ROLL_SIZE || 1);
  return Number.isInteger(value) && value >= MIN_ASSET_PACK_ROLL_SIZE && value <= MAX_ASSET_PACK_ROLL_SIZE
    ? value
    : 1;
}

function assetPackRollSize(pack) {
  return assetGachaPackRollSize(pack);
}

function normalizedDuplicatePolicy(pack) {
  return normalizeAssetGachaDuplicatePolicy(pack, assetGachaCoreOptions());
}

function normalizedBurnRules(pack) {
  return normalizeAssetGachaBurnRules(pack);
}

export function validateAssetPack(pack, {
  catalog = getAssetCatalog()
} = {}) {
  return validateAssetGachaPack(pack, assetGachaCoreOptions({ catalog }));
}

function packAvailability(pack, now = new Date(), catalog = getAssetCatalog()) {
  return getAssetGachaPackAvailability(pack, assetGachaCoreOptions({
    now,
    catalog,
    activePackIds: configuredActiveGachaPackIds(),
    gachaEnabled: isAssetGachaEnabled()
  }));
}

function assetRarityForPack(pack, assetId, metadataItem = null, catalog = getAssetCatalog()) {
  if (metadataItem?.rarity) return metadataItem.rarity;
  const packItem = (pack?.items || []).find((item) => item.assetId === assetId);
  if (packItem?.rarity) return packItem.rarity;
  return assetByIdFromCatalog(catalog, assetId)?.rarity || 'common';
}

export function computePackPityState(pack, {
  rolls = []
} = {}) {
  return computeAssetGachaPackPityState(pack, assetGachaCoreOptions({ rolls }));
}

function advancePackPityState(pityBefore, selectedItems) {
  return advanceAssetGachaPackPityState(pityBefore, selectedItems, assetGachaCoreOptions());
}

function burnableDuplicateRows(pack, activeAssetRows = [], rule, equippedInstanceIds = new Set()) {
  return assetGachaBurnableDuplicateRows(pack, activeAssetRows, rule, equippedInstanceIds);
}

export function shapeAssetPack(pack, {
  ownedAssetIds = [],
  includeAssets = false,
  now = new Date(),
  rollHistory = [],
  activeAssetRows = [],
  equippedAssetInstanceIds = [],
  catalog = getAssetCatalog()
} = {}) {
  return shapeAssetGachaPack(pack, assetGachaCoreOptions({
    ownedAssetIds,
    includeAssets,
    now,
    rollHistory,
    activeAssetRows,
    equippedAssetInstanceIds,
    catalog,
    activePackIds: configuredActiveGachaPackIds(),
    gachaEnabled: isAssetGachaEnabled()
  }));
}

export function getAssetPacks() {
  const assets = getAssetCatalog().filter((asset) => asset.packId === PORTRAIT_PACK_ID);
  const packOverrides = parseJsonEnv('ASSET_GACHA_PACK_OVERRIDES_JSON', {});
  const rollSize = configuredRollSize();
  const pack = {
      id: PORTRAIT_PACK_ID,
      seasonId: 'season_1',
      collectionId: 'portraits',
      name: { en: 'Season 1 Portrait Pack', ru: 'Портреты сезона 1' },
      status: 'active',
      startsAt: null,
      endsAt: null,
      rollPriceCurrencyCode: WALLET_CURRENCY_CODE,
      rollPriceAmount: configuredRollPriceAmount(),
      rollSize,
      rarityTableVersion: `${PORTRAIT_PACK_ID}:v1`,
      items: assets.map((asset) => ({
        assetId: asset.assetId,
        rarity: asset.rarity || 'common',
        dropWeight: asset.dropWeight || 1
      }))
  };
  const override = packOverrides[PORTRAIT_PACK_ID] && typeof packOverrides[PORTRAIT_PACK_ID] === 'object'
    ? packOverrides[PORTRAIT_PACK_ID]
    : {};
  return [
    {
      ...pack,
      ...override,
      items: Array.isArray(override.items) ? override.items : pack.items
    }
  ];
}

async function runAssetCatalogQuery(client, sql, params = []) {
  return client?.query ? client.query(sql, params) : query(sql, params);
}

function parsedDbJson(value, fallback = undefined) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  return parseJson(value, fallback);
}

function assignDbJsonField(pack, key, value) {
  const parsed = parsedDbJson(value, undefined);
  if (parsed !== undefined) pack[key] = parsed;
}

function inheritedDbPackStatus(row) {
  const statuses = [row.season_status, row.collection_status, row.status].map((status) => String(status || 'active'));
  if (statuses.includes('expired')) return 'expired';
  if (statuses.includes('future')) return 'future';
  return String(row.status || 'active');
}

function shapeDatabaseAssetPack(row, itemRows = []) {
  const pack = {
    id: row.id,
    seasonId: row.season_id,
    collectionId: row.collection_id,
    name: parsedDbJson(row.name_json, {}),
    status: inheritedDbPackStatus(row),
    startsAt: row.starts_at || row.collection_starts_at || row.season_starts_at || null,
    endsAt: row.ends_at || row.collection_ends_at || row.season_ends_at || null,
    rollPriceCurrencyCode: row.roll_price_currency_code,
    rollPriceAmount: Number(row.roll_price_amount),
    rollSize: Number(row.roll_size || 1),
    rarityTableVersion: row.rarity_table_version || `${row.id}:db:${row.updated_at || row.reviewed_at || row.created_at || 'v1'}`,
    source: 'database',
    reviewStatus: row.review_status,
    metadata: parsedDbJson(row.metadata_json, {}),
    items: itemRows
      .sort((a, b) => Number(a.item_order || 0) - Number(b.item_order || 0) || String(a.id).localeCompare(String(b.id)))
      .map((item) => ({
        assetId: item.asset_id,
        rarity: item.rarity,
        dropWeight: Number(item.drop_weight),
        ...(item.copy_limit === null || item.copy_limit === undefined ? {} : { copyLimit: Number(item.copy_limit) }),
        metadata: parsedDbJson(item.metadata_json, {})
      }))
  };
  assignDbJsonField(pack, 'rarityWeights', row.rarity_weights_json);
  assignDbJsonField(pack, 'slots', row.slots_json);
  assignDbJsonField(pack, 'guarantees', row.guarantees_json);
  assignDbJsonField(pack, 'pityRules', row.pity_rules_json);
  assignDbJsonField(pack, 'duplicatePolicy', row.duplicate_policy_json);
  assignDbJsonField(pack, 'burnRules', row.burn_rules_json);
  return pack;
}

export async function getDatabaseAssetPacks({ client = null } = {}) {
  if (!assetGachaDbPacksEnabled()) return [];
  const packRows = await runAssetCatalogQuery(
    client,
    `SELECT p.*,
            s.status AS season_status,
            s.starts_at AS season_starts_at,
            s.ends_at AS season_ends_at,
            c.status AS collection_status,
            c.starts_at AS collection_starts_at,
            c.ends_at AS collection_ends_at
     FROM asset_gacha_packs p
     JOIN asset_gacha_seasons s ON s.id = p.season_id
     JOIN asset_gacha_collections c ON c.id = p.collection_id
     WHERE p.review_status = 'approved'
       AND p.status IN ('active', 'future', 'expired')
       AND s.status IN ('active', 'future', 'expired')
       AND c.status IN ('active', 'future', 'expired')
     ORDER BY COALESCE(p.starts_at, c.starts_at, s.starts_at, ''), p.id`,
    []
  );
  if (!packRows.rowCount) return [];
  const placeholders = packRows.rows.map((_, index) => `$${index + 1}`).join(', ');
  const itemRows = await runAssetCatalogQuery(
    client,
    `SELECT *
     FROM asset_gacha_pack_items
     WHERE pack_id IN (${placeholders})
     ORDER BY pack_id, item_order ASC, id ASC`,
    packRows.rows.map((row) => row.id)
  );
  const itemsByPack = new Map();
  for (const row of itemRows.rows) {
    const rows = itemsByPack.get(row.pack_id) || [];
    rows.push(row);
    itemsByPack.set(row.pack_id, rows);
  }
  return packRows.rows.map((row) => shapeDatabaseAssetPack(row, itemsByPack.get(row.id) || []));
}

export async function getRuntimeAssetPacks({ client = null } = {}) {
  const byId = new Map(getAssetPacks().map((pack) => [pack.id, pack]));
  for (const pack of await getDatabaseAssetPacks({ client })) {
    byId.set(pack.id, pack);
  }
  return [...byId.values()];
}

export function getAssetPack(packId) {
  return getAssetPacks().find((pack) => pack.id === packId) || null;
}

export async function getRuntimeAssetPack(packId, { client = null } = {}) {
  return (await getRuntimeAssetPacks({ client })).find((pack) => pack.id === packId) || null;
}

export async function getAssetPacksForPlayer(playerId) {
  const [packs, catalog, ownedRows, rollRows, equippedRows] = await Promise.all([
    getRuntimeAssetPacks(),
    getRuntimeAssetCatalog(),
    query(
      `SELECT * FROM player_asset_instances
       WHERE player_id = $1 AND status = 'active'`,
      [playerId]
    ),
    query(
      `SELECT * FROM asset_rolls
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      [playerId]
    ),
    query(
      `SELECT asset_instance_id FROM player_equipped_assets
       WHERE player_id = $1 AND asset_instance_id IS NOT NULL`,
      [playerId]
    )
  ]);
  const ownedAssetIds = new Set(ownedRows.rows.map((row) => row.asset_id));
  const equippedAssetInstanceIds = new Set(equippedRows.rows.map((row) => row.asset_instance_id));
  return packs.map((pack) => shapeAssetPack(pack, {
    ownedAssetIds,
    activeAssetRows: ownedRows.rows,
    equippedAssetInstanceIds,
    rollHistory: rollRows.rows.filter((row) => row.pack_id === pack.id),
    catalog
  }));
}

function packIsActive(pack, now = new Date(), catalog = getAssetCatalog()) {
  return packAvailability(pack, now, catalog) === 'active';
}

export function assetPolicy(asset) {
  if (!asset) return null;
  const gachaEnabled = isAssetGachaEnabled();
  const pack = asset.packId ? getAssetPack(asset.packId) : null;
  const availability = pack ? packAvailability(pack) : null;
  return evaluateAssetAcquisitionPolicy(asset, {
    gachaEnabled,
    directBuyPolicy: directBuyPolicy(),
    pack,
    packAvailability: availability
  });
}

async function activeAssetInstance(client, playerId, assetId) {
  const result = await client.query(
    `SELECT * FROM player_asset_instances
     WHERE player_id = $1 AND asset_id = $2 AND status = 'active'
     ORDER BY acquired_at ASC
     LIMIT 1`,
    [playerId, assetId]
  );
  return result.rows[0] || null;
}

async function insertAssetInstance(client, {
  playerId,
  assetId,
  acquisitionSource,
  acquisitionSourceId = null,
  metadata = {},
  allowDuplicate = false
}) {
  if (!allowDuplicate) {
    const existing = await activeAssetInstance(client, playerId, assetId);
    if (existing) return { row: existing, alreadyOwned: true };
  }

  const row = {
    id: createId('asset'),
    playerId,
    assetId,
    acquisitionSource,
    acquisitionSourceId,
    acquiredAt: nowIso(),
    metadata
  };
  await client.query(
    `INSERT INTO player_asset_instances
     (id, player_id, asset_id, acquisition_source, acquisition_source_id, status, acquired_at, metadata_json)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)`,
    [
      row.id,
      row.playerId,
      row.assetId,
      row.acquisitionSource,
      row.acquisitionSourceId,
      row.acquiredAt,
      JSON.stringify(row.metadata)
    ]
  );
  return {
    row: {
      id: row.id,
      player_id: row.playerId,
      asset_id: row.assetId,
      acquisition_source: row.acquisitionSource,
      acquisition_source_id: row.acquisitionSourceId,
      status: 'active',
      acquired_at: row.acquiredAt,
      metadata_json: JSON.stringify(row.metadata)
    },
    alreadyOwned: false
  };
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

export async function getPlayerCosmeticState(playerId) {
  const [instances, equipped] = await Promise.all([
    query(
      `SELECT * FROM player_asset_instances
       WHERE player_id = $1 AND status = 'active'`,
      [playerId]
    ),
    query(
      `SELECT * FROM player_equipped_assets
       WHERE player_id = $1`,
      [playerId]
    )
  ]);
  const ownedAssetIds = new Set(instances.rows.map((row) => row.asset_id));
  const instancesByAssetId = new Map(instances.rows.map((row) => [row.asset_id, rowToAssetInstance(row)]));
  const equippedByTarget = new Map();
  for (const row of equipped.rows) {
    equippedByTarget.set(`${row.slot}:${row.target_type}:${row.target_id || ''}`, {
      id: row.id,
      assetId: row.asset_id,
      assetInstanceId: row.asset_instance_id || null,
      equippedAt: row.equipped_at
    });
  }
  return { ownedAssetIds, instancesByAssetId, equippedByTarget };
}

export function shapePortraitVariant({
  mushroomId,
  variant,
  cosmeticState,
  activePortraitId = 'default',
  catalog = getAssetCatalog()
}) {
  const asset = assetByIdFromCatalog(catalog, variant.assetId || portraitAssetId(mushroomId, variant.id));
  if (!asset) return null;
  const owned = asset.price === 0 || cosmeticState.ownedAssetIds.has(asset.assetId);
  const policy = asset.source === 'gacha_plan'
    ? {
      acquisitionMode: asset.acquisitionMode,
      purchaseAvailable: false,
      rollAvailable: false,
      gachaEnabled: isAssetGachaEnabled(),
      directBuyPolicy: directBuyPolicy(),
      activePackId: asset.packId || null
    }
    : assetPolicy(asset);
  return {
    ...variant,
    assetId: asset.assetId,
    price: asset.price,
    cost: asset.price,
    currencyCode: asset.currencyCode,
    owned,
    unlocked: owned,
    active: activePortraitId === variant.id,
    acquisitionMode: policy.acquisitionMode,
    purchaseAvailable: policy.purchaseAvailable,
    rollAvailable: policy.rollAvailable,
    packId: asset.packId,
    rarity: asset.rarity
  };
}

export async function resolveEquippedPortraitId(client, playerId, mushroomId) {
  const equipped = await client.query(
    `SELECT asset_id FROM player_equipped_assets
     WHERE player_id = $1 AND slot = 'portrait' AND target_type = 'character' AND target_id = $2
     LIMIT 1`,
    [playerId, mushroomId]
  );
  const parsed = equipped.rowCount ? parsePortraitAssetId(equipped.rows[0].asset_id) : null;
  if (parsed?.mushroomId === mushroomId) return parsed.portraitId;
  if (equipped.rowCount) {
    const dynamic = await client.query(
      `SELECT id
       FROM asset_gacha_plan_items
       WHERE asset_id = $1
         AND character_id = $2
         AND status = 'ready'
       LIMIT 1`,
      [equipped.rows[0].asset_id, mushroomId]
    );
    if (dynamic.rowCount) return planPortraitVariantId(dynamic.rows[0].id);
  }

  const legacy = await client.query(
    `SELECT active_portrait FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
    [playerId, mushroomId]
  );
  return legacy.rows[0]?.active_portrait || 'default';
}

export async function purchaseAsset(playerId, assetId, {
  idempotencyKey = null
} = {}) {
  const asset = await getRuntimeAssetById(assetId);
  if (!asset) throw httpError('Unknown asset', 404);
  const policy = assetPolicy(asset);
  if (!policy.purchaseAvailable) {
    throw httpError('Direct purchase is unavailable for this asset', 403);
  }

  return withMutationClaim('asset_purchase', `${playerId}:${asset.assetId}`, () =>
    withWalletMutationLock(playerId, () => withTransaction(async (client) => {
      const existing = await activeAssetInstance(client, playerId, asset.assetId);
      if (existing) {
        return {
          asset,
          instance: rowToAssetInstance(existing),
          alreadyOwned: true,
          transaction: null
        };
      }

      let transaction = null;
      if (asset.price > 0) {
        transaction = await spendCurrency(client, {
          playerId,
          currencyCode: asset.currencyCode,
          amount: asset.price,
          reason: 'asset_purchase',
          sourceType: 'asset',
          sourceId: asset.assetId,
          idempotencyKey: idempotencyKey
            ? `asset_purchase:${asset.assetId}:${idempotencyKey}`
            : `asset_purchase:${asset.assetId}`,
          metadata: {
            slot: asset.slot,
            targetType: asset.targetType,
            targetId: asset.targetId
          }
        });
      }

      const inserted = await insertAssetInstance(client, {
        playerId,
        assetId: asset.assetId,
        acquisitionSource: asset.price > 0 ? 'direct_purchase' : 'free',
        acquisitionSourceId: transaction?.id || null,
        metadata: {
          price: asset.price,
          currencyCode: asset.currencyCode
        }
      });

      return {
        asset,
        instance: rowToAssetInstance(inserted.row),
        alreadyOwned: inserted.alreadyOwned,
        transaction
      };
    }))
  );
}

export async function equipAsset(playerId, assetId) {
  const asset = await getRuntimeAssetById(assetId);
  if (!asset) throw httpError('Unknown asset', 404);
  if (asset.slot !== 'portrait' || asset.targetType !== 'character') {
    throw httpError('Unsupported asset equipment slot', 400);
  }

  return withWalletMutationLock(playerId, () => withTransaction(async (client) => {
    let instance = null;
    if (asset.price !== 0) {
      instance = await activeAssetInstance(client, playerId, asset.assetId);
      if (!instance) throw httpError('Asset is not owned', 403);
    }

    const existing = await client.query(
      `SELECT id FROM player_equipped_assets
       WHERE player_id = $1 AND slot = $2 AND target_type = $3 AND target_id = $4
       LIMIT 1`,
      [playerId, asset.slot, asset.targetType, asset.targetId]
    );
    const now = nowIso();
    if (existing.rowCount) {
      await client.query(
        `UPDATE player_equipped_assets
         SET asset_instance_id = $2, asset_id = $3, equipped_at = $4
         WHERE id = $1`,
        [existing.rows[0].id, instance?.id || null, asset.assetId, now]
      );
    } else {
      await client.query(
        `INSERT INTO player_equipped_assets
         (id, player_id, slot, target_type, target_id, asset_instance_id, asset_id, equipped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          createId('equip'),
          playerId,
          asset.slot,
          asset.targetType,
          asset.targetId,
          instance?.id || null,
          asset.assetId,
          now
        ]
      );
    }

    await client.query(
      `UPDATE player_mushrooms SET active_portrait = $1 WHERE player_id = $2 AND mushroom_id = $3`,
      [asset.variantId, playerId, asset.targetId]
    );

    return {
      assetId: asset.assetId,
      portraitId: asset.variantId,
      path: asset.path,
      targetId: asset.targetId
    };
  }));
}

export async function equipPortrait(playerId, mushroomId, portraitId) {
  const variants = PORTRAIT_VARIANTS[mushroomId];
  if (!variants) throw httpError('Unknown mushroom', 404);
  const variant = variants.find((candidate) => candidate.id === portraitId);
  if (!variant) throw httpError('Unknown portrait', 400);
  return equipAsset(playerId, portraitAssetId(mushroomId, portraitId));
}

function secureRandomUnit() {
  return crypto.randomInt(0, 0x100000000) / 0x100000000;
}

export function chooseWeightedAssetCandidate(candidates, rng) {
  try {
    return chooseWeightedAssetGachaCandidate(candidates, rng);
  } catch (error) {
    throw httpError(error.message, 400);
  }
}

export function selectAssetPackRollResults(candidates, pack, {
  rng = secureRandomUnit,
  pityState = []
} = {}) {
  try {
    return selectAssetGachaRollResults(candidates, pack, assetGachaCoreOptions({ rng, pityState }));
  } catch (error) {
    throw httpError(error.message, 400);
  }
}

export function resolveAssetPackRollCandidates(pack, {
  ownedAssetIds = [],
  activeAssetRows = [],
  copyCounts = null,
  includeOwned = normalizedDuplicatePolicy(pack).enabled,
  catalog = getAssetCatalog()
} = {}) {
  return resolveAssetGachaRollCandidates(pack, assetGachaCoreOptions({
    ownedAssetIds,
    activeAssetRows,
    copyCounts,
    includeOwned,
    catalog
  }));
}

function hashCandidatePool(candidates) {
  return hashAssetGachaCandidatePool(candidates);
}

function rowToRoll(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    packId: row.pack_id,
    currencyCode: row.currency_code,
    priceAmount: Number(row.price_amount || 0),
    resultAssetIds: parseJson(row.result_asset_ids_json, []),
    guaranteeState: parseJson(row.guarantee_state_json, {}),
    candidatePoolHash: row.candidate_pool_hash || null,
    selectedAssetId: row.selected_asset_id || null,
    resultInstanceId: row.result_instance_id || null,
    idempotencyKey: row.idempotency_key || null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

function localizedName(name) {
  if (!name || typeof name !== 'object') return name || '';
  return name.en || Object.values(name)[0] || '';
}

function shapeAssetRollResult(roll, {
  asset = null,
  pack = null,
  instance = null,
  rarity = null,
  items = null,
  catalog = getAssetCatalog()
} = {}) {
  const selectedAsset = asset || assetByIdFromCatalog(catalog, roll.selectedAssetId || roll.resultAssetIds?.[0]);
  const selectedPack = pack || getAssetPack(roll.packId);
  const metadataItems = Array.isArray(roll.metadata?.results) ? roll.metadata.results : [];
  const resultItems = Array.isArray(items)
    ? items
    : (roll.resultAssetIds || []).map((assetId, index) => {
      const metadataItem = metadataItems.find((entry) => entry.assetId === assetId) || metadataItems[index] || {};
      const itemAsset = assetByIdFromCatalog(catalog, assetId);
      return {
        slotIndex: Number.isInteger(Number(metadataItem.slotIndex)) ? Number(metadataItem.slotIndex) : index,
        assetId,
        assetName: itemAsset?.name || null,
        assetPath: itemAsset?.path || null,
        rarity: metadataItem.rarity || itemAsset?.rarity || null,
        selectedRarity: metadataItem.selectedRarity || metadataItem.rarity || itemAsset?.rarity || null,
        duplicateCopy: Boolean(metadataItem.duplicateCopy),
        resultInstanceId: metadataItem.instanceId || (index === 0 ? roll.resultInstanceId : null)
      };
    });
  const firstItem = resultItems[0] || null;
  return {
    rollId: roll.id,
    packId: roll.packId,
    packName: selectedPack ? localizedName(selectedPack.name) : roll.packId,
    assetId: firstItem?.assetId || selectedAsset?.assetId || roll.selectedAssetId || roll.resultAssetIds?.[0] || null,
    assetName: firstItem?.assetName || selectedAsset?.name || null,
    assetPath: firstItem?.assetPath || selectedAsset?.path || null,
    rarity: firstItem?.rarity || rarity || selectedAsset?.rarity || null,
    resultInstanceId: firstItem?.resultInstanceId || instance?.id || roll.resultInstanceId || null,
    count: resultItems.length,
    guaranteesApplied: Array.isArray(roll.guaranteeState?.guaranteesApplied)
      ? roll.guaranteeState.guaranteesApplied
      : [],
    pityBefore: Array.isArray(roll.guaranteeState?.pityBefore) ? roll.guaranteeState.pityBefore : [],
    pityAfter: Array.isArray(roll.guaranteeState?.pityAfter) ? roll.guaranteeState.pityAfter : [],
    items: resultItems
  };
}

function rowToBurnExchange(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    packId: row.pack_id,
    ruleId: row.rule_id,
    sourceAssetInstanceIds: parseJson(row.source_asset_instance_ids_json, []),
    resultAssetIds: parseJson(row.result_asset_ids_json, []),
    resultInstanceIds: parseJson(row.result_instance_ids_json, []),
    idempotencyKey: row.idempotency_key || null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

function shapeAssetBurnResult(exchange, {
  pack = null,
  items = null,
  catalog = getAssetCatalog()
} = {}) {
  const selectedPack = pack || getAssetPack(exchange.packId);
  const resultItems = Array.isArray(items)
    ? items
    : (exchange.resultAssetIds || []).map((assetId, index) => {
      const itemAsset = assetByIdFromCatalog(catalog, assetId);
      return {
        slotIndex: index,
        assetId,
        assetName: itemAsset?.name || null,
        assetPath: itemAsset?.path || null,
        rarity: assetRarityForPack(selectedPack, assetId, null, catalog),
        selectedRarity: assetRarityForPack(selectedPack, assetId, null, catalog),
        duplicateCopy: Boolean(exchange.metadata?.duplicateAssetIds?.includes(assetId)),
        resultInstanceId: exchange.resultInstanceIds?.[index] || null
      };
    });
  const firstItem = resultItems[0] || null;
  return {
    exchangeId: exchange.id,
    packId: exchange.packId,
    packName: selectedPack ? localizedName(selectedPack.name) : exchange.packId,
    ruleId: exchange.ruleId,
    assetId: firstItem?.assetId || exchange.resultAssetIds?.[0] || null,
    assetName: firstItem?.assetName || null,
    assetPath: firstItem?.assetPath || null,
    rarity: firstItem?.rarity || null,
    resultInstanceId: firstItem?.resultInstanceId || exchange.resultInstanceIds?.[0] || null,
    sourceAssetInstanceIds: exchange.sourceAssetInstanceIds,
    count: resultItems.length,
    items: resultItems
  };
}

function selectBurnTargets(pack, rule, rng, {
  ownedAssetIds = [],
  activeAssetRows = [],
  copyCounts = null,
  catalog = getAssetCatalog()
} = {}) {
  try {
    return selectAssetGachaBurnTargets(pack, rule, assetGachaCoreOptions({
      rng,
      ownedAssetIds,
      activeAssetRows,
      copyCounts,
      catalog
    }));
  } catch (error) {
    throw httpError(error.message, 400);
  }
}

export async function burnAssetPackDuplicates(playerId, packId, {
  ruleId = null,
  idempotencyKey = null,
  rng = secureRandomUnit
} = {}) {
  if (!isAssetGachaEnabled()) throw httpError('Asset gacha is disabled', 403);
  const pack = await getRuntimeAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);
  const catalog = await getRuntimeAssetCatalog();
  const validation = validateAssetPack(pack, { catalog });
  if (!validation.ok) {
    throw httpError(`Asset pack configuration is invalid: ${validation.errors.map((issue) => issue.code).join(', ')}`, 400);
  }
  if (!packIsActive(pack, new Date(), catalog)) throw httpError('Asset pack is not active', 403);
  const rules = normalizedBurnRules(pack);
  const rule = ruleId
    ? rules.find((candidate) => candidate.id === ruleId)
    : rules[0];
  if (!rule) throw httpError('Asset pack has no duplicate burn rule', 404);

  return withMutationClaim('asset_burn_exchange', `${playerId}:${pack.id}:${rule.id}`, () =>
    withWalletMutationLock(playerId, () => withTransaction(async (client) => {
      if (idempotencyKey) {
        const existing = await client.query(
          `SELECT * FROM asset_burn_exchanges
           WHERE player_id = $1 AND pack_id = $2 AND rule_id = $3 AND idempotency_key = $4
           LIMIT 1`,
          [playerId, pack.id, rule.id, idempotencyKey]
        );
        if (existing.rowCount) {
          const exchange = rowToBurnExchange(existing.rows[0]);
          return {
            exchange,
            burnResult: shapeAssetBurnResult(exchange, { pack, catalog }),
            alreadyProcessed: true
          };
        }
      }

      const [activeRows, equippedRows] = await Promise.all([
        client.query(
          `SELECT * FROM player_asset_instances
           WHERE player_id = $1 AND status = 'active'
           ORDER BY acquired_at ASC, id ASC`,
          [playerId]
        ),
        client.query(
          `SELECT asset_instance_id FROM player_equipped_assets
           WHERE player_id = $1 AND asset_instance_id IS NOT NULL`,
          [playerId]
        )
      ]);
      const equippedInstanceIds = new Set(equippedRows.rows.map((row) => row.asset_instance_id).filter(Boolean));
      const burnableRows = burnableDuplicateRows(pack, activeRows.rows, rule, equippedInstanceIds)
        .sort((a, b) => {
          const aTime = new Date(a.acquired_at || 0).getTime();
          const bTime = new Date(b.acquired_at || 0).getTime();
          return aTime - bTime || String(a.id).localeCompare(String(b.id));
        });
      if (burnableRows.length < rule.sourceCount) {
        throw httpError('Not enough duplicate assets to burn', 409);
      }

      const sourceRows = burnableRows.slice(0, rule.sourceCount);
      const exchangeId = createId('burn');
      const now = nowIso();
      for (const row of sourceRows) {
        await client.query(
          `UPDATE player_asset_instances
           SET status = 'burned',
               metadata_json = $2
           WHERE id = $1 AND status = 'active'`,
          [
            row.id,
            JSON.stringify({
              ...parseJson(row.metadata_json, {}),
              burnedAt: now,
              burnExchangeId: exchangeId,
              burnRuleId: rule.id,
              burnPackId: pack.id
            })
          ]
        );
      }

      const activeAfterBurnRows = await client.query(
        `SELECT * FROM player_asset_instances
         WHERE player_id = $1 AND status = 'active'`,
        [playerId]
      );
      const ownedAfterBurn = new Set(activeAfterBurnRows.rows.map((row) => row.asset_id));
      const targetItems = selectBurnTargets(pack, rule, rng, {
        ownedAssetIds: ownedAfterBurn,
        activeAssetRows: activeAfterBurnRows.rows,
        catalog
      });
      if (targetItems.length < rule.targetCount) {
        throw httpError('Asset burn target pool is unavailable', 400);
      }

      const insertedItems = [];
      for (const selected of targetItems) {
        const inserted = await insertAssetInstance(client, {
          playerId,
          assetId: selected.assetId,
          acquisitionSource: 'asset_burn_exchange',
          acquisitionSourceId: exchangeId,
          metadata: {
            packId: pack.id,
            burnRuleId: rule.id,
            rarity: selected.rarity,
            selectedRarity: selected.selectedRarity,
            duplicateCopy: ownedAfterBurn.has(selected.assetId),
            sourceAssetInstanceIds: sourceRows.map((row) => row.id)
          },
          allowDuplicate: true
        });
        insertedItems.push({
          ...selected,
          duplicateCopy: ownedAfterBurn.has(selected.assetId),
          instance: rowToAssetInstance(inserted.row)
        });
        ownedAfterBurn.add(selected.assetId);
      }

      const resultAssetIds = insertedItems.map((item) => item.assetId);
      const resultInstanceIds = insertedItems.map((item) => item.instance?.id || null);
      const duplicateAssetIds = insertedItems.filter((item) => item.duplicateCopy).map((item) => item.assetId);
      await client.query(
        `INSERT INTO asset_burn_exchanges
         (id, player_id, pack_id, rule_id, source_asset_instance_ids_json,
          result_asset_ids_json, result_instance_ids_json, idempotency_key,
          metadata_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          exchangeId,
          playerId,
          pack.id,
          rule.id,
          JSON.stringify(sourceRows.map((row) => row.id)),
          JSON.stringify(resultAssetIds),
          JSON.stringify(resultInstanceIds),
          idempotencyKey,
          JSON.stringify({
            rule,
            sourceAssetIds: sourceRows.map((row) => row.asset_id),
            sourceAssetInstanceIds: sourceRows.map((row) => row.id),
            resultAssetIds,
            resultInstanceIds,
            duplicateAssetIds,
            randomSource: rng === secureRandomUnit ? 'crypto.randomInt' : 'injected_rng'
          }),
          now
        ]
      );

      const exchangeRow = await client.query(`SELECT * FROM asset_burn_exchanges WHERE id = $1`, [exchangeId]);
      const exchange = rowToBurnExchange(exchangeRow.rows[0]);
      const resultItems = insertedItems.map((item) => ({
        slotIndex: item.slotIndex,
        assetId: item.assetId,
        assetName: item.asset?.name || null,
        assetPath: item.asset?.path || null,
        rarity: item.rarity,
        selectedRarity: item.selectedRarity,
        duplicateCopy: item.duplicateCopy,
        resultInstanceId: item.instance?.id || null
      }));
      return {
        exchange,
        burnResult: shapeAssetBurnResult(exchange, { pack, items: resultItems, catalog }),
        assets: insertedItems.map((item) => item.asset),
        instances: insertedItems.map((item) => item.instance),
        alreadyProcessed: false
      };
    }))
  );
}

export async function rollAssetPack(playerId, packId, {
  idempotencyKey = null,
  rng = secureRandomUnit
} = {}) {
  if (!isAssetGachaEnabled()) throw httpError('Asset gacha is disabled', 403);
  const pack = await getRuntimeAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);
  const catalog = await getRuntimeAssetCatalog();
  const validation = validateAssetPack(pack, { catalog });
  if (!validation.ok) {
    throw httpError(`Asset pack configuration is invalid: ${validation.errors.map((issue) => issue.code).join(', ')}`, 400);
  }
  if (!packIsActive(pack, new Date(), catalog)) throw httpError('Asset pack is not active', 403);

  return withMutationClaim('asset_roll', `${playerId}:${pack.id}`, () =>
    withWalletMutationLock(playerId, () => withTransaction(async (client) => {
      if (idempotencyKey) {
        const existing = await client.query(
          `SELECT * FROM asset_rolls
           WHERE player_id = $1 AND pack_id = $2 AND idempotency_key = $3
           LIMIT 1`,
          [playerId, packId, idempotencyKey]
        );
        if (existing.rowCount) {
          const roll = rowToRoll(existing.rows[0]);
          return {
            roll,
            rollResult: shapeAssetRollResult(roll, { pack, catalog }),
            alreadyProcessed: true
          };
        }
      }

      const ownedRows = await client.query(
        `SELECT * FROM player_asset_instances
         WHERE player_id = $1 AND status = 'active'`,
        [playerId]
      );
      const owned = new Set(ownedRows.rows.map((row) => row.asset_id));
      const duplicatePolicy = normalizedDuplicatePolicy(pack);
      const candidates = resolveAssetPackRollCandidates(pack, {
        ownedAssetIds: owned,
        activeAssetRows: ownedRows.rows,
        catalog
      });

      if (!candidates.length) {
        throw httpError(duplicatePolicy.enabled
          ? 'No rollable assets left in this pack'
          : 'No unowned assets left in this pack', 409);
      }

      const previousRollRows = await client.query(
        `SELECT * FROM asset_rolls
         WHERE player_id = $1 AND pack_id = $2
         ORDER BY created_at DESC
         LIMIT 200`,
        [playerId, pack.id]
      );
      const pityBefore = computePackPityState(pack, { rolls: previousRollRows.rows });
      const selectedItems = selectAssetPackRollResults(candidates, pack, { rng, pityState: pityBefore });
      if (!selectedItems.length) {
        throw httpError(duplicatePolicy.enabled
          ? 'No rollable assets left in this pack'
          : 'No unowned assets left in this pack', 409);
      }
      const guaranteesApplied = selectedItems.guaranteeApplications || [];
      const pityAfter = advancePackPityState(pityBefore, selectedItems);
      const candidatePoolHash = hashCandidatePool(candidates);
      const resultAssetIds = selectedItems.map((item) => item.assetId);
      const duplicateAssetIds = resultAssetIds.filter((assetId) => owned.has(assetId));
      const rarityTableVersion = pack.rarityTableVersion || `${pack.id}:v1`;
      const transaction = await spendCurrency(client, {
        playerId,
        currencyCode: pack.rollPriceCurrencyCode,
        amount: pack.rollPriceAmount,
        reason: 'asset_pack_roll',
        sourceType: 'asset_pack',
        sourceId: pack.id,
        idempotencyKey: idempotencyKey ? `asset_roll:${pack.id}:${idempotencyKey}` : null,
        metadata: {
          packId: pack.id,
          candidatePoolHash,
          selectedAssetId: resultAssetIds[0] || null,
          selectedAssetIds: resultAssetIds,
          rollSize: assetPackRollSize(pack),
          effectiveRollSize: selectedItems.length,
          rarityTableVersion,
          duplicatePolicy,
          duplicateAssetIds,
          guaranteesApplied: guaranteesApplied.map((entry) => ({
            id: entry.id,
            source: entry.source,
            minRarity: entry.minRarity,
            selectedAssetId: entry.selectedAssetId,
            replacedAssetId: entry.replacedAssetId
          })),
          pityBefore,
          pityAfter
        }
      });

      const rollId = createId('roll');
      const insertedItems = [];
      for (const selected of selectedItems) {
        const inserted = await insertAssetInstance(client, {
          playerId,
          assetId: selected.assetId,
          acquisitionSource: 'gacha',
          acquisitionSourceId: rollId,
          metadata: {
            packId: pack.id,
            slotIndex: selected.slotIndex,
            rarity: selected.rarity,
            selectedRarity: selected.selectedRarity,
            rarityTableVersion,
            duplicatePolicy: duplicatePolicy.mode,
            duplicateCopy: owned.has(selected.assetId),
            guaranteeId: selected.guaranteeId || null,
            guaranteeSource: selected.guaranteeSource || null,
            guaranteeMinRarity: selected.guaranteeMinRarity || null,
            guaranteeReplacedAssetId: selected.guaranteeReplacedAssetId || null,
            transactionId: transaction.id
          },
          allowDuplicate: duplicatePolicy.enabled
        });
        insertedItems.push({
          ...selected,
          instance: rowToAssetInstance(inserted.row)
        });
      }
      const resultItems = insertedItems.map((item) => ({
        slotIndex: item.slotIndex,
        assetId: item.assetId,
        assetName: item.asset?.name || null,
        assetPath: item.asset?.path || null,
        rarity: item.rarity,
        selectedRarity: item.selectedRarity,
        duplicateCopy: owned.has(item.assetId),
        resultInstanceId: item.instance?.id || null
      }));
      const evidenceItems = insertedItems.map((item) => ({
        slotIndex: item.slotIndex,
        assetId: item.assetId,
        instanceId: item.instance?.id || null,
        rarity: item.rarity,
        selectedRarity: item.selectedRarity,
        dropWeight: item.dropWeight,
        slotRarityWeights: item.slotRarityWeights,
        candidatePoolHash: item.candidatePoolHash,
        guaranteeId: item.guaranteeId || null,
        guaranteeSource: item.guaranteeSource || null,
        guaranteeMinRarity: item.guaranteeMinRarity || null,
        guaranteeReplacedAssetId: item.guaranteeReplacedAssetId || null,
        duplicateCopy: owned.has(item.assetId)
      }));

      await client.query(
        `INSERT INTO asset_rolls
         (id, player_id, pack_id, currency_code, price_amount, result_asset_ids_json,
          guarantee_state_json, candidate_pool_hash, selected_asset_id, result_instance_id,
          idempotency_key, metadata_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          rollId,
          playerId,
          pack.id,
          pack.rollPriceCurrencyCode,
          pack.rollPriceAmount,
          JSON.stringify(resultAssetIds),
          JSON.stringify({
            rollSize: assetPackRollSize(pack),
            effectiveRollSize: selectedItems.length,
            rarityTableVersion,
            guaranteesApplied,
            pityBefore,
            pityAfter
          }),
          candidatePoolHash,
          resultAssetIds[0] || null,
          insertedItems[0]?.instance?.id || null,
          idempotencyKey,
          JSON.stringify({
            gachaEnabled: isAssetGachaEnabled(),
            directBuyPolicy: directBuyPolicy(),
            activePackIds: configuredActiveGachaPackIds() || [pack.id],
            randomSource: rng === secureRandomUnit ? 'crypto.randomInt' : 'injected_rng',
            rarityTableVersion,
            rollSize: assetPackRollSize(pack),
            effectiveRollSize: selectedItems.length,
            duplicatePolicy,
            duplicateAssetIds,
            guaranteesApplied,
            pityBefore,
            pityAfter,
            results: evidenceItems
          }),
          nowIso()
        ]
      );

      const rollRow = await client.query(`SELECT * FROM asset_rolls WHERE id = $1`, [rollId]);
      const roll = rowToRoll(rollRow.rows[0]);
      return {
        roll,
        rollResult: shapeAssetRollResult(roll, {
          asset: insertedItems[0]?.asset || null,
          pack,
          instance: insertedItems[0]?.instance || null,
          rarity: insertedItems[0]?.rarity || null,
          items: resultItems,
          catalog
        }),
        asset: insertedItems[0]?.asset || null,
        instance: insertedItems[0]?.instance || null,
        assets: insertedItems.map((item) => item.asset),
        instances: insertedItems.map((item) => item.instance),
        transaction,
        alreadyProcessed: false
      };
    }))
  );
}

export function getPackOdds(packId) {
  const pack = getAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);
  return shapeAssetPack(pack, { includeAssets: true });
}

export async function getPackOddsForRuntime(packId) {
  const pack = await getRuntimeAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);
  const catalog = await getRuntimeAssetCatalog();
  return shapeAssetPack(pack, { includeAssets: true, catalog });
}
