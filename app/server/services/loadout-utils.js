import {
  getArtifactById,
  getArtifactPrice,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_STUN_CHANCE
} from '../game-data.js';
import { clamp } from '../lib/utils.js';
import {
  contributesStats,
  isBag,
  isContainerItem
} from './artifact-helpers.js';

export function buildArtifactSummary(items) {
  const totals = {
    damage: 0,
    armor: 0,
    speed: 0,
    stunChance: 0
  };

  for (const item of items) {
    const artifact = getArtifactById(item.artifactId || item.artifact_id);
    if (!contributesStats(artifact, item)) continue;
    totals.damage += artifact.bonus.damage || 0;
    totals.armor += artifact.bonus.armor || 0;
    totals.speed += artifact.bonus.speed || 0;
    totals.stunChance += artifact.bonus.stunChance || 0;
  }

  totals.stunChance = clamp(totals.stunChance, 0, MAX_STUN_CHANCE);
  return totals;
}

/**
 * Validate grid placements (bounds + overlap) for non-bag, non-container,
 * non-bagged items. Returns the set of occupied cells for downstream use.
 */
export function validateGridItems(gridItems, gridWidth = INVENTORY_COLUMNS, gridHeight = INVENTORY_ROWS) {
  const occupied = new Set();

  for (const item of gridItems) {
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (isBag(artifact)) continue;
    if (isContainerItem(item)) continue;

    const matchesCanonical = item.width === artifact.width && item.height === artifact.height;
    const matchesRotated = item.width === artifact.height && item.height === artifact.width;
    if (!matchesCanonical && !matchesRotated) {
      throw new Error('Stored artifact dimensions must match canonical definitions');
    }

    if (item.x + item.width > gridWidth || item.y + item.height > gridHeight) {
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
  }

  return { occupied };
}

/**
 * Validate bag contents: each bagged item references an active bag, the
 * reference resolves, and the total footprint (width × height) fits inside
 * the bag's slotCount.
 */
export function validateBagContents(items) {
  // First pass: register bags as slot providers.
  const bagSlotUsage = new Map();
  for (const item of items) {
    if (item.bagId) continue;
    const artifact = getArtifactById(item.artifactId);
    if (isBag(artifact)) {
      bagSlotUsage.set(item.artifactId, 0);
    }
  }

  // Second pass: account for bagged items.
  for (const item of items) {
    if (!item.bagId) continue;
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (isBag(artifact)) {
      throw new Error('Bags cannot contain other bags');
    }
    const bagArtifact = getArtifactById(item.bagId);
    if (!bagArtifact || !isBag(bagArtifact)) {
      throw new Error(`Invalid bag reference: ${item.bagId}`);
    }
    if (!bagSlotUsage.has(item.bagId)) {
      throw new Error(`Bag ${item.bagId} is not placed on the grid`);
    }

    const cellsUsed = item.width * item.height;
    const used = bagSlotUsage.get(item.bagId) + cellsUsed;
    if (used > bagArtifact.slotCount) {
      throw new Error(`Bag ${item.bagId} is full (${bagArtifact.slotCount} slots)`);
    }
    bagSlotUsage.set(item.bagId, used);
  }

  return { bagSlotUsage };
}

/**
 * Sum the prices of all items and throw if they exceed the coin budget.
 *
 * The caller is responsible for including the character starter preset
 * cost in `coinBudget` — this function honestly sums every item in the
 * loadout without special-casing any of them. See battle-service.js
 * getActiveSnapshot for the run-budget computation.
 */
export function validateCoinBudget(items, coinBudget) {
  let totalCoins = 0;
  for (const item of items) {
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    totalCoins += getArtifactPrice(artifact);
  }
  if (totalCoins > coinBudget) {
    throw new Error(`Loadout exceeds ${coinBudget}-coin budget (cost ${totalCoins})`);
  }
  return { totalCoins };
}

/**
 * Orchestrator: runs all four validators in sequence.
 * Returns { items, totals, totalCoins } for backward compatibility.
 */
export function validateLoadoutItems(items, coinBudget = MAX_ARTIFACT_COINS) {
  if (!Array.isArray(items)) {
    throw new Error('Loadout items must be an array');
  }

  const gridItems = items.filter((item) => !item.bagId);
  validateGridItems(gridItems);
  validateBagContents(items);
  const { totalCoins } = validateCoinBudget(items, coinBudget);

  return {
    items,
    totals: buildArtifactSummary(items),
    totalCoins
  };
}
