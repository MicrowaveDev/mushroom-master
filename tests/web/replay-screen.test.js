import assert from 'node:assert/strict';
import test from 'node:test';
import { ReplayDetailScreen } from '@microwavedev/backpack-game-core/vue/pages';
import { ReplayScreen } from '../../web/src/pages/ReplayScreen.js';

function viewModel(state, extra = {}) {
  const wrapper = { t: extra.t || {} };
  const vm = {
    state,
    ...extra,
    t: ReplayScreen.computed.normalizedText.call(wrapper),
    getCharacter: extra.getMushroom,
    profileRewardKey: 'spore',
    progressionRewardKey: 'mycelium',
    progressionRewardIcon: '🍄',
    getSnapshotCharacterId: ReplayScreen.methods.snapshotMushroomId
  };
  for (const [key, method] of Object.entries(ReplayDetailScreen.methods)) {
    vm[key] = method.bind(vm);
  }
  for (const [key, getter] of Object.entries(ReplayDetailScreen.computed)) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  return vm;
}

test('[Req 13-A] replay screen wrapper delegates neutral page shell to core', () => {
  assert.equal(ReplayScreen.components.ReplayDetailScreen.name, 'ReplayDetailScreen');
  assert.match(ReplayScreen.template, /ReplayDetailScreen/);
  assert.match(ReplayScreen.template, /get-snapshot-character-id/);
  assert.match(ReplayDetailScreen.template, /#battle-stage/);
  assert.match(ReplayDetailScreen.template, /@select-log-row="selectReplayLogRow"/);
});

test('[Req 1-E, 13-B] replay rewards use fresh resolved run totals after terminal loss', () => {
  const vm = viewModel({
    gameRun: {
      status: 'completed',
      player: {
        wins: 3,
        livesRemaining: 1
      }
    },
    gameRunResult: {
      status: 'completed',
      endReason: 'max_losses',
      player: {
        wins: 3,
        losses: 5,
        livesRemaining: 0
      },
      lastRound: {
        outcome: 'loss'
      }
    }
  });

  assert.equal(vm.runWins, 3);
  assert.equal(vm.runLivesRemaining, 0);
});

test('[Req 13-B] replay rewards fall back to active run totals before result payload exists', () => {
  const vm = viewModel({
    gameRun: {
      status: 'active',
      player: {
        wins: 2,
        livesRemaining: 4
      }
    },
    gameRunResult: null
  });

  assert.equal(vm.runWins, 2);
  assert.equal(vm.runLivesRemaining, 4);
});

test('[Req 13-B] replay screen shapes result DTOs for the shared page shell', () => {
  const vm = viewModel({
    lang: 'en',
    replayIndex: 1,
    gameRun: { player: { wins: 2, livesRemaining: 3 } },
    gameRunResult: {
      lastRound: {
        outcome: 'win',
        rewards: { spore: 2, mycelium: 5 },
        ratingBefore: 100,
        ratingAfter: 112
      }
    },
    currentBattle: {
      snapshots: {
        left: { mushroomId: 'hero' },
        right: { mushroomId: 'rival', loadout: { items: [] } }
      },
      events: [
        { type: 'action', actorSide: 'left', targetSide: 'right', damage: 7, stunned: true },
        {
          type: 'action',
          actorSide: 'right',
          targetSide: 'left',
          damage: 3,
          artifactAttribution: { armor: [{ value: 2 }] }
        }
      ]
    }
  }, {
    t: {
      battleRecap: 'Battle recap',
      results: 'Results',
      roundWin: 'Round won',
      roundLoss: 'Round lost',
      outcomeDraw: 'Draw',
      spore: 'Spores',
      mycelium: 'Mycelium',
      rating: 'Rating',
      wins: 'Wins',
      lives: 'Lives',
      damageDealt: 'Damage dealt',
      stunsMade: 'Stuns',
      damageBlocked: 'Blocked'
    },
    battleStatusText: 'Victory!',
    replayFinished: true,
    visibleReplayEvents: [{ type: 'battle_end', display: { logText: 'Hero won' } }],
    formatDelta: (value) => (value > 0 ? `+${value}` : String(value)),
    getMushroom: (id) => ({ name: { en: id === 'rival' ? 'Rival' : 'Hero' } }),
    loadoutStatsText: () => '7 HP / 3 ATK'
  });

  assert.deepEqual(vm.resultHero, {
    tone: 'win',
    kicker: 'Battle recap',
    title: 'Round won',
    summary: 'Hero won'
  });
  assert.deepEqual(vm.rewardsPanel.stats.map((stat) => [stat.key, stat.label, stat.value, stat.className]), [
    ['profileCurrency', 'Spores', '+2', 'stat--pos'],
    ['progressionCurrency', 'Mycelium', '+5', 'stat--pos'],
    ['rating', 'Rating', '+12', 'stat--pos']
  ]);
  assert.deepEqual(vm.rewardsPanel.runStatus.map((item) => [item.key, item.value]), [
    ['wins', 2],
    ['lives', 3]
  ]);
  assert.equal(vm.rewardsPanel.opponentName, 'Rival');
  assert.deepEqual(vm.battleSummary.rows.map((row) => [row.side, row.metrics.map((metric) => metric.value)]), [
    ['left', [7, 1, 2]],
    ['right', [3, 0, 0]]
  ]);
});

test('replay log rows adapt visible events for the shared BattleLog component', () => {
  const vm = viewModel({ replayIndex: 2 }, {
    visibleReplayEvents: [
      { replayIndex: 2, display: { logText: 'Active hit' } },
      { replayIndex: 1, text: 'Previous step' }
    ]
  });

  assert.deepEqual(vm.replayLogRows.map((row) => [row.replayIndex, row.text, row.active]), [
    [2, 'Active hit', true],
    [1, 'Previous step', false]
  ]);
});
