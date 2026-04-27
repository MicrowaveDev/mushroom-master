import assert from 'node:assert/strict';
import test from 'node:test';
import { ProfileScreen } from '../../web/src/pages/ProfileScreen.js';

const t = {
  profile: 'Progress',
  seasonPoints: 'points',
  seasonPointsToNext: 'points to',
  seasonMaxLevel: 'Season peak',
  achievementsEarned: 'Achievements earned',
  achievementJournal: 'Achievement Journal',
  achievementJournalHint: 'Collect badges.',
  achievementLocked: 'Locked',
  nextAchievement: 'Next badge',
  seasonChapterNoReset: 'Season chapter: progress stays in your history.'
};

function viewModel(state) {
  const vm = {
    state,
    t,
    getMushroom(id) {
      return { name: { en: id }, styleTag: 'fighter' };
    }
  };
  for (const [key, getter] of Object.entries(ProfileScreen.computed)) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  vm.characterGroups = ProfileScreen.methods.characterGroups.bind(vm);
  vm.achievementClass = ProfileScreen.methods.achievementClass.bind(vm);
  return vm;
}

test('profile journal groups earned and locked achievements', () => {
  const vm = viewModel({
    lang: 'en',
    bootstrap: {
      season: {
        totalPoints: 18,
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
  assert.equal(vm.nextAchievement.id, 'first_ring_crossed');
  assert.ok(vm.achievementClass(seasonGroup.achievements[0]).some((className) => className.startsWith('journal-achievement--')));
});
