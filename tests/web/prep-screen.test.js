import assert from 'node:assert/strict';
import test from 'node:test';
import { PrepScreen } from '../../web/src/pages/PrepScreen.js';

test('[Req 4-A, 4-D] prep screen delegates neutral layout shell to core', () => {
  assert.equal(PrepScreen.components.CorePrepScreen.name, 'PrepScreen');
  assert.match(PrepScreen.template, /core-prep-screen/);
  assert.match(PrepScreen.template, /#hud/);
  assert.match(PrepScreen.template, /#loadout/);
  assert.match(PrepScreen.template, /#shop/);
  assert.match(PrepScreen.template, /#actions/);
  assert.match(PrepScreen.template, /#overlay/);
});
