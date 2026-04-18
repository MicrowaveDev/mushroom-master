import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mushrooms,
  PORTRAIT_VARIANTS,
  mushroomsForResponse,
  portraitVariantsForResponse
} from '../../app/server/game-data.js';

// Guard: every portrait URL the server ships must resolve to a file under
// web/public/. Prior drift (thalla/lomie/kirt imagePath pointing at
// default.jpg while only default.png existed on disk) silently shipped
// broken portraits on every roster screen for weeks — fullPage screenshots
// hide broken-image icons too well for visual review to catch.
//
// Two shapes are verified:
//  - Bare module-level paths (mushrooms[].imagePath, PORTRAIT_VARIANTS)
//    have no ?v= suffix and are what you'd read at module load.
//  - Response-shaped paths (mushroomsForResponse, portraitVariantsForResponse)
//    carry a ?v=<mtime-base36> cache-buster applied at response time, so a
//    file replaced mid-session invalidates the browser cache immediately
//    on the next /api/bootstrap without a server restart.
const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');
const publicDir = path.join(repoRoot, 'web', 'public');

function resolvePortraitFile(urlPath) {
  const [pathname] = urlPath.split('?');
  const rel = pathname.replace(/^\/+/, '');
  return path.join(publicDir, rel);
}

function expectCacheBuster(urlPath) {
  assert.match(
    urlPath,
    /\?v=[0-9a-z]+$/,
    `expected portrait URL "${urlPath}" to carry a ?v=<mtime> cache-buster`
  );
}

// --- Bare paths (module load) ---

test('mushrooms[].imagePath resolves to a file on disk', () => {
  for (const mushroom of mushrooms) {
    const file = resolvePortraitFile(mushroom.imagePath);
    assert.ok(
      fs.existsSync(file),
      `${mushroom.id}: imagePath "${mushroom.imagePath}" does not exist (expected ${file})`
    );
  }
});

test('mushrooms[].imagePath is bare (no ?v= until response time)', () => {
  for (const mushroom of mushrooms) {
    assert.ok(
      !mushroom.imagePath.includes('?'),
      `${mushroom.id}: module-level imagePath should be bare, got "${mushroom.imagePath}"`
    );
  }
});

test('PORTRAIT_VARIANTS paths resolve to a file on disk', () => {
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

test('every mushroom has an entry in PORTRAIT_VARIANTS with a default', () => {
  for (const mushroom of mushrooms) {
    const variants = PORTRAIT_VARIANTS[mushroom.id];
    assert.ok(
      variants && variants.length > 0,
      `${mushroom.id}: missing PORTRAIT_VARIANTS entry`
    );
    assert.ok(
      variants.some((v) => v.id === 'default'),
      `${mushroom.id}: PORTRAIT_VARIANTS missing the "default" entry`
    );
  }
});

// --- Response-shaped paths (request time) ---

test('mushroomsForResponse() stamps every imagePath with a ?v= cache-buster', () => {
  const response = mushroomsForResponse();
  assert.equal(response.length, mushrooms.length);
  for (const mushroom of response) {
    expectCacheBuster(mushroom.imagePath);
    const file = resolvePortraitFile(mushroom.imagePath);
    assert.ok(
      fs.existsSync(file),
      `${mushroom.id}: stamped imagePath "${mushroom.imagePath}" does not resolve (${file})`
    );
  }
});

test('portraitVariantsForResponse() stamps every variant path with a ?v= cache-buster', () => {
  const response = portraitVariantsForResponse();
  assert.deepEqual(Object.keys(response).sort(), Object.keys(PORTRAIT_VARIANTS).sort());
  for (const [mushroomId, variants] of Object.entries(response)) {
    for (const variant of variants) {
      expectCacheBuster(variant.path);
      const file = resolvePortraitFile(variant.path);
      assert.ok(
        fs.existsSync(file),
        `${mushroomId} portrait "${variant.id}": stamped path "${variant.path}" does not resolve (${file})`
      );
    }
  }
});

test('mushroomsForResponse() cache-buster updates when file mtime changes', () => {
  const before = mushroomsForResponse().find((m) => m.id === 'thalla').imagePath;
  const filePath = resolvePortraitFile(before);
  const newTime = new Date(Date.now() + 60_000);
  fs.utimesSync(filePath, newTime, newTime);
  const after = mushroomsForResponse().find((m) => m.id === 'thalla').imagePath;
  assert.notEqual(
    before,
    after,
    'stamped imagePath must change when the file mtime changes (request-time cache-buster is stale)'
  );
});
