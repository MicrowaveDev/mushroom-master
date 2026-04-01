import fs from 'fs/promises';
import path from 'path';
import { test, expect } from '@playwright/test';

const screenshotDir = '/Users/microwavedev/workspace/mushroom-master/.agent/tasks/telegram-autobattler-v1/raw/screenshots';

const playerLoadout = [
  { artifactId: 'amber_fang', x: 0, y: 0, width: 1, height: 2 },
  { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 },
  { artifactId: 'shock_puff', x: 2, y: 0, width: 1, height: 1 }
];

const opponentLoadout = [
  { artifactId: 'glass_cap', x: 0, y: 0, width: 2, height: 1 },
  { artifactId: 'bark_plate', x: 0, y: 1, width: 1, height: 1 },
  { artifactId: 'shock_puff', x: 1, y: 1, width: 1, height: 1 }
];

async function resetDevDb(request) {
  const response = await request.post('/api/dev/reset', { data: {} });
  const json = await response.json();
  if (!json.success) {
    throw new Error(`dev reset failed: ${JSON.stringify(json)}`);
  }
}

async function saveShot(page, name) {
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

async function createSession(request, payload) {
  const response = await request.post('/api/dev/session', { data: payload });
  const json = await response.json();
  if (!json.success) {
    throw new Error(`dev session failed: ${JSON.stringify(json)}`);
  }
  return json.data;
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

test('capture key v1 screens', async ({ page, request, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 701, username: 'screen_a', name: 'Screen A' });
  const opponent = await createSession(request, { telegramId: 702, username: 'screen_b', name: 'Screen B' });

  const playerBoot = await api(request, player.sessionKey, '/api/bootstrap');
  const opponentBoot = await api(request, opponent.sessionKey, '/api/bootstrap');

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
  await api(request, player.sessionKey, '/api/friends/add-by-code', 'POST', {
    friendCode: opponentBoot.player.friendCode
  });
  await api(request, opponent.sessionKey, '/api/friends/add-by-code', 'POST', {
    friendCode: playerBoot.player.friendCode
  });

  const challenge = await api(request, player.sessionKey, '/api/friends/challenges', 'POST', {
    friendPlayerId: opponent.player.id
  });
  const ghostBattle = await api(request, player.sessionKey, '/api/battles', 'POST', {
    mode: 'ghost',
    seed: 'screen-seed',
    idempotencyKey: 'screen-seed'
  });
  await api(request, opponent.sessionKey, `/api/friends/challenges/${challenge.id}/accept`, 'POST', {});

  await page.goto(baseURL);
  await saveShot(page, '01-auth-gate.png');

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}?screen=home`);
  await page.waitForSelector('.dashboard');
  await expect(page.locator('.home-inventory .artifact-grid-cell')).toHaveCount(6);
  await saveShot(page, '02-home.png');

  await page.goto(`${baseURL}?screen=characters`);
  await page.waitForSelector('.card');
  await saveShot(page, '03-characters.png');

  await page.goto(`${baseURL}?screen=artifacts`);
  await page.waitForSelector('.artifact-grid-board--inventory');
  const artifactCards = page.locator('.artifact-btn');
  const firstCardBox = await artifactCards.nth(0).boundingBox();
  const secondCardBox = await artifactCards.nth(1).boundingBox();
  const thirdCardBox = await artifactCards.nth(2).boundingBox();
  const fourthCardBox = await artifactCards.nth(3).boundingBox();
  expect(firstCardBox).not.toBeNull();
  expect(secondCardBox).not.toBeNull();
  expect(thirdCardBox).not.toBeNull();
  expect(fourthCardBox).not.toBeNull();
  expect(Math.abs(firstCardBox.y - secondCardBox.y)).toBeLessThan(4);
  expect(Math.abs(firstCardBox.y - thirdCardBox.y)).toBeLessThan(4);
  expect(fourthCardBox.y).toBeGreaterThan(firstCardBox.y + 20);
  await saveShot(page, '04-artifacts.png');

  await page.goto(`${baseURL}?screen=battle`);
  await page.waitForSelector('.battle-prep-inventory');
  await expect(page.locator('.battle-prep-inventory .artifact-grid-cell')).toHaveCount(6);
  await expect(page.locator('.battle-prep-character .battle-prep-character-portrait')).toBeVisible();
  await expect(page.locator('.battle-prep-summary')).toBeVisible();
  const inventoryBox = await page.locator('.battle-prep-inventory').boundingBox();
  const buttonBox = await page.getByRole('button', { name: /Start battle|Начать бой/ }).boundingBox();
  const overlaps = !(
    inventoryBox.x + inventoryBox.width <= buttonBox.x ||
    buttonBox.x + buttonBox.width <= inventoryBox.x ||
    inventoryBox.y + inventoryBox.height <= buttonBox.y ||
    buttonBox.y + buttonBox.height <= inventoryBox.y
  );
  expect(overlaps).toBe(false);
  await saveShot(page, '05-battle-prep.png');

  await page.goto(`${baseURL}?screen=replay&replay=${ghostBattle.id}`);
  await page.waitForSelector('.replay-log');
  await expect(page.locator('.battle-status')).toBeVisible();
  await saveShot(page, '06-replay.png');

  await page.getByRole('button', { name: /Result|Результат/ }).click();
  await page.waitForSelector('.panel');
  await expect(page.locator('.results-portrait')).toHaveCount(2);
  await saveShot(page, '07-results.png');

  await page.goto(`${baseURL}?screen=history`);
  await page.waitForSelector('.log-entry');
  await saveShot(page, '08-history.png');

  await page.goto(`${baseURL}?screen=friends&challenge=${challenge.id}`);
  await page.waitForSelector('text=Challenge');
  await saveShot(page, '09-friends.png');

  await page.goto(`${baseURL}?screen=leaderboard`);
  await page.waitForSelector('.leaderboard-row');
  await saveShot(page, '10-leaderboard.png');

  await page.goto(`${baseURL}?screen=wiki`);
  await page.waitForSelector('.log-entry');
  await saveShot(page, '11-wiki-home.png');

  await page.locator('.log-entry').first().click();
  await page.waitForSelector('h2');
  await saveShot(page, '12-wiki-detail.png');

  await page.goto(`${baseURL}?screen=profile`);
  await page.waitForSelector('.panel');
  await saveShot(page, '13-profile.png');

  await page.goto(`${baseURL}?screen=settings`);
  await page.waitForSelector('.setting-row');
  await saveShot(page, '14-settings.png');

  await page.goto(`${baseURL}?screen=lab`);
  await page.waitForSelector('textarea');
  await saveShot(page, '15-local-lab.png');

  expect(true).toBe(true);
});
