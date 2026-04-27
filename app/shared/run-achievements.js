import achievements from './run-achievements.json' with { type: 'json' };
import { seasonLevelRank } from './season-levels.js';

export const runAchievements = achievements;

const characterAccents = {
  thalla: 'thalla',
  lomie: 'lomie',
  axilin: 'axilin',
  kirt: 'kirt',
  morga: 'morga',
  dalamar: 'dalamar'
};

function allAchievements() {
  return [
    ...(achievements.general || []).map((achievement) => ({
      ...achievement,
      type: achievement.id.startsWith('season_') ? 'season' : 'general',
      accent: achievement.id.startsWith('season_') ? achievement.id.replace('season_', '').split('_')[0] : 'general'
    })),
    ...Object.values(achievements.characters || {}).flatMap((list) =>
      (list || []).map((achievement) => {
        const characterId = Object.entries(achievements.characters || {})
          .find(([, characterList]) => characterList?.some((entry) => entry.id === achievement.id))?.[0] || 'character';
        return {
          ...achievement,
          type: 'character',
          characterId,
          accent: characterAccents[characterId] || 'character'
        };
      })
    )
  ];
}

function availableAchievementsForContext(context) {
  return allAchievements().filter((achievement) => {
    if (achievement.type === 'character' && achievement.characterId !== context.mushroomId) return false;
    return criteriaMatches(achievement.criteria, context);
  });
}

function localized(value, lang = 'en') {
  if (!value || typeof value !== 'object') return value || '';
  return value[lang] || value.en || value.ru || '';
}

function criteriaMatches(criteria = {}, context) {
  if (criteria.endReason && context.endReason !== criteria.endReason) return false;
  if (criteria.lastOutcome && context.lastOutcome !== criteria.lastOutcome) return false;
  if (criteria.minWins != null && context.wins < criteria.minWins) return false;
  if (criteria.maxWins != null && context.wins > criteria.maxWins) return false;
  if (criteria.minLosses != null && context.losses < criteria.minLosses) return false;
  if (criteria.maxLosses != null && context.losses > criteria.maxLosses) return false;
  if (criteria.minRounds != null && context.roundsCompleted < criteria.minRounds) return false;
  if (criteria.maxRounds != null && context.roundsCompleted > criteria.maxRounds) return false;
  if (criteria.minWinRate != null && context.winRate < criteria.minWinRate) return false;
  if (criteria.maxWinRate != null && context.winRate > criteria.maxWinRate) return false;
  if (criteria.minLivesRemaining != null && context.livesRemaining < criteria.minLivesRemaining) return false;
  if (criteria.maxLivesRemaining != null && context.livesRemaining > criteria.maxLivesRemaining) return false;
  if (criteria.seasonLevel && context.seasonLevel !== criteria.seasonLevel) return false;
  if (criteria.minSeasonLevel && seasonLevelRank(context.seasonLevel) < seasonLevelRank(criteria.minSeasonLevel)) return false;
  if (criteria.maxSeasonLevel && seasonLevelRank(context.seasonLevel) > seasonLevelRank(criteria.maxSeasonLevel)) return false;
  if (criteria.minSeasonPoints != null && context.seasonPoints < criteria.minSeasonPoints) return false;
  if (criteria.maxSeasonPoints != null && context.seasonPoints > criteria.maxSeasonPoints) return false;
  return true;
}

function decorateAchievement(achievement, type, lang) {
  return {
    id: achievement.id,
    type,
    accent: achievement.accent || type,
    characterId: achievement.characterId || null,
    badgeSymbol: achievement.badgeSymbol || inferBadgeSymbol(achievement),
    name: localized(achievement.name, lang),
    lore: localized(achievement.lore, lang)
  };
}

function inferBadgeSymbol(achievement) {
  if (achievement.type === 'season') {
    if (achievement.id.includes('diamond')) return '◆';
    if (achievement.id.includes('gold')) return '●';
    if (achievement.id.includes('silver')) return '◇';
    return '◉';
  }
  if (achievement.characterId === 'thalla') return '✦';
  if (achievement.characterId === 'lomie') return '▣';
  if (achievement.characterId === 'morga') return '✹';
  if (achievement.characterId === 'axilin') return '∴';
  if (achievement.characterId === 'kirt') return '⌁';
  if (achievement.characterId === 'dalamar') return '◌';
  if (achievement.id === 'perfect_circle') return '◎';
  return '•';
}

export function getRunAchievementById(id) {
  return allAchievements().find((achievement) => achievement.id === id) || null;
}

export function getAllRunAchievements(lang = 'en') {
  return allAchievements().map((achievement) => decorateAchievement(achievement, achievement.type, lang));
}

export function getNextRunAchievementHint(earnedIds = [], lang = 'en') {
  const earned = new Set(earnedIds.map((entry) => typeof entry === 'string' ? entry : entry?.id).filter(Boolean));
  const next = allAchievements().find((achievement) => !earned.has(achievement.id));
  return next ? decorateAchievement(next, next.type, lang) : null;
}

export function getRunAchievementsByIds(ids = [], lang = 'en') {
  return ids
    .map((entry) => {
      const id = typeof entry === 'string' ? entry : entry?.id;
      const achievement = getRunAchievementById(id);
      if (!achievement) return null;
      return {
        ...decorateAchievement(achievement, achievement.type, lang),
        isNew: typeof entry === 'object' ? Boolean(entry.isNew) : true
      };
    })
    .filter(Boolean);
}

export function getEarnedRunAchievements(context, lang = 'en', limit = 6) {
  return availableAchievementsForContext(context)
    .sort((a, b) => {
      const priority = { character: 0, season: 1, general: 2 };
      return (priority[a.type] ?? 3) - (priority[b.type] ?? 3);
    })
    .map((achievement) => decorateAchievement(achievement, achievement.type, lang))
    .slice(0, limit);
}
