import {
  artifacts,
  getArtifactById,
  getArtifactPrice,
  getMushroomById,
  getStarterPreset,
  getStarterPresetCost,
  BAG_COLUMNS,
  BAG_ROWS,
  MAX_ARTIFACT_COINS,
  mushrooms
} from '../game-data.js';
import { getEffectiveShape } from '../../shared/bag-shape.js';
import { createRng } from '../lib/utils.js';
import { randomInt, shuffleWithRng } from './battle-engine.js';
import { isBag } from './artifact-helpers.js';
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

function canPlaceArtifact(candidate, occupied, covered) {
  for (let dx = 0; dx < candidate.width; dx += 1) {
    for (let dy = 0; dy < candidate.height; dy += 1) {
      const key = `${candidate.x + dx}:${candidate.y + dy}`;
      if (occupied.has(key) || (covered && !covered.has(key))) {
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

function shapeCells(x, y, shape) {
  const cells = [];
  for (let dy = 0; dy < shape.length; dy += 1) {
    const row = shape[dy] || [];
    for (let dx = 0; dx < row.length; dx += 1) {
      if (row[dx]) cells.push(`${x + dx}:${y + dy}`);
    }
  }
  return cells;
}

function canPlaceBag(candidate, occupiedBags) {
  return shapeCells(candidate.x, candidate.y, candidate.shape).every((key) => !occupiedBags.has(key));
}

function markBag(candidate, occupiedBags, coveredCells) {
  for (const key of shapeCells(candidate.x, candidate.y, candidate.shape)) {
    occupiedBags.add(key);
    coveredCells.add(key);
  }
}

function bagPlacementCandidates(artifact) {
  const candidates = [];
  for (const rotation of [0, 1, 2, 3]) {
    const shape = getEffectiveShape(artifact, rotation);
    const width = shape.length ? shape[0].length : 0;
    const height = shape.length;
    if (width <= 0 || height <= 0) continue;
    if (width > BAG_COLUMNS || height > BAG_ROWS) continue;
    for (let y = 0; y <= BAG_ROWS - height; y += 1) {
      for (let x = 0; x <= BAG_COLUMNS - width; x += 1) {
        candidates.push({ x, y, width, height, rotated: rotation, shape });
      }
    }
  }
  return candidates.sort((left, right) =>
    left.y - right.y
    || left.x - right.x
    || (left.y + left.height) - (right.y + right.height)
    || left.height - right.height
    || Number(left.rotated) - Number(right.rotated)
  );
}

function artifactPlacementCandidates(artifact) {
  const candidates = [];
  for (let y = 0; y <= BAG_ROWS - artifact.height; y += 1) {
    for (let x = 0; x <= BAG_COLUMNS - artifact.width; x += 1) {
      candidates.push({ x, y, width: artifact.width, height: artifact.height });
    }
  }
  return candidates;
}

function pickWeightedArtifact(mushroom, rng, affordable) {
  const totalWeight = affordable.reduce(
    (sum, artifact) => sum + artifactWeightForBot(mushroom, artifact),
    0
  );
  let cursor = rng() * totalWeight;
  for (const artifact of affordable) {
    cursor -= artifactWeightForBot(mushroom, artifact);
    if (cursor <= 0) return artifact;
  }
  return affordable[0];
}

export function createBotLoadout(mushroom, rng, budget = MAX_ARTIFACT_COINS) {
  // Pre-place the character's signature starter preset at their fixed
  // positions. These are free gifts — the budget passed in is the
  // ghost's "shop spend" budget, so we add the preset cost on top of
  // it for the validator ceiling.
  const preset = getStarterPreset(mushroom.id);
  const presetCost = getStarterPresetCost(mushroom.id);

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const pool = artifacts.filter((a) => !a.starterOnly);
    const occupiedItems = new Set();
    const occupiedBags = new Set();
    const coveredCells = new Set();
    let remainingCoins = budget;
    let boughtCombatCount = 0;
    const placements = [{
      artifactId: 'starter_bag',
      x: 0,
      y: 0,
      width: 3,
      height: 3,
      active: true,
      sortOrder: 0
    }];
    const starterBag = getArtifactById('starter_bag');
    markBag(
      { x: 0, y: 0, shape: getEffectiveShape(starterBag, false) },
      occupiedBags,
      coveredCells
    );

    // Lay down preset items first at their fixed positions.
    for (const item of preset) {
      const placement = {
        artifactId: item.artifactId,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        sortOrder: placements.length
      };
      markOccupied(placement, occupiedItems);
      placements.push(placement);
    }

    while (remainingCoins > 0 && pool.length) {
      const affordable = pool.filter((artifact) => {
        if (getArtifactPrice(artifact) > remainingCoins) return false;
        if (isBag(artifact)) {
          return bagPlacementCandidates(artifact).some((candidate) => canPlaceBag(candidate, occupiedBags));
        }
        return artifactPlacementCandidates(artifact).some((candidate) =>
          canPlaceArtifact(candidate, occupiedItems, coveredCells)
        );
      });
      if (!affordable.length) break;

      const pickable = boughtCombatCount === 0
        ? affordable.filter((artifact) => !isBag(artifact))
        : affordable;
      const artifact = pickWeightedArtifact(mushroom, rng, pickable.length ? pickable : affordable);
      const idx = pool.indexOf(artifact);
      if (idx >= 0) pool.splice(idx, 1);
      remainingCoins -= getArtifactPrice(artifact);

      if (isBag(artifact)) {
        const found = bagPlacementCandidates(artifact)
          .find((candidate) => canPlaceBag(candidate, occupiedBags));
        if (!found) break;

        markBag(found, occupiedBags, coveredCells);
        placements.push({
          artifactId: artifact.id,
          x: found.x,
          y: found.y,
          width: found.width,
          height: found.height,
          rotated: found.rotated,
          active: true,
          sortOrder: placements.length
        });
        continue;
      }

      const found = shuffleWithRng(artifactPlacementCandidates(artifact), rng)
        .find((candidate) => canPlaceArtifact(candidate, occupiedItems, coveredCells));
      if (!found) break;

      const placement = {
        artifactId: artifact.id,
        x: found.x,
        y: found.y,
        width: artifact.width,
        height: artifact.height,
        sortOrder: placements.length
      };
      markOccupied(placement, occupiedItems);
      placements.push(placement);
      boughtCombatCount += 1;
    }

    if (boughtCombatCount > 0) {
      placements.sort((left, right) => left.sortOrder - right.sortOrder);
      validateLoadoutItems(placements, budget + presetCost);
      return {
        gridWidth: BAG_COLUMNS,
        gridHeight: BAG_ROWS,
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
