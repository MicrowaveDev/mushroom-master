import {
  buildOccupiedCellMap,
  preferredArtifactOrientation,
  sumArtifactBonuses
} from '@microwavedev/backpack-game-core/client-view-model';
import { SHOP_OFFER_SIZE } from '../constants.js';

export function buildOccupancy(items) {
  return buildOccupiedCellMap(items);
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
  return preferredArtifactOrientation(artifact);
}
