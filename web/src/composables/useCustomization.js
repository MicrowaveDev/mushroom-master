import {
  assetRollMutationErrorViewState,
  assetRollMutationResultViewState,
  assetRollPendingViewState,
  walletBundlesErrorViewState,
  walletBundlesLoadedViewState,
  walletBundlesLoadingViewState,
  walletPurchaseErrorViewState,
  walletPurchaseNextAction,
  walletPurchaseOpeningViewState,
  walletPurchaseStatusFromTelegramInvoice
} from '@microwavedev/backpack-game-core/client-view-model';
import { createMushroomGameApiClient } from '../api.js';

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

  function gameApi() {
    return createMushroomGameApiClient(state.sessionKey);
  }

  function applyAssetRollViewState(viewState) {
    state.assetRollStatus = viewState.status;
    state.assetRollResult = viewState.result;
    state.assetRollErrorMessage = viewState.errorMessage;
    if (viewState.globalErrorMessage) state.error = viewState.globalErrorMessage;
  }

  function applyWalletBundlesViewState(viewState) {
    state.walletBundlesLoading = viewState.loading;
    state.walletBundles = viewState.bundles;
    state.walletBundlesSurface = viewState.surface;
    if (viewState.errorMessage) state.error = viewState.errorMessage;
  }

  async function switchPortrait({ mushroomId, portraitId }) {
    try {
      const api = gameApi();
      const result = await api.request(api.routePath('switchPortrait', { mushroomId }), {
        method: 'PUT',
        body: { portraitId }
      });
      if (result?.success) await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Failed to switch portrait';
    }
  }

  async function switchPreset({ mushroomId, presetId }) {
    try {
      const api = gameApi();
      const result = await api.request(api.routePath('switchPreset', { mushroomId }), {
        method: 'PUT',
        body: { presetId }
      });
      if (result?.success) await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Failed to switch preset';
    }
  }

  async function purchasePortrait({ assetId }) {
    try {
      const api = gameApi();
      const result = await api.postRoute('purchaseAsset', { assetId }, { equip: true }, {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('portrait-purchase') }
      });
      if (result?.purchase) await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Failed to purchase portrait';
    }
  }

  async function rollAssetPack({ packId }) {
    applyAssetRollViewState(assetRollPendingViewState({ status: 'rolling' }));
    try {
      const api = gameApi();
      const result = await api.request(api.routePath('assetPackRoll', { packId }), {
        method: 'POST',
        headers: { 'Idempotency-Key': mutationKey('asset-roll') }
      });
      const viewState = assetRollMutationResultViewState(result, {
        successKey: 'roll',
        resultKey: 'rollResult',
        successStatus: 'success',
        failureMessage: 'Failed to roll pack'
      });
      applyAssetRollViewState(viewState);
      if (viewState.shouldRefresh) {
        await refreshBootstrap();
      }
    } catch (error) {
      applyAssetRollViewState(assetRollMutationErrorViewState(error, {
        fallbackMessage: 'Failed to roll pack'
      }));
    }
  }

  async function burnAssetPack({ packId, ruleId = null }) {
    applyAssetRollViewState(assetRollPendingViewState({ status: 'burning' }));
    try {
      const api = gameApi();
      const result = await api.postRoute('assetPackBurn', { packId }, { ruleId }, {
        headers: { 'Idempotency-Key': mutationKey('asset-burn') },
      });
      const viewState = assetRollMutationResultViewState(result, {
        successKey: 'exchange',
        resultKey: 'burnResult',
        successStatus: 'burned',
        failureMessage: 'Failed to burn duplicates'
      });
      applyAssetRollViewState(viewState);
      if (viewState.shouldRefresh) {
        await refreshBootstrap();
      }
    } catch (error) {
      applyAssetRollViewState(assetRollMutationErrorViewState(error, {
        fallbackMessage: 'Failed to burn duplicates'
      }));
    }
  }

  async function loadWalletBundles({ surface = defaultPaymentSurface() } = {}) {
    applyWalletBundlesViewState(walletBundlesLoadingViewState({ surface }));
    try {
      const result = await gameApi().getRoute('walletBundles', {}, { query: { surface } });
      applyWalletBundlesViewState(walletBundlesLoadedViewState(result, { surface }));
    } catch (error) {
      applyWalletBundlesViewState(walletBundlesErrorViewState(error, {
        surface,
        bundles: state.walletBundles
      }));
    }
  }

  async function purchaseWalletCoins({
    bundleId = 'coins_small',
    provider = 'telegram_stars',
    surface = defaultPaymentSurface()
  } = {}) {
    try {
      state.walletPurchaseStatus = walletPurchaseOpeningViewState().status;
      const result = await gameApi().postRoute('walletPurchaseIntents', {}, { bundleId, provider, surface }, {
        headers: { 'Idempotency-Key': mutationKey('wallet-purchase') },
      });
      const checkout = result?.checkout || {};
      const telegramInvoice = checkout.invoiceLink && globalThis.Telegram?.WebApp?.openInvoice;
      const webCheckout = checkout.checkoutUrl && typeof window !== 'undefined';
      const nextAction = walletPurchaseNextAction(result, {
        hasTelegramInvoice: Boolean(telegramInvoice),
        hasWebCheckout: Boolean(webCheckout)
      });
      state.walletPurchaseStatus = nextAction.status;
      if (nextAction.shouldRefresh) {
        await refreshBootstrap();
        return;
      }
      if (nextAction.action === 'telegram_invoice') {
        globalThis.Telegram.WebApp.openInvoice(nextAction.invoiceLink, async (status) => {
          const invoiceStatus = walletPurchaseStatusFromTelegramInvoice(status);
          state.walletPurchaseStatus = invoiceStatus;
          if (invoiceStatus === 'confirmed') {
            await refreshBootstrap();
          }
        });
        return;
      }
      if (nextAction.action === 'web_checkout') {
        window.open(nextAction.checkoutUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      state.error = nextAction.errorMessage;
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
