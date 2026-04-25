// Pure projection from the server's loadoutItems array into the client
// state buckets (builderItems, containerItems, activeBags, rotatedBags,
// freshPurchases). Extracted from useAuth.js so the routing logic can be
// unit-tested without pulling in the whole auth flow.
//
// Shape of input: Array<LoadoutItem> where each LoadoutItem has
//   { id, artifactId, x, y, width, height, bagId,
//     active, rotated, freshPurchase }
// Shape of output:
//   { builderItems, containerItems, activeBags, rotatedBags, freshPurchases }
//
// Coord conventions (see docs/bag-item-placement-persistence.md):
//   - Non-bag grid item    : x,y are base-grid coords (0 ≤ y < INVENTORY_ROWS)
//   - Container / bag row  : x=-1, y=-1
//   - Bagged item          : x,y are slot coords within the bag pointed at by
//                            bagId. bagId is the bag's loadout row id in the
//                            same round. The projection reconstructs a virtual
//                            render y (startRow + slotY) so ArtifactGridBoard
//                            can place the piece without knowing about bags.
//
// Routing:
//   - bag rows with active=1  → activeBags  (and used to build bag layout)
//   - bag rows with active=0  → containerItems
//   - bag rows with rotated=1 → rotatedBags (regardless of active)
//   - bagged items with bagId pointing at an active bag + valid slot coords
//                            → builderItems at virtual (x, startRow + y)
//   - bagged items with bagId pointing at an inactive bag, or with slot
//     coords outside the bag's footprint
//                            → containerItems (defensive fallback for
//                              transient inconsistencies the user can
//                              recover from by re-placing)
//   - grid-placed non-bag items (x>=0,y>=0)
//                            → builderItems with direct x,y
//   - container non-bag items (-1,-1)
//                            → containerItems

import { BAG_COLUMNS, BAG_ROWS, INVENTORY_COLUMNS, INVENTORY_ROWS } from '../constants.js';
import { getEffectiveShape } from '../../../app/shared/bag-shape.js';

function bagLayoutFor(artifact, rotated) {
  if (!artifact) return { cols: 0, rows: 0 };
  const cols = Math.min(
    BAG_COLUMNS,
    rotated ? Math.min(artifact.width, artifact.height) : Math.max(artifact.width, artifact.height)
  );
  const rows = rotated
    ? Math.max(artifact.width, artifact.height)
    : Math.min(artifact.width, artifact.height);
  return { cols, rows };
}

// 2D first-fit anchor assignment matching the client's useShop packer. The
// projection re-derives anchors on every hydrate because v1 doesn't persist
// anchor coords — bags that were dragged to a custom layout return to the
// auto-pack arrangement after a reload. Future revisions can pull persisted
// anchors from the server payload and skip this fallback.
function packAnchors(bags) {
  // bags: Array<{ id, cols, rows }> in declaration order. Returns the same
  // shape with anchorX / anchorY added per bag, scanning top-to-bottom and
  // left-to-right for the first non-overlapping anchor in unified-grid
  // coords (Req 2-F). The base inventory at (0..INVENTORY_COLUMNS-1,
  // 0..INVENTORY_ROWS-1) is treated as a permanent obstacle so bags can
  // anchor alongside it.
  function overlapsBaseInventory(ax, ay, cols, rows) {
    return ax < INVENTORY_COLUMNS && 0 < ax + cols
      && ay < INVENTORY_ROWS && 0 < ay + rows;
  }
  const placed = [];
  for (const bag of bags) {
    let chosen = null;
    const maxY = Math.max(
      INVENTORY_ROWS,
      placed.reduce((m, p) => Math.max(m, p.anchorY + p.rows), 0)
    ) + bag.rows;
    outer: for (let ay = 0; ay <= maxY; ay += 1) {
      for (let ax = 0; ax + bag.cols <= BAG_COLUMNS; ax += 1) {
        if (overlapsBaseInventory(ax, ay, bag.cols, bag.rows)) continue;
        let overlaps = false;
        for (const p of placed) {
          const overlapX = ax < p.anchorX + p.cols && p.anchorX < ax + bag.cols;
          const overlapY = ay < p.anchorY + p.rows && p.anchorY < ay + bag.rows;
          if (overlapX && overlapY) { overlaps = true; break; }
        }
        if (!overlaps) { chosen = { anchorX: ax, anchorY: ay }; break outer; }
      }
    }
    if (!chosen) chosen = { anchorX: 0, anchorY: maxY };
    placed.push({ ...bag, ...chosen });
  }
  return placed;
}

export function projectLoadoutItems(loadoutItems, bagArtifactIds, getArtifact) {
  const bagsSet = bagArtifactIds instanceof Set
    ? bagArtifactIds
    : new Set(bagArtifactIds);

  // getArtifact is required to reconstruct bag layouts. Accept a Map or
  // function; fall back to a no-op so legacy callers that don't care about
  // bagged-item reconstruction can still route bags/grid items correctly.
  const lookupArtifact = typeof getArtifact === 'function'
    ? getArtifact
    : (getArtifact instanceof Map ? (id) => getArtifact.get(id) : () => null);

  const builderItems = [];
  const containerItems = [];
  const activeBags = [];
  const rotatedBags = [];
  const freshPurchases = [];

  // Pass 1 — register bags. Active bags are first collected, then handed to
  // the 2D first-fit packer so bagged items in pass 2 can resolve to virtual
  // render coords using the assigned anchor. Iteration order mirrors the
  // server's sort order (the input array is already ordered).
  const bagByRowId = new Map();
  const activeBagDescriptors = [];
  for (const item of loadoutItems) {
    if (!bagsSet.has(item.artifactId)) continue;
    if (item.bagId) continue; // defensive — bag rows shouldn't also be bagged
    if (item.active) {
      const artifact = lookupArtifact(item.artifactId);
      const { cols, rows } = bagLayoutFor(artifact, !!item.rotated);
      activeBagDescriptors.push({
        id: item.id,
        artifactId: item.artifactId,
        cols,
        rows
      });
    } else {
      containerItems.push({ id: item.id, artifactId: item.artifactId });
    }
    if (item.rotated) {
      rotatedBags.push({ id: item.id, artifactId: item.artifactId });
    }
    if (item.freshPurchase) freshPurchases.push(item.artifactId);
  }

  const packed = packAnchors(activeBagDescriptors);
  for (const bag of packed) {
    activeBags.push({
      id: bag.id,
      artifactId: bag.artifactId,
      anchorX: bag.anchorX,
      anchorY: bag.anchorY
    });
    bagByRowId.set(bag.id, {
      artifactId: bag.artifactId,
      anchorX: bag.anchorX,
      anchorY: bag.anchorY,
      cols: bag.cols,
      rows: bag.rows
    });
  }

  // Pass 2 — everything else. Bagged items resolve through bagByRowId.
  for (const item of loadoutItems) {
    const isBagRow = bagsSet.has(item.artifactId) && !item.bagId;
    if (isBagRow) continue; // already handled

    if (item.bagId) {
      const bag = bagByRowId.get(item.bagId);
      const sx = Number(item.x);
      const sy = Number(item.y);
      const w = Number(item.width);
      const h = Number(item.height);
      // Stale rows land in the container:
      //   - bag not currently active (so it isn't in the layout map)
      //   - slot coords outside the bag's effective footprint
      const inBounds =
        bag &&
        sx >= 0 && sy >= 0 &&
        sx + w <= bag.cols && sy + h <= bag.rows;
      if (inBounds) {
        // bagId on builderItems carries the bag's loadout row id — same id
        // that lives in state.activeBags[i].id. That's unambiguous even when
        // the player owns two bags of the same artifact, so bag rotate /
        // deactivate can identify "items in THIS bag" precisely. Unified
        // virtual coords = bag's unified anchor + slot offset.
        builderItems.push({
          id: item.id,
          artifactId: item.artifactId,
          x: bag.anchorX + sx,
          y: bag.anchorY + sy,
          width: w,
          height: h,
          bagId: item.bagId
        });
      } else {
        containerItems.push({ id: item.id, artifactId: item.artifactId });
      }
      if (item.freshPurchase) freshPurchases.push(item.artifactId);
      continue;
    }

    // Non-bag, non-bagged items — routed by coordinates.
    if (item.x >= 0 && item.y >= 0) {
      builderItems.push({
        id: item.id,
        artifactId: item.artifactId,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        bagId: null
      });
    } else {
      containerItems.push({ id: item.id, artifactId: item.artifactId });
    }
    if (item.freshPurchase) freshPurchases.push(item.artifactId);
  }

  return {
    builderItems,
    containerItems,
    activeBags,
    rotatedBags,
    freshPurchases
  };
}

/**
 * Build the props ArtifactGridBoard needs to render a snapshot loadout
 * (battle replay, fighter card, inventory review, etc.). Runs the SAME
 * projection the prep screen uses so the visual contract stays unified
 * across surfaces — no separate "battle rendering" path that can drift
 * from the prep grid.
 *
 * Input: a flat list of loadoutItems as the server stores them (bag rows
 * at (-1, -1) or anchor coords; bagged items with bagId + slot coords).
 * Output: `{ items, bagRows, totalRows }` ready to spread into the
 * ArtifactGridBoard component.
 */
export function prepareGridProps(loadoutItems, bagArtifactIds, getArtifact) {
  const projected = projectLoadoutItems(loadoutItems, bagArtifactIds, getArtifact);
  const lookupArtifact = typeof getArtifact === 'function'
    ? getArtifact
    : (getArtifact instanceof Map ? (id) => getArtifact.get(id) : () => null);
  const rotatedSet = new Set(projected.rotatedBags.map((b) => b.id));

  // bagRows + totalRows computed exactly like PrepScreen so the battle
  // display lands on the same grid layout as prep — bag colours, slot
  // mask, mask-gap rendering, alongside packing all match.
  const rows = [];
  let maxBottom = BAG_ROWS;
  for (const activeBag of projected.activeBags) {
    const bag = lookupArtifact(activeBag.artifactId);
    if (!bag) continue;
    const rotated = rotatedSet.has(activeBag.id);
    const shape = getEffectiveShape(bag, rotated);
    const rowCount = shape.length;
    const anchorX = activeBag.anchorX ?? 0;
    const anchorY = activeBag.anchorY ?? 0;
    const bottom = anchorY + rowCount;
    if (bottom > maxBottom) maxBottom = bottom;
    for (let i = 0; i < rowCount; i++) {
      const maskRow = shape[i] || [];
      const enabledCells = [];
      for (let x = 0; x < maskRow.length; x++) {
        const cellX = anchorX + x;
        if (cellX >= BAG_COLUMNS) break;
        if (maskRow[x]) enabledCells.push(cellX);
      }
      if (enabledCells.length === 0) continue;
      rows.push({
        row: anchorY + i,
        color: bag.color || '#888',
        artifactId: activeBag.artifactId,
        enabledCells,
        bboxStart: anchorX,
        bboxEnd: Math.min(anchorX + maskRow.length, BAG_COLUMNS)
      });
    }
  }

  return {
    items: projected.builderItems,
    bagRows: rows.sort((a, b) => a.row - b.row),
    totalRows: maxBottom
  };
}
