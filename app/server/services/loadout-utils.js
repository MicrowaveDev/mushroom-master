import {
  getArtifactById,
  getArtifactPrice,
  BAG_COLUMNS,
  BAG_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_STUN_CHANCE
} from '../game-data.js';
import { createLoadoutValidator } from '@microwavedev/backpack-game-core';
import {
  contributesStats,
  isBag,
  isContainerItem
} from './artifact-helpers.js';

export { pieceCells } from '@microwavedev/backpack-game-core';

const mushroomLoadoutValidator = createLoadoutValidator({
  gridWidth: BAG_COLUMNS,
  gridHeight: BAG_ROWS,
  defaultCoinBudget: MAX_ARTIFACT_COINS,
  getArtifact: (artifactId) => getArtifactById(artifactId),
  getArtifactPrice,
  isBag,
  isContainerItem,
  contributesStats,
  statClamps: {
    stunChance: { min: 0, max: MAX_STUN_CHANCE }
  }
});

export const {
  buildArtifactSummary,
  effectiveGridHeight,
  validateGridItems,
  validateBagPlacement,
  bagCellSets,
  bagsContainingItem,
  validateItemCoverage,
  validateCoinBudget,
  validateLoadoutItems
} = mushroomLoadoutValidator;
