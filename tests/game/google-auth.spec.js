import path from 'path';
import { test, expect } from '@playwright/test';
import { createBrowserSessionRedirectHtml } from '@microwavedev/backpack-game-core/server';
import { resetDevDb, createSession } from './e2e-helpers.js';
import { captureScreenshot, assertImagesLoaded, assertNoHorizontalOverflow } from './screenshot-capture.js';
import { repoRoot } from '../../app/shared/repo-root.js';

const shots = path.join(repoRoot, '.agent/tasks/google-auth/raw/screenshots');
const clientId = 'test.apps.googleusercontent.com';

async function setupGoogle(page, { enabled = true, fail = false } = {}) {
  await page.route('**/api/app-config', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    Object.assign(body.data, {
      localDevAuthEnabled: false,
      googleAuthEnabled: enabled, googleClientId: enabled ? clientId : '',
      googleLoginUri: `${new URL(route.request().url()).origin}/api/auth/google/callback`
    });
    await route.fulfill({ response, json: body });
  });
  await page.route('https://accounts.google.com/gsi/client*', (route) => fail
    ? route.abort()
    : route.fulfill({ contentType: 'text/javascript', body: `
      window.google = { accounts: { id: {
        initialize(config) { window.googleConfig = config; },
        renderButton(element) {
          const button = document.createElement('button');
          button.textContent = 'Sign in with Google';
          button.onclick = () => {
            const form = document.createElement('form');
            form.method = 'POST'; form.action = window.googleConfig.login_uri;
            document.body.appendChild(form); form.submit();
          };
          element.appendChild(button);
        }
      } } };
    ` }));
}

test('[Flow A] Google browser button and session handoff reach onboarding', async ({ page, request }) => {
  await resetDevDb(request);
  // The API tests independently cover verified Google credentials. This test
  // substitutes the external GIS provider and uses a real local session to
  // exercise redirect HTML, localStorage, bootstrap and onboarding together.
  const session = await createSession(request, { telegramId: 918273, username: 'google_journey' });
  await setupGoogle(page);
  await page.route('**/api/auth/google/callback', (route) => route.fulfill({
    contentType: 'text/html', body: createBrowserSessionRedirectHtml({
      appName: 'Mushroom Battles', sessionToken: session.sessionKey,
      storageKey: 'sessionKey', redirectPath: '/', nonce: 'test'
    })
  }));
  await page.goto('/');
  const google = page.getByTestId('google-sign-in');
  await expect(google.getByRole('button')).toBeVisible();
  expect(await page.evaluate(() => window.googleConfig)).toMatchObject({ client_id: clientId, ux_mode: 'redirect' });
  for (const [name, viewport] of [['mobile', { width: 375, height: 667 }], ['desktop', { width: 1280, height: 800 }]]) {
    await page.setViewportSize(viewport);
    await assertImagesLoaded(page);
    await assertNoHorizontalOverflow(page);
    for (const button of await page.locator('.auth-screen button').all()) await expect(button).toBeInViewport();
    await captureScreenshot(page, shots, `google-auth-${name}.png`, {
      description: 'Regular browser auth screen with stubbed GIS button, Telegram sign-in and language controls; external Google rendering is not covered.'
    });
  }
  await google.getByRole('button').click();
  await expect(page.locator('.onboarding-preview-portrait').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sessionKey'))).toBe(session.sessionKey);
  await page.reload();
  await expect(page.locator('.onboarding-preview-portrait').first()).toBeVisible();
});

test('[Flow A] Google disabled and Telegram contexts hide the Google button', async ({ page }) => {
  await setupGoogle(page, { enabled: false });
  await page.goto('/');
  await expect(page.locator('.auth-screen')).toBeVisible();
  await expect(page.getByTestId('google-sign-in')).toHaveCount(0);
  await page.unrouteAll({ behavior: 'wait' });
  await setupGoogle(page);
  await page.addInitScript(() => { window.Telegram = { WebApp: { initData: '', ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {} } }; });
  await page.reload();
  await expect(page.locator('.auth-screen')).toBeVisible();
  await expect(page.getByTestId('google-sign-in')).toHaveCount(0);
});

test('[Flow A] Google script failure leaves Telegram login available', async ({ page }) => {
  await setupGoogle(page, { fail: true });
  await page.goto('/');
  await expect(page.locator('.auth-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: /Telegram/i }).first()).toBeVisible();
  await expect(page.locator('body')).toContainText('Не удалось войти через Google');
});
