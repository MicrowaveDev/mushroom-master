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

  function defaultPaymentSurface() {
    return globalThis.Telegram?.WebApp ? 'telegram_mini_app' : 'web';
  }

  function statusFromWalletIntent(intent) {
    const status = String(intent?.status || '').toLowerCase();
    const checkoutStatus = String(intent?.checkoutStatus || '').toLowerCase();
    if (status === 'completed') return 'confirmed';
    if (status === 'expired' || checkoutStatus === 'expired') return 'expired';
    if (['failed', 'cancelled', 'refunded', 'reversed', 'chargeback'].includes(status) || checkoutStatus === 'failed') {
      return 'failed';
    }
    return '';
  }

  function statusFromTelegramInvoice(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'paid') return 'confirmed';
    if (normalized === 'pending') return 'pending';
    if (normalized === 'expired') return 'expired';
    if (['failed', 'cancelled'].includes(normalized)) return 'failed';
    return 'failed';
  }

  function statusFromAssetRollError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('no unowned assets')) return 'complete';
    if (message.includes('duplicate assets')) return 'burn_unavailable';
    if (message.includes('insufficient') || message.includes('not enough')) return 'insufficient';
    if (message.includes('disabled')) return 'disabled';
    if (message.includes('not active') || message.includes('inactive') || message.includes('expired')) return 'unavailable';
    if (message.includes('configuration is invalid')) return 'invalid';
    return 'failed';
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

  async function rollAssetPack({ packId }) {
    state.assetRollStatus = 'rolling';
    state.assetRollResult = null;
    state.assetRollErrorMessage = '';
    try {
      const result = await apiJson(`/api/assets/packs/${encodeURIComponent(packId)}/roll`, {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('asset-roll') }
      }, state.sessionKey);
      if (result?.roll) {
        state.assetRollResult = result.rollResult || null;
        state.assetRollStatus = 'success';
        await refreshBootstrap();
      } else {
        state.assetRollStatus = 'failed';
        state.assetRollErrorMessage = 'Failed to roll pack';
      }
    } catch (error) {
      state.assetRollStatus = statusFromAssetRollError(error);
      state.assetRollErrorMessage = error.message || 'Failed to roll pack';
      if (state.assetRollStatus === 'failed' || state.assetRollStatus === 'invalid') {
        state.error = state.assetRollErrorMessage;
      }
    }
  }

  async function burnAssetPack({ packId, ruleId = null }) {
    state.assetRollStatus = 'burning';
    state.assetRollResult = null;
    state.assetRollErrorMessage = '';
    try {
      const result = await apiJson(`/api/assets/packs/${encodeURIComponent(packId)}/burn`, {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('asset-burn') },
        body: JSON.stringify({ ruleId })
      }, state.sessionKey);
      if (result?.exchange) {
        state.assetRollResult = result.burnResult || null;
        state.assetRollStatus = 'burned';
        await refreshBootstrap();
      } else {
        state.assetRollStatus = 'failed';
        state.assetRollErrorMessage = 'Failed to burn duplicates';
      }
    } catch (error) {
      state.assetRollStatus = statusFromAssetRollError(error);
      state.assetRollErrorMessage = error.message || 'Failed to burn duplicates';
      if (state.assetRollStatus === 'failed' || state.assetRollStatus === 'invalid') {
        state.error = state.assetRollErrorMessage;
      }
    }
  }

  async function loadWalletBundles({ surface = defaultPaymentSurface() } = {}) {
    state.walletBundlesLoading = true;
    try {
      const search = new URLSearchParams({ surface });
      const result = await apiJson(`/api/wallet/bundles?${search.toString()}`, {}, state.sessionKey);
      state.walletBundles = Array.isArray(result) ? result : [];
      state.walletBundlesSurface = surface;
    } catch (error) {
      state.error = error.message || 'Failed to load wallet bundles';
    } finally {
      state.walletBundlesLoading = false;
    }
  }

  async function purchaseWalletCoins({
    bundleId = 'coins_small',
    provider = 'telegram_stars',
    surface = defaultPaymentSurface()
  } = {}) {
    try {
      state.walletPurchaseStatus = 'opening';
      const result = await apiJson('/api/wallet/purchase-intents', {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('wallet-purchase') },
        body: JSON.stringify({ bundleId, provider, surface })
      }, state.sessionKey);
      const intentStatus = statusFromWalletIntent(result);
      if (intentStatus) {
        state.walletPurchaseStatus = intentStatus;
        if (intentStatus === 'confirmed') await refreshBootstrap();
        return;
      }
      const checkout = result?.checkout || {};
      const telegramInvoice = checkout.invoiceLink && globalThis.Telegram?.WebApp?.openInvoice;
      if (telegramInvoice) {
        state.walletPurchaseStatus = 'opened';
        globalThis.Telegram.WebApp.openInvoice(checkout.invoiceLink, async (status) => {
          const invoiceStatus = statusFromTelegramInvoice(status);
          state.walletPurchaseStatus = invoiceStatus;
          if (invoiceStatus === 'confirmed') {
            await refreshBootstrap();
          }
        });
        return;
      }
      if (checkout.checkoutUrl && typeof window !== 'undefined') {
        window.open(checkout.checkoutUrl, '_blank', 'noopener,noreferrer');
        state.walletPurchaseStatus = 'opened';
        return;
      }
      state.walletPurchaseStatus = 'failed';
      state.error = checkout.setupRequired
        ? 'Wallet purchases are not configured yet'
        : 'Payment checkout is not available';
    } catch (error) {
      state.walletPurchaseStatus = 'failed';
      state.error = error.message || 'Failed to start wallet purchase';
    }
  }

  return {
    switchPortrait,
    switchPreset,
    purchasePortrait,
    rollAssetPack,
    burnAssetPack,
    loadWalletBundles,
    purchaseWalletCoins
  };
}
