import assert from 'node:assert/strict';
import test from 'node:test';
import { useCustomization } from '../../web/src/composables/useCustomization.js';

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

test('useCustomization rolls asset packs through the shared route client', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const state = {
    sessionKey: 'session_abc',
    assetRollStatus: '',
    assetRollResult: null,
    assetRollErrorMessage: '',
    error: ''
  };
  let refreshCount = 0;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({
      success: true,
      data: {
        roll: { id: 'roll_1' },
        rollResult: { assetId: 'portrait.axilin.1', rarity: 'rare' }
      }
    });
  };

  try {
    const customization = useCustomization(state, async () => {
      refreshCount += 1;
    });
    await customization.rollAssetPack({ packId: 'season 1' });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(calls[0].url, '/api/assets/packs/season%201/roll');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['X-Session-Key'], 'session_abc');
  assert.ok(String(calls[0].init.headers['Idempotency-Key']).startsWith('asset-roll:'));
  assert.equal(calls[0].init.body, undefined);
  assert.equal(state.assetRollStatus, 'success');
  assert.deepEqual(state.assetRollResult, { assetId: 'portrait.axilin.1', rarity: 'rare' });
  assert.equal(refreshCount, 1);
});

test('useCustomization loads wallet bundles and opens web checkout through shared state helpers', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const calls = [];
  const opened = [];
  const state = {
    sessionKey: 'session_wallet',
    walletBundles: [],
    walletBundlesLoading: false,
    walletBundlesSurface: '',
    walletPurchaseStatus: '',
    error: ''
  };
  globalThis.window = {
    open(url, target, features) {
      opened.push({ url, target, features });
    }
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.startsWith('/api/wallet/bundles')) {
      return jsonResponse({
        success: true,
        data: [{ id: 'coins_small', provider: 'btcpay' }]
      });
    }
    return jsonResponse({
      success: true,
      data: {
        checkout: { checkoutUrl: 'https://checkout.example/pay' }
      }
    });
  };

  try {
    const customization = useCustomization(state, async () => {});
    await customization.loadWalletBundles({ surface: 'web' });
    await customization.purchaseWalletCoins({
      bundleId: 'coins_small',
      provider: 'btcpay',
      surface: 'web'
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }

  assert.equal(calls[0].url, '/api/wallet/bundles?surface=web');
  assert.equal(state.walletBundlesLoading, false);
  assert.deepEqual(state.walletBundles, [{ id: 'coins_small', provider: 'btcpay' }]);
  assert.equal(state.walletBundlesSurface, 'web');
  assert.equal(calls[1].url, '/api/wallet/purchase-intents');
  assert.equal(JSON.parse(calls[1].init.body).provider, 'btcpay');
  assert.equal(state.walletPurchaseStatus, 'opened');
  assert.deepEqual(opened, [{
    url: 'https://checkout.example/pay',
    target: '_blank',
    features: 'noopener,noreferrer'
  }]);
});
