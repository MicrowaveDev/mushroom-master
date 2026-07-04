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
