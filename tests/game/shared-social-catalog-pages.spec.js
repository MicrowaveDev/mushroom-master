import { expect, test } from '@playwright/test';
import { api, createSession, resetDevDb } from './e2e-helpers.js';

test('shared friends and recipes pages render through Mushroom adapters', async ({
  page,
  request,
  baseURL
}) => {
  await resetDevDb(request);
  const player = await createSession(request, {
    telegramId: 9911,
    username: 'shared_pages',
    name: 'Shared Pages'
  });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', {
    mushroomId: 'thalla'
  });
  const bootstrap = await api(request, player.sessionKey, '/api/bootstrap');
  await page.addInitScript(
    (sessionKey) => localStorage.setItem('sessionKey', sessionKey),
    player.sessionKey
  );

  await page.goto(`${baseURL}/friends`, { waitUntil: 'networkidle' });
  await expect(page.locator('.friends-panel')).toBeVisible();
  await expect(page.locator('.friends-code-value')).toHaveText(bootstrap.player.friendCode);
  await expect(page.locator('.home-friends-empty')).toBeVisible();

  await page.goto(`${baseURL}/recipes`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('recipes-screen')).toBeVisible();
  await expect(page.getByTestId('artifact-catalog-browser')).toBeVisible();
  await expect(page.getByTestId('artifact-catalog-group').first()).toBeVisible();
});
