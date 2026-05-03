import assert from 'node:assert/strict';
import test from 'node:test';
import { PORTRAIT_VARIANTS } from '../../app/server/game-data.js';
import {
  defaultReplayPortraitConfig,
  replayPortraitConfig,
  replayPortraitConfigByMushroom
} from '../../web/src/replay-portrait-config.js';

const REQUIRED_FIELDS = ['top', 'insetLeft', 'insetRight', 'tailLeft', 'imagePosition'];

test('replay portrait config covers every character portrait variant', () => {
  for (const [mushroomId, variants] of Object.entries(PORTRAIT_VARIANTS)) {
    const config = replayPortraitConfigByMushroom[mushroomId];
    assert.ok(config, `${mushroomId}: missing replay portrait config`);

    for (const variant of variants) {
      const layout = config[variant.id];
      assert.ok(layout, `${mushroomId}/${variant.id}: missing replay portrait config`);
      for (const field of REQUIRED_FIELDS) {
        assert.equal(typeof layout[field], 'string', `${mushroomId}/${variant.id}: ${field} must be a string`);
        assert.ok(layout[field].length > 0, `${mushroomId}/${variant.id}: ${field} must not be empty`);
      }
      assert.equal(typeof layout.headX, 'number', `${mushroomId}/${variant.id}: headX must be numeric`);
      assert.equal(typeof layout.headY, 'number', `${mushroomId}/${variant.id}: headY must be numeric`);
      assert.ok(layout.headX > 0 && layout.headX < 100, `${mushroomId}/${variant.id}: headX must be a percent inside the portrait`);
      assert.ok(layout.headY > 0 && layout.headY < 100, `${mushroomId}/${variant.id}: headY must be a percent inside the portrait`);
    }
  }
});

test('replayPortraitConfig falls back to the character default, then global default', () => {
  assert.equal(replayPortraitConfig('thalla', 'missing'), replayPortraitConfigByMushroom.thalla.default);
  assert.equal(replayPortraitConfig('unknown', 'default'), defaultReplayPortraitConfig);
});
