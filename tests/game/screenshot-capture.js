import fs from 'fs/promises';
import path from 'path';
import { expect } from '@playwright/test';

// Shared screenshot helper used by all four game specs. Two things make this
// different from a plain `page.screenshot()`:
//
// 1. Before the capture, it injects a red outline + semi-transparent fill on
//    every <img> whose `naturalWidth === 0`. Broken portraits become visually
//    obvious at any zoom level, so an agent reviewing a thumbnail can't miss
//    them. (The previous `onboarding-desktop.png` that shipped broken Thalla /
//    Lomie / Kirt portraits slipped past review precisely because the
//    placeholder icons were too small to notice in a fullPage capture.)
//
// 2. Alongside the .png, it writes a .json sidecar manifest listing the
//    viewport, visible headings, and every broken-image src. An agent can
//    grep the sidecar instead of squinting at pixels — and the broken-image
//    list is the authoritative answer, not a judgment call.
//
// Tests may still call `assertImagesLoaded(page)` if they want a hard
// failure. Capture itself never throws so the annotated image and manifest
// always exist on disk, even when a downstream assertion fails.

export async function captureScreenshot(page, dir, name) {
  await fs.mkdir(dir, { recursive: true });

  const diagnostics = await page.evaluate(() => {
    const broken = [];
    for (const img of Array.from(document.querySelectorAll('img'))) {
      if (img.naturalWidth === 0) {
        broken.push({ src: img.src, alt: img.alt || '' });
        img.style.outline = '3px solid #ff0040';
        img.style.outlineOffset = '-3px';
        img.style.background = 'rgba(255, 0, 64, 0.18)';
      }
    }
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map((h) => h.textContent.trim())
      .filter(Boolean)
      .slice(0, 10);
    return {
      broken,
      headings,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    };
  });

  await page.screenshot({ path: path.join(dir, name), fullPage: true });

  const manifest = {
    screenshot: name,
    viewport: diagnostics.viewport,
    headings: diagnostics.headings,
    brokenImages: diagnostics.broken
  };
  const jsonName = name.replace(/\.png$/, '.json');
  await fs.writeFile(path.join(dir, jsonName), JSON.stringify(manifest, null, 2) + '\n');
}

export async function assertImagesLoaded(page) {
  const broken = await page.locator('img').evaluateAll((imgs) =>
    imgs.filter((i) => i.naturalWidth === 0).map((i) => i.src)
  );
  expect(broken, `Broken images found: ${broken.join(', ')}`).toHaveLength(0);
}
