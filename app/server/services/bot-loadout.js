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
  mushrooms,
  portraitUrl
} from '../game-data.js';
import { getEffectiveShape } from '../../shared/bag-shape.js';
import { generateBackpackLoadout, randomInt } from '@microwavedev/backpack-game-core';
import { createRng } from '../lib/utils.js';
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

export function createBotLoadout(mushroom, rng, budget = MAX_ARTIFACT_COINS) {
  // Pre-place the character's signature starter preset at their fixed
  // positions. These are free gifts — the budget passed in is the
  // ghost's "shop spend" budget, so we add the preset cost on top of
  // it for the validator ceiling.
  const preset = getStarterPreset(mushroom.id);
  const presetCost = getStarterPresetCost(mushroom.id);
  return generateBackpackLoadout({
    rng,
    budget,
    attempts: 64,
    grid: { columns: BAG_COLUMNS, rows: BAG_ROWS },
    items: artifacts.filter((artifact) => !artifact.starterOnly),
    starterBag: {
      item: getArtifactById('starter_bag'),
      placement: {
        artifactId: 'starter_bag',
        x: 0,
        y: 0,
        width: 3,
        height: 3,
        active: true
      }
    },
    starterPreset: preset,
    presetCost,
    getItemPrice: getArtifactPrice,
    isBag,
    getBagShape: (artifact, rotation) => getEffectiveShape(artifact, rotation),
    weightForItem: (artifact) => artifactWeightForBot(mushroom, artifact),
    validateLoadout: (placements, ceiling) => validateLoadoutItems(placements, ceiling),
    failureMessage: 'Could not generate bot loadout'
  });
}

export function createBotGhostSnapshot(seedInput, mushroomId = null, budget = MAX_ARTIFACT_COINS) {
  const rng = createRng(`${seedInput}:bot`);
  const mushroom = mushroomId ? getMushroomById(mushroomId) : mushrooms[randomInt(rng, mushrooms.length)];
  return {
    playerId: null,
    mushroomId: mushroom.id,
    portraitId: 'default',
    imagePath: portraitUrl(mushroom.id),
    activePortrait: 'default',
    loadout: createBotLoadout(mushroom, rng, budget)
  };
}
