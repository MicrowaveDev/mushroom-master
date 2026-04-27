import path from 'path';
import { test, expect } from '@playwright/test';
import { captureScreenshot, assertImagesLoaded, assertNoHorizontalOverflow } from './screenshot-capture.js';
import { resetDevDb, createSession, api, waitForPrepReady, MOBILE_VIEWPORT } from './e2e-helpers.js';
import { repoRoot } from '../../app/shared/repo-root.js';

const screenshotDir = path.join(repoRoot, '.agent/tasks/telegram-autobattler-v1/raw/screenshots/artifacts');
const ARTIFACT_ID = 'static_spore_sac';
const STARTER_ARTIFACT_ID = 'spore_needle';

async function saveArtifactShot(page, name) {
  await captureScreenshot(page, screenshotDir, name);
  await assertImagesLoaded(page);
  await assertNoHorizontalOverflow(page);
}

test('generated artifact bitmap renders in shop and as one continuous placed bag image', async ({ page, request, baseURL }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await resetDevDb(request);

  const player = await createSession(request, {
    telegramId: 1741,
    username: 'bitmap_artifact',
    name: 'Bitmap Artifact'
  });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  const run = await api(request, player.sessionKey, '/api/game-run/start', 'POST', { mode: 'solo' });
  await api(request, player.sessionKey, `/api/dev/game-run/${run.id}/force-shop`, 'POST', {
    artifactIds: [ARTIFACT_ID]
  });

  await page.addInitScript((sessionKey) => localStorage.setItem('sessionKey', sessionKey), player.sessionKey);
  await page.goto(`${baseURL}/game-run/${run.id}`, { waitUntil: 'networkidle' });
  await waitForPrepReady(page);

  const shopPiece = page.locator(`.artifact-shop [data-artifact-id="${ARTIFACT_ID}"] .artifact-figure-bitmap`).first();
  await expect(shopPiece).toBeVisible();
  await expect(shopPiece).toHaveCSS('background-image', /static_spore_sac\.png/);
  await expect(page.locator('.artifact-shop .artifact-figure-bitmap')).toHaveCount(1);
  const shopBox = await shopPiece.boundingBox();
  expect(shopBox.height).toBeGreaterThan(shopBox.width * 1.6);
  await saveArtifactShot(page, 'static-spore-sac-shop.png');

  const starterPiece = page.locator(`.inventory-pieces .artifact-piece-wrap[data-artifact-id="${STARTER_ARTIFACT_ID}"]`);
  await expect(starterPiece).toBeVisible();
  const starterBitmap = starterPiece.locator('.artifact-figure-bitmap');
  await expect(starterBitmap).toHaveCount(1);
  await expect(starterBitmap.first()).toHaveCSS('background-image', /spore_needle\.png/);
  const starterBox = await starterBitmap.first().boundingBox();
  expect(starterBox.width).toBeGreaterThan(30);
  expect(starterBox.height).toBeGreaterThan(30);
  await saveArtifactShot(page, 'spore-needle-starter-bag.png');

  const purchase = await api(request, player.sessionKey, `/api/game-run/${run.id}/buy`, 'POST', {
    artifactId: ARTIFACT_ID
  });
  const bootstrapAfterBuy = await api(request, player.sessionKey, '/api/bootstrap');
  const placedItems = bootstrapAfterBuy.activeGameRun.loadoutItems.map((item) => {
    if (item.id !== purchase.id) return item;
    return { ...item, x: 2, y: 1, width: 1, height: 2 };
  });

  await api(request, player.sessionKey, '/api/artifact-loadout', 'PUT', {
    mushroomId: 'thalla',
    items: placedItems
  });

  await page.reload({ waitUntil: 'networkidle' });
  await waitForPrepReady(page);
  const placedPiece = page.locator(`.inventory-pieces .artifact-piece-wrap[data-artifact-id="${ARTIFACT_ID}"]`);
  await expect(placedPiece).toBeVisible();
  await expect(placedPiece).toHaveAttribute('data-artifact-x', '2');
  await expect(placedPiece).toHaveAttribute('data-artifact-y', '1');
  await expect(placedPiece).toHaveAttribute('data-artifact-width', '1');
  await expect(placedPiece).toHaveAttribute('data-artifact-height', '2');
  const placedBitmaps = placedPiece.locator('.artifact-figure-bitmap');
  await expect(placedBitmaps).toHaveCount(1);
  await expect(placedBitmaps.first()).toHaveCSS('background-image', /static_spore_sac\.png/);
  const bagBox = await placedBitmaps.first().boundingBox();
  expect(bagBox.height).toBeGreaterThan(bagBox.width * 1.6);
  await saveArtifactShot(page, 'static-spore-sac-bag.png');
});
