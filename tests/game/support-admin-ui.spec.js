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

async function openGachaAdmin(page, baseURL) {
  await page.goto(`${baseURL}/support-admin`);
  await expect(page.getByTestId('support-admin-screen')).toBeVisible();
  await page.getByTestId('support-admin-gacha-tab').click();
  await expect(page.getByTestId('gacha-admin-auth')).toBeVisible();
  await page.getByTestId('gacha-token').fill('e2e-support');
  await page.getByTestId('gacha-actor').fill('e2e-gacha-ui');
  await page.getByTestId('gacha-load-catalog').click();
  await expect(page.getByTestId('gacha-season-plan')).toBeVisible();
  await expect(page.getByTestId('gacha-advanced-tools')).toBeVisible();
}

async function captureGachaConsole(page, name) {
  await expect(page.getByTestId('support-admin-screen')).toBeVisible();
  await expect(page.getByTestId('gacha-season-plan')).toBeVisible();
  await expect(page.getByTestId('gacha-advanced-tools')).toBeVisible();
  await assertImagesLoaded(page);
  await assertNoHorizontalOverflow(page);
  await captureScreenshot(page, screenshotDir, name);
}

async function replaceField(locator, value) {
  await locator.fill('');
  await locator.fill(value);
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

test('[Req 14-F] support admin gacha tab can author, validate, and publish a database pack', async ({ page, request, baseURL }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await resetDevDb(request);
  const player = await createSession(request, {
    telegramId: 9303,
    username: 'support_gacha_ui',
    name: 'Support Gacha UI',
    lang: 'en'
  });
  await installSession(page, player.sessionKey);

  await openGachaAdmin(page, baseURL);
  await page.getByTestId('gacha-advanced-tools').locator('summary').click();
  await expect(page.getByTestId('gacha-catalog')).toContainText('Assets');

  await page.getByTestId('gacha-season-id').fill('e2e_gacha_season');
  await page.getByTestId('gacha-season-name').fill('E2E Gacha Season');
  await page.getByTestId('gacha-season-starts').fill('2026-08-01T00:00:00.000Z');
  await page.getByTestId('gacha-season-ends').fill('2026-09-01T00:00:00.000Z');
  await page.getByTestId('gacha-save-season').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha season created.');

  await page.getByTestId('gacha-plan-season').selectOption('e2e_gacha_season');
  await page.getByTestId('gacha-plan-character').selectOption('thalla');
  await page.getByTestId('gacha-plan-rarity').selectOption('common');
  await replaceField(page.getByTestId('gacha-plan-weight'), '75');
  await page.getByTestId('gacha-plan-file-input').setInputFiles(path.join(repoRoot, 'web/public/portraits/thalla/1.jpg'));
  await page.getByTestId('gacha-plan-upload').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha plan image uploaded.');
  await expect(page.getByTestId('gacha-plan-items')).toContainText('planned_portrait.thalla');
  await expect(page.getByTestId('gacha-plan-coverage')).toContainText('1 / 5');
  await expect(page.getByTestId('gacha-plan-item-chance').first()).toContainText('100.0%');

  await page.getByTestId('gacha-plan-item-character').first().selectOption('axilin');
  await page.getByTestId('gacha-plan-item-rarity').first().selectOption('rare');
  await replaceField(page.getByTestId('gacha-plan-item-weight').first(), '25');
  await page.getByTestId('gacha-plan-item-status').first().selectOption('ready');
  await page.getByTestId('gacha-plan-item-save').first().click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha plan item updated.');
  await expect(page.getByTestId('gacha-plan-items')).toContainText('Axilin');

  await page.getByTestId('gacha-collection-id').fill('e2e_gacha_collection');
  await page.getByTestId('gacha-collection-name').fill('E2E Gacha Collection');
  await page.getByTestId('gacha-collection-starts').fill('2026-08-01T00:00:00.000Z');
  await page.getByTestId('gacha-collection-ends').fill('2026-09-01T00:00:00.000Z');
  await page.getByTestId('gacha-save-collection').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha collection created.');

  await page.getByTestId('gacha-pack-id').fill('e2e_gacha_pack');
  await page.getByTestId('gacha-pack-name').fill('E2E Gacha Pack');
  await page.getByTestId('gacha-pack-price').fill('33');
  await page.getByTestId('gacha-pack-roll-size').fill('2');
  await page.getByTestId('gacha-pack-starts').fill('2026-08-01T00:00:00.000Z');
  await page.getByTestId('gacha-pack-ends').fill('2026-09-01T00:00:00.000Z');
  await page.getByTestId('gacha-pack-metadata').fill(JSON.stringify({
    disclosure: { en: 'Contains two cosmetic portraits with one rare slot.' }
  }, null, 2));
  await page.getByTestId('gacha-save-pack').click();
  await expect(page.getByTestId('gacha-packs-table')).toContainText('e2e_gacha_pack');
  await expect(page.getByTestId('gacha-validation')).toContainText('needs work');

  await page.getByTestId('gacha-item-asset').nth(0).fill('portrait.morga.default');
  await page.getByTestId('gacha-item-rarity').nth(0).selectOption('common');
  await replaceField(page.getByTestId('gacha-item-weight').nth(0), '100');
  await page.getByTestId('gacha-add-item').click();
  await page.getByTestId('gacha-item-asset').nth(1).fill('portrait.axilin.1');
  await page.getByTestId('gacha-item-rarity').nth(1).selectOption('rare');
  await replaceField(page.getByTestId('gacha-item-weight').nth(1), '30');
  await page.getByTestId('gacha-save-items').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha pack items saved.');

  await page.getByTestId('gacha-validate-pack').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha release preview passed.');
  await expect(page.getByTestId('gacha-validation')).toContainText('ok');
  await expect(page.getByTestId('gacha-validation')).toContainText('No validation issues.');
  await expect(page.getByTestId('gacha-release-checklist')).toContainText('ready');
  await expect(page.getByTestId('gacha-odds-preview')).toContainText('rare');
  await expect(page.getByTestId('gacha-simulation')).toContainText('Trials');
  await expect(page.getByTestId('gacha-policy-recommendations')).toContainText('portrait.axilin.1');

  await page.getByTestId('gacha-publish-pack').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha pack publish applied.');
  await expect(page.getByTestId('gacha-packs-table')).toContainText('approved');
  await expect(page.getByTestId('gacha-packs-table')).toContainText('active');

  await page.getByTestId('gacha-fixture-export').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha fixture exported.');
  await expect(page.getByTestId('gacha-fixture-json')).toHaveValue(/e2e_gacha_pack/);
  await page.getByTestId('gacha-fixture-allow-approved').check();
  await page.getByTestId('gacha-fixture-dry-run').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha fixture dry run complete.');
  await expect(page.getByTestId('gacha-fixture-result')).toContainText('dry run');
  await page.getByTestId('gacha-fixture-import').click();
  await expect(page.getByTestId('support-admin-status')).toContainText('Gacha fixture import applied.');
  await expect(page.getByTestId('gacha-fixture-result')).toContainText('applied');

  const seasonBox = await page.getByTestId('gacha-season-form').boundingBox();
  const collectionBox = await page.getByTestId('gacha-collection-form').boundingBox();
  expect(seasonBox).toBeTruthy();
  expect(collectionBox).toBeTruthy();
  expect(Math.abs(seasonBox.y - collectionBox.y)).toBeLessThan(24);
  expect(collectionBox.x).toBeGreaterThan(seasonBox.x + seasonBox.width * 0.75);

  await page.getByTestId('gacha-advanced-tools').locator('summary').click();
  await expect(page.getByTestId('gacha-catalog')).not.toBeVisible();
  await captureGachaConsole(page, '02i-support-admin-gacha-desktop.png');
  await page.setViewportSize(MOBILE_VIEWPORT);
  await captureGachaConsole(page, '02i-support-admin-gacha-mobile.png');
});
