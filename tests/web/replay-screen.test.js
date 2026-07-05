import assert from 'node:assert/strict';
import test from 'node:test';
import { ReplayScreen } from '../../web/src/pages/ReplayScreen.js';

function viewModel(state, extra = {}) {
  const vm = { state, ...extra };
  for (const [key, getter] of Object.entries(ReplayScreen.computed)) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  return vm;
}

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
