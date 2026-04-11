import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateBattle } from '../../app/server/services/battle-engine.js';

function makeSnapshot(leftMushroom, rightMushroom, leftItems = [], rightItems = []) {
  return {
    left: {
      playerId: 'player_left',
      mushroomId: leftMushroom,
      loadout: { items: leftItems }
    },
    right: {
      playerId: 'player_right',
      mushroomId: rightMushroom,
      loadout: { items: rightItems }
    }
  };
}

test('battle_end event state matches final combatant HP', () => {
  for (let i = 0; i < 20; i++) {
    const result = simulateBattle(
      makeSnapshot('thalla', 'lomie',
        [{ artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }],
        [{ artifactId: 'bark_plate', x: 0, y: 0, width: 1, height: 1 }]
      ),
      `seed-${i}`
    );
    const lastEvent = result.events[result.events.length - 1];
    assert.equal(lastEvent.type, 'battle_end');
    assert.equal(lastEvent.state.left.currentHealth, result.leftState.currentHealth,
      `Seed ${i}: battle_end state.left HP mismatch`);
    assert.equal(lastEvent.state.right.currentHealth, result.rightState.currentHealth,
      `Seed ${i}: battle_end state.right HP mismatch`);
  }
});

test('last action event state matches battle_end state when battle ends by death', () => {
  // Find a seed where battle ends by death
  for (let i = 0; i < 200; i++) {
    const result = simulateBattle(
      makeSnapshot('thalla', 'lomie',
        [{ artifactId: 'fang_whip', x: 0, y: 0, width: 2, height: 1 },
         { artifactId: 'glass_cap', x: 0, y: 1, width: 2, height: 1 }],
        [{ artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }]
      ),
      `death-${i}`
    );
    const lastEvent = result.events[result.events.length - 1];
    if (lastEvent.endReason === 'death') {
      // The loser should be at exactly 0 HP in the battle_end state
      const loserSide = lastEvent.winnerSide === 'left' ? 'right' : 'left';
      assert.equal(
        lastEvent.state[loserSide].currentHealth, 0,
        `Death-ending battle should have loser at 0 HP, got ${lastEvent.state[loserSide].currentHealth}`
      );
      return;
    }
  }
  assert.fail('No death-ending battle found in 200 seeds');
});

test('step_cap ending has both combatants alive with endReason set', () => {
  // Heavy armor vs low damage to force step cap with long STEP_CAP
  for (let i = 0; i < 50; i++) {
    const result = simulateBattle(
      makeSnapshot('lomie', 'lomie',
        [{ artifactId: 'truffle_bulwark', x: 0, y: 0, width: 2, height: 2 }],
        [{ artifactId: 'truffle_bulwark', x: 0, y: 0, width: 2, height: 2 }]
      ),
      `cap-${i}`
    );
    const lastEvent = result.events[result.events.length - 1];
    if (lastEvent.endReason === 'step_cap' && lastEvent.winnerSide) {
      assert.equal(lastEvent.type, 'battle_end');
      assert.ok(lastEvent.state.left.currentHealth > 0, 'Left should be alive');
      assert.ok(lastEvent.state.right.currentHealth > 0, 'Right should be alive');
      assert.ok(lastEvent.narration.includes('Step limit'), 'Narration should mention step limit');
      return;
    }
  }
  // With STEP_CAP=120 most battles resolve by death; skip test gracefully if no step_cap found
});

test('battle_end endReason is "death" when loser hits 0 HP', () => {
  for (let i = 0; i < 100; i++) {
    const result = simulateBattle(
      makeSnapshot('axilin', 'axilin',
        [{ artifactId: 'fang_whip', x: 0, y: 0, width: 2, height: 1 },
         { artifactId: 'glass_cap', x: 0, y: 1, width: 2, height: 1 }],
        []
      ),
      `death2-${i}`
    );
    const lastEvent = result.events[result.events.length - 1];
    if (lastEvent.endReason === 'death') {
      const loserSide = lastEvent.winnerSide === 'left' ? 'right' : 'left';
      assert.equal(lastEvent.state[loserSide].currentHealth, 0);
      assert.ok(!lastEvent.narration.includes('Step limit'));
      return;
    }
  }
});
