import { createArtifactFusionPort } from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { findArtifactFusionMatches } from '../../shared/artifact-fusions.js';
import { query } from '../db.js';
import { getArtifactById } from '../game-data.js';
import { createId, nowIso } from '../lib/utils.js';
import {
  deleteLoadoutItem,
  insertLoadoutItem,
  nextSortOrder,
  readCurrentRoundItems
} from './game-run-loadout.js';

const port = createArtifactFusionPort({
  query,
  getArtifactById,
  createId,
  nowIso,
  findArtifactFusionMatches,
  readCurrentRoundItems,
  nextSortOrder,
  deleteLoadoutItem,
  insertLoadoutItem
});

export const {
  applyRoundStartFusions,
  readFusionReveals
} = port;
