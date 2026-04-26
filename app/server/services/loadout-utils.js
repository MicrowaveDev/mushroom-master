import {
  getArtifactById,
  getArtifactPrice,
  BAG_COLUMNS,
  BAG_ROWS,
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

export function pieceCells(item, shape = null) {
  const cells = [];
  const x0 = Number(item.x);
  const y0 = Number(item.y);
  const width = Number(item.width);
  const height = Number(item.height);
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < height; dy += 1) {
      if (shape && !isCellInShape(shape, dx, dy)) continue;
      cells.push(`${x0 + dx}:${y0 + dy}`);
    }
  }
  return cells;
}

function cellSet(cells) {
  return new Set(cells);
}

function intersects(a, b) {
  for (const key of a) {
    if (b.has(key)) return true;
  }
  return false;
}

function activeBagRows(items) {
  return items.filter((item) => {
    const artifact = getArtifactById(item.artifactId);
    return isBag(artifact) && item.active && !isContainerItem(item);
  });
}

/**
 * Validate absolute grid placements for placed non-bag artifacts.
 */
export function validateGridItems(gridItems, gridWidth = BAG_COLUMNS, gridHeight = BAG_ROWS) {
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

    if (item.x < 0 || item.y < 0 || item.x + item.width > gridWidth || item.y + item.height > gridHeight) {
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
 * Validate active bags as placed grid pieces. Inactive bags must stay in the
 * container sentinel. Bag membership is derived elsewhere, not stored.
 */
export function validateBagPlacement(items, gridWidth = BAG_COLUMNS) {
  const occupied = new Set();
  for (const item of items) {
    const artifact = getArtifactById(item.artifactId);
    if (!isBag(artifact)) continue;
    if (!item.active) {
      if (!isContainerItem(item)) {
        throw new Error(`Inactive bag ${item.artifactId} must use container coordinates`);
      }
      continue;
    }
    const rotated = !!item.rotated;
    const shape = getEffectiveShape(artifact, rotated);
    const cols = shape.length ? shape[0].length : 0;
    const rows = shape.length;
    const x = Number(item.x);
    const y = Number(item.y);
    if (x < 0 || y < 0 || x + cols > gridWidth) {
      throw new Error(`Bag placement is out of bounds: ${item.artifactId}`);
    }
    for (const key of pieceCells({ ...item, width: cols, height: rows }, shape)) {
      if (occupied.has(key)) {
        throw new Error('Bag placements cannot overlap');
      }
      occupied.add(key);
    }
  }
  return { occupied };
}

export function bagCellSets(items) {
  return activeBagRows(items).map((bag) => {
    const artifact = getArtifactById(bag.artifactId);
    const shape = getEffectiveShape(artifact, !!bag.rotated);
    const width = shape.length ? shape[0].length : 0;
    const height = shape.length;
    return {
      id: bag.id,
      artifactId: bag.artifactId,
      cells: cellSet(pieceCells({ ...bag, width, height }, shape))
    };
  });
}

export function bagsContainingItem(item, items) {
  const itemCells = cellSet(pieceCells(item));
  return bagCellSets(items).filter((bag) => intersects(itemCells, bag.cells));
}

/**
 * Every placed non-bag artifact cell must be covered by at least one active
 * bag cell. This replaces bag-local `bag_id` slot validation.
 */
export function validateItemCoverage(items) {
  const bags = bagCellSets(items);
  const covered = new Set();
  for (const bag of bags) {
    for (const key of bag.cells) covered.add(key);
  }
  for (const item of items) {
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (isBag(artifact) || isContainerItem(item)) continue;
    for (const key of pieceCells(item)) {
      if (!covered.has(key)) {
        throw new Error(`Artifact ${item.artifactId} has an uncovered cell at ${key} (out of bounds of active bags)`);
      }
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

  validateBagPlacement(items);
  validateGridItems(items);
  validateItemCoverage(items);
  const { totalCoins } = validateCoinBudget(items, coinBudget);

  return {
    items,
    totals: buildArtifactSummary(items),
    totalCoins
  };
}
