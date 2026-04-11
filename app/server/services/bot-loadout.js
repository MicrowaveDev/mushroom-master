import {
  artifacts,
  getArtifactPrice,
  getMushroomById,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  mushrooms
} from '../game-data.js';
import { createRng } from '../lib/utils.js';
import { randomInt, shuffleWithRng } from './battle-engine.js';
import { validateLoadoutItems } from './loadout-utils.js';

function artifactWeightForBot(mushroom, artifact) {
  if (mushroom.affinity.strong.includes(artifact.family)) {
    return 5;
  }
  if (mushroom.affinity.medium.includes(artifact.family)) {
    return 3;
  }
  if (mushroom.affinity.weak.includes(artifact.family)) {
    return 1;
  }
  return 2;
}

function pickUniqueArtifactsForBot(mushroom, rng, budget = MAX_ARTIFACT_COINS) {
  // Bags are excluded — bots don't use inventory expansion, only combat items.
  const pool = artifacts.filter((a) => a.family !== 'bag');
  const totalCells = INVENTORY_COLUMNS * INVENTORY_ROWS;
  const selected = [];
  let remainingCoins = budget;
  let occupiedCells = 0;
  while (occupiedCells < totalCells && pool.length && remainingCoins > 0) {
    const affordable = pool.filter((artifact) => {
      const area = artifact.width * artifact.height;
      return getArtifactPrice(artifact) <= remainingCoins && occupiedCells + area <= totalCells;
    });
    if (!affordable.length) {
      break;
    }
    const totalWeight = affordable.reduce(
      (sum, artifact) => sum + artifactWeightForBot(mushroom, artifact),
      0
    );
    let cursor = rng() * totalWeight;
    let chosen = affordable[0];
    for (const artifact of affordable) {
      cursor -= artifactWeightForBot(mushroom, artifact);
      if (cursor <= 0) {
        chosen = artifact;
        break;
      }
    }
    remainingCoins -= getArtifactPrice(chosen);
    occupiedCells += chosen.width * chosen.height;
    pool.splice(pool.indexOf(chosen), 1);
    selected.push(chosen);
  }
  return selected;
}

function canPlaceArtifact(candidate, occupied) {
  for (let dx = 0; dx < candidate.width; dx += 1) {
    for (let dy = 0; dy < candidate.height; dy += 1) {
      if (occupied.has(`${candidate.x + dx}:${candidate.y + dy}`)) {
        return false;
      }
    }
  }
  return true;
}

function markOccupied(candidate, occupied) {
  for (let dx = 0; dx < candidate.width; dx += 1) {
    for (let dy = 0; dy < candidate.height; dy += 1) {
      occupied.add(`${candidate.x + dx}:${candidate.y + dy}`);
    }
  }
}

export function createBotLoadout(mushroom, rng, budget = MAX_ARTIFACT_COINS) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const chosenArtifacts = pickUniqueArtifactsForBot(mushroom, rng, budget);
    const placementOrder = shuffleWithRng(
      [...chosenArtifacts].sort((left, right) => right.width * right.height - left.width * left.height),
      rng
    );
    const occupied = new Set();
    const placements = [];

    let success = true;
    for (const artifact of placementOrder) {
      const positions = [];
      for (let y = 0; y <= INVENTORY_ROWS - artifact.height; y += 1) {
        for (let x = 0; x <= INVENTORY_COLUMNS - artifact.width; x += 1) {
          positions.push({ x, y });
        }
      }
      const shuffledPositions = shuffleWithRng(positions, rng);
      const found = shuffledPositions.find((position) =>
        canPlaceArtifact({ ...position, width: artifact.width, height: artifact.height }, occupied)
      );
      if (!found) {
        success = false;
        break;
      }

      const placement = {
        artifactId: artifact.id,
        x: found.x,
        y: found.y,
        width: artifact.width,
        height: artifact.height,
        sortOrder: placements.length
      };
      markOccupied(placement, occupied);
      placements.push(placement);
    }

    if (success && placements.length === chosenArtifacts.length && placements.length > 0) {
      placements.sort((left, right) => left.sortOrder - right.sortOrder);
      validateLoadoutItems(placements, budget);
      return {
        gridWidth: INVENTORY_COLUMNS,
        gridHeight: INVENTORY_ROWS,
        items: placements
      };
    }
  }

  throw new Error('Could not generate bot loadout');
}

export function createBotGhostSnapshot(seedInput, mushroomId = null, budget = MAX_ARTIFACT_COINS) {
  const rng = createRng(`${seedInput}:bot`);
  const mushroom = mushroomId ? getMushroomById(mushroomId) : mushrooms[randomInt(rng, mushrooms.length)];
  return {
    playerId: null,
    mushroomId: mushroom.id,
    loadout: createBotLoadout(mushroom, rng, budget)
  };
}
