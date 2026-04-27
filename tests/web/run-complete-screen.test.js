import assert from 'node:assert/strict';
import test from 'node:test';
import { RunCompleteScreen } from '../../web/src/pages/RunCompleteScreen.js';
import { getEarnedRunAchievements, runAchievements } from '../../app/shared/run-achievements.js';
import { calculateSeasonPoints, getRunSeasonSummary, seasonLevels } from '../../app/shared/season-levels.js';

const t = {
  runComplete: 'Game Complete',
  runCompleteClearedTitle: 'Mycelium held',
  runCompleteEliminatedTitle: 'Run ended',
  runCompleteClearedText: 'You cleared every round and claimed the full bonus.',
  runCompleteEliminatedText: 'Your lives are gone, but the gathered resources stay with you.',
  runCompleteAbandonedText: 'The run ended early.',
  maxRounds: 'Max rounds reached',
  eliminated: 'All lives lost',
  abandonRun: 'Abandon',
  outcomeWin: 'Victory',
  outcomeLoss: 'Defeat',
  outcomeDraw: 'Draw',
  spore: 'Spore',
  mycelium: 'Mycelium',
  wins: 'Wins',
  roundsCompleted: 'Rounds',
  achievementsEarned: 'Achievements earned',
  seasonLevel: 'Season level',
  seasonPoints: 'points',
  seasonPointsToNext: 'points to',
  seasonMaxLevel: 'Season peak',
  newAchievement: 'New',
  alreadyEarned: 'Earned',
  clearBonus: 'Full clear',
  achievementNoneTitle: 'No new marks',
  achievementNoneHint: 'The mycelium still remembers this run.',
  thisRun: 'this run'
};

function viewModel(state) {
  const vm = { state, t };
  for (const [key, getter] of Object.entries(RunCompleteScreen.computed)) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  vm.achievementClass = RunCompleteScreen.methods.achievementClass.bind(vm);
  return vm;
}

test('run achievements catalogue is split into general and every character list', () => {
  assert.ok(Array.isArray(runAchievements.general));
  assert.ok(runAchievements.general.length >= 3);

  for (const mushroomId of ['thalla', 'lomie', 'axilin', 'kirt', 'morga', 'dalamar']) {
    const list = runAchievements.characters[mushroomId];
    assert.ok(Array.isArray(list), `${mushroomId} achievement list should exist`);
    assert.ok(list.length >= 2, `${mushroomId} should have multiple lore achievements`);
    assert.ok(list.every((achievement) => achievement.name?.ru && achievement.name?.en));
    assert.ok(list.every((achievement) => achievement.lore?.ru && achievement.lore?.en));
  }
});

test('season levels use bronze silver gold diamond thresholds', () => {
  assert.deepEqual(seasonLevels.map((level) => level.id), ['bronze', 'silver', 'gold', 'diamond']);
  assert.equal(getRunSeasonSummary({ wins: 0, roundsCompleted: 1 }, 'en').id, 'bronze');
  assert.equal(getRunSeasonSummary({ wins: 2, roundsCompleted: 2 }, 'en').id, 'silver');
  assert.equal(getRunSeasonSummary({ wins: 4, roundsCompleted: 6 }, 'en').id, 'gold');
  assert.equal(getRunSeasonSummary({ wins: 7, roundsCompleted: 9, endReason: 'max_rounds' }, 'en').id, 'diamond');
  assert.equal(calculateSeasonPoints({ wins: 7, roundsCompleted: 9, endReason: 'max_rounds' }), 35);
});

test('run complete recap uses final result stats and last battle details', () => {
  const vm = viewModel({
    gameRun: {
      endReason: 'max_losses',
      completionBonus: { spore: 20, mycelium: 8 }
    },
    gameRunResult: {
      player: {
        completedRounds: 6,
        wins: 2,
        losses: 4,
        livesRemaining: 0,
        coins: 3
      },
      lastRound: {
        roundNumber: 6,
        outcome: 'loss',
      rewards: { spore: 1, mycelium: 0 }
      }
    },
    bootstrap: { activeMushroomId: 'thalla' },
    lang: 'en'
  });

  assert.equal(vm.outcomeTone, 'eliminated');
  assert.equal(vm.titleText, 'Run ended');
  assert.equal(vm.reasonText, 'Your lives are gone, but the gathered resources stay with you.');
  assert.equal(vm.wins, 2);
  assert.equal(vm.losses, 4);
  assert.equal(vm.roundsCompleted, 6);
  assert.equal(vm.winRate, 33);
  assert.equal(vm.seasonSummary.id, 'silver');
  assert.equal(vm.seasonSummary.points, 12);
  assert.equal(vm.livesRemaining, 0);
  assert.equal(vm.hasBonus, true);
  assert.equal(vm.lastRoundOutcomeLabel, 'Defeat');
  assert.equal(vm.lastRoundRewardText, '+1 Spore');
  assert.ok(vm.earnedAchievements.some((achievement) => achievement.id === 'thalla_spore_echo'));
  assert.ok(vm.earnedAchievements.some((achievement) => achievement.id === 'season_silver_thread' && achievement.type === 'season'));
  assert.ok(vm.earnedAchievements.some((achievement) => achievement.id === 'last_spore'));
});

test('fallback achievement calculation preserves season type styling', () => {
  const earned = getEarnedRunAchievements({
    mushroomId: 'thalla',
    endReason: 'max_losses',
    lastOutcome: 'loss',
    wins: 2,
    losses: 4,
    roundsCompleted: 6,
    livesRemaining: 0,
    winRate: 33,
    seasonLevel: 'silver',
    seasonPoints: 12
  }, 'en');

  const seasonAchievement = earned.find((achievement) => achievement.id === 'season_silver_thread');
  assert.equal(seasonAchievement.type, 'season');
  assert.equal(seasonAchievement.accent, 'silver');
});

test('run complete recap handles max-round clears and challenge bonus maps', () => {
  const vm = viewModel({
    bootstrap: {
      player: { id: 'player_b' }
    },
    gameRun: {
      endReason: 'max_rounds',
      completionBonus: {
        player_a: { spore: 10, mycelium: 4 },
        player_b: { spore: 40, mycelium: 15 }
      }
    },
    gameRunResult: {
      playerResults: {
        player_b: {
          completedRounds: 9,
          wins: 7,
          losses: 2,
          livesRemaining: 3,
          coins: 0
        }
      },
      lastRound: {
        roundNumber: 9,
        outcome: 'win',
        rewards: { spore: 3, mycelium: 2 }
      }
    },
    lang: 'en'
  });

  assert.equal(vm.outcomeTone, 'cleared');
  assert.equal(vm.titleText, 'Mycelium held');
  assert.equal(vm.reasonText, 'You cleared every round and claimed the full bonus.');
  assert.equal(vm.winRate, 78);
  assert.equal(vm.seasonSummary.id, 'diamond');
  assert.deepEqual(vm.bonus, { spore: 40, mycelium: 15 });
  assert.equal(vm.lastRoundOutcomeLabel, 'Victory');
  assert.equal(vm.lastRoundRewardText, '+3 Spore / +2 Mycelium');
  assert.ok(vm.earnedAchievements.some((achievement) => achievement.id === 'season_diamond_node'));
  assert.ok(vm.earnedAchievements.some((achievement) => achievement.id === 'perfect_circle'));
});

test('run complete recap prefers persisted season and achievement unlocks', () => {
  const vm = viewModel({
    gameRun: {
      endReason: 'max_rounds'
    },
    gameRunResult: {
      season: {
        seasonId: 'season_1',
        runPoints: 12,
        totalPoints: 31,
        levelId: 'diamond',
        leveledUp: true
      },
      achievements: [
        { id: 'season_diamond_node', isNew: true },
        { id: 'perfect_circle', isNew: true }
      ],
      player: {
        completedRounds: 2,
        wins: 1,
        losses: 1,
        livesRemaining: 4,
        coins: 0
      }
    },
    bootstrap: { activeMushroomId: 'kirt' },
    lang: 'en'
  });

  assert.equal(vm.seasonSummary.id, 'diamond');
  assert.equal(vm.seasonSummary.runPoints, 12);
  assert.equal(vm.seasonSummary.totalPoints, 31);
  assert.equal(vm.seasonSummary.leveledUp, true);
  assert.equal(vm.seasonBreakdownText, 'Wins +3 / Rounds +2 / Full clear +5');
  assert.deepEqual(vm.earnedAchievements.map((achievement) => achievement.id), ['season_diamond_node', 'perfect_circle']);
  assert.ok(vm.achievementClass(vm.earnedAchievements[0]).includes('run-achievement--season'));
});

test('run complete recap shows already-earned achievements without marking them new', () => {
  const vm = viewModel({
    gameRun: { endReason: 'max_losses' },
    gameRunResult: {
      season: {
        seasonId: 'season_1',
        runPoints: 8,
        totalPoints: 16,
        levelId: 'silver',
        leveledUp: false,
        breakdown: { winsPoints: 6, roundsPoints: 2, clearBonus: 0 }
      },
      achievements: [
        { id: 'season_silver_thread', isNew: false }
      ],
      player: {
        completedRounds: 2,
        wins: 2,
        losses: 1,
        livesRemaining: 0,
        coins: 0
      }
    },
    bootstrap: { activeMushroomId: 'thalla' },
    lang: 'en'
  });

  assert.equal(vm.earnedAchievements[0].isNew, false);
  assert.ok(vm.achievementClass(vm.earnedAchievements[0]).includes('run-achievement--earned'));
});

test('run complete game-feel hooks log client events when session exists', () => {
  const calls = [];
  const oldFetch = globalThis.fetch;
  const oldWindow = globalThis.window;
  const oldCustomEvent = globalThis.CustomEvent;
  globalThis.fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve({ ok: true });
  };
  globalThis.window = {
    dispatchEvent() {},
    Telegram: null
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  try {
    const vm = viewModel({
      sessionKey: 'session_test',
      gameRun: { id: 'run_a', endReason: 'max_rounds' },
      gameRunResult: {
        id: 'run_a',
        season: {
          seasonId: 'season_1',
          runPoints: 12,
          totalPoints: 31,
          levelId: 'diamond',
          leveledUp: true
        },
        achievements: [
          { id: 'season_diamond_node', isNew: true }
        ],
        player: {
          completedRounds: 2,
          wins: 1,
          losses: 1,
          livesRemaining: 4,
          coins: 0
        }
      },
      bootstrap: { activeMushroomId: 'kirt' },
      lang: 'en'
    });
    vm.logGameFeelEvent = RunCompleteScreen.methods.logGameFeelEvent.bind(vm);
    vm.emitGameFeelHooks = RunCompleteScreen.methods.emitGameFeelHooks.bind(vm);
    vm.emitGameFeelHooks();

    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => call.url === '/api/client-events'));
    assert.ok(calls.some((call) => JSON.parse(call.options.body).event === 'season_tier_up'));
    assert.ok(calls.some((call) => JSON.parse(call.options.body).event === 'achievement_unlock'));
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.window = oldWindow;
    globalThis.CustomEvent = oldCustomEvent;
  }
});
