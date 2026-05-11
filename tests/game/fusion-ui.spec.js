import { test, expect } from '@playwright/test';
import { api, createSession, resetDevDb, waitForPrepReady, MOBILE_VIEWPORT, DESKTOP_VIEWPORT } from './e2e-helpers.js';

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
  const revealBlocksShop = await page.evaluate(() => {
    const top = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return !!top?.closest?.('.fusion-reveal');
  });
  expect(revealBlocksShop).toBe(true);
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="portal_cut_sickle"]')).toBeVisible();
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="sporeblade"]')).toHaveCount(0);
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="mirrorloop_knot"]')).toHaveCount(0);
});

test('[Req 11-F] sidebar recipes screen lists fusion artifacts', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  await page.setViewportSize(MOBILE_VIEWPORT);

  const player = await createSession(request, {
    telegramId: 9402,
    username: 'fusion_recipes',
    name: 'Fusion Recipes'
  });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'lomie' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });

  await page.locator('.menu-toggle').click();
  await page.locator('.nav-sidebar-list').getByRole('button', { name: /recipes|рецепты/i }).click();

  await expect(page.locator('.recipes-screen')).toBeVisible();
  await expect(page.locator('[data-testid="recipe-card"]')).toHaveCount(5);
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"]')).toBeVisible();
  await expect(page.locator('[data-result-artifact-id="riftfang_comet"]')).toBeVisible();
  await expect(page.locator('[data-result-artifact-id="biostasis_crown_seed"]')).toBeVisible();
  await expect(page.locator('.recipe-artifact-tile[data-artifact-id="amber_fang"]')).toBeVisible();
  await expect(page.locator('.recipe-artifact-tile[data-artifact-id="haste_wisp"]')).toBeVisible();
});

test('[Req 11-F] sidebar recipes are reachable from shop and battle screens', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  await page.setViewportSize(DESKTOP_VIEWPORT);

  const player = await createSession(request, {
    telegramId: 9403,
    username: 'fusion_recipes_runtime',
    name: 'Fusion Recipes Runtime'
  });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'morga' });
  await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/prep`, { waitUntil: 'networkidle' });
  await waitForPrepReady(page);

  const gameActionRail = page.locator('.game-social-action-rail');
  await expect(gameActionRail).toBeVisible();
  await expect(gameActionRail.locator('.home-action-btn--recipes')).toBeVisible();
  await gameActionRail.locator('.home-action-btn--recipes').click();

  const socialSidebar = page.locator('.home-social-sidebar');
  await expect(socialSidebar).toBeVisible();
  await expect(page.getByTestId('sidebar-recipes-panel')).toBeVisible();
  await expect(page.getByTestId('sidebar-recipe-card')).toHaveCount(5);
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"]')).toBeVisible();
  await page.locator('.home-social-close').click();
  await expect(socialSidebar).toHaveCount(0);

  await page.getByRole('button', { name: /ready|готов/i }).click();
  const replayContinue = page.locator('.replay-result-button-full');
  await expect(replayContinue).toBeVisible({ timeout: 30000 });

  await expect(gameActionRail).toBeVisible();
  await gameActionRail.locator('.home-action-btn--recipes').click();
  await expect(socialSidebar).toBeVisible();
  await expect(page.getByTestId('sidebar-recipes-panel')).toBeVisible();
  const sidebarStacksAboveBattleResult = await page.evaluate(() => {
    const sidebar = document.querySelector('.home-social-sidebar');
    const overlay = document.querySelector('.replay-result-overlay');
    const sidebarZ = Number.parseInt(getComputedStyle(sidebar).zIndex, 10);
    const overlayZ = Number.parseInt(getComputedStyle(overlay).zIndex, 10);
    return sidebarZ > overlayZ;
  });
  expect(sidebarStacksAboveBattleResult).toBe(true);

  await expect(page.getByTestId('sidebar-recipe-card')).toHaveCount(5);
});
