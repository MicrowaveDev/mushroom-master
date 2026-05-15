import test from 'node:test';
import assert from 'node:assert/strict';
import { useAuth } from '../../web/src/composables/useAuth.js';

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

function installBotCodeFetch({ assertPath = true } = {}) {
  const originalFetch = globalThis.fetch;
  const originalOpen = globalThis.open;
  const opened = [];
  const requests = [];

  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    if (assertPath) assert.equal(path, '/api/auth/telegram/code');
    return {
      async json() {
        return {
          success: true,
          data: {
            privateCode: 'private-code',
            publicCode: 'public-code',
            botUrl: 'https://t.me/MushroomBattlesBot?start=auth-public-code'
          }
        };
      }
    };
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
