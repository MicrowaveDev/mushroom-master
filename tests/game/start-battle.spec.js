import { test, expect } from '@playwright/test';

const playerLoadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'root_shell', x: 1, y: 0, width: 2, height: 2 },
  { artifactId: 'shock_puff', x: 3, y: 0, width: 1, height: 1 }
];

const opponentLoadout = [
  { artifactId: 'amber_fang', x: 0, y: 0, width: 1, height: 2 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 },
  { artifactId: 'thunder_gill', x: 2, y: 0, width: 2, height: 1 }
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
  await expect(page.locator('.replay-line')).not.toHaveText('');
});

test('artifact figures are visible in the library, on the board, and in the saved battle preview', async ({ page, request, baseURL }) => {
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

  await page.locator('.artifact-btn[data-artifact-id="amber_fang"]').click({ timeout: 5000 });
  await expect(page.locator('.artifact-btn[data-artifact-id="amber_fang"]')).toHaveClass(/placed/);
  await page.locator('.artifact-btn[data-artifact-id="spore_needle"]').click({ timeout: 5000 });
  await expect(page.locator('.artifact-btn[data-artifact-id="spore_needle"]')).toHaveClass(/placed/);
  await page.locator('.artifact-btn[data-artifact-id="thunder_gill"]').click({ timeout: 5000 });
  await expect(page.locator('.artifact-btn[data-artifact-id="thunder_gill"]')).toHaveClass(/placed/);

  await expect(page.locator('.board-pieces .artifact-piece')).toHaveCount(3);
  await page.locator('.artifact-btn[data-artifact-id="bark_plate"]').click({ timeout: 5000 });
  await expect(page.locator('.board-pieces .artifact-piece')).toHaveCount(3);
  await expect(page.locator('.error')).toContainText(/only 3 artifacts|только 3 артефакта|можно поставить только 3 артефакта/i);

  const amberBoardPiece = page.locator('.artifact-grid-board--board .artifact-piece[data-artifact-id="amber_fang"]');
  await expect(amberBoardPiece).toHaveCount(1);

  const amberBoardCells = page.locator('.board-pieces .artifact-piece[data-artifact-id="amber_fang"] .artifact-figure-cell');
  await expect(amberBoardCells).toHaveCount(2);
  await expect(amberBoardCells.first()).toBeVisible();

  const boardBox = await page.locator('.board-pieces .artifact-piece[data-artifact-id="amber_fang"]').boundingBox();
  expect(boardBox).not.toBeNull();
  expect(boardBox.height).toBeGreaterThan(boardBox.width * 1.5);

  await page.getByRole('button', { name: /save|сохранить/i }).click({ timeout: 5000 });
  await expect(page.getByRole('heading', { level: 2, name: /Battle|Бой/ })).toBeVisible();

  const amberBattlePreview = page.locator('.mini-board-pieces .artifact-piece[data-artifact-id="amber_fang"] .artifact-figure-cell');
  await expect(amberBattlePreview).toHaveCount(2);
  await expect(amberBattlePreview.first()).toBeVisible();

  await page.getByRole('button', { name: /start battle|начать бой/i }).click({ timeout: 5000 });
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
