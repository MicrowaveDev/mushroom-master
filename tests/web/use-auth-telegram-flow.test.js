import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTelegramAuthVerificationResponse,
  readPreferredLanguage,
  useAuth,
  writePreferredLanguage
} from '../../web/src/composables/useAuth.js';

function makeState() {
  return {
    appConfig: { botUsername: 'MushroomBattlesBot' },
    authCode: null,
    error: '',
    lang: 'en',
    sessionKey: '',
    bootstrap: null,
    friends: [],
    leaderboard: [],
    wikiHome: null,
    builderItems: [],
    containerItems: [],
    activeBags: [],
    rotatedBags: [],
    freshPurchases: [],
    gameRun: null,
    gameRunResult: null,
    gameRunSummary: null,
    gameRunShopOffer: [],
    fusionRevealQueue: []
  };
}

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

function installBotCodeFetch({ assertPath = true } = {}) {
  const originalFetch = globalThis.fetch;
  const originalOpen = globalThis.open;
  const opened = [];
  const requests = [];

  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    if (assertPath) assert.equal(path, '/api/auth/telegram/code');
    return jsonResponse({
      success: true,
      data: {
        privateCode: 'private-code',
        publicCode: 'public-code',
        botUrl: 'https://t.me/MushroomBattlesBot?start=auth-public-code'
      }
    });
  };
  globalThis.open = (url) => opened.push(url);

  return {
    opened,
    requests,
    restore() {
      globalThis.fetch = originalFetch;
      globalThis.open = originalOpen;
    }
  };
}

function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test('[lang] preferred language storage validates supported locales', () => {
  const storage = createMemoryStorage();
  assert.equal(readPreferredLanguage(storage), null);
  assert.equal(writePreferredLanguage('en', storage), 'en');
  assert.equal(readPreferredLanguage(storage), 'en');
  assert.equal(writePreferredLanguage('de', storage), 'ru');
  assert.equal(readPreferredLanguage(storage), 'ru');
});

test('[telegram-auth] rate-limited verification remains a retryable poll result', () => {
  assert.deepEqual(
    normalizeTelegramAuthVerificationResponse(
      { status: 429 },
      { success: false, error: 'Too many requests' }
    ),
    {
      success: false,
      error: 'Too many requests',
      needsBotAuth: true
    }
  );
  assert.deepEqual(
    normalizeTelegramAuthVerificationResponse(
      { status: 400 },
      { success: false, error: 'Invalid code' }
    ),
    { success: false, error: 'Invalid code' }
  );
});

test('[telegram-auth] starts bot-code login and can cancel it', async () => {
  const authHarness = installBotCodeFetch();

  try {
    const state = makeState();
    const auth = useAuth(state, null, {
      getWebApp: () => null,
      applyTelegramTheme() {},
      syncViewportVars() {}
    });

    await auth.loginViaTelegram();

    assert.equal(authHarness.requests.length, 1);
    assert.equal(state.authCode.privateCode, 'private-code');
    assert.deepEqual(authHarness.opened, ['https://t.me/MushroomBattlesBot?start=auth-public-code']);

    auth.cancelTelegramCodeLogin();
    assert.equal(state.authCode, null);
  } finally {
    authHarness.restore();
  }
});

test('[telegram-auth] uses bot-code login even when Mini App initData exists', async () => {
  const authHarness = installBotCodeFetch();

  try {
    const state = makeState();
    const auth = useAuth(state, null, {
      getWebApp: () => ({ initData: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=abc' }),
      applyTelegramTheme() {},
      syncViewportVars() {}
    });

    await auth.loginViaTelegram();

    assert.equal(authHarness.requests.length, 1);
    assert.equal(authHarness.requests[0].path, '/api/auth/telegram/code');
    assert.equal(state.authCode.privateCode, 'private-code');
    assert.deepEqual(authHarness.opened, ['https://t.me/MushroomBattlesBot?start=auth-public-code']);
  } finally {
    authHarness.restore();
  }
});

test('[lang] refreshBootstrap keeps selected local language and persists over stale server setting', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  const localStorage = createMemoryStorage({ sessionKey: 'session-1', mushroomPreferredLang: 'ru' });
  const sessionStorage = createMemoryStorage();
  const requests = [];

  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = sessionStorage;
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    const payloads = {
      '/api/app-config': { localAiLabEnabled: false, localDevAuthEnabled: false },
      '/api/characters': { mushrooms: [] },
      '/api/artifacts': { artifacts: [] },
      '/api/bootstrap': {
        player: { id: 'player-1' },
        settings: { lang: 'en', reducedMotion: true, battleSpeed: '2x', replaySpeed: 4 },
        activeMushroomId: 'thalla',
        activeGameRun: null
      },
      '/api/friends': [],
      '/api/leaderboard': [],
      '/api/wiki/home': {}
    };
    if (path === '/api/settings') {
      return jsonResponse({ success: true, data: { ok: true } });
    }
    return jsonResponse({ success: true, data: payloads[path] });
  };

  try {
    const state = makeState();
    state.sessionKey = 'session-1';
    state.lang = 'ru';
    const auth = useAuth(state, () => {}, {
      getWebApp: () => null,
      applyTelegramTheme() {},
      syncViewportVars() {}
    });

    await auth.refreshBootstrap();

    assert.equal(state.lang, 'ru');
    const settingsRequest = requests.find((request) => request.path === '/api/settings');
    assert.ok(settingsRequest, 'stale server locale should be corrected');
    assert.equal(settingsRequest.options.headers['X-Session-Key'], 'session-1');
    assert.deepEqual(JSON.parse(settingsRequest.options.body), {
      lang: 'ru',
      reducedMotion: true,
      battleSpeed: '2x',
      replaySpeed: 4
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test('[auth-routes] saveCharacter uses the shared route client', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    return jsonResponse({ success: true, data: { ok: true } });
  };

  try {
    const state = makeState();
    state.sessionKey = 'session-2';
    state.bootstrap = {
      activeMushroomId: null,
      settings: { lang: 'en', reducedMotion: false, battleSpeed: '1x', replaySpeed: 2 }
    };
    const auth = useAuth(state, () => {}, {
      getWebApp: () => null,
      applyTelegramTheme() {},
      syncViewportVars() {}
    });

    assert.deepEqual(await auth.saveCharacter('thalla'), { wasFirstPick: true });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/api/active-character');
  assert.equal(requests[0].options.method, 'PUT');
  assert.equal(requests[0].options.headers['X-Session-Key'], 'session-2');
  assert.deepEqual(JSON.parse(requests[0].options.body), { mushroomId: 'thalla' });
});
