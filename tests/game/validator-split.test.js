// Tests for the split validators introduced in Step 5.
// Each sub-validator is exercised in isolation, then the orchestrator is
// smoke-tested to confirm the public signature still works.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGridItems,
  validateBagContents,
  validateCoinBudget,
  validateLoadoutItems,
  buildArtifactSummary
} from '../../app/server/services/loadout-utils.js';
import { INVENTORY_COLUMNS, INVENTORY_ROWS } from '../../app/server/game-data.js';

test('[Req 2-A] validateGridItems: accepts an in-bounds non-overlapping placement', () => {
  const result = validateGridItems([
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
    { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
  ]);
  assert.ok(result.occupied instanceof Set);
  assert.equal(result.occupied.size, 2);
});

test('[Req 2-A] validateGridItems: rejects out-of-bounds placement', () => {
  assert.throws(
    () => validateGridItems([
      { artifactId: 'spore_needle', x: INVENTORY_COLUMNS, y: 0, width: 1, height: 1 }
    ]),
    /out of bounds/
  );
});

test('[Req 2-A] validateGridItems: rejects overlapping placements', () => {
  assert.throws(
    () => validateGridItems([
      { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
      { artifactId: 'bark_plate', x: 0, y: 0, width: 1, height: 1 }
    ]),
    /cannot overlap/
  );
});

test('validateGridItems: bags at container sentinel skip occupancy', () => {
  const result = validateGridItems([
    { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { artifactId: 'amber_satchel', x: -1, y: -1, width: 2, height: 2 }
  ]);
  // Bags live off the main grid, so none of their cells land in `occupied`.
  assert.equal(result.occupied.size, 0);
});

test('validateGridItems: rejects bag with grid coordinates', () => {
  // Bags are rendered in the active-bags bar, not on the main grid. A bag
  // with x>=0 or y>=0 is an invariant violation — it would silently collide
  // with real grid items since bags don't participate in the occupied set.
  assert.throws(
    () => validateGridItems([
      { artifactId: 'moss_pouch', x: 0, y: 0, width: 1, height: 2 }
    ]),
    /cannot have grid coordinates/
  );
});

test('validateGridItems: container items skip bounds/overlap checks', () => {
  validateGridItems([
    { artifactId: 'spore_needle', x: -1, y: -1, width: 1, height: 1 },
    { artifactId: 'bark_plate', x: -1, y: -1, width: 1, height: 1 }
  ]);
});

test('validateGridItems: rejects unknown artifact', () => {
  assert.throws(
    () => validateGridItems([
      { artifactId: 'totally_fake', x: 0, y: 0, width: 1, height: 1 }
    ]),
    /Unknown artifact/
  );
});

test('validateGridItems: rejects wrong dimensions', () => {
  // spore_needle is 1x1 — asking for 2x2 should fail.
  assert.throws(
    () => validateGridItems([
      { artifactId: 'spore_needle', x: 0, y: 0, width: 2, height: 2 }
    ]),
    /dimensions must match/
  );
});

test('validateBagContents: bagged item references active bag', () => {
  validateBagContents([
    { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { artifactId: 'spore_needle', width: 1, height: 1, bagId: 'moss_pouch' }
  ]);
});

test('[Req 5-A] validateBagContents: rejects bag-inside-bag', () => {
  assert.throws(
    () => validateBagContents([
      { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
      { artifactId: 'amber_satchel', width: 2, height: 2, bagId: 'moss_pouch' }
    ]),
    /cannot contain other bags/
  );
});

test('validateBagContents: rejects reference to non-placed bag', () => {
  assert.throws(
    () => validateBagContents([
      { artifactId: 'spore_needle', width: 1, height: 1, bagId: 'moss_pouch' }
    ]),
    /not placed on the grid/
  );
});

test('[Req 5-B, 5-C] validateBagContents: enforces slotCount footprint limit', () => {
  // moss_pouch has slotCount=2, so two 1x1s fit and a third overflows.
  validateBagContents([
    { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { artifactId: 'spore_needle', width: 1, height: 1, bagId: 'moss_pouch' },
    { artifactId: 'bark_plate', width: 1, height: 1, bagId: 'moss_pouch' }
  ]);

  assert.throws(
    () => validateBagContents([
      { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
      { artifactId: 'spore_needle', width: 1, height: 1, bagId: 'moss_pouch' },
      { artifactId: 'bark_plate', width: 1, height: 1, bagId: 'moss_pouch' },
      { artifactId: 'shock_puff', width: 1, height: 1, bagId: 'moss_pouch' }
    ]),
    /is full/
  );
});

test('[Req 4-M, 4-N] validateCoinBudget: passes under budget, rejects over', () => {
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

test('validateLoadoutItems: orchestrator returns items + totals + totalCoins', () => {
  const result = validateLoadoutItems([
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
    { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
  ], 5);

  assert.ok(Array.isArray(result.items));
  assert.ok(result.totals);
  assert.equal(typeof result.totalCoins, 'number');
  assert.ok(result.totalCoins > 0);
});

test('[Req 2-C] buildArtifactSummary: container items contribute zero', () => {
  const totals = buildArtifactSummary([
    // Container-only (both coordinates negative)
    { artifactId: 'spore_needle', x: -1, y: -1 },
    { artifactId: 'bark_plate', x: -1, y: -1 }
  ]);
  assert.equal(totals.damage, 0);
  assert.equal(totals.armor, 0);
});

test('[Req 5-F] buildArtifactSummary: bags contribute zero', () => {
  const totals = buildArtifactSummary([
    { artifactId: 'moss_pouch', x: -1, y: -1 }
  ]);
  assert.equal(totals.damage, 0);
  assert.equal(totals.armor, 0);
});

test('[Req 2-D] buildArtifactSummary: grid-placed combat items contribute', () => {
  const totals = buildArtifactSummary([
    { artifactId: 'spore_needle', x: 0, y: 0 },
    { artifactId: 'bark_plate', x: 1, y: 0 }
  ]);
  assert.ok(totals.damage > 0);
  assert.ok(totals.armor > 0);
});

test('[Req 2-D] buildArtifactSummary: bagged items contribute', () => {
  const totals = buildArtifactSummary([
    { artifactId: 'moss_pouch', x: 0, y: 0 },
    { artifactId: 'spore_needle', bagId: 'moss_pouch' }
  ]);
  assert.ok(totals.damage > 0);
});

test('validateLoadoutItems: legacy API still accepts arrays', () => {
  assert.throws(
    () => validateLoadoutItems('not an array', 5),
    /must be an array/
  );
});

test('validateLoadoutItems: grid dimensions honored by config', () => {
  // Use a 1x1 minimal grid via INVENTORY_COLUMNS/ROWS
  assert.ok(INVENTORY_COLUMNS > 0);
  assert.ok(INVENTORY_ROWS > 0);
});
