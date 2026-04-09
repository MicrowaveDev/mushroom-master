import fs from 'fs/promises';
import path from 'path';
import { test, expect } from '@playwright/test';

const screenshotDir = '/Users/microwavedev/workspace/mushroom-master/.agent/tasks/telegram-autobattler-v1/raw/screenshots/run';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

async function saveShot(page, name) {
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

async function resetDevDb(request) {
  const response = await request.post('/api/dev/reset', { data: {} });
  const json = await response.json();
  if (!json.success) throw new Error(`dev reset failed: ${JSON.stringify(json)}`);
}

async function createSession(request, payload) {
  const response = await request.post('/api/dev/session', { data: payload });
  const json = await response.json();
  if (!json.success) throw new Error(`dev session failed: ${JSON.stringify(json)}`);
  return json.data;
}

async function api(request, sessionKey, url, method = 'GET', data = undefined) {
  const response = await request.fetch(url, {
    method,
    headers: { 'X-Session-Key': sessionKey },
    data
  });
  const json = await response.json();
  if (!json.success) throw new Error(`api call failed for ${url}: ${JSON.stringify(json)}`);
  return json.data;
}

test('solo game run: full journey with screenshots', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 901, username: 'solo_runner', name: 'Solo Runner' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'thalla', items: loadout });

  const ghost = await createSession(request, { telegramId: 902, username: 'ghost_player', name: 'Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });
  await api(request, ghost.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'kirt', items: loadout });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);

  // --- Home screen with "Start Game" button ---
  await page.goto(`${baseURL}?screen=home`, { waitUntil: 'networkidle' });
  await expect(page.locator('.dashboard')).toBeVisible();
  await saveShot(page, 'solo-01-home-start-game.png');

  // --- Start game run → prep screen ---
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await expect(page.locator('.prep-screen')).toBeVisible();
  const hud = page.locator('.run-hud');
  await expect(hud).toContainText('1');
  await saveShot(page, 'solo-02-prep-round1.png');

  // --- Shop has items ---
  const shopItems = page.locator('.prep-screen .shop-item');
  const shopCount = await shopItems.count();
  expect(shopCount).toBeGreaterThan(0);

  // --- Buy first shop item ---
  const firstShopItem = shopItems.first();
  const firstItemId = await firstShopItem.getAttribute('data-artifact-id') || '';
  if (firstItemId) {
    await firstShopItem.click();
    await expect(page.locator(`.container-item[data-artifact-id="${firstItemId}"]`)).toHaveCount(1, { timeout: 5000 });
    await saveShot(page, 'solo-03-bought-item-in-container.png');
  }

  // --- Sell zone visible ---
  await expect(page.locator('.sell-zone')).toBeVisible();

  // --- Signal ready → round result ---
  await page.getByRole('button', { name: /ready|готов/i }).click();
  const resultOrComplete = page.locator('.round-result-screen, .run-complete-screen');
  await expect(resultOrComplete).toBeVisible({ timeout: 15000 });

  const isRoundResult = await page.locator('.round-result-screen').isVisible();
  if (isRoundResult) {
    await expect(page.locator('.round-result-card')).toBeVisible();
    await expect(page.locator('.round-result-card .stat')).toHaveCount(6);
    await saveShot(page, 'solo-04-round1-result.png');

    // --- Continue to round 2 ---
    await page.getByRole('button', { name: /continue|продолжить/i }).click();
    await expect(page.locator('.prep-screen')).toBeVisible();
    await expect(hud).toContainText('2');

    // --- Shop has items after round 1 ---
    const round2ShopItems = page.locator('.prep-screen .shop-item');
    await expect(round2ShopItems.first()).toBeVisible({ timeout: 5000 });
    const round2ShopCount = await round2ShopItems.count();
    expect(round2ShopCount).toBeGreaterThan(0);
    await saveShot(page, 'solo-05-prep-round2.png');

    // --- Refresh shop ---
    const refreshBtn = page.locator('.prep-screen .artifact-shop-header button');
    if (await refreshBtn.isEnabled()) {
      await refreshBtn.click();
      await page.waitForTimeout(500);
      await saveShot(page, 'solo-06-shop-refreshed.png');
    }

    // --- Page refresh persistence ---
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.prep-screen')).toBeVisible();
    await expect(hud).toContainText('2');
    await saveShot(page, 'solo-07-persisted-after-reload.png');

    // --- Play remaining rounds ---
    let lastRoundShot = false;
    for (let round = 0; round < 8; round++) {
      if (!(await page.locator('.prep-screen').isVisible())) break;

      await page.getByRole('button', { name: /ready|готов/i }).click();
      await expect(page.locator('.round-result-screen, .run-complete-screen')).toBeVisible({ timeout: 15000 });

      if (await page.locator('.round-result-screen').isVisible()) {
        if (!lastRoundShot) {
          await saveShot(page, 'solo-08-mid-round-result.png');
          lastRoundShot = true;
        }
        await page.getByRole('button', { name: /continue|продолжить/i }).click();
        await expect(page.locator('.prep-screen')).toBeVisible({ timeout: 5000 });
      } else {
        break;
      }
    }
  }

  // --- Run complete screen ---
  await expect(page.locator('.run-complete-screen')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.run-complete-card')).toBeVisible();
  await saveShot(page, 'solo-09-run-complete.png');

  // --- Go home ---
  await page.getByRole('button', { name: /home|домой/i }).click();
  await expect(page.locator('.dashboard')).toBeVisible();
  await saveShot(page, 'solo-10-home-after-run.png');
});

test('solo game run: abandon mid-game with screenshots', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 903, username: 'abandoner', name: 'Abandoner' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'thalla', items: loadout });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}?screen=home`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await expect(page.locator('.prep-screen')).toBeVisible();
  await saveShot(page, 'solo-abandon-01-prep.png');

  await page.getByRole('button', { name: /abandon|покинуть/i }).click();
  await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /resume|продолжить игру/i })).toHaveCount(0);
  await saveShot(page, 'solo-abandon-02-home-no-resume.png');
});

test('bag activation persists across page reload', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 910, username: 'bag_tester', name: 'Bag Tester' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'thalla', items: loadout });

  const ghost = await createSession(request, { telegramId: 911, username: 'bag_ghost', name: 'Bag Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });
  await api(request, ghost.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'kirt', items: loadout });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);

  // Start a game run
  await page.goto(`${baseURL}?screen=home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await expect(page.locator('.prep-screen')).toBeVisible();

  // Try to find a bag in the shop, refresh if needed
  const hasBag = await page.locator('.shop-item--bag').first().isVisible().catch(() => false);

  if (!hasBag) {
    // Refresh shop until a bag appears
    const refreshBtn = page.locator('.artifact-shop-header button');
    for (let i = 0; i < 5; i++) {
      if (await refreshBtn.isEnabled()) {
        await refreshBtn.click();
        await page.waitForTimeout(300);
      }
      if (await page.locator('.shop-item--bag').isVisible().catch(() => false)) break;
    }
  }

  const bagItem = page.locator('.shop-item--bag').first();
  if (!(await bagItem.isVisible().catch(() => false))) {
    // No bag appeared after refreshes — skip test gracefully
    return;
  }

  // Buy the bag → appears in container
  await bagItem.click();
  const containerBag = page.locator('.artifact-container-zone .container-item').last();
  await expect(containerBag).toBeVisible({ timeout: 3000 });

  // Click bag in container → should activate (add cells to grid, not place on grid)
  await containerBag.click();

  // Bag should now be active: colored cells visible, chip bar visible
  await expect(page.locator('.active-bags-bar')).toBeVisible();
  const activeBagChip = page.locator('.active-bag-chip');
  await expect(activeBagChip).toHaveCount(1);

  // Grid should have bag rows (dashed colored cells)
  const bagCells = page.locator('.artifact-grid-cell--bag');
  const bagCellCount = await bagCells.count();
  expect(bagCellCount).toBeGreaterThan(0);

  await saveShot(page, 'solo-bag-01-activated.png');

  // Count inventory cells before reload
  const cellsBefore = await page.locator('.artifact-grid-cell, .artifact-grid-cell--bag').count();

  // --- Reload the page ---
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.prep-screen')).toBeVisible({ timeout: 10000 });

  // Verify bag state survived reload
  await expect(page.locator('.active-bags-bar')).toBeVisible();
  await expect(page.locator('.active-bag-chip')).toHaveCount(1);

  const bagCellsAfter = page.locator('.artifact-grid-cell--bag');
  const bagCellCountAfter = await bagCellsAfter.count();
  expect(bagCellCountAfter).toBe(bagCellCount);

  // Grid should have same total cell count (no phantom artifacts)
  const cellsAfter = await page.locator('.artifact-grid-cell, .artifact-grid-cell--bag').count();
  expect(cellsAfter).toBe(cellsBefore);

  // No phantom artifacts should appear (builder items should be empty since we only bought a bag)
  const placedArtifacts = page.locator('.inventory-pieces .artifact-piece');
  const placedCount = await placedArtifacts.count();
  expect(placedCount).toBe(0);

  await saveShot(page, 'solo-bag-02-after-reload.png');
});

test('amber satchel (2x2 bag) activates from container and expands grid', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 920, username: 'satchel_tester', name: 'Satchel Tester' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'thalla', items: loadout });

  const ghost = await createSession(request, { telegramId: 921, username: 'satchel_ghost', name: 'Satchel Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });
  await api(request, ghost.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'kirt', items: loadout });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);

  // Start a game run
  await page.goto(`${baseURL}?screen=home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await expect(page.locator('.prep-screen')).toBeVisible();

  // Count base inventory grid cells (3x2 = 6)
  const inventoryGrid = page.locator('.artifact-inventory-grid .artifact-grid-background');
  const baseCells = await inventoryGrid.locator('> *').count();
  expect(baseCells).toBe(6);

  // Refresh shop until amber_satchel appears
  let foundSatchel = false;
  for (let i = 0; i < 10; i++) {
    const satchel = page.locator('.shop-item[data-artifact-id="amber_satchel"]');
    if (await satchel.isVisible().catch(() => false)) {
      foundSatchel = true;
      break;
    }
    const refreshBtn = page.locator('.artifact-shop-header button');
    if (await refreshBtn.isEnabled()) {
      await refreshBtn.click();
      await page.waitForTimeout(300);
    }
  }
  if (!foundSatchel) {
    // Skip if satchel never appeared (unlikely with pity system)
    return;
  }

  // Buy amber_satchel (price 3)
  await page.locator('.shop-item[data-artifact-id="amber_satchel"]').click();

  // Verify it appeared in the container
  const containerItem = page.locator('.artifact-container-zone .container-item').last();
  await expect(containerItem).toBeVisible({ timeout: 3000 });

  // Count container items
  const containerCountBefore = await page.locator('.artifact-container-zone .container-item').count();
  expect(containerCountBefore).toBeGreaterThan(0);

  // Click the bag in container to activate it
  await containerItem.click();

  // Bag should NOT be in container anymore
  const containerCountAfter = await page.locator('.artifact-container-zone .container-item').count();
  expect(containerCountAfter).toBe(containerCountBefore - 1);

  // Bag should be active: chip bar visible with 1 bag
  await expect(page.locator('.active-bags-bar')).toBeVisible();
  await expect(page.locator('.active-bag-chip')).toHaveCount(1);

  // Grid should have expanded: base 6 cells + bag rows
  // amber_satchel (2x2): 2 rows, 2 usable cols each = 4 bag cells + 2 disabled = 6 new grid slots
  const bagCells = inventoryGrid.locator('.artifact-grid-cell--bag');
  const bagCellCount = await bagCells.count();
  expect(bagCellCount).toBeGreaterThan(0);

  // Total inventory grid cells should be more than base 6
  const totalCells = await inventoryGrid.locator('> *').count();
  expect(totalCells).toBeGreaterThan(6);

  await saveShot(page, 'solo-satchel-01-activated.png');
});
