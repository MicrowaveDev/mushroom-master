import levels from './season-levels.json' with { type: 'json' };

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

function localized(value, lang = 'en') {
  if (!value || typeof value !== 'object') return value || '';
  return value[lang] || value.en || value.ru || '';
}

export function calculateSeasonPoints({
  wins = 0,
  losses = 0,
  roundsCompleted = 0,
  endReason = null
} = {}) {
  const breakdown = getSeasonPointsBreakdown({ wins, losses, roundsCompleted, endReason });
  return breakdown.total;
}

export function calculateRawSeasonPoints({ wins = 0, losses = 0, roundsCompleted = 0, endReason = null } = {}) {
  const scoringWins = Math.min(Math.max(0, wins), SEASON_MAX_SCORING_WINS);
  const winsPoints = scoringWins * 2;
  const lossesPenalty = Math.max(0, losses) * -1;
  const clearBonus = endReason === 'max_rounds' ? 3 : 0;
  const abandonPenalty = calculateSeasonAbandonPenalty({ endReason, roundsCompleted });
  return winsPoints + lossesPenalty + clearBonus + abandonPenalty;
}

export function calculateSeasonAbandonPenalty({ endReason = null, roundsCompleted = 0 } = {}) {
  if (endReason !== 'abandoned') return 0;
  return Math.max(0, roundsCompleted) > 0 ? -5 : -2;
}

export function applySeasonPointProtection({ runPoints = 0 } = {}) {
  return runPoints;
}

export function getSeasonPointsBreakdown({
  wins = 0,
  losses = 0,
  roundsCompleted = 0,
  endReason = null
} = {}) {
  const safeWins = Math.max(0, wins);
  const scoringWins = Math.min(safeWins, SEASON_MAX_SCORING_WINS);
  const cappedWins = Math.max(0, safeWins - scoringWins);
  const winsPoints = scoringWins * 2;
  const lossesPenalty = Math.max(0, losses) * -1;
  const clearBonus = endReason === 'max_rounds' ? 3 : 0;
  const abandonPenalty = calculateSeasonAbandonPenalty({ endReason, roundsCompleted });
  const rawTotal = winsPoints + lossesPenalty + clearBonus + abandonPenalty;
  const total = applySeasonPointProtection({ runPoints: rawTotal });
  return {
    wins: safeWins,
    scoringWins,
    cappedWins,
    losses: Math.max(0, losses),
    roundsCompleted: Math.max(0, roundsCompleted),
    winsPoints,
    lossesPenalty,
    clearBonus,
    abandonPenalty,
    protectionAdjustment: total - rawTotal,
    total
  };
}

export function seasonLevelRank(levelId) {
  const index = levels.findIndex((level) => level.id === levelId);
  return index < 0 ? -1 : index;
}

export function getSeasonEndReward(levelId = 'bronze') {
  return seasonEndRewards[levelId] || seasonEndRewards.bronze;
}

export function getSeasonLevel(points) {
  const safePoints = Math.max(0, points || 0);
  let current = levels[0];
  for (const level of levels) {
    if (safePoints >= level.minPoints) current = level;
  }
  const currentIndex = levels.findIndex((level) => level.id === current.id);
  const next = levels[currentIndex + 1] || null;
  const span = next ? next.minPoints - current.minPoints : 1;
  const progress = next
    ? Math.max(0, Math.min(100, Math.round(((safePoints - current.minPoints) / span) * 100)))
    : 100;

  return {
    id: current.id,
    minPoints: current.minPoints,
    points: safePoints,
    next,
    progress,
    isMax: !next,
    raw: current
  };
}

export function getRunSeasonSummary(context = {}, lang = 'en') {
  const points = calculateSeasonPoints(context);
  return getSeasonProgressSummary(points, lang, points);
}

export function getSeasonProgressSummary(totalPoints, lang = 'en', runPoints = 0, peakPoints = totalPoints) {
  const points = Math.max(0, totalPoints || 0);
  const safePeakPoints = Math.max(points, peakPoints || 0);
  const level = getSeasonLevel(points);
  const peakLevel = getSeasonLevel(safePeakPoints);
  return {
    ...level,
    runPoints,
    totalPoints: level.points,
    peakPoints: peakLevel.points,
    peakLevelId: peakLevel.id,
    peakName: localized(peakLevel.raw.name, lang),
    seasonName: localized(CURRENT_SEASON.name, lang),
    seasonTheme: localized(CURRENT_SEASON.theme, lang),
    seasonStartsAt: CURRENT_SEASON.startsAt,
    seasonEndsAt: CURRENT_SEASON.endsAt,
    seasonResetPolicy: CURRENT_SEASON.resetPolicy,
    name: localized(level.raw.name, lang),
    lore: localized(level.raw.lore, lang),
    nextName: level.next ? localized(level.next.name, lang) : '',
    pointsToNext: level.next ? Math.max(0, level.next.minPoints - points) : 0
  };
}
