import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../../app/shared/repo-root.js';
import { encodeDeterministicPng, readPngRgba, alphaStats } from '../../app/scripts/lib/bitmap-image-toolkit.js';

const scriptPath = path.join(repoRoot, 'app/scripts/produce-home-field-assets.js');
const nextScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-image-prompts.js');
const chromaKeyScript = path.join(
  process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex'),
  'skills/.system/imagegen/scripts/remove_chroma_key.py'
);

function writeFixturePng(filePath, { checkerboard = false } = {}) {
  const width = 32;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (checkerboard) {
        const light = ((x < width / 2) === (y < height / 2));
        const v = light ? 160 : 118;
        rgba[i + 0] = v;
        rgba[i + 1] = v;
        rgba[i + 2] = v;
        rgba[i + 3] = 255;
        continue;
      }
      const object = x >= 10 && x < 22 && y >= 8 && y < 24;
      rgba[i + 0] = object ? 48 : 255;
      rgba[i + 1] = object ? 120 : 0;
      rgba[i + 2] = object ? 64 : 255;
      rgba[i + 3] = 255;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encodeDeterministicPng({ width, height, rgba }));
}

function writeAssetsFixture(filePath, outputPath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    tileSize: 256,
    assets: [
      {
        id: 'chroma_fixture',
        type: 'prop',
        role: 'test_fixture',
        promptKey: 'test_fixture',
        sourcePath: '.agent/home-field-test-workspace/raw/chroma_fixture.source.png',
        outputPath,
        publicPath: '/home-field/__test__/chroma_fixture.png',
        width: 32,
        height: 32,
        anchor: { x: 0.5, y: 0.95 },
        collision: 'blocked',
        animation: null,
        status: 'generated'
      }
    ],
    characters: []
  }, null, 2));
}

test('[home-field] produce supports chroma-keyed prop cutouts', { skip: !fs.existsSync(chromaKeyScript) }, () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-pipeline-test');
  const rawPath = path.join(repoRoot, '.agent/home-field-test-workspace/raw/chroma_fixture.source.png');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const outputAbs = path.join(repoRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(path.dirname(rawPath), { recursive: true, force: true });
  fs.rmSync(path.dirname(outputAbs), { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeFixturePng(rawPath);

  try {
    const result = spawnSync(process.execPath, [
      scriptPath,
      'chroma_fixture',
      '--chroma-key=#ff00ff'
    ], {
      cwd: repoRoot,
      env: { ...process.env, HOME_FIELD_ASSETS_PATH: assetsPath },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const image = readPngRgba(outputAbs);
    const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
    assert.ok(stats.coverage < 0.7, `expected chroma removal to create transparency, got coverage=${stats.coverage}`);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(path.dirname(rawPath), { recursive: true, force: true });
    fs.rmSync(path.dirname(outputAbs), { recursive: true, force: true });
  }
});

test('[home-field] produce rejects opaque checkerboard-like prop mattes', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-pipeline-test');
  const rawPath = path.join(repoRoot, '.agent/home-field-test-workspace/raw/chroma_fixture.source.png');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const outputAbs = path.join(repoRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(path.dirname(rawPath), { recursive: true, force: true });
  fs.rmSync(path.dirname(outputAbs), { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeFixturePng(rawPath, { checkerboard: true });

  try {
    const result = spawnSync(process.execPath, [scriptPath, 'chroma_fixture'], {
      cwd: repoRoot,
      env: { ...process.env, HOME_FIELD_ASSETS_PATH: assetsPath },
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0, 'opaque checkerboard matte should fail');
    assert.match(result.stderr, /checkerboard-like matte|no transparency detected/);
    assert.equal(fs.existsSync(outputAbs), false, 'failed opaque matte must not write app-facing output');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(path.dirname(rawPath), { recursive: true, force: true });
    fs.rmSync(path.dirname(outputAbs), { recursive: true, force: true });
  }
});

test('[home-field] next-tiles emits terrain assets marked needs_regen even when PNGs exist', () => {
  const result = spawnSync(process.execPath, [
    nextScriptPath,
    '--batch=terrain-production',
    '--review-verdict=needs_regen',
    '--all'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Batch: terrain-production/);
  assert.match(result.stdout, /grass_base_01 \(terrain\)/);
  assert.match(result.stdout, /edge_right_forest_01 \(terrain\)/);
  assert.doesNotMatch(result.stdout, /mushroom_cluster_small_amber \(prop\)/);
  assert.match(result.stdout, /--check-files --check-connectors --check-review/);
});
