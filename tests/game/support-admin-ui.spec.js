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

async function lookupPlayer(page, playerId) {
  await page.getByTestId('support-token').fill('e2e-support');
  await page.getByTestId('support-actor').fill('e2e-support-ui');
  await page.getByTestId('support-query').fill(playerId);
  await page.getByTestId('support-lookup-submit').click();
  await expect(page.getByTestId('support-counts')).toBeVisible();
}

async function captureSupportConsole(page, name) {
  await expect(page.getByTestId('support-admin-screen')).toBeVisible();
  await expect(page.getByTestId('support-wallet-form')).toBeVisible();
  await assertImagesLoaded(page);
  await assertNoHorizontalOverflow(page);
  await captureScreenshot(page, screenshotDir, name);
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
