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
import { validateAssetGachaPack } from '@microwavedev/backpack-game-core/modules/gacha';
import { applyWalletBalanceDelta } from '@microwavedev/backpack-game-core/modules/wallet';
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
  assert.equal(typeof applyWalletBalanceDelta, 'function');

  assert.deepEqual(getEffectiveShape({ width: 1, height: 1 }, false), [[1]]);
  assert.deepEqual(pieceCells({ x: 0, y: 0, width: 1, height: 2 }), ['0:0', '0:1']);
  assert.deepEqual(shuffleWithRng(['a', 'b', 'c'], createSeededRng(3)), ['b', 'a', 'c']);
  assert.equal(applyWalletBalanceDelta(10, -4).balanceAfter, 6);

  const result = simulateBattle({
    left: { side: 'left', name: 'left', maxHealth: 10, currentHealth: 10, attack: 10, speed: 2, defense: 0 },
    right: { side: 'right', name: 'right', maxHealth: 10, currentHealth: 10, attack: 1, speed: 1, defense: 0 },
    rng: () => 0,
    stepCap: 1
  });
  assert.equal(result.winnerSide, 'left');
});
