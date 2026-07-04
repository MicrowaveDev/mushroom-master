import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assetRollStatusFromError,
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
