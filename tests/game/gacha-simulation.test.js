import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitAssetId } from '../../app/server/services/asset-service.js';
import { simulateAssetPackOdds } from '../../app/server/services/gacha-simulation-service.js';

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
