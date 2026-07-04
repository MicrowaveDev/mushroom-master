import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assetRollErrorViewState,
  assetRollPendingViewState,
  assetRollResultViewState,
  assetRollStatusFromError,
  walletPurchaseCheckoutViewState,
  walletPurchaseIntentViewState,
  walletPurchaseOpeningViewState,
  walletPurchaseStatusFromIntent,
  walletPurchaseStatusFromTelegramInvoice
} from '@microwavedev/backpack-game-core/client-view-model';

test('customization flows use shared wallet and roll status contracts', () => {
  assert.equal(walletPurchaseStatusFromIntent({ status: 'completed' }), 'confirmed');
  assert.equal(walletPurchaseStatusFromIntent({ checkoutStatus: 'expired' }), 'expired');
  assert.equal(walletPurchaseStatusFromIntent({ status: 'chargeback' }), 'failed');
  assert.equal(walletPurchaseStatusFromTelegramInvoice('paid'), 'confirmed');
  assert.equal(walletPurchaseStatusFromTelegramInvoice('cancelled'), 'failed');

  assert.equal(assetRollStatusFromError(new Error('No unowned assets left')), 'complete');
  assert.equal(assetRollStatusFromError(new Error('Duplicate assets are unavailable')), 'burn_unavailable');
  assert.equal(assetRollStatusFromError(new Error('Not enough soft_coin')), 'insufficient');
  assert.equal(assetRollStatusFromError(new Error('Gacha is disabled')), 'disabled');
  assert.equal(assetRollStatusFromError(new Error('Configuration is invalid')), 'invalid');
});

test('customization flows use shared wallet and roll mutation view-state contracts', () => {
  assert.equal(walletPurchaseOpeningViewState().status, 'opening');
  assert.deepEqual(walletPurchaseIntentViewState({ status: 'completed' }), {
    status: 'confirmed',
    handled: true,
    shouldRefresh: true
  });
  assert.equal(walletPurchaseCheckoutViewState({ hasWebCheckout: true }).status, 'opened');

  assert.deepEqual(assetRollPendingViewState({ status: 'burning' }), {
    status: 'burning',
    result: null,
    errorMessage: '',
    globalErrorMessage: ''
  });
  assert.equal(assetRollResultViewState({
    exchange: { id: 'burn_1' },
    burnResult: { assetId: 'portrait.axilin.1' }
  }, {
    successKey: 'exchange',
    resultKey: 'burnResult',
    successStatus: 'burned'
  }).status, 'burned');
  assert.equal(assetRollErrorViewState(new Error('Configuration is invalid')).globalErrorMessage, 'Configuration is invalid');
});
