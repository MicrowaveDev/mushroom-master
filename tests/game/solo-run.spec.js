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
