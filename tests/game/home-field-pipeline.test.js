import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../../app/shared/repo-root.js';
import { encodeDeterministicPng, readPngRgba, alphaStats } from '../../app/scripts/lib/bitmap-image-toolkit.js';

const scriptPath = path.join(repoRoot, 'app/scripts/produce-home-field-assets.js');
const grassFamilyScriptPath = path.join(repoRoot, 'app/scripts/produce-home-field-grass-family.js');
const grassFamilySheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-grass-family-sheet.js');
const alphaSheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-alpha-sheet.js');
const nextScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-image-prompts.js');
const nextGrassFamilyScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-grass-family-prompt.js');
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

function writeGrassFamilyFixture(filePath, outputDir) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    tileSize: 256,
    assets: ['grass_base_01', 'grass_base_02', 'grass_flowers_01'].map((id) => ({
      id,
      type: 'terrain',
      role: id,
      promptKey: id,
      sourcePath: `.agent/home-field-test-workspace/raw/${id}.source.png`,
      outputPath: `${outputDir}/${id}.png`,
      publicPath: `/home-field/__test__/${id}.png`,
      width: 256,
      height: 256,
      anchor: { x: 0, y: 0 },
      collision: 'walkable',
      animation: null,
      status: 'needs_review',
      tile: {
        terrainSet: 'meadow_grass',
        placement: id === 'grass_flowers_01' ? 'accent' : 'free',
        connectors: { n: 'grass', e: 'grass', s: 'grass', w: 'grass' },
        canTouch: ['grass_base_01', 'grass_base_02', 'grass_flowers_01']
      }
    })),
    characters: []
  }, null, 2));
}

function writeMeadowFixture(filePath) {
  const width = 1024;
  const height = 768;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const wave = Math.sin(x / 70) * 8 + Math.cos(y / 90) * 6;
      rgba[i + 0] = Math.round(54 + wave + (x / width) * 8);
      rgba[i + 1] = Math.round(88 + wave + (y / height) * 10);
      rgba[i + 2] = Math.round(48 + wave / 2);
      rgba[i + 3] = 255;
      if (x > 480 && x < 620 && y > 430 && y < 610 && (x + y) % 67 < 4) {
        rgba[i + 0] = 142;
        rgba[i + 1] = 162;
        rgba[i + 2] = 76;
      }
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encodeDeterministicPng({ width, height, rgba }));
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

test('[home-field] produce supports object-layer candidate root', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-candidate-prop-test');
  const rawPath = path.join(repoRoot, '.agent/home-field-test-workspace/raw/chroma_fixture.source.png');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const appOutputAbs = path.join(repoRoot, outputPath);
  const candidateRoot = path.join(repoRoot, '.agent/home-field-workspace/candidates/object-layer/latest');
  const candidateOutputAbs = path.join(candidateRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(path.dirname(rawPath), { recursive: true, force: true });
  fs.rmSync(path.dirname(appOutputAbs), { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeFixturePng(rawPath);

  try {
    const result = spawnSync(process.execPath, [
      scriptPath,
      'chroma_fixture',
      '--candidate',
      `--candidate-root=${candidateRoot}`,
      '--chroma-key=#ff00ff'
    ], {
      cwd: repoRoot,
      env: { ...process.env, HOME_FIELD_ASSETS_PATH: assetsPath },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(candidateOutputAbs), true, 'candidate output should be written');
    assert.equal(fs.existsSync(appOutputAbs), false, 'candidate mode must not write app-facing output');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(path.dirname(rawPath), { recursive: true, force: true });
    fs.rmSync(path.dirname(appOutputAbs), { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});

test('[home-field] alpha sheet renders transparent candidate props', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-alpha-sheet-test');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const candidateRoot = path.join(repoRoot, '.agent/home-field-workspace/candidates/object-layer/latest');
  const candidateOutputAbs = path.join(candidateRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeFixturePng(candidateOutputAbs);

  try {
    const result = spawnSync(process.execPath, [
      alphaSheetScriptPath,
      '--ids=chroma_fixture'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_ASSET_ROOT: path.relative(repoRoot, candidateRoot)
      },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(repoRoot, '.agent/home-field-workspace/review/alpha-halo-sheet.png')), true);
    assert.equal(fs.existsSync(path.join(repoRoot, '.agent/home-field-workspace/review/alpha-halo-sheet.manifest.json')), true);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});

test('[home-field] grass-family producer crops three tiles from one shared meadow source', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-grass-family-test');
  const outputDir = 'web/public/home-field/__test__/grass-family';
  const outputAbs = path.join(repoRoot, outputDir);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  const workspacePath = path.join(fixtureDir, 'workspace');
  const sourcePath = path.join(fixtureDir, 'grass_family_meadow.source.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(outputAbs, { recursive: true, force: true });
  writeGrassFamilyFixture(assetsPath, outputDir);
  writeMeadowFixture(sourcePath);

  try {
    const result = spawnSync(process.execPath, [
      grassFamilyScriptPath,
      `--source=${sourcePath}`
    ], {
      cwd: repoRoot,
      env: { ...process.env, HOME_FIELD_ASSETS_PATH: assetsPath, HOME_FIELD_WORKSPACE: workspacePath },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Producing grass family from/);
    assert.match(result.stdout, /with plan "tight-center"/);
    assert.match(result.stdout, /grass_base_01: OK/);
    assert.match(result.stdout, /grass_base_02: OK/);
    assert.match(result.stdout, /grass_flowers_01: OK/);

    for (const id of ['grass_base_01', 'grass_base_02', 'grass_flowers_01']) {
      const image = readPngRgba(path.join(outputAbs, `${id}.png`));
      assert.equal(image.width, 256);
      assert.equal(image.height, 256);
    }
    const manifests = fs.readdirSync(path.join(workspacePath, 'manifests'));
    assert.ok(manifests.some((name) => name.startsWith('produce-grass-family-')));
    const manifestName = manifests.find((name) => name.startsWith('produce-grass-family-'));
    const manifest = JSON.parse(fs.readFileSync(path.join(workspacePath, 'manifests', manifestName), 'utf8'));
    assert.equal(manifest.policy.cropPlanName, 'tight-center');
    assert.ok(manifest.outputs.every((entry) => entry.crop.rect.width < 300), 'default plan should use tight nearby crops');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(outputAbs, { recursive: true, force: true });
  }
});

test('[home-field] grass-family producer supports alternate crop plans', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-grass-family-plan-test');
  const outputDir = 'web/public/home-field/__test__/grass-family-plan';
  const outputAbs = path.join(repoRoot, outputDir);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  const workspacePath = path.join(fixtureDir, 'workspace');
  const sourcePath = path.join(fixtureDir, 'grass_family_meadow.source.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(outputAbs, { recursive: true, force: true });
  writeGrassFamilyFixture(assetsPath, outputDir);
  writeMeadowFixture(sourcePath);

  try {
    const result = spawnSync(process.execPath, [
      grassFamilyScriptPath,
      `--source=${sourcePath}`,
      '--plan=lower-band'
    ], {
      cwd: repoRoot,
      env: { ...process.env, HOME_FIELD_ASSETS_PATH: assetsPath, HOME_FIELD_WORKSPACE: workspacePath },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /with plan "lower-band"/);
    const manifestName = fs.readdirSync(path.join(workspacePath, 'manifests')).find((name) => name.startsWith('produce-grass-family-'));
    const manifest = JSON.parse(fs.readFileSync(path.join(workspacePath, 'manifests', manifestName), 'utf8'));
    assert.equal(manifest.policy.cropPlanName, 'lower-band');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(outputAbs, { recursive: true, force: true });
  }
});

test('[home-field] grass-family sheet renders focused repeat and mix proof', () => {
  const result = spawnSync(process.execPath, [grassFamilySheetScriptPath], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /grass-family-sheet\.png/);
  assert.equal(fs.existsSync(path.join(repoRoot, '.agent/home-field-workspace/review/grass-family-sheet.png')), true);
  assert.equal(fs.existsSync(path.join(repoRoot, '.agent/home-field-workspace/review/grass-family-sheet.manifest.json')), true);
});

test('[home-field] next-tiles blocks while existing candidates still need review', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-review-gate-test');
  const reviewPath = path.join(fixtureDir, 'home-field-asset-review.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(reviewPath, JSON.stringify({ schemaVersion: 1, assets: [] }, null, 2));

  try {
    const result = spawnSync(process.execPath, [
      nextScriptPath,
      '--batch=terrain-grass',
      '--review-verdict=needs_regen',
      '--all'
    ], {
      cwd: repoRoot,
      env: { ...process.env, HOME_FIELD_REVIEW_PATH: reviewPath },
      encoding: 'utf8'
    });

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /Review Gate Blocked/);
    assert.match(result.stderr, /Existing generated candidates still need a checked-in visual verdict/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] rerun grass queue emits needs_review and needs_regen grass tiles', () => {
  const result = spawnSync(process.execPath, [
    nextScriptPath,
    '--batch=terrain-grass',
    '--review-verdict=needs_review,needs_regen',
    '--all',
    '--ignore-review-gate'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Batch: terrain-grass/);
  assert.match(result.stdout, /grass_base_01 \(terrain\)/);
  assert.match(result.stdout, /grass_base_02 \(terrain\)/);
  assert.match(result.stdout, /grass_flowers_01 \(terrain\)/);
  assert.doesNotMatch(result.stdout, /path_dirt_straight \(terrain\)/);
  assert.doesNotMatch(result.stdout, /edge_right_forest_01 \(terrain\)/);
  assert.doesNotMatch(result.stdout, /mushroom_cluster_small_amber \(prop\)/);
  assert.match(result.stdout, /--check-files --check-connectors --check-review/);
  assert.match(result.stdout, /stop after these 3 grass tiles/i);
});

test('[home-field] field-context grass queue asks for larger meadow context and center crop', () => {
  const result = spawnSync(process.execPath, [
    nextScriptPath,
    '--batch=terrain-grass',
    '--review-verdict=needs_review,needs_regen',
    '--all',
    '--ignore-review-gate',
    '--field-context'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Generation mode: field-context center crop/);
  assert.match(result.stdout, /Field-context generation mode \(grass terrain\)/);
  assert.match(result.stdout, /larger continuous 3x3 or 4x4 meadow patch/);
  assert.match(result.stdout, /Scene fit: The composed screen should read like a real in-game hub screenshot/);
  assert.match(result.stdout, /Chibi fit: Chibi avatars are small, squat, expressive mushroom-elf heroines/);
  assert.match(result.stdout, /--crop-center=0\.34 --seamless-terrain --quiet-terrain=0\.45/);
});

test('[home-field] grass-family queue emits one shared-source prompt and producer command', () => {
  const result = spawnSync(process.execPath, [nextGrassFamilyScriptPath], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Generation mode: shared grass-family meadow source/);
  assert.match(result.stdout, /grass_family_meadow\.source\.png/);
  assert.match(result.stdout, /npm run game:home-field:produce-grass-family/);
  assert.match(result.stdout, /--plan=lower-band/);
  assert.match(result.stdout, /game:home-field:grass-family-sheet/);
  assert.match(result.stdout, /Do not save separate per-tile raw PNGs/);
});
