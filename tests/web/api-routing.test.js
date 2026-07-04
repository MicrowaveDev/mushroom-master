import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMushroomGameApiClient,
  parseStartParams,
  parseTelegramGameContext,
  setScreenQuery
} from '../../web/src/api.js';

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

test('mushroom game API client unwraps envelopes and applies route auth', async () => {
  const calls = [];
  const client = createMushroomGameApiClient('session_123', {
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json' : null;
          }
        },
        async json() {
          return { success: true, data: { roll: { id: 'roll_1' } } };
        },
        async text() {
          return '';
        }
      };
    }
  });

  const result = await client.postRoute('assetPackRoll', { packId: 'season 1' }, undefined, {
    headers: { 'Idempotency-Key': 'roll-key' }
  });

  assert.deepEqual(result, { roll: { id: 'roll_1' } });
  assert.equal(calls[0].url, '/api/assets/packs/season%201/roll');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['X-Session-Key'], 'session_123');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'roll-key');
});
