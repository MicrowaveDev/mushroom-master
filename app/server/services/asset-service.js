import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import {
  PORTRAIT_VARIANTS,
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

export function isAssetGachaEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.ASSET_GACHA_ENABLED || '').toLowerCase());
}

export function directBuyPolicy() {
  return process.env.ASSET_GACHA_DIRECT_BUY_POLICY || 'allow';
}

export function activeGachaPackIds() {
  const configured = parseCsvEnv(process.env.ASSET_GACHA_ACTIVE_PACK_IDS);
  return configured.length ? configured : [PORTRAIT_PACK_ID];
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
  const match = String(assetId || '').match(/^portrait\.([^.]+)\.(.+)$/);
  if (!match) return null;
  return { mushroomId: match[1], portraitId: match[2] };
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

function configuredRollPriceAmount() {
  const value = Number(process.env.ASSET_GACHA_ROLL_PRICE_AMOUNT || 500);
  return Number.isInteger(value) && value > 0 ? value : 500;
}

export function getAssetPacks() {
  const assets = getAssetCatalog().filter((asset) => asset.packId === PORTRAIT_PACK_ID);
  const packOverrides = parseJsonEnv('ASSET_GACHA_PACK_OVERRIDES_JSON', {});
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
      rollSize: 1,
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

export function getAssetPack(packId) {
  return getAssetPacks().find((pack) => pack.id === packId) || null;
}

function packIsActive(pack, now = new Date()) {
  if (!pack || pack.status !== 'active') return false;
  if (pack.startsAt && new Date(pack.startsAt) > now) return false;
  if (pack.endsAt && new Date(pack.endsAt) <= now) return false;
  if (isAssetGachaEnabled() && !activeGachaPackIds().includes(pack.id)) return false;
  return true;
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
  metadata = {}
}) {
  const existing = await activeAssetInstance(client, playerId, assetId);
  if (existing) return { row: existing, alreadyOwned: true };

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
  activePortraitId = 'default'
}) {
  const asset = getAssetById(portraitAssetId(mushroomId, variant.id));
  const owned = asset.price === 0 || cosmeticState.ownedAssetIds.has(asset.assetId);
  const policy = assetPolicy(asset);
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

  const legacy = await client.query(
    `SELECT active_portrait FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
    [playerId, mushroomId]
  );
  return legacy.rows[0]?.active_portrait || 'default';
}

export async function purchaseAsset(playerId, assetId, {
  idempotencyKey = null
} = {}) {
  const asset = getAssetById(assetId);
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
  const asset = getAssetById(assetId);
  if (!asset) throw httpError('Unknown asset', 404);
  if (asset.slot !== 'portrait' || asset.targetType !== 'character') {
    throw httpError('Unsupported asset equipment slot', 400);
  }

  return withWalletMutationLock(playerId, () => withTransaction(async (client) => {
    let instance = null;
    if (asset.price > 0) {
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

function chooseWeighted(candidates, rng) {
  const total = candidates.reduce((sum, candidate) => sum + Math.max(0, Number(candidate.dropWeight || 0)), 0);
  if (total <= 0) throw httpError('Gacha pack has no weighted candidates', 400);
  let target = rng() * total;
  for (const candidate of candidates) {
    target -= Math.max(0, Number(candidate.dropWeight || 0));
    if (target < 0) return candidate;
  }
  return candidates[candidates.length - 1];
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

export async function rollAssetPack(playerId, packId, {
  idempotencyKey = null,
  rng = secureRandomUnit
} = {}) {
  if (!isAssetGachaEnabled()) throw httpError('Asset gacha is disabled', 403);
  const pack = getAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);
  if (!packIsActive(pack)) throw httpError('Asset pack is not active', 403);

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
          return {
            roll: rowToRoll(existing.rows[0]),
            alreadyProcessed: true
          };
        }
      }

      const ownedRows = await client.query(
        `SELECT asset_id FROM player_asset_instances
         WHERE player_id = $1 AND status = 'active'`,
        [playerId]
      );
      const owned = new Set(ownedRows.rows.map((row) => row.asset_id));
      const candidates = pack.items
        .map((item) => ({ ...item, asset: getAssetById(item.assetId) }))
        .filter((item) => item.asset && !owned.has(item.assetId));

      if (!candidates.length) {
        throw httpError('No unowned assets left in this pack', 409);
      }

      const selected = chooseWeighted(candidates, rng);
      const candidatePoolHash = hashCandidatePool(candidates);
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
          selectedAssetId: selected.assetId
        }
      });

      const rollId = createId('roll');
      const inserted = await insertAssetInstance(client, {
        playerId,
        assetId: selected.assetId,
        acquisitionSource: 'gacha',
        acquisitionSourceId: rollId,
        metadata: {
          packId: pack.id,
          rarity: selected.rarity,
          transactionId: transaction.id
        }
      });

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
          JSON.stringify([selected.assetId]),
          JSON.stringify({ rollSize: 1 }),
          candidatePoolHash,
          selected.assetId,
          inserted.row.id,
          idempotencyKey,
          JSON.stringify({
            gachaEnabled: isAssetGachaEnabled(),
            directBuyPolicy: directBuyPolicy(),
            activePackIds: activeGachaPackIds()
          }),
          nowIso()
        ]
      );

      const rollRow = await client.query(`SELECT * FROM asset_rolls WHERE id = $1`, [rollId]);
      return {
        roll: rowToRoll(rollRow.rows[0]),
        asset: selected.asset,
        instance: rowToAssetInstance(inserted.row),
        transaction,
        alreadyProcessed: false
      };
    }))
  );
}

export function getPackOdds(packId) {
  const pack = getAssetPack(packId);
  if (!pack) throw httpError('Unknown asset pack', 404);
  const total = pack.items.reduce((sum, item) => sum + Number(item.dropWeight || 0), 0);
  return {
    id: pack.id,
    seasonId: pack.seasonId,
    collectionId: pack.collectionId,
    name: pack.name,
    status: pack.status,
    active: packIsActive(pack),
    rollPriceCurrencyCode: pack.rollPriceCurrencyCode,
    rollPriceAmount: pack.rollPriceAmount,
    rollSize: pack.rollSize,
    items: pack.items.map((item) => ({
      ...item,
      probability: total > 0 ? Number(item.dropWeight || 0) / total : 0,
      asset: getAssetById(item.assetId)
    }))
  };
}
