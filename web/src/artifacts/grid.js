import { sumArtifactBonuses } from '@microwavedev/backpack-game-core/client-view-model';
import { SHOP_OFFER_SIZE } from '../constants.js';

export function buildOccupancy(items) {
  const occupied = new Map();
  for (const item of items) {
    for (let dx = 0; dx < item.width; dx += 1) {
      for (let dy = 0; dy < item.height; dy += 1) {
        occupied.set(`${item.x + dx}:${item.y + dy}`, item.artifactId);
      }
    }
  }
  return occupied;
}

export function deriveTotals(items, artifacts) {
  return sumArtifactBonuses(items, artifacts, {
    statKeys: ['damage', 'armor', 'speed', 'stunChance']
  });
}

export function getArtifactPrice(artifact) {
  if (!artifact) return 0;
  return Number.isFinite(artifact.price) ? artifact.price : 1;
}

export function pickRandomShopOffer(artifactsList, excludeIds = new Set()) {
  const pool = artifactsList.filter((a) => !excludeIds.has(a.id));
  const picks = [];
  while (picks.length < SHOP_OFFER_SIZE && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(index, 1)[0].id);
  }
  return picks;
}

export function shopStorageKey(playerId) {
  return `mushroom-shop-offer:${playerId || 'anon'}`;
}

export function preferredOrientation(artifact) {
  // Shape-bearing bags (tetrominoes) are stored in their canonical
  // orientation — the shape mask defines the silhouette, and the
  // bounding box dimensions follow from it. Returning the shape's
  // dimensions keeps the shop / container preview slots sized
  // correctly so the rendered figure can't overflow into adjacent
  // controls (e.g. the I-bag at 1×4 would otherwise be sized as 4×1).
  if (artifact?.shape) {
    const shape = artifact.shape;
    const cols = shape[0]?.length || artifact.width;
    const rows = shape.length || artifact.height;
    return { width: cols, height: rows };
  }
  // Place 2-cell artifacts (1x2 / 2x1) horizontally by default.
  if (artifact.width !== artifact.height) {
    const longSide = Math.max(artifact.width, artifact.height);
    const shortSide = Math.min(artifact.width, artifact.height);
    return { width: longSide, height: shortSide };
  }
  return { width: artifact.width, height: artifact.height };
}
