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

test('[telegram-auth] no initData starts bot-code login and can cancel it', async () => {
  const originalFetch = globalThis.fetch;
  const originalOpen = globalThis.open;
  const opened = [];
  const requests = [];

  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    assert.equal(path, '/api/auth/telegram/code');
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

  try {
    const state = makeState();
    const auth = useAuth(state, null, {
      getWebApp: () => null,
      applyTelegramTheme() {},
      syncViewportVars() {}
    });

    await auth.loginViaTelegram();

    assert.equal(requests.length, 1);
    assert.equal(state.authCode.privateCode, 'private-code');
    assert.deepEqual(opened, ['https://t.me/MushroomBattlesBot?start=auth-public-code']);

    auth.cancelTelegramCodeLogin();
    assert.equal(state.authCode, null);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.open = originalOpen;
  }
});
