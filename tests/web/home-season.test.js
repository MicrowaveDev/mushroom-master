import assert from 'node:assert/strict';
import test from 'node:test';
import { HomeScreen } from '../../web/src/pages/HomeScreen.js';

function viewModel(state) {
  const vm = { state };
  for (const [key, getter] of Object.entries(HomeScreen.computed)) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  return vm;
}

test('home screen exposes persisted season progress and recent achievements', () => {
  const vm = viewModel({
    lang: 'en',
    leaderboard: [],
    bootstrap: {
      player: { id: 'player_a' },
      mushrooms: [],
      progression: {},
      season: {
        totalPoints: 31,
        levelId: 'diamond',
        recentAchievements: [
          { id: 'season_diamond_node', earnedAt: '2026-04-26T22:00:00.000Z' },
          { id: 'perfect_circle', earnedAt: '2026-04-26T22:00:00.000Z' }
        ]
      }
    }
  });

  assert.equal(vm.seasonSummary.id, 'diamond');
  assert.equal(vm.seasonSummary.totalPoints, 31);
  assert.deepEqual(vm.seasonAchievements.map((achievement) => achievement.id), ['season_diamond_node', 'perfect_circle']);
});

test('home screen exposes next achievement hint when no recent achievements exist', () => {
  const vm = viewModel({
    lang: 'en',
    leaderboard: [],
    bootstrap: {
      player: { id: 'player_a' },
      mushrooms: [],
      progression: {},
      season: {
        totalPoints: 0,
        levelId: 'bronze',
        achievements: [],
        recentAchievements: []
      }
    }
  });

  assert.equal(vm.seasonAchievements.length, 0);
  assert.equal(vm.nextAchievement.id, 'first_ring_crossed');
  assert.equal(vm.nextAchievement.type, 'general');
});
