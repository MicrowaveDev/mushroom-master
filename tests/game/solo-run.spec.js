import path from 'path';
import { test, expect } from '@playwright/test';
import { captureScreenshot, assertImagesLoaded, assertNoHorizontalOverflow, assertAtTop } from './screenshot-capture.js';
import { resetDevDb, createSession, api, waitForPrepReady, MOBILE_VIEWPORT, DESKTOP_VIEWPORT } from './e2e-helpers.js';
import { repoRoot } from '../../app/shared/repo-root.js';

const screenshotDir = path.join(repoRoot, '.agent/tasks/telegram-autobattler-v1/raw/screenshots/run');

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

const saveShot = async (page, name) => {
  await captureScreenshot(page, screenshotDir, name);
  await assertImagesLoaded(page);
  await assertNoHorizontalOverflow(page);
};

/**
 * Sell the container item identified by `artifactId` via the direct API.
 *
 * The alternative — using Playwright's `dragTo` to drop the container item
 * onto the sell zone — is flaky for HTML5 drag handlers in headless
 * Chromium: the synthesized mouse events don't reliably trigger the Vue
 * @dragstart/@drop handlers because the browser's DataTransfer isn't
 * populated the way the app expects. The *behavior* under test is "after a
 * reload, the bag persists in the container AND can still be sold"; that's
 * server-side state, not drag-and-drop ergonomics, and is best verified by
 * hitting the same endpoint the click path would hit.
 */
async function sellContainerItemViaApi(page, request, sessionKey, gameRunId, artifactId) {
  const response = await request.fetch(`/api/game-run/${gameRunId}/sell`, {
    method: 'POST',
    headers: { 'X-Session-Key': sessionKey, 'Content-Type': 'application/json' },
    data: { artifactId }
  });
  const json = await response.json();
  if (!json.success) throw new Error(`sell failed for ${artifactId}: ${JSON.stringify(json)}`);
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);
}

/**
 * Deterministically put `artifactIds` into the current round's shop, then
 * reload so the UI picks up the new offer, then click the first entry to
 * buy it. Replaces the old `findAndBuyBag` polling loop that flaked on
 * cold Vite: instead of refreshing the shop up to 30 times hoping the
 * pity system eventually rolls the target, we overwrite the shop state
 * directly via a dev-only endpoint. See docs/flaky-tests.md.
 */
async function forceShopAndBuy(page, request, sessionKey, gameRunId, artifactId) {
  const response = await request.fetch(`/api/dev/game-run/${gameRunId}/force-shop`, {
    method: 'POST',
    headers: { 'X-Session-Key': sessionKey, 'Content-Type': 'application/json' },
    data: { artifactIds: [artifactId] }
  });
  const json = await response.json();
  if (!json.success) throw new Error(`force-shop failed for ${artifactId}: ${JSON.stringify(json)}`);
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);
  await page.locator(`.shop-item[data-artifact-id="${artifactId}"]`).click();
  await expect(page.locator(`.artifact-container-zone .container-item[data-artifact-id="${artifactId}"]`))
    .toBeVisible({ timeout: 5000 });
}

test('[Req 1-A, 4-B, 4-D, 4-F, 9-B, 11-B, 12-D, 13-A] solo game run: full journey with screenshots', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  await page.setViewportSize(MOBILE_VIEWPORT);

  const player = await createSession(request, { telegramId: 901, username: 'solo_runner', name: 'Solo Runner' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  const ghost = await createSession(request, { telegramId: 902, username: 'ghost_player', name: 'Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);

  // --- Home screen with "Start Game" button ---
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await expect(page.locator('.home')).toBeVisible();
  await assertImagesLoaded(page);
  await saveShot(page, 'solo-01-home-start-game.png');

  // --- Start game run → prep screen ---
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await waitForPrepReady(page);
  const hud = page.locator('.run-hud');
  const roundHeading = page.locator('.run-round-heading');
  await expect(roundHeading).toContainText('1');
  await assertImagesLoaded(page);
  await saveShot(page, 'solo-02-prep-round1.png');
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.evaluate(() => window.scrollTo(0, 0));
  const hudBox = await page.locator('.run-hud').boundingBox();
  const containerBox = await page.locator('.artifact-container-zone').boundingBox();
  const inventoryBox = await page.locator('.artifact-inventory-section').boundingBox();
  const shopBox = await page.locator('.artifact-shop').boundingBox();
  const readyBox = await page.getByRole('button', { name: /ready|готов/i }).boundingBox();
  expect(hudBox && containerBox && inventoryBox && shopBox && readyBox, 'desktop prep landmarks must have bounding boxes').toBeTruthy();
  expect(hudBox.y + hudBox.height, 'desktop prep HUD should sit above both workspace columns').toBeLessThanOrEqual(Math.min(containerBox.y, shopBox.y));
  expect(Math.abs(shopBox.y - containerBox.y), 'desktop prep shop and left column should share a top edge').toBeLessThanOrEqual(8);
  expect(shopBox.x, 'desktop prep shop should sit to the right of inventory').toBeGreaterThan(inventoryBox.x + inventoryBox.width);
  expect(readyBox.y + readyBox.height, 'desktop prep Ready button should be visible without scroll').toBeLessThanOrEqual(DESKTOP_VIEWPORT.height);
  await expect(page.getByRole('button', { name: /ready|готов/i })).toBeVisible();
  await saveShot(page, 'solo-02-prep-round1-desktop.png');
  await page.setViewportSize(MOBILE_VIEWPORT);

  // --- Shop has items ---
  const shopItems = page.locator('.prep-screen .shop-item');
  const shopCount = await shopItems.count();
  expect(shopCount).toBeGreaterThan(0);

  // --- Buy first shop item ---
  const firstShopItem = shopItems.first();
  const firstItemId = await firstShopItem.getAttribute('data-artifact-id') || '';
  if (firstItemId) {
    await firstShopItem.click();
    await expect(page.locator(`.container-item[data-artifact-id="${firstItemId}"]`)).toHaveCount(1, { timeout: 5000 });
    await saveShot(page, 'solo-03-bought-item-in-container.png');
  }

  // --- Sell zone visible ---
  await expect(page.locator('.sell-zone')).toBeVisible();

  // --- Signal ready → replay autoplays → inline rewards card ---
  // Spec: docs/user-flows.md Flow B Step 3. Post-Ready lands directly on
  // the replay screen (no intermediate round-result). The rewards card
  // renders inline once the replay finishes, via the [data-testid="replay-rewards"]
  // element inside .replay-layout.
  await page.getByRole('button', { name: /ready|готов/i }).click();
  await expect(page.locator('.replay-layout')).toBeVisible({ timeout: 30000 });
  await assertAtTop(page);
  await assertImagesLoaded(page);
  await saveShot(page, 'solo-04-round-replay.png');

  // Wait for the replay to finish and the inline rewards card to appear.
  const replayContinueBtn = page.locator('.replay-result-button-full');
  await expect(replayContinueBtn).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-testid="replay-rewards"]')).toBeVisible();
  await saveShot(page, 'solo-04b-round-rewards.png');

  // Continue button label must be "Продолжить" / "Continue" during an active run.
  const continueBtnLabel = (await replayContinueBtn.textContent())?.trim() || '';
  expect(continueBtnLabel).toMatch(/continue|продолжить/i);

  await replayContinueBtn.click();

  // After replay continue, we land on prep (round 2) or run complete
  const afterReplay = page.locator('.prep-screen, .run-complete-screen');
  await expect(afterReplay).toBeVisible({ timeout: 10000 });

  if (await page.locator('.prep-screen').isVisible()) {
    await expect(roundHeading).toContainText('2');

    // --- Shop has items after round 1 ---
    const round2ShopItems = page.locator('.prep-screen .shop-item');
    await expect(round2ShopItems.first()).toBeVisible({ timeout: 5000 });
    const round2ShopCount = await round2ShopItems.count();
    expect(round2ShopCount).toBeGreaterThan(0);
    await saveShot(page, 'solo-05-prep-round2.png');

    // --- Refresh shop ---
    const refreshBtn = page.locator('.prep-screen .artifact-shop-header button');
    if (await refreshBtn.isEnabled()) {
      await refreshBtn.click();
      await page.waitForTimeout(500);
      await saveShot(page, 'solo-06-shop-refreshed.png');
    }

    // --- Page refresh persistence ---
    await page.reload({ waitUntil: 'networkidle' });
    await waitForPrepReady(page);
    await expect(roundHeading).toContainText('2');
    await saveShot(page, 'solo-07-persisted-after-reload.png');

    // --- Play remaining rounds until run completes ---
    // Subsequent rounds: ready → replay (autoplay + inline rewards) →
    // Continue → next prep. We don't re-screenshot every round; the
    // canonical capture is round 1.
    for (let round = 0; round < 10; round++) {
      if (!(await page.locator('.prep-screen').isVisible().catch(() => false))) break;
      if (round === 0) await saveShot(page, 'solo-08-mid-round-prep.png');

      await page.getByRole('button', { name: /ready|готов/i }).click();
      // Post-Ready lands on replay (or run-complete directly if run ended).
      const settled = await Promise.race([
        page.locator('.replay-layout').waitFor({ timeout: 30000 }).then(() => 'replay'),
        page.locator('.run-complete-screen').waitFor({ timeout: 30000 }).then(() => 'runComplete')
      ]);
      if (settled === 'runComplete') break;
      // Wait for replay to finish, then click Continue to advance.
      await expect(page.locator('.replay-result-button-full')).toBeVisible({ timeout: 30000 });
      await page.locator('.replay-result-button-full').click();
      await expect(page.locator('.prep-screen, .run-complete-screen')).toBeVisible({ timeout: 15000 });
    }
  }

  // --- Run complete screen + completion bonus [Req 9-B] ---
  await expect(page.locator('.run-complete-screen')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.run-complete-card')).toBeVisible();
  // Verify completion bonus is displayed (merged from coverage-gaps Req 9-B).
  // The stat-grid inside run-complete-card shows spore/mycelium bonus.
  const completeCard = page.locator('.run-complete-card');
  await expect(completeCard.locator('.stat-grid')).toBeVisible();
  await saveShot(page, 'solo-09-run-complete.png');

  // --- Go home ---
  await page.getByRole('button', { name: /home|домой/i }).click();
  await expect(page.locator('.home')).toBeVisible();
  await saveShot(page, 'solo-10-home-after-run.png');
});

test('[Req 1-F] solo game run: abandon mid-game with screenshots', async ({ page, request, baseURL }) => {
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 903, username: 'abandoner', name: 'Abandoner' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await waitForPrepReady(page);
  await saveShot(page, 'solo-abandon-01-prep.png');

  await page.getByRole('button', { name: /abandon|покинуть/i }).click();
  await expect(page.locator('.home')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /resume|продолжить игру/i })).toHaveCount(0);
  await saveShot(page, 'solo-abandon-02-home-no-resume.png');
});

test('[Req 5-A, 5-C, 2-B, 12-D] bag activation, expansion, and reload persistence', async ({ page, request, baseURL }) => {
  // Merged: former "bag activation persists across reload" (polling) +
  // "amber satchel activates & expands grid" (deterministic). Uses
  // forceShopAndBuy for deterministic bag injection instead of polling.
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 920, username: 'bag_tester', name: 'Bag Tester' });

  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  const ghost = await createSession(request, { telegramId: 921, username: 'bag_ghost', name: 'Bag Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);

  // Start a game run
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await waitForPrepReady(page);

  // Unified grid: BAG_COLUMNS × BAG_ROWS = 6×6 = 36 cells when no bag has
  // been activated yet. The base inventory occupies the top-left 3×3 (9
  // cells); the remaining 27 cells are empty bag area (visible drop
  // targets for bag-chip drag).
  const inventoryGrid = page.locator('.artifact-inventory-grid .artifact-grid-background');
  const baseCells = await inventoryGrid.locator('> *').count();
  expect(baseCells).toBe(36);
  expect(await inventoryGrid.locator('.artifact-grid-cell--base-inv').count()).toBe(9);

  // Deterministically place amber_satchel in the shop, then buy it.
  const bootstrap = await api(request, player.sessionKey, '/api/bootstrap');
  await forceShopAndBuy(page, request, player.sessionKey, bootstrap.activeGameRun.id, 'amber_satchel');

  // Verify it appeared in the container
  const containerItem = page.locator('.artifact-container-zone .container-item').last();
  await expect(containerItem).toBeVisible({ timeout: 3000 });
  const containerCountBefore = await page.locator('.artifact-container-zone .container-item').count();

  // Click the bag in container to activate it
  await containerItem.click();

  // Bag should NOT be in container anymore
  const containerCountAfter = await page.locator('.artifact-container-zone .container-item').count();
  expect(containerCountAfter).toBe(containerCountBefore - 1);

  // Bag should be active: chip bar visible with 1 bag
  await expect(page.locator('.active-bags-bar')).toBeVisible();
  await expect(page.locator('.active-bag-chip')).toHaveCount(1);

  // Bag cells (= 4 slot cells for amber_satchel 2x2) appear in the grid.
  // amber anchors at (3, 0) under the unified packer — alongside the base
  // inventory — so the total cell count stays at 18 (no row added).
  const bagCells = inventoryGrid.locator('.artifact-grid-cell--bag');
  const bagCellCount = await bagCells.count();
  expect(bagCellCount).toBe(4);

  await saveShot(page, 'solo-bag-01-activated.png');

  // --- Reload persistence (formerly separate test) ---
  const cellsBefore = await page.locator('.artifact-grid-cell, .artifact-grid-cell--bag').count();
  const placedBefore = await page.locator('.inventory-pieces .artifact-piece').count();

  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);

  // Bag state survived reload
  await expect(page.locator('.active-bags-bar')).toBeVisible();
  await expect(page.locator('.active-bag-chip')).toHaveCount(1);
  expect(await page.locator('.artifact-grid-cell--bag').count()).toBe(bagCellCount);
  expect(await page.locator('.artifact-grid-cell, .artifact-grid-cell--bag').count()).toBe(cellsBefore);
  expect(await page.locator('.inventory-pieces .artifact-piece').count()).toBe(placedBefore);

  await saveShot(page, 'solo-bag-02-after-reload.png');
});

test('round transitions: replay → continue → next prep (not home) while lives remain', async ({ page, request, baseURL }) => {
  // Covers the "after a round I see Home instead of Continue" scenario.
  // Verifies that after finishing a battle replay:
  //   - While lives > 0 and rounds < max → next prep screen appears (new round HUD)
  //   - When run ends (lives=0 or max rounds) → RunCompleteScreen with Home button
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 970, username: 'round_tx', name: 'Round TX' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  const ghost = await createSession(request, { telegramId: 971, username: 'round_ghost', name: 'Round Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await waitForPrepReady(page);

  const hud = page.locator('.run-hud');
  const roundHeading = page.locator('.run-round-heading');
  await expect(roundHeading).toContainText('1'); // round 1

  // --- Round 1: signal ready → replay autoplays → inline rewards → Continue → round 2 prep ---
  // Spec: docs/user-flows.md Flow B Step 3. Post-Ready lands directly on
  // the replay screen, which autoplays then renders the rewards card.
  await page.getByRole('button', { name: /ready|готов/i }).click();
  await expect(page.locator('.replay-layout')).toBeVisible({ timeout: 30000 });

  // Wait for the replay to finish — the inline rewards card appears alongside
  // the Continue button.
  const replayActionBtn = page.locator('.replay-result-button-full');
  await expect(replayActionBtn).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-testid="replay-rewards"]')).toBeVisible();

  // The button label must be Continue/Продолжить while the run is still live
  // (lives > 0, rounds < max). onReplayFinish routes to runComplete automatically
  // for the final battle — that case is covered by the outer loop below.
  const btnLabel = (await replayActionBtn.textContent())?.trim();
  expect(btnLabel).toMatch(/continue|продолжить/i);

  await replayActionBtn.click();

  // Should be on prep screen for round 2 — NOT runComplete or results
  await waitForPrepReady(page);
  await expect(roundHeading).toContainText('2');
  await expect(page.locator('.run-complete-screen')).toHaveCount(0);
  await expect(page.locator('.results-screen')).toHaveCount(0);

  // --- Play out remaining rounds until run completes ---
  // Every subsequent round: ready → replay → Continue → next prep, OR
  // if this was the final battle, Ready resolves directly to runComplete
  // via onReplayFinish. Outcomes are non-deterministic; loop until
  // RunComplete or safety counter expires.
  let safetyCounter = 0;
  while (safetyCounter++ < 15) {
    const currentRoundText = await hud.textContent().catch(() => '?');
    const readyBtn = page.getByRole('button', { name: /ready|готов/i });
    if (!(await readyBtn.isVisible().catch(() => false))) {
      throw new Error(`No ready button visible on iteration ${safetyCounter}, HUD=${currentRoundText}`);
    }
    await readyBtn.click();

    // Post-Ready lands on replay (or run-complete directly if the run ended).
    const settled = await Promise.race([
      page.locator('.replay-layout').waitFor({ timeout: 30000 }).then(() => 'replay'),
      page.locator('.run-complete-screen').waitFor({ timeout: 30000 }).then(() => 'runComplete')
    ]);

    if (settled === 'runComplete') {
      const homeBtn = page.locator('.run-complete-screen').getByRole('button', { name: /home|домой/i });
      await expect(homeBtn).toBeVisible();
      return;
    }

    // Replay screen: wait for Continue, click it.
    await expect(page.locator('.replay-result-button-full')).toBeVisible({ timeout: 30000 });
    await page.locator('.replay-result-button-full').click();
    await page.waitForTimeout(500);

    if (await page.locator('.prep-screen').isVisible().catch(() => false)) continue;
    if (await page.locator('.run-complete-screen').isVisible().catch(() => false)) {
      const homeBtn = page.locator('.run-complete-screen').getByRole('button', { name: /home|домой/i });
      await expect(homeBtn).toBeVisible();
      return;
    }

    // Unexpected screen — log what we see
    const visibleSections = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('section, .results-screen, .run-complete-screen, .prep-screen, .replay-layout'))
        .filter(el => el.offsetParent !== null)
        .map(el => el.className);
    });
    throw new Error(`Unexpected screen after iteration ${safetyCounter} (HUD=${currentRoundText}) — got sections: ${JSON.stringify(visibleSections)}`);
  }
  throw new Error('Run did not complete within safety limit');
});

test('game run loadout budget scales with current round (not legacy 5-coin cap)', async ({ request }) => {
  // API-level integration test verifying that the coin budget grows with each round
  // instead of being capped at the legacy MAX_ARTIFACT_COINS (5). Walks through 5
  // rounds, accumulating purchases, and verifies each ready/save call succeeds
  // with the budget matching sum(ROUND_INCOME[0..currentRound]).
  const ROUND_INCOME = [5, 5, 5, 6, 6, 7, 7, 8, 8];

  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 960, username: 'api_budget', name: 'API Budget' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  const ghost = await createSession(request, { telegramId: 961, username: 'api_ghost', name: 'API Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  const bootstrap = await api(request, player.sessionKey, '/api/bootstrap');
  const findArtifact = (id) => bootstrap.artifacts.find((a) => a.id === id);

  // Start game run — player starts with 5 coins (round 1 income)
  const run = await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });
  expect(run.player?.coins).toBe(ROUND_INCOME[0]);

  const owned = [];

  // Walk through 5 rounds, buying as many items as possible each round and verifying
  // budget/save/ready all succeed as purchases accumulate.
  for (let round = 1; round <= 5; round++) {
    const runBefore = await api(request, player.sessionKey, `/api/game-run/${run.id}`);
    const coinsBefore = runBefore.players.find((p) => p.playerId === player.player.id)?.coins
      ?? runBefore.players[0]?.coins;

    // Buy items greedily: refresh shop until no affordable items remain or we cap at 4 buys
    let boughtThisRound = 0;
    for (let i = 0; i < 4; i++) {
      const state = await api(request, player.sessionKey, `/api/game-run/${run.id}`);
      const affordable = state.shopOffer.find((id) => {
        const art = findArtifact(id);
        const remaining = state.players.find((p) => p.playerId === player.player.id)?.coins ?? 0;
        return art && art.price <= remaining;
      });
      if (!affordable) break;
      try {
        await api(request, player.sessionKey, `/api/game-run/${run.id}/buy`, 'POST', { artifactId: affordable });
        owned.push(affordable);
        boughtThisRound++;
      } catch { break; }
    }

    const runAfterBuys = await api(request, player.sessionKey, `/api/game-run/${run.id}`);
    const coinsAfterBuys = runAfterBuys.players.find((p) => p.playerId === player.player.id)?.coins
      ?? runAfterBuys.players[0]?.coins;
    expect(coinsAfterBuys).toBeLessThanOrEqual(coinsBefore);

    // Compute total cost of everything owned — this is what the server validates
    const totalOwnedCost = owned.reduce((sum, id) => sum + (findArtifact(id)?.price || 0), 0);

    // Expected budget for this round: cumulative income up to and including this round
    const expectedBudget = ROUND_INCOME.slice(0, round).reduce((sum, c) => sum + c, 0);

    // Sanity check: server's budget must cover what the player actually owns
    expect(totalOwnedCost).toBeLessThanOrEqual(expectedBudget);

    // Save loadout with all owned items in the container (x=-1, y=-1)
    const items = owned.map((id) => {
      const art = findArtifact(id);
      return { artifactId: id, x: -1, y: -1, width: art.width, height: art.height };
    });
    // This call uses the round-scaled budget on the server. In round 2+, totalOwnedCost
    // routinely exceeds the legacy 5-coin cap — used to 500 with "Loadout exceeds 5-coin budget".
    await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', {
      mushroomId: 'thalla',
      items
    });

    // Resolve the round — uses getActiveSnapshot which also applies the round-scaled budget.
    const result = await api(request, player.sessionKey, `/api/game-run/${run.id}/ready`, 'POST');
    expect(result.lastRound).toBeTruthy();
    expect(['win', 'loss']).toContain(result.lastRound.outcome);

    // After the round resolves, the server advances current_round and adds next round income.
    // If the run ends (all lives lost), stop early.
    if (result.status === 'completed' || result.status === 'abandoned') break;

    // Verify coins incremented by the next round's income
    const nextRoundIncome = ROUND_INCOME[round] || 0;
    const expectedCoinsNext = coinsAfterBuys + nextRoundIncome;
    expect(result.player.coins).toBe(expectedCoinsNext);
  }
});

test('items, bags, and sell state all survive page reload', async ({ page, request, baseURL }) => {
  // Merged: former "multiple items survive reload" + "sell bag from container
  // after reload" + "sell 2nd bag when another active". One setup, all
  // reload-persistence scenarios in sequence.
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 980, username: 'reload_tester', name: 'Reload' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  const ghost = await createSession(request, { telegramId: 981, username: 'reload_ghost', name: 'Reload Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await waitForPrepReady(page);

  const bs = await api(request, player.sessionKey, '/api/bootstrap');
  const runId = bs.activeGameRun.id;

  // --- Part 1: base items survive reload ---
  const placedBefore = await page.locator('.inventory-pieces .artifact-piece').count();
  const placedIdsBefore = await page.locator('.inventory-pieces .artifact-piece').evaluateAll(
    (els) => els.map((el) => el.getAttribute('data-artifact-id')).sort()
  );
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);
  expect(await page.locator('.inventory-pieces .artifact-piece').count()).toBe(placedBefore);
  expect(
    await page.locator('.inventory-pieces .artifact-piece').evaluateAll(
      (els) => els.map((el) => el.getAttribute('data-artifact-id')).sort()
    )
  ).toEqual(placedIdsBefore);

  await saveShot(page, 'solo-reload-items-persist.png');

  // --- Part 2: buy moss_pouch, activate, buy amber_satchel (leave in container), reload ---
  await forceShopAndBuy(page, request, player.sessionKey, runId, 'moss_pouch');
  await page.locator('.artifact-container-zone .container-item[data-artifact-id="moss_pouch"]').click();
  await expect(page.locator('.active-bag-chip')).toHaveCount(1);

  await forceShopAndBuy(page, request, player.sessionKey, runId, 'amber_satchel');
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="amber_satchel"]')).toBeVisible();

  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);

  // 1 active bag (moss_pouch), 1 container bag (amber_satchel)
  await expect(page.locator('.active-bag-chip')).toHaveCount(1);
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="amber_satchel"]')).toBeVisible();

  await saveShot(page, 'solo-two-bags-sell-after-reload.png');

  // --- Part 3: sell container bag after reload, active bag stays ---
  const bs2 = await api(request, player.sessionKey, '/api/bootstrap');
  await sellContainerItemViaApi(page, request, player.sessionKey, bs2.activeGameRun.id, 'amber_satchel');
  await expect(page.locator('.artifact-container-zone .container-item[data-artifact-id="amber_satchel"]')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.active-bag-chip')).toHaveCount(1);

  await saveShot(page, 'solo-bag-sell-after-reload.png');
});

test('[Req 2-F, 2-G, 2-H] unified grid packs bags alongside the base inventory', async ({ page, request, baseURL }) => {
  // Phase 1 of bag-grid-unification: the prep panel is one unified grid
  // (BAG_COLUMNS=6 wide). The base inventory occupies (0..2, 0..2) as a
  // virtual obstacle; activated bags pack into the first free cell the
  // 2D first-fit packer can find — including alongside the base inventory
  // in cols 3..5 of rows 0..2. Two bags totalling 5 coins (moss 2c +
  // amber 3c) fit the round-1 budget. Under the legacy stacked layout
  // amber would have anchored below moss; under the unified packer it
  // anchors at (3, 1) — alongside the base inv, below moss in row 1.
  // The chip-lock contract (data-bag-locked + tooltip) is covered by
  // tests/web/use-shop.test.js [Req 2-H] tests.
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 940, username: 'bag_packer', name: 'Bag Packer' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });

  const ghost = await createSession(request, { telegramId: 941, username: 'bag_packer_ghost', name: 'Bag Packer Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await waitForPrepReady(page);

  const bootstrap = await api(request, player.sessionKey, '/api/bootstrap');
  // Force both bags into the shop and buy them. Total cost = 2 + 3 = 5
  // (matches MAX_ARTIFACT_COINS for round 1).
  await forceShopAndBuy(page, request, player.sessionKey, bootstrap.activeGameRun.id, 'moss_pouch');
  await forceShopAndBuy(page, request, player.sessionKey, bootstrap.activeGameRun.id, 'amber_satchel');

  // Activate both bags by clicking their container slots.
  await page.locator('.artifact-container-zone .container-item[data-artifact-id="moss_pouch"]').first().click();
  await expect(page.locator('.active-bag-chip[data-bag-row-id]')).toHaveCount(1);
  await page.locator('.artifact-container-zone .container-item[data-artifact-id="amber_satchel"]').first().click();
  await expect(page.locator('.active-bag-chip[data-bag-row-id]')).toHaveCount(2);

  // The unified grid renders one block (no separate inventory + bag-zone
  // sections). Selector targets it via the data-testid the renderer adds.
  const grid = page.locator('[data-testid="unified-grid"]');
  await expect(grid).toBeVisible();
  // BAG_COLUMNS × BAG_ROWS = 6×6 = 36 cells minimum (more if a bag pushes
  // the grid downward, which doesn't happen for moss + amber here).
  const cellCount = await grid.locator('.artifact-grid-cell').count();
  expect(cellCount, 'unified grid must render a 6×6 minimum').toBeGreaterThanOrEqual(36);

  // Alongside packing: moss anchors at (3, 0), amber at (3, 1). amber's
  // first slot is virtual (3, 1). Under the legacy bag-zone-local stack
  // amber would have lived at (0, 4). Asserting the unified-coord cell
  // exists as a real slot (not --bag-disabled / --bag-empty / --base-inv)
  // discriminates the two layouts.
  const mossFirstSlot = grid.locator(`.artifact-grid-cell[data-cell-x="3"][data-cell-y="0"]`);
  await expect(mossFirstSlot).toHaveCount(1);
  await expect(mossFirstSlot).toHaveClass(/artifact-grid-cell--bag(?!-)/);
  const amberFirstSlot = grid.locator(`.artifact-grid-cell[data-cell-x="3"][data-cell-y="1"]`);
  await expect(amberFirstSlot).toHaveCount(1);
  await expect(amberFirstSlot).toHaveClass(/artifact-grid-cell--bag(?!-)/);

  // Base-inventory cell at (0, 0) must NOT be a bag cell — it's the starter
  // preset slot, marked with the base-inv class only.
  const baseInvCell = grid.locator(`.artifact-grid-cell[data-cell-x="0"][data-cell-y="0"]`);
  await expect(baseInvCell).toHaveClass(/artifact-grid-cell--base-inv/);

  // Both bags are empty → both chips are draggable and unlocked.
  const mossChip = page.locator('.active-bag-chip[data-bag-row-id]', { hasText: /moss|пакет|мох/i }).first();
  const amberChip = page.locator('.active-bag-chip[data-bag-row-id]', { hasText: /amber|сумка|янтар/i }).first();
  await expect(mossChip).toHaveAttribute('draggable', 'true');
  await expect(mossChip).toHaveAttribute('data-bag-locked', 'false');
  await expect(amberChip).toHaveAttribute('draggable', 'true');
  await expect(amberChip).toHaveAttribute('data-bag-locked', 'false');

  await page.setViewportSize(MOBILE_VIEWPORT);
  await saveShot(page, 'bag-zone-01-alongside-mobile.png');
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await saveShot(page, 'bag-zone-02-alongside-desktop.png');

  // --- Reload persistence: bags re-pack to the same alongside layout ---
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);
  await expect(page.locator('.active-bag-chip[data-bag-row-id]')).toHaveCount(2);
  await expect(grid).toBeVisible();
  // Server preserves bag declaration order (sort_order); the projection's
  // 2D first-fit packer re-derives the same anchors deterministically.
  const amberSlotAfterReload = grid.locator(`.artifact-grid-cell[data-cell-x="3"][data-cell-y="1"]`);
  await expect(amberSlotAfterReload).toHaveClass(/artifact-grid-cell--bag(?!-)/);
  await saveShot(page, 'bag-zone-03-after-reload-desktop.png');
});

test('[Req 2-F] tetromino-bag mask gaps render visibly (no hidden grid holes)', async ({ page, request, baseURL }) => {
  // Regression: activating a T-tetromino (trefoil_sack) left the bottom-left
  // and bottom-right corners of its bounding box as `visibility: hidden`
  // cells, creating visual holes in the unified grid. The user's screenshot
  // showed trefoil at anchor (3, 0) with row 1 cols 3 and 5 completely
  // blank. Contract after the fix: the two mask-gap cells still classify
  // as --bag-disabled at the JS layer (per grid-cell-classification.test.js
  // "tetromino mask gap inside bbox"), but the CSS renders them with the
  // same faint dashed style as --bag-empty cells so the grid stays visually
  // intact.
  await resetDevDb(request);
  const player = await createSession(request, { telegramId: 950, username: 'tetro', name: 'Tetro' });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  const ghost = await createSession(request, { telegramId: 951, username: 'tetro_ghost', name: 'Tetro Ghost' });
  await api(request, ghost.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'kirt' });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /start game|начать игру/i }).click();
  await waitForPrepReady(page);

  const bootstrap = await api(request, player.sessionKey, '/api/bootstrap');
  // trefoil_sack costs 3 and fits the round-1 budget alongside the 2-coin
  // starter preset (5 total). Activates at (3, 0) via the first-fit packer.
  await forceShopAndBuy(page, request, player.sessionKey, bootstrap.activeGameRun.id, 'trefoil_sack');
  await page.locator('.artifact-container-zone .container-item[data-artifact-id="trefoil_sack"]').first().click();
  await expect(page.locator('.active-bag-chip[data-bag-row-id]')).toHaveCount(1);

  const grid = page.locator('[data-testid="unified-grid"]');
  // trefoil shape [[1,1,1],[0,1,0]] at anchor (3, 0): slots at
  //   row 0: cols 3, 4, 5
  //   row 1: col 4 only
  // Mask gaps at (3, 1) and (5, 1) — both must be --bag-disabled in the
  // DOM (functional classification) AND render visibly (computed
  // visibility !== 'hidden').
  for (const [cx, cy] of [[3, 0], [4, 0], [5, 0], [4, 1]]) {
    const slot = grid.locator(`.artifact-grid-cell[data-cell-x="${cx}"][data-cell-y="${cy}"]`);
    await expect(slot).toHaveClass(/artifact-grid-cell--bag(?!-)/, { timeout: 2000 });
  }
  for (const [cx, cy] of [[3, 1], [5, 1]]) {
    const gapCell = grid.locator(`.artifact-grid-cell[data-cell-x="${cx}"][data-cell-y="${cy}"]`);
    await expect(gapCell).toHaveClass(/artifact-grid-cell--bag-disabled/);
    // The cell MUST be visible — regression was `visibility: hidden`
    // creating holes in the grid. Computed style check catches CSS-only
    // regressions that a class-based assertion would miss.
    const visibility = await gapCell.evaluate((el) => getComputedStyle(el).visibility);
    expect(visibility, `mask-gap cell (${cx}, ${cy}) must render visibly`).not.toBe('hidden');
  }

  await saveShot(page, 'bag-zone-04-tetromino-mask-gaps-desktop.png');
});
