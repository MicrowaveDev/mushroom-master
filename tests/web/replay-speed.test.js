import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LONG_BATTLE_SPEED_BOOST_2X_INDEX,
  LONG_BATTLE_SPEED_BOOST_3X_INDEX,
  LONG_BATTLE_SPEED_BOOST_4X_INDEX,
  replayLongBattleSpeedBoost
} from '../../web/src/composables/useReplay.js';

test('long battle replay speed boost stays off for short battles', () => {
  assert.equal(replayLongBattleSpeedBoost(30, 29), 1);
  assert.equal(
    replayLongBattleSpeedBoost(LONG_BATTLE_SPEED_BOOST_2X_INDEX, LONG_BATTLE_SPEED_BOOST_2X_INDEX),
    1
  );
});

test('long battle replay speed boost advances from 2x to 4x as the replay drags on', () => {
  const longBattleEventCount = LONG_BATTLE_SPEED_BOOST_4X_INDEX + 12;

  assert.equal(replayLongBattleSpeedBoost(longBattleEventCount, LONG_BATTLE_SPEED_BOOST_2X_INDEX - 1), 1);
  assert.equal(replayLongBattleSpeedBoost(longBattleEventCount, LONG_BATTLE_SPEED_BOOST_2X_INDEX), 2);
  assert.equal(replayLongBattleSpeedBoost(longBattleEventCount, LONG_BATTLE_SPEED_BOOST_3X_INDEX - 1), 2);
  assert.equal(replayLongBattleSpeedBoost(longBattleEventCount, LONG_BATTLE_SPEED_BOOST_3X_INDEX), 3);
  assert.equal(replayLongBattleSpeedBoost(longBattleEventCount, LONG_BATTLE_SPEED_BOOST_4X_INDEX - 1), 3);
  assert.equal(replayLongBattleSpeedBoost(longBattleEventCount, LONG_BATTLE_SPEED_BOOST_4X_INDEX), 4);
});
