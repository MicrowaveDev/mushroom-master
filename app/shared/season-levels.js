import levels from './season-levels.json' with { type: 'json' };

export const seasonLevels = levels;
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

export function calculateSeasonPoints({ wins = 0, roundsCompleted = 0, endReason = null } = {}) {
  return Math.max(0, wins * 3 + roundsCompleted + (endReason === 'max_rounds' ? 5 : 0));
}

export function getSeasonPointsBreakdown({ wins = 0, roundsCompleted = 0, endReason = null } = {}) {
  const winsPoints = Math.max(0, wins * 3);
  const roundsPoints = Math.max(0, roundsCompleted);
  const clearBonus = endReason === 'max_rounds' ? 5 : 0;
  return {
    wins: Math.max(0, wins),
    roundsCompleted: Math.max(0, roundsCompleted),
    winsPoints,
    roundsPoints,
    clearBonus,
    total: winsPoints + roundsPoints + clearBonus
  };
}

export function seasonLevelRank(levelId) {
  const index = levels.findIndex((level) => level.id === levelId);
  return index < 0 ? -1 : index;
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

export function getSeasonProgressSummary(totalPoints, lang = 'en', runPoints = 0) {
  const points = Math.max(0, totalPoints || 0);
  const level = getSeasonLevel(points);
  return {
    ...level,
    runPoints,
    totalPoints: level.points,
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
