import { createSeasonProgressPort } from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { getAwardableRunAchievements } from '../../shared/run-achievements.js';
import {
  applySeasonPointProtection,
  calculateRawSeasonPoints,
  getSeasonLevel,
  getSeasonPointsBreakdown,
  seasonLevelRank
} from '../../shared/season-levels.js';
import { createId, nowIso } from '../lib/utils.js';

export const CURRENT_SEASON_ID = 'season_1';

const seasonProgressPort = createSeasonProgressPort({
  currentSeasonId: CURRENT_SEASON_ID,
  createId,
  nowIso,
  calculateRawSeasonPoints,
  getSeasonPointsBreakdown,
  getSeasonLevel,
  applySeasonPointProtection,
  seasonLevelRank,
  getAwardableRunAchievements
});

export const {
  awardRunSeasonProgress
} = seasonProgressPort;
