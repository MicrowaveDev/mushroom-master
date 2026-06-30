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
const homeFieldPromptsPath = path.join(repoRoot, 'app/shared/home-field/home-field-prompts.json');
const nextGrassFamilyScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-grass-family-prompt.js');
const claimImagegenOutputScriptPath = path.join(repoRoot, 'app/scripts/claim-home-field-imagegen-output.js');
const archiveChibiProofScriptPath = path.join(repoRoot, 'app/scripts/archive-home-field-chibi-proof.js');
const recoverChibiAlphaScriptPath = path.join(repoRoot, 'app/scripts/recover-home-field-chibi-alpha.js');
const recordChibiVerdictScriptPath = path.join(repoRoot, 'app/scripts/record-home-field-chibi-verdict.js');
const chibiPreflightScriptPath = path.join(repoRoot, 'app/scripts/preflight-home-field-chibi-proof.js');
const chibiVerifyScriptPath = path.join(repoRoot, 'app/scripts/verify-home-field-chibi-proof-files.js');
const chibiContextScriptPath = path.join(repoRoot, 'app/scripts/home-field-chibi-proof-context.js');
const chibiSplitScriptPath = path.join(repoRoot, 'app/scripts/split-home-field-chibi-state-sheet.js');
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

function writeRuntimeReadinessFixture(filePath, { edgeClipped = false, floating = false } = {}) {
  const width = 32;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);
  const x0 = edgeClipped ? 0 : 9;
  const x1 = edgeClipped ? 14 : 23;
  const y0 = floating ? 3 : 10;
  const y1 = floating ? 11 : 30;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
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

function writeSizedTransparentFixture(filePath, width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = Math.round(height * 0.25); y < Math.round(height * 0.75); y += 1) {
    for (let x = Math.round(width * 0.25); x < Math.round(width * 0.75); x += 1) {
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

function writeChibiSpritesheet(filePath, { staticIdle = false, staticWalk = false, deepIdle = false } = {}) {
  const width = 512;
  const height = 256;
  const frameWidth = 64;
  const frameHeight = 64;
  const rgba = Buffer.alloc(width * height * 4);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const variant = col < 2 ? (staticIdle ? 0 : col) : staticWalk ? 2 : col;
      const r = 40 + (row * 30);
      const g = 90 + (variant * 12);
      const b = 70 + (variant * 3);
      const idleBob = col === 1 && !staticIdle;
      const yStart = deepIdle && col === 1 ? 24 : idleBob ? 15 : 14;
      const yEnd = deepIdle && col === 1 ? 54 : idleBob ? 55 : 54;
      const xShift = col >= 2 && !staticWalk ? ((col % 3) - 1) : 0;
      for (let y = yStart; y < yEnd; y += 1) {
        for (let x = 18 + xShift; x < 46 + xShift; x += 1) {
          const i = ((row * frameHeight + y) * width + (col * frameWidth + x)) * 4;
          rgba[i + 0] = r;
          rgba[i + 1] = g;
          rgba[i + 2] = b;
          rgba[i + 3] = 255;
        }
      }
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encodeDeterministicPng({ width, height, rgba }));
}

function writeChibiAssetsFixture(filePath, outputPath, {
  sourcePath = '.agent/home-field-workspace/raw/thalla_chibi.source.png'
} = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    tileSize: 256,
    assets: [{
      id: 'chibi_shadow',
      type: 'prop',
      role: 'shared_chibi_ground_shadow',
      promptKey: 'chibi_shadow',
      sourcePath: '.agent/home-field-workspace/raw/chibi_shadow.source.png',
      outputPath: 'web/public/home-field/characters/_shared/chibi_shadow.png',
      publicPath: '/home-field/characters/_shared/chibi_shadow.png',
      width: 64,
      height: 32,
      anchor: { x: 0.5, y: 0.9 },
      readability: { minBboxWidth: 34, minBboxHeight: 8 },
      collision: 'walkable',
      animation: null,
      status: 'placeholder',
      atlasFrameKey: 'chibi_shadow'
    }],
    characters: [{
      id: 'thalla',
      promptKey: 'character_thalla_chibi',
      sourcePath,
      outputPath,
      publicPath: '/home-field/characters/thalla/spritesheet.png',
      spritesheet: {
        width: 512,
        height: 256,
        frameWidth: 64,
        frameHeight: 64,
        cols: 8,
        rows: 4,
        rowOrder: ['down', 'up', 'left', 'right'],
        framesPerRow: { idle: [0, 1], walk: [2, 3, 4, 5, 6, 7] }
      },
      status: 'needs_review'
    }]
  }, null, 2));
}

function writeChibiEvidenceSources(rawDir) {
  writeSizedTransparentFixture(path.join(repoRoot, '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png'), 512, 256);
  writeChibiSpritesheet(path.join(rawDir, 'thalla_chibi.states.source.png'));
  for (const dir of ['down', 'up', 'left', 'right']) {
    for (const kind of ['idle', 'walk']) {
      const count = kind === 'idle' ? 2 : 6;
      for (let idx = 0; idx < count; idx += 1) {
        writeSizedTransparentFixture(path.join(rawDir, `thalla_chibi.frame_${kind}_${dir}_${idx}.source.png`), 64, 64);
      }
    }
  }
}

function withPreservedFile(filePath, callback) {
  const existed = fs.existsSync(filePath);
  const backup = existed ? fs.readFileSync(filePath) : null;
  try {
    return callback();
  } finally {
    if (existed) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, backup);
    } else {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function writeCrispChibiSpritesheet(filePath, { lowQuality = false } = {}) {
  const width = 512;
  const height = 256;
  const frameWidth = 64;
  const frameHeight = 64;
  const rgba = Buffer.alloc(width * height * 4);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const variant = col < 2 ? col : col;
      const cx = col * frameWidth;
      const cy = row * frameHeight;
      const rowXStart = [16, 18, 14, 18][row];
      const rowXEnd = [48, 46, 46, 50][row];
      const rowYStart = [12, 14, 13, 13][row];
      for (let y = 12; y < 56; y += 1) {
        for (let x = rowXStart; x < rowXEnd; x += 1) {
          if (y < rowYStart) continue;
          const i = ((cy + y) * width + (cx + x)) * 4;
          const edge = x < rowXStart + 4 || x >= rowXEnd - 4 || y < rowYStart + 4 || y >= 52;
          if (lowQuality) {
            rgba[i + 0] = 178 + variant;
            rgba[i + 1] = 165 + variant;
            rgba[i + 2] = 132 + variant;
          } else if (edge) {
            rgba[i + 0] = 54;
            rgba[i + 1] = 35;
            rgba[i + 2] = 24;
          } else {
            rgba[i + 0] = 238;
            rgba[i + 1] = 215 - (row * 8);
            rgba[i + 2] = 148 + (variant * 3);
          }
          rgba[i + 3] = 255;
        }
      }
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encodeDeterministicPng({ width, height, rgba }));
}

function writeTinyRepeatedChibiSpritesheet(filePath) {
  const width = 512;
  const height = 256;
  const frameWidth = 64;
  const frameHeight = 64;
  const rgba = Buffer.alloc(width * height * 4);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cx = col * frameWidth;
      const cy = row * frameHeight;
      const yOffset = col % 2;
      for (let y = 24 + yOffset; y < 43 + yOffset; y += 1) {
        for (let x = 25; x < 39; x += 1) {
          const i = ((cy + y) * width + (cx + x)) * 4;
          const edge = x < 27 || x >= 37 || y < 27 + yOffset || y >= 41 + yOffset;
          rgba[i + 0] = edge ? 55 : 236;
          rgba[i + 1] = edge ? 35 : 213;
          rgba[i + 2] = edge ? 24 : 154;
          rgba[i + 3] = 255;
        }
      }
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encodeDeterministicPng({ width, height, rgba }));
}

function writeOddProportionalChibiStateSheet(filePath) {
  const width = 1774;
  const height = 887;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const row = Math.min(3, Math.floor(y / (height / 4)));
    for (let x = 0; x < width; x += 1) {
      const col = Math.min(7, Math.floor(x / (width / 8)));
      const cellX = Math.floor(x - (col * width / 8));
      const cellY = Math.floor(y - (row * height / 4));
      const inSprite = cellX > 64 && cellX < 158 && cellY > 48 && cellY < 174;
      const i = (y * width + x) * 4;
      if (inSprite) {
        rgba[i + 0] = 44 + (row * 32);
        rgba[i + 1] = 96 + (col * 10);
        rgba[i + 2] = 80 + (col * 4);
        rgba[i + 3] = 255;
      } else {
        rgba[i + 0] = 255;
        rgba[i + 1] = 0;
        rgba[i + 2] = 255;
        rgba[i + 3] = 255;
      }
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

test('[home-field] chibi candidate evidence binds reference, grouped source, and split frames', () => {
  const referencePath = path.join(repoRoot, '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png');
  return withPreservedFile(referencePath, () => {
    const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-candidate-evidence-test');
    const outputPath = 'web/public/home-field/characters/thalla/spritesheet.png';
    const candidateRoot = path.join(repoRoot, 'tmp/home-field-chibi-candidate-evidence-candidates');
    const candidateOutputAbs = path.join(candidateRoot, outputPath);
    const rawDir = path.join(fixtureDir, 'raw');
    const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
    writeChibiAssetsFixture(assetsPath, outputPath, {
      sourcePath: path.relative(repoRoot, path.join(rawDir, 'thalla_chibi.states.source.png'))
    });
    writeChibiSpritesheet(candidateOutputAbs);
    writeChibiEvidenceSources(rawDir);

    try {
      const result = spawnSync(process.execPath, [
        candidateEvidenceScriptPath,
        '--ids=thalla'
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
      const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, '.agent/home-field-workspace/review/candidate-evidence.manifest.json'), 'utf8'));
      const entry = manifest.entries[0];
      assert.equal(entry.id, 'thalla');
      assert.match(entry.candidateOutput.sha256, /^[a-f0-9]{64}$/);
      assert.equal(entry.rawSource.path, path.relative(repoRoot, path.join(rawDir, 'thalla_chibi.states.source.png')));
      assert.equal(entry.chibiSources.groupedStateSheet.path, entry.rawSource.path);
      assert.match(entry.chibiSources.reference.sha256, /^[a-f0-9]{64}$/);
      assert.equal(entry.chibiSources.splitFrames.expected, 32);
      assert.equal(entry.chibiSources.splitFrames.present, 32);
      assert.deepEqual(entry.chibiSources.splitFrames.missing, []);
      assert.equal(entry.chibiSources.splitFrames.frames.length, 32);
      assert.match(entry.chibiSources.splitFrames.frameSetSha256, /^[a-f0-9]{64}$/);
      assert.ok(Array.isArray(manifest.previews));
      assert.match(manifest.candidateEvidenceKey, /^[a-f0-9]{64}$/);
      assert.ok(manifest.recoveredFailureNotes);
      assert.ok(['none', 'present', 'parse_error', 'stale_ignored'].includes(manifest.recoveredFailureNotes.status));
      assert.equal(
        manifest.separateShadowTile?.policy,
        'separate renderer/asset layer; not baked into chibi frames'
      );
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
      fs.rmSync(candidateRoot, { recursive: true, force: true });
    }
  });
});

test('[home-field] candidate evidence ignores stale recovered failure notes', () => {
  const referencePath = path.join(repoRoot, '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png');
  const notesPath = path.join(repoRoot, '.agent/home-field-workspace/review/recovered-failure-notes.json');
  return withPreservedFile(referencePath, () => withPreservedFile(notesPath, () => {
    const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-stale-notes-test');
    const outputPath = 'web/public/home-field/characters/thalla/spritesheet.png';
    const candidateRoot = path.join(repoRoot, 'tmp/home-field-chibi-stale-notes-candidates');
    const candidateOutputAbs = path.join(candidateRoot, outputPath);
    const rawDir = path.join(fixtureDir, 'raw');
    const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
    writeChibiAssetsFixture(assetsPath, outputPath, {
      sourcePath: path.relative(repoRoot, path.join(rawDir, 'thalla_chibi.states.source.png'))
    });
    writeChibiSpritesheet(candidateOutputAbs);
    writeChibiEvidenceSources(rawDir);
    fs.mkdirSync(path.dirname(notesPath), { recursive: true });
    fs.writeFileSync(notesPath, JSON.stringify({
      status: 'present',
      generatedAt: '2026-06-23T00:00:00.000Z',
      candidateOutputSha256: '0'.repeat(64),
      notes: ['stale failure note from an older proof run']
    }, null, 2));

    try {
      const result = spawnSync(process.execPath, [
        candidateEvidenceScriptPath,
        '--ids=thalla'
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
      const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, '.agent/home-field-workspace/review/candidate-evidence.manifest.json'), 'utf8'));
      assert.equal(manifest.recoveredFailureNotes.status, 'stale_ignored');
      assert.deepEqual(manifest.recoveredFailureNotes.notes, []);
      assert.match(manifest.recoveredFailureNotes.expectedCandidateEvidenceKey, /^[a-f0-9]{64}$/);
      assert.equal(manifest.recoveredFailureNotes.foundCandidateOutputSha256[0], '0'.repeat(64));
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
      fs.rmSync(candidateRoot, { recursive: true, force: true });
    }
  }));
});

test('[home-field] chibi candidate evidence fails without grouped state source', () => {
  const referencePath = path.join(repoRoot, '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png');
  return withPreservedFile(referencePath, () => {
    const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-candidate-evidence-missing-test');
    const outputPath = 'web/public/home-field/characters/thalla/spritesheet.png';
    const candidateRoot = path.join(repoRoot, 'tmp/home-field-chibi-candidate-evidence-missing-candidates');
    const candidateOutputAbs = path.join(candidateRoot, outputPath);
    const rawDir = path.join(fixtureDir, 'raw');
    const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
    writeChibiAssetsFixture(assetsPath, outputPath, {
      sourcePath: path.relative(repoRoot, path.join(rawDir, 'thalla_chibi.source.png'))
    });
    writeChibiSpritesheet(candidateOutputAbs);

    try {
      const result = spawnSync(process.execPath, [
        candidateEvidenceScriptPath,
        '--ids=thalla'
      ], {
        cwd: repoRoot,
        env: {
          ...process.env,
          HOME_FIELD_ASSETS_PATH: assetsPath,
          HOME_FIELD_CANDIDATE_ROOT: path.relative(repoRoot, candidateRoot)
        },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.match(result.stderr, /missing chibi grouped state sheet/);
      assert.match(result.stderr, /missing chibi split frames/);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
      fs.rmSync(candidateRoot, { recursive: true, force: true });
    }
  });
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

test('[home-field] runtime readiness rejects clipped edges and floating anchors', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-runtime-readiness-test');
  const outputPath = 'web/public/home-field/__test__/chroma_fixture.png';
  const candidateRoot = path.join(repoRoot, 'tmp/home-field-runtime-readiness-candidates');
  const candidateOutputAbs = path.join(candidateRoot, outputPath);
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  const mapPath = path.join(fixtureDir, 'home-field-map.fixture.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  writeAssetsFixture(assetsPath, outputPath);
  writeMapFixture(mapPath);

  const runValidation = () => spawnSync(process.execPath, [
    validateScriptPath,
    '--ids=chroma_fixture',
    '--check-files',
    '--check-runtime-readiness'
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

  try {
    writeRuntimeReadinessFixture(candidateOutputAbs, { edgeClipped: true });
    const clipped = runValidation();
    assert.equal(clipped.status, 1, clipped.stderr || clipped.stdout);
    assert.match(clipped.stderr, /unsafe_edge_padding/);

    writeRuntimeReadinessFixture(candidateOutputAbs, { floating: true });
    const floating = runValidation();
    assert.equal(floating.status, 1, floating.stderr || floating.stdout);
    assert.match(floating.stderr, /floating_anchor_gap/);

    writeRuntimeReadinessFixture(candidateOutputAbs);
    const passed = runValidation();
    assert.equal(passed.status, 0, passed.stderr || passed.stdout);
    assert.match(passed.stdout, /runtime asset readiness/);
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
  assert.match(result.stdout, /Runtime asset contract/);
  assert.match(result.stdout, /Generate for the final in-game footprint, not contact-sheet beauty/);
  assert.match(result.stdout, /safe transparent padding/);
  assert.match(result.stdout, /Runtime canvas: 256x256px/);
  assert.match(result.stdout, /Visual footprint target: small field token/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*--check-alpha-halo/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*--check-runtime-readiness/);
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
  assert.match(result.stdout, /Runtime asset contract/);
  assert.match(result.stdout, /Terrain runtime role: this is walkable or blocking ground inside a tilemap/);
  assert.match(result.stdout, /composed mobile and desktop clean field screenshots/);
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
  assert.match(result.stdout, /stop before stale-file archive if it fails/);
  assert.match(result.stdout, /real PNG file at a known filesystem path/);
  assert.match(result.stdout, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1/);
  assert.match(result.stdout, /reference-image input binding/);
  assert.match(result.stdout, /diagnostic non-candidate built-in imagegen probe/);
  assert.match(result.stdout, /reference-image input binding is already confirmed/);
  assert.match(result.stdout, /--since-minutes=5/);
  assert.match(result.stdout, /same-agent file output and reference-image input binding are confirmed/);
  assert.match(result.stdout, /same agent context that will run imagegen/);
  assert.match(result.stdout, /game:home-field:find-imagegen-output/);
  assert.match(result.stdout, /game:home-field:archive-stale-chibi-proof -- thalla/);
  assert.match(result.stdout, /game:home-field:claim-imagegen-output/);
  assert.match(result.stdout, /chibi-proof-context/);
  assert.match(result.stdout, /verify-chibi-proof-files -- --reference/);
  assert.match(result.stdout, /thalla_chibi\.states\.source\.png/);
  assert.match(result.stdout, /verify-chibi-proof-files -- --state-sheet/);
  assert.match(result.stdout, /split-chibi-state-sheet -- --chroma-key=#ff00ff --resize/);
  assert.match(result.stdout, /verify-chibi-proof-files -- --frames/);
  assert.match(result.stdout, /Candidate output path .*candidates\/chibi-active-roster\/latest/);
  assert.match(result.stdout, /Runtime asset contract/);
  assert.match(result.stdout, /raw source completeness/i);
  assert.match(result.stdout, /separate chibi shadow layer/);
  assert.match(result.stdout, /Animation: spritesheet-driven idle\/walk frames/);
  assert.doesNotMatch(result.stdout, /Animation: none \(single static PNG\)/);
  assert.match(result.stdout, /claim-imagegen-output -- --since=<render-start-iso>/);
  assert.match(result.stdout, /recover-chibi-alpha -- thalla/);
  assert.match(result.stdout, /record-chibi-verdict -- thalla --verdict=needs_regen/);
  assert.match(result.stdout, /sprite-box reference sheet/i);
  assert.match(result.stdout, /thalla_chibi_turnaround\.reference\.png/);
  assert.match(result.stdout, /Use that reference only for consistency; do not slice it into final frames/);
  assert.match(result.stdout, /one coherent 8x4 state sheet/i);
  assert.match(result.stdout, /Do not generate the final idle\/walk states as separate imagegen calls/);
  assert.match(result.stdout, /grouped state sheet itself must contain the idle bob and walk poses/);
  assert.match(result.stdout, /do not synthesize motion after split/i);
  assert.match(result.stdout, /Post-split deterministic processing may clean alpha\/chroma fringe, crop, and resize only/);
  assert.match(result.stdout, /BJD-inspired doll simplicity/);
  assert.match(result.stdout, /state the chibi palette, style-preservation, scale\/face\/biology, and status-simplification plans before imagegen/);
  assert.match(result.stdout, /Copyable Sprite-Box Reference Prompt/);
  assert.match(result.stdout, /attach these checked-in PNGs as actual image inputs/);
  assert.match(result.stdout, /with those local PNGs attached as actual image inputs/);
  assert.match(result.stdout, /Viewing the PNGs in chat is not enough/i);
  assert.match(result.stdout, /Do not run this as another text-only generation/);
  assert.match(result.stdout, /sprite-box reference sheet/);
  assert.match(result.stdout, /Input images: use the attached checked-in reference images as guidance/);
  assert.match(result.stdout, /tiny .*source-sprite views/);
  assert.match(result.stdout, /invisible 96x96 source-sprite boxes/);
  assert.match(result.stdout, /at least 70% of the sheet empty #ff00ff/);
  assert.match(result.stdout, /2026-06-29 image-guided attempts already failed/);
  assert.match(result.stdout, /field-sprite leader/);
  assert.match(result.stdout, /small dark seed\/dot eyes/);
  assert.match(result.stdout, /no visible hair bangs or wig fringe/);
  assert.match(result.stdout, /limited sprite palette/i);
  assert.match(result.stdout, /12-18 artist-visible colors/);
  assert.match(result.stdout, /fewer than 20 total design colors/);
  assert.match(result.stdout, /chibi-thalla-previous-best-2026-06-26-state-sheet/);
  assert.match(result.stdout, /preserve its squat proportions, cap\/body\/face charm/);
  assert.match(result.stdout, /represent authority through cap silhouette/);
  assert.match(result.stdout, /No royal regalia, crown jewel, forehead gem, brooch, chest medallion, pendant/);
  assert.match(result.stdout, /scalloped collar/);
  assert.match(result.stdout, /sleeve cuff trim/);
  assert.match(result.stdout, /no royal regalia, no crown jewels, no forehead gems, no brooches, no chest medallions/);
  assert.match(result.stdout, /If two exact-prompt image-guided reference attempts fail the same visual gate/);
  assert.match(result.stdout, /Do not fall back to text-only reference attempts/);
  assert.match(result.stdout, /Do not overcorrect the palette rule into hard pixel art, clean vector\/cel icon art/);
  assert.match(result.stdout, /no overcorrected flat\/vector\/cel\/pixel style/);
  assert.match(result.stdout, /no baked foot ovals/);
  assert.match(result.stdout, /fail visible palette bloat through styleCohesionCheck\/stageContractCheck/);
  assert.match(result.stdout, /simpler than the 2026-06-20 candidate/);
  assert.match(result.stdout, /Mechanical sheet success, alpha success, mobile readability, and chibi-quality validation do not count as style approval/);
  assert.match(result.stdout, /npm run game:home-field:produce-chibi-candidate -- thalla --resize --chroma-key=#ff00ff/);
  assert.match(result.stdout, /verify-chibi-proof-files -- --candidate/);
  assert.doesNotMatch(result.stdout, /produce-chibi-candidate -- thalla --resize-nearest/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*candidates\/chibi-active-roster\/latest.*--ids=thalla --check-files --check-readability/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*candidates\/chibi-active-roster\/latest.*--ids=thalla --check-files --check-runtime-readiness/);
  assert.match(result.stdout, /--check-chibi-animation/);
  assert.match(result.stdout, /--check-chibi-quality/);
  assert.match(result.stdout, /at least as crisp, contrasted, and finished as approved Home Field props/);
  assert.match(result.stdout, /4 meaningful walk poses distributed across 6 slots/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /HOME_FIELD_CANDIDATE_IDS=thalla .*chibi-candidate-preview/);
  assert.doesNotMatch(result.stdout, /npm run game:home-field:produce -- thalla/);
});

test('[home-field] placeholder chibi prompt stays legacy-only', () => {
  const prompts = JSON.parse(fs.readFileSync(homeFieldPromptsPath, 'utf8'));
  const placeholder = prompts.prompts.character_placeholder_silhouette;

  assert.match(placeholder.details, /PLACEHOLDER-ONLY LEGACY PER-FRAME GENERATION/);
  assert.match(placeholder.constraints, /Current Stage 1 Thalla proof candidates must follow the grouped 8x4 source-sheet and 32 split-frame contract/);
  assert.doesNotMatch(placeholder.constraints, /full 32-frame animation is a later optional polish stage/);
});

test('[home-field] chibi proof context prints narrow paths and commands', () => {
  const result = spawnSync(process.execPath, [chibiContextScriptPath], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Thalla Home Field Chibi Proof Context/);
  assert.match(result.stdout, /raw frames: \d+\/32 present/);
  assert.match(result.stdout, /state sheet:/);
  assert.match(result.stdout, /Motion contract: idle bob and walk poses must exist in the grouped state sheet itself/);
  assert.match(result.stdout, /Palette contract: state the plan before imagegen/);
  assert.match(result.stdout, /styleCohesionCheck\/stageContractCheck/);
  assert.match(result.stdout, /--check-runtime-readiness/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /Freshness warning: existing \.agent files are not proof of a fresh run/);
  assert.match(result.stdout, /Reference-input warning: current Thalla proof art needs the checked-in PNGs attached as actual imagegen inputs/);
  assert.match(result.stdout, /do not run the probe when reference binding is unavailable/);
  assert.match(result.stdout, /archive-stale-chibi-proof/);
  assert.match(result.stdout, /claim-imagegen-output/);
  assert.match(result.stdout, /recover-chibi-alpha/);
  assert.match(result.stdout, /record-chibi-verdict/);
  assert.match(result.stdout, /Runtime contract: raw source must be unclipped/);
  assert.match(result.stdout, /Post-split processing may clean alpha\/chroma fringe, crop, and resize only/);
  assert.match(result.stdout, /Shadow contract: no baked shadow/);
});

test('[home-field] chibi proof file verifier checks generated PNG paths', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-verify-test');
  const pngPath = path.join(fixtureDir, 'one-frame.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeSizedTransparentFixture(pngPath, 64, 64);

  try {
    const result = spawnSync(process.execPath, [chibiVerifyScriptPath, `--path=${pngPath}`], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Freshness warning: this check proves files exist and have expected dimensions only/);
    assert.match(result.stdout, /home-field chibi proof file verification: PASS/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] imagegen output claim copies only newer bounded files', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-imagegen-claim-test');
  const generatedRoot = path.join(fixtureDir, 'generated');
  const oldSource = path.join(generatedRoot, 'old.png');
  const newSource = path.join(generatedRoot, 'new.png');
  const dest = path.join(fixtureDir, 'claimed/reference.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeSizedTransparentFixture(oldSource, 16, 16);
  writeSizedTransparentFixture(newSource, 32, 32);
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const oldTime = new Date(Date.now() - 120_000);
  fs.utimesSync(oldSource, oldTime, oldTime);

  try {
    const result = spawnSync(process.execPath, [
      claimImagegenOutputScriptPath,
      `--since=${cutoff}`,
      `--dest=${path.relative(repoRoot, dest)}`,
      `--root=${generatedRoot}`
    ], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(dest), true);
    assert.equal(readPngRgba(dest).width, 32);
    assert.match(result.stdout, /home-field imagegen claim: copied/);
    assert.match(result.stdout, /dest sha256: [a-f0-9]{64}/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] chibi proof helper commands expose documented help', () => {
  for (const script of [
    archiveChibiProofScriptPath,
    recoverChibiAlphaScriptPath,
    recordChibiVerdictScriptPath,
    claimImagegenOutputScriptPath
  ]) {
    const result = spawnSync(process.execPath, [script, '--help'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${script}\n${result.stderr || result.stdout}`);
    assert.match(result.stdout, /Usage:/);
  }
});

test('[home-field] package exposes chibi proof helper aliases', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['game:home-field:claim-imagegen-output'], 'node app/scripts/claim-home-field-imagegen-output.js');
  assert.equal(pkg.scripts['game:home-field:archive-stale-chibi-proof'], 'node app/scripts/archive-home-field-chibi-proof.js');
  assert.equal(pkg.scripts['game:home-field:recover-chibi-alpha'], 'node app/scripts/recover-home-field-chibi-alpha.js');
  assert.equal(pkg.scripts['game:home-field:record-chibi-verdict'], 'node app/scripts/record-home-field-chibi-verdict.js');
  assert.equal(pkg.scripts['shrink:screenshots'], 'bash ../bash/shrink-screenshots.sh');
});

test('[home-field] produce assets --help exits before asset lookup', () => {
  const result = spawnSync(process.execPath, [scriptPath, '--help'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: produce-home-field-assets\.js/);
  assert.doesNotMatch(result.stderr, /Unknown asset id/);
});

test('[home-field] record chibi verdict copies hashes from candidate evidence', () => {
  const reviewPath = path.join(repoRoot, 'docs/home-field-asset-review.json');
  return withPreservedFile(reviewPath, () => {
    const fixtureDir = path.join(repoRoot, 'tmp/home-field-record-chibi-verdict-test');
    const manifestPath = path.join(fixtureDir, 'candidate-evidence.manifest.json');
    const reasonPath = path.join(fixtureDir, 'reason.txt');
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(reasonPath, 'Visual critic: readable but still too soft beside approved props.');
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      generatedAt: '2026-06-26T00:00:00.000Z',
      candidateRoot: '.agent/home-field-workspace/candidates/chibi-active-roster/latest',
      ids: ['thalla'],
      entries: [{
        id: 'thalla',
        candidateOutput: { path: 'candidate/spritesheet.png', sha256: '1'.repeat(64) },
        rawSource: { path: 'raw/thalla_chibi.states.source.png', sha256: '2'.repeat(64) },
        chibiSources: {
          reference: { path: 'reference/thalla_chibi_turnaround.reference.png', sha256: '3'.repeat(64) }
        }
      }],
      previews: [
        { path: '.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png', sha256: '4'.repeat(64) },
        { path: '.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png', sha256: '5'.repeat(64) }
      ],
      manifestSha256: '6'.repeat(64)
    }, null, 2));

    try {
      const result = spawnSync(process.execPath, [
        recordChibiVerdictScriptPath,
        'thalla',
        '--verdict=needs_regen',
        `--reason-file=${path.relative(repoRoot, reasonPath)}`,
        `--manifest=${path.relative(repoRoot, manifestPath)}`
      ], {
        cwd: repoRoot,
        encoding: 'utf8'
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8')).assets.find((entry) => entry.id === 'thalla');
      assert.equal(review.verdict, 'needs_regen');
      assert.equal(review.accepted, false);
      assert.equal(review.candidateSha256, '1'.repeat(64));
      assert.equal(review.rawSourceSha256, '2'.repeat(64));
      assert.equal(review.referenceSha256, '3'.repeat(64));
      assert.equal(review.mobileScreenshotSha256, '4'.repeat(64));
      assert.equal(review.desktopScreenshotSha256, '5'.repeat(64));
      assert.equal(review.candidateEvidenceSha256, '6'.repeat(64));
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});

test('[home-field] chibi state sheet splitter writes canonical raw frame chunks', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-state-sheet-test');
  const sourcePath = path.join(fixtureDir, 'raw/thalla_chibi.states.source.png');
  const outputDir = path.join(fixtureDir, 'raw');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeChibiSpritesheet(sourcePath, { staticWalk: false });

  try {
    const result = spawnSync(process.execPath, [
      chibiSplitScriptPath,
      `--source=${path.relative(repoRoot, sourcePath)}`,
      `--output-dir=${path.relative(repoRoot, outputDir)}`,
      '--prefix=thalla_chibi'
    ], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /32 frame/);
    const idlePath = path.join(outputDir, 'thalla_chibi.frame_idle_down_0.source.png');
    const walkPath = path.join(outputDir, 'thalla_chibi.frame_walk_right_5.source.png');
    assert.equal(readPngRgba(idlePath).width, 64);
    assert.equal(readPngRgba(idlePath).height, 64);
    assert.equal(readPngRgba(walkPath).width, 64);
    assert.equal(readPngRgba(walkPath).height, 64);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] chibi state sheet splitter resizes odd proportional source sheets before slicing', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-state-sheet-resize-test');
  const sourcePath = path.join(fixtureDir, 'raw/thalla_chibi.states.source.png');
  const outputDir = path.join(fixtureDir, 'raw');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeOddProportionalChibiStateSheet(sourcePath);

  try {
    const result = spawnSync(process.execPath, [
      chibiSplitScriptPath,
      `--source=${path.relative(repoRoot, sourcePath)}`,
      `--output-dir=${path.relative(repoRoot, outputDir)}`,
      '--prefix=thalla_chibi',
      '--chroma-key=#ff00ff',
      '--resize'
    ], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /source: 1774x887/);
    assert.match(result.stdout, /working cell: 64x64/);
    const idlePath = path.join(outputDir, 'thalla_chibi.frame_idle_down_0.source.png');
    const walkPath = path.join(outputDir, 'thalla_chibi.frame_walk_right_5.source.png');
    assert.equal(readPngRgba(idlePath).width, 64);
    assert.equal(readPngRgba(idlePath).height, 64);
    assert.equal(readPngRgba(walkPath).width, 64);
    assert.equal(readPngRgba(walkPath).height, 64);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] chibi animation validator rejects static replicated walk frames', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-animation-test');
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  const mapPath = path.join(fixtureDir, 'home-field-map.fixture.json');
  const candidateRoot = path.join(fixtureDir, 'candidate-root');
  const outputPath = 'web/public/home-field/characters/thalla/spritesheet.png';
  const outputAbs = path.join(candidateRoot, outputPath);
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(assetsPath), { recursive: true });
  fs.writeFileSync(assetsPath, JSON.stringify({
    version: 1,
    tileSize: 256,
    assets: [],
    characters: [{
      id: 'thalla',
      promptKey: 'character_thalla_chibi',
      sourcePath: '.agent/home-field-workspace/raw/thalla_chibi.source.png',
      outputPath,
      publicPath: '/home-field/characters/thalla/spritesheet.png',
      spritesheet: {
        width: 512,
        height: 256,
        frameWidth: 64,
        frameHeight: 64,
        cols: 8,
        rows: 4,
        rowOrder: ['down', 'up', 'left', 'right'],
        framesPerRow: { idle: [0, 1], walk: [2, 3, 4, 5, 6, 7] }
      },
      status: 'needs_review'
    }]
  }, null, 2));
  writeMapFixture(mapPath);

  try {
    writeChibiSpritesheet(outputAbs, { staticWalk: true });
    const failed = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=thalla',
      '--check-files',
      '--check-chibi-animation'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: candidateRoot
      },
      encoding: 'utf8'
    });
    assert.equal(failed.status, 1, failed.stderr || failed.stdout);
    assert.match(failed.stderr, /walk_frames_too_static/);

    writeChibiSpritesheet(outputAbs, { staticIdle: true, staticWalk: false });
    const failedIdle = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=thalla',
      '--check-files',
      '--check-chibi-animation'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: candidateRoot
      },
      encoding: 'utf8'
    });
    assert.equal(failedIdle.status, 1, failedIdle.stderr || failedIdle.stdout);
    assert.match(failedIdle.stderr, /idle_frames_too_static/);

    writeChibiSpritesheet(outputAbs, { deepIdle: true, staticWalk: false });
    const failedDeepIdle = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=thalla',
      '--check-files',
      '--check-chibi-animation'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: candidateRoot
      },
      encoding: 'utf8'
    });
    assert.equal(failedDeepIdle.status, 1, failedDeepIdle.stderr || failedDeepIdle.stdout);
    assert.match(failedDeepIdle.stderr, /idle_squat_too_deep/);

    writeChibiSpritesheet(outputAbs, { staticWalk: false });
    const passed = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=thalla',
      '--check-files',
      '--check-chibi-animation'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: candidateRoot
      },
      encoding: 'utf8'
    });
    assert.equal(passed.status, 0, passed.stderr || passed.stdout);
    assert.match(passed.stdout, /chibi idle\/walk animation/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] chibi quality validator rejects soft low-contrast sheets', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-quality-test');
  const assetsPath = path.join(fixtureDir, 'home-field-assets.fixture.json');
  const mapPath = path.join(fixtureDir, 'home-field-map.fixture.json');
  const candidateRoot = path.join(fixtureDir, 'candidate-root');
  const outputPath = 'web/public/home-field/characters/thalla/spritesheet.png';
  const outputAbs = path.join(candidateRoot, outputPath);
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(assetsPath), { recursive: true });
  fs.writeFileSync(assetsPath, JSON.stringify({
    version: 1,
    tileSize: 256,
    assets: [],
    characters: [{
      id: 'thalla',
      promptKey: 'character_thalla_chibi',
      sourcePath: '.agent/home-field-workspace/raw/thalla_chibi.source.png',
      outputPath,
      publicPath: '/home-field/characters/thalla/spritesheet.png',
      spritesheet: {
        width: 512,
        height: 256,
        frameWidth: 64,
        frameHeight: 64,
        cols: 8,
        rows: 4,
        rowOrder: ['down', 'up', 'left', 'right'],
        framesPerRow: { idle: [0, 1], walk: [2, 3, 4, 5, 6, 7] }
      },
      status: 'needs_review'
    }]
  }, null, 2));
  writeMapFixture(mapPath);

  try {
    writeCrispChibiSpritesheet(outputAbs, { lowQuality: true });
    const failed = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=thalla',
      '--check-files',
      '--check-chibi-quality'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: candidateRoot
      },
      encoding: 'utf8'
    });
    assert.equal(failed.status, 1, failed.stderr || failed.stdout);
    assert.match(failed.stderr, /low_value_range|weak_dark_outline/);

    writeTinyRepeatedChibiSpritesheet(outputAbs);
    const failedTiny = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=thalla',
      '--check-files',
      '--check-chibi-quality'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: candidateRoot
      },
      encoding: 'utf8'
    });
    assert.equal(failedTiny.status, 1, failedTiny.stderr || failedTiny.stdout);
    assert.match(failedTiny.stderr, /chibi_footprint_too_small/);
    assert.match(failedTiny.stderr, /direction_rows_too_similar/);

    writeCrispChibiSpritesheet(outputAbs, { lowQuality: false });
    const passed = spawnSync(process.execPath, [
      validateScriptPath,
      '--ids=thalla',
      '--check-files',
      '--check-chibi-quality'
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME_FIELD_ASSETS_PATH: assetsPath,
        HOME_FIELD_MAP_PATH: mapPath,
        HOME_FIELD_ASSET_ROOT: candidateRoot
      },
      encoding: 'utf8'
    });
    assert.equal(passed.status, 0, passed.stderr || passed.stdout);
    assert.match(passed.stdout, /chibi crispness\/contrast quality/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] chibi proof preflight blocks missing built-in reference binding before output probe', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /OPENAI_API_KEY: missing/);
  assert.match(result.stdout, /built-in Codex Desktop imagegen proof-art ready: no/);
  assert.match(result.stdout, /built-in imagegen disk save explicitly confirmed: no/);
  assert.match(result.stdout, /built-in imagegen reference-input explicitly confirmed: no/);
  assert.match(result.stderr, /Preflight failed/);
  assert.match(result.stderr, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1/);
  assert.match(result.stderr, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(result.stderr, /same agent context that will run imagegen/);
  assert.match(result.stderr, /Viewing PNGs with view_image or mentioning them in the text prompt is not reference-image binding/);
  assert.match(result.stderr, /Do not run the built-in output diagnostic yet/);
  assert.match(result.stderr, /cannot unblock this Thalla proof until reference-image input binding is confirmed/);
  assert.doesNotMatch(result.stderr, /run one tiny diagnostic non-candidate image_gen probe/);
  assert.doesNotMatch(result.stderr, /find-imagegen-output -- --since-minutes=5/);
  assert.match(result.stderr, /Do not archive stale files before preflight passes/);
  assert.match(result.stdout, /State sheet output path: \.agent\/home-field-workspace\/raw\/thalla_chibi\.states\.source\.png/);
  assert.match(result.stdout, /Raw frame output slots: 32/);
});

test('[home-field] chibi proof preflight allows output probe only after reference binding is confirmed', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '1',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /built-in imagegen disk save explicitly confirmed: no/);
  assert.match(result.stdout, /built-in imagegen reference-input explicitly confirmed: yes/);
  assert.match(result.stderr, /reference-image input binding is already confirmed/);
  assert.match(result.stderr, /run one tiny diagnostic non-candidate image_gen probe/);
  assert.match(result.stderr, /find-imagegen-output -- --since-minutes=5/);
});

test('[home-field] chibi proof preflight blocks built-in imagegen without confirmed reference inputs', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '1',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /built-in imagegen disk save explicitly confirmed: yes/);
  assert.match(result.stdout, /built-in imagegen reference-input explicitly confirmed: no/);
  assert.match(result.stderr, /reference-image input binding/);
  assert.match(result.stderr, /Do not run the built-in output diagnostic yet/);
  assert.doesNotMatch(result.stderr, /run one tiny diagnostic non-candidate image_gen probe/);
});

test('[home-field] chibi proof preflight accepts confirmed built-in disk output and reference inputs', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '1',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '1',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /built-in Codex Desktop imagegen proof-art ready: yes/);
  assert.match(result.stdout, /built-in imagegen reference-input explicitly confirmed: yes/);
  assert.match(result.stdout, /Preflight passed/);
  assert.match(result.stdout, /disk save and reference-image input binding were explicitly confirmed/);
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
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
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
