import { test, expect } from '@playwright/test';

const playerLoadout = [
  { artifactId: 'amber_fang', x: 0, y: 0, width: 1, height: 2 },
  { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 },
  { artifactId: 'shock_puff', x: 1, y: 1, width: 1, height: 1 }
];

const opponentLoadout = [
  { artifactId: 'glass_cap', x: 0, y: 0, width: 2, height: 1 },
  { artifactId: 'bark_plate', x: 0, y: 1, width: 1, height: 1 },
  { artifactId: 'shock_puff', x: 1, y: 1, width: 1, height: 1 }
];

async function createSession(request, payload) {
  const response = await request.post('/api/dev/session', { data: payload });
  const json = await response.json();
  if (!json.success) {
    throw new Error(`dev session failed: ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function resetDevDb(request) {
  const response = await request.post('/api/dev/reset', { data: {} });
  const json = await response.json();
  if (!json.success) {
    throw new Error(`dev reset failed: ${JSON.stringify(json)}`);
  }
}

async function api(request, sessionKey, url, method = 'GET', data = undefined) {
  const response = await request.fetch(url, {
    method,
    headers: {
      'X-Session-Key': sessionKey
    },
    data
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(`api call failed for ${url}: ${JSON.stringify(json)}`);
  }
  return json.data;
}

test('local session button opens a working dev-only session without auth error', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  const localSessionButton = page.getByRole('button', { name: /local session|локальная сессия/i });
  await expect(localSessionButton).toBeVisible();
  await localSessionButton.click();

  await expect(page.locator('.error')).toHaveCount(0);
  await expect(page.locator('.home, .panel')).toBeVisible();
  await expect(page).toHaveURL(/screen=(home|onboarding)|127\.0\.0\.1/);
});

test('start battle button opens replay when a ghost opponent exists', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 801, username: 'battle_clicker', name: 'Battle Clicker' });
  const opponent = await createSession(request, { telegramId: 802, username: 'battle_ghost', name: 'Battle Ghost' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', {
    mushroomId: 'thalla',
    items: playerLoadout
  });
  await api(request, opponent.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });
  await api(request, opponent.sessionKey, '/api/artifact-loadout', 'PUT', {
    mushroomId: 'kirt',
    items: opponentLoadout
  });

  await page.addInitScript((sessionKey) => {
    localStorage.setItem('sessionKey', sessionKey);
  }, player.sessionKey);

  await page.goto(`${baseURL}/battle`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: /start battle|начать бой/i })).toBeVisible();
  await page.getByRole('button', { name: /start battle|начать бой/i }).click();

  await page.waitForURL(/\/replay\//);
  await expect(page.locator('.replay-log')).toBeVisible();
  const replayEntries = page.locator('.replay-log .log-entry');
  await expect(replayEntries).toHaveCount(1);
  await expect(replayEntries.first()).toContainText(/vs|против|faces|сталкивается|встречает/i);
  await expect(page.locator('.battle-status')).toBeVisible();
  await expect(page.getByRole('button', { name: /result|результат/i })).toHaveCount(0);
  await expect(replayEntries).toHaveCount(2, { timeout: 5000 });
  const firstReplayEntryText = await replayEntries.nth(0).innerText();
  const secondReplayEntryText = await replayEntries.nth(1).innerText();
  expect(firstReplayEntryText).not.toBe(secondReplayEntryText);
  await expect(page.getByRole('button', { name: /result|результат/i })).toBeVisible({ timeout: 40000 });
});

// HTML5 drag-and-drop in Playwright is unreliable via dragTo(). Dispatch the
// drag events manually against a shared DataTransfer so Vue handlers fire.
async function htmlDragDrop(page, sourceSelector, targetSelector) {
  await page.evaluate(([srcSel, dstSel]) => {
    const source = document.querySelector(srcSel);
    const target = document.querySelector(dstSel);
    if (!source || !target) {
      throw new Error(`drag-drop selector miss: ${!source ? srcSel : dstSel}`);
    }
    const dataTransfer = new DataTransfer();
    const fire = (el, type) => {
      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
    };
    fire(source, 'dragstart');
    fire(target, 'dragenter');
    fire(target, 'dragover');
    fire(target, 'drop');
    fire(source, 'dragend');
  }, [sourceSelector, targetSelector]);
}

test('full shop flow: buy, undo, place, persist on refresh, save, battle', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 804, username: 'shop_player', name: 'Shop Player' });
  const opponent = await createSession(request, { telegramId: 805, username: 'shop_ghost', name: 'Shop Ghost' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, opponent.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });
  await api(request, opponent.sessionKey, '/api/artifact-loadout', 'PUT', {
    mushroomId: 'kirt',
    items: opponentLoadout
  });

  // Seed a deterministic shop offer via the server API.
  await api(request, player.sessionKey, '/api/shop-state', 'PUT', {
    offer: ['spore_needle', 'amber_fang', 'bark_plate', 'shock_puff', 'glass_cap'],
    container: [],
    freshPurchases: [],
    rerollSpent: 0
  });

  await page.addInitScript((sessionKey) => {
    localStorage.setItem('sessionKey', sessionKey);
  }, player.sessionKey);

  await page.goto(`${baseURL}/artifacts`, { waitUntil: 'networkidle' });

  const shop = page.locator('.artifact-shop');
  const container = page.locator('.artifact-container-zone');
  await expect(shop).toBeVisible();
  await expect(shop.locator('.shop-item')).toHaveCount(5);
  await expect(page.locator('.coin-hud-label')).toContainText('5');

  // --- Step 1: click-to-buy spore_needle (cost 1) → appears in container ---
  await shop.locator('.shop-item[data-artifact-id="spore_needle"]').click();
  await expect(container.locator('.container-item[data-artifact-id="spore_needle"]')).toHaveCount(1);
  await expect(shop.locator('.shop-item[data-artifact-id="spore_needle"]')).toHaveCount(0);
  await expect(page.locator('.coin-hud-label')).toContainText('4');

  // --- Step 2: undo purchase via sell button → returns to shop at full refund ---
  await container.locator('.container-item[data-artifact-id="spore_needle"] .container-item-sell').click();
  await expect(container.locator('.container-item[data-artifact-id="spore_needle"]')).toHaveCount(0);
  await expect(shop.locator('.shop-item[data-artifact-id="spore_needle"]')).toHaveCount(1);
  await expect(page.locator('.coin-hud-label')).toContainText('5');

  // --- Step 3: buy again, then click container item to auto-place in inventory ---
  await shop.locator('.shop-item[data-artifact-id="spore_needle"]').click();
  await expect(container.locator('.container-item[data-artifact-id="spore_needle"]')).toHaveCount(1);
  await container.locator('.container-item[data-artifact-id="spore_needle"]').click();
  await expect(page.locator('.inventory-pieces .artifact-piece[data-artifact-id="spore_needle"]')).toHaveCount(1);
  await expect(container.locator('.container-item[data-artifact-id="spore_needle"]')).toHaveCount(0);

  // --- Step 4: click placed piece → returns to container (not shop) ---
  await page.locator('.inventory-pieces .artifact-piece[data-artifact-id="spore_needle"]').click({ timeout: 5000 });
  await expect(page.locator('.inventory-pieces .artifact-piece[data-artifact-id="spore_needle"]')).toHaveCount(0);
  await expect(container.locator('.container-item[data-artifact-id="spore_needle"]')).toHaveCount(1);

  // --- Step 5: place again for the battle ---
  await container.locator('.container-item[data-artifact-id="spore_needle"]').click();
  await expect(page.locator('.inventory-pieces .artifact-piece[data-artifact-id="spore_needle"]')).toHaveCount(1);

  // --- Step 6: refresh page — state must persist from server ---
  await page.goto(`${baseURL}/artifacts`, { waitUntil: 'networkidle' });
  await expect(page.locator('.inventory-pieces .artifact-piece[data-artifact-id="spore_needle"]')).toHaveCount(1);
  await expect(page.locator('.coin-hud-label')).toContainText('4');
  await expect(shop.locator('.shop-item')).toHaveCount(4);

  // --- Step 7: save loadout and go to battle ---
  await page.getByRole('button', { name: /save|сохранить/i }).click({ timeout: 5000 });
  await expect(page.getByRole('heading', { level: 2, name: /Battle|Бой/ })).toBeVisible();
  const battleStartButton = page.getByRole('button', { name: /start battle|начать бой/i });
  await expect(battleStartButton).toBeEnabled();
  await battleStartButton.click({ timeout: 5000 });
  await expect(page.locator('.replay-log')).toBeVisible();
  await page.getByRole('button', { name: /result|результат/i }).click({ timeout: 40000 });
  await expect(page.locator('.results-screen')).toBeVisible();
});

test('shop budget enforcement: 2-cost items become unaffordable when coins run low', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 806, username: 'budget_player', name: 'Budget Player' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  // Seed shop with known artifacts via server API.
  await api(request, player.sessionKey, '/api/shop-state', 'PUT', {
    offer: ['spore_needle', 'amber_fang', 'glass_cap', 'bark_plate', 'root_shell'],
    container: [],
    freshPurchases: [],
    rerollSpent: 0
  });

  await page.addInitScript((sessionKey) => {
    localStorage.setItem('sessionKey', sessionKey);
  }, player.sessionKey);

  await page.goto(`${baseURL}/artifacts`, { waitUntil: 'networkidle' });

  const shop = page.locator('.artifact-shop');
  await expect(shop.locator('.shop-item')).toHaveCount(5);

  // Buy two 2-cost items (amber_fang + glass_cap) = 4 coins spent.
  await shop.locator('.shop-item[data-artifact-id="amber_fang"]').click();
  await shop.locator('.shop-item[data-artifact-id="glass_cap"]').click();
  await expect(page.locator('.coin-hud-label')).toContainText('1');

  // With 1 coin left, 2-cost items (root_shell) must be marked expensive and non-draggable.
  const expensiveItem = shop.locator('.shop-item.shop-item--expensive');
  await expect(expensiveItem).toHaveCount(1);
  const draggableAttr = await expensiveItem.getAttribute('draggable');
  expect(draggableAttr).toBe('false');
});

test('start battle falls back to a bot opponent when no ghost opponent exists', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 803, username: 'solo_player', name: 'Solo Player' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', {
    mushroomId: 'thalla',
    items: playerLoadout
  });

  await page.addInitScript((sessionKey) => {
    localStorage.setItem('sessionKey', sessionKey);
  }, player.sessionKey);

  await page.goto(`${baseURL}/battle`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start battle|начать бой/i }).click();

  await page.waitForURL(/\/replay\//);
  await expect(page.locator('.replay-log')).toBeVisible();
  await expect(page.locator('.error')).toHaveCount(0);
});
