// Pin the contract for non-rectangular (tetromino) bag shapes:
//   - shape mask helpers (default rectangle, rotation, lookup)
//   - validator rejects bagged items in non-shape cells
//   - validator accepts bagged items wholly inside the shape
//   - per-bag occupancy still works inside a shape
//
// Bag artifacts I/T/L/J/S/Z (and the existing 2×2 amber_satchel for O)
// give the player tetris-shaped storage on the inventory grid past the
// base rows. See app/shared/bag-shape.js + game-data.js.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultRectangleShape,
  getBagShape,
  getEffectiveShape,
  getEffectiveDimensions,
  isCellInShape,
  rotateShape,
  shapeArea
} from '../../app/shared/bag-shape.js';
import { validateBagContents } from '../../app/server/services/loadout-utils.js';
import { getArtifactById } from '../../app/server/game-data.js';

// --- shape helper tests ---

test('[bag-shape] defaultRectangleShape fills every cell', () => {
  assert.deepEqual(defaultRectangleShape(2, 3), [
    [1, 1],
    [1, 1],
    [1, 1]
  ]);
});

test('[bag-shape] getBagShape falls back to landscape rectangle for legacy bags', () => {
  // Legacy bags (no `shape` field) keep the auto-landscape convention so
  // moss_pouch (1×2 canonical) still renders as a 2-wide single row.
  const legacy = { width: 1, height: 2 };
  assert.deepEqual(getBagShape(legacy), [[1, 1]]);
});

test('[bag-shape] getBagShape returns the explicit mask for shape-bearing bags', () => {
  const tetT = getArtifactById('trefoil_sack');
  assert.deepEqual(getBagShape(tetT), [
    [1, 1, 1],
    [0, 1, 0]
  ]);
});

test('[bag-shape] rotateShape rotates 90° clockwise, swapping cols and rows', () => {
  // T (3×2 horizontal) → T (2×3 pointing left)
  const t = [
    [1, 1, 1],
    [0, 1, 0]
  ];
  assert.deepEqual(rotateShape(t), [
    [0, 1],
    [1, 1],
    [0, 1]
  ]);
});

test('[bag-shape] getEffectiveShape applies the rotated flag', () => {
  const tetT = getArtifactById('trefoil_sack');
  const unrotated = getEffectiveShape(tetT, false);
  const rotated = getEffectiveShape(tetT, true);
  assert.equal(unrotated.length, 2, 'T canonical = 2 rows × 3 cols');
  assert.equal(rotated.length, 3, 'T rotated CW = 3 rows × 2 cols');
});

test('[bag-shape] getEffectiveDimensions reports cols and rows for both orientations', () => {
  const tetL = getArtifactById('birchbark_hook');
  assert.deepEqual(getEffectiveDimensions(tetL, false), { cols: 3, rows: 2 });
  assert.deepEqual(getEffectiveDimensions(tetL, true), { cols: 2, rows: 3 });
});

test('[bag-shape] isCellInShape true for filled cells, false for empty / OOB', () => {
  const t = [
    [1, 1, 1],
    [0, 1, 0]
  ];
  assert.equal(isCellInShape(t, 0, 0), true);
  assert.equal(isCellInShape(t, 0, 1), false, 'empty cell');
  assert.equal(isCellInShape(t, 1, 1), true);
  assert.equal(isCellInShape(t, 3, 0), false, 'past width');
  assert.equal(isCellInShape(t, 0, 2), false, 'past height');
  assert.equal(isCellInShape(t, -1, 0), false, 'negative');
});

test('[bag-shape] every tetromino bag has slotCount = shapeArea', () => {
  for (const id of ['trefoil_sack', 'birchbark_hook', 'hollow_log', 'twisted_stalk', 'spiral_cap', 'mycelium_vine']) {
    const bag = getArtifactById(id);
    assert.ok(bag, `${id} must exist`);
    const area = shapeArea(getBagShape(bag));
    assert.equal(area, bag.slotCount, `${id}: shape area (${area}) must equal slotCount (${bag.slotCount})`);
    assert.equal(area, 4, `${id}: tetrominoes always have 4 cells`);
  }
});

// --- validator tests ---

test('[bag-shape] validateBagContents accepts items placed on shape cells of a T-bag', () => {
  // T-bag canonical:
  //   ###
  //   .#.
  // Cells (0,0), (1,0), (2,0), (1,1) are filled.
  validateBagContents([
    { id: 'tbag', artifactId: 'trefoil_sack', x: -1, y: -1, width: 3, height: 2 },
    { id: 'a', artifactId: 'spore_needle', bagId: 'tbag', x: 0, y: 0, width: 1, height: 1 },
    { id: 'b', artifactId: 'bark_plate', bagId: 'tbag', x: 1, y: 1, width: 1, height: 1 }
  ]);
});

test('[bag-shape] validateBagContents rejects an item on a non-shape cell of a T-bag', () => {
  // Slot (0, 1) is the bottom-left empty cell of the T — not a slot.
  assert.throws(
    () => validateBagContents([
      { id: 'tbag', artifactId: 'trefoil_sack', x: -1, y: -1, width: 3, height: 2 },
      { id: 'oops', artifactId: 'spore_needle', bagId: 'tbag', x: 0, y: 1, width: 1, height: 1 }
    ]),
    /occupies a non-slot cell/
  );
});

test('[bag-shape] validateBagContents rejects a 1×2 item that straddles a shape edge', () => {
  // L-bag canonical:
  //   ###
  //   #..
  // A 1×2 item at (1, 0) would cover (1, 0) — slot — and (1, 1) — not a slot.
  assert.throws(
    () => validateBagContents([
      { id: 'lbag', artifactId: 'birchbark_hook', x: -1, y: -1, width: 3, height: 2 },
      { id: 'straddle', artifactId: 'amber_fang', bagId: 'lbag', x: 1, y: 0, width: 1, height: 2 }
    ]),
    /occupies a non-slot cell/
  );
});

test('[bag-shape] validateBagContents accepts a 1×2 item that lies fully inside an I-bag', () => {
  // I-bag (vertical 1×4): every cell is a slot.
  validateBagContents([
    { id: 'ibag', artifactId: 'mycelium_vine', x: -1, y: -1, width: 1, height: 4 },
    { id: 'long', artifactId: 'amber_fang', bagId: 'ibag', x: 0, y: 0, width: 1, height: 2 },
    { id: 'short', artifactId: 'spore_needle', bagId: 'ibag', x: 0, y: 2, width: 1, height: 1 }
  ]);
});

test('[bag-shape] validateBagContents respects the shape after a bag is rotated', () => {
  // T-bag rotated CW becomes:
  //   .#
  //   ##
  //   .#
  // Slot (0, 1) IS a slot in the rotated form even though it isn't in the
  // un-rotated form. Pin both to make sure the validator picks the right
  // mask based on the bag row's rotated flag.
  validateBagContents([
    { id: 'tbag', artifactId: 'trefoil_sack', x: -1, y: -1, width: 3, height: 2, rotated: 1 },
    { id: 'a', artifactId: 'spore_needle', bagId: 'tbag', x: 0, y: 1, width: 1, height: 1 }
  ]);
  assert.throws(
    () => validateBagContents([
      { id: 'tbag', artifactId: 'trefoil_sack', x: -1, y: -1, width: 3, height: 2, rotated: 1 },
      // (0, 0) is now a non-slot cell in the rotated mask.
      { id: 'oops', artifactId: 'spore_needle', bagId: 'tbag', x: 0, y: 0, width: 1, height: 1 }
    ]),
    /occupies a non-slot cell/
  );
});
