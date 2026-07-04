import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { repoRoot } from '../../shared/repo-root.js';
import { query, withTransaction } from '../db.js';
import { PORTRAIT_VARIANTS } from '../game-data.js';
import { createId, nowIso, parseJson } from '../lib/utils.js';
import {
  getAssetCatalog,
  getRuntimeAssetCatalog,
  resolveAssetPackRollCandidates,
  selectAssetPackRollResults,
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
const GACHA_FIXTURE_SCHEMA_VERSION = 'gacha-admin-fixture/v1';

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
  return `planned_portrait.${characterId}.${itemId}`;
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

function summarizeGachaPlanItems(planItems = []) {
  const targetPerCharacter = Number(process.env.GACHA_PLAN_TARGET_PER_CHARACTER || GACHA_PLAN_TARGET_PER_CHARACTER);
  const target = Number.isInteger(targetPerCharacter) && targetPerCharacter > 0
    ? targetPerCharacter
    : GACHA_PLAN_TARGET_PER_CHARACTER;
  const bySeason = new Map();
  for (const item of planItems) {
    const season = bySeason.get(item.seasonId) || {
      seasonId: item.seasonId,
      total: 0,
      totalWeight: 0,
      characters: Object.fromEntries(planCharacterOptions().map((character) => [
        character.id,
        {
          characterId: character.id,
          label: character.label,
          count: 0,
          readyCount: 0,
          target,
          missing: target,
          enough: false,
          totalWeight: 0
        }
      ]))
    };
    const row = season.characters[item.characterId] || {
      characterId: item.characterId,
      label: item.characterId,
      count: 0,
      readyCount: 0,
      target,
      missing: target,
      enough: false,
      totalWeight: 0
    };
    row.count += 1;
    if (item.status === 'ready') row.readyCount += 1;
    row.totalWeight += Math.max(0, Number(item.dropWeight || 0));
    row.missing = Math.max(0, target - row.count);
    row.enough = row.count >= target;
    season.characters[item.characterId] = row;
    season.total += 1;
    season.totalWeight += Math.max(0, Number(item.dropWeight || 0));
    bySeason.set(item.seasonId, season);
  }
  return {
    targetPerCharacter: target,
    seasons: [...bySeason.values()].map((season) => ({
      ...season,
      characters: Object.values(season.characters)
    }))
  };
}

function checklistIssue(code, message, severity = 'blocker', details = {}) {
  return { code, message, severity, ...details };
}

function hasLocalizedCopy(value) {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).some((entry) => typeof entry === 'string' && entry.trim());
}

function disclosureCopy(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return null;
  return metadata.disclosure || metadata.oddsDisclosure || metadata.description || null;
}

function duplicatePolicyMode(policy) {
  if (policy === true || policy === 'allow_duplicates' || policy === 'copies') return 'allow_duplicates';
  if (policy && typeof policy === 'object') return policy.mode || null;
  return null;
}

function duplicateCopyCap(policy) {
  if (!policy || typeof policy !== 'object') return null;
  return Number.isInteger(Number(policy.maxCopiesPerAsset)) ? Number(policy.maxCopiesPerAsset) : null;
}

function createChecklist({ runtimePack, validation, seasonRow = null, collectionRow = null, catalog = getAssetCatalog() }) {
  const blockers = [];
  const warnings = [];
  const passed = [];
  const metadata = runtimePack.metadata || {};
  const catalogById = new Map(catalog.map((asset) => [asset.assetId, asset]));

  if (validation.ok) passed.push(checklistIssue('runtime_validation_ok', 'Runtime pack validation passes.', 'pass'));
  else blockers.push(checklistIssue(
    'runtime_validation_failed',
    'Runtime pack validation must pass before approval or publish.',
    'blocker',
    { errorCodes: validation.errors.map((issue) => issue.code) }
  ));

  if (runtimePack.startsAt) passed.push(checklistIssue('pack_starts_at_present', 'Pack start date is set.', 'pass'));
  else blockers.push(checklistIssue('pack_starts_at_missing', 'Pack start date is required for release.'));

  if (runtimePack.endsAt) passed.push(checklistIssue('pack_ends_at_present', 'Pack end date is set.', 'pass'));
  else blockers.push(checklistIssue('pack_ends_at_missing', 'Pack end date is required for release.'));

  if (hasLocalizedCopy(disclosureCopy(metadata))) {
    passed.push(checklistIssue('disclosure_copy_present', 'Player-facing disclosure copy is present.', 'pass'));
  } else {
    blockers.push(checklistIssue(
      'disclosure_copy_missing',
      'Pack metadata must include disclosure, oddsDisclosure, or description copy before release.'
    ));
  }

  if (Number.isInteger(Number(runtimePack.rollPriceAmount)) && Number(runtimePack.rollPriceAmount) > 0) {
    passed.push(checklistIssue('price_present', 'Pack roll price is a positive wallet amount.', 'pass'));
  } else {
    blockers.push(checklistIssue('price_missing_or_invalid', 'Pack roll price must be a positive wallet amount.'));
  }
  if (runtimePack.rollPriceCurrencyCode === WALLET_CURRENCY_CODE) {
    passed.push(checklistIssue('currency_ok', `Pack currency is ${WALLET_CURRENCY_CODE}.`, 'pass'));
  } else {
    blockers.push(checklistIssue('currency_unsupported', `Pack currency must be ${WALLET_CURRENCY_CODE}.`));
  }

  if (seasonRow && !['active', 'future'].includes(seasonRow.status)) {
    warnings.push(checklistIssue(
      'season_not_release_ready',
      `Season status is ${seasonRow.status}; active/future is expected before release.`,
      'warning'
    ));
  }
  if (collectionRow && !['active', 'future'].includes(collectionRow.status)) {
    warnings.push(checklistIssue(
      'collection_not_release_ready',
      `Collection status is ${collectionRow.status}; active/future is expected before release.`,
      'warning'
    ));
  }

  const policyMode = duplicatePolicyMode(runtimePack.duplicatePolicy);
  if (policyMode === 'allow_duplicates') {
    const packCap = duplicateCopyCap(runtimePack.duplicatePolicy);
    const uncappedItems = (runtimePack.items || []).filter((item) =>
      item.copyLimit === undefined || item.copyLimit === null
    );
    if (!packCap && uncappedItems.length) {
      warnings.push(checklistIssue(
        'duplicate_copy_cap_missing',
        'Duplicate-enabled packs should define a pack copy cap or item copy caps.',
        'warning',
        { assetIds: uncappedItems.map((item) => item.assetId) }
      ));
    }
  }

  const policyRecommendations = [];
  for (const item of runtimePack.items || []) {
    const asset = catalogById.get(item.assetId);
    if (!asset) continue;
    const alreadyMapped = asset.packId === runtimePack.id &&
      (asset.acquisitionMode === 'gacha' || asset.acquisitionMode === 'both');
    if (!alreadyMapped) {
      policyRecommendations.push({
        assetId: item.assetId,
        current: {
          acquisitionMode: asset.acquisitionMode,
          packId: asset.packId
        },
        recommended: {
          acquisitionMode: 'gacha',
          packId: runtimePack.id
        }
      });
    }
  }
  if (policyRecommendations.length) {
    warnings.push(checklistIssue(
      'asset_policy_mapping_recommended',
      'Some pack assets are not mapped to this DB pack in the asset acquisition policy.',
      'warning',
      {
        recommendations: policyRecommendations,
        recommendedPolicyJson: Object.fromEntries(policyRecommendations.map((entry) => [
          entry.assetId,
          entry.recommended
        ]))
      }
    ));
  } else if ((runtimePack.items || []).length) {
    passed.push(checklistIssue('asset_policy_mapping_ok', 'Pack assets are mapped to this pack policy.', 'pass'));
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    passed
  };
}

function normalizePreviewTrials(value) {
  const trials = Number(value || 1000);
  if (!Number.isInteger(trials) || trials <= 0) throw new Error('Gacha preview trials must be a positive integer');
  return Math.min(trials, 100000);
}

function createPreviewRng(seedInput) {
  const digest = crypto.createHash('sha256').update(String(seedInput || 'gacha-admin-preview')).digest();
  let state = digest.readUInt32LE(0);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function simulateRuntimePack(runtimePack, { trials = 1000, seed = null, catalog = getAssetCatalog() } = {}) {
  const trialCount = normalizePreviewTrials(trials);
  const seedValue = seed || `${runtimePack.id}:${runtimePack.updatedAt || runtimePack.rarityTableVersion || 'draft'}:${trialCount}`;
  const rng = createPreviewRng(seedValue);
  const candidates = resolveAssetPackRollCandidates(runtimePack, { ownedAssetIds: [], catalog });
  const counts = new Map(candidates.map((candidate) => [candidate.assetId, 0]));
  const rarityCounts = new Map();
  let totalSelections = 0;

  if (candidates.length) {
    for (let trial = 0; trial < trialCount; trial += 1) {
      const selected = selectAssetPackRollResults(candidates, runtimePack, { rng });
      for (const item of selected) {
        counts.set(item.assetId, (counts.get(item.assetId) || 0) + 1);
        const rarity = item.rarity || 'common';
        rarityCounts.set(rarity, (rarityCounts.get(rarity) || 0) + 1);
        totalSelections += 1;
      }
    }
  }

  const weightedCandidateCount = candidates.filter((candidate) => Number(candidate.dropWeight || 0) > 0).length;
  return {
    trials: trialCount,
    seed: seedValue,
    candidateCount: candidates.length,
    weightedCandidateCount,
    averageItemsPerRoll: totalSelections / trialCount,
    rollable: candidates.length > 0 && weightedCandidateCount > 0,
    raritySummary: [...rarityCounts.entries()].map(([rarity, observedCount]) => ({
      rarity,
      observedCount,
      observedPerRoll: observedCount / trialCount
    })).sort((a, b) => b.observedPerRoll - a.observedPerRoll || a.rarity.localeCompare(b.rarity)),
    items: candidates.map((candidate) => {
      const observedCount = counts.get(candidate.assetId) || 0;
      return {
        assetId: candidate.assetId,
        rarity: candidate.rarity || candidate.asset?.rarity || null,
        dropWeight: Number(candidate.dropWeight || 0),
        observedCount,
        observedPerRoll: observedCount / trialCount,
        asset: candidate.asset ? {
          name: candidate.asset.name,
          slot: candidate.asset.slot,
          targetType: candidate.asset.targetType,
          targetId: candidate.asset.targetId,
          variantId: candidate.asset.variantId
        } : null
      };
    }).sort((a, b) => b.observedPerRoll - a.observedPerRoll || a.assetId.localeCompare(b.assetId))
  };
}

function packSnapshot(runtimePack) {
  return {
    id: runtimePack.id,
    seasonId: runtimePack.seasonId,
    collectionId: runtimePack.collectionId,
    name: runtimePack.name,
    status: runtimePack.status,
    startsAt: runtimePack.startsAt,
    endsAt: runtimePack.endsAt,
    rollPriceAmount: runtimePack.rollPriceAmount,
    rollSize: runtimePack.rollSize,
    rarityWeights: runtimePack.rarityWeights || null,
    slots: runtimePack.slots || null,
    guarantees: runtimePack.guarantees || null,
    pityRules: runtimePack.pityRules || null,
    duplicatePolicy: runtimePack.duplicatePolicy || null,
    burnRules: runtimePack.burnRules || null,
    metadata: runtimePack.metadata || {},
    items: [...(runtimePack.items || [])].sort((a, b) => a.assetId.localeCompare(b.assetId))
  };
}

function diffValues(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changed = [];
  for (const key of keys) {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changed.push({ field: key, before: beforeValue ?? null, after: afterValue ?? null });
    }
  }
  return changed;
}

async function draftDiffForPack(client, runtimePack) {
  const basePackId = runtimePack.metadata?.basePackId || runtimePack.metadata?.clonedFromPackId || null;
  if (!basePackId || basePackId === runtimePack.id) return null;
  const baseRow = await findOne(client, 'asset_gacha_packs', basePackId);
  if (!baseRow) {
    return { basePackId, missingBase: true, changedFields: [], addedItems: [], removedItems: [], changedItems: [] };
  }
  const baseRuntime = rowPackToRuntimePack(baseRow, await selectPackItems(client, basePackId));
  const baseSnapshot = packSnapshot(baseRuntime);
  const draftSnapshot = packSnapshot(runtimePack);
  const baseItems = new Map(baseSnapshot.items.map((item) => [item.assetId, item]));
  const draftItems = new Map(draftSnapshot.items.map((item) => [item.assetId, item]));
  const addedItems = [...draftItems.keys()].filter((assetId) => !baseItems.has(assetId));
  const removedItems = [...baseItems.keys()].filter((assetId) => !draftItems.has(assetId));
  const changedItems = [...draftItems.keys()]
    .filter((assetId) => baseItems.has(assetId))
    .map((assetId) => ({
      assetId,
      changes: diffValues(baseItems.get(assetId), draftItems.get(assetId))
    }))
    .filter((entry) => entry.changes.length);
  const { items: _baseItems, ...baseFields } = baseSnapshot;
  const { items: _draftItems, ...draftFields } = draftSnapshot;
  return {
    basePackId,
    missingBase: false,
    changedFields: diffValues(baseFields, draftFields),
    addedItems,
    removedItems,
    changedItems
  };
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
  const catalog = await getRuntimeAssetCatalog({ client });
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

function assertUniqueFixtureIds(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    const id = requiredText(row?.id, `${label} id`);
    if (seen.has(id)) throw new Error(`${label} fixture contains duplicate id ${id}`);
    seen.add(id);
  }
}

function normalizeGachaFixture(input = {}) {
  const fixture = input.fixture && typeof input.fixture === 'object' ? input.fixture : input;
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    throw new Error('Gacha fixture must be an object');
  }
  const seasons = normalizeFixtureArray(fixture.seasons, 'Gacha fixture seasons');
  const collections = normalizeFixtureArray(fixture.collections, 'Gacha fixture collections');
  const planItems = normalizeFixtureArray(fixture.planItems, 'Gacha fixture planItems');
  const flatItems = normalizeFixtureArray(fixture.items, 'Gacha fixture items');
  const flatItemsByPack = new Map();
  for (const item of flatItems) {
    const packId = requiredText(item?.packId ?? item?.pack_id, 'Gacha fixture item packId');
    const rows = flatItemsByPack.get(packId) || [];
    rows.push(item);
    flatItemsByPack.set(packId, rows);
  }
  const packs = normalizeFixtureArray(fixture.packs, 'Gacha fixture packs').map((pack) => {
    const id = requiredText(pack?.id, 'Gacha fixture pack id');
    const nestedItems = pack.items === undefined
      ? flatItemsByPack.get(id) || []
      : normalizeFixtureArray(pack.items, `Gacha fixture pack ${id} items`);
    return { ...pack, items: nestedItems };
  });
  assertUniqueFixtureIds(seasons, 'Gacha season');
  assertUniqueFixtureIds(collections, 'Gacha collection');
  assertUniqueFixtureIds(planItems, 'Gacha plan item');
  assertUniqueFixtureIds(packs, 'Gacha pack');
  return {
    schemaVersion: fixture.schemaVersion || GACHA_FIXTURE_SCHEMA_VERSION,
    seasons,
    collections,
    planItems,
    packs
  };
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

function summarizeFixtureOperations(operations) {
  return operations.reduce((summary, operation) => {
    summary.total += 1;
    summary[operation.action] = (summary[operation.action] || 0) + 1;
    summary.byType[operation.type] = (summary.byType[operation.type] || 0) + 1;
    return summary;
  }, { total: 0, create: 0, update: 0, replace: 0, noop: 0, byType: {} });
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
  if (row.status !== 'ready') return null;
  const existing = catalog.find((asset) => asset.assetId === row.asset_id);
  if (existing) return null;
  const metadata = parseJson(row.metadata_json, {});
  const packIds = Object.keys(metadata.promotedPackItemIds || {});
  const characterLabel = row.character_id
    ? row.character_id[0].toUpperCase() + row.character_id.slice(1)
    : 'Character';
  return {
    assetId: row.asset_id,
    slot: 'portrait',
    targetType: 'character',
    targetId: row.character_id,
    variantId: `plan_${String(row.id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    name: metadata.name || { en: `${characterLabel} season portrait`, ru: `${characterLabel} season portrait` },
    path: row.image_path,
    price: null,
    currencyCode: WALLET_CURRENCY_CODE,
    acquisitionMode: 'gacha',
    packId: metadata.primaryPackId || metadata.lastPromotedPackId || packIds[0] || null,
    packIds,
    rarity: row.rarity || 'common',
    dropWeight: Number(row.drop_weight || 1),
    maxCopiesPerPlayer: 1,
    source: 'gacha_plan',
    planItemId: row.id,
    status: row.status
  };
}

function catalogWithFixturePlanRows(catalog, planRows) {
  const merged = [...catalog];
  for (const row of planRows) {
    const asset = planCatalogAssetFromRow(row, merged);
    if (asset) merged.push(asset);
  }
  return merged;
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
    throw new Error(`Approved gacha fixture pack ${result.packId} failed validation: ${result.validation.errors.map((issue) => issue.code).join(', ')}`);
  }
  if (!result.releaseChecklist.ok) {
    throw new Error(`Approved gacha fixture pack ${result.packId} failed release checklist: ${result.releaseChecklist.blockers.map((issue) => issue.code).join(', ')}`);
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
  return (releaseChecklist.warnings || [])
    .find((issue) => issue.code === 'asset_policy_mapping_recommended')
    ?.recommendations || [];
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
    getRuntimeAssetCatalog()
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
      const catalog = catalogWithFixturePlanRows(await getRuntimeAssetCatalog({ client }), [...planRows.values()]);
      const result = fixturePackResult(packRow, itemRowsByPack.get(packId) || [], { seasonRow, collectionRow, catalog });
      assertApprovedImportReady(result);
      packResults.push(result);
    }

    const summary = summarizeFixtureOperations(operations);
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
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value)) throw new Error('Gacha plan item ids must be an array');
  return value.map((id) => requiredText(id, 'Gacha plan item id'));
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
  return {
    ...existingMetadata,
    source: 'gacha_plan',
    sourcePlanItemId: planRow.id,
    sourceSeasonId: planRow.season_id,
    characterId: planRow.character_id,
    imagePath: planRow.image_path,
    fileName: planRow.file_name || null,
    mimeType: planRow.mime_type,
    promotedToPackId: packRow.id
  };
}

function promotedPlanMetadata(planRow, packItem, packRow) {
  const metadata = parseJson(planRow.metadata_json, {});
  const promotedPackIds = Array.from(new Set([...(metadata.promotedPackIds || []), packRow.id]));
  const promotedPackItemIds = {
    ...(metadata.promotedPackItemIds || {}),
    [packRow.id]: packItem.id
  };
  return {
    ...metadata,
    promotedPackIds,
    promotedPackItemIds,
    lastPromotedAt: nowIso(),
    lastPromotedPackId: packRow.id,
    lastPromotedPackItemId: packItem.id
  };
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
