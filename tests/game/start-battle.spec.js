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
  await expect(replayEntries.first()).toContainText(/faces|сталкивается|встречает/i);
  await expect(page.locator('.replay-line')).not.toHaveText('');

  await page.getByRole('button', { name: /play/i }).click();
  await expect(replayEntries).toHaveCount(2);
  const firstReplayEntryText = await replayEntries.nth(0).innerText();
  const secondReplayEntryText = await replayEntries.nth(1).innerText();
  expect(firstReplayEntryText).not.toBe(secondReplayEntryText);
});

test('artifact figures are visible in the library, inventory, and battle surfaces', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 804, username: 'shape_player', name: 'Shape Player' });
  const opponent = await createSession(request, { telegramId: 805, username: 'shape_ghost', name: 'Shape Ghost' });

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

  await expect(page.locator('.artifact-btn[data-artifact-id="spore_needle"] .artifact-figure-cell')).toHaveCount(1);
  const amberLibraryCells = page.locator('.artifact-btn[data-artifact-id="amber_fang"] .artifact-figure-cell');
  await expect(amberLibraryCells).toHaveCount(2);
  await expect(amberLibraryCells.first()).toBeVisible();
  await expect(page.locator('.artifact-btn[data-artifact-id="root_shell"] .artifact-figure-cell')).toHaveCount(4);
  await expect(page.locator('.artifact-btn[data-artifact-id="amber_fang"] .artifact-grid-background')).toBeHidden();

  const leftCellBox = await page.locator('.artifact-btn[data-artifact-id="spore_needle"] .artifact-figure-cell').first().boundingBox();
  const rightCellBox = await page.locator('.artifact-grid-board--inventory .artifact-grid-cell').first().boundingBox();
  expect(leftCellBox).not.toBeNull();
  expect(rightCellBox).not.toBeNull();
  expect(Math.round(leftCellBox.width)).toBe(50);
  expect(Math.round(leftCellBox.height)).toBe(50);
  expect(Math.round(rightCellBox.width)).toBe(50);
  expect(Math.round(rightCellBox.height)).toBe(50);

  await page.locator('.artifact-btn[data-artifact-id="amber_fang"]').click({ timeout: 5000 });
  await expect(page.locator('.artifact-btn[data-artifact-id="amber_fang"]')).toHaveClass(/placed/);
  await page.locator('.artifact-btn[data-artifact-id="spore_needle"]').click({ timeout: 5000 });
  await expect(page.locator('.artifact-btn[data-artifact-id="spore_needle"]')).toHaveClass(/placed/);
  await page.locator('.artifact-btn[data-artifact-id="thunder_gill"]').click({ timeout: 5000 });
  await expect(page.locator('.artifact-btn[data-artifact-id="thunder_gill"]')).toHaveClass(/placed/);

  await expect(page.locator('.inventory-pieces .artifact-piece')).toHaveCount(3);
  await page.locator('.artifact-btn[data-artifact-id="bark_plate"]').click({ timeout: 5000 });
  await expect(page.locator('.inventory-pieces .artifact-piece')).toHaveCount(3);
  await expect(page.locator('.error')).toContainText(/only 3 artifacts|только 3 артефакта|можно поставить только 3 артефакта/i);

  const amberBoardPiece = page.locator('.artifact-grid-board--inventory .artifact-piece[data-artifact-id="amber_fang"]');
  await expect(amberBoardPiece).toHaveCount(1);

  const amberBoardCells = page.locator('.inventory-pieces .artifact-piece[data-artifact-id="amber_fang"] .artifact-figure-cell');
  await expect(amberBoardCells).toHaveCount(2);
  await expect(amberBoardCells.first()).toBeVisible();

  const boardBox = await page.locator('.inventory-pieces .artifact-piece[data-artifact-id="amber_fang"]').boundingBox();
  expect(boardBox).not.toBeNull();
  expect(boardBox.height).toBeGreaterThan(boardBox.width * 1.5);

  await page.getByRole('button', { name: /save|сохранить/i }).click({ timeout: 5000 });
  await expect(page.getByRole('heading', { level: 2, name: /Battle|Бой/ })).toBeVisible();

  const battleInventory = page.locator('.battle-prep-inventory');
  const battleInventoryCells = page.locator('.battle-prep-inventory .artifact-grid-cell');
  const battleStartButton = page.getByRole('button', { name: /start battle|начать бой/i });
  await expect(battleInventory).toBeVisible();
  await expect(battleInventoryCells).toHaveCount(6);
  await expect(page.locator('.battle-prep-summary')).toBeVisible();

  const battleInventoryBox = await battleInventory.boundingBox();
  const battleStartButtonBox = await battleStartButton.boundingBox();
  expect(battleInventoryBox).not.toBeNull();
  expect(battleStartButtonBox).not.toBeNull();
  const boxesOverlap = !(
    battleInventoryBox.x + battleInventoryBox.width <= battleStartButtonBox.x ||
    battleStartButtonBox.x + battleStartButtonBox.width <= battleInventoryBox.x ||
    battleInventoryBox.y + battleInventoryBox.height <= battleStartButtonBox.y ||
    battleStartButtonBox.y + battleStartButtonBox.height <= battleInventoryBox.y
  );
  expect(boxesOverlap).toBe(false);

  await battleStartButton.click({ timeout: 5000 });
  await expect(page.locator('.replay-log')).toBeVisible();
  await page.getByRole('button', { name: /result|результат/i }).click({ timeout: 5000 });
  await expect(page.getByRole('heading', { level: 2, name: /result|результат/i })).toBeVisible();
});

test('start battle shows a visible error when no ghost opponent exists', async ({ page, request, baseURL }) => {
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

  await expect(page.locator('.error')).toContainText(/No ghost opponents available/i);
});
