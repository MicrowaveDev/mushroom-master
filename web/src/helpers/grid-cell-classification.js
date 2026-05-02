// Pure classification helpers for the unified prep grid. Extracted from
// `ArtifactGridBoard` so the lookup rules can be unit-tested without
// mounting a Vue component. The renderer still carries the same logic
// inline (with `this.bagRows` closure) — this file is the reference
// implementation that the tests pin.
//
// `bagRows` shape (as produced by `PrepScreen.bagRows`):
//   Array<{
//     bagId: string,
//     row: number,             // global unified-grid y
//     color: string,           // CSS colour for the bag
//     artifactId: string,
//     enabledCells: number[],  // x coords where THIS bag has a slot on this row
//     bboxStart: number,       // global x of the bag's bounding-box left edge
//     bboxEnd: number          // global x of the bag's bounding-box right edge (exclusive)
//   }>

/**
 * Find the bag entry that owns `(cx, cy)`. Slot match wins over bbox match
 * so a tetromino mask gap that lands on another bag's slot (overlapping
 * bboxes) resolves correctly — the cell renders as the slot-owning bag's
 * slot, not as a hidden gap.
 *
 * Returns `null` when the cell is outside every bag's bounding box (the
 * caller treats this as "empty bag-area cell", a visible drop target).
 */
export function bagRowEntryFor(bagRows, cx, cy) {
  const slotMatch = bagRows.find(
    (br) => br.row === cy && br.enabledCells?.includes(cx)
  );
  if (slotMatch) return slotMatch;
  const bboxMatch = bagRows.find((br) => {
    if (br.row !== cy) return false;
    const start = br.bboxStart ?? br.enabledCells?.[0] ?? -1;
    const end = br.bboxEnd ?? ((br.enabledCells?.[br.enabledCells.length - 1] ?? -1) + 1);
    return cx >= start && cx < end;
  });
  return bboxMatch || null;
}

/**
 * Classify `(cx, cy)` into one of the four unified-grid cell roles.
 *
 *   'base-inv'    — inside the legacy 3x3 base inventory rectangle
 *   'bag-slot'    — inside some bag's slot mask (enabledCells)
 *   'bag-box'     — inside some bag's bbox but not a slot (tetromino gap)
 *   'bag-empty'   — outside every bag (visible drop target for chip drag)
 *
 * `baseInv` is the current rectangle in unified coords; callers pass
 * `{ cols: INVENTORY_COLUMNS, rows: INVENTORY_ROWS }` today. Phase 3 of
 * bag-grid-unification replaces it with a starter_bag artifact at which
 * point the `base-inv` classification goes away.
 */
export function classifyCell(bagRows, cx, cy, baseInv) {
  if (
    baseInv
    && cx >= 0 && cx < baseInv.cols
    && cy >= 0 && cy < baseInv.rows
  ) {
    return 'base-inv';
  }
  const entry = bagRowEntryFor(bagRows, cx, cy);
  if (!entry) return 'bag-empty';
  if (entry.enabledCells?.includes(cx)) return 'bag-slot';
  return 'bag-box';
}

/**
 * Return every unified-grid cell covered by the rendered artifacts. The
 * board uses this to avoid painting coloured bag slots through transparent
 * corners/gaps of a placed artifact.
 */
export function occupiedCellKeys(items = []) {
  const occupied = new Set();
  for (const item of items) {
    const width = Number(item.width) || 1;
    const height = Number(item.height) || 1;
    const x = Number(item.x);
    const y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    for (let dx = 0; dx < width; dx += 1) {
      for (let dy = 0; dy < height; dy += 1) {
        occupied.add(`${x + dx}:${y + dy}`);
      }
    }
  }
  return occupied;
}
