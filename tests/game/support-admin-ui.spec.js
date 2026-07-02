import { test, expect } from '@playwright/test';
import path from 'path';
import {
  captureScreenshot,
  assertImagesLoaded,
  assertNoHorizontalOverflow
} from './screenshot-capture.js';
import { resetDevDb, createSession, MOBILE_VIEWPORT, DESKTOP_VIEWPORT } from './e2e-helpers.js';
import { repoRoot } from '../../app/shared/repo-root.js';

const screenshotDir = path.join(repoRoot, '.agent/tasks/telegram-autobattler-v1/raw/screenshots');

async function installSession(page, sessionKey) {
  await page.addInitScript((key) => {
    localStorage.setItem('sessionKey', key);
    localStorage.setItem('mushroomPreferredLang', 'en');
  }, sessionKey);
}

async function lookupSupport(page, query) {
  await page.getByTestId('support-token').fill('e2e-support');
  await page.getByTestId('support-actor').fill('e2e-support-ui');
  await page.getByTestId('support-query').fill(query);
  await page.getByTestId('support-lookup-submit').click();
  await expect(page.getByTestId('support-counts')).toBeVisible();
}

async function lookupPlayer(page, playerId) {
  await lookupSupport(page, playerId);
}

async function captureSupportConsole(page, name) {
  await expect(page.getByTestId('support-admin-screen')).toBeVisible();
  await expect(page.getByTestId('support-wallet-form')).toBeVisible();
  await expect(page.getByTestId('support-asset-form')).toBeVisible();
  await expect(page.getByTestId('support-refund-form')).toBeVisible();
  await assertImagesLoaded(page);
  await assertNoHorizontalOverflow(page);
  await captureScreenshot(page, screenshotDir, name);
}

async function createCompletedTelegramPurchase(request, sessionKey) {
  const intentResponse = await request.post('/api/wallet/purchase-intents', {
    headers: {
      'X-Session-Key': sessionKey,
      'idempotency-key': 'support-admin-ui-refund'
    },
    data: {
      bundleId: 'coins_small',
      provider: 'telegram_stars',
      surface: 'telegram_mini_app'
    }
  });
  expect(intentResponse.status()).toBe(200);
  const intentJson = await intentResponse.json();
  expect(intentJson.success).toBe(true);
  const intent = intentJson.data;

  const webhookResponse = await request.post('/api/bot/webhook', {
    data: {
      update_id: 930200,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        successful_payment: {
          currency: intent.priceCurrency,
          total_amount: intent.priceAmount,
          invoice_payload: intent.id,
          telegram_payment_charge_id: 'tg-support-admin-ui-refund'
        }
      }
    }
  });
  expect(webhookResponse.status()).toBe(200);
  const webhookJson = await webhookResponse.json();
  expect(webhookJson.success).toBe(true);
  expect(webhookJson.data.kind).toBe('wallet_payment');
  return intent;
}

test('[Req 4-Z] support admin UI can lookup and adjust profile wallet currency', async ({ page, request, baseURL }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await resetDevDb(request);
  const player = await createSession(request, {
    telegramId: 9301,
    username: 'support_wallet_ui',
    name: 'Support Wallet UI',
    lang: 'en'
  });
  await installSession(page, player.sessionKey);

  await page.goto(`${baseURL}/support-admin`);
  await expect(page.getByTestId('support-admin-screen')).toBeVisible();

  await lookupPlayer(page, player.player.id);
  await expect(page.locator(`[data-player-id="${player.player.id}"]`)).toBeVisible();
  await expect(page.getByTestId('support-selected-balance')).toContainText('0');

  await page.getByTestId('support-wallet-amount').fill('41');
  await page.getByTestId('support-wallet-reason').fill('e2e_support_grant');
  await page.getByTestId('support-wallet-note').fill('Playwright support admin grant');
  await page.getByTestId('support-wallet-submit').click();
  await expect(page.getByTestId('support-selected-balance')).toContainText('41');
  await expect(page.getByTestId('support-actions-table')).toContainText('wallet_grant');
  await expect(page.getByTestId('support-wallet-transactions')).toContainText('support_wallet_grant');

  await page.getByTestId('support-wallet-revoke-mode').click();
  await page.getByTestId('support-wallet-amount').fill('11');
  await page.getByTestId('support-wallet-reason').fill('e2e_support_revoke');
  await page.getByTestId('support-wallet-note').fill('Playwright support admin revoke');
  await page.getByTestId('support-wallet-submit').click();
  await expect(page.getByTestId('support-selected-balance')).toContainText('30');
  await expect(page.getByTestId('support-actions-table')).toContainText('wallet_revoke');
  await expect(page.getByTestId('support-wallet-transactions')).toContainText('support_wallet_revoke');

  await captureSupportConsole(page, '02g-support-admin-wallet-desktop.png');
  await page.setViewportSize(MOBILE_VIEWPORT);
  await captureSupportConsole(page, '02g-support-admin-wallet-mobile.png');
});

test('[Req 4-Z, 14-F] support admin UI can manage assets and refund purchases', async ({ page, request, baseURL }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await resetDevDb(request);
  const player = await createSession(request, {
    telegramId: 9302,
    username: 'support_asset_refund_ui',
    name: 'Support Asset Refund UI',
    lang: 'en'
  });
  await installSession(page, player.sessionKey);
  const completedIntent = await createCompletedTelegramPurchase(request, player.sessionKey);
  const assetId = 'portrait.axilin.1';

  await page.goto(`${baseURL}/support-admin`);
  await expect(page.getByTestId('support-admin-screen')).toBeVisible();
  await lookupSupport(page, completedIntent.id);
  await expect(page.getByTestId('support-purchase-intents')).toContainText(completedIntent.id);
  await expect(page.getByTestId('support-refund-intent-summary')).toContainText('completed');

  await page.getByTestId('support-refund-intent').selectOption(completedIntent.id);
  await page.getByTestId('support-refund-reason').fill('e2e_purchase_refund');
  await page.getByTestId('support-refund-note').fill('Playwright support admin refund');
  await page.getByTestId('support-refund-submit').click();
  await expect(page.getByTestId('support-purchase-intents')).toContainText('refunded');
  await expect(page.getByTestId('support-actions-table')).toContainText('purchase_refund');
  await expect(page.getByTestId('support-wallet-transactions')).toContainText('wallet_purchase_reversal');

  await lookupPlayer(page, player.player.id);
  await page.getByTestId('support-asset-id').fill(assetId);
  await page.getByTestId('support-asset-reason').fill('e2e_asset_grant');
  await page.getByTestId('support-asset-note').fill('Playwright support admin asset grant');
  await page.getByTestId('support-asset-submit').click();
  await expect(page.getByTestId('support-assets-table')).toContainText(assetId);
  await expect(page.getByTestId('support-assets-table')).toContainText('active');
  await expect(page.getByTestId('support-actions-table')).toContainText('asset_grant');

  const assetInstanceSelect = page.getByTestId('support-asset-instance');
  await expect(assetInstanceSelect.locator('option')).toHaveCount(2);
  const assetInstanceId = await assetInstanceSelect.locator('option').nth(1).getAttribute('value');
  expect(assetInstanceId).toBeTruthy();
  await assetInstanceSelect.selectOption(assetInstanceId);

  await page.getByTestId('support-asset-freeze-mode').click();
  await page.getByTestId('support-asset-reason').fill('e2e_asset_freeze');
  await page.getByTestId('support-asset-submit').click();
  await expect(page.getByTestId('support-assets-table')).toContainText('frozen');
  await expect(page.getByTestId('support-actions-table')).toContainText('asset_freeze');

  await page.getByTestId('support-asset-instance').selectOption(assetInstanceId);
  await page.getByTestId('support-asset-unfreeze-mode').click();
  await page.getByTestId('support-asset-reason').fill('e2e_asset_unfreeze');
  await page.getByTestId('support-asset-submit').click();
  await expect(page.getByTestId('support-assets-table')).toContainText('active');
  await expect(page.getByTestId('support-actions-table')).toContainText('asset_unfreeze');

  await page.getByTestId('support-asset-instance').selectOption(assetInstanceId);
  await page.getByTestId('support-asset-revoke-mode').click();
  await page.getByTestId('support-asset-reason').fill('e2e_asset_revoke');
  await page.getByTestId('support-asset-submit').click();
  await expect(page.getByTestId('support-assets-table')).toContainText('revoked');
  await expect(page.getByTestId('support-actions-table')).toContainText('asset_revoke');

  await captureSupportConsole(page, '02h-support-admin-ops-desktop.png');
  await page.setViewportSize(MOBILE_VIEWPORT);
  await captureSupportConsole(page, '02h-support-admin-ops-mobile.png');
});
