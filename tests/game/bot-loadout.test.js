import test from 'node:test';
import assert from 'node:assert/strict';
import { createBotLoadout, createBotGhostSnapshot } from '../../app/server/services/bot-loadout.js';
import { getMushroomById, getStarterPresetCost, mushrooms, INVENTORY_COLUMNS, INVENTORY_ROWS, getArtifactById, getArtifactPrice } from '../../app/server/game-data.js';
import { createRng } from '../../app/server/lib/utils.js';

test('[Req 7-E, 7-F] bot loadout generates successfully for all mushrooms at default 5-coin budget', () => {
  for (const mushroom of mushrooms) {
    const rng = createRng(`test-${mushroom.id}`);
    const loadout = createBotLoadout(mushroom, rng, 5);
    assert.ok(loadout.items.length > 0, `${mushroom.id}: no items generated`);
    assert.equal(loadout.gridWidth, INVENTORY_COLUMNS);
    assert.equal(loadout.gridHeight, INVENTORY_ROWS);
  }
});

test('[Req 7-D] bot loadout handles high budgets without failing', () => {
  // Game run budgets can reach 57 coins at round 9 cumulative
  const budgets = [5, 10, 15, 21, 27, 34, 41, 49, 57];
  for (const budget of budgets) {
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(`budget-test-${budget}-${seed}`);
      // Should not throw
      const loadout = createBotLoadout(getMushroomById('thalla'), rng, budget);
      assert.ok(loadout.items.length > 0, `Budget ${budget} seed ${seed}: no items`);
    }
  }
});

test('[Req 2-A] bot loadout never exceeds grid area', () => {
  const maxArea = INVENTORY_COLUMNS * INVENTORY_ROWS;
  for (let seed = 0; seed < 50; seed++) {
    const rng = createRng(`area-test-${seed}`);
    const loadout = createBotLoadout(getMushroomById('kirt'), rng, 57);
    const totalArea = loadout.items.reduce((sum, item) => sum + item.width * item.height, 0);
    assert.ok(totalArea <= maxArea, `Seed ${seed}: total area ${totalArea} exceeds grid max ${maxArea}`);
  }
});

test('[Req 5-F] bot loadout never contains bags (bots only use combat items)', () => {
  for (let seed = 0; seed < 20; seed++) {
    const rng = createRng(`no-bags-${seed}`);
    const loadout = createBotLoadout(getMushroomById('lomie'), rng, 30);
    for (const item of loadout.items) {
      const artifact = getArtifactById(item.artifactId);
      assert.notEqual(artifact.family, 'bag', `Seed ${seed}: bot loadout contains a bag (${item.artifactId})`);
    }
  }
});

test('[Req 4-O, 7-D] bot loadout respects coin budget (shop spend + preset)', () => {
  for (let seed = 0; seed < 30; seed++) {
    const budget = 5 + (seed % 10) * 3;
    const mushroom = getMushroomById('axilin');
    const rng = createRng(`budget-check-${seed}`);
    const loadout = createBotLoadout(mushroom, rng, budget);
    const totalCost = loadout.items.reduce((sum, item) => {
      const art = getArtifactById(item.artifactId);
      return sum + getArtifactPrice(art);
    }, 0);
    const ceiling = budget + getStarterPresetCost(mushroom.id);
    assert.ok(totalCost <= ceiling, `Seed ${seed}: cost ${totalCost} exceeds ceiling ${ceiling}`);
  }
});

test('[Req 7-C] createBotGhostSnapshot returns valid snapshot with given mushroom', () => {
  const snapshot = createBotGhostSnapshot('ghost-seed-1', 'morga', 15);
  assert.equal(snapshot.mushroomId, 'morga');
  // Loadout must contain at least the 2-item preset + bought items.
  assert.ok(snapshot.loadout.items.length >= 2, `expected at least 2 items (preset), got ${snapshot.loadout.items.length}`);
  assert.equal(snapshot.playerId, null);
});
