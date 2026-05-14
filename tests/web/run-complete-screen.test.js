import assert from 'node:assert/strict';
import test from 'node:test';
import { RunCompleteScreen } from '../../web/src/pages/RunCompleteScreen.js';
import { getAwardableRunAchievements, getEarnedRunAchievements, runAchievements } from '../../app/shared/run-achievements.js';
import { calculateSeasonPoints, getRunSeasonSummary, getSeasonEndReward, getSeasonProgressSummary, seasonLevels } from '../../app/shared/season-levels.js';

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
  losses: 'Losses',
  roundsCompleted: 'Rounds',
  achievementsEarned: 'Achievements earned',
  seasonLevel: 'Season level',
  seasonPoints: 'points',
  seasonPointsToNext: 'points to',
  seasonMaxLevel: 'Season peak',
  seasonPeakRank: 'Peak rank',
  newAchievement: 'New',
  alreadyEarned: 'Earned',
  clearBonus: 'Full clear',
  abandonPenalty: 'Exit',
  achievementNoneTitle: 'No new marks',
  achievementNoneHint: 'The mycelium still remembers this run.',
  earnedThisBattle: 'Earned',
  playAgain: 'Play again',
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
  for (const [key, method] of Object.entries(RunCompleteScreen.methods)) {
    vm[key] = method.bind(vm);
  }
  return vm;
}

test('run achievements catalogue is split into general and every character list', () => {
  assert.ok(Array.isArray(runAchievements.general));
  assert.ok(runAchievements.general.length >= 3);

  for (const mushroomId of ['thalla', 'lomie', 'axilin', 'kirt', 'morga', 'dalamar']) {
    const list = runAchievements.characters[mushroomId];
    assert.ok(Array.isArray(list), `${mushroomId} achievement list should exist`);
    assert.ok(list.length >= 3, `${mushroomId} should have production-depth lore achievements`);
    assert.ok(list.every((achievement) => achievement.name?.ru && achievement.name?.en));
    assert.ok(list.every((achievement) => achievement.lore?.ru && achievement.lore?.en));
  }
});

test('season levels use bronze silver gold diamond thresholds', () => {
  assert.deepEqual(seasonLevels.map((level) => level.id), ['bronze', 'silver', 'gold', 'diamond']);
  assert.equal(getRunSeasonSummary({ wins: 0, losses: 1 }, 'en').id, 'bronze');
  assert.equal(getSeasonProgressSummary(25, 'en').id, 'silver');
  assert.equal(getSeasonProgressSummary(70, 'en').id, 'gold');
  assert.equal(getSeasonProgressSummary(140, 'en').id, 'diamond');
  assert.equal(calculateSeasonPoints({ wins: 9, losses: 0, roundsCompleted: 9, endReason: 'max_rounds' }), 17);
  assert.equal(calculateSeasonPoints({ wins: 1, losses: 3, roundsCompleted: 4, endReason: 'abandoned' }), -6);
  assert.deepEqual(getSeasonEndReward('diamond'), { spore: 800, mycelium: 40 });
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
      },
      rounds: [
        { roundNumber: 1, outcome: 'win', rewards: { spore: 2, mycelium: 15 } },
        { roundNumber: 2, outcome: 'loss', rewards: { spore: 1, mycelium: 5 } },
        { roundNumber: 3, outcome: 'win', rewards: { spore: 2, mycelium: 15 } },
        { roundNumber: 4, outcome: 'loss', rewards: { spore: 1, mycelium: 5 } },
        { roundNumber: 5, outcome: 'loss', rewards: { spore: 1, mycelium: 5 } },
        { roundNumber: 6, outcome: 'loss', rewards: { spore: 1, mycelium: 0 } }
      ]
    },
    bootstrap: { activeMushroomId: 'thalla' },
    lang: 'en'
  });

  assert.equal(vm.outcomeTone, 'eliminated');
  assert.equal(vm.titleText, 'Defeat');
  assert.equal(vm.reasonText, 'All lives lost');
  assert.equal(vm.wins, 2);
  assert.equal(vm.losses, 4);
  assert.equal(vm.roundsCompleted, 6);
  assert.equal(vm.winRate, 33);
  assert.equal(vm.seasonSummary.id, 'bronze');
  assert.equal(vm.seasonSummary.points, 0);
  assert.equal(vm.livesRemaining, 0);
  assert.equal(vm.hasBonus, true);
  assert.equal(vm.lastRoundOutcomeLabel, 'Defeat');
  assert.equal(vm.lastRoundRewardText, '+1 Spore');
  assert.deepEqual(vm.runTotals, { spore: 28, mycelium: 53 });
  assert.equal(vm.runEarnedText, '+28 Spore · +53 Mycelium');
  assert.deepEqual(vm.roundTimeline.map((round) => round.icon), ['🏆', '💔', '🏆', '💔', '💔', '💔']);
  assert.ok(vm.earnedAchievements.some((achievement) => achievement.id === 'thalla_spore_echo'));
  assert.ok(vm.earnedAchievements.some((achievement) => achievement.id === 'season_bronze_spore' && achievement.type === 'season'));
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

test('achievement awarding paces first full-clear unlocks', () => {
  const awarded = getAwardableRunAchievements({
    mushroomId: 'thalla',
    endReason: 'max_rounds',
    lastOutcome: 'win',
    wins: 7,
    losses: 2,
    roundsCompleted: 9,
    livesRemaining: 3,
    winRate: 78,
    seasonLevel: 'bronze',
    seasonPoints: 17
  }, 'en');

  assert.deepEqual(awarded.map((achievement) => achievement.id), [
    'first_ring_crossed',
    'season_bronze_spore',
    'perfect_circle'
  ]);
});

test('achievement awarding rolls forward delayed matching achievements', () => {
  const awarded = getAwardableRunAchievements({
    mushroomId: 'thalla',
    endReason: 'max_losses',
    lastOutcome: 'win',
    wins: 1,
    losses: 1,
    roundsCompleted: 2,
    livesRemaining: 4,
    winRate: 50,
    seasonLevel: 'bronze',
    seasonPoints: 19
  }, 'en', {
    alreadyEarnedIds: ['first_ring_crossed', 'season_bronze_spore', 'perfect_circle']
  });

  assert.deepEqual(awarded.map((achievement) => achievement.id), [
    'thalla_spore_echo',
    'last_spore',
    'first_ring_crossed',
    'season_bronze_spore'
  ]);
});

test('achievement awarding includes late character mastery after early milestones are earned', () => {
  const awarded = getAwardableRunAchievements({
    mushroomId: 'morga',
    endReason: 'max_rounds',
    lastOutcome: 'win',
    wins: 7,
    losses: 2,
    roundsCompleted: 9,
    livesRemaining: 3,
    winRate: 78,
    seasonLevel: 'gold',
    seasonPoints: 72
  }, 'en', {
    alreadyEarnedIds: [
      'first_ring_crossed',
      'season_bronze_spore',
      'season_silver_thread',
      'season_gold_cap',
      'perfect_circle',
      'deep_run',
      'three_caps_taken',
      'morga_first_bloom',
      'morga_flash_trail'
    ]
  });

  assert.equal(awarded[0].id, 'morga_sunburst_crown');
  assert.equal(awarded[0].type, 'character');
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
  assert.equal(vm.seasonSummary.id, 'bronze');
  assert.deepEqual(vm.bonus, { spore: 40, mycelium: 15 });
  assert.equal(vm.lastRoundOutcomeLabel, 'Victory');
  assert.equal(vm.lastRoundRewardText, '+3 Spore / +2 Mycelium');
  assert.ok(vm.earnedAchievements.some((achievement) => achievement.id === 'season_bronze_spore'));
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
        runPoints: 15,
        totalPoints: 145,
        levelId: 'diamond',
        leveledUp: true
      },
      achievements: [
        { id: 'season_diamond_node', isNew: true },
        { id: 'perfect_circle', isNew: true }
      ],
      player: {
        completedRounds: 9,
        wins: 7,
        losses: 2,
        livesRemaining: 4,
        coins: 0
      }
    },
    bootstrap: { activeMushroomId: 'kirt' },
    lang: 'en'
  });

  assert.equal(vm.seasonSummary.id, 'diamond');
  assert.equal(vm.seasonSummary.runPoints, 15);
  assert.equal(vm.seasonSummary.totalPoints, 145);
  assert.equal(vm.seasonSummary.leveledUp, true);
  assert.equal(vm.seasonBreakdownText, 'Wins +14 / Losses -2 / Full clear +3');
  assert.deepEqual(vm.earnedAchievements.map((achievement) => achievement.id), ['season_diamond_node', 'perfect_circle']);
  assert.ok(vm.achievementClass(vm.earnedAchievements[0]).includes('run-achievement--season'));
});

test('run complete recap shows already-earned achievements without marking them new', () => {
  const vm = viewModel({
    gameRun: { endReason: 'max_losses' },
    gameRunResult: {
      season: {
        seasonId: 'season_1',
        runPoints: -4,
        totalPoints: 66,
        levelId: 'silver',
        leveledUp: false,
        leveledDown: true,
        levelChanged: true,
        breakdown: { winsPoints: 4, lossesPenalty: -3, clearBonus: 0, abandonPenalty: -5 }
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
  assert.equal(vm.formattedRunPoints, '-4');
  assert.equal(vm.runPointsTone, 'run-season-run-points--negative');
  assert.ok(vm.achievementClass(vm.earnedAchievements[0]).includes('run-achievement--earned'));
});

test('run complete achievement cards reveal after the section and then one by one', () => {
  const vm = viewModel({
    gameRun: { endReason: 'max_rounds' },
    gameRunResult: {
      achievements: [
        { id: 'season_gold_cap', isNew: true },
        { id: 'first_ring_crossed', isNew: false },
        { id: 'deep_run', isNew: false }
      ],
      player: {
        completedRounds: 9,
        wins: 5,
        losses: 1,
        livesRemaining: 4
      }
    },
    bootstrap: { activeMushroomId: 'thalla' },
    lang: 'en'
  });

  assert.equal(vm.achievementRevealDelay(0), '760ms');
  assert.equal(vm.achievementRevealDelay(1), '940ms');
  assert.equal(vm.achievementRevealDelay(2), '1120ms');
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

    assert.equal(calls.length, 3);
    assert.ok(calls.every((call) => call.url === '/api/client-events'));
    assert.ok(calls.some((call) => JSON.parse(call.options.body).event === 'season_rank_change'));
    assert.ok(calls.some((call) => JSON.parse(call.options.body).event === 'season_tier_up'));
    assert.ok(calls.some((call) => JSON.parse(call.options.body).event === 'achievement_unlock'));
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.window = oldWindow;
    globalThis.CustomEvent = oldCustomEvent;
  }
});
