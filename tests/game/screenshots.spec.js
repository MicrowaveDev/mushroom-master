import path from 'path';
import { test, expect } from '@playwright/test';
import { captureScreenshot, assertImagesLoaded } from './screenshot-capture.js';
import { resetDevDb, createSession, api, MOBILE_VIEWPORT } from './e2e-helpers.js';
import { repoRoot } from '../../app/shared/repo-root.js';

const screenshotDir = path.join(repoRoot, '.agent/tasks/telegram-autobattler-v1/raw/screenshots');
const debugScreens = process.env.PLAYWRIGHT_SCREEN_DEBUG === '1';

const saveShot = (page, name) => captureScreenshot(page, screenshotDir, name);

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

test('[Req 2-A, 4-D, 13-A] capture key v1 screens (dual viewport)', async ({ page, request, baseURL }) => {
  debugLog('starting screenshot capture run', { baseURL });
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
  await saveShot(page, '01-auth-gate.png');

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  debugLog('capturing home');
  // [Req 1-H] daily battle limit visible, [Req 4-D] start-run button present
  await page.locator('.home-mushroom-row').first().waitFor({ timeout: 5000 });
  await expect(page.locator('.home-mushroom-row')).toHaveCount(6);
  await expect(page.locator('.home-start-btn')).toBeVisible();
  await assertImagesLoaded(page);
  await saveShot(page, '02-home.png');

  await page.goto(`${baseURL}/characters`);
  await page.waitForSelector('.character-card');
  debugLog('capturing characters');
  await assertImagesLoaded(page);
  await saveShot(page, '03-characters.png');

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
  await assertImagesLoaded(page);
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

});
