import assert from 'node:assert/strict';
import test from 'node:test';
import { useDevTools } from '../../web/src/composables/useDevTools.js';
import { useReplay } from '../../web/src/composables/useReplay.js';

function jsonResponse(payload) {
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
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

test('useReplay routes battle loading and speed persistence through the shared route client', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const state = {
    sessionKey: 'session_replay',
    lang: 'en',
    bootstrap: {
      settings: { lang: 'en', reducedMotion: false, battleSpeed: '1x', replaySpeed: 2 }
    },
    currentBattle: null,
    replayIndex: 0,
    replaySpeed: 2,
    replayTimer: null,
    error: ''
  };

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const data = url === '/api/battles/battle%201'
      ? { id: 'battle 1', events: [{ type: 'battle_start' }] }
      : { ok: true };
    return jsonResponse({ success: true, data });
  };

  try {
    const replay = useReplay(state, () => {}, () => null);
    await replay.loadReplay('battle 1', { navigate: false });
    replay.setReplaySpeed(4);
    await Promise.resolve();
    await Promise.resolve();
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.deepEqual(calls.map((call) => `${call.init.method} ${call.url}`), [
    'GET /api/battles/battle%201',
    'POST /api/settings'
  ]);
  assert.ok(calls.every((call) => call.init.headers['X-Session-Key'] === 'session_replay'));
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    lang: 'en',
    reducedMotion: false,
    battleSpeed: '1x',
    replaySpeed: 4
  });
  assert.equal(state.currentBattle.id, 'battle 1');
  assert.equal(state.bootstrap.settings.replaySpeed, 4);
});

test('useReplay applies shared playback state while keeping timers local', async () => {
  const previousWindow = globalThis.window;
  const previousClearInterval = globalThis.clearInterval;
  const previousFetch = globalThis.fetch;
  const intervals = [];
  const cleared = [];
  const calls = [];
  const events = Array.from({ length: 130 }, (_, index) => ({
    type: index === 129 ? 'battle_end' : 'action',
    state: { left: { currentHealth: 100 - index } }
  }));
  const state = {
    sessionKey: 'session_replay',
    lang: 'en',
    bootstrap: {
      settings: { lang: 'en', reducedMotion: false, battleSpeed: '1x', replaySpeed: 2 }
    },
    currentBattle: { id: 'battle_long', events },
    replayIndex: 0,
    replaySpeed: 2,
    replayTimer: null,
    error: ''
  };

  globalThis.window = {
    setInterval(fn, delay) {
      const id = `timer_${intervals.length + 1}`;
      intervals.push({ id, fn, delay });
      return id;
    }
  };
  globalThis.clearInterval = (id) => {
    cleared.push(id);
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({ success: true, data: { ok: true } });
  };

  try {
    const replay = useReplay(state, () => {}, () => null);
    replay.autoplayReplay();
    assert.equal(intervals[0].delay, 600);
    intervals[0].fn();
    assert.equal(state.replayIndex, 1);

    state.replayIndex = 44;
    replay.autoplayReplay();
    const boundaryTimer = intervals.at(-1);
    boundaryTimer.fn();
    assert.equal(state.replayIndex, 45);
    assert.equal(cleared.at(-1), boundaryTimer.id);
    assert.ok(intervals.at(-1).delay < boundaryTimer.delay, 'timer restarts faster after boost threshold');

    replay.setReplaySpeed(4);
    await Promise.resolve();
    await Promise.resolve();
  } finally {
    globalThis.window = previousWindow;
    globalThis.clearInterval = previousClearInterval;
    globalThis.fetch = previousFetch;
  }

  assert.equal(state.replaySpeed, 4);
  assert.equal(state.bootstrap.settings.replaySpeed, 4);
  assert.equal(calls.at(-1).url, '/api/settings');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
    lang: 'en',
    reducedMotion: false,
    battleSpeed: '1x',
    replaySpeed: 4
  });
});

test('useDevTools routes local lab and inventory review through the shared route client', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const state = {
    sessionKey: 'session_dev',
    localLabInput: 'battle fixture',
    localLab: [],
    inventoryReviewSamples: []
  };

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const data = url === '/api/local-tests/battle-narration'
      ? { results: [{ name: 'compact-ru', text: 'ok' }] }
      : [{ id: 'sample_1' }];
    return jsonResponse({ success: true, data });
  };

  try {
    const devTools = useDevTools(state);
    await devTools.runLocalLab();
    await devTools.loadInventoryReview();
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.deepEqual(calls.map((call) => `${call.init.method} ${call.url}`), [
    'POST /api/local-tests/battle-narration',
    'GET /api/dev/inventory-review'
  ]);
  assert.ok(calls.every((call) => call.init.headers['X-Session-Key'] === 'session_dev'));
  const labPayload = JSON.parse(calls[0].init.body);
  assert.equal(labPayload.fixtureNarration, 'battle fixture');
  assert.equal(labPayload.variants.length, 2);
  assert.deepEqual(state.localLab, [{ name: 'compact-ru', text: 'ok' }]);
  assert.deepEqual(state.inventoryReviewSamples, [{ id: 'sample_1' }]);
});
