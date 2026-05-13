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

  await expect(page.locator('.shop-item--fusion-candidate')).toHaveCount(2);
  await expect(page.locator('.shop-item--fusion-candidate[data-artifact-id="sporeblade"]')).toBeVisible();
  await expect(page.locator('.shop-item--fusion-candidate[data-artifact-id="mirrorloop_knot"]')).toBeVisible();
  const bottomRecipes = page.locator('.game-bottom-actions .home-action-btn--recipes.home-action-btn--fusion-candidate');
  await expect(bottomRecipes).toBeVisible();
  await bottomRecipes.click();
  await expect(page.getByTestId('sidebar-recipes-panel')).toBeVisible();
  await expect(page.locator('.home-sidebar-switcher .home-action-btn--recipes.home-action-btn--fusion-candidate')).toBeVisible();
  await page.locator('.home-social-close').click();
  await expect(page.getByTestId('sidebar-recipes-panel')).toHaveCount(0);

  const boughtBlade = await api(request, player.sessionKey, `/api/game-run/${run.id}/buy`, 'POST', {
    artifactId: 'sporeblade'
  });
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);
  await expect(page.locator('.container-item[data-artifact-id="sporeblade"]')).toBeVisible();
  await expect(page.locator('.container-item--fusion-pending, .container-item--fusion-candidate')).toHaveCount(0);
  await expect(page.locator('.shop-item--fusion-candidate')).toHaveCount(0);

  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', {
    items: [
      { id: boughtBlade.id, artifactId: 'sporeblade', x: 2, y: 0, width: 1, height: 1 }
    ]
  });
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);
  await expect(page.locator('.artifact-piece-wrap[data-artifact-id="sporeblade"]')).toBeVisible();
  await expect(page.locator('.shop-item--fusion-candidate[data-artifact-id="mirrorloop_knot"]')).toBeVisible();

  const boughtKnot = await api(request, player.sessionKey, `/api/game-run/${run.id}/buy`, 'POST', {
    artifactId: 'mirrorloop_knot'
  });
  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', {
    items: [
      { id: boughtBlade.id, artifactId: 'sporeblade', x: 2, y: 0, width: 1, height: 1 },
      { id: boughtKnot.id, artifactId: 'mirrorloop_knot', x: 2, y: 1, width: 1, height: 1 }
    ]
  });
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);

  await expect(page.locator('.container-item--fusion-pending')).toHaveCount(0);
  await expect(page.locator('.artifact-piece-wrap--fusion-pending[data-artifact-id="sporeblade"]')).toBeVisible();
  await expect(page.locator('.artifact-piece-wrap--fusion-pending[data-artifact-id="mirrorloop_knot"]')).toBeVisible();
  await expect(page.locator('.game-bottom-actions .home-action-btn--recipes.home-action-btn--fusion-candidate')).toBeVisible();

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
  await expect(page.locator('[data-testid="recipe-card"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="artifact-catalog-browser"]')).toBeVisible();
  await expect(page.locator('[data-testid="artifact-catalog-group"]')).toHaveCount(7);
  await expect(page.locator('[data-artifact-group="fusion"] .artifact-piece[data-artifact-id="portal_cut_sickle"]')).toBeVisible();
  await expect(page.locator('[data-artifact-group="fusion"] .artifact-piece[data-artifact-id="riftfang_comet"]')).toBeVisible();
  await expect(page.locator('[data-artifact-group="fusion"] .artifact-piece[data-artifact-id="biostasis_crown_seed"]')).toBeVisible();
  await expect(page.locator('[data-artifact-group="fusion"] .artifact-piece[data-artifact-id="reliquary_ash_crown"]')).toBeVisible();
  await expect(page.locator('[data-artifact-group="fusion"] .artifact-piece[data-artifact-id="portal_vinegar_lens"]')).toBeVisible();
  await expect(page.locator('[data-artifact-group="fusion"] .artifact-piece[data-artifact-id="golden_thorn_aegis"]')).toBeVisible();

  const selectedDetail = page.locator('[data-testid="artifact-catalog-detail"]');
  await expect(selectedDetail).toHaveCSS('display', 'none');
  await page.locator('[data-artifact-group="fusion"] .artifact-piece[data-artifact-id="portal_cut_sickle"]').click();
  await expect(page.locator('[data-testid="artifact-catalog-detail"][data-artifact-id="portal_cut_sickle"]')).toBeVisible();
  await expect(page.locator('[data-testid="artifact-catalog-selected-recipe"][data-selected-result-artifact-id="portal_cut_sickle"]')).toBeVisible();
  await expect(page.locator('[data-testid="artifact-catalog-detail"] .artifact-stat-summary .artifact-role-glyph--damage')).toBeVisible();
  await expect(page.locator('[data-testid="artifact-catalog-detail"] .artifact-inventory-stat-chip')).toHaveCount(3);
  await expect(page.locator('[data-testid="artifact-catalog-detail"] .artifact-inventory-stat-chip--positive')).toHaveCount(2);
  await expect(page.locator('[data-testid="artifact-catalog-detail"] .artifact-inventory-stat-chip--negative')).toHaveCount(1);
  await expect(page.locator('[data-testid="artifact-catalog-detail"] .artifact-inventory-stat-chip--zero')).toHaveCount(0);
});

test('[fusion] local animation lab demonstrates every recipe with the production reveal', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  await page.setViewportSize(DESKTOP_VIEWPORT);

  const player = await createSession(request, {
    telegramId: 9410,
    username: 'fusion_animation_lab',
    name: 'Fusion Animation Lab'
  });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/fusion-lab`, { waitUntil: 'networkidle' });

  await expect(page.getByTestId('fusion-lab-screen')).toBeVisible();
  await expect(page.getByTestId('fusion-lab-recipe-card')).toHaveCount(15);
  await expect(page.locator('.fusion-lab-list .artifact-grid-board--catalog')).toHaveCount(45);
  await expect(page.locator('.fusion-lab-stage-card[data-result-artifact-id="portal_cut_sickle"]')).toBeVisible();

  await page.getByTestId('fusion-lab-play-all').click();
  await expect(page.locator('.fusion-reveal')).toBeVisible({ timeout: 1500 });
  await expect(page.locator('.fusion-lab-card--active[data-result-artifact-id="memory_flash_tendon"]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.fusion-reveal')).toHaveCount(0, { timeout: 4000 });

  await page.locator('.fusion-lab-card[data-result-artifact-id="riftfang_comet"]').click();
  await expect(page.locator('.fusion-reveal')).toBeVisible({ timeout: 1500 });
  await expect(page.locator('.fusion-lab-stage-card[data-result-artifact-id="riftfang_comet"]')).toBeVisible();
  const revealResultAspect = await page.locator('.fusion-reveal-result .artifact-figure-grid').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width / rect.height;
  });
  expect(revealResultAspect).toBeGreaterThan(1.7);
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
  await expect(page.getByTestId('sidebar-recipe-card')).toHaveCount(15);
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"]')).toBeVisible();
  await expect(page.locator('.home-sidebar-recipe-artifact[data-artifact-id="amber_fang"] .artifact-grid-board--catalog')).toBeVisible();
  await expect(page.locator('.home-sidebar-recipe-artifact[data-artifact-id="amber_fang"] [data-artifact-height="2"]')).toBeVisible();
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"] .artifact-stat-summary')).toBeVisible();
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"] .artifact-inventory-stat-chip')).toHaveCount(3);
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"] .artifact-stat-summary .artifact-role-glyph--damage')).toBeVisible();
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"] .artifact-stat-summary .artifact-inventory-stat-chip--positive')).toHaveCount(2);
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"] .artifact-stat-summary .artifact-inventory-stat-chip--negative')).toHaveCount(1);
  await expect(page.locator('[data-result-artifact-id="portal_cut_sickle"] .artifact-stat-summary .artifact-inventory-stat-chip--zero')).toHaveCount(0);
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

  await expect(page.getByTestId('sidebar-recipe-card')).toHaveCount(11);
});

test('[Req 11-F] mobile recipes sidebar switcher stays docked while recipes scroll', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  await page.setViewportSize(MOBILE_VIEWPORT);

  const player = await createSession(request, {
    telegramId: 9404,
    username: 'fusion_recipes_mobile_dock',
    name: 'Fusion Recipes Mobile Dock'
  });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'morga' });
  await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });

  await page.addInitScript((sessionKey) => {
    localStorage.setItem('sessionKey', sessionKey);
    localStorage.setItem('mobileHomeActionsMode', 'auto');
  }, player.sessionKey);
  await page.goto(`${baseURL}/prep`, { waitUntil: 'networkidle' });
  await waitForPrepReady(page);

  const bottomRecipes = page.locator('.game-bottom-actions.home-bottom-actions--visible .home-action-btn--recipes');
  await expect(bottomRecipes).toBeVisible();
  await bottomRecipes.click();

  await expect(page.getByTestId('sidebar-recipes-panel')).toBeVisible();
  await expect(page.getByTestId('sidebar-recipe-card')).toHaveCount(11);

  const dockMetrics = await page.evaluate(() => {
    const sidebar = document.querySelector('.home-social-sidebar');
    const switcher = document.querySelector('.home-sidebar-switcher--bottom');
    if (!sidebar || !switcher) throw new Error('recipes sidebar dock was not rendered');

    const before = switcher.getBoundingClientRect();
    sidebar.scrollTop = sidebar.scrollHeight;
    const after = switcher.getBoundingClientRect();
    return {
      sidebarContainsSwitcher: sidebar.contains(switcher),
      beforeTop: before.top,
      afterTop: after.top,
      afterBottom: after.bottom,
      viewportHeight: window.innerHeight
    };
  });

  expect(dockMetrics.sidebarContainsSwitcher).toBe(false);
  expect(Math.abs(dockMetrics.beforeTop - dockMetrics.afterTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(dockMetrics.afterBottom - dockMetrics.viewportHeight)).toBeLessThanOrEqual(1);
});
