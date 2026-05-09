import { test, expect } from '@playwright/test';
import { api, createSession, resetDevDb, waitForPrepReady, MOBILE_VIEWPORT } from './e2e-helpers.js';

test('[fusion] prep highlights ingredients and next shop entry reveals fused result', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  await page.setViewportSize(MOBILE_VIEWPORT);

  const player = await createSession(request, {
    telegramId: 9401,
    username: 'fusion_ui',
    name: 'Fusion UI'
  });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  const run = await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });

  await api(request, player.sessionKey, `/api/dev/game-run/${run.id}/force-shop`, 'POST', {
    artifactIds: ['sporeblade', 'mirrorloop_knot']
  });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/prep`, { waitUntil: 'networkidle' });
  await waitForPrepReady(page);

  await page.locator('.shop-item[data-artifact-id="sporeblade"]').click();
  await page.locator('.shop-item[data-artifact-id="mirrorloop_knot"]').click();

  await expect(page.locator('.container-item--fusion-pending')).toHaveCount(2);
  await expect(page.locator('.container-item--fusion-pending[data-artifact-id="sporeblade"]')).toBeVisible();
  await expect(page.locator('.container-item--fusion-pending[data-artifact-id="mirrorloop_knot"]')).toBeVisible();

  await page.getByRole('button', { name: /ready|готов/i }).click();
  const replayContinue = page.locator('.replay-result-button-full');
  await expect(replayContinue).toBeVisible({ timeout: 30000 });
  await replayContinue.click();

  await waitForPrepReady(page);
  await expect(page.locator('.fusion-reveal')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="portal_cut_sickle"]')).toBeVisible();
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="sporeblade"]')).toHaveCount(0);
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="mirrorloop_knot"]')).toHaveCount(0);
});
