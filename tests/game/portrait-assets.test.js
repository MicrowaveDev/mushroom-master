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
  // urlPath is a server-relative URL like "/portraits/thalla/default.png".
  // web/public is served at "/", so strip the leading slash and join.
  const rel = urlPath.replace(/^\/+/, '');
  return path.join(publicDir, rel);
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
