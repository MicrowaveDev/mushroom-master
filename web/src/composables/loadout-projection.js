// Compatibility wrapper over the shared core projection. Mushroom keeps grid
// dimensions local while the pure row projection lives in backpack-game-core.

import {
  prepareGridProps as prepareCoreGridProps,
  projectLoadoutItems as projectCoreLoadoutItems
} from '@microwavedev/backpack-game-core/client-view-model';
import { BAG_COLUMNS, BAG_ROWS } from '../constants.js';

export function projectLoadoutItems(loadoutItems, bagArtifactIds, getArtifact) {
  return projectCoreLoadoutItems(loadoutItems, bagArtifactIds, getArtifact);
}

export function prepareGridProps(loadoutItems, bagArtifactIds, getArtifact, options = {}) {
  return prepareCoreGridProps(loadoutItems, bagArtifactIds, getArtifact, {
    columns: BAG_COLUMNS,
    minRows: BAG_ROWS,
    ...options
  });
}
