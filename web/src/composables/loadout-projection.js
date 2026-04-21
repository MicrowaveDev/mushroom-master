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

import { INVENTORY_COLUMNS, INVENTORY_ROWS } from '../constants.js';

function bagLayoutFor(artifact, rotated) {
  if (!artifact) return { cols: 0, rows: 0 };
  const cols = Math.min(
    INVENTORY_COLUMNS,
    rotated ? Math.min(artifact.width, artifact.height) : Math.max(artifact.width, artifact.height)
  );
  const rows = rotated
    ? Math.max(artifact.width, artifact.height)
    : Math.min(artifact.width, artifact.height);
  return { cols, rows };
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

  // Pass 1 — register bags. Active bags are also laid out so bagged items
  // in pass 2 can be resolved to virtual render coords. Iteration order
  // mirrors the server's sort order (the input array is already ordered).
  const bagByRowId = new Map();
  let nextStartRow = INVENTORY_ROWS;
  for (const item of loadoutItems) {
    if (!bagsSet.has(item.artifactId)) continue;
    if (item.bagId) continue; // defensive — bag rows shouldn't also be bagged
    if (item.active) {
      activeBags.push({ id: item.id, artifactId: item.artifactId });
      const artifact = lookupArtifact(item.artifactId);
      const { cols, rows } = bagLayoutFor(artifact, !!item.rotated);
      bagByRowId.set(item.id, {
        artifactId: item.artifactId,
        startRow: nextStartRow,
        cols,
        rows
      });
      nextStartRow += rows;
    } else {
      containerItems.push({ id: item.id, artifactId: item.artifactId });
    }
    if (item.rotated) {
      rotatedBags.push({ id: item.id, artifactId: item.artifactId });
    }
    if (item.freshPurchase) freshPurchases.push(item.artifactId);
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
        // deactivate can identify "items in THIS bag" precisely.
        builderItems.push({
          id: item.id,
          artifactId: item.artifactId,
          x: sx,
          y: bag.startRow + sy,
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
