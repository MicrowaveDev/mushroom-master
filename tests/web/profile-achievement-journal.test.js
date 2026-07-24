import assert from 'node:assert/strict';
import test from 'node:test';
import { ProfileScreen as CoreProfileScreen } from '@microwavedev/backpack-game-core/vue/pages';
import { getAllRunAchievements } from '../../app/shared/run-achievements.js';
import { getSeasonProgressSummary } from '../../app/shared/season-levels.js';

const t = {
  profile: 'Progress',
  seasonPoints: 'points',
  seasonPointsToNext: 'points to',
  seasonMaxLevel: 'Season peak',
  seasonPeakRank: 'Peak rank',
  achievementsEarned: 'Achievements earned',
  achievementJournal: 'Achievement Journal',
  achievementJournalHint: 'Collect badges.',
  achievementLocked: 'Locked',
  nextAchievement: 'Next badge',
  seasonChapterNoReset: 'Season chapter: progress stays in your history.',
  seasonRulesHint: 'First 7 wins count for rank.'
};

function viewModel(state) {
  const vm = {
    state,
    t,
    achievementCatalog: getAllRunAchievements(state.lang || 'en'),
    seasonSummary: getSeasonProgressSummary(
      state.bootstrap?.season?.totalPoints || 0,
      state.lang || 'en',
      0,
      state.bootstrap?.season?.peakPoints || state.bootstrap?.season?.totalPoints || 0
    ),
    getCharacter(id) {
      return { name: { en: id }, styleTag: 'fighter' };
    },
    normalizeProgressionEntry: (entry, id) => ({ ...entry, characterId: entry?.mushroomId || id })
  };
  for (const [key, getter] of Object.entries(CoreProfileScreen.computed)) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  for (const [key, method] of Object.entries(CoreProfileScreen.methods)) {
    vm[key] = method.bind(vm);
  }
  return vm;
}

test('profile journal groups earned and locked achievements', () => {
  const vm = viewModel({
    lang: 'en',
    bootstrap: {
      season: {
        totalPoints: 70,
        achievements: [
          { id: 'season_silver_thread', earnedAt: '2026-04-26T22:00:00.000Z' },
          { id: 'thalla_spore_echo', earnedAt: '2026-04-26T22:01:00.000Z' }
        ]
      }
    }
  });

  assert.equal(vm.seasonSummary.id, 'gold');
  const seasonGroup = vm.achievementGroups.find((group) => group.id === 'season');
  const characterGroup = vm.achievementGroups.find((group) => group.id === 'thalla');
  assert.ok(seasonGroup.achievements.some((achievement) => achievement.id === 'season_silver_thread' && achievement.earned));
  assert.ok(seasonGroup.achievements.some((achievement) => achievement.id === 'season_gold_cap' && !achievement.earned));
  assert.ok(characterGroup.achievements.some((achievement) => achievement.id === 'thalla_spore_echo' && achievement.earned));
  assert.ok(vm.achievementClass(seasonGroup.achievements[0]).some((className) => className.startsWith('journal-achievement--')));
});
