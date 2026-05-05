import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStartParams, setScreenQuery } from '../../web/src/api.js';

test('run result routes carry the completed game run id and push browser history', () => {
  const oldWindow = globalThis.window;
  globalThis.window = {
    location: { pathname: '/run-complete/run_123' },
    history: {
      pushedPath: '',
      replacedPath: '',
      pushState(_state, _title, path) {
        this.pushedPath = path;
      },
      replaceState(_state, _title, path) {
        this.replacedPath = path;
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
    assert.equal(globalThis.window.history.pushedPath, '/run-complete/run_456');

    globalThis.window.location.pathname = '/home';
    setScreenQuery('runSummary', { gameRunId: 'run_789' }, { replaceHistory: true });
    assert.equal(globalThis.window.history.replacedPath, '/run-summary/run_789');

    globalThis.window.location.pathname = '/run-summary/run_789';
    assert.deepEqual(parseStartParams(), {
      screen: 'runSummary',
      challenge: null,
      replay: null,
      gameRunId: 'run_789'
    });
  } finally {
    globalThis.window = oldWindow;
  }
});
