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
const mobileReadabilitySheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-mobile-readability-sheet.js');
const candidateEvidenceScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-candidate-evidence.js');
const validateScriptPath = path.join(repoRoot, 'app/scripts/validate-home-field-assets.js');
const nextScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-image-prompts.js');
const nextGrassFamilyScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-grass-family-prompt.js');
const chibiPreflightScriptPath = path.join(repoRoot, 'app/scripts/preflight-home-field-chibi-proof.js');
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

function writeMagentaFringeFixture(filePath) {
  const width = 32;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const inner = x >= 11 && x < 21 && y >= 9 && y < 23;
      const fringe = x >= 9 && x < 23 && y >= 7 && y < 25;
      if (inner) {
        rgba[i + 0] = 44;
        rgba[i + 1] = 116;
        rgba[i + 2] = 62;
        rgba[i + 3] = 255;
      } else if (fringe) {
        rgba[i + 0] = 235;
        rgba[i + 1] = 24;
        rgba[i + 2] = 210;
        rgba[i + 3] = 96;
      } else {
        rgba[i + 3] = 0;
      }
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encodeDeterministicPng({ width, height, rgba }));
}

function writeTinyTransparentFixture(filePath) {
  const width = 32;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 12; y < 20; y += 1) {
    for (let x = 12; x < 20; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i + 0] = 48;
      rgba[i + 1] = 120;
      rgba[i + 2] = 64;
      rgba[i + 3] = 255;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encodeDeterministicPng({ width, height, rgba }));
}

function writeSolidTerrainFixture(filePath, rgb) {
  const width = 32;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4 + 0] = rgb[0];
    rgba[i * 4 + 1] = rgb[1];
    rgba[i * 4 + 2] = rgb[2];
    rgba[i * 4 + 3] = 255;
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
        readability: { minBboxWidth: 10, minBboxHeight: 12 },
        collision: 'blocked',
        animation: null,
        status: 'generated'
      }
    ],
    characters: []
  }, null, 2));
}

function writeMapFixture(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    tileSize: 256,
    world: { width: 256, height: 256, tileSize: 256 },
    spawn: { x: 128, y: 128, facing: 'down' },
    camera: {
      initialTarget: { x: 128, y: 128 },
      mobileSafeFrame: { x: 0, y: 0, w: 256, h: 256 }
    },
    layers: []
  }, null, 2));
}

function writeTerrainPairFixture(assetsPath, mapPath, outputDir) {
  fs.mkdirSync(path.dirname(assetsPath), { recursive: true });
  const terrain = ['terrain_a', 'terrain_b'].map((id) => ({
    id,
    type: 'terrain',
    role: 'test_terrain',
    promptKey: 'test_terrain',
    sourcePath: `.agent/home-field-test-workspace/raw/${id}.source.png`,
    outputPath: `${outputDir}/${id}.png`,
    publicPath: `/home-field/__test__/${id}.png`,
    width: 32,
    height: 32,
    anchor: { x: 0, y: 0 },
    collision: 'walkable',
    animation: null,
    status: 'generated',
    tile: {
      terrainSet: 'test_grass',
      placement: 'free',
      connectors: { n: 'grass', e: 'grass', s: 'grass', w: 'grass' },
      canTouch: ['terrain_a', 'terrain_b']
    }
  }));
  fs.writeFileSync(assetsPath, JSON.stringify({ version: 1, tileSize: 32, assets: terrain, characters: [] }, null, 2));
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(mapPath, JSON.stringify({
    version: 1,
    tileSize: 32,
    world: { width: 64, height: 32, tileSize: 32 },
    spawn: { x: 16, y: 16, facing: 'down' },
    camera: {
      initialTarget: { x: 16, y: 16 },
      mobileSafeFrame: { x: 0, y: 0, w: 64, h: 32 }
    },
    layers: [{
      id: 'terrain',
      type: 'tileLayer',
      tiles: [
        { x: 0, y: 0, assetId: 'terrain_a' },
        { x: 32, y: 0, assetId: 'terrain_b' }
      ]
    }]
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
  const candidateRoot = path.join(repoRoot, 'tmp/home-field-candidate-prop-candidates');
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
  const candidateRoot = path.join(repoRoot, 'tmp/home-field-alpha-sheet-candidates');
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

test('[home-field] mobile readability sheet renders small prop proofs', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-mobile-readability-test');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const candidateRoot = path.join(repoRoot, 'tmp/home-field-mobile-readability-candidates');
  const candidateOutputAbs = path.join(candidateRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeFixturePng(candidateOutputAbs);

  try {
    const result = spawnSync(process.execPath, [
      mobileReadabilitySheetScriptPath,
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
    assert.equal(fs.existsSync(path.join(repoRoot, '.agent/home-field-workspace/review/mobile-readability-sheet.png')), true);
    assert.equal(fs.existsSync(path.join(repoRoot, '.agent/home-field-workspace/review/mobile-readability-sheet.manifest.json')), true);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});

test('[home-field] candidate evidence manifest binds candidate output hashes', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-candidate-evidence-test');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const candidateRoot = path.join(repoRoot, 'tmp/home-field-candidate-evidence-candidates');
  const candidateOutputAbs = path.join(candidateRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeFixturePng(candidateOutputAbs);

  try {
    const result = spawnSync(process.execPath, [
      candidateEvidenceScriptPath,
      '--ids=chroma_fixture'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_CANDIDATE_ROOT: path.relative(repoRoot, candidateRoot)
      },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const manifestPath = path.join(repoRoot, '.agent/home-field-workspace/review/candidate-evidence.manifest.json');
    assert.equal(fs.existsSync(manifestPath), true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.candidateRoot, path.relative(repoRoot, candidateRoot));
    assert.equal(manifest.entries[0].id, 'chroma_fixture');
    assert.match(manifest.entries[0].candidateOutput.sha256, /^[a-f0-9]{64}$/);
    assert.match(manifest.manifestSha256, /^[a-f0-9]{64}$/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});

test('[home-field] validation catches visible magenta alpha fringe', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-alpha-fringe-test');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const candidateRoot = path.join(repoRoot, 'tmp/home-field-alpha-fringe-candidates');
  const candidateOutputAbs = path.join(candidateRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  const mapPath = path.join(fixtureDir, 'home-field-map.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeMapFixture(mapPath);
  writeMagentaFringeFixture(candidateOutputAbs);

  try {
    const result = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=chroma_fixture',
      '--check-files',
      '--check-alpha-halo'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: path.relative(repoRoot, candidateRoot)
      },
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0, 'visible magenta fringe should fail alpha halo validation');
    assert.match(result.stderr, /visible_chroma_fringe/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});

test('[home-field] validation catches too-small visible prop bounds', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-readability-bounds-test');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const candidateRoot = path.join(repoRoot, 'tmp/home-field-readability-bounds-candidates');
  const candidateOutputAbs = path.join(candidateRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  const mapPath = path.join(fixtureDir, 'home-field-map.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeMapFixture(mapPath);
  writeTinyTransparentFixture(candidateOutputAbs);

  try {
    const assets = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
    assets.assets[0].readability = { minBboxWidth: 24, minBboxHeight: 24 };
    fs.writeFileSync(assetsPath, JSON.stringify(assets, null, 2));

    const result = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=chroma_fixture',
      '--check-files',
      '--check-readability'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: path.relative(repoRoot, candidateRoot)
      },
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0, 'too-small visible bounds should fail readability validation');
    assert.match(result.stderr, /bbox_too_/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});

test('[home-field] validation catches obvious terrain edge profile mismatch', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-edge-profile-test');
  const outputDir = 'web/public/home-field/__test__/edge-profile';
  const candidateRoot = path.join(repoRoot, 'tmp/home-field-edge-profile-candidates');
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  const mapPath = path.join(fixtureDir, 'home-field-map.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  writeTerrainPairFixture(assetsPath, mapPath, outputDir);
  writeSolidTerrainFixture(path.join(candidateRoot, outputDir, 'terrain_a.png'), [40, 90, 45]);
  writeSolidTerrainFixture(path.join(candidateRoot, outputDir, 'terrain_b.png'), [160, 70, 55]);

  try {
    const result = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=terrain_a,terrain_b',
      '--check-files',
      '--check-edge-profiles'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: path.relative(repoRoot, candidateRoot)
      },
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0, 'mismatched terrain edge profiles should fail validation');
    assert.match(result.stderr, /edge_profile_mismatch/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  }
});

test('[home-field] production validation scopes to active shipped scene by default', () => {
  const result = spawnSync(process.execPath, [
    validateScriptPath,
    '--production'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /production approval/);
  assert.match(result.stdout, /scope=.*grass_base_01/);
  assert.doesNotMatch(result.stdout, /scope=.*thalla/);
  assert.doesNotMatch(result.stdout, /mutant_broccoli_bush_01/);
});

test('[home-field] full-registry production validation still blocks deferred assets', () => {
  const result = spawnSync(process.execPath, [
    validateScriptPath,
    '--production',
    '--full-registry-production'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stderr, /mutant_broccoli_bush_01/);
  assert.match(result.stderr, /not_approved_for_production/);
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

test('[home-field] rerun grass queue can re-emit approved/needs_review/needs_regen grass tiles', () => {
  const result = spawnSync(process.execPath, [
    nextScriptPath,
    '--batch=terrain-grass',
    '--review-verdict=approved,needs_review,needs_regen',
    '--include-existing',
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

test('[home-field] object candidate rerun emits candidate-root producer and evidence commands', () => {
  const result = spawnSync(process.execPath, [
    nextScriptPath,
    '--id=mushroom_cluster_small_violet',
    '--include-existing',
    '--all',
    '--ignore-review-gate',
    '--object-candidate'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Generation mode: object-layer candidate root/);
  assert.match(result.stdout, /mushroom_cluster_small_violet \(prop\)/);
  assert.match(result.stdout, /Candidate output path .*candidates\/object-layer\/latest/);
  assert.match(result.stdout, /npm run game:home-field:produce-object-candidate -- mushroom_cluster_small_violet --resize --chroma-key=#ff00ff/);
  assert.match(result.stdout, /Home Field scale contract/);
  assert.match(result.stdout, /Runtime canvas: 256x256px/);
  assert.match(result.stdout, /Visual footprint target: small field token/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*--check-alpha-halo/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /HOME_FIELD_CANDIDATE_IDS=mushroom_cluster_small_violet .*object-candidate-preview/);
  assert.doesNotMatch(result.stdout, /npm run game:home-field:produce -- mushroom_cluster_small_violet/);
});

test('[home-field] path family rerun emits terrain candidate producer and adjacency evidence', () => {
  const result = spawnSync(process.execPath, [
    nextScriptPath,
    '--batch=terrain-path',
    '--review-verdict=approved,needs_review,needs_regen',
    '--include-existing',
    '--all',
    '--ignore-review-gate',
    '--terrain-candidate'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Generation mode: terrain-family candidate root/);
  assert.match(result.stdout, /path_h_end_w \(terrain\)/);
  assert.match(result.stdout, /path_dirt_straight \(terrain\)/);
  assert.match(result.stdout, /Candidate output path .*candidates\/terrain-family\/latest/);
  assert.match(result.stdout, /npm run game:home-field:produce-terrain-candidate -- path_dirt_straight --resize --crop-center/);
  assert.match(result.stdout, /--check-files --check-connectors --check-review/);
  assert.match(result.stdout, /--check-files --check-edge-profiles/);
  assert.match(result.stdout, /game:home-field:adjacency/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /terrain-candidate-preview/);
  assert.doesNotMatch(result.stdout, /npm run game:home-field:produce -- path_dirt_straight/);
});

test('[home-field] chibi proof emits chibi candidate producer and scoped evidence commands', () => {
  const result = spawnSync(process.execPath, [
    nextScriptPath,
    '--type=character',
    '--id=thalla',
    '--include-existing',
    '--all',
    '--ignore-review-gate',
    '--chibi-candidate'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Generation mode: chibi active-roster candidate root/);
  assert.match(result.stdout, /thalla \(character\)/);
  assert.match(result.stdout, /npm run game:home-field:preflight-chibi-proof/);
  assert.match(result.stdout, /stop before cleanup if it fails/);
  assert.match(result.stdout, /Codex Desktop built-in imagegen by default/);
  assert.match(result.stdout, /Candidate output path .*candidates\/chibi-active-roster\/latest/);
  assert.match(result.stdout, /clear stale rejected Thalla raw frames/);
  assert.match(result.stdout, /reference turnaround sheet/i);
  assert.match(result.stdout, /thalla_chibi_turnaround\.reference\.png/);
  assert.match(result.stdout, /Use that reference only for consistency; do not slice it into final raw frames/);
  assert.match(result.stdout, /BJD-inspired doll simplicity/);
  assert.match(result.stdout, /simpler than the 2026-06-20 candidate/);
  assert.match(result.stdout, /Mechanical sheet success, alpha success, and mobile readability do not count as style approval/);
  assert.match(result.stdout, /npm run game:home-field:produce-chibi-candidate -- thalla --resize --chroma-key=#ff00ff/);
  assert.doesNotMatch(result.stdout, /produce-chibi-candidate -- thalla --resize-nearest/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*candidates\/chibi-active-roster\/latest.*--ids=thalla --check-files --check-readability/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /HOME_FIELD_CANDIDATE_IDS=thalla .*chibi-candidate-preview/);
  assert.doesNotMatch(result.stdout, /npm run game:home-field:produce -- thalla/);
});

test('[home-field] chibi proof preflight accepts Codex Desktop built-in imagegen by default', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OPENAI_API_KEY: missing/);
  assert.match(result.stdout, /built-in Codex Desktop imagegen allowed: yes/);
  assert.match(result.stdout, /OPENAI_API_KEY is not required/);
});

test('[home-field] chibi proof preflight blocks cleanup in strict shell mode without an output path', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '1',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: '1'
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /Home Field Chibi Proof Preflight/);
  assert.match(result.stdout, /strict explicit-output mode: yes/);
  assert.match(result.stderr, /Preflight failed/);
  assert.match(result.stderr, /Before moving or deleting stale Thalla raw\/candidate files/);
});

test('[home-field] chibi proof preflight accepts supplied local image inputs', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-preflight-test');
  const localInput = path.join(fixtureDir, 'thalla-reference.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeTinyTransparentFixture(localInput);

  try {
    const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        OPENAI_API_KEY: '',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
        HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: localInput,
        HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '1',
        HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: '1'
      },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Preflight passed/);
    assert.match(result.stdout, /local image inputs supplied: 1/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] field-context grass queue asks for larger meadow context and center crop', () => {
  const result = spawnSync(process.execPath, [
    nextScriptPath,
    '--batch=terrain-grass',
    '--review-verdict=approved,needs_review,needs_regen',
    '--include-existing',
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
  assert.match(result.stdout, /Home Field scale contract/);
  assert.match(result.stdout, /terrain texture must stay quieter than chibis and object-layer props/);
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
  assert.match(result.stdout, /npm run game:home-field:produce-grass-family-candidate/);
  assert.match(result.stdout, /candidate game home-field bitmap/);
  assert.match(result.stdout, /--plan=lower-band/);
  assert.match(result.stdout, /Home Field scale contract/);
  assert.match(result.stdout, /Do not change zoom level between crop zones/);
  assert.match(result.stdout, /game:home-field:grass-family-sheet/);
  assert.match(result.stdout, /Do not save separate per-tile raw PNGs/);
});
