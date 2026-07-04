import crypto from 'crypto';
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
const VALID_ASSET_RARITIES = new Set(['common', 'rare', 'epic', 'legendary', 'secret']);
const VALID_PACK_STATUSES = new Set(['active', 'future', 'expired', 'disabled']);
const MIN_ASSET_PACK_ROLL_SIZE = 1;
const MAX_ASSET_PACK_ROLL_SIZE = 10;
const ASSET_RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'secret'];
const ASSET_RARITY_RANK = new Map(ASSET_RARITY_ORDER.map((rarity, index) => [rarity, index]));
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

function optionalPositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : Number.NaN;
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

function validDateValue(value) {
  if (value === null || value === undefined || value === '') return true;
  return !Number.isNaN(new Date(value).getTime());
}

function packValidationIssue(code, message, itemIndex = null) {
  return { code, message, itemIndex };
}

function assetPackRollSize(pack) {
  const rollSize = Number(pack?.rollSize ?? 1);
  return Number.isInteger(rollSize) ? rollSize : Number.NaN;
}

function rarityRank(rarity) {
  return ASSET_RARITY_RANK.get(String(rarity || 'common')) ?? 0;
}

function rarityAtLeast(rarity, minRarity) {
  return rarityRank(rarity) >= rarityRank(minRarity);
}

function rarityWeightEntries(rarityWeights) {
  if (!rarityWeights || typeof rarityWeights !== 'object' || Array.isArray(rarityWeights)) return [];
  return Object.entries(rarityWeights)
    .map(([rarity, weight]) => [rarity, Number(weight)])
    .filter(([, weight]) => Number.isFinite(weight) && weight > 0);
}

function defaultRarityWeightsForItems(items = []) {
  return items.reduce((weights, item) => {
    const rarity = item.rarity || 'common';
    weights[rarity] = (weights[rarity] || 0) + Math.max(0, Number(item.dropWeight || 0));
    return weights;
  }, {});
}

function rawGuaranteeRules(pack) {
  if (Array.isArray(pack?.guarantees)) return pack.guarantees;
  if (Array.isArray(pack?.guaranteeRules)) return pack.guaranteeRules;
  return [];
}

function normalizedGuaranteeRules(pack) {
  return rawGuaranteeRules(pack).map((rule, index) => {
    const minRarity = String(rule?.minRarity || rule?.rarity || 'rare');
    const count = Number(rule?.count || 1);
    return {
      id: String(rule?.id || `guarantee_${index + 1}_${minRarity}_plus`),
      type: 'min_rarity_count',
      source: 'guarantee',
      minRarity,
      count: Number.isInteger(count) ? count : Number.NaN,
      label: rule?.label || null
    };
  });
}

function rawPityRules(pack) {
  return Array.isArray(pack?.pityRules) ? pack.pityRules : [];
}

function normalizedPityRules(pack) {
  return rawPityRules(pack).map((rule, index) => {
    const minRarity = String(rule?.minRarity || rule?.rarity || 'epic');
    const threshold = Number(rule?.threshold || rule?.opens || 0);
    const count = Number(rule?.count || 1);
    return {
      id: String(rule?.id || `pity_${index + 1}_${minRarity}_plus`),
      type: 'min_rarity_pity',
      source: 'pity',
      minRarity,
      threshold: Number.isInteger(threshold) ? threshold : Number.NaN,
      count: Number.isInteger(count) ? count : Number.NaN,
      resetScope: rule?.resetScope || 'pack',
      label: rule?.label || null
    };
  });
}

function normalizedDuplicatePolicy(pack) {
  const raw = pack?.duplicatePolicy;
  const rawCopyLimit = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw.maxCopiesPerAsset ?? raw.maxCopies ?? raw.copyLimit ?? pack?.maxCopiesPerAsset
    : pack?.maxCopiesPerAsset;
  const maxCopiesPerAsset = optionalPositiveInteger(rawCopyLimit);
  if (raw === true || raw === 'allow_duplicates' || raw === 'copies') {
    return { mode: 'allow_duplicates', enabled: true, preserveFirstCopy: true, maxCopiesPerAsset };
  }
  if (typeof raw === 'string') {
    const mode = raw === 'copies' ? 'allow_duplicates' : raw;
    return {
      mode,
      enabled: mode === 'allow_duplicates',
      preserveFirstCopy: true,
      maxCopiesPerAsset
    };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const configuredMode = raw.mode === 'copies' ? 'allow_duplicates' : raw.mode;
    const mode = SUPPORTED_DUPLICATE_POLICY_MODES.has(configuredMode)
      ? configuredMode
      : String(configuredMode || 'unowned_only');
    return {
      mode,
      enabled: mode === 'allow_duplicates',
      preserveFirstCopy: raw.preserveFirstCopy !== false,
      maxCopiesPerAsset
    };
  }
  return { mode: 'unowned_only', enabled: false, preserveFirstCopy: true, maxCopiesPerAsset };
}

function rawItemCopyLimit(item) {
  return item?.maxCopiesPerPlayer ?? item?.maxCopies ?? item?.copyLimit;
}

function copyLimitForPackItem(pack, item, duplicatePolicy = normalizedDuplicatePolicy(pack)) {
  const itemLimit = optionalPositiveInteger(rawItemCopyLimit(item));
  return itemLimit === null ? duplicatePolicy.maxCopiesPerAsset : itemLimit;
}

function copyLimitReached(copyCount, copyLimit) {
  return copyLimit !== null && Number.isInteger(copyLimit) && copyCount >= copyLimit;
}

function rawBurnRules(pack) {
  if (Array.isArray(pack?.burnRules)) return pack.burnRules;
  if (Array.isArray(pack?.duplicateBurnRules)) return pack.duplicateBurnRules;
  return [];
}

function normalizedBurnRules(pack) {
  return rawBurnRules(pack).map((rule, index) => {
    const sourceRarity = String(rule?.sourceRarity || rule?.rarity || 'common');
    const sourceCount = Number(rule?.sourceCount ?? rule?.count ?? 5);
    const targetMinRarity = String(rule?.targetMinRarity || rule?.targetRarity || 'rare');
    const targetCount = Number(rule?.targetCount ?? 1);
    const targetDuplicatePolicy = String(rule?.targetDuplicatePolicy || rule?.targetPolicy || 'allow_duplicates');
    return {
      id: String(rule?.id || `burn_${sourceCount}_${sourceRarity}_to_${targetMinRarity}`),
      type: 'duplicate_burn_exchange',
      sourceRarity,
      sourceCount: Number.isInteger(sourceCount) ? sourceCount : Number.NaN,
      targetMinRarity,
      targetCount: Number.isInteger(targetCount) ? targetCount : Number.NaN,
      sourceScope: 'duplicate_copies',
      targetScope: 'pack',
      targetDuplicatePolicy,
      label: rule?.label || null,
      index
    };
  });
}

function guaranteeRuleEligibleCount(pack, minRarity) {
  return (pack?.items || []).filter((item) => rarityAtLeast(item.rarity, minRarity)).length;
}

function burnRuleTargetCount(pack, minRarity) {
  return (pack?.items || []).filter((item) => rarityAtLeast(item.rarity, minRarity)).length;
}

function normalizedPackSlots(pack) {
  const rollSize = assetPackRollSize(pack);
  if (!Number.isInteger(rollSize) || rollSize < MIN_ASSET_PACK_ROLL_SIZE || rollSize > MAX_ASSET_PACK_ROLL_SIZE) return [];
  const fallbackWeights = pack?.rarityWeights && typeof pack.rarityWeights === 'object'
    ? pack.rarityWeights
    : defaultRarityWeightsForItems(pack?.items || []);
  const configuredSlots = Array.isArray(pack?.slots) ? pack.slots : [];
  return Array.from({ length: rollSize }, (_, index) => {
    const slot = configuredSlots[index] && typeof configuredSlots[index] === 'object'
      ? configuredSlots[index]
      : {};
    return {
      slotIndex: index,
      rarityWeights: slot.rarityWeights && typeof slot.rarityWeights === 'object'
        ? slot.rarityWeights
        : fallbackWeights
    };
  });
}

export function validateAssetPack(pack, {
  catalog = getAssetCatalog()
} = {}) {
  const errors = [];
  const warnings = [];
  const assetIds = new Set(catalog.map((asset) => asset.assetId));
  const seen = new Set();
  if (!pack || typeof pack !== 'object') {
    return {
      ok: false,
      errors: [packValidationIssue('pack_missing', 'Asset pack definition is missing.')],
      warnings
    };
  }
  if (!pack.id) errors.push(packValidationIssue('pack_id_missing', 'Asset pack id is required.'));
  if (!pack.seasonId) errors.push(packValidationIssue('season_id_missing', 'Asset pack seasonId is required.'));
  if (!pack.collectionId) errors.push(packValidationIssue('collection_id_missing', 'Asset pack collectionId is required.'));
  if (!VALID_PACK_STATUSES.has(String(pack.status || ''))) {
    errors.push(packValidationIssue('status_invalid', `Asset pack ${pack.id || '(unknown)'} has invalid status.`));
  }
  if (!validDateValue(pack.startsAt)) {
    errors.push(packValidationIssue('starts_at_invalid', `Asset pack ${pack.id || '(unknown)'} has invalid startsAt.`));
  }
  if (!validDateValue(pack.endsAt)) {
    errors.push(packValidationIssue('ends_at_invalid', `Asset pack ${pack.id || '(unknown)'} has invalid endsAt.`));
  }
  if (validDateValue(pack.startsAt) && validDateValue(pack.endsAt) && pack.startsAt && pack.endsAt) {
    const startsAt = new Date(pack.startsAt).getTime();
    const endsAt = new Date(pack.endsAt).getTime();
    if (startsAt >= endsAt) {
      errors.push(packValidationIssue('date_window_invalid', `Asset pack ${pack.id || '(unknown)'} starts after it ends.`));
    }
  }
  if (pack.rollPriceCurrencyCode !== WALLET_CURRENCY_CODE) {
    errors.push(packValidationIssue('currency_invalid', `Asset pack ${pack.id || '(unknown)'} must use ${WALLET_CURRENCY_CODE}.`));
  }
  if (!Number.isInteger(Number(pack.rollPriceAmount)) || Number(pack.rollPriceAmount) <= 0) {
    errors.push(packValidationIssue('price_invalid', `Asset pack ${pack.id || '(unknown)'} needs a positive integer roll price.`));
  }
  const rollSize = assetPackRollSize(pack);
  if (!Number.isInteger(rollSize) || rollSize < MIN_ASSET_PACK_ROLL_SIZE || rollSize > MAX_ASSET_PACK_ROLL_SIZE) {
    errors.push(packValidationIssue('roll_size_invalid', `Asset pack ${pack.id || '(unknown)'} rollSize must be an integer from ${MIN_ASSET_PACK_ROLL_SIZE} to ${MAX_ASSET_PACK_ROLL_SIZE}.`));
  }
  if (pack.rarityTableVersion !== undefined && typeof pack.rarityTableVersion !== 'string') {
    errors.push(packValidationIssue('rarity_table_version_invalid', `Asset pack ${pack.id || '(unknown)'} rarityTableVersion must be a string.`));
  }
  if (!Array.isArray(pack.items) || pack.items.length === 0) {
    errors.push(packValidationIssue('items_missing', `Asset pack ${pack.id || '(unknown)'} needs at least one item.`));
  }
  for (const [index, item] of (pack.items || []).entries()) {
    if (!item?.assetId) {
      errors.push(packValidationIssue('item_asset_missing', 'Pack item assetId is required.', index));
      continue;
    }
    if (seen.has(item.assetId)) {
      errors.push(packValidationIssue('item_asset_duplicate', `Pack item ${item.assetId} appears more than once.`, index));
    }
    seen.add(item.assetId);
    if (!assetIds.has(item.assetId)) {
      errors.push(packValidationIssue('item_asset_unknown', `Pack item ${item.assetId} is not in the asset catalog.`, index));
    }
    if (!VALID_ASSET_RARITIES.has(String(item.rarity || ''))) {
      errors.push(packValidationIssue('item_rarity_invalid', `Pack item ${item.assetId} has invalid rarity.`, index));
    }
    if (!Number.isFinite(Number(item.dropWeight)) || Number(item.dropWeight) <= 0) {
      errors.push(packValidationIssue('item_weight_invalid', `Pack item ${item.assetId} needs a positive dropWeight.`, index));
    }
  }
  if ((pack.items || []).length < 2) {
    warnings.push(packValidationIssue('small_pack', `Asset pack ${pack.id || '(unknown)'} has fewer than two items.`));
  }
  if (pack.slots !== undefined && !Array.isArray(pack.slots)) {
    errors.push(packValidationIssue('slots_invalid', `Asset pack ${pack.id || '(unknown)'} slots must be an array.`));
  }
  if (Array.isArray(pack.slots) && Number.isInteger(rollSize) && pack.slots.length !== rollSize) {
    errors.push(packValidationIssue('slots_length_invalid', `Asset pack ${pack.id || '(unknown)'} slots length must match rollSize.`));
  }
  if (Number.isInteger(rollSize) && rollSize > 1 && !Array.isArray(pack.slots) && !pack.rarityWeights) {
    warnings.push(packValidationIssue('slots_missing_for_multi_roll', `Asset pack ${pack.id || '(unknown)'} uses item rarity weights for every roll slot.`));
  }
  for (const [index, slot] of (Array.isArray(pack.slots) ? pack.slots : []).entries()) {
    const weights = rarityWeightEntries(slot?.rarityWeights);
    if (!weights.length) {
      errors.push(packValidationIssue('slot_rarity_weights_missing', 'Pack roll slot needs positive rarityWeights.', index));
      continue;
    }
    for (const [rarity] of weights) {
      if (!VALID_ASSET_RARITIES.has(rarity)) {
        errors.push(packValidationIssue('slot_rarity_invalid', `Pack roll slot has invalid rarity ${rarity}.`, index));
      }
    }
  }
  if (pack.rarityWeights !== undefined) {
    const weights = rarityWeightEntries(pack.rarityWeights);
    if (!weights.length) {
      errors.push(packValidationIssue('rarity_weights_missing', `Asset pack ${pack.id || '(unknown)'} rarityWeights must contain positive weights.`));
    }
    for (const [rarity] of weights) {
      if (!VALID_ASSET_RARITIES.has(rarity)) {
        errors.push(packValidationIssue('rarity_weights_invalid', `Asset pack ${pack.id || '(unknown)'} has invalid rarity weight ${rarity}.`));
      }
    }
  }
  const duplicatePolicy = normalizedDuplicatePolicy(pack);
  if (pack.duplicatePolicy !== undefined && !SUPPORTED_DUPLICATE_POLICY_MODES.has(duplicatePolicy.mode)) {
    errors.push(packValidationIssue('duplicate_policy_invalid', `Asset pack ${pack.id || '(unknown)'} has an invalid duplicatePolicy mode.`));
  }
  if (duplicatePolicy.maxCopiesPerAsset !== null && (!Number.isInteger(duplicatePolicy.maxCopiesPerAsset) || duplicatePolicy.maxCopiesPerAsset <= 0)) {
    errors.push(packValidationIssue('duplicate_copy_cap_invalid', `Asset pack ${pack.id || '(unknown)'} duplicate copy cap must be a positive integer.`));
  }
  for (const [index, item] of (pack.items || []).entries()) {
    const rawLimit = rawItemCopyLimit(item);
    if (rawLimit === undefined || rawLimit === null || rawLimit === '') continue;
    const copyLimit = optionalPositiveInteger(rawLimit);
    if (!Number.isInteger(copyLimit) || copyLimit <= 0) {
      errors.push(packValidationIssue('item_copy_cap_invalid', `Pack item ${item?.assetId || index} copy cap must be a positive integer.`, index));
    }
  }
  if (pack.guarantees !== undefined && !Array.isArray(pack.guarantees)) {
    errors.push(packValidationIssue('guarantees_invalid', `Asset pack ${pack.id || '(unknown)'} guarantees must be an array.`));
  }
  if (pack.guaranteeRules !== undefined && !Array.isArray(pack.guaranteeRules)) {
    errors.push(packValidationIssue('guarantee_rules_invalid', `Asset pack ${pack.id || '(unknown)'} guaranteeRules must be an array.`));
  }
  for (const [index, rule] of normalizedGuaranteeRules(pack).entries()) {
    if (!VALID_ASSET_RARITIES.has(rule.minRarity)) {
      errors.push(packValidationIssue('guarantee_rarity_invalid', `Asset pack ${pack.id || '(unknown)'} guarantee has invalid minRarity.`, index));
    }
    if (!Number.isInteger(rule.count) || rule.count <= 0) {
      errors.push(packValidationIssue('guarantee_count_invalid', `Asset pack ${pack.id || '(unknown)'} guarantee needs a positive count.`, index));
    }
    if (Number.isInteger(rule.count) && Number.isInteger(rollSize) && rule.count > rollSize) {
      errors.push(packValidationIssue('guarantee_count_exceeds_roll_size', `Asset pack ${pack.id || '(unknown)'} guarantee count exceeds rollSize.`, index));
    }
    if (VALID_ASSET_RARITIES.has(rule.minRarity) && Number.isInteger(rule.count) && guaranteeRuleEligibleCount(pack, rule.minRarity) < rule.count) {
      errors.push(packValidationIssue('guarantee_impossible', `Asset pack ${pack.id || '(unknown)'} does not contain enough ${rule.minRarity}+ items for its guarantee.`, index));
    }
  }
  if (pack.pityRules !== undefined && !Array.isArray(pack.pityRules)) {
    errors.push(packValidationIssue('pity_rules_invalid', `Asset pack ${pack.id || '(unknown)'} pityRules must be an array.`));
  }
  for (const [index, rule] of normalizedPityRules(pack).entries()) {
    if (!VALID_ASSET_RARITIES.has(rule.minRarity)) {
      errors.push(packValidationIssue('pity_rarity_invalid', `Asset pack ${pack.id || '(unknown)'} pity rule has invalid minRarity.`, index));
    }
    if (!Number.isInteger(rule.threshold) || rule.threshold <= 0) {
      errors.push(packValidationIssue('pity_threshold_invalid', `Asset pack ${pack.id || '(unknown)'} pity rule needs a positive threshold.`, index));
    }
    if (!Number.isInteger(rule.count) || rule.count <= 0) {
      errors.push(packValidationIssue('pity_count_invalid', `Asset pack ${pack.id || '(unknown)'} pity rule needs a positive count.`, index));
    }
    if (!SUPPORTED_PITY_RESET_SCOPES.has(rule.resetScope)) {
      errors.push(packValidationIssue('pity_scope_invalid', `Asset pack ${pack.id || '(unknown)'} only supports pack-scoped pity in static config.`, index));
    }
    if (Number.isInteger(rule.count) && Number.isInteger(rollSize) && rule.count > rollSize) {
      errors.push(packValidationIssue('pity_count_exceeds_roll_size', `Asset pack ${pack.id || '(unknown)'} pity count exceeds rollSize.`, index));
    }
    if (VALID_ASSET_RARITIES.has(rule.minRarity) && Number.isInteger(rule.count) && guaranteeRuleEligibleCount(pack, rule.minRarity) < rule.count) {
      errors.push(packValidationIssue('pity_impossible', `Asset pack ${pack.id || '(unknown)'} does not contain enough ${rule.minRarity}+ items for its pity rule.`, index));
    }
  }
  if (pack.burnRules !== undefined && !Array.isArray(pack.burnRules)) {
    errors.push(packValidationIssue('burn_rules_invalid', `Asset pack ${pack.id || '(unknown)'} burnRules must be an array.`));
  }
  if (pack.duplicateBurnRules !== undefined && !Array.isArray(pack.duplicateBurnRules)) {
    errors.push(packValidationIssue('duplicate_burn_rules_invalid', `Asset pack ${pack.id || '(unknown)'} duplicateBurnRules must be an array.`));
  }
  for (const [index, rule] of normalizedBurnRules(pack).entries()) {
    if (!duplicatePolicy.enabled) {
      errors.push(packValidationIssue('burn_requires_duplicates', `Asset pack ${pack.id || '(unknown)'} burn rules require duplicatePolicy allow_duplicates.`, index));
    }
    if (!VALID_ASSET_RARITIES.has(rule.sourceRarity)) {
      errors.push(packValidationIssue('burn_source_rarity_invalid', `Asset pack ${pack.id || '(unknown)'} burn rule has invalid sourceRarity.`, index));
    }
    if (!VALID_ASSET_RARITIES.has(rule.targetMinRarity)) {
      errors.push(packValidationIssue('burn_target_rarity_invalid', `Asset pack ${pack.id || '(unknown)'} burn rule has invalid targetMinRarity.`, index));
    }
    if (!Number.isInteger(rule.sourceCount) || rule.sourceCount <= 0) {
      errors.push(packValidationIssue('burn_source_count_invalid', `Asset pack ${pack.id || '(unknown)'} burn rule needs a positive sourceCount.`, index));
    }
    if (!Number.isInteger(rule.targetCount) || rule.targetCount <= 0 || rule.targetCount > MAX_BURN_TARGET_COUNT) {
      errors.push(packValidationIssue('burn_target_count_invalid', `Asset pack ${pack.id || '(unknown)'} burn rule targetCount must be 1-${MAX_BURN_TARGET_COUNT}.`, index));
    }
    if (!SUPPORTED_BURN_TARGET_DUPLICATE_POLICIES.has(rule.targetDuplicatePolicy)) {
      errors.push(packValidationIssue('burn_target_policy_invalid', `Asset pack ${pack.id || '(unknown)'} burn rule has invalid targetDuplicatePolicy.`, index));
    }
    if (VALID_ASSET_RARITIES.has(rule.sourceRarity) && (pack.items || []).filter((item) => item.rarity === rule.sourceRarity).length === 0) {
      errors.push(packValidationIssue('burn_source_impossible', `Asset pack ${pack.id || '(unknown)'} does not contain ${rule.sourceRarity} items to burn.`, index));
    }
    if (VALID_ASSET_RARITIES.has(rule.targetMinRarity) && Number.isInteger(rule.targetCount) && burnRuleTargetCount(pack, rule.targetMinRarity) < rule.targetCount) {
      errors.push(packValidationIssue('burn_target_impossible', `Asset pack ${pack.id || '(unknown)'} does not contain enough ${rule.targetMinRarity}+ target items.`, index));
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function packAvailability(pack, now = new Date(), catalog = getAssetCatalog()) {
  const validation = validateAssetPack(pack, { catalog });
  if (!validation.ok) return 'invalid';
  if (pack.status === 'disabled') return 'disabled';
  if (pack.status === 'future') return 'future';
  if (pack.status === 'expired') return 'expired';
  if (pack.startsAt && new Date(pack.startsAt) > now) return 'future';
  if (pack.endsAt && new Date(pack.endsAt) <= now) return 'expired';
  const activeIds = configuredActiveGachaPackIds();
  if (isAssetGachaEnabled() && activeIds && !activeIds.includes(pack.id)) return 'disabled';
  return 'active';
}

function summarizePackRarities(items) {
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, Number(item.dropWeight || 0)), 0);
  const byRarity = new Map();
  for (const item of items) {
    const rarity = item.rarity || 'common';
    const current = byRarity.get(rarity) || { rarity, count: 0, dropWeight: 0, probability: 0 };
    current.count += 1;
    current.dropWeight += Math.max(0, Number(item.dropWeight || 0));
    byRarity.set(rarity, current);
  }
  return [...byRarity.values()]
    .map((entry) => ({
      ...entry,
      probability: totalWeight > 0 ? entry.dropWeight / totalWeight : 0
    }))
    .sort((a, b) => b.dropWeight - a.dropWeight || a.rarity.localeCompare(b.rarity));
}

function summarizeSlotRarities(pack, items) {
  const rollSize = assetPackRollSize(pack);
  if (!Number.isInteger(rollSize) || rollSize < MIN_ASSET_PACK_ROLL_SIZE) return [];
  const raritiesWithItems = new Set(items.map((item) => item.rarity || 'common'));
  const byRarity = new Map();
  for (const slot of normalizedPackSlots(pack)) {
    const weights = rarityWeightEntries(slot.rarityWeights)
      .filter(([rarity]) => raritiesWithItems.has(rarity));
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    if (total <= 0) continue;
    for (const [rarity, weight] of weights) {
      const current = byRarity.get(rarity) || {
        rarity,
        count: 0,
        dropWeight: 0,
        probability: 0,
        expectedPerOpen: 0
      };
      current.count = items.filter((item) => (item.rarity || 'common') === rarity).length;
      current.dropWeight += weight;
      current.expectedPerOpen += weight / total;
      current.probability = current.expectedPerOpen / rollSize;
      byRarity.set(rarity, current);
    }
  }
  return [...byRarity.values()]
    .sort((a, b) => b.expectedPerOpen - a.expectedPerOpen || a.rarity.localeCompare(b.rarity));
}

function assetRarityForPack(pack, assetId, metadataItem = null, catalog = getAssetCatalog()) {
  if (metadataItem?.rarity) return metadataItem.rarity;
  const packItem = (pack?.items || []).find((item) => item.assetId === assetId);
  if (packItem?.rarity) return packItem.rarity;
  return assetByIdFromCatalog(catalog, assetId)?.rarity || 'common';
}

function rowResultAssetIds(row) {
  if (Array.isArray(row?.resultAssetIds)) return row.resultAssetIds;
  return parseJson(row?.result_asset_ids_json, []);
}

function rowMetadata(row) {
  if (row?.metadata && typeof row.metadata === 'object') return row.metadata;
  return parseJson(row?.metadata_json, {});
}

function rollHasMinimumRarity(pack, row, minRarity, count = 1) {
  const metadata = rowMetadata(row);
  const metadataItems = Array.isArray(metadata.results) ? metadata.results : [];
  const matches = rowResultAssetIds(row).filter((assetId, index) => {
    const metadataItem = metadataItems.find((entry) => entry.assetId === assetId) || metadataItems[index] || null;
    return rarityAtLeast(assetRarityForPack(pack, assetId, metadataItem), minRarity);
  });
  return matches.length >= count;
}

function sortedRollHistory(rolls = []) {
  return [...rolls].sort((a, b) => {
    const aTime = new Date(a.created_at || a.createdAt || 0).getTime();
    const bTime = new Date(b.created_at || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export function computePackPityState(pack, {
  rolls = []
} = {}) {
  const history = sortedRollHistory(rolls);
  return normalizedPityRules(pack).map((rule) => {
    let currentMisses = 0;
    for (const roll of history) {
      if (rollHasMinimumRarity(pack, roll, rule.minRarity, rule.count)) break;
      currentMisses += 1;
    }
    const remaining = Math.max(1, rule.threshold - currentMisses);
    return {
      ...rule,
      currentMisses,
      remaining,
      active: remaining <= 1
    };
  });
}

function advancePackPityState(pityBefore, selectedItems) {
  return (pityBefore || []).map((rule) => {
    const hitCount = selectedItems.filter((item) => rarityAtLeast(item.rarity, rule.minRarity)).length;
    const currentMisses = hitCount >= rule.count ? 0 : rule.currentMisses + 1;
    return {
      ...rule,
      currentMisses,
      remaining: Math.max(1, rule.threshold - currentMisses),
      active: Math.max(1, rule.threshold - currentMisses) <= 1
    };
  });
}

function normalizeAssetInstanceRows(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    player_id: row.player_id,
    asset_id: row.asset_id || row.assetId,
    status: row.status,
    acquired_at: row.acquired_at || row.acquiredAt,
    metadata_json: row.metadata_json || (row.metadata ? JSON.stringify(row.metadata) : null)
  }));
}

function activeCopyCounts(activeAssetRows = []) {
  const counts = new Map();
  for (const row of normalizeAssetInstanceRows(activeAssetRows)) {
    if (!row.asset_id) continue;
    counts.set(row.asset_id, (counts.get(row.asset_id) || 0) + 1);
  }
  return counts;
}

function normalizeCopyCountsInput({ activeAssetRows = [], copyCounts = null, ownedAssetIds = [] } = {}) {
  let counts = new Map();
  if (copyCounts instanceof Map) {
    counts = new Map(copyCounts);
  } else if (copyCounts && typeof copyCounts === 'object') {
    counts = new Map(Object.entries(copyCounts).map(([assetId, count]) => [assetId, Number(count || 0)]));
  } else if (activeAssetRows.length) {
    counts = activeCopyCounts(activeAssetRows);
  }
  const owned = ownedAssetIds instanceof Set ? ownedAssetIds : new Set(ownedAssetIds);
  for (const assetId of owned) {
    if (!counts.has(assetId)) counts.set(assetId, 1);
  }
  return counts;
}

function burnableDuplicateRows(pack, activeAssetRows = [], rule, equippedInstanceIds = new Set()) {
  const packRarities = new Map((pack?.items || []).map((item) => [item.assetId, item.rarity || 'common']));
  const byAssetId = new Map();
  for (const row of normalizeAssetInstanceRows(activeAssetRows)) {
    const rarity = packRarities.get(row.asset_id);
    if (row.status !== 'active' || rarity !== rule.sourceRarity) continue;
    const rows = byAssetId.get(row.asset_id) || [];
    rows.push(row);
    byAssetId.set(row.asset_id, rows);
  }

  const burnable = [];
  for (const rows of byAssetId.values()) {
    rows.sort((a, b) => {
      const aTime = new Date(a.acquired_at || 0).getTime();
      const bTime = new Date(b.acquired_at || 0).getTime();
      return aTime - bTime || String(a.id).localeCompare(String(b.id));
    });
    const equipped = rows.find((row) => equippedInstanceIds.has(row.id));
    const retainedId = equipped?.id || rows[0]?.id || null;
    for (const row of rows) {
      if (row.id !== retainedId && !equippedInstanceIds.has(row.id)) burnable.push(row);
    }
  }
  return burnable;
}

function computePackBurnState(pack, { activeAssetRows = [], equippedInstanceIds = new Set() } = {}) {
  return normalizedBurnRules(pack).map((rule) => {
    const burnableCount = burnableDuplicateRows(pack, activeAssetRows, rule, equippedInstanceIds).length;
    return {
      ...rule,
      burnableCount,
      ready: burnableCount >= rule.sourceCount
    };
  });
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
  const catalogById = new Map(catalog.map((asset) => [asset.assetId, asset]));
  const owned = ownedAssetIds instanceof Set ? ownedAssetIds : new Set(ownedAssetIds);
  const equippedIds = equippedAssetInstanceIds instanceof Set
    ? equippedAssetInstanceIds
    : new Set(equippedAssetInstanceIds);
  const copyCounts = activeCopyCounts(activeAssetRows);
  const validation = validateAssetPack(pack, { catalog });
  const availability = packAvailability(pack, now, catalog);
  const duplicatePolicy = normalizedDuplicatePolicy(pack);
  const totalWeight = (pack.items || []).reduce((sum, item) => sum + Math.max(0, Number(item.dropWeight || 0)), 0);
  const items = (pack.items || []).map((item) => {
    const ownedCopies = copyCounts.get(item.assetId) || (owned.has(item.assetId) ? 1 : 0);
    const copyLimit = copyLimitForPackItem(pack, item, duplicatePolicy);
    return {
      ...item,
      ownedCopies,
      duplicateCopies: Math.max(0, ownedCopies - 1),
      copyLimit,
      copyCapped: copyLimitReached(ownedCopies, copyLimit),
      probability: totalWeight > 0 ? Math.max(0, Number(item.dropWeight || 0)) / totalWeight : 0,
      ...(includeAssets ? { asset: catalogById.get(item.assetId) || null } : {})
    };
  });
  const rollSize = assetPackRollSize(pack);
  const normalizedRollSize = Number.isInteger(rollSize) ? rollSize : pack.rollSize;
  const ownedCount = items.filter((item) => owned.has(item.assetId)).length;
  const remainingCount = Math.max(0, items.length - ownedCount);
  const rollableCount = duplicatePolicy.enabled
    ? items.filter((item) => !item.copyCapped).length
    : remainingCount;
  const copyComplete = items.length > 0 && rollableCount === 0;
  const raritySummary = Number(normalizedRollSize) > 1
    ? summarizeSlotRarities(pack, items)
    : summarizePackRarities(items);
  return {
    ...pack,
    rollSize: normalizedRollSize,
    rarityTableVersion: pack.rarityTableVersion || `${pack.id || 'asset_pack'}:v1`,
    slots: normalizedPackSlots(pack),
    active: availability === 'active',
    availability,
    validation,
    totalItems: items.length,
    ownedCount,
    remainingCount,
    uniqueComplete: items.length > 0 && ownedCount >= items.length,
    copyComplete,
    duplicatePolicy,
    duplicateCopies: items.reduce((sum, item) => sum + Number(item.duplicateCopies || 0), 0),
    rollableCount,
    nextRollItemCount: Math.min(Math.max(0, Number(normalizedRollSize) || 0), rollableCount),
    complete: duplicatePolicy.enabled ? copyComplete : items.length > 0 && ownedCount >= items.length,
    totalWeight,
    raritySummary,
    guarantees: {
      rules: normalizedGuaranteeRules(pack)
    },
    pity: {
      resetScope: 'pack',
      rules: computePackPityState(pack, { rolls: rollHistory })
    },
    burn: {
      rules: computePackBurnState(pack, { activeAssetRows, equippedInstanceIds: equippedIds })
    },
    items
  };
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
  const activePack = packIsActive(pack);
  const directBase = asset.acquisitionMode === 'direct' || asset.acquisitionMode === 'both';
  const blockedByGacha = gachaEnabled &&
    directBuyPolicy() === 'block_gacha_assets' &&
    activePack &&
    (asset.acquisitionMode === 'gacha' || asset.acquisitionMode === 'both');
  return {
    acquisitionMode: asset.acquisitionMode,
    purchaseAvailable: directBase && !blockedByGacha,
    rollAvailable: gachaEnabled && activePack && (asset.acquisitionMode === 'gacha' || asset.acquisitionMode === 'both'),
    gachaEnabled,
    directBuyPolicy: directBuyPolicy(),
    activePackId: activePack ? pack.id : null
  };
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
  const total = candidates.reduce((sum, candidate) => sum + Math.max(0, Number(candidate.dropWeight || 0)), 0);
  if (total <= 0) throw httpError('Gacha pack has no weighted candidates', 400);
  let target = rng() * total;
  for (const candidate of candidates) {
    target -= Math.max(0, Number(candidate.dropWeight || 0));
    if (target < 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

function chooseWeightedRarity(rarityWeights, candidates, rng) {
  const raritiesWithCandidates = new Set(candidates.map((candidate) => candidate.rarity || 'common'));
  const entries = rarityWeightEntries(rarityWeights)
    .filter(([rarity]) => raritiesWithCandidates.has(rarity));
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;
  let target = rng() * total;
  for (const [rarity, weight] of entries) {
    target -= weight;
    if (target < 0) return rarity;
  }
  return entries[entries.length - 1]?.[0] || null;
}

function activeRollGuaranteeRules(pack, pityState = []) {
  const activePityRules = (pityState || [])
    .filter((rule) => rule.active)
    .map((rule) => ({
      id: rule.id,
      type: 'min_rarity_count',
      source: 'pity',
      minRarity: rule.minRarity,
      count: rule.count,
      label: rule.label || null
    }));
  return [
    ...normalizedGuaranteeRules(pack),
    ...activePityRules
  ];
}

function lowestReplaceableSelectionIndex(selected, minRarity) {
  let replaceIndex = -1;
  let lowestRank = Number.POSITIVE_INFINITY;
  for (const [index, item] of selected.entries()) {
    const rank = rarityRank(item.rarity);
    if (rank < rarityRank(minRarity) && rank < lowestRank) {
      lowestRank = rank;
      replaceIndex = index;
    }
  }
  return replaceIndex;
}

function applyGuaranteeRules(selectedItems, candidates, rules, rng) {
  const selected = selectedItems.map((item) => ({ ...item }));
  const applications = [];
  for (const rule of rules) {
    let matchingCount = selected.filter((item) => rarityAtLeast(item.rarity, rule.minRarity)).length;
    const maxEligibleCount = candidates.filter((candidate) => rarityAtLeast(candidate.rarity, rule.minRarity)).length;
    const targetCount = Math.min(rule.count, maxEligibleCount, selected.length);
    while (matchingCount < targetCount) {
      const selectedAssetIds = new Set(selected.map((item) => item.assetId));
      const eligibleCandidates = candidates.filter((candidate) =>
        !selectedAssetIds.has(candidate.assetId) && rarityAtLeast(candidate.rarity, rule.minRarity)
      );
      if (!eligibleCandidates.length) break;
      const replaceIndex = lowestReplaceableSelectionIndex(selected, rule.minRarity);
      if (replaceIndex < 0) break;
      const replaced = selected[replaceIndex];
      const selectedCandidate = chooseWeightedAssetCandidate(eligibleCandidates, rng);
      selected[replaceIndex] = {
        ...selectedCandidate,
        slotIndex: replaced.slotIndex,
        selectedRarity: selectedCandidate.rarity || rule.minRarity,
        asset: selectedCandidate.asset,
        guaranteeId: rule.id,
        guaranteeSource: rule.source,
        guaranteeMinRarity: rule.minRarity,
        guaranteeReplacedAssetId: replaced.assetId,
        slotRarityWeights: replaced.slotRarityWeights,
        candidatePoolHash: hashCandidatePool(candidates)
      };
      applications.push({
        id: rule.id,
        source: rule.source,
        minRarity: rule.minRarity,
        count: rule.count,
        slotIndex: replaced.slotIndex,
        replacedAssetId: replaced.assetId,
        selectedAssetId: selectedCandidate.assetId
      });
      matchingCount += 1;
    }
  }
  selected.sort((a, b) => a.slotIndex - b.slotIndex);
  Object.defineProperty(selected, 'guaranteeApplications', {
    enumerable: false,
    configurable: true,
    value: applications
  });
  return selected;
}

export function selectAssetPackRollResults(candidates, pack, {
  rng = secureRandomUnit,
  pityState = []
} = {}) {
  const rollSize = assetPackRollSize(pack);
  if (!Number.isInteger(rollSize) || rollSize < MIN_ASSET_PACK_ROLL_SIZE || rollSize > MAX_ASSET_PACK_ROLL_SIZE) {
    throw httpError('Asset pack rollSize is invalid', 400);
  }
  const remaining = [...candidates];
  const slots = normalizedPackSlots(pack);
  const selected = [];
  for (let slotIndex = 0; slotIndex < rollSize && remaining.length; slotIndex += 1) {
    const slot = slots[slotIndex] || { slotIndex, rarityWeights: defaultRarityWeightsForItems(remaining) };
    const selectedRarity = chooseWeightedRarity(slot.rarityWeights, remaining, rng);
    const slotCandidates = selectedRarity
      ? remaining.filter((candidate) => (candidate.rarity || 'common') === selectedRarity)
      : remaining;
    const selectedItem = chooseWeightedAssetCandidate(slotCandidates.length ? slotCandidates : remaining, rng);
    selected.push({
      slotIndex,
      selectedRarity: selectedRarity || selectedItem.rarity || null,
      assetId: selectedItem.assetId,
      rarity: selectedItem.rarity || selectedItem.asset?.rarity || null,
      dropWeight: selectedItem.dropWeight,
      asset: selectedItem.asset,
      slotRarityWeights: slot.rarityWeights,
      candidatePoolHash: hashCandidatePool(remaining)
    });
    const selectedIndex = remaining.findIndex((candidate) => candidate.assetId === selectedItem.assetId);
    if (selectedIndex >= 0) remaining.splice(selectedIndex, 1);
  }
  return applyGuaranteeRules(selected, candidates, activeRollGuaranteeRules(pack, pityState), rng);
}

export function resolveAssetPackRollCandidates(pack, {
  ownedAssetIds = [],
  activeAssetRows = [],
  copyCounts = null,
  includeOwned = normalizedDuplicatePolicy(pack).enabled,
  catalog = getAssetCatalog()
} = {}) {
  const catalogById = new Map(catalog.map((asset) => [asset.assetId, asset]));
  const owned = ownedAssetIds instanceof Set ? ownedAssetIds : new Set(ownedAssetIds);
  const duplicatePolicy = normalizedDuplicatePolicy(pack);
  const activeCounts = normalizeCopyCountsInput({ activeAssetRows, copyCounts, ownedAssetIds: owned });
  return (pack?.items || [])
    .map((item) => {
      const ownedCopies = activeCounts.get(item.assetId) || 0;
      const copyLimit = copyLimitForPackItem(pack, item, duplicatePolicy);
      return {
        ...item,
        ownedCopies,
        copyLimit,
        copyCapped: copyLimitReached(ownedCopies, copyLimit),
        asset: catalogById.get(item.assetId) || null
      };
    })
    .filter((item) => {
      if (!item.asset) return false;
      if (!duplicatePolicy.enabled) return !owned.has(item.assetId);
      if (!includeOwned && owned.has(item.assetId)) return false;
      return !item.copyCapped;
    });
}

function hashCandidatePool(candidates) {
  const payload = JSON.stringify(candidates.map((candidate) => ({
    assetId: candidate.asset.assetId,
    dropWeight: candidate.dropWeight,
    rarity: candidate.rarity
  })));
  return crypto.createHash('sha256').update(payload).digest('hex');
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

function burnTargetCandidates(pack, rule, {
  ownedAssetIds = new Set(),
  copyCounts = new Map(),
  selectedAssetIds = new Set(),
  catalog = getAssetCatalog()
} = {}) {
  const catalogById = new Map(catalog.map((asset) => [asset.assetId, asset]));
  const duplicatePolicy = normalizedDuplicatePolicy(pack);
  return (pack?.items || [])
    .filter((item) => rarityAtLeast(item.rarity, rule.targetMinRarity))
    .filter((item) => !selectedAssetIds.has(item.assetId))
    .map((item) => {
      const ownedCopies = copyCounts.get(item.assetId) || (ownedAssetIds.has(item.assetId) ? 1 : 0);
      const copyLimit = copyLimitForPackItem(pack, item, duplicatePolicy);
      return {
        ...item,
        ownedCopies,
        copyLimit,
        copyCapped: copyLimitReached(ownedCopies, copyLimit),
        asset: catalogById.get(item.assetId) || null
      };
    })
    .filter((item) => item.asset && !item.copyCapped);
}

function selectBurnTargets(pack, rule, rng, {
  ownedAssetIds = [],
  activeAssetRows = [],
  copyCounts = null,
  catalog = getAssetCatalog()
} = {}) {
  const selected = [];
  const owned = ownedAssetIds instanceof Set ? new Set(ownedAssetIds) : new Set(ownedAssetIds);
  const activeCounts = normalizeCopyCountsInput({ activeAssetRows, copyCounts, ownedAssetIds: owned });
  const selectedAssetIds = new Set();
  for (let index = 0; index < rule.targetCount; index += 1) {
    const candidates = burnTargetCandidates(pack, rule, {
      ownedAssetIds: owned,
      copyCounts: activeCounts,
      selectedAssetIds,
      catalog
    });
    const unownedCandidates = candidates.filter((candidate) => !owned.has(candidate.assetId));
    const pool = rule.targetDuplicatePolicy === 'unowned_only'
      ? unownedCandidates
      : (rule.targetDuplicatePolicy === 'unowned_first' && unownedCandidates.length
        ? unownedCandidates
        : candidates);
    if (!pool.length) break;
    const selectedItem = chooseWeightedAssetCandidate(pool, rng);
    selected.push({
      slotIndex: index,
      selectedRarity: selectedItem.rarity || rule.targetMinRarity,
      assetId: selectedItem.assetId,
      rarity: selectedItem.rarity || selectedItem.asset?.rarity || null,
      dropWeight: selectedItem.dropWeight,
      asset: selectedItem.asset,
      candidatePoolHash: hashCandidatePool(pool)
    });
    selectedAssetIds.add(selectedItem.assetId);
    owned.add(selectedItem.assetId);
    activeCounts.set(selectedItem.assetId, (activeCounts.get(selectedItem.assetId) || 0) + 1);
  }
  return selected;
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
