import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BackpackGameClient,
  createLoadoutValidator,
  createSeededRng,
  getEffectiveShape,
  generateShopOffer,
  prepareGridProps,
  pieceCells,
  shuffleWithRng,
  simulateBattle
} from '@microwavedev/backpack-game-core';
import {
  resolveAssetCatalogAcquisitionPolicy,
  validateAssetGachaPack
} from '@microwavedev/backpack-game-core/modules/gacha';
import {
  createRunAchievementService,
  createSeasonLevelService
} from '@microwavedev/backpack-game-core/modules/season';
import { applyWalletBalanceDelta } from '@microwavedev/backpack-game-core/modules/wallet';
import {
  createProfileAssetState,
  shapeProfileAssetTargetVariants
} from '@microwavedev/backpack-game-core/modules/assets';
import { createMutationClaimService } from '@microwavedev/backpack-game-core/server';
import {
  createMushroomBattleEnginePort,
  createMushroomBattleServicePort,
  createMushroomGameServicePort,
  createMushroomPlayerServicePort,
  createMushroomRunServicePort,
  createMushroomShopServicePort,
  createSeasonProgressPort
} from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { checkBackpackGameCoreSubmodule } from '../../app/scripts/check-backpack-game-core-submodule.js';

test('[core-submodule] backpack-game-core nested submodule is initialized', () => {
  const result = checkBackpackGameCoreSubmodule();

  assert.equal(result.packageName, '@microwavedev/backpack-game-core');
  assert.ok(result.coreDir.endsWith('vendor/backpack-game-core'));
});

test('[core-submodule] package-name imports resolve reusable core helpers', () => {
  assert.equal(typeof getEffectiveShape, 'function');
  assert.equal(typeof createLoadoutValidator, 'function');
  assert.equal(typeof createSeededRng, 'function');
  assert.equal(typeof BackpackGameClient, 'function');
  assert.equal(typeof generateShopOffer, 'function');
  assert.equal(typeof prepareGridProps, 'function');
  assert.equal(typeof pieceCells, 'function');
  assert.equal(typeof shuffleWithRng, 'function');
  assert.equal(typeof simulateBattle, 'function');
  assert.equal(typeof validateAssetGachaPack, 'function');
  assert.equal(typeof resolveAssetCatalogAcquisitionPolicy, 'function');
  assert.equal(typeof applyWalletBalanceDelta, 'function');
  assert.equal(typeof createProfileAssetState, 'function');
  assert.equal(typeof createSeasonLevelService, 'function');
  assert.equal(typeof createRunAchievementService, 'function');
  assert.equal(typeof createMutationClaimService, 'function');
  assert.equal(typeof createMushroomBattleEnginePort, 'function');
  assert.equal(typeof createMushroomBattleServicePort, 'function');
  assert.equal(typeof createMushroomGameServicePort, 'function');
  assert.equal(typeof createMushroomPlayerServicePort, 'function');
  assert.equal(typeof createMushroomRunServicePort, 'function');
  assert.equal(typeof createMushroomShopServicePort, 'function');
  assert.equal(typeof createSeasonProgressPort, 'function');

  assert.deepEqual(getEffectiveShape({ width: 1, height: 1 }, false), [[1]]);
  assert.deepEqual(pieceCells({ x: 0, y: 0, width: 1, height: 2 }), ['0:0', '0:1']);
  assert.deepEqual(shuffleWithRng(['a', 'b', 'c'], createSeededRng(3)), ['b', 'a', 'c']);
  assert.equal(applyWalletBalanceDelta(10, -4).balanceAfter, 6);
  assert.equal(createProfileAssetState({
    instances: [{ asset_id: 'portrait.axilin.1', status: 'active' }]
  }).ownedAssetIds.has('portrait.axilin.1'), true);
  assert.equal(shapeProfileAssetTargetVariants({
    variants: [{ id: '1', assetId: 'portrait.axilin.1' }],
    catalog: [{ assetId: 'portrait.axilin.1', price: 500 }],
    activeVariantId: '1'
  })[0].active, true);
  assert.equal(resolveAssetCatalogAcquisitionPolicy({
    assetId: 'portrait.axilin.1',
    price: 500
  }, {
    defaultPaidMode: 'gacha',
    defaultPackId: 'season_1_portraits'
  }).packId, 'season_1_portraits');
  assert.equal(createSeasonLevelService({
    levels: [{ id: 'bronze', minPoints: 0 }, { id: 'silver', minPoints: 5 }]
  }).getSeasonLevel(6).id, 'silver');
  assert.equal(createRunAchievementService({
    achievements: {
      general: [{ id: 'first_win', criteria: { minWins: 1 } }],
      characters: {}
    }
  }).getAwardableRunAchievements({ wins: 1 })[0].id, 'first_win');

  const result = simulateBattle({
    left: { side: 'left', name: 'left', maxHealth: 10, currentHealth: 10, attack: 10, speed: 2, defense: 0 },
    right: { side: 'right', name: 'right', maxHealth: 10, currentHealth: 10, attack: 1, speed: 1, defense: 0 },
    rng: () => 0,
    stepCap: 1
  });
  assert.equal(result.winnerSide, 'left');
});
