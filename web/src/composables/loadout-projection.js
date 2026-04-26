// Pure projection from server loadout rows into client state buckets.
//
// Flat-grid contract:
//   - bag rows with active=1 are placed bags; x/y are their anchors
//   - inactive bags and container artifacts use (-1, -1)
//   - placed artifacts use absolute grid coords
//   - bag membership is derived from cell overlap, never stored

import { BAG_COLUMNS, BAG_ROWS } from '../constants.js';
import { getEffectiveShape } from '../../../app/shared/bag-shape.js';

export function projectLoadoutItems(loadoutItems, bagArtifactIds, getArtifact) {
  const bagsSet = bagArtifactIds instanceof Set
    ? bagArtifactIds
    : new Set(bagArtifactIds);
  const lookupArtifact = typeof getArtifact === 'function'
    ? getArtifact
    : (getArtifact instanceof Map ? (id) => getArtifact.get(id) : () => null);

  const builderItems = [];
  const containerItems = [];
  const activeBags = [];
  const rotatedBags = [];
  const freshPurchases = [];

  for (const item of loadoutItems) {
    const isBagRow = bagsSet.has(item.artifactId);
    if (isBagRow) {
      if (item.active) {
        activeBags.push({
          id: item.id,
          artifactId: item.artifactId,
          anchorX: Number(item.x ?? 0),
          anchorY: Number(item.y ?? 0)
        });
      } else {
        containerItems.push({ id: item.id, artifactId: item.artifactId });
      }
      if (item.rotated) rotatedBags.push({ id: item.id, artifactId: item.artifactId });
      if (item.freshPurchase) freshPurchases.push(item.artifactId);
      continue;
    }

    if (Number(item.x) >= 0 && Number(item.y) >= 0) {
      builderItems.push({
        id: item.id,
        artifactId: item.artifactId,
        x: Number(item.x),
        y: Number(item.y),
        width: Number(item.width),
        height: Number(item.height)
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
 * Build ArtifactGridBoard props for replay/fighter-card/review surfaces using
 * the same flat-grid projection as prep.
 */
export function prepareGridProps(loadoutItems, bagArtifactIds, getArtifact) {
  const projected = projectLoadoutItems(loadoutItems, bagArtifactIds, getArtifact);
  const lookupArtifact = typeof getArtifact === 'function'
    ? getArtifact
    : (getArtifact instanceof Map ? (id) => getArtifact.get(id) : () => null);
  const rotatedSet = new Set(projected.rotatedBags.map((b) => b.id));

  const rows = [];
  let maxBottom = BAG_ROWS;
  for (const activeBag of projected.activeBags) {
    const bag = lookupArtifact(activeBag.artifactId);
    if (!bag) continue;
    const rotated = rotatedSet.has(activeBag.id);
    const shape = getEffectiveShape(bag, rotated);
    const anchorX = activeBag.anchorX ?? 0;
    const anchorY = activeBag.anchorY ?? 0;
    const bottom = anchorY + shape.length;
    if (bottom > maxBottom) maxBottom = bottom;
    for (let i = 0; i < shape.length; i += 1) {
      const maskRow = shape[i] || [];
      const enabledCells = [];
      for (let x = 0; x < maskRow.length; x += 1) {
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
