import { createMushroomGameApiClient } from '../api.js';

/**
 * Dev-only helpers: AI lab and inventory review.
 * Extracted from main.js to reduce setup() complexity.
 */
export function useDevTools(state) {
  function gameApi() {
    return createMushroomGameApiClient(state.sessionKey);
  }

  async function runLocalLab() {
    const results = await gameApi().postRoute('localBattleNarration', {}, {
      fixtureNarration: state.localLabInput,
      variants: [
        { name: 'compact-ru', model: 'gpt-4.1-mini', prompt: 'Сделай короткое боевое описание на русском.' },
        { name: 'dramatic-en', model: 'gpt-4.1-mini', prompt: 'Write a dramatic but compact English battle recap.' }
      ]
    });
    state.localLab = results.results;
  }

  async function loadInventoryReview() {
    state.inventoryReviewSamples = await gameApi().getRoute('devInventoryReview');
  }

  return { runLocalLab, loadInventoryReview };
}
