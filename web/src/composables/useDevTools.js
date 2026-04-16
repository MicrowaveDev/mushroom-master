import { apiJson } from '../api.js';

/**
 * Dev-only helpers: AI lab and inventory review.
 * Extracted from main.js to reduce setup() complexity.
 */
export function useDevTools(state) {
  async function runLocalLab() {
    const results = await apiJson('/api/local-tests/battle-narration', {
      method: 'POST',
      body: JSON.stringify({
        fixtureNarration: state.localLabInput,
        variants: [
          { name: 'compact-ru', model: 'gpt-4.1-mini', prompt: 'Сделай короткое боевое описание на русском.' },
          { name: 'dramatic-en', model: 'gpt-4.1-mini', prompt: 'Write a dramatic but compact English battle recap.' }
        ]
      })
    }, state.sessionKey);
    state.localLab = results.results;
  }

  async function loadInventoryReview() {
    state.inventoryReviewSamples = await apiJson('/api/dev/inventory-review', {}, state.sessionKey);
  }

  return { runLocalLab, loadInventoryReview };
}
