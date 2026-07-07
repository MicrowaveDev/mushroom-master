import { createGameRunLoadoutPort } from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { query } from '../db.js';
import { BAG_COLUMNS, getArtifactById } from '../game-data.js';
import { createId, nowIso } from '../lib/utils.js';
import { getEffectiveShape, normalizeRotation } from '../../shared/bag-shape.js';
import {
  effectiveGridHeight,
  pieceCells,
  validateBagPlacement,
  validateGridItems,
  validateItemCoverage
} from './loadout-utils.js';
import { isBag } from './artifact-helpers.js';

const port = createGameRunLoadoutPort({
  query,
  bagColumns: BAG_COLUMNS,
  getArtifactById,
  createId,
  nowIso,
  getEffectiveShape,
  normalizeRotation,
  effectiveGridHeight,
  pieceCells,
  validateBagPlacement,
  validateGridItems,
  validateItemCoverage,
  isBag
});

export const {
  applyRunPlacements,
  copyRoundForward,
  deleteLoadoutItem,
  deleteLoadoutItemByIdScoped,
  deleteOneByArtifactId,
  insertLoadoutItem,
  insertRefund,
  nextSortOrder,
  readCurrentRoundItems
} = port;
