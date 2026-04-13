import fs from 'fs/promises';
import path from 'path';
import { test, expect } from '@playwright/test';

const screenshotDir = '/Users/microwavedev/workspace/mushroom-master/.agent/tasks/telegram-autobattler-v1/raw/screenshots';
const debugScreens = process.env.PLAYWRIGHT_SCREEN_DEBUG === '1';

// Canonical viewport pair from docs/user-flows.md preamble + AGENTS.md.
// Tests must capture both so layout regressions on either form-factor are
// caught at the same severity.
const MOBILE_VIEWPORT = { width: 375, height: 667 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

// Loadout constants deleted with the legacy single-battle flow on
// 2026-04-13. Game-run prep is responsible for seeding loadouts now.

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

/**
 * Capture the current screen at both mobile and desktop viewports, suffixing
 * filenames with `-mobile` / `-desktop` (preserving any extension). Required
 * by docs/user-flows.md and AGENTS.md for any UI-touching change.
 *
 * The mobile capture happens first so the page state matches what the user
 * sees in the Telegram Mini App (the primary form factor); we then enlarge
 * to desktop and re-shoot. Most screens reflow gracefully across this range.
 */
async function saveShotDual(page, name) {
  const dot = name.lastIndexOf('.');
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : '.png';

  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.waitForTimeout(80);
  await saveShot(page, `${base}-mobile${ext}`);

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.waitForTimeout(80);
  await saveShot(page, `${base}-desktop${ext}`);
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

test('[Req 2-A, 4-D, 13-A] capture key v1 screens (dual viewport)', async ({ page, request, baseURL }) => {
  debugLog('starting screenshot capture run', { baseURL });
  // Default to mobile so initial assertions match what users actually see in
  // the Telegram Mini App. saveShotDual will switch to desktop for each capture.
  await page.setViewportSize(MOBILE_VIEWPORT);
  debugLog('resetting dev db');
  await resetDevDb(request);
  debugLog('creating dev sessions');
  const player = await createSession(request, { telegramId: 701, username: 'screen_a', name: 'Screen A' });
  const opponent = await createSession(request, { telegramId: 702, username: 'screen_b', name: 'Screen B' });

  const playerBoot = await api(request, player.sessionKey, '/api/bootstrap');
  const opponentBoot = await api(request, opponent.sessionKey, '/api/bootstrap');

  debugLog('seeding player and opponent state');
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, opponent.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });
  await api(request, player.sessionKey, '/api/friends/add-by-code', 'POST', {
    friendCode: opponentBoot.player.friendCode
  });
  await api(request, opponent.sessionKey, '/api/friends/add-by-code', 'POST', {
    friendCode: playerBoot.player.friendCode
  });

  // Create a real battle in history by playing one round of a solo game run.
  // Legacy POST /api/battles + /api/artifact-loadout pre-seed were deleted
  // 2026-04-13; the only path to a battle now is through a game run.
  const ghostRun = await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });
  const ghostRound = await api(request, player.sessionKey, `/api/game-run/${ghostRun.id}/ready`, 'POST', {});
  const ghostBattle = { id: ghostRound.lastRound?.battleId };
  await api(request, player.sessionKey, `/api/game-run/${ghostRun.id}/abandon`, 'POST', {});

  // Create a pending friend (run) challenge so the friends screen has
  // something to show. Don't accept it — we want the pending state.
  const challenge = await api(request, player.sessionKey, '/api/friends/challenges', 'POST', {
    friendPlayerId: opponent.player.id
  });

  await page.goto(baseURL);
  debugLog('capturing auth gate');
  await saveShotDual(page, '01-auth-gate.png');

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  debugLog('capturing home');
  // [Req 1-H] daily battle limit visible, [Req 4-D] start-run button present
  await page.locator('.home-mushroom-row').first().waitFor({ timeout: 5000 });
  await expect(page.locator('.home-mushroom-row')).toHaveCount(5);
  await expect(page.locator('.home-start-btn')).toBeVisible();
  await saveShotDual(page, '02-home.png');

  await page.goto(`${baseURL}/characters`);
  await page.waitForSelector('.character-card');
  debugLog('capturing characters');
  await saveShotDual(page, '03-characters.png');

  await page.goto(`${baseURL}/bubble-review`);
  await page.waitForSelector('.bubble-review-grid');
  debugLog('capturing bubble review');
  await expect(page.locator('.bubble-review-stage')).toHaveCount(5);
  await expect(page.locator('.bubble-review-stage .fighter-speech-bubble')).toHaveCount(5);
  await saveShotDual(page, '03b-bubble-review.png');

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
  await saveShotDual(page, '03c-inventory-review.png');

  // 04-artifacts and 05-battle-prep screenshots removed: ArtifactsScreen
  // and BattlePrepScreen were deleted with the rest of the legacy
  // single-battle flow on 2026-04-13. The current prep flow is captured
  // by solo-run.spec.js (`solo-02-prep-round1`).

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
  await saveShotDual(page, '06-replay.png');

  // [Req 13-D] standalone replay (outside run) shows "Домой" button, not "Продолжить"
  await expect(page.getByRole('button', { name: /Home|Домой/i })).toBeVisible({ timeout: 40000 });
  debugLog('capturing replay complete state');
  await saveShotDual(page, '07-replay-complete.png');

  await page.goto(`${baseURL}/history`);
  await page.waitForSelector('.replay-card');
  debugLog('capturing history');
  await saveShotDual(page, '08-history.png');

  await page.goto(`${baseURL}/friends/${challenge.id}`);
  await page.waitForSelector('text=/Challenge|Вызов/i');
  debugLog('capturing friends');
  await saveShotDual(page, '09-friends.png');

  await page.goto(`${baseURL}/leaderboard`);
  await page.waitForSelector('.leaderboard-row');
  debugLog('capturing leaderboard');
  await saveShotDual(page, '10-leaderboard.png');

  await page.goto(`${baseURL}/wiki`);
  await page.waitForSelector('.log-entry');
  debugLog('capturing wiki home');
  await saveShotDual(page, '11-wiki-home.png');

  await page.locator('.log-entry').first().click();
  await page.waitForSelector('h2');
  debugLog('capturing wiki detail');
  await saveShotDual(page, '12-wiki-detail.png');

  await page.goto(`${baseURL}/profile`);
  await page.waitForSelector('.panel');
  debugLog('capturing profile');
  await saveShotDual(page, '13-profile.png');

  await page.goto(`${baseURL}/settings`);
  await page.waitForSelector('.setting-row');
  debugLog('capturing settings');
  await saveShotDual(page, '14-settings.png');

  await page.goto(`${baseURL}/lab`);
  await page.waitForSelector('textarea');
  debugLog('capturing local lab');
  await saveShotDual(page, '15-local-lab.png');

  expect(true).toBe(true);
});
