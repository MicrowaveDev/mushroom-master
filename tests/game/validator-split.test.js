import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBagPlacement,
  validateGridItems,
  validateItemCoverage,
  validateCoinBudget,
  validateLoadoutItems,
  buildArtifactSummary,
  bagsContainingItem
} from '../../app/server/services/loadout-utils.js';
import { BAG_COLUMNS, BAG_ROWS } from '../../app/server/game-data.js';

const starterBag = {
  id: 'starter',
  artifactId: 'starter_bag',
  x: 0,
  y: 0,
  width: 3,
  height: 3,
  active: true
};

test('[Req 2-J] validateGridItems accepts absolute placed artifacts', () => {
  const result = validateGridItems([
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
    { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
  ]);
  assert.equal(result.occupied.size, 2);
});

test('[Req 2-J] validateGridItems rejects item overlap and bounds', () => {
  assert.throws(
    () => validateGridItems([
      { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
      { artifactId: 'bark_plate', x: 0, y: 0, width: 1, height: 1 }
    ]),
    /cannot overlap/
  );
  assert.throws(
    () => validateGridItems([
      { artifactId: 'spore_needle', x: BAG_COLUMNS, y: 0, width: 1, height: 1 }
    ]),
    /out of bounds/
  );
});

test('[Req 2-K] validateBagPlacement accepts active starter bag anchors', () => {
  const result = validateBagPlacement([starterBag]);
  assert.equal(result.occupied.size, 9);
});

test('[Req 2-K] validateBagPlacement rejects overlapping active bags', () => {
  assert.throws(
    () => validateBagPlacement([
      starterBag,
      { id: 'moss', artifactId: 'moss_pouch', x: 2, y: 0, width: 1, height: 2, active: true }
    ]),
    /Bag placements cannot overlap/
  );
});

test('[Req 2-J] validateItemCoverage accepts item inside one bag', () => {
  validateItemCoverage([
    starterBag,
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ]);
});

test('[Req 2-J] validateItemCoverage accepts item spanning two bags', () => {
  const moss = { id: 'moss', artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: true };
  validateBagPlacement([starterBag, moss]);
  validateGridItems([
    { artifactId: 'glass_cap', x: 2, y: 0, width: 2, height: 1 }
  ]);
  validateItemCoverage([
    starterBag,
    moss,
    { artifactId: 'glass_cap', x: 2, y: 0, width: 2, height: 1 }
  ]);
});

test('[Req 2-J] validateItemCoverage rejects uncovered item cells', () => {
  assert.throws(
    () => validateItemCoverage([
      starterBag,
      { artifactId: 'spore_needle', x: 5, y: 5, width: 1, height: 1 }
    ]),
    /uncovered cell/
  );
});

test('[Req 2-J] bagsContainingItem derives many-to-many membership', () => {
  const moss = { id: 'moss', artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: true };
  const bags = bagsContainingItem(
    { artifactId: 'glass_cap', x: 2, y: 0, width: 2, height: 1 },
    [starterBag, moss]
  );
  assert.deepEqual(bags.map((b) => b.id).sort(), ['moss', 'starter']);
});

test('[Req 4-M, 4-N] validateCoinBudget passes under budget, rejects over', () => {
  validateCoinBudget([
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }
  ], 5);

  assert.throws(
    () => validateCoinBudget([
      { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
      { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 },
      { artifactId: 'amber_fang', x: 2, y: 0, width: 1, height: 2 },
      { artifactId: 'glass_cap', x: 0, y: 1, width: 2, height: 1 }
    ], 2),
    /exceeds 2-coin budget/
  );
});

test('validateLoadoutItems orchestrates flat-grid validators', () => {
  const result = validateLoadoutItems([
    starterBag,
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
    { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
  ], 5);

  assert.ok(Array.isArray(result.items));
  assert.equal(typeof result.totalCoins, 'number');
  assert.ok(result.totals.damage > 0);
});

test('[Req 2-C, 2-D] buildArtifactSummary follows placement state', () => {
  const totals = buildArtifactSummary([
    { artifactId: 'spore_needle', x: -1, y: -1 },
    { artifactId: 'bark_plate', x: 1, y: 0 },
    { artifactId: 'starter_bag', x: 0, y: 0, active: true }
  ]);
  assert.equal(totals.damage, 0);
  assert.ok(totals.armor > 0);
});

test('validateLoadoutItems rejects non-arrays', () => {
  assert.throws(
    () => validateLoadoutItems('not an array', 5),
    /must be an array/
  );
});

test('grid constants remain available', () => {
  assert.ok(BAG_COLUMNS > 0);
  assert.ok(BAG_ROWS > 0);
});
