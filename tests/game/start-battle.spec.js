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
  await expect(page.locator('.dashboard, .panel')).toBeVisible();
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

  await page.goto(`${baseURL}?screen=battle`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: /start battle|начать бой/i })).toBeVisible();
  await page.getByRole('button', { name: /start battle|начать бой/i }).click();

  await page.waitForURL(/screen=replay/);
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

test('shop drag-and-drop flow lets the player spend coins, return items, save, and battle', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 804, username: 'shop_player', name: 'Shop Player' });
  const opponent = await createSession(request, { telegramId: 805, username: 'shop_ghost', name: 'Shop Ghost' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, opponent.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });
  await api(request, opponent.sessionKey, '/api/artifact-loadout', 'PUT', {
    mushroomId: 'kirt',
    items: opponentLoadout
  });

  await page.addInitScript((sessionKey) => {
    localStorage.setItem('sessionKey', sessionKey);
  }, player.sessionKey);

  await page.goto(`${baseURL}?screen=artifacts`, { waitUntil: 'networkidle' });

  // Shop renders with 5 offers and the coin HUD reads 0/5.
  const shop = page.locator('.artifact-shop');
  await expect(shop).toBeVisible();
  await expect(shop.locator('.shop-item')).toHaveCount(5);
  await expect(page.locator('.coin-hud-label')).toContainText('0 / 5');

  // Pick the first available 1-coin shop item so the drag always fits the budget.
  const cheapItem = shop.locator('.shop-item:not(.shop-item--expensive)').first();
  const cheapId = await cheapItem.getAttribute('data-artifact-id');
  expect(cheapId).not.toBeNull();

  // Drag it onto inventory cell (0, 0).
  await htmlDragDrop(
    page,
    `.shop-item[data-artifact-id="${cheapId}"]`,
    '.artifact-grid-board--inventory .artifact-grid-cell[data-cell-x="0"][data-cell-y="0"]'
  );

  // Piece landed in inventory, shop lost it, coin HUD ticked.
  await expect(page.locator(`.inventory-pieces .artifact-piece[data-artifact-id="${cheapId}"]`)).toHaveCount(1);
  await expect(shop.locator(`.shop-item[data-artifact-id="${cheapId}"]`)).toHaveCount(0);
  await expect(shop.locator('.shop-item')).toHaveCount(4);
  await expect(page.locator('.coin-hud-label')).not.toContainText('0 / 5');

  // Click the placed piece to return it to the shop; coins refund back to 0/5.
  await page.locator(`.inventory-pieces .artifact-piece[data-artifact-id="${cheapId}"]`).click({ timeout: 5000 });
  await expect(page.locator(`.inventory-pieces .artifact-piece[data-artifact-id="${cheapId}"]`)).toHaveCount(0);
  await expect(shop.locator(`.shop-item[data-artifact-id="${cheapId}"]`)).toHaveCount(1);
  await expect(page.locator('.coin-hud-label')).toContainText('0 / 5');

  // Place it again and save the loadout.
  await htmlDragDrop(
    page,
    `.shop-item[data-artifact-id="${cheapId}"]`,
    '.artifact-grid-board--inventory .artifact-grid-cell[data-cell-x="0"][data-cell-y="0"]'
  );
  await expect(page.locator(`.inventory-pieces .artifact-piece[data-artifact-id="${cheapId}"]`)).toHaveCount(1);
  await page.getByRole('button', { name: /save|сохранить/i }).click({ timeout: 5000 });

  // Battle prep screen still works with a partial loadout.
  await expect(page.getByRole('heading', { level: 2, name: /Battle|Бой/ })).toBeVisible();
  const battleInventory = page.locator('.battle-prep-inventory');
  await expect(battleInventory).toBeVisible();
  await expect(page.locator('.battle-prep-inventory .artifact-grid-cell')).toHaveCount(6);

  const battleStartButton = page.getByRole('button', { name: /start battle|начать бой/i });
  await expect(battleStartButton).toBeEnabled();
  await battleStartButton.click({ timeout: 5000 });
  await expect(page.locator('.replay-log')).toBeVisible();
  await page.getByRole('button', { name: /result|результат/i }).click({ timeout: 40000 });
  await expect(page.getByRole('heading', { level: 2, name: /result|результат/i })).toBeVisible();
});

test('shop enforces the 5-coin budget by blocking drags from unaffordable items', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 806, username: 'budget_player', name: 'Budget Player' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  // Seed localStorage with a deterministic shop offer so this test doesn't
  // depend on the random reroll landing on specific artifacts.
  await page.addInitScript(({ sessionKey, playerId }) => {
    localStorage.setItem('sessionKey', sessionKey);
    const offer = ['spore_needle', 'amber_fang', 'glass_cap', 'bark_plate', 'root_shell'];
    localStorage.setItem(
      `mushroom-shop-offer:${playerId}`,
      JSON.stringify({ offer, builder: [] })
    );
  }, { sessionKey: player.sessionKey, playerId: player.player.id });

  await page.goto(`${baseURL}?screen=artifacts`, { waitUntil: 'networkidle' });

  const shop = page.locator('.artifact-shop');
  await expect(shop.locator('.shop-item')).toHaveCount(5);
  // Seeded offer guarantees amber_fang and root_shell are present.
  await expect(shop.locator('.shop-item[data-artifact-id="amber_fang"]')).toHaveCount(1);
  await expect(shop.locator('.shop-item[data-artifact-id="root_shell"]')).toHaveCount(1);

  // Non-square artifacts auto-rotate to their horizontal preferred orientation,
  // so amber_fang (1×2) lands as 2×1 at (0,0) occupying cols 0,1 of row 0.
  await htmlDragDrop(
    page,
    '.shop-item[data-artifact-id="amber_fang"]',
    '.artifact-grid-board--inventory .artifact-grid-cell[data-cell-x="0"][data-cell-y="0"]'
  );
  await expect(page.locator('.inventory-pieces .artifact-piece[data-artifact-id="amber_fang"]')).toHaveCount(1);
  await expect(page.locator('.coin-hud-label')).toContainText('2 / 5');

  // glass_cap (price 2, 2×1) at (0,1) fills cols 0,1 of row 1 — 4 coins spent total.
  await htmlDragDrop(
    page,
    '.shop-item[data-artifact-id="glass_cap"]',
    '.artifact-grid-board--inventory .artifact-grid-cell[data-cell-x="0"][data-cell-y="1"]'
  );
  await expect(page.locator('.inventory-pieces .artifact-piece[data-artifact-id="glass_cap"]')).toHaveCount(1);
  await expect(page.locator('.coin-hud-label')).toContainText('4 / 5');

  // Now only 1 coin left. A remaining 2-cost shop item must be marked expensive
  // and its draggable attribute must be false.
  const remainingExpensive = shop.locator('.shop-item.shop-item--expensive').first();
  await expect(remainingExpensive).toHaveCount(1);
  const draggableAttr = await remainingExpensive.getAttribute('draggable');
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

  await page.goto(`${baseURL}?screen=battle`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start battle|начать бой/i }).click();

  await page.waitForURL(/screen=replay/);
  await expect(page.locator('.replay-log')).toBeVisible();
  await expect(page.locator('.error')).toHaveCount(0);
});
