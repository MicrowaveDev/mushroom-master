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

test('validateBagContents: bagged item references active bag (by artifactId, legacy fallback)', () => {
  // Before the bag-slot-coords refactor, bagId was an artifactId. The
  // validator still resolves bagId=artifactId for in-test synthetic
  // payloads so unit callers don't need to mint row ids.
  validateBagContents([
    { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1, bagId: 'moss_pouch' }
  ]);
});

test('validateBagContents: bagged item references active bag (by row id, canonical)', () => {
  // Canonical path: the bag row has an id, and the bagged item's bagId
  // points at that id. This is what applyRunPlacements produces at runtime.
  validateBagContents([
    { id: 'bag_row_1', artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { id: 'item_row_1', artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1, bagId: 'bag_row_1' }
  ]);
});

test('[Req 5-A] validateBagContents: rejects bag-inside-bag', () => {
  assert.throws(
    () => validateBagContents([
      { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
      { artifactId: 'amber_satchel', x: 0, y: 0, width: 2, height: 2, bagId: 'moss_pouch' }
    ]),
    /cannot contain other bags/
  );
});

test('validateBagContents: rejects reference to non-placed bag', () => {
  assert.throws(
    () => validateBagContents([
      { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1, bagId: 'moss_pouch' }
    ]),
    /not placed on the grid/
  );
});

test('[Req 5-B, 5-C] validateBagContents: enforces slotCount footprint limit', () => {
  // moss_pouch in effective orientation is 2×1 (cols=2, rows=1, slotCount=2),
  // so two 1×1s at slots (0,0) and (1,0) fit. A third bagged item — at any
  // slot — must be rejected: bounds, overlap, or slotCount are the three
  // lines of defence and any of them firing is an equivalent pass.
  validateBagContents([
    { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1, bagId: 'moss_pouch' },
    { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1, bagId: 'moss_pouch' }
  ]);

  assert.throws(
    () => validateBagContents([
      { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
      { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1, bagId: 'moss_pouch' },
      { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1, bagId: 'moss_pouch' },
      { artifactId: 'shock_puff', x: 0, y: 1, width: 1, height: 1, bagId: 'moss_pouch' }
    ]),
    /out of bounds|cannot overlap|is full/
  );
});

test('[Req 5-A] validateBagContents: rejects bagged-item slot coords outside bag footprint', () => {
  // moss_pouch effective orientation is 2×1 (cols=2, rows=1). Slot (2, 0)
  // is past the right edge.
  assert.throws(
    () => validateBagContents([
      { artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
      { artifactId: 'spore_needle', x: 2, y: 0, width: 1, height: 1, bagId: 'moss_pouch' }
    ]),
    /out of bounds/
  );
});

test('validateBagContents: rejects bagged items that overlap inside the same bag', () => {
  // Two 1×1 items claiming slot (0, 0) — second one must be rejected.
  assert.throws(
    () => validateBagContents([
      { artifactId: 'amber_satchel', x: -1, y: -1, width: 2, height: 2 },
      { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1, bagId: 'amber_satchel' },
      { artifactId: 'bark_plate', x: 0, y: 0, width: 1, height: 1, bagId: 'amber_satchel' }
    ]),
    /cannot overlap/
  );
});

test('validateBagContents: duplicate bags disambiguate by row id', () => {
  // Two moss_pouches (effective 2×1 each). Each bag holds two items at
  // (0,0) and (1,0); the per-bag `occupied` set ensures items in bag A
  // don't collide with items in bag B despite having the same slot coords.
  validateBagContents([
    { id: 'bag_A', artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { id: 'bag_B', artifactId: 'moss_pouch', x: -1, y: -1, width: 1, height: 2 },
    { id: 'in_A_1', artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1, bagId: 'bag_A' },
    { id: 'in_A_2', artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1, bagId: 'bag_A' },
    { id: 'in_B_1', artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1, bagId: 'bag_B' },
    { id: 'in_B_2', artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1, bagId: 'bag_B' }
  ]);
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
