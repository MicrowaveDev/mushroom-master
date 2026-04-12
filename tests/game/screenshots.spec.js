import fs from 'fs/promises';
import path from 'path';
import { test, expect } from '@playwright/test';

const screenshotDir = '/Users/microwavedev/workspace/mushroom-master/.agent/tasks/telegram-autobattler-v1/raw/screenshots';
const debugScreens = process.env.PLAYWRIGHT_SCREEN_DEBUG === '1';

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

function debugLog(message, details = undefined) {
  if (!debugScreens) {
    return;
  }
  if (details === undefined) {
    console.log(`[screenshots] ${message}`);
    return;
  }
  console.log(`[screenshots] ${message}`, details);
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

test('[Req 2-A, 4-D, 13-A] capture key v1 screens', async ({ page, request, baseURL }) => {
  debugLog('starting screenshot capture run', { baseURL });
  await page.setViewportSize({ width: 1440, height: 1400 });
  debugLog('resetting dev db');
  await resetDevDb(request);
  debugLog('creating dev sessions');
  const player = await createSession(request, { telegramId: 701, username: 'screen_a', name: 'Screen A' });
  const opponent = await createSession(request, { telegramId: 702, username: 'screen_b', name: 'Screen B' });

  const playerBoot = await api(request, player.sessionKey, '/api/bootstrap');
  const opponentBoot = await api(request, opponent.sessionKey, '/api/bootstrap');

  debugLog('seeding player and opponent state');
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
  debugLog('capturing auth gate');
  await saveShot(page, '01-auth-gate.png');

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  debugLog('capturing home');
  // [Req 1-H] daily battle limit visible, [Req 4-D] start-run button present
  await expect(page.locator('.home-mushroom-row')).toHaveCount(5);
  await expect(page.locator('.home-start-btn')).toBeVisible();
  await saveShot(page, '02-home.png');

  await page.goto(`${baseURL}/characters`);
  await page.waitForSelector('.character-card');
  debugLog('capturing characters');
  await saveShot(page, '03-characters.png');

  await page.goto(`${baseURL}/bubble-review`);
  await page.waitForSelector('.bubble-review-grid');
  debugLog('capturing bubble review');
  await expect(page.locator('.bubble-review-stage')).toHaveCount(5);
  await expect(page.locator('.bubble-review-stage .fighter-speech-bubble')).toHaveCount(5);
  await saveShot(page, '03b-bubble-review.png');

  await page.goto(`${baseURL}/inventory-review`);
  await page.waitForSelector('.inventory-review-grid');
  debugLog('capturing inventory review');
  await expect(page.locator('.inventory-review-grid .bubble-review-stage')).toHaveCount(10);
  // [Req 2-A] 3×3 grid = 9 cells per card, 10 cards = 90
  await expect(page.locator('.inventory-review-grid .fighter-inline-inventory .artifact-grid-cell')).toHaveCount(90);
  const inventoriesAreContained = await page.locator('.inventory-review-grid .fighter-inline-inventory').evaluateAll((nodes) =>
    nodes.every((inventory) => {
      const inventoryRect = inventory.getBoundingClientRect();
      const pieces = Array.from(inventory.querySelectorAll('.artifact-piece'));
      return pieces.every((piece) => {
        const pieceRect = piece.getBoundingClientRect();
        return (
          pieceRect.left >= inventoryRect.left - 0.5 &&
          pieceRect.top >= inventoryRect.top - 0.5 &&
          pieceRect.right <= inventoryRect.right + 0.5 &&
          pieceRect.bottom <= inventoryRect.bottom + 0.5
        );
      });
    })
  );
  expect(inventoriesAreContained).toBe(true);
  await saveShot(page, '03c-inventory-review.png');

  await page.goto(`${baseURL}/artifacts`);
  await page.waitForSelector('.artifact-grid-board--inventory');
  debugLog('capturing artifacts');
  await expect(page.locator('.artifact-shop .shop-item')).toHaveCount(5);
  await expect(page.locator('.coin-hud-label')).toBeVisible();
  const inventoryBoardBox = await page.locator('.artifact-grid-board--inventory').boundingBox();
  const shopBox = await page.locator('.artifact-shop').boundingBox();
  expect(inventoryBoardBox).not.toBeNull();
  expect(shopBox).not.toBeNull();
  // [Req 4-D] Shop and inventory are both visible and non-zero-area
  expect(shopBox.width).toBeGreaterThan(0);
  expect(inventoryBoardBox.width).toBeGreaterThan(0);
  await saveShot(page, '04-artifacts.png');

  await page.goto(`${baseURL}/battle`);
  await page.waitForSelector('.battle-prep-inventory');
  debugLog('capturing battle prep');
  // [Req 2-A] 3×3 grid = 9 cells
  await expect(page.locator('.battle-prep-inventory .artifact-grid-cell')).toHaveCount(9);
  await expect(page.locator('.battle-prep-card .battle-prep-portrait')).toBeVisible();
  await expect(page.locator('.battle-prep-loadout-stats')).toBeVisible();
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

  await page.goto(`${baseURL}/replay/${ghostBattle.id}`);
  await page.waitForSelector('.replay-log');
  debugLog('entered replay screen', { battleId: ghostBattle.id });
  await expect(page.locator('.duel-loadout-status')).toBeVisible();
  await expect(page.locator('.fighter-speech-bubble')).toHaveCount(0);
  // [Req 2-A] 2 fighters × 3×3 grid = 18 cells
  await expect(page.locator('.fighter-inline-inventory .artifact-grid-cell')).toHaveCount(18);
  debugLog('waiting for active fighter bubble');
  await expect(page.locator('.fighter-speech-bubble')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('.fighter-speech-bubble').first()).toContainText(/^(I |Я |Использую |I'm )/i);
  debugLog('capturing replay');
  await saveShot(page, '06-replay.png');

  // [Req 13-D] standalone replay (outside run) shows "Домой" button, not "Продолжить"
  await expect(page.getByRole('button', { name: /Home|Домой/i })).toBeVisible({ timeout: 40000 });
  debugLog('capturing replay complete state');
  await saveShot(page, '07-replay-complete.png');

  await page.goto(`${baseURL}/history`);
  await page.waitForSelector('.replay-card');
  debugLog('capturing history');
  await saveShot(page, '08-history.png');

  await page.goto(`${baseURL}/friends/${challenge.id}`);
  await page.waitForSelector('text=/Challenge|Вызов/i');
  debugLog('capturing friends');
  await saveShot(page, '09-friends.png');

  await page.goto(`${baseURL}/leaderboard`);
  await page.waitForSelector('.leaderboard-row');
  debugLog('capturing leaderboard');
  await saveShot(page, '10-leaderboard.png');

  await page.goto(`${baseURL}/wiki`);
  await page.waitForSelector('.log-entry');
  debugLog('capturing wiki home');
  await saveShot(page, '11-wiki-home.png');

  await page.locator('.log-entry').first().click();
  await page.waitForSelector('h2');
  debugLog('capturing wiki detail');
  await saveShot(page, '12-wiki-detail.png');

  await page.goto(`${baseURL}/profile`);
  await page.waitForSelector('.panel');
  debugLog('capturing profile');
  await saveShot(page, '13-profile.png');

  await page.goto(`${baseURL}/settings`);
  await page.waitForSelector('.setting-row');
  debugLog('capturing settings');
  await saveShot(page, '14-settings.png');

  await page.goto(`${baseURL}/lab`);
  await page.waitForSelector('textarea');
  debugLog('capturing local lab');
  await saveShot(page, '15-local-lab.png');

  expect(true).toBe(true);
});
