import { apiJson } from '../api.js';

/**
 * Mushroom customization: portrait + preset switching.
 * Extracted from main.js to reduce setup() complexity.
 */
export function useCustomization(state, refreshBootstrap) {
  function mutationKey(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`;
    return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  }

  async function switchPortrait({ mushroomId, portraitId }) {
    try {
      const result = await apiJson(`/api/mushroom/${mushroomId}/portrait`, {
        method: 'PUT',
        body: JSON.stringify({ portraitId })
      }, state.sessionKey);
      if (result?.success) await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Failed to switch portrait';
    }
  }

  async function switchPreset({ mushroomId, presetId }) {
    try {
      const result = await apiJson(`/api/mushroom/${mushroomId}/preset`, {
        method: 'PUT',
        body: JSON.stringify({ presetId })
      }, state.sessionKey);
      if (result?.success) await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Failed to switch preset';
    }
  }

  async function purchasePortrait({ assetId }) {
    try {
      const result = await apiJson(`/api/assets/${encodeURIComponent(assetId)}/purchase`, {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('portrait-purchase') },
        body: JSON.stringify({ equip: true })
      }, state.sessionKey);
      if (result?.purchase) await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Failed to purchase portrait';
    }
  }

  return { switchPortrait, switchPreset, purchasePortrait };
}
