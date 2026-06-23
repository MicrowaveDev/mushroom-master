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

  async function purchaseWalletCoins({
    bundleId = 'coins_small',
    provider = 'telegram_stars',
    surface = 'telegram_mini_app'
  } = {}) {
    try {
      const result = await apiJson('/api/wallet/purchase-intents', {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('wallet-purchase') },
        body: JSON.stringify({ bundleId, provider, surface })
      }, state.sessionKey);
      const checkout = result?.checkout || {};
      const telegramInvoice = checkout.invoiceLink && globalThis.Telegram?.WebApp?.openInvoice;
      if (telegramInvoice) {
        globalThis.Telegram.WebApp.openInvoice(checkout.invoiceLink, async (status) => {
          if (status === 'paid') await refreshBootstrap();
        });
        return;
      }
      if (checkout.checkoutUrl && typeof window !== 'undefined') {
        window.open(checkout.checkoutUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      state.error = checkout.setupRequired
        ? 'Wallet purchases are not configured yet'
        : 'Payment checkout is not available';
    } catch (error) {
      state.error = error.message || 'Failed to start wallet purchase';
    }
  }

  return { switchPortrait, switchPreset, purchasePortrait, purchaseWalletCoins };
}
