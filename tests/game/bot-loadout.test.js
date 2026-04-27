import test from 'node:test';
import assert from 'node:assert/strict';
import { createBotLoadout, createBotGhostSnapshot } from '../../app/server/services/bot-loadout.js';
import { getMushroomById, getStarterPreset, getStarterPresetCost, mushrooms, getArtifactById, getArtifactPrice } from '../../app/server/game-data.js';
import { BAG_COLUMNS, BAG_ROWS } from '../../app/shared/config.js';
import { getEffectiveShape } from '../../app/shared/bag-shape.js';
import { createRng } from '../../app/server/lib/utils.js';
import { bagsContainingItem, validateLoadoutItems } from '../../app/server/services/loadout-utils.js';

function shapeCells(x, y, shape) {
  const cells = [];
  for (let dy = 0; dy < shape.length; dy++) {
    for (let dx = 0; dx < (shape[dy] || []).length; dx++) {
      if (shape[dy][dx]) cells.push(`${x + dx}:${y + dy}`);
    }
  }
  return cells;
}

function candidateBagAnchors(artifact) {
  const candidates = [];
  for (const rotated of [0, 1, 2, 3]) {
    const shape = getEffectiveShape(artifact, rotated);
    const width = shape[0]?.length || 0;
    const height = shape.length;
    for (let y = 0; y <= BAG_ROWS - height; y++) {
      for (let x = 0; x + width <= BAG_COLUMNS; x++) {
        candidates.push({ x, y, width, height, rotated, shape });
      }
    }
  }
  return candidates.sort((left, right) =>
    left.y - right.y
    || left.x - right.x
    || (left.y + left.height) - (right.y + right.height)
    || left.height - right.height
    || Number(left.rotated) - Number(right.rotated)
  );
}

function firstFitBagAnchor(artifact, occupiedBagCells) {
  return candidateBagAnchors(artifact).find((candidate) =>
    shapeCells(candidate.x, candidate.y, candidate.shape).every((cell) => !occupiedBagCells.has(cell))
  );
}

test('[Req 7-E, 7-F] bot loadout generates successfully for all mushrooms at default 5-coin budget', () => {
  for (const mushroom of mushrooms) {
    const rng = createRng(`test-${mushroom.id}`);
    const loadout = createBotLoadout(mushroom, rng, 5);
    assert.ok(loadout.items.length > 0, `${mushroom.id}: no items generated`);
    assert.equal(loadout.gridWidth, BAG_COLUMNS);
    assert.equal(loadout.gridHeight, BAG_ROWS);
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

test('[Req 7-D, 7-E] first-round budget floor still buys a placed combat artifact', () => {
  const budget = 3;
  for (const mushroom of mushrooms) {
    const presetCombatCount = getStarterPreset(mushroom.id).length;
    for (let seed = 0; seed < 100; seed++) {
      const rng = createRng(`first-round-floor-${mushroom.id}-${seed}`);
      const loadout = createBotLoadout(mushroom, rng, budget);
      const combatItems = loadout.items.filter((item) => {
        const artifact = getArtifactById(item.artifactId);
        return artifact.family !== 'bag';
      });
      assert.ok(
        combatItems.length > presetCombatCount,
        `${mushroom.id} seed ${seed}: expected at least one bought combat artifact at ${budget}-coin budget`
      );
      validateLoadoutItems(loadout.items, budget + getStarterPresetCost(mushroom.id));
    }
  }
});

test('[Req 2-A] bot loadout never exceeds grid area', () => {
  const maxArea = BAG_COLUMNS * BAG_ROWS;
  for (let seed = 0; seed < 50; seed++) {
    const rng = createRng(`area-test-${seed}`);
    const loadout = createBotLoadout(getMushroomById('kirt'), rng, 57);
    const totalArea = loadout.items.reduce((sum, item) => {
      const artifact = getArtifactById(item.artifactId);
      return artifact.family === 'bag' ? sum : sum + item.width * item.height;
    }, 0);
    assert.ok(totalArea <= maxArea, `Seed ${seed}: total area ${totalArea} exceeds grid max ${maxArea}`);
  }
});

test('[Req 2-B, 7-D] high-budget bot loadouts buy bags and place items inside expanded bag cells', () => {
  for (let seed = 0; seed < 20; seed++) {
    const budget = 57;
    const mushroom = getMushroomById('lomie');
    const rng = createRng(`bot-bags-${seed}`);
    const loadout = createBotLoadout(mushroom, rng, budget);
    const nonStarterBags = loadout.items.filter((item) => {
      const artifact = getArtifactById(item.artifactId);
      return artifact.family === 'bag' && item.artifactId !== 'starter_bag';
    });
    assert.ok(nonStarterBags.length > 0, `Seed ${seed}: expected at least one bought bag`);

    const expandedItems = loadout.items.filter((item) => {
      const artifact = getArtifactById(item.artifactId);
      if (artifact.family === 'bag') return false;
      return bagsContainingItem(item, nonStarterBags).length > 0;
    });
    assert.ok(expandedItems.length > 0, `Seed ${seed}: expected at least one item placed in a bought bag`);
    validateLoadoutItems(loadout.items, budget + getStarterPresetCost(mushroom.id));
  }
});

test('[Req 2-G, 7-D] bot ghost bags use compact first-fit anchors instead of random scattered anchors', () => {
  for (const mushroom of mushrooms) {
    for (let seed = 0; seed < 20; seed++) {
      const budget = 57;
      const rng = createRng(`bot-compact-bags-${mushroom.id}-${seed}`);
      const loadout = createBotLoadout(mushroom, rng, budget);
      const occupied = new Set(shapeCells(0, 0, getEffectiveShape(getArtifactById('starter_bag'), false)));

      for (const item of loadout.items) {
        const artifact = getArtifactById(item.artifactId);
        if (artifact.family !== 'bag' || item.artifactId === 'starter_bag') continue;

        const expected = firstFitBagAnchor(artifact, occupied);
        assert.ok(expected, `${mushroom.id} seed ${seed}: expected a bag anchor for ${item.artifactId}`);
        assert.deepEqual(
          { x: item.x, y: item.y, rotated: Number(item.rotated || 0) },
          { x: expected.x, y: expected.y, rotated: expected.rotated },
          `${mushroom.id} seed ${seed}: ${item.artifactId} should use compact first-fit placement`
        );
        for (const cell of shapeCells(item.x, item.y, getEffectiveShape(artifact, item.rotated))) {
          occupied.add(cell);
        }
      }
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
