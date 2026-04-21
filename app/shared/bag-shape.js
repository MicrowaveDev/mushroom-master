// Bag shape mask helpers — shared between the server (validateBagContents)
// and the client (useShop placement, PrepScreen renderer, projection).
//
// A bag's `shape` is a 2D array of 0/1 ints, indexed `shape[y][x]`, defining
// which cells inside the bag's `width × height` bounding box are real slots.
// A 1 means the cell is part of the bag and can hold an item; a 0 means the
// cell is "outside" the bag (rendered as base-grid, never holds an item).
//
// Bags without a `shape` field are treated as full rectangles (all 1s) so
// pre-existing rectangular bags need no change. The 7 tetromino-shaped bags
// (I, O, T, L, J, S, Z) supply their own shape; O happens to be a 2×2
// rectangle and so coincides with the legacy moss_pouch / amber_satchel
// shape contract.
//
// Slot count consistency: `slotCount` MUST equal the number of 1-cells in
// the shape. The validator uses the mask for bounds + per-cell occupancy
// and falls back to slotCount as a defence-in-depth ceiling.

export function defaultRectangleShape(width, height) {
  const shape = [];
  for (let y = 0; y < height; y += 1) {
    shape.push(new Array(width).fill(1));
  }
  return shape;
}

/**
 * Return the bag artifact's shape mask in its canonical (un-rotated)
 * orientation.
 *
 * For bags without an explicit `shape`, the canonical orientation is
 * landscape — `cols = max(width, height)`, `rows = min(width, height)`.
 * That matches the legacy `useShop.bagLayout` auto-landscape rule that
 * predates this module so existing rectangular bags (moss_pouch 1×2,
 * amber_satchel 2×2) keep their displayed footprint without a data
 * change. Bags with an explicit `shape` are taken at face value:
 * `shape[y][x]` defines the canonical layout directly.
 */
export function getBagShape(bagArtifact) {
  if (!bagArtifact) return [];
  if (bagArtifact.shape) return bagArtifact.shape;
  const cols = Math.max(bagArtifact.width, bagArtifact.height);
  const rows = Math.min(bagArtifact.width, bagArtifact.height);
  return defaultRectangleShape(cols, rows);
}

/**
 * Rotate a shape mask 90° clockwise. Width and height swap.
 *   shape[y][x]  →  rotated[x][newRows - 1 - y]
 *   newCols = oldRows, newRows = oldCols
 */
export function rotateShape(shape) {
  const rows = shape.length;
  const cols = rows > 0 ? shape[0].length : 0;
  const rotated = [];
  for (let y = 0; y < cols; y += 1) {
    const row = new Array(rows).fill(0);
    for (let x = 0; x < rows; x += 1) {
      row[x] = shape[rows - 1 - x][y];
    }
    rotated.push(row);
  }
  return rotated;
}

/**
 * Return the bag's effective shape, accounting for its rotated flag.
 */
export function getEffectiveShape(bagArtifact, rotated) {
  const shape = getBagShape(bagArtifact);
  return rotated ? rotateShape(shape) : shape;
}

/**
 * Effective `(cols, rows)` of a bag's bounding box in its current orientation.
 */
export function getEffectiveDimensions(bagArtifact, rotated) {
  const shape = getEffectiveShape(bagArtifact, rotated);
  return {
    cols: shape.length > 0 ? shape[0].length : 0,
    rows: shape.length
  };
}

/**
 * True iff cell (x, y) — in the bag's local coords — is inside the shape.
 */
export function isCellInShape(shape, x, y) {
  if (y < 0 || y >= shape.length) return false;
  const row = shape[y];
  if (x < 0 || x >= row.length) return false;
  return !!row[x];
}

/**
 * Total filled cells in a shape (== slotCount for a well-formed bag).
 */
export function shapeArea(shape) {
  let area = 0;
  for (const row of shape) {
    for (const cell of row) {
      if (cell) area += 1;
    }
  }
  return area;
}
