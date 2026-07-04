import {
  assetRollErrorViewState,
  assetRollPendingViewState,
  assetRollResultViewState,
  walletPurchaseCheckoutViewState,
  walletPurchaseErrorViewState,
  walletPurchaseIntentViewState,
  walletPurchaseOpeningViewState,
  walletPurchaseStatusFromTelegramInvoice
} from '@microwavedev/backpack-game-core/client-view-model';
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

  function applyAssetRollViewState(viewState) {
    state.assetRollStatus = viewState.status;
    state.assetRollResult = viewState.result;
    state.assetRollErrorMessage = viewState.errorMessage;
    if (viewState.globalErrorMessage) state.error = viewState.globalErrorMessage;
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
    applyAssetRollViewState(assetRollPendingViewState({ status: 'rolling' }));
    try {
      const result = await apiJson(`/api/assets/packs/${encodeURIComponent(packId)}/roll`, {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('asset-roll') }
      }, state.sessionKey);
      const viewState = assetRollResultViewState(result, {
        successKey: 'roll',
        resultKey: 'rollResult',
        successStatus: 'success',
        failureMessage: 'Failed to roll pack'
      });
      applyAssetRollViewState(viewState);
      if (viewState.status === 'success') {
        await refreshBootstrap();
      }
    } catch (error) {
      applyAssetRollViewState(assetRollErrorViewState(error, {
        fallbackMessage: 'Failed to roll pack'
      }));
    }
  }

  async function burnAssetPack({ packId, ruleId = null }) {
    applyAssetRollViewState(assetRollPendingViewState({ status: 'burning' }));
    try {
      const result = await apiJson(`/api/assets/packs/${encodeURIComponent(packId)}/burn`, {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('asset-burn') },
        body: JSON.stringify({ ruleId })
      }, state.sessionKey);
      const viewState = assetRollResultViewState(result, {
        successKey: 'exchange',
        resultKey: 'burnResult',
        successStatus: 'burned',
        failureMessage: 'Failed to burn duplicates'
      });
      applyAssetRollViewState(viewState);
      if (viewState.status === 'burned') {
        await refreshBootstrap();
      }
    } catch (error) {
      applyAssetRollViewState(assetRollErrorViewState(error, {
        fallbackMessage: 'Failed to burn duplicates'
      }));
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
      state.walletPurchaseStatus = walletPurchaseOpeningViewState().status;
      const result = await apiJson('/api/wallet/purchase-intents', {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('wallet-purchase') },
        body: JSON.stringify({ bundleId, provider, surface })
      }, state.sessionKey);
      const intentViewState = walletPurchaseIntentViewState(result);
      if (intentViewState.handled) {
        state.walletPurchaseStatus = intentViewState.status;
        if (intentViewState.shouldRefresh) await refreshBootstrap();
        return;
      }
      const checkout = result?.checkout || {};
      const telegramInvoice = checkout.invoiceLink && globalThis.Telegram?.WebApp?.openInvoice;
      const webCheckout = checkout.checkoutUrl && typeof window !== 'undefined';
      const checkoutViewState = walletPurchaseCheckoutViewState({
        checkout,
        hasTelegramInvoice: Boolean(telegramInvoice),
        hasWebCheckout: Boolean(webCheckout)
      });
      if (telegramInvoice) {
        state.walletPurchaseStatus = checkoutViewState.status;
        globalThis.Telegram.WebApp.openInvoice(checkout.invoiceLink, async (status) => {
          const invoiceStatus = walletPurchaseStatusFromTelegramInvoice(status);
          state.walletPurchaseStatus = invoiceStatus;
          if (invoiceStatus === 'confirmed') {
            await refreshBootstrap();
          }
        });
        return;
      }
      if (webCheckout) {
        window.open(checkout.checkoutUrl, '_blank', 'noopener,noreferrer');
        state.walletPurchaseStatus = checkoutViewState.status;
        return;
      }
      state.walletPurchaseStatus = checkoutViewState.status;
      state.error = checkoutViewState.errorMessage;
    } catch (error) {
      const viewState = walletPurchaseErrorViewState(error);
      state.walletPurchaseStatus = viewState.status;
      state.error = viewState.errorMessage;
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
