import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import {
  captureElementScreenshot,
  assertImagesLoaded,
  assertNoHorizontalOverflow
} from './screenshot-capture.js';
import { MOBILE_VIEWPORT, DESKTOP_VIEWPORT } from './e2e-helpers.js';
import { repoRoot } from '../../app/shared/repo-root.js';

const candidateRoot = path.resolve(
  repoRoot,
  process.env.HOME_FIELD_CANDIDATE_ROOT || '.agent/home-field-workspace/candidates/grass-family/latest'
);
const screenshotDir = path.join(repoRoot, '.agent/home-field-workspace/review');
const candidateIds = (process.env.HOME_FIELD_CANDIDATE_IDS || 'grass_base_01,grass_base_02,grass_flowers_01')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const assetById = new Map(
  (() => {
    const doc = JSON.parse(fs.readFileSync(path.join(repoRoot, 'app/shared/home-field/home-field-assets.json'), 'utf8'));
    return [
      ...doc.assets,
      ...(doc.characters || [])
    ].map((asset) => [asset.id, asset]);
  })()
);
const characterCandidateId = candidateIds.find((id) => assetById.get(id)?.spritesheet);

test.skip(
  process.env.HOME_FIELD_CANDIDATE_PREVIEW !== '1',
  'candidate grass preview is an opt-in local review spec'
);

function candidatePathFor(asset) {
  return path.join(candidateRoot, asset.outputPath);
}

async function routeCandidateAssets(page) {
  for (const id of candidateIds) {
    const asset = assetById.get(id);
    if (!asset) {
      throw new Error(`Unknown candidate asset for preview: ${id}`);
    }
    const filePath = candidatePathFor(asset);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing candidate PNG for preview: ${path.relative(repoRoot, filePath)}`);
    }
    await page.route(`**${asset.publicPath}`, async (route) => {
      await route.fulfill({
        path: filePath,
        contentType: 'image/png'
      });
    });
  }
}

async function captureCandidateField(page, baseURL, viewport, name) {
  await page.setViewportSize(viewport);
  await routeCandidateAssets(page);
  const characterParam = characterCandidateId ? `&character=${encodeURIComponent(characterCandidateId)}` : '';
  await page.goto(`${baseURL}/home-field-preview?debug=0&candidate=local${characterParam}`);
  await expect(page.getByTestId('home-field-preview')).toHaveAttribute('data-debug', '0');
  await expect(page.locator('.home-field-preview-safe-frame')).toHaveCount(0);
  await expect(page.locator('.home-field-preview-object span')).toHaveCount(0);
  await assertImagesLoaded(page);
  await assertNoHorizontalOverflow(page);
  await captureElementScreenshot(page, screenshotDir, '[data-testid="home-field-preview-stage"]', name);
}

test('[home-field] candidate assets render in clean field preview', async ({ page, baseURL }) => {
  await captureCandidateField(page, baseURL, MOBILE_VIEWPORT, 'home-field-candidate-mobile-clean.png');
  await captureCandidateField(page, baseURL, DESKTOP_VIEWPORT, 'home-field-candidate-desktop-clean.png');
});
