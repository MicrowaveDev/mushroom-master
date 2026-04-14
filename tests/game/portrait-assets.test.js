import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mushrooms, PORTRAIT_VARIANTS } from '../../app/server/game-data.js';

// Guard: every portrait path referenced by game-data.js must resolve to a
// file under web/public/. Prior drift (thalla/lomie/kirt imagePath pointing
// at default.jpg while only default.png existed on disk) silently shipped
// broken portraits on every roster screen for weeks — fullPage screenshots
// hide broken-image icons too well for visual review to catch.
const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');
const publicDir = path.join(repoRoot, 'web', 'public');

function resolvePortraitFile(urlPath) {
  // urlPath is a server-relative URL like
  // "/portraits/thalla/default.png?v=abc12345". Strip any content-hash
  // cache-buster query string (added by portraitUrl() in game-data.js)
  // before resolving against the filesystem, then strip the leading slash.
  const [pathname] = urlPath.split('?');
  const rel = pathname.replace(/^\/+/, '');
  return path.join(publicDir, rel);
}

function expectHashSuffix(urlPath) {
  assert.match(
    urlPath,
    /\?v=[0-9a-f]{8}$/,
    `expected portrait URL "${urlPath}" to carry a ?v=<8-hex-hash> cache-buster`
  );
}

test('mushroom imagePath resolves to a file on disk for every mushroom', () => {
  for (const mushroom of mushrooms) {
    const file = resolvePortraitFile(mushroom.imagePath);
    assert.ok(
      fs.existsSync(file),
      `${mushroom.id}: imagePath "${mushroom.imagePath}" does not exist (expected ${file})`
    );
  }
});

test('mushroom imagePath carries a ?v= content-hash cache-buster', () => {
  for (const mushroom of mushrooms) {
    expectHashSuffix(mushroom.imagePath);
  }
});

test('PORTRAIT_VARIANTS paths resolve to files on disk for every variant', () => {
  for (const [mushroomId, variants] of Object.entries(PORTRAIT_VARIANTS)) {
    for (const variant of variants) {
      const file = resolvePortraitFile(variant.path);
      assert.ok(
        fs.existsSync(file),
        `${mushroomId} portrait "${variant.id}": path "${variant.path}" does not exist (expected ${file})`
      );
    }
  }
});

test('PORTRAIT_VARIANTS paths carry a ?v= content-hash cache-buster', () => {
  for (const [, variants] of Object.entries(PORTRAIT_VARIANTS)) {
    for (const variant of variants) {
      expectHashSuffix(variant.path);
    }
  }
});

test('every mushroom has an entry in PORTRAIT_VARIANTS (player-service fallback uses default.png)', () => {
  for (const mushroom of mushrooms) {
    const variants = PORTRAIT_VARIANTS[mushroom.id];
    assert.ok(
      variants && variants.length > 0,
      `${mushroom.id}: missing PORTRAIT_VARIANTS entry`
    );
    const hasDefault = variants.some((v) => v.id === 'default');
    assert.ok(
      hasDefault,
      `${mushroom.id}: PORTRAIT_VARIANTS is missing the "default" entry`
    );
  }
});
