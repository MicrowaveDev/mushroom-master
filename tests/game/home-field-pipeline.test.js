import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../../app/shared/repo-root.js';
import { encodeDeterministicPng, readPngRgba, alphaStats, fileSha256 } from '../../app/scripts/lib/bitmap-image-toolkit.js';

const scriptPath = path.join(repoRoot, 'app/scripts/produce-home-field-assets.js');
const grassFamilyScriptPath = path.join(repoRoot, 'app/scripts/produce-home-field-grass-family.js');
const grassFamilySheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-grass-family-sheet.js');
const alphaSheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-alpha-sheet.js');
const mobileReadabilitySheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-mobile-readability-sheet.js');
const candidateEvidenceScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-candidate-evidence.js');
const validateScriptPath = path.join(repoRoot, 'app/scripts/validate-home-field-assets.js');
const nextScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-image-prompts.js');
const homeFieldPromptsPath = path.join(repoRoot, 'app/shared/home-field/home-field-prompts.json');
const homeFieldGenerationQueuePath = path.join(repoRoot, 'app/shared/home-field/home-field-generation-queue.json');
const runChibiProofPromptPath = path.join(repoRoot, 'app/shared/home-field/RUN_CHIBI_PROOF_PROMPT.md');
const homeFieldImagegenRequirementsPath = path.join(repoRoot, 'docs/home-field-imagegen-requirements.md');
const nextGrassFamilyScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-grass-family-prompt.js');
const claimImagegenOutputScriptPath = path.join(repoRoot, 'app/scripts/claim-home-field-imagegen-output.js');
const archiveChibiProofScriptPath = path.join(repoRoot, 'app/scripts/archive-home-field-chibi-proof.js');
const recoverChibiAlphaScriptPath = path.join(repoRoot, 'app/scripts/recover-home-field-chibi-alpha.js');
const recordChibiVerdictScriptPath = path.join(repoRoot, 'app/scripts/record-home-field-chibi-verdict.js');
const chibiPreflightScriptPath = path.join(repoRoot, 'app/scripts/preflight-home-field-chibi-proof.js');
const chibiReferenceApiProofScriptPath = path.join(repoRoot, 'app/scripts/run-home-field-chibi-reference-api-proof.js');
const chibiVerifyScriptPath = path.join(repoRoot, 'app/scripts/verify-home-field-chibi-proof-files.js');
const chibiContextScriptPath = path.join(repoRoot, 'app/scripts/home-field-chibi-proof-context.js');
const generationQueueScriptPath = path.join(repoRoot, 'app/scripts/print-home-field-generation-queue.js');
const chibiSplitScriptPath = path.join(repoRoot, 'app/scripts/split-home-field-chibi-state-sheet.js');
const paletteAuditScriptPath = path.join(repoRoot, 'app/scripts/audit-home-field-chibi-palette.js');
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

function writePaletteBlocksFixture(filePath, colors) {
  const block = 8;
  const cols = Math.ceil(Math.sqrt(colors.length));
  const rows = Math.ceil(colors.length / cols);
  const width = cols * block;
  const height = rows * block;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i + 0] = 255;
    rgba[i + 1] = 0;
    rgba[i + 2] = 255;
    rgba[i + 3] = 255;
  }
  colors.forEach((rgb, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    for (let y = 0; y < block; y += 1) {
      for (let x = 0; x < block; x += 1) {
        const off = ((row * block + y) * width + (col * block + x)) * 4;
        rgba[off + 0] = rgb[0];
        rgba[off + 1] = rgb[1];
        rgba[off + 2] = rgb[2];
        rgba[off + 3] = 255;
      }
    }
  });
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

function writeChibiReferenceSpriteBoxFixture(filePath, { oversized = false } = {}) {
  const width = 512;
  const height = 384;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i + 0] = 255;
    rgba[i + 1] = 0;
    rgba[i + 2] = 255;
    rgba[i + 3] = 255;
  }
  const boxes = oversized
    ? [
      [80, 40],
      [300, 40],
      [80, 230],
      [300, 230]
    ]
    : [
      [96, 72],
      [320, 72],
      [96, 232],
      [320, 232]
    ];
  const spriteWidth = oversized ? 166 : 62;
  const spriteHeight = oversized ? 136 : 78;
  for (const [cx, cy] of boxes) {
    for (let y = cy; y < cy + spriteHeight; y += 1) {
      for (let x = cx; x < cx + spriteWidth; x += 1) {
        const i = (y * width + x) * 4;
        rgba[i + 0] = 54;
        rgba[i + 1] = 38;
        rgba[i + 2] = 28;
        rgba[i + 3] = 255;
      }
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

function chibiPaletteAuditFixturePaths() {
  const reviewDir = path.join(repoRoot, '.agent/home-field-workspace/review');
  return ['reference', 'state-sheet', 'candidate'].flatMap((stage) => [
    path.join(reviewDir, `thalla-${stage}-palette-audit.json`),
    path.join(reviewDir, `thalla-${stage}-palette-swatch.png`)
  ]);
}

function writeChibiPaletteAuditArtifacts({ rawDir, candidateOutputAbs }) {
  const reviewDir = path.join(repoRoot, '.agent/home-field-workspace/review');
  const sourceByStage = {
    reference: path.join(repoRoot, '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png'),
    'state-sheet': path.join(rawDir, 'thalla_chibi.states.source.png'),
    candidate: candidateOutputAbs
  };
  for (const stage of ['reference', 'state-sheet', 'candidate']) {
    const auditPath = path.join(reviewDir, `thalla-${stage}-palette-audit.json`);
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.writeFileSync(auditPath, JSON.stringify({
      schemaVersion: 1,
      source: { sha256: fileSha256(sourceByStage[stage]) },
      counts: {
        exactColorsAtLeastSignificantThreshold: 12,
        exactColorsAtLeastMinorThreshold: 16,
        coarseBins: { step32: { atLeastSignificantThreshold: 18 } }
      },
      budget: {
        status: 'pass',
        note: 'fixture palette audit'
      }
    }, null, 2));
    writeSizedTransparentFixture(path.join(reviewDir, `thalla-${stage}-palette-swatch.png`), 16, 16);
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

function withPreservedFiles(filePaths, callback) {
  const backups = filePaths.map((filePath) => ({
    filePath,
    existed: fs.existsSync(filePath),
    data: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null
  }));
  try {
    return callback();
  } finally {
    for (const backup of backups) {
      if (backup.existed) {
        fs.mkdirSync(path.dirname(backup.filePath), { recursive: true });
        fs.writeFileSync(backup.filePath, backup.data);
      } else {
        fs.rmSync(backup.filePath, { force: true });
      }
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
  return withPreservedFiles([referencePath, ...chibiPaletteAuditFixturePaths()], () => {
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
    writeChibiPaletteAuditArtifacts({ rawDir, candidateOutputAbs });

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
      assert.equal(entry.chibiSources.paletteAudits.reference.summary.budgetStatus, 'pass');
      assert.equal(entry.chibiSources.paletteAudits.groupedStateSheet.summary.exactColorsAtLeastSignificantThreshold, 12);
      assert.match(entry.chibiSources.paletteAudits.candidateOutput.swatch.sha256, /^[a-f0-9]{64}$/);
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
  return withPreservedFiles([referencePath, notesPath, ...chibiPaletteAuditFixturePaths()], () => {
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
    writeChibiPaletteAuditArtifacts({ rawDir, candidateOutputAbs });
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
  });
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

test('[home-field] chibi palette audit writes JSON and swatch evidence', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-palette-audit-test');
  const inputPath = path.join(fixtureDir, 'limited.png');
  const outPath = path.join(fixtureDir, 'limited.audit.json');
  const swatchPath = path.join(fixtureDir, 'limited.swatch.png');
  const bloatedPath = path.join(fixtureDir, 'bloated.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });

  try {
    writePaletteBlocksFixture(inputPath, [
      [50, 34, 24],
      [230, 212, 170],
      [172, 126, 58],
      [92, 64, 42]
    ]);
    const result = spawnSync(process.execPath, [
      paletteAuditScriptPath,
      inputPath,
      `--out=${outPath}`,
      `--swatch=${swatchPath}`
    ], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /home-field chibi palette audit: PASS/);
    assert.match(result.stdout, /exact colors >=0\.10%: 4/);
    assert.ok(fs.existsSync(outPath));
    assert.ok(fs.existsSync(swatchPath));
    const audit = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.equal(audit.counts.exactColorsAtLeastSignificantThreshold, 4);
    assert.equal(audit.budget.status, 'pass');
    assert.match(audit.artifacts.swatch.sha256, /^[a-f0-9]{64}$/);

    const bloatedColors = Array.from({ length: 24 }, (_, idx) => [
      24 + (idx * 7),
      42 + ((idx * 11) % 168),
      36 + ((idx * 13) % 160)
    ]);
    writePaletteBlocksFixture(bloatedPath, bloatedColors);
    const failed = spawnSync(process.execPath, [
      paletteAuditScriptPath,
      bloatedPath,
      '--fail-on-bloat'
    ], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equal(failed.status, 2, failed.stderr || failed.stdout);
    assert.match(failed.stdout, /home-field chibi palette audit: FAIL/);
    assert.match(failed.stdout, /exact colors >=0\.10%: 24/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
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
  assert.match(result.stdout, /npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(result.stdout, /npm run game:home-field:preflight-chibi-proof -- --env-file=<explicit-env-file>/);
  assert.match(result.stdout, /this read-only `npm run game:home-field:next-chibi-proof` helper/);
  assert.match(result.stdout, /If preflight or the method gate fails, stop before stale-file archive\/imagegen, include this helper output in the blocker report/);
  assert.match(result.stdout, /do not give a new production-ready launcher prompt unless it includes a concrete allowed unblock input/);
  assert.match(result.stdout, /real PNG file at a known filesystem path/);
  assert.match(result.stdout, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1/);
  assert.match(result.stdout, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1 npm run game:home-field:preflight-chibi-proof/);
  assert.match(result.stdout, /launcher\/user explicitly confirmed built-in disk output plus actual reference-image input binding for this same session/);
  assert.match(result.stdout, /reference-image input binding/);
  assert.match(result.stdout, /diagnostic non-candidate built-in imagegen probe/);
  assert.match(result.stdout, /reference-image input binding is already confirmed/);
  assert.match(result.stdout, /--since-minutes=5/);
  assert.match(result.stdout, /same-agent file output and reference-image input binding are confirmed/);
  assert.match(result.stdout, /same agent context that will run imagegen/);
  assert.match(result.stdout, /game:home-field:find-imagegen-output/);
  assert.match(result.stdout, /game:home-field:archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>/);
  assert.match(result.stdout, /game:home-field:claim-imagegen-output/);
  assert.match(result.stdout, /chibi-proof-context/);
  assert.match(result.stdout, /verify-chibi-proof-files -- --reference/);
  assert.match(result.stdout, /palette-audit -- .*thalla_chibi_turnaround\.reference\.png/);
  assert.match(result.stdout, /thalla-reference-palette-audit\.json/);
  assert.match(result.stdout, /thalla-reference-palette-swatch\.png --fail-on-bloat/);
  assert.match(result.stdout, /thalla_chibi\.states\.source\.png/);
  assert.match(result.stdout, /verify-chibi-proof-files -- --state-sheet/);
  assert.match(result.stdout, /thalla-state-sheet-palette-audit\.json/);
  assert.match(result.stdout, /thalla-state-sheet-palette-swatch\.png --fail-on-bloat/);
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
  assert.match(result.stdout, /approved reference PNG as an actual image input/);
  assert.match(result.stdout, /one coherent 8x4 state sheet/i);
  assert.match(result.stdout, /Stop if only prompt-text state-sheet generation is available/);
  assert.match(result.stdout, /Do not generate the final idle\/walk states as separate imagegen calls/);
  assert.match(result.stdout, /grouped state sheet itself must contain the idle bob and walk poses/);
  assert.match(result.stdout, /do not synthesize motion after split/i);
  assert.match(result.stdout, /Post-split deterministic processing may clean alpha\/chroma fringe, crop, and resize only/);
  assert.match(result.stdout, /BJD-inspired doll simplicity/);
  assert.match(result.stdout, /state the chibi palette, style-preservation, scale\/face\/biology, and status-simplification plans before imagegen/);
  assert.match(result.stdout, /Copyable Sprite-Box Reference Prompt/);
  assert.match(result.stdout, /attach or same-context stage these checked-in PNGs as actual image inputs/);
  assert.match(result.stdout, /with those local PNGs attached or same-context staged as actual image inputs/);
  assert.match(result.stdout, /chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
  assert.match(result.stdout, /API-source normalization/);
  assert.match(result.stdout, /palette audit must still pass/);
  assert.match(result.stdout, /supplied local proof source images outside docs\/reference/);
  assert.match(result.stdout, /listing docs\/reference paths is not image-guided generation/);
  assert.match(result.stdout, /mentioning paths in the prompt is not enough/);
  assert.match(result.stdout, /view_image only as the current imagegen skill's same-context input-staging step/);
  assert.match(result.stdout, /explicitly name those visible images as references/);
  assert.match(result.stdout, /Method gate after rollout codex-019f1eb1-1027-7752-95cf-d4f37cb0041c/);
  assert.match(result.stdout, /do not run the queue-backed built-in same-context reference-staging path again unchanged/);
  assert.match(result.stdout, /same-context built-in image_gen call with the visible images named as references/);
  assert.match(result.stdout, /built-in staging method is exhausted/);
  assert.match(result.stdout, /checked-in docs\/reference PNGs are style references, not supplied proof source PNGs/);
  assert.match(result.stdout, /passive viewing, listing filesystem paths, or mentioning paths in the prompt is not enough/i);
  assert.doesNotMatch(result.stdout, /only exposes a prompt field/);
  assert.match(result.stdout, /Do not run this as another text-only generation/);
  assert.match(result.stdout, /sprite-box reference sheet/);
  assert.match(result.stdout, /Input images: use the attached checked-in reference images as guidance/);
  assert.match(result.stdout, /tiny .*source-sprite views/);
  assert.match(result.stdout, /compact source sheet around 512x384 or smaller/);
  assert.match(result.stdout, /never a 1536x1024 showcase canvas/);
  assert.match(result.stdout, /invisible 96x96 source-sprite boxes/);
  assert.match(result.stdout, /visible character blob should stay roughly 64-96px tall/);
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
  assert.match(result.stdout, /thalla-candidate-palette-audit\.json/);
  assert.match(result.stdout, /thalla-candidate-palette-swatch\.png --fail-on-bloat/);
  assert.doesNotMatch(result.stdout, /produce-chibi-candidate -- thalla --resize-nearest/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*candidates\/chibi-active-roster\/latest.*--ids=thalla --check-files --check-readability/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*candidates\/chibi-active-roster\/latest.*--ids=thalla --check-files --check-runtime-readiness/);
  assert.match(result.stdout, /--check-chibi-animation/);
  assert.match(result.stdout, /--check-chibi-quality/);
  assert.match(result.stdout, /at least as crisp, contrasted, and finished as approved Home Field props/);
  assert.match(result.stdout, /4 meaningful walk poses distributed across 6 slots/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /candidate-evidence requires thalla-reference\/state-sheet\/candidate palette audit JSON plus swatch PNGs/);
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

test('[home-field] Thalla chibi prompt details point to structured queue first', () => {
  const prompts = JSON.parse(fs.readFileSync(homeFieldPromptsPath, 'utf8'));
  const prompt = prompts.prompts.character_thalla_chibi;

  assert.match(prompt.details, /generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(prompt.details, /Do not infer \.env/);
  assert.match(prompt.details, /OPENAI_IMAGEGEN_API_KEY/);
  assert.match(prompt.details, /Plain OPENAI_API_KEY is ignored/);
  assert.match(prompt.details, /preflight-chibi-proof -- --env-file=<explicit-env-file>/);
  assert.match(prompt.details, /Use built-in\/imagegen skill output as the normal proof-art path only when the queue method gate allows it/);
  assert.match(prompt.details, /queue-backed built-in same-context staging path is exhausted after rollout codex-019f1eb1-1027-7752-95cf-d4f37cb0041c/);
  assert.match(prompt.details, /attach or same-context stage/);
  assert.match(prompt.details, /passive view_image reference exposure is still not enough/);
  assert.match(prompt.constraints, /attached or staged as actual same-context image inputs/);
  assert.match(prompt.constraints, /passive view_image-only generation/);
});

test('[home-field] chibi proof launcher carries explicit reference-capable workflow', () => {
  const prompt = fs.readFileSync(runChibiProofPromptPath, 'utf8');
  const shortLauncher = prompt.match(/```text\n([\s\S]*?)\n```/)?.[1] || '';

  assert.match(prompt, /Short Launcher Prompt Template/);
  assert.match(prompt, /Use this launcher only when the queue item and method gate are allowed/);
  assert.match(prompt, /Do not give this as a "new production-ready run" prompt while the queue item is blocked/);
  assert.match(prompt, /prompt-issuance gate/);
  assert.match(shortLauncher, /run `npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof`/);
  assert.match(shortLauncher, /follow the printed agent instructions exactly/);
  assert.doesNotMatch(shortLauncher, /OPENAI_IMAGEGEN_API_KEY/);
  assert.doesNotMatch(shortLauncher, /HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1/);
  assert.doesNotMatch(shortLauncher, /plain OPENAI_API_KEY/);
  assert.doesNotMatch(shortLauncher, /Prefer built-in\/imagegen skill output/);
  assert.match(prompt, /app\/shared\/home-field\/home-field-generation-queue\.json/);
  assert.match(prompt, /queue command must print the run title, canonical doc, prompt-issuance gate, built-in imagegen default\/blocked path, method-gate status, env rules, reference-input gates, stop gates, and final-response fields/);
  assert.match(prompt, /built-in section must include the `view_image` reference-input staging step, same-context built-in `image_gen` call, built-in preflight flags, and save\/claim-after-render instruction/);
  assert.match(prompt, /preflight-chibi-proof -- --env-file=<explicit-env-file>/);
  assert.match(prompt, /archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>/);
  assert.match(prompt, /chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
  assert.match(prompt, /ONE coherent `8x4` state sheet for Thalla only through a reference-capable image path with the passed `\.agent\/home-field-workspace\/reference\/thalla_chibi_turnaround\.reference\.png` attached as an actual image input/);
  assert.match(prompt, /Do not infer `\.env`/);
  assert.match(prompt, /default launcher is built-in\/imagegen skill first/);
  assert.match(prompt, /Current method gate: after rollout `codex-019f1eb1-1027-7752-95cf-d4f37cb0041c`/);
  assert.match(prompt, /queue-backed built-in same-context reference-staging path again unchanged/);
  assert.match(prompt, /built-in staging method is exhausted/);
  assert.match(prompt, /Do not give another "new production-ready run" launcher prompt in that blocked state unless the prompt includes one concrete allowed unblock input/);
  assert.doesNotMatch(prompt, /default launcher now uses explicit CLI\/API fallback/);
  assert.doesNotMatch(prompt, /Use the explicit CLI\/API helper path by default/);
  assert.match(prompt, /Listing filesystem paths to checked-in PNGs is also not enough/);
  assert.match(prompt, /Do not set `HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS` to the checked-in PNGs under `docs\/reference\/home-field\/`/);
  assert.match(prompt, /still run the read-only `npm run game:home-field:next-chibi-proof` helper/);
  assert.match(prompt, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1/);
  assert.match(prompt, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(prompt, /same fallback env file/);
  assert.match(prompt, /same confirmed capability environment that made preflight pass/);
  assert.match(prompt, /chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
  assert.match(prompt, /image_gen\.py edit/);
  assert.match(prompt, /API-size source PNG/);
  assert.match(prompt, /`chibi-reference-api-proof` creates only the non-production reference sheet/);
  assert.match(prompt, /prompt text for the grouped state sheet/);
  assert.match(prompt, /palette audit and visual gate must still pass/);
  assert.match(prompt, /thalla-reference-palette-swatch\.png --fail-on-bloat/);
  assert.match(prompt, /thalla-state-sheet-palette-swatch\.png --fail-on-bloat/);
  assert.match(prompt, /thalla-candidate-palette-swatch\.png --fail-on-bloat/);
});

test('[home-field] imagegen requirements put built-in defaults in queue output', () => {
  const requirements = fs.readFileSync(homeFieldImagegenRequirementsPath, 'utf8');

  assert.match(requirements, /app\/shared\/home-field\/home-field-generation-queue\.json/);
  assert.match(requirements, /Built-in imagegen default path/);
  assert.match(requirements, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1/);
  assert.match(requirements, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(requirements, /load all three `referenceInputs` PNGs with `view_image`/);
  assert.match(requirements, /same-context input-staging step/);
  assert.match(requirements, /call built-in `image_gen` in that same context/);
  assert.match(requirements, /claim-imagegen-output -- --since=<render-start-iso> --dest=<documented-path> --verify=<reference\|state-sheet>/);
  assert.match(requirements, /Do not rely on a human-pasted prompt to carry those built-in details/);
  assert.match(requirements, /Prompt issuance is gated too/);
  assert.match(requirements, /Do not give a user a "new production-ready run" launcher prompt that is known to block/);
  assert.match(requirements, /concrete allowed unblock input/);
  assert.match(requirements, /Method gate \/ allowed method change/);
  assert.match(requirements, /queue JSON and printer must carry and validate its built-in imagegen path and method-gate status/);
  assert.match(requirements, /queue-backed built-in same-context reference-staging path is exhausted after rollout `codex-019f1eb1-1027-7752-95cf-d4f37cb0041c`/);
});

test('[home-field] chibi proof context prints narrow paths and commands', () => {
  const result = spawnSync(process.execPath, [chibiContextScriptPath], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Thalla Home Field Chibi Proof Context/);
  assert.match(result.stdout, /Built-in imagegen environment prefix/);
  assert.match(result.stdout, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(result.stdout, /use only when the launcher\/user explicitly confirms both/);
  assert.match(result.stdout, /generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(result.stdout, /next-chibi-proof  # read-only; run before a blocker handoff even when preflight or the method gate fails/);
  assert.match(result.stdout, /raw frames: \d+\/32 present/);
  assert.match(result.stdout, /state sheet:/);
  assert.match(result.stdout, /Motion contract: idle bob and walk poses must exist in the grouped state sheet itself/);
  assert.match(result.stdout, /Palette contract: state the plan before imagegen/);
  assert.match(result.stdout, /palette-audit/);
  assert.match(result.stdout, /thalla-reference-palette-audit\.json/);
  assert.match(result.stdout, /thalla-state-sheet-palette-audit\.json/);
  assert.match(result.stdout, /thalla-candidate-palette-audit\.json/);
  assert.match(result.stdout, /thalla-reference-palette-swatch\.png --fail-on-bloat/);
  assert.match(result.stdout, /thalla-state-sheet-palette-swatch\.png --fail-on-bloat/);
  assert.match(result.stdout, /thalla-candidate-palette-swatch\.png --fail-on-bloat/);
  assert.match(result.stdout, /styleCohesionCheck\/stageContractCheck/);
  assert.match(result.stdout, /--check-runtime-readiness/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /Freshness warning: existing \.agent files are not proof of a fresh run/);
  assert.match(result.stdout, /Reference-input warning: current Thalla proof art needs the checked-in PNGs attached as actual imagegen inputs/);
  assert.match(result.stdout, /Local-input warning: docs\/reference PNGs are style references only/);
  assert.match(result.stdout, /HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS must point to proof source PNGs/);
  assert.match(result.stdout, /chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
  assert.match(result.stdout, /API fallback warning/);
  assert.match(result.stdout, /prefer built-in\/imagegen skill output/);
  assert.match(result.stdout, /plain OPENAI_API_KEY is ignored/);
  assert.match(result.stdout, /paid fallback requires OPENAI_IMAGEGEN_API_KEY/);
  assert.match(result.stdout, /Production-readiness warning/);
  assert.match(result.stdout, /grouped 8x4 state sheet must also be generated through a reference-capable image path/);
  assert.match(result.stdout, /Reference normalization warning/);
  assert.match(result.stdout, /palette audit must still pass/);
  assert.match(result.stdout, /do not run the probe when reference binding is unavailable/);
  assert.match(result.stdout, /Blocker reporting warning: if preflight or the method gate blocks the run/);
  assert.match(result.stdout, /Prompt issuance warning: do not give a new production-ready run prompt for this blocked queue item unless that prompt includes one concrete allowed unblock input/);
  assert.match(result.stdout, /no archive, imagegen, state sheet, split frames, candidate, preview, or app overwrite occurred/);
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

test('[home-field] chibi proof reference verifier accepts compact sprite-box blobs', () => {
  const referencePath = path.join(repoRoot, '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png');
  return withPreservedFile(referencePath, () => {
    writeChibiReferenceSpriteBoxFixture(referencePath);

    const result = spawnSync(process.execPath, [chibiVerifyScriptPath, '--reference'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Reference sprite-box occupancy: 4 major blob\(s\)/);
    assert.match(result.stdout, /home-field chibi proof file verification: PASS/);
  });
});

test('[home-field] chibi proof reference verifier rejects oversized turnaround blobs', () => {
  const referencePath = path.join(repoRoot, '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png');
  return withPreservedFile(referencePath, () => {
    writeChibiReferenceSpriteBoxFixture(referencePath, { oversized: true });

    const result = spawnSync(process.execPath, [chibiVerifyScriptPath, '--reference'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stdout, /Reference sprite-box occupancy: 4 major blob\(s\)/);
    assert.match(result.stderr, /oversized source-sprite blob/);
    assert.match(result.stderr, /96x96 sprite-box reference contract/);
  });
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
    chibiReferenceApiProofScriptPath,
    recoverChibiAlphaScriptPath,
    recordChibiVerdictScriptPath,
    claimImagegenOutputScriptPath,
    generationQueueScriptPath
  ]) {
    const result = spawnSync(process.execPath, [script, '--help'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${script}\n${result.stderr || result.stdout}`);
    assert.match(result.stdout, /Usage:/);
  }
});

test('[home-field] structured generation queue encodes Thalla chibi gates', () => {
  const queue = JSON.parse(fs.readFileSync(homeFieldGenerationQueuePath, 'utf8'));
  const item = queue.items.find((entry) => entry.id === 'thalla-stage1-chibi-proof');

  assert.equal(queue.schemaVersion, 1);
  assert.ok(item, 'expected thalla-stage1-chibi-proof queue item');
  assert.equal(item.status, 'blocked_builtin_same_context_reference_staging_exhausted');
  assert.equal(item.displayTitle, 'Thalla Home Field chibi Stage 1 proof');
  assert.match(item.minimalLauncherPrompt, /generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(item.minimalLauncherPrompt, /follow the printed agent instructions exactly/);
  assert.equal(item.promptPolicy.issueLauncherWhenStatus, 'allowed_or_with_unblock_input_only');
  assert.match(item.promptPolicy.blockedPromptAction, /Do not give minimalLauncherPrompt/);
  assert.match(item.promptPolicy.blockedPromptAction, /concrete allowed unblock input/);
  assert.match(item.promptPolicy.blockedPromptAction, /OPENAI_IMAGEGEN_API_KEY/);
  assert.match(item.promptPolicy.blockedPromptAction, /HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1/);
  assert.match(item.promptPolicy.blockedPromptAction, /HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS/);
  assert.match(item.promptPolicy.blockedShortResponse, /Blocked:/);
  assert.ok(item.agentInstructions.some((instruction) => /Thalla Home Field chibi Stage 1 proof/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /Follow app\/shared\/home-field\/RUN_CHIBI_PROOF_PROMPT\.md exactly/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /Do not give the minimalLauncherPrompt back to the user/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /concrete allowed unblock input from promptPolicy/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /Do not infer `\.env`/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /OPENAI_IMAGEGEN_API_KEY/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /plain OPENAI_API_KEY is ignored/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /actual image inputs/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /same-context input-staging step/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /visible images explicitly named as references/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /exhausted after rollout codex-019f1eb1-1027-7752-95cf-d4f37cb0041c/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /passive viewing/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /grouped 8x4 state sheet/.test(instruction)));
  assert.equal(item.assetId, 'thalla');
  assert.equal(item.assetType, 'character');
  assert.equal(item.env.doNotInferEnvFile, true);
  assert.equal(item.env.doNotUseRepoDotEnvUnlessUserExplicitlySaysItContainsRequiredKeys, true);
  assert.deepEqual(item.env.requiredKeys, []);
  assert.deepEqual(item.env.apiFallbackRequiredKeys, ['OPENAI_IMAGEGEN_API_KEY']);
  assert.equal(item.env.plainOpenAiApiKeyIgnored, true);
  assert.equal(item.env.apiFallbackRequiresSkillUnavailable, true);
  assert.equal(item.env.apiFallbackFlag, 'HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1');
  assert.match(item.env.blockedRunEvidence.rollout, /codex-019f1dbd-e6dd-70e0-a7fe-53977b1cc831/);
  assert.equal(item.builtInImagegen.defaultPath, true);
  assert.equal(item.builtInImagegen.sameContextRequired, true);
  assert.deepEqual(item.builtInImagegen.confirmationFlags, [
    'HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1',
    'HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1'
  ]);
  assert.match(item.builtInImagegen.preflightCommand, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1 npm run game:home-field:preflight-chibi-proof/);
  assert.match(item.builtInImagegen.referenceStaging, /Load all 3 referenceInputs PNGs with view_image/);
  assert.match(item.builtInImagegen.referenceStaging, /same-context input-staging step/);
  assert.match(item.builtInImagegen.generationCall, /Call built-in image_gen/);
  assert.match(item.builtInImagegen.generationCall, /visible referenceInputs images as references/);
  assert.match(item.builtInImagegen.afterRender, /claim-imagegen-output/);
  assert.match(item.builtInImagegen.notEnough, /Passive viewing/);
  assert.equal(item.methodGate.rollout, 'codex-019f1eb1-1027-7752-95cf-d4f37cb0041c');
  assert.equal(item.methodGate.status, 'blocked_builtin_same_context_reference_staging_exhausted');
  assert.match(item.methodGate.reason, /failed the reference verifier/);
  assert.match(item.methodGate.reason, /91 significant exact colors/);
  assert.match(item.methodGate.allowedPath, /Do not run the built-in same-context staging path again/);
  assert.match(item.methodGate.stopIf, /Stop before archive\/imagegen/);
  assert.equal(item.generationContract.stateSheet.stopIfPromptOnly, true);
  assert.equal(item.generationContract.stateSheet.stopIfReferenceCannotBeAttachedAsActualImageInput, true);
  assert.match(item.generationContract.stateSheet.requiredReferenceImageInput, /thalla_chibi_turnaround\.reference\.png/);
  assert.match(item.commands.queue, /generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(item.commands.preflight, /preflight-chibi-proof -- --env-file=<explicit-env-file>/);
  assert.match(item.commands.referenceApiProof, /chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
  assert.ok(item.stopRules.some((rule) => /OPENAI_IMAGEGEN_API_KEY/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /plain OPENAI_API_KEY/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /instead of giving a new production-ready launcher prompt/.test(rule)));
  assert.ok(item.finalResponseMustReport.includes('env source and preflight result'));

  for (const reference of item.referenceInputs) {
    assert.equal(fs.existsSync(path.join(repoRoot, reference.path)), true, reference.path);
    assert.equal(reference.mustAttachAsActualImageInput, true);
  }
});

test('[home-field] generation queue printer exposes env and state-sheet gates', () => {
  const result = spawnSync(process.execPath, [
    generationQueueScriptPath,
    '--id=thalla-stage1-chibi-proof'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Home Field Generation Queue/);
  assert.match(result.stdout, /Thalla Home Field chibi Stage 1 proof/);
  assert.match(result.stdout, /thalla-stage1-chibi-proof/);
  assert.match(result.stdout, /Minimal launcher prompt:/);
  assert.match(result.stdout, /follow the printed agent instructions exactly/);
  assert.match(result.stdout, /Prompt issuance gate \(blocked\):/);
  assert.match(result.stdout, /issue launcher when: allowed_or_with_unblock_input_only/);
  assert.match(result.stdout, /blocked action: .*Do not give minimalLauncherPrompt/);
  assert.match(result.stdout, /blocked action: .*concrete allowed unblock input/);
  assert.match(result.stdout, /blocked short response: Blocked:/);
  assert.match(result.stdout, /Agent instructions:/);
  assert.match(result.stdout, /Follow app\/shared\/home-field\/RUN_CHIBI_PROOF_PROMPT\.md exactly/);
  assert.match(result.stdout, /Do not give the minimalLauncherPrompt back to the user/);
  assert.match(result.stdout, /Attach every referenceInputs PNG as actual image inputs/);
  assert.match(result.stdout, /Built-in imagegen path \(blocked by method gate\):/);
  assert.match(result.stdout, /flags: HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(result.stdout, /preflight: HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1 npm run game:home-field:preflight-chibi-proof/);
  assert.match(result.stdout, /reference staging: Load all 3 referenceInputs PNGs with view_image/);
  assert.match(result.stdout, /imagegen call: Call built-in image_gen in that same context/);
  assert.match(result.stdout, /after render: Save each generated PNG directly to the required output path, or claim/);
  assert.match(result.stdout, /not enough: Passive viewing, listing paths, or mentioning reference paths in prompt text is not enough/);
  assert.match(result.stdout, /Method gate \/ allowed method change:/);
  assert.match(result.stdout, /status: blocked_builtin_same_context_reference_staging_exhausted/);
  assert.match(result.stdout, /reason: .*91 significant exact colors/);
  assert.match(result.stdout, /allowed path: .*Do not run the built-in same-context staging path again/);
  assert.match(result.stdout, /stop if: .*Stop before archive\/imagegen/);
  assert.match(result.stdout, /same-context input-staging step/);
  assert.match(result.stdout, /visible images explicitly named as references/);
  assert.match(result.stdout, /passive viewing/);
  assert.match(result.stdout, /grouped 8x4 state sheet can attach/);
  assert.match(result.stdout, /do not infer \.env/i);
  assert.match(result.stdout, /OPENAI_IMAGEGEN_API_KEY/);
  assert.match(result.stdout, /plain OPENAI_API_KEY is ignored/);
  assert.match(result.stdout, /HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1/);
  assert.match(result.stdout, /codex-019f1dbd-e6dd-70e0-a7fe-53977b1cc831/);
  assert.match(result.stdout, /required reference image input: .*thalla_chibi_turnaround\.reference\.png/);
  assert.match(result.stdout, /stop if prompt-only: yes/);
  assert.match(result.stdout, /stop if reference cannot attach: yes/);
  assert.match(result.stdout, /final response must report:/i);
});

test('[home-field] chibi reference api proof dry-run prints normalized serial gate plan', () => {
  const result = spawnSync(process.execPath, [chibiReferenceApiProofScriptPath, '--dry-run'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, OPENAI_API_KEY: '', OPENAI_IMAGEGEN_API_KEY: '', HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '' }
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Thalla Chibi Reference API Proof/);
  assert.match(result.stdout, /chibi-thalla-previous-best-2026-06-26-state-sheet\.png/);
  assert.match(result.stdout, /chibi-thalla-liked-2026-06-23\.png/);
  assert.match(result.stdout, /chibi-style-agent-log-reference\.png/);
  assert.match(result.stdout, /thalla_chibi_turnaround\.api-source\.png/);
  assert.match(result.stdout, /thalla_chibi_turnaround\.reference\.png/);
  assert.match(result.stdout, /normalization: 512x384/);
  assert.match(result.stdout, /palette audit uses --fail-on-bloat/);
  assert.match(result.stdout, /dry-run: no prompt file, API image, venv, verifier, palette audit, or blocker note was written/);
  assert.match(result.stdout, /would run image_gen\.py edit --model gpt-image-2 --quality medium --size 1024x768/);
  assert.match(result.stdout, /--image docs\/reference\/home-field\/chibi-thalla-previous-best-2026-06-26-state-sheet\.png/);
  assert.match(result.stdout, /would run verifier before palette audit, then palette audit with --fail-on-bloat/);
});

test('[home-field] chibi reference api proof refuses plain OpenAI API key', () => {
  const result = spawnSync(process.execPath, [
    chibiReferenceApiProofScriptPath,
    '--allow-process-env',
    '--skip-venv-install'
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENAI_API_KEY: 'general-openai-key',
      OPENAI_IMAGEGEN_API_KEY: '',
      HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '1'
    }
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /OPENAI_IMAGEGEN_API_KEY is missing/);
  assert.match(result.stderr, /Plain OPENAI_API_KEY is ignored/);
});

test('[home-field] chibi reference api proof requires explicit unavailable fallback flag', () => {
  const result = spawnSync(process.execPath, [
    chibiReferenceApiProofScriptPath,
    '--allow-process-env',
    '--skip-venv-install'
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      OPENAI_IMAGEGEN_API_KEY: 'test-imagegen-key',
      HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: ''
    }
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1/);
  assert.match(result.stderr, /built-in\/imagegen skill output is unavailable/);
});

test('[home-field] package exposes chibi proof helper aliases', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['game:home-field:claim-imagegen-output'], 'node app/scripts/claim-home-field-imagegen-output.js');
  assert.equal(pkg.scripts['game:home-field:archive-stale-chibi-proof'], 'node app/scripts/archive-home-field-chibi-proof.js');
  assert.equal(pkg.scripts['game:home-field:chibi-reference-api-proof'], 'node app/scripts/run-home-field-chibi-reference-api-proof.js');
  assert.equal(pkg.scripts['game:home-field:generation-queue'], 'node app/scripts/print-home-field-generation-queue.js');
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

test('[home-field] chibi proof preflight honors exhausted queue method gate before built-in retry', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      OPENAI_IMAGEGEN_API_KEY: '',
      HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /OPENAI_IMAGEGEN_API_KEY: missing/);
  assert.match(result.stdout, /OPENAI_API_KEY: not used/);
  assert.match(result.stdout, /imagegen skill unavailable explicitly confirmed: no/);
  assert.match(result.stdout, /built-in Codex Desktop imagegen proof-art ready: no \(blocked by queue method gate\)/);
  assert.match(result.stdout, /built-in imagegen disk save explicitly confirmed: no/);
  assert.match(result.stdout, /built-in imagegen reference-input explicitly confirmed: no/);
  assert.match(result.stdout, /Queue method gate:/);
  assert.match(result.stdout, /status: blocked_builtin_same_context_reference_staging_exhausted/);
  assert.match(result.stdout, /built-in same-context path blocked: yes/);
  assert.match(result.stderr, /Preflight failed/);
  assert.match(result.stderr, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1/);
  assert.match(result.stderr, /HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(result.stderr, /different reference-capable generation\/editing method/);
  assert.match(result.stderr, /do not reuse the exhausted built-in same-context staging path unchanged/);
  assert.match(result.stderr, /Fresh Codex sessions do not inherit HOME_FIELD_\* flags from prior chats/);
  assert.match(result.stderr, /queue method gate is authoritative/);
  assert.match(result.stderr, /Do not rerun this preflight with only HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(result.stderr, /exhausted same-context built-in path/);
  assert.match(result.stderr, /Passive viewing is not enough: a view_image step counts only when/);
  assert.match(result.stderr, /following built-in image_gen call explicitly uses those visible images as references/);
  assert.match(result.stderr, /Do not run the built-in output diagnostic or built-in imagegen retry/);
  assert.match(result.stderr, /queue method gate blocks this unchanged built-in path/);
  assert.match(result.stderr, /supplied local proof source PNG paths outside docs\/reference/);
  assert.doesNotMatch(result.stderr, /run one tiny diagnostic non-candidate image_gen probe/);
  assert.doesNotMatch(result.stderr, /find-imagegen-output -- --since-minutes=5/);
  assert.match(result.stderr, /Do not archive stale files before preflight passes/);
  assert.match(result.stdout, /State sheet output path: \.agent\/home-field-workspace\/raw\/thalla_chibi\.states\.source\.png/);
  assert.match(result.stdout, /Raw frame output slots: 32/);
});

test('[home-field] chibi proof preflight ignores plain OpenAI API key for paid fallback', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-preflight-plain-key-test');
  const fakeCodexHome = path.join(fixtureDir, 'codex-home');
  const fakeCli = path.join(fakeCodexHome, 'skills/.system/imagegen/scripts/image_gen.py');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(fakeCli), { recursive: true });
  fs.writeFileSync(fakeCli, '#!/usr/bin/env python3\n');

  try {
    const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        CODEX_HOME: fakeCodexHome,
        OPENAI_API_KEY: 'general-openai-key',
        OPENAI_IMAGEGEN_API_KEY: '',
        HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '1',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
        HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
        HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '',
        HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: '1'
      },
      encoding: 'utf8'
    });

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stdout, /OPENAI_IMAGEGEN_API_KEY: missing/);
    assert.match(result.stdout, /OPENAI_API_KEY: present but ignored for Home Field image generation/);
    assert.match(result.stdout, /imagegen skill unavailable explicitly confirmed: yes/);
    assert.match(result.stdout, /API fallback ready: no/);
    assert.match(result.stderr, /Plain OPENAI_API_KEY is intentionally ignored/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] chibi proof preflight accepts explicit paid API fallback env file', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-preflight-env-file-test');
  const fakeCodexHome = path.join(fixtureDir, 'codex-home');
  const fakeCli = path.join(fakeCodexHome, 'skills/.system/imagegen/scripts/image_gen.py');
  const envFile = path.join(fixtureDir, '.env');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(fakeCli), { recursive: true });
  fs.writeFileSync(fakeCli, '#!/usr/bin/env python3\n');
  fs.writeFileSync(envFile, [
    `CODEX_HOME=${fakeCodexHome}`,
    'OPENAI_IMAGEGEN_API_KEY=test-key',
    'HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1',
    'HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN=1',
    'HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=',
    'HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES='
  ].join('\n'));

  try {
    const result = spawnSync(process.execPath, [chibiPreflightScriptPath, `--env-file=${envFile}`], {
      cwd: repoRoot,
      env: {
        ...process.env,
        CODEX_HOME: '',
        OPENAI_API_KEY: '',
        OPENAI_IMAGEGEN_API_KEY: '',
        HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
        HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
        HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '',
        HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
      },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Explicit env file: tmp\/home-field-chibi-preflight-env-file-test\/\.env/);
    assert.match(result.stdout, /OPENAI_IMAGEGEN_API_KEY: set from explicit env file/);
    assert.match(result.stdout, /OPENAI_API_KEY: not used/);
    assert.match(result.stdout, /imagegen skill unavailable explicitly confirmed: yes/);
    assert.match(result.stdout, /API fallback ready: yes/);
    assert.match(result.stdout, /Preflight passed/);
    assert.match(result.stdout, /queue method gate still blocks the exhausted built-in same-context path/);
    assert.match(result.stdout, /preflight passed through a non-built-in path/);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('[home-field] chibi proof preflight rejects checked-in style references as local source inputs', () => {
  const checkedInReference = 'docs/reference/home-field/chibi-thalla-previous-best-2026-06-26-state-sheet.png';
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      OPENAI_IMAGEGEN_API_KEY: '',
      HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: checkedInReference,
      HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '1',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: '1'
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /local image inputs supplied: 1/);
  assert.match(result.stdout, /rejected local image inputs: docs\/reference\/home-field\/chibi-thalla-previous-best-2026-06-26-state-sheet\.png/);
  assert.match(result.stderr, /checked-in docs\/reference style images/);
  assert.match(result.stderr, /style\/reference material only/);
  assert.match(result.stderr, /must not be used to bypass reference-capable imagegen/);
});

test('[home-field] chibi proof preflight blocks output probe when queue method gate is exhausted', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      OPENAI_IMAGEGEN_API_KEY: '',
      HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '1',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /built-in Codex Desktop imagegen proof-art ready: no \(blocked by queue method gate\)/);
  assert.match(result.stdout, /built-in imagegen disk save explicitly confirmed: no/);
  assert.match(result.stdout, /built-in imagegen reference-input explicitly confirmed: yes/);
  assert.match(result.stdout, /built-in same-context path blocked: yes/);
  assert.match(result.stderr, /Do not run the built-in output diagnostic or built-in imagegen retry/);
  assert.doesNotMatch(result.stderr, /run one tiny diagnostic non-candidate image_gen probe/);
  assert.doesNotMatch(result.stderr, /find-imagegen-output -- --since-minutes=5/);
});

test('[home-field] chibi proof preflight blocks built-in imagegen when method gate is exhausted', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      OPENAI_IMAGEGEN_API_KEY: '',
      HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '1',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /built-in Codex Desktop imagegen proof-art ready: no \(blocked by queue method gate\)/);
  assert.match(result.stdout, /built-in imagegen disk save explicitly confirmed: yes/);
  assert.match(result.stdout, /built-in imagegen reference-input explicitly confirmed: no/);
  assert.match(result.stdout, /built-in same-context path blocked: yes/);
  assert.match(result.stderr, /queue method gate blocks this unchanged built-in path/);
  assert.doesNotMatch(result.stderr, /run one tiny diagnostic non-candidate image_gen probe/);
});

test('[home-field] chibi proof preflight blocks exhausted built-in path even with confirmed disk output and reference inputs', () => {
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      OPENAI_IMAGEGEN_API_KEY: '',
      HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '1',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '1',
      HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS: '',
      HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: ''
    },
    encoding: 'utf8'
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /built-in Codex Desktop imagegen proof-art ready: no \(blocked by queue method gate\)/);
  assert.match(result.stdout, /built-in imagegen disk save explicitly confirmed: yes/);
  assert.match(result.stdout, /built-in imagegen reference-input explicitly confirmed: yes/);
  assert.match(result.stdout, /built-in same-context path blocked: yes/);
  assert.match(result.stderr, /Do not rerun this preflight with only HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(result.stderr, /Do not archive stale files before preflight passes/);
  assert.doesNotMatch(result.stdout, /Preflight passed/);
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
        OPENAI_IMAGEGEN_API_KEY: '',
        HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
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
