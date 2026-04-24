// Unit tests for the pure cell-classification helpers used by
// ArtifactGridBoard. These pin the "slot-first" contract — when two bags
// have overlapping bounding boxes and one has the cell as a slot, the
// classification must return 'bag-slot' (owned by that bag), not 'bag-box'
// (hidden mask gap). Regression from a screenshot showing a second bag's
// slot disappearing because it fell on top of the first bag's mask gap.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bagRowEntryFor,
  classifyCell
} from '../../web/src/helpers/grid-cell-classification.js';

const BASE_INV = { cols: 3, rows: 3 };

// Helpers to build a bagRows entry without boilerplate.
function row({ artifactId = 'moss_pouch', row: y, anchorX, cols, enabledXs, color = '#6b8f5e' }) {
  const bboxStart = anchorX;
  const bboxEnd = anchorX + cols;
  return {
    row: y,
    artifactId,
    color,
    enabledCells: enabledXs,
    bboxStart,
    bboxEnd
  };
}

test('[grid-cls] base inventory cells classify as base-inv before any bag is consulted', () => {
  // Even if a bag's bbox somehow covered a base-inventory cell, the
  // base-inv classification wins. This mirrors the intent that the
  // top-left 3x3 is always "the inventory", never a bag-zone cell.
  const bags = [row({ row: 0, anchorX: 0, cols: 3, enabledXs: [0, 1, 2] })];
  assert.equal(classifyCell(bags, 0, 0, BASE_INV), 'base-inv');
  assert.equal(classifyCell(bags, 2, 2, BASE_INV), 'base-inv');
});

test('[grid-cls] cell outside every bag is bag-empty (visible drop target)', () => {
  const bags = [row({ row: 0, anchorX: 3, cols: 2, enabledXs: [3, 4] })]; // moss 2x1 at (3, 0)
  assert.equal(classifyCell(bags, 5, 0, BASE_INV), 'bag-empty', 'col past rectangular bbox is empty');
  assert.equal(classifyCell(bags, 3, 1, BASE_INV), 'bag-empty', 'row past bag is empty');
});

test('[grid-cls] rectangular bag: all cells within bbox are slots', () => {
  // moss_pouch 2x1 at anchor (3, 0) — enabled = bbox, so bbox cells are
  // all slots. Cell past the right edge is empty, not disabled.
  const bags = [row({ row: 0, anchorX: 3, cols: 2, enabledXs: [3, 4] })];
  assert.equal(classifyCell(bags, 3, 0, BASE_INV), 'bag-slot');
  assert.equal(classifyCell(bags, 4, 0, BASE_INV), 'bag-slot');
  assert.equal(classifyCell(bags, 5, 0, BASE_INV), 'bag-empty');
});

test('[grid-cls] tetromino mask gap inside bbox but outside enabled classifies as bag-box (hidden)', () => {
  // Spiral cap Z-tetromino at anchor (3, 0):
  //   row 0 mask [1, 1, 0] → enabled cols 3, 4; gap at col 5
  //   row 1 mask [0, 1, 1] → enabled cols 4, 5; gap at col 3
  const bags = [
    row({ artifactId: 'spiral_cap', row: 0, anchorX: 3, cols: 3, enabledXs: [3, 4], color: '#b85a6e' }),
    row({ artifactId: 'spiral_cap', row: 1, anchorX: 3, cols: 3, enabledXs: [4, 5], color: '#b85a6e' })
  ];
  assert.equal(classifyCell(bags, 3, 0, BASE_INV), 'bag-slot');
  assert.equal(classifyCell(bags, 5, 0, BASE_INV), 'bag-box', 'top-right corner is a mask gap');
  assert.equal(classifyCell(bags, 3, 1, BASE_INV), 'bag-box', 'bottom-left corner is a mask gap');
  assert.equal(classifyCell(bags, 5, 1, BASE_INV), 'bag-slot');
});

test('[grid-cls][regression] overlapping bags: slot match wins over bbox match', () => {
  // Two tetromino bags whose bounding boxes overlap:
  //   bag A = spiral_cap at (3, 0)  → row 0 bbox cols 3-5, enabled [3, 4]
  //   bag B = mycelium_vine at (5, 0) → row 0 bbox col 5, enabled [5]
  // Cell (5, 0) lands in bag A's bbox (a mask gap) AND in bag B's slot.
  // Prior to the fix, `find` returned the first-matching entry, which in
  // iteration order meant bag A won → the cell rendered as hidden mask
  // gap and bag B's legitimate slot disappeared from the grid.
  const bags = [
    row({ artifactId: 'spiral_cap', row: 0, anchorX: 3, cols: 3, enabledXs: [3, 4], color: '#b85a6e' }),
    row({ artifactId: 'mycelium_vine', row: 0, anchorX: 5, cols: 1, enabledXs: [5], color: '#6e9bbf' })
  ];
  assert.equal(classifyCell(bags, 5, 0, BASE_INV), 'bag-slot',
    'overlap resolves to the slot-owning bag, not the bbox-gap bag');
  const entry = bagRowEntryFor(bags, 5, 0);
  assert.equal(entry.artifactId, 'mycelium_vine', 'slot-owning bag is returned for rendering');
});

test('[grid-cls][regression] overlap preserves the mask-gap hiding for truly-empty cells', () => {
  // Same overlap configuration as above, but check a cell that IS a mask
  // gap in bag A and NOT a slot in bag B (there is no such cell in this
  // exact layout — bag B only covers col 5, so checking col 5 where A has
  // the gap and B has the slot already shows the fix). Add a variant where
  // bag B's slot is elsewhere to confirm the fallback still hides A's gap:
  //   bag A = spiral_cap at (3, 0), row 0 bbox cols 3-5, enabled [3, 4]
  //   bag B = moss_pouch at (1, 0) (outside A's bbox — cols 1-2, enabled [1, 2])
  // At cell (5, 0): not in B; in A's bbox at an A-gap → 'bag-box'.
  const bags = [
    row({ artifactId: 'spiral_cap', row: 0, anchorX: 3, cols: 3, enabledXs: [3, 4], color: '#b85a6e' }),
    row({ artifactId: 'moss_pouch', row: 0, anchorX: 1, cols: 2, enabledXs: [1, 2] })
  ];
  assert.equal(classifyCell(bags, 5, 0, BASE_INV), 'bag-box',
    'gap stays hidden when no other bag has this cell as a slot');
});

test('[grid-cls] two rectangular bags in same row: both slot areas classify correctly; gap between them is empty', () => {
  const bags = [
    row({ artifactId: 'moss_pouch', row: 0, anchorX: 0, cols: 2, enabledXs: [0, 1] }),
    row({ artifactId: 'moss_pouch', row: 0, anchorX: 4, cols: 2, enabledXs: [4, 5] })
  ];
  assert.equal(classifyCell(bags, 1, 0, { cols: 0, rows: 0 }), 'bag-slot'); // no base-inv for this test
  assert.equal(classifyCell(bags, 2, 0, { cols: 0, rows: 0 }), 'bag-empty', 'gap between bags is empty');
  assert.equal(classifyCell(bags, 3, 0, { cols: 0, rows: 0 }), 'bag-empty');
  assert.equal(classifyCell(bags, 4, 0, { cols: 0, rows: 0 }), 'bag-slot');
});

test('[grid-cls] bagRowEntryFor is null outside every bag (used by the renderer to mean "empty")', () => {
  const bags = [row({ row: 0, anchorX: 3, cols: 2, enabledXs: [3, 4] })];
  assert.equal(bagRowEntryFor(bags, 5, 0), null);
  assert.equal(bagRowEntryFor(bags, 0, 5), null);
});
