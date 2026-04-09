import {
  getArtifactById,
  getArtifactPrice,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_STUN_CHANCE
} from '../game-data.js';
import { clamp } from '../lib/utils.js';

export function buildArtifactSummary(items) {
  const totals = {
    damage: 0,
    armor: 0,
    speed: 0,
    stunChance: 0
  };

  for (const item of items) {
    const artifact = getArtifactById(item.artifactId || item.artifact_id);
    if (!artifact || artifact.family === 'bag') {
      continue;
    }
    totals.damage += artifact.bonus.damage || 0;
    totals.armor += artifact.bonus.armor || 0;
    totals.speed += artifact.bonus.speed || 0;
    totals.stunChance += artifact.bonus.stunChance || 0;
  }

  totals.stunChance = clamp(totals.stunChance, 0, MAX_STUN_CHANCE);
  return totals;
}

export function validateLoadoutItems(items, coinBudget = MAX_ARTIFACT_COINS) {
  if (!Array.isArray(items)) {
    throw new Error('Loadout items must be an array');
  }
  const occupied = new Set();
  const artifactIds = new Set();
  let totalCoins = 0;

  const gridItems = items.filter((item) => !item.bagId);
  const baggedItems = items.filter((item) => item.bagId);

  const bagSlotUsage = new Map();

  for (const item of gridItems) {
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (artifactIds.has(item.artifactId)) {
      throw new Error('Duplicate artifacts are not allowed');
    }
    artifactIds.add(item.artifactId);
    totalCoins += getArtifactPrice(artifact);
    const matchesCanonical = item.width === artifact.width && item.height === artifact.height;
    const matchesRotated = item.width === artifact.height && item.height === artifact.width;
    if (!matchesCanonical && !matchesRotated) {
      throw new Error('Stored artifact dimensions must match canonical definitions');
    }
    if (item.x < 0 || item.y < 0 || item.x + item.width > INVENTORY_COLUMNS || item.y + item.height > INVENTORY_ROWS) {
      throw new Error('Artifact placement is out of bounds');
    }

    for (let dx = 0; dx < item.width; dx += 1) {
      for (let dy = 0; dy < item.height; dy += 1) {
        const key = `${item.x + dx}:${item.y + dy}`;
        if (occupied.has(key)) {
          throw new Error('Artifact placements cannot overlap');
        }
        occupied.add(key);
      }
    }

    if (artifact.family === 'bag') {
      bagSlotUsage.set(item.artifactId, 0);
    }
  }

  for (const item of baggedItems) {
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (artifact.family === 'bag') {
      throw new Error('Bags cannot contain other bags');
    }
    if (artifactIds.has(item.artifactId)) {
      throw new Error('Duplicate artifacts are not allowed');
    }
    artifactIds.add(item.artifactId);
    totalCoins += getArtifactPrice(artifact);

    const bagArtifact = getArtifactById(item.bagId);
    if (!bagArtifact || bagArtifact.family !== 'bag') {
      throw new Error(`Invalid bag reference: ${item.bagId}`);
    }
    if (!bagSlotUsage.has(item.bagId)) {
      throw new Error(`Bag ${item.bagId} is not placed on the grid`);
    }

    if (artifact.width !== 1 || artifact.height !== 1) {
      throw new Error('Only 1x1 artifacts can be placed inside bags');
    }

    const used = bagSlotUsage.get(item.bagId) + 1;
    if (used > bagArtifact.slotCount) {
      throw new Error(`Bag ${item.bagId} is full (${bagArtifact.slotCount} slots)`);
    }
    bagSlotUsage.set(item.bagId, used);
  }

  if (totalCoins > coinBudget) {
    throw new Error(`Loadout exceeds ${coinBudget}-coin budget (cost ${totalCoins})`);
  }

  return {
    items,
    totals: buildArtifactSummary(items),
    totalCoins
  };
}
