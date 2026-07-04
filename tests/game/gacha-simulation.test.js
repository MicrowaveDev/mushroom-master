import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../app/server/db.js';
import { portraitAssetId } from '../../app/server/services/asset-service.js';
import {
  simulateAssetPackOdds,
  simulateRuntimeAssetPackOdds
} from '../../app/server/services/gacha-simulation-service.js';
import { freshDb } from './helpers.js';

async function withEnv(overrides, work) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  try {
    return await work();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function controlledPackOverride(items) {
  return JSON.stringify({
    season_1_portraits: {
      items
    }
  });
}

async function seedRuntimePlanPack({
  packId = 'sim_runtime_pack',
  seasonId = 'sim_runtime_season',
  collectionId = 'sim_runtime_collection',
  planItemId = 'sim_runtime_plan_item',
  assetId = `planned_portrait.thalla.${planItemId}`
} = {}) {
  const now = new Date().toISOString();
  await query(
    `INSERT INTO asset_gacha_seasons
     (id, name_json, status, starts_at, ends_at, metadata_json, created_by, created_at, updated_at)
     VALUES ($1, $2, 'active', '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', '{}', 'test', $3, $3)`,
    [seasonId, JSON.stringify({ en: 'Runtime Simulation Season' }), now]
  );
  await query(
    `INSERT INTO asset_gacha_collections
     (id, season_id, name_json, status, starts_at, ends_at, metadata_json, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', '{}', 'test', $4, $4)`,
    [collectionId, seasonId, JSON.stringify({ en: 'Runtime Simulation Collection' }), now]
  );
  await query(
    `INSERT INTO asset_gacha_plan_items
     (id, season_id, character_id, asset_id, image_path, file_name, mime_type,
      rarity, drop_weight, status, metadata_json, created_by, created_at, updated_at)
     VALUES ($1, $2, 'thalla', $3, '/gacha-plan/sim-runtime/thalla.png', 'thalla.png',
      'image/png', 'rare', 7, 'ready', '{}', 'test', $4, $4)`,
    [planItemId, seasonId, assetId, now]
  );
  await query(
    `INSERT INTO asset_gacha_packs
     (id, season_id, collection_id, name_json, status, review_status, starts_at, ends_at,
      roll_price_currency_code, roll_price_amount, roll_size, rarity_table_version,
      rarity_weights_json, slots_json, guarantees_json, pity_rules_json, duplicate_policy_json,
      burn_rules_json, metadata_json, created_by, reviewed_by, reviewed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', 'approved', '2026-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z', 'soft_coin', 11, 1, $5,
      NULL, NULL, NULL, NULL, NULL, NULL, $6, 'test', 'reviewer', $7, $7, $7)`,
    [
      packId,
      seasonId,
      collectionId,
      JSON.stringify({ en: 'Runtime Simulation Pack' }),
      `${packId}:db:v1`,
      JSON.stringify({ disclosure: { en: 'Contains runtime plan assets.' } }),
      now
    ]
  );
  await query(
    `INSERT INTO asset_gacha_pack_items
     (id, pack_id, asset_id, rarity, drop_weight, copy_limit, item_order, metadata_json, created_at, updated_at)
     VALUES ($1, $2, $3, 'rare', 7, NULL, 0, $4, $5, $5)`,
    [
      `sim_item_${planItemId}`,
      packId,
      assetId,
      JSON.stringify({ source: 'gacha_plan', sourcePlanItemId: planItemId }),
      now
    ]
  );
  return { packId, assetId, planItemId };
}

test('[Req 14-F] gacha odds simulation uses current weighted roll semantics', async () => {
  const common = portraitAssetId('thalla', '1');
  const rare = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_PACK_OVERRIDES_JSON: controlledPackOverride([
      { assetId: common, rarity: 'common', dropWeight: 1 },
      { assetId: rare, rarity: 'rare', dropWeight: 3 }
    ])
  }, async () => {
    const sequence = [0, 0.24, 0.25, 0.99];
    let index = 0;
    const result = simulateAssetPackOdds('season_1_portraits', {
      trials: sequence.length,
      rng: () => sequence[index++ % sequence.length]
    });

    assert.equal(result.rollable, true);
    assert.equal(result.totalWeight, 4);
    assert.equal(result.guarantees.supported, false);
    assert.deepEqual(result.warnings, []);

    const commonItem = result.items.find((item) => item.assetId === common);
    const rareItem = result.items.find((item) => item.assetId === rare);
    assert.equal(commonItem.expectedProbability, 0.25);
    assert.equal(rareItem.expectedProbability, 0.75);
    assert.equal(commonItem.observedCount, 2);
    assert.equal(rareItem.observedCount, 2);
    assert.equal(result.raritySummary.find((row) => row.rarity === 'common').observedCount, 2);
    assert.equal(result.raritySummary.find((row) => row.rarity === 'rare').observedCount, 2);
  });
});

test('[Req 14-F] gacha odds simulation excludes owned and missing pack items', async () => {
  const owned = portraitAssetId('thalla', '1');
  const remaining = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_PACK_OVERRIDES_JSON: controlledPackOverride([
      { assetId: owned, rarity: 'common', dropWeight: 1 },
      { assetId: remaining, rarity: 'rare', dropWeight: 3 },
      { assetId: 'portrait.missing.ghost', rarity: 'secret', dropWeight: 100 }
    ])
  }, async () => {
    const result = simulateAssetPackOdds('season_1_portraits', {
      trials: 8,
      ownedAssetIds: [owned],
      seed: 'owned-filter'
    });

    assert.equal(result.candidateCount, 1);
    assert.equal(result.totalWeight, 3);
    assert.equal(result.items[0].assetId, remaining);
    assert.equal(result.items[0].expectedProbability, 1);
    assert.equal(result.items[0].observedCount, 8);
    assert.ok(result.warnings.find((entry) => entry.code === 'owned_items_excluded'));
    assert.ok(result.warnings.find((entry) => entry.code === 'missing_asset_items'));
  });
});

test('[Req 14-F] gacha odds simulation includes owned items for duplicate-enabled packs', async () => {
  const owned = portraitAssetId('thalla', '1');
  const remaining = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        duplicatePolicy: 'allow_duplicates',
        items: [
          { assetId: owned, rarity: 'common', dropWeight: 1 },
          { assetId: remaining, rarity: 'rare', dropWeight: 3 }
        ]
      }
    })
  }, async () => {
    const sequence = [0, 0.99, 0.1, 0.5];
    let index = 0;
    const result = simulateAssetPackOdds('season_1_portraits', {
      trials: sequence.length,
      ownedAssetIds: [owned],
      rng: () => sequence[index++ % sequence.length]
    });

    assert.equal(result.duplicatePolicy.enabled, true);
    assert.equal(result.candidateCount, 2);
    assert.equal(result.totalWeight, 4);
    assert.ok(result.warnings.find((entry) => entry.code === 'owned_items_included_as_duplicates'));
    assert.equal(result.warnings.find((entry) => entry.code === 'owned_items_excluded'), undefined);
    assert.equal(result.items.find((item) => item.assetId === owned).observedCount, 2);
    assert.equal(result.items.find((item) => item.assetId === remaining).observedCount, 2);
  });
});

test('[Req 14-F] gacha odds simulation respects duplicate copy caps', async () => {
  const capped = portraitAssetId('thalla', '1');
  const open = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        duplicatePolicy: { mode: 'allow_duplicates', maxCopiesPerAsset: 2 },
        items: [
          { assetId: capped, rarity: 'common', dropWeight: 1 },
          { assetId: open, rarity: 'rare', dropWeight: 3 }
        ]
      }
    })
  }, async () => {
    const result = simulateAssetPackOdds('season_1_portraits', {
      trials: 4,
      ownedAssetIds: [capped, open],
      ownedCopyCounts: {
        [capped]: 2,
        [open]: 1
      },
      rng: () => 0
    });

    assert.equal(result.duplicatePolicy.enabled, true);
    assert.equal(result.duplicatePolicy.maxCopiesPerAsset, 2);
    assert.equal(result.candidateCount, 1);
    assert.equal(result.items[0].assetId, open);
    assert.equal(result.items[0].ownedCopies, 1);
    assert.equal(result.items[0].copyLimit, 2);
    assert.equal(result.items[0].copyCapped, false);
    assert.equal(result.items[0].observedCount, 4);
  });
});

test('[Req 14-F] gacha odds simulation supports multi-slot pack openings', async () => {
  const common = portraitAssetId('thalla', '1');
  const rare = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        rollSize: 2,
        slots: [
          { rarityWeights: { common: 1 } },
          { rarityWeights: { rare: 1 } }
        ],
        items: [
          { assetId: common, rarity: 'common', dropWeight: 1 },
          { assetId: rare, rarity: 'rare', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    const sequence = [0, 0, 0, 0];
    let index = 0;
    const result = simulateAssetPackOdds('season_1_portraits', {
      trials: 4,
      rng: () => sequence[index++ % sequence.length]
    });

    assert.equal(result.rollable, true);
    assert.equal(result.rollSize, 2);
    assert.equal(result.averageItemsPerRoll, 2);
    assert.equal(result.guarantees.supported, false);
    assert.equal(result.pity.supported, false);

    const commonItem = result.items.find((item) => item.assetId === common);
    const rareItem = result.items.find((item) => item.assetId === rare);
    assert.equal(commonItem.expectedProbability, null);
    assert.equal(commonItem.observedCount, 4);
    assert.equal(commonItem.observedProbability, 1);
    assert.equal(rareItem.observedCount, 4);
    assert.equal(rareItem.observedProbability, 1);
    assert.equal(result.raritySummary.find((row) => row.rarity === 'common').observedCount, 4);
    assert.equal(result.raritySummary.find((row) => row.rarity === 'rare').observedCount, 4);
  });
});

test('[Req 14-F] gacha odds simulation applies configured guarantees', async () => {
  const commonA = portraitAssetId('thalla', '1');
  const commonB = portraitAssetId('lomie', '1');
  const rare = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        rollSize: 2,
        slots: [
          { rarityWeights: { common: 1 } },
          { rarityWeights: { common: 1 } }
        ],
        guarantees: [
          { id: 'one_rare_plus', minRarity: 'rare', count: 1 }
        ],
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 1 },
          { assetId: commonB, rarity: 'common', dropWeight: 1 },
          { assetId: rare, rarity: 'rare', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    const sequence = [0, 0, 0, 0, 0, 0];
    let index = 0;
    const result = simulateAssetPackOdds('season_1_portraits', {
      trials: 3,
      rng: () => sequence[index++ % sequence.length]
    });

    assert.equal(result.rollable, true);
    assert.equal(result.guarantees.supported, true);
    assert.equal(result.guarantees.configured[0].id, 'one_rare_plus');
    assert.equal(result.items.find((item) => item.assetId === rare).observedCount, 3);
    assert.equal(result.raritySummary.find((row) => row.rarity === 'rare').observedCount, 3);
    assert.equal(result.items.find((item) => item.assetId === rare).expectedProbability, null);
  });
});

test('[Req 14-F] runtime gacha odds simulation supports DB packs with promoted plan assets', async () => {
  await withEnv({
    ASSET_GACHA_DB_PACKS_ENABLED: 'true'
  }, async () => {
    await freshDb();
    const { packId, assetId } = await seedRuntimePlanPack();
    const result = await simulateRuntimeAssetPackOdds(packId, {
      trials: 5,
      rng: () => 0
    });

    assert.equal(result.source, 'database');
    assert.equal(result.packId, packId);
    assert.equal(result.rollable, true);
    assert.equal(result.active, true);
    assert.equal(result.candidateCount, 1);
    assert.equal(result.totalWeight, 7);
    assert.equal(result.items[0].assetId, assetId);
    assert.equal(result.items[0].rarity, 'rare');
    assert.equal(result.items[0].observedCount, 5);
    assert.equal(result.items[0].asset.targetId, 'thalla');
    assert.equal(result.items[0].asset.variantId, 'plan_sim_runtime_plan_item');
    assert.deepEqual(result.warnings, []);
  });
});
