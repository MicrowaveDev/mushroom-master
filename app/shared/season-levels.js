import levels from './season-levels.json' with { type: 'json' };
import { createSeasonLevelService } from '@microwavedev/backpack-game-core/modules/season';

export const seasonLevels = levels;
export const SEASON_MAX_SCORING_WINS = 7;
export const seasonEndRewards = {
  bronze: { spore: 50, mycelium: 0 },
  silver: { spore: 150, mycelium: 5 },
  gold: { spore: 350, mycelium: 15 },
  diamond: { spore: 800, mycelium: 40 }
};
export const CURRENT_SEASON = {
  id: 'season_1',
  name: {
    ru: 'Сезон Глубокого Кольца',
    en: 'Season of the Deep Ring'
  },
  theme: {
    ru: 'Корни сжимают арену в кольцо, и каждая партия оставляет новый след в мицелии.',
    en: 'Roots close the arena into a ring, and every run leaves another mark in the mycelium.'
  },
  startsAt: '2026-04-01',
  endsAt: '2026-06-30',
  resetPolicy: 'chapter'
};

const mushroomSeasonLevels = createSeasonLevelService({
  levels,
  currentSeason: CURRENT_SEASON,
  seasonEndRewards,
  maxScoringWins: SEASON_MAX_SCORING_WINS,
  fallbackRewardLevelId: 'bronze'
});

export const {
  calculateSeasonPoints,
  calculateRawSeasonPoints,
  calculateSeasonAbandonPenalty,
  applySeasonPointProtection,
  getSeasonPointsBreakdown,
  seasonLevelRank,
  getSeasonEndReward,
  getSeasonLevel,
  getRunSeasonSummary,
  getSeasonProgressSummary
} = mushroomSeasonLevels;
