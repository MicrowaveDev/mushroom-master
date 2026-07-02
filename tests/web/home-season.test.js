import assert from 'node:assert/strict';
import test from 'node:test';
import { HomeScreen } from '../../web/src/pages/HomeScreen.js';
import { messages } from '../../web/src/i18n.js';

function viewModel(state, extra = {}) {
  const vm = {
    state,
    t: messages[state.lang || 'en'],
    ...extra
  };
  for (const [key, method] of Object.entries(HomeScreen.methods || {})) {
    vm[key] = method.bind(vm);
  }
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
        totalPoints: 140,
        levelId: 'diamond',
        peakPoints: 140,
        peakLevelId: 'diamond',
        recentAchievements: [
          { id: 'season_diamond_node', earnedAt: '2026-04-26T22:00:00.000Z' },
          { id: 'perfect_circle', earnedAt: '2026-04-26T22:00:00.000Z' }
        ]
      }
    }
  });

  assert.equal(vm.seasonSummary.id, 'diamond');
  assert.equal(vm.seasonSummary.totalPoints, 140);
  assert.equal(vm.seasonSummary.peakLevelId, 'diamond');
  assert.equal(vm.seasonSummary.peakPoints, 140);
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

test('home wallet popover exposes payment support links and checkout status', () => {
  const vm = viewModel({
    lang: 'en',
    walletPurchaseStatus: 'opened',
    leaderboard: [],
    appConfig: {
      paymentSupport: {
        supportUrl: 'https://support.example/pay',
        termsUrl: 'https://terms.example/pay'
      }
    },
    bootstrap: {
      player: { id: 'player_a' },
      mushrooms: [],
      progression: {},
      season: {}
    }
  });

  assert.equal(vm.walletPurchaseStatusText, 'Checkout opened. Wallet updates after confirmation.');
  assert.deepEqual(vm.paymentSupportEntries(), [
    { label: 'Support', url: 'https://support.example/pay' },
    { label: 'Terms', url: 'https://terms.example/pay' }
  ]);
});

test('home skin picker summarizes roll pack availability and odds', () => {
  const vm = viewModel({
    lang: 'en',
    leaderboard: [],
    walletBundlesSurface: 'web',
    bootstrap: {
      player: { id: 'player_a' },
      mushrooms: [
        { id: 'thalla', name: { en: 'Thalla' }, imagePath: '/thalla.png', styleTag: 'control' },
        { id: 'axilin', name: { en: 'Axilin' }, imagePath: '/axilin.png', styleTag: 'burst' }
      ],
      activeMushroomId: 'thalla',
      assetPacks: [
        {
          id: 'season_1_portraits',
          name: { en: 'Season 1 Portrait Pack' },
          rollPriceAmount: 500,
          items: [
            { assetId: 'portrait.thalla.1', rarity: 'rare', dropWeight: 30 },
            { assetId: 'portrait.axilin.1', rarity: 'common', dropWeight: 90 }
          ]
        }
      ],
      progression: {
        thalla: {
          portraits: [
            { id: 'default', unlocked: true, owned: true, assetId: 'portrait.thalla.default', name: { en: 'Default' } },
            {
              id: '1',
              unlocked: false,
              owned: false,
              rollAvailable: true,
              packId: 'season_1_portraits',
              assetId: 'portrait.thalla.1',
              name: { en: 'Mooncap' }
            }
          ]
        },
        axilin: {
          portraits: [
            { id: '1', unlocked: true, owned: true, assetId: 'portrait.axilin.1', name: { en: 'Amber' } }
          ]
        }
      },
      season: {}
    }
  });

  assert.equal(vm.rollPackSummaries.length, 1);
  assert.deepEqual(vm.rollPackSummaries[0], {
    id: 'season_1_portraits',
    name: 'Season 1 Portrait Pack',
    total: 2,
    owned: 1,
    left: 1,
    active: true,
    availabilityLabel: '',
    price: 500,
    odds: 'Common 75% · Rare 25%'
  });
});
