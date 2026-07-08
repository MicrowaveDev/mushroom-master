import {
  createMushroomBattleEnginePort,
  randomInt,
  shuffleWithRng
} from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import {
  getArtifactById,
  getMushroomById,
  MAX_STUN_CHANCE,
  STEP_CAP
} from '../game-data.js';
import { createRng } from '../lib/utils.js';
import { buildArtifactSummary } from './loadout-utils.js';

const battleEnginePort = createMushroomBattleEnginePort({
  getArtifactById,
  getMushroomById,
  buildArtifactSummary,
  createRng,
  stepCap: STEP_CAP,
  maxStunChance: MAX_STUN_CHANCE
});

export { randomInt, shuffleWithRng };

export const {
  simulateBattle
} = battleEnginePort;
