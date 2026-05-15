import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStartParams, parseTelegramGameContext, setScreenQuery } from '../../web/src/api.js';

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
      gameRunId: 'run_123',
      profilePlayerId: null,
      telegramGameContext: null
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
      gameRunId: 'run_789',
      profilePlayerId: null,
      telegramGameContext: null
    });
  } finally {
    globalThis.window = oldWindow;
  }
});

test('telegram game launch context is parsed from callback URL params', () => {
  const params = new URLSearchParams(
    'tgGame=mushroom_master&tgChatInstance=chat-abc&tgGameChatId=-100123&tgGameMessageId=42'
  );
  assert.deepEqual(parseTelegramGameContext(params), {
    gameShortName: 'mushroom_master',
    chatInstance: 'chat-abc',
    chatId: '-100123',
    messageId: '42',
    inlineMessageId: null
  });
});
