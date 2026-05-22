import path from 'path';
import { test, expect } from '@playwright/test';
import {
  captureScreenshot,
  assertImagesLoaded,
  assertNoHorizontalOverflow
} from './screenshot-capture.js';
import { MOBILE_VIEWPORT, DESKTOP_VIEWPORT } from './e2e-helpers.js';
import { repoRoot } from '../../app/shared/repo-root.js';

const screenshotDir = path.join(repoRoot, '.agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview');

async function saveShot(page, name) {
  await captureScreenshot(page, screenshotDir, name);
  await assertImagesLoaded(page);
  await assertNoHorizontalOverflow(page);
}

async function assertObjectLayerFits(page, { requireSafeFrame = false } = {}) {
  const result = await page.evaluate(({ requireSafeFrame }) => {
    const stage = document.querySelector('[data-testid="home-field-preview-stage"]');
    const safeFrame = document.querySelector('[data-testid="home-field-preview-mobile-safe-frame"]');
    const safeFrameSelectors = [
      '[data-testid="home-field-preview-arena"]',
      '[data-testid="home-field-preview-journey"]',
      '[data-testid="home-field-preview-chibi-spawn"]'
    ];
    const rectFor = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };
    const stageRect = rectFor(stage);
    const safeRect = rectFor(safeFrame);
    const objects = Array.from(document.querySelectorAll('.home-field-preview-object')).map((element) => ({
      selector: `[data-testid="${element.getAttribute('data-testid')}"]`,
      isSafeFrameCritical: safeFrameSelectors.includes(`[data-testid="${element.getAttribute('data-testid')}"]`),
      rect: rectFor(element),
      labelRect: rectFor(element.querySelector('span') || element)
    }));
    const inside = (inner, outer, pad = 0) =>
      inner.left >= outer.left - pad
      && inner.top >= outer.top - pad
      && inner.right <= outer.right + pad
      && inner.bottom <= outer.bottom + pad;
    const overlaps = [];
    for (let i = 0; i < objects.length; i += 1) {
      for (let j = i + 1; j < objects.length; j += 1) {
        if (!objects[i].isSafeFrameCritical && !objects[j].isSafeFrameCritical) continue;
        const a = objects[i].labelRect;
        const b = objects[j].labelRect;
        const overlap = !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        if (overlap) overlaps.push(`${objects[i].selector} overlaps ${objects[j].selector}`);
      }
    }
    return {
      stage: stageRect,
      safeFrame: safeRect,
      objects,
      outsideStage: objects.filter((object) => !inside(object.rect, stageRect, 1)).map((object) => object.selector),
      outsideSafeFrame: requireSafeFrame
        ? objects.filter((object) => object.isSafeFrameCritical && !inside(object.rect, safeRect, 1)).map((object) => object.selector)
        : [],
      overlaps
    };
  }, { requireSafeFrame });

  expect(result.outsideStage, `Objects outside stage: ${JSON.stringify(result, null, 2)}`).toEqual([]);
  expect(result.outsideSafeFrame, `Objects outside mobile safe frame: ${JSON.stringify(result, null, 2)}`).toEqual([]);
  expect(result.overlaps, `Object overlap failures: ${JSON.stringify(result, null, 2)}`).toEqual([]);
}

test('[Req 15-B] home field layout preview composes tile and object layers', async ({ page, baseURL }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto(`${baseURL}/home-field-preview`);
  await expect(page.getByTestId('home-field-preview')).toBeVisible();
  await expect(page.locator('.home-field-preview-tile')).toHaveCount(28);
  await expect(page.locator('.home-field-preview-tile--path, .home-field-preview-tile--pathTop, .home-field-preview-tile--spawn')).toHaveCount(4);
  await expect(page.getByTestId('home-field-preview-arena')).toBeVisible();
  await expect(page.getByTestId('home-field-preview-journey')).toBeVisible();
  await expect(page.getByTestId('home-field-preview-chibi-spawn')).toBeVisible();
  await assertObjectLayerFits(page, { requireSafeFrame: true });
  await saveShot(page, 'home-field-preview-mobile.png');

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(`${baseURL}/home-field-preview`);
  await expect(page.getByTestId('home-field-preview')).toBeVisible();
  await expect(page.locator('.home-field-preview-tile')).toHaveCount(28);
  await assertObjectLayerFits(page);
  await saveShot(page, 'home-field-preview-desktop.png');
});
