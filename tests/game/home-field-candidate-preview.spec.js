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
const grassIds = ['grass_base_01', 'grass_base_02', 'grass_flowers_01'];

test.skip(
  process.env.HOME_FIELD_CANDIDATE_PREVIEW !== '1',
  'candidate grass preview is an opt-in local review spec'
);

function candidatePathFor(id) {
  return path.join(candidateRoot, 'web/public/home-field/terrain', `${id}.png`);
}

async function routeCandidateGrass(page) {
  for (const id of grassIds) {
    const filePath = candidatePathFor(id);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing candidate grass PNG for preview: ${path.relative(repoRoot, filePath)}`);
    }
    await page.route(`**/home-field/terrain/${id}.png`, async (route) => {
      await route.fulfill({
        path: filePath,
        contentType: 'image/png'
      });
    });
  }
}

async function captureCandidateField(page, baseURL, viewport, name) {
  await page.setViewportSize(viewport);
  await routeCandidateGrass(page);
  await page.goto(`${baseURL}/home-field-preview?debug=0&candidate=grass-family`);
  await expect(page.getByTestId('home-field-preview')).toHaveAttribute('data-debug', '0');
  await expect(page.locator('.home-field-preview-safe-frame')).toHaveCount(0);
  await expect(page.locator('.home-field-preview-object span')).toHaveCount(0);
  await assertImagesLoaded(page);
  await assertNoHorizontalOverflow(page);
  await captureElementScreenshot(page, screenshotDir, '[data-testid="home-field-preview-stage"]', name);
}

test('[home-field] candidate grass renders in clean field preview', async ({ page, baseURL }) => {
  await captureCandidateField(page, baseURL, MOBILE_VIEWPORT, 'home-field-candidate-mobile-clean.png');
  await captureCandidateField(page, baseURL, DESKTOP_VIEWPORT, 'home-field-candidate-desktop-clean.png');
});
