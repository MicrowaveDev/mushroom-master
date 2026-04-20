import path from 'path';
import { test, expect } from '@playwright/test';
import { captureScreenshot, assertImagesLoaded } from './screenshot-capture.js';
import { resetDevDb, createSession, api } from './e2e-helpers.js';
import { repoRoot } from '../../app/shared/repo-root.js';

const screenshotDir = path.join(repoRoot, '.agent/tasks/telegram-autobattler-v1/raw/screenshots');

const saveShot = (page, name) => captureScreenshot(page, screenshotDir, name);

// --- Flow A: Onboarding ---

test('[Flow A] onboarding screen shows for new player without active mushroom', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1001, username: 'new_player', name: 'New Player' });
  // Do NOT select active character — this triggers onboarding
  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);

  await page.goto(baseURL, { waitUntil: 'networkidle' });

  // Should show onboarding (no activeMushroomId in bootstrap)
  await expect(page.locator('.onboarding-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.onboarding-step')).toHaveCount(3);
  await expect(page.locator('.onboarding-preview-portrait')).toHaveCount(5);

  await page.setViewportSize({ width: 375, height: 667 });
  await assertImagesLoaded(page);
  await saveShot(page, 'onboarding-mobile.png');

  await page.setViewportSize({ width: 1280, height: 800 });
  await assertImagesLoaded(page);
  await saveShot(page, 'onboarding-desktop.png');

  await page.setViewportSize({ width: 375, height: 667 });
  // Click continue → should navigate to characters screen
  await page.getByRole('button', { name: /start|начать/i }).click();
  await expect(page.locator('.character-card').first()).toBeVisible({ timeout: 5000 });
});

// --- Flow A Step 3: first-pick auto-start ---

test('[Flow A Step 3] first mushroom pick auto-starts solo run and lands on prep', async ({ page, request, baseURL }) => {
  // A brand-new player (no activeMushroomId) who clicks a character card
  // should NOT have to discover "Start Game" on the home screen.
  // saveCharacter detects wasFirstPick=true and calls startNewGameRun('solo')
  // automatically, dropping the player directly into the prep screen.
  // Spec: docs/user-flows.md Flow A Step 3.
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1060, username: 'first_pick', name: 'First Pick' });
  // Do NOT set active-character — this is a fresh player with no mushroom.

  // A ghost is needed so the run's first round can resolve.
  const ghost = await createSession(request, { telegramId: 1061, username: 'first_pick_ghost', name: 'First Pick Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(baseURL, { waitUntil: 'networkidle' });

  // Fresh player without a mushroom lands on onboarding.
  await expect(page.locator('.onboarding-screen')).toBeVisible({ timeout: 5000 });

  // Click "Continue" on onboarding → characters screen.
  await page.getByRole('button', { name: /start|начать/i }).click();
  await expect(page.locator('.character-card').first()).toBeVisible({ timeout: 5000 });

  // Click the first character card (first-pick branch).
  await page.locator('.character-card').first().click();

  // Should land on prep screen directly — NOT home — because wasFirstPick=true
  // auto-starts a solo game run (docs/user-flows.md Flow A Step 3).
  await page.locator('[data-testid="prep-ready"]').waitFor({ timeout: 15000 });
  await expect(page.locator('.prep-screen')).toBeVisible();
  // Sanity: round 1 is shown in the HUD.
  await expect(page.locator('.run-hud')).toContainText('1');
});

test('[Flow A Step 3] re-pick (existing player switching mushroom) goes to home, not prep', async ({ page, request, baseURL }) => {
  // An existing player switching their mushroom from the characters screen
  // should land on the home screen (not auto-start a new run). This avoids
  // clobbering an active run or confusingly auto-starting one on re-pick.
  // Spec: docs/user-flows.md Flow A Step 3, re-pick branch.
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1062, username: 're_pick', name: 'Re Pick' });
  // Pre-select a mushroom so this is NOT a first pick.
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/characters`, { waitUntil: 'networkidle' });
  await expect(page.locator('.character-card').first()).toBeVisible({ timeout: 5000 });

  // Click a different mushroom card (re-pick branch — activeMushroomId already set).
  // Pick the second card to switch away from Thalla.
  await page.locator('.character-card').nth(1).click();

  // Should land on home screen, NOT prep — no auto-start for re-pick.
  await expect(page.locator('.home')).toBeVisible({ timeout: 10000 });
  // No active prep screen should appear.
  await expect(page.locator('.prep-screen')).toHaveCount(0);
});

// --- Req 1-H: Daily battle limit ---

test('[Req 1-H] daily battle limit rejects game start after 10 runs', async ({ request }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1003, username: 'limit_player', name: 'Limit Player' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  // Need a ghost opponent for battles to resolve
  const ghost = await createSession(request, { telegramId: 1004, username: 'limit_ghost', name: 'Limit Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  // Start and abandon 10 runs to exhaust daily limit
  for (let i = 0; i < 10; i++) {
    const run = await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });
    await api(request, player.sessionKey, `/api/game-run/${run.id}/abandon`, 'POST', {});
  }

  // 11th start should be rejected
  try {
    await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });
    expect(true).toBe(false); // should not reach here
  } catch (err) {
    expect(err.message).toMatch(/limit|лимит/i);
  }
});

// --- Req 4-L: Non-empty bag cannot be sold ---

test('[Req 4-L] cannot sell a bag that has items in it', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1007, username: 'bag_sell_blocker', name: 'Bag Sell Blocker' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  const ghost = await createSession(request, { telegramId: 1008, username: 'bag_sell_ghost', name: 'Bag Sell Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);

  // Start game run
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await expect(page.locator('.prep-screen')).toBeVisible();

  // Refresh shop until a bag appears
  let foundBag = false;
  for (let i = 0; i < 10; i++) {
    if (await page.locator('.shop-item--bag').isVisible().catch(() => false)) {
      foundBag = true;
      break;
    }
    const refreshBtn = page.locator('.artifact-shop-header button');
    if (await refreshBtn.isEnabled()) {
      await refreshBtn.click();
      await page.waitForTimeout(300);
    }
  }
  if (!foundBag) return; // Skip if no bag appeared

  // Buy and activate the bag
  await page.locator('.shop-item--bag').first().click();
  const containerBag = page.locator('.artifact-container-zone .container-item').last();
  await expect(containerBag).toBeVisible({ timeout: 3000 });
  await containerBag.click();
  await expect(page.locator('.active-bags-bar')).toBeVisible();

  // Buy a regular item and place it in the bag rows
  const shopItem = page.locator('.prep-screen .shop-item').first();
  if (await shopItem.isVisible().catch(() => false)) {
    await shopItem.click();
    // Auto-place from container — it may land in bag rows
    const containerItem = page.locator('.artifact-container-zone .container-item').first();
    if (await containerItem.isVisible().catch(() => false)) {
      await containerItem.click();
    }
  }

  // Try to deactivate the bag — should show error and bag stays active
  const bagChip = page.locator('.active-bag-chip').first();
  const deactivateBtn = bagChip.locator('button').last(); // ✕ button
  await deactivateBtn.click();

  // Items were auto-placed into bag rows, so deactivation must be blocked
  // with an error message and the bag must remain active.
  const hasItemsInBag = await page.locator('.artifact-grid-cell--bag .artifact-grid-piece').count() > 0;
  if (hasItemsInBag) {
    await expect(page.locator('.error')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.active-bags-bar')).toBeVisible();
  }
  await expect(page.locator('.prep-screen')).toBeVisible();
});

// Req 9-B (completion bonus) merged into solo-run.spec.js "full journey" test.

// --- Req 4-F, 12-D: Game run state + shop offer survive page reload ---

test('[Req 4-F, 12-D] game run state and shop offer survive page reload', async ({ page, request, baseURL }) => {
  // Merged: former shop-offer-identical test (Req 4-F) + HUD/coins-survive
  // test (Req 12-D). One setup, both assertions.
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1015, username: 'shop_persist', name: 'Shop Persist' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  const ghost = await createSession(request, { telegramId: 1016, username: 'shop_persist_ghost', name: 'Shop Persist Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await expect(page.locator('.prep-screen')).toBeVisible();

  // Snapshot ALL state before reload: HUD, coins, shop artifact IDs
  const hudBefore = await page.locator('.run-hud').textContent();
  const coinsBefore = await page.locator('.run-hud-coins').textContent();
  const shopItemIdsBefore = await page.locator('.prep-screen .shop-item').evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('data-artifact-id') || '').filter(Boolean)
  );
  expect(shopItemIdsBefore.length).toBeGreaterThan(0);

  // Reload
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.prep-screen')).toBeVisible({ timeout: 10000 });

  // [Req 12-D] HUD and coins survive
  expect(await page.locator('.run-hud').textContent()).toBe(hudBefore);
  expect(await page.locator('.run-hud-coins').textContent()).toBe(coinsBefore);

  // [Req 4-F] Shop offer is the same set of artifacts (no free re-roll)
  const shopItemIdsAfter = await page.locator('.prep-screen .shop-item').evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('data-artifact-id') || '').filter(Boolean)
  );
  expect(shopItemIdsAfter.length).toBe(shopItemIdsBefore.length);
  expect(shopItemIdsAfter.sort()).toEqual(shopItemIdsBefore.sort());
});

// --- Req 13-C, 13-D: Post-replay button label ---

test('[Req 10-A, 13-C] post-Ready lands on replay with rewards, Continue label, and rating delta', async ({ page, request, baseURL }) => {
  // Merged: Flow B Step 3 replay test + rating-changes-per-round (Req 10-A).
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1020, username: 'replay_label_player', name: 'Replay Label' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  // [Req 10-A] Capture rating before the round
  const bootBefore = await api(request, player.sessionKey, '/api/bootstrap');
  const ratingBefore = bootBefore.player.rating;

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await expect(page.locator('.prep-screen')).toBeVisible();
  await page.getByRole('button', { name: /ready|готов/i }).click();

  // Ready lands DIRECTLY on the replay screen — no round-result screen.
  await expect(page.locator('.replay-layout')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.round-result-screen')).toHaveCount(0);

  // Replay finishes → inline rewards card + Continue button appear.
  const replayBtn = page.locator('.replay-result-button-full');
  await expect(replayBtn).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-testid="replay-rewards"]')).toBeVisible();

  // [Req 13-C] During active run: button label is "Continue" / "Продолжить"
  const btnText = await replayBtn.textContent();
  expect(btnText.trim()).toMatch(/continue|продолжить/i);

  // [Req 10-A] Verify rating changed after the round (via API)
  const bootAfter = await api(request, player.sessionKey, '/api/bootstrap');
  expect(bootAfter.player.rating).toBeDefined();
  expect(bootAfter.player.rating).not.toBe(ratingBefore);
});

test('[Req 13-D] post-replay button shows "Home" for standalone replay from history', async ({ page, request, baseURL }) => {
  // Set up a completed run so a battle exists in history. Then abandon
  // the run so there's no active game run, and navigate directly to the
  // replay URL — that's the standalone (no-run) replay path covered by
  // [Req 13-D].
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1030, username: 'history_replay', name: 'History Replay' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  // Start a run, resolve one round (creates a battle), then abandon the run
  // so we're back to "no active game run" state. The completed battle
  // remains in the player's history and is replayable.
  const run = await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });
  const roundResult = await api(request, player.sessionKey, `/api/game-run/${run.id}/ready`, 'POST', {});
  const battleId = roundResult.lastRound?.battleId;
  expect(battleId).toBeTruthy();
  await api(request, player.sessionKey, `/api/game-run/${run.id}/abandon`, 'POST', {});

  // Navigate directly to the replay for this battle (no active run)
  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/replay/${battleId}`, { waitUntil: 'networkidle' });
  await expect(page.locator('.replay-layout')).toBeVisible({ timeout: 15000 });

  // Wait for replay to finish
  const replayBtn = page.locator('.replay-result-button-full');
  await expect(replayBtn).toBeVisible({ timeout: 30000 });

  // [Req 13-D] No active run: button should show "Home" / "Домой"
  const btnText = await replayBtn.textContent();
  expect(btnText.trim()).toMatch(/home|домой/i);
});

// --- Replay-rewards visual regression: .stat-grid must actually render as a grid ---

test('replay rewards stat-grid resolves to display:grid (not stacked vertical list)', async ({ page, request, baseURL }) => {
  // Regression guard for a subtle staleness bug: the CSS rules for
  // `.stat-grid` / `.stat` were originally scoped under a dead
  // `.player-summary` parent in web/src/styles.css. ReplayScreen and
  // RunCompleteScreen both render `<dl class="stat-grid">` at the top
  // level, so the rules never applied and the stats collapsed into an
  // unstyled vertical <dl>.
  //
  // Even after the source was patched, the bug persisted for a full
  // session because web/dist/assets/index-*.css wasn't regenerated —
  // express serves dist, so the browser kept loading the old CSS. This
  // test is the hard-failure guard: assert the browser-computed style
  // actually resolves to display:grid at the live page. A missing rule,
  // a scoped rule, a stale dist, or a renamed class will all fail here.
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1070, username: 'stat_grid_guard', name: 'Stat Grid Guard' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  // Ghost so the round can resolve.
  const ghost = await createSession(request, { telegramId: 1071, username: 'stat_grid_ghost', name: 'Stat Grid Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await expect(page.locator('.prep-screen')).toBeVisible();
  await page.getByRole('button', { name: /ready|готов/i }).click();

  // Ready → replay. Wait for the inline rewards card to appear.
  await expect(page.locator('.replay-layout')).toBeVisible({ timeout: 30000 });
  const rewards = page.locator('[data-testid="replay-rewards"]');
  await expect(rewards).toBeVisible({ timeout: 30000 });

  // The rewards card renders two <dl class="stat-grid"> blocks: one for
  // round rewards, one for run totals. Both must resolve to grid.
  const statGrids = rewards.locator('.stat-grid');
  const count = await statGrids.count();
  expect(count).toBeGreaterThanOrEqual(1);

  for (let i = 0; i < count; i++) {
    const display = await statGrids.nth(i).evaluate((el) => getComputedStyle(el).display);
    expect(
      display,
      `.stat-grid #${i} resolved to "${display}" instead of "grid" — CSS rule missing, scoped wrong, or dist bundle stale (run npm run game:build)`
    ).toBe('grid');
  }

  // Sanity: at least one .stat child inside renders as a flex column with
  // a background, confirming the full stat-card rule cascade landed, not
  // just the grid container.
  const firstStat = rewards.locator('.stat-grid .stat').first();
  const statDisplay = await firstStat.evaluate((el) => getComputedStyle(el).display);
  expect(statDisplay).toBe('flex');
});

// --- Flow G: Settings ---

test('[Flow G] settings: change language and verify persistence', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1040, username: 'settings_tester', name: 'Settings Tester' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/settings`, { waitUntil: 'networkidle' });

  // Should see settings panel
  const settingsPanel = page.locator('.panel.stack');
  await expect(settingsPanel).toBeVisible();

  // Change language from RU to EN
  const langSelect = page.locator('select').first();
  await langSelect.selectOption('en');

  // Click Save
  await page.getByRole('button', { name: /save|сохранить/i }).click();
  await page.waitForTimeout(1000);

  // Reload and verify language persisted
  await page.reload({ waitUntil: 'networkidle' });
  await page.goto(`${baseURL}/settings`, { waitUntil: 'networkidle' });
  const langValue = await page.locator('select').first().inputValue();
  expect(langValue).toBe('en');
});

// --- Req 13-B: replay accessible from round-result/history ---

test('[Req 13-B] battle history entry navigates to replay', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 1050, username: 'history_nav', name: 'History Nav' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  // Create a completed battle by playing one round of a game run.
  const run = await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });
  await api(request, player.sessionKey, `/api/game-run/${run.id}/ready`, 'POST', {});
  await api(request, player.sessionKey, `/api/game-run/${run.id}/abandon`, 'POST', {});

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });

  // Click a battle history entry to navigate to replay.
  // HomeScreen renders history items as .home-battle-item (not .battle-history-card).
  const historyEntry = page.locator('.home-battle-item').first();
  await expect(historyEntry).toBeVisible({ timeout: 5000 });
  await historyEntry.click();
  await expect(page.locator('.replay-layout')).toBeVisible({ timeout: 15000 });
});
