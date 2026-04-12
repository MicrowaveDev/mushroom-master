import fs from 'fs/promises';
import path from 'path';
import { test, expect } from '@playwright/test';

const screenshotDir = '/Users/microwavedev/workspace/mushroom-master/.agent/tasks/telegram-autobattler-v1/raw/screenshots/challenge';

const loadoutA = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

const loadoutB = [
  { artifactId: 'shock_puff', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'moss_ring', x: 1, y: 0, width: 1, height: 1 }
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

async function setupChallengePlayers(request) {
  const playerA = await createSession(request, { telegramId: 911, username: 'challenger', name: 'Challenger' });
  const playerB = await createSession(request, { telegramId: 912, username: 'invitee', name: 'Invitee' });

  await api(request, playerA.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await api(request, playerA.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'thalla', items: loadoutA });
  await api(request, playerB.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });
  await api(request, playerB.sessionKey, '/api/artifact-loadout', 'PUT', { mushroomId: 'kirt', items: loadoutB });

  const bootA = await api(request, playerA.sessionKey, '/api/bootstrap');
  const bootB = await api(request, playerB.sessionKey, '/api/bootstrap');
  await api(request, playerA.sessionKey, '/api/friends/add-by-code', 'POST', { friendCode: bootB.player.friendCode });
  await api(request, playerB.sessionKey, '/api/friends/add-by-code', 'POST', { friendCode: bootA.player.friendCode });

  return { playerA, playerB };
}

test('[Req 8-A, 8-B, 8-C, 8-D] challenge mode: invite → accept → readies → round resolves → UI screenshots', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const { playerA, playerB } = await setupChallengePlayers(request);

  // --- Create challenge invitation ---
  const challenge = await api(request, playerA.sessionKey, '/api/game-run/challenge', 'POST', { friendPlayerId: playerB.player.id });
  expect(challenge.status).toBe('pending');
  expect(challenge.challengeType).toBe('run');

  // --- Player B accepts → shared game run ---
  const acceptResult = await api(request, playerB.sessionKey, `/api/friends/challenges/${challenge.id}/accept`, 'POST', {});
  expect(acceptResult.mode).toBe('challenge');
  expect(acceptResult.status).toBe('active');
  const runId = acceptResult.id;

  // Both players have independent coins
  expect(acceptResult.players[playerA.player.id].coins).toBeGreaterThan(0);
  expect(acceptResult.players[playerB.player.id].coins).toBeGreaterThan(0);

  // --- Player A views prep screen ---
  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), playerA.sessionKey);
  await page.goto(`${baseURL}/prep`, { waitUntil: 'networkidle' });
  await expect(page.locator('.prep-screen')).toBeVisible();
  await expect(page.locator('.run-hud')).toContainText('1'); // round 1
  await saveShot(page, 'challenge-01-playerA-prep-round1.png');

  // --- Opponent status shows "waiting for opponent" ---
  await expect(page.locator('.prep-opponent-status')).toBeVisible();
  await expect(page.locator('.prep-opponent-waiting')).toBeVisible();
  await saveShot(page, 'challenge-02-playerA-waiting-for-opponent.png');

  // --- Player A readies → gets waiting state ---
  const readyA = await api(request, playerA.sessionKey, `/api/game-run/${runId}/ready`, 'POST', {});
  expect(readyA.waiting).toBe(true);

  // --- Player A unreadies ---
  const unreadyA = await api(request, playerA.sessionKey, `/api/game-run/${runId}/unready`, 'POST', {});
  expect(unreadyA.ready).toBe(false);

  // --- Player A readies again ---
  const readyA2 = await api(request, playerA.sessionKey, `/api/game-run/${runId}/ready`, 'POST', {});
  expect(readyA2.waiting).toBe(true);

  // --- Player B readies → triggers resolution ---
  const readyB = await api(request, playerB.sessionKey, `/api/game-run/${runId}/ready`, 'POST', {});
  expect(readyB.lastRound).toBeDefined();
  expect(readyB.lastRound.outcome).toMatch(/^(win|loss)$/);
  expect(readyB.lastRound.rewards).toBeDefined();
  expect(readyB.lastRound.rewards.spore).toBeGreaterThan(0);

  // --- Verify run state: round advanced, opposite outcomes ---
  const runState = await api(request, playerA.sessionKey, `/api/game-run/${runId}`);
  expect(runState.currentRound).toBe(2);
  expect(runState.players.length).toBe(2);

  const pA = runState.players.find(p => p.playerId === playerA.player.id);
  const pB = runState.players.find(p => p.playerId === playerB.player.id);
  expect(pA.completedRounds).toBe(1);
  expect(pB.completedRounds).toBe(1);
  expect(pA.wins + pA.losses).toBe(1);
  expect(pB.wins + pB.losses).toBe(1);
  expect(pA.wins).not.toBe(pB.wins);

  // --- Player B views their prep screen for round 2 ---
  const pageB = await page.context().newPage();
  await pageB.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), playerB.sessionKey);
  await pageB.goto(`${baseURL}/prep`, { waitUntil: 'networkidle' });
  await expect(pageB.locator('.prep-screen')).toBeVisible();
  await expect(pageB.locator('.run-hud')).toContainText('2'); // round 2
  await saveShot(pageB, 'challenge-03-playerB-prep-round2.png');

  // --- Player B opponent status indicator ---
  await expect(pageB.locator('.prep-opponent-status')).toBeVisible();
  await saveShot(pageB, 'challenge-04-playerB-opponent-status.png');

  // --- Play until completion via API ---
  for (let round = 0; round < 8; round++) {
    const runCheck = await api(request, playerA.sessionKey, `/api/game-run/${runId}`);
    if (runCheck.status !== 'active') break;

    await api(request, playerA.sessionKey, `/api/game-run/${runId}/ready`, 'POST', {});
    const result = await api(request, playerB.sessionKey, `/api/game-run/${runId}/ready`, 'POST', {});
    if (result.status === 'completed') break;
  }

  // --- Player A sees run complete ---
  await page.goto(`${baseURL}/runComplete`, { waitUntil: 'networkidle' });
  // If the run ended, the screen should show; otherwise force it
  const runFinal = await api(request, playerA.sessionKey, `/api/game-run/${runId}`);
  if (runFinal.status === 'completed' || runFinal.status === 'abandoned') {
    await page.goto(`${baseURL}/runComplete`, { waitUntil: 'networkidle' });
    if (await page.locator('.run-complete-screen').isVisible()) {
      await saveShot(page, 'challenge-05-run-complete.png');
    }
  }

  await pageB.close();
});

test('[Req 1-F, 8-A] challenge mode: abandon by one player ends for both + screenshots', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const { playerA, playerB } = await setupChallengePlayers(request);

  const challenge = await api(request, playerA.sessionKey, '/api/game-run/challenge', 'POST', { friendPlayerId: playerB.player.id });
  const run = await api(request, playerB.sessionKey, `/api/friends/challenges/${challenge.id}/accept`, 'POST', {});
  const runId = run.id;

  // --- Player A views prep screen ---
  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), playerA.sessionKey);
  await page.goto(`${baseURL}/prep`, { waitUntil: 'networkidle' });
  await expect(page.locator('.prep-screen')).toBeVisible();
  await saveShot(page, 'challenge-abandon-01-prep.png');

  // --- Player A abandons via API ---
  const abandonResult = await api(request, playerA.sessionKey, `/api/game-run/${runId}/abandon`, 'POST', {});
  expect(abandonResult.status).toBe('abandoned');

  // --- Player B also sees run ended ---
  const runState = await api(request, playerB.sessionKey, `/api/game-run/${runId}`);
  expect(runState.status).toBe('abandoned');

  // --- Neither has active run ---
  const bootA = await api(request, playerA.sessionKey, '/api/bootstrap');
  const bootB = await api(request, playerB.sessionKey, '/api/bootstrap');
  expect(bootA.activeGameRun).toBeNull();
  expect(bootB.activeGameRun).toBeNull();

  // --- Player A's home shows no resume button ---
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.getByRole('button', { name: /resume|продолжить игру/i })).toHaveCount(0);
  await saveShot(page, 'challenge-abandon-02-home-no-resume.png');
});
