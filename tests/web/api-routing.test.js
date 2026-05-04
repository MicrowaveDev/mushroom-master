import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStartParams, setScreenQuery } from '../../web/src/api.js';

test('runComplete route carries the completed game run id', () => {
  const oldWindow = globalThis.window;
  globalThis.window = {
    location: { pathname: '/runComplete/run_123' },
    history: {
      path: '',
      replaceState(_state, _title, path) {
        this.path = path;
      }
    }
  };

  try {
    assert.deepEqual(parseStartParams(), {
      screen: 'runComplete',
      challenge: null,
      replay: null,
      gameRunId: 'run_123'
    });

    setScreenQuery('runComplete', { gameRunId: 'run_456' });
    assert.equal(globalThis.window.history.path, '/runComplete/run_456');
  } finally {
    globalThis.window = oldWindow;
  }
});
