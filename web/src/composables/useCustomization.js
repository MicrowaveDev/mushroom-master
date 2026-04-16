import { apiJson } from '../api.js';

/**
 * Mushroom customization: portrait + preset switching.
 * Extracted from main.js to reduce setup() complexity.
 */
export function useCustomization(state, refreshBootstrap) {
  async function switchPortrait({ mushroomId, portraitId }) {
    const result = await apiJson(`/api/mushroom/${mushroomId}/portrait`, {
      method: 'PUT',
      body: JSON.stringify({ portraitId })
    }, state.sessionKey);
    if (result?.success) await refreshBootstrap();
  }

  async function switchPreset({ mushroomId, presetId }) {
    const result = await apiJson(`/api/mushroom/${mushroomId}/preset`, {
      method: 'PUT',
      body: JSON.stringify({ presetId })
    }, state.sessionKey);
    if (result?.success) await refreshBootstrap();
  }

  return { switchPortrait, switchPreset };
}
