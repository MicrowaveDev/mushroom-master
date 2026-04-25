import {
  getArtifactById,
  getArtifactPrice,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_STUN_CHANCE
} from '../game-data.js';
import { clamp } from '../lib/utils.js';
import { getEffectiveShape, isCellInShape } from '../../shared/bag-shape.js';
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
 *
 * Bags must carry container coords (-1,-1): they render in the active-bags
 * bar, not on the main grid. A bag with x>=0 or y>=0 is an invariant
 * violation — throw loudly so bad writes fail fast instead of silently
 * colliding with real grid items (see the bag-coords regression).
 */
export function validateGridItems(gridItems, gridWidth = INVENTORY_COLUMNS, gridHeight = INVENTORY_ROWS) {
  const occupied = new Set();

  for (const item of gridItems) {
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (isBag(artifact)) {
      if (Number(item.x) >= 0 || Number(item.y) >= 0) {
        throw new Error(`Bag ${item.artifactId} cannot have grid coordinates`);
      }
      continue;
    }
    if (isContainerItem(item)) continue;

    const matchesCanonical = item.width === artifact.width && item.height === artifact.height;
    const matchesRotated = item.width === artifact.height && item.height === artifact.width;
    if (!matchesCanonical && !matchesRotated) {
      throw new Error('Stored artifact dimensions must match canonical definitions');
    }

    if (item.x + item.width > gridWidth || item.y + item.height > gridHeight) {
      throw new Error(
        `Artifact placement is out of bounds: ${item.artifactId} `
        + `at (${item.x},${item.y}) ${item.width}x${item.height} `
        + `exceeds grid ${gridWidth}x${gridHeight}`
      );
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
 * Validate bag contents:
 *   1. Every bagged item's `bagId` resolves to a bag row in the same
 *      items array by the bag's loadout row id.
 *   2. The bagged item's slot coords `(x, y)` fit inside the bag's effective
 *      footprint (rotation-aware cols/rows).
 *   3. Bagged items within the same bag don't overlap.
 *   4. The total footprint area doesn't exceed the bag's `slotCount`
 *      (redundant with bounds+overlap for rectangular bags; kept as a
 *      defence-in-depth invariant for future non-rectangular layouts).
 *
 * `bagId` MUST be a loadout-row id. Bag rows in the items array MUST
 * carry their `id`. See docs/bag-item-placement-persistence.md.
 */
export function validateBagContents(items) {
  // First pass: catalog bag rows by their loadout row id, capturing the
  // effective shape mask (rotation-aware) so pass 2 can enforce per-cell
  // bounds for tetromino-shaped bags as well as rectangles.
  const bagsByRowId = new Map();
  for (const item of items) {
    if (item.bagId) continue;
    const artifact = getArtifactById(item.artifactId);
    if (!isBag(artifact)) continue;
    if (!item.id) {
      throw new Error(`Bag row for ${item.artifactId} must carry a loadout row id`);
    }
    const rotated = !!item.rotated;
    const shape = getEffectiveShape(artifact, rotated);
    const cols = shape.length > 0 ? shape[0].length : 0;
    const rows = shape.length;
    bagsByRowId.set(item.id, {
      artifactId: item.artifactId,
      slotCount: artifact.slotCount,
      cols: Math.min(cols, INVENTORY_COLUMNS),
      rows,
      shape,
      slotUsage: 0,
      occupied: new Set()
    });
  }

  // Second pass: enforce bagged-item contracts.
  for (const item of items) {
    if (!item.bagId) continue;
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (isBag(artifact)) {
      throw new Error('Bags cannot contain other bags');
    }
    const bag = bagsByRowId.get(item.bagId);
    if (!bag) {
      throw new Error(`Bag ${item.bagId} is not placed on the grid`);
    }

    const w = Number(item.width);
    const h = Number(item.height);
    const x = Number(item.x ?? 0);
    const y = Number(item.y ?? 0);
    if (x < 0 || y < 0 || x + w > bag.cols || y + h > bag.rows) {
      throw new Error(`Bagged item ${item.artifactId} is out of bounds for bag ${bag.artifactId}`);
    }
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) {
        const cellX = x + dx;
        const cellY = y + dy;
        if (!isCellInShape(bag.shape, cellX, cellY)) {
          throw new Error(`Bagged item ${item.artifactId} occupies a non-slot cell of bag ${bag.artifactId}`);
        }
        const key = `${cellX}:${cellY}`;
        if (bag.occupied.has(key)) {
          throw new Error(`Bagged items cannot overlap inside bag ${bag.artifactId}`);
        }
        bag.occupied.add(key);
      }
    }

    bag.slotUsage += w * h;
    if (bag.slotUsage > bag.slotCount) {
      throw new Error(`Bag ${bag.artifactId} is full (${bag.slotCount} slots)`);
    }
  }
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
