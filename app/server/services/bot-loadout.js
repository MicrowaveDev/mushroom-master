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
import { createGhostLoadoutService } from '@microwavedev/backpack-game-core/server';
import { createRng } from '../lib/utils.js';
import { isBag } from './artifact-helpers.js';
import { validateLoadoutItems } from './loadout-utils.js';

const ghostLoadoutService = createGhostLoadoutService({
  artifacts,
  characters: mushrooms,
  getArtifactById,
  getArtifactPrice,
  getCharacterById: getMushroomById,
  getStarterPreset,
  getStarterPresetCost,
  gridColumns: BAG_COLUMNS,
  gridRows: BAG_ROWS,
  defaultBudget: MAX_ARTIFACT_COINS,
  createRng,
  isBag,
  validateLoadout: validateLoadoutItems,
  imagePathForCharacter: portraitUrl
});

export const createBotLoadout = ghostLoadoutService.createBotLoadout;

export function createBotGhostSnapshot(seedInput, mushroomId = null, budget = MAX_ARTIFACT_COINS) {
  const snapshot = ghostLoadoutService.createBotGhostSnapshot(seedInput, mushroomId, budget);
  return {
    ...snapshot,
    mushroomId: snapshot.characterId
  };
}
