import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../../app/shared/repo-root.js';
import { encodeDeterministicPng, readPngRgba, alphaStats, fileSha256 } from '../../app/scripts/lib/bitmap-image-toolkit.js';

const scriptPath = path.join(repoRoot, 'app/scripts/produce-home-field-assets.js');
const familyProducerScriptPath = path.join(repoRoot, 'app/scripts/produce-home-field-family.js');
const grassFamilySheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-grass-family-sheet.js');
const alphaSheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-alpha-sheet.js');
const mobileReadabilitySheetScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-mobile-readability-sheet.js');
const candidateEvidenceScriptPath = path.join(repoRoot, 'app/scripts/generate-home-field-candidate-evidence.js');
const validateScriptPath = path.join(repoRoot, 'app/scripts/validate-home-field-assets.js');
const nextScriptPath = path.join(repoRoot, 'app/scripts/next-home-field-image-prompts.js');
const homeFieldPromptsPath = path.join(repoRoot, 'app/shared/home-field/home-field-prompts.json');
const homeFieldGenerationQueuePath = path.join(repoRoot, 'app/shared/home-field/home-field-generation-queue.json');
const runChibiProofPromptPath = path.join(repoRoot, 'app/shared/home-field/RUN_CHIBI_PROOF_PROMPT.md');
const runMinimalHomeFieldPromptPath = path.join(repoRoot, 'app/shared/home-field/RUN_MINIMAL_HOME_FIELD_PROMPT.md');
const homeFieldImagegenRequirementsPath = path.join(repoRoot, 'docs/home-field-imagegen-requirements.md');
const homeFieldAgentFlowPath = path.join(repoRoot, 'docs/home-field-agent-flow.md');
const homeFieldChibiCandidateContractPath = path.join(repoRoot, 'docs/home-field-chibi-candidate-contract.md');
const mushroomAgentsPath = path.join(repoRoot, 'AGENTS.md');
const claimImagegenOutputScriptPath = path.join(repoRoot, 'app/scripts/claim-home-field-imagegen-output.js');
const archiveChibiProofScriptPath = path.join(repoRoot, 'app/scripts/archive-home-field-chibi-proof.js');
const recoverChibiAlphaScriptPath = path.join(repoRoot, 'app/scripts/recover-home-field-chibi-alpha.js');
const recordChibiVerdictScriptPath = path.join(repoRoot, 'app/scripts/record-home-field-chibi-verdict.js');
const chibiPreflightScriptPath = path.join(repoRoot, 'app/scripts/preflight-home-field-chibi-proof.js');
const chibiReferenceApiProofScriptPath = path.join(repoRoot, 'app/scripts/run-home-field-chibi-reference-api-proof.js');
const chibiStageLocalSourceScriptPath = path.join(repoRoot, 'app/scripts/stage-home-field-chibi-local-source.js');
const chibiVerifyScriptPath = path.join(repoRoot, 'app/scripts/verify-home-field-chibi-proof-files.js');
const generationQueueScriptPath = path.join(repoRoot, 'app/scripts/print-home-field-generation-queue.js');
const chibiSplitScriptPath = path.join(repoRoot, 'app/scripts/split-home-field-chibi-state-sheet.js');
const paletteAuditScriptPath = path.join(repoRoot, 'app/scripts/audit-home-field-chibi-palette.js');
const chibiQueueLocalSourcePath = '.agent/home-field-workspace/supplied/thalla_tetro_cleaned_2026-06-30.states.source.png';
const chibiExhaustedRepairSourcePath = '.agent/home-field-workspace/supplied/thalla_palette_repair_2026-07-02.states.source.png';
const chibiExhaustedRepairSourceSha256 = '0ce11c117499b96d6446d7884e2c0fc9eb2a6d7c3c87a6db53ac55b070fbf2ee';
const chibiExhaustedRepairCandidateSha256 = '477e72e876ae67b3b90f02e134465f86f9c02a1b5ecdc9c19f4b3705ba923221';
const chibiStyleRejectedSourcePath = '.agent/home-field-workspace/supplied/thalla_sourcegate_recovery_2026-07-02_512x256_palette20_exactwarm_rgba.states.source.png';
const chibiStyleRejectedSourceSha256 = 'bd82997b6b9d790d31e9e1bdf56ea191cf6e7dd63f4efd4f9bf271e8701e0fb1';
const chibiStyleRejectedCandidateSha256 = '64b71fc1a0bb29fce6860d0246a41ab9539fbfc4ddb35b55a8d19b8530f835f9';
const chibiMaskRejectedSourcePath = '.agent/home-field-workspace/supplied/thalla_imagegen_recovery_runtime_2026-07-02.states.source.png';
const chibiMaskRejectedSourceSha256 = 'aac982b3eee1769a7b78e42a96784f99d09ccfb33f0f7a7894f16518e5d40414';
const chibiMaskRejectedCandidateSha256 = 'fce7bff0f41b29c69132942e5c1cc5d5b4bf43c0a076741181b911977a2eefa6';
const chibiCharmBaselineSourceSha256 = '115f77467df49e07f8b2a7b4e2c2afa1222d59310e67a5dfc093d82aa7dc545d';
const chibiCharmBaselineCandidateSha256 = '6ae5e6f886c9e99f7a1ea6700eb035c87dffd479222cb55f713e019d0182d06a';
const chibiMotionMarksRejectedSourcePath = '.agent/home-field-workspace/supplied/thalla_sourcegate_recovery_textonly_2026-07-02_512x256_quant20_rgba.states.source.png';
const chibiMotionMarksRejectedSourceSha256 = '270fc4005413ad943373b9c79fb511c0819eb1bf38e73be3c51fe5783d85d6ac';
const chibiMotionMarksRejectedCandidateSha256 = 'd5963832fa5406f6fef356be145061f4db51cd8b210064c09c8ab0979fd4c8df';
const chibiAnimeRejectedSourcePath = '.agent/home-field-workspace/supplied/thalla_sourcegate_recovery_fresh_2026-07-02_bjd_littlegirl_512x256_quant20_rgba.states.source.png';
const chibiAnimeRejectedSourceSha256 = '1f97d423792a5396a4b325d7c4d4f08d7e33d7b254d1ea57d39fe75133af8f70';
const chibiAnimeRejectedCandidateSha256 = '7bcd69287d4662b691f487262837899f06da83eb4530c230bff5195f21f6e26b';
const chibiAttempt3RejectedSourcePath = '.agent/home-field-workspace/supplied/thalla_sourcegate_recovery_2026-07-02_attempt3_512x256_quant18_rgba.states.source.png';
const chibiAttempt3RejectedSourceSha256 = '4e16302ceecddeee282f580a145ded1ecec4bd1805e6909e0e63d5f631e4c58d';
const chibiAttempt3RejectedCandidateSha256 = '043a3c4fb0c4d6811461522d9aee574137b5955443393eda4e8312edda2e1c93';
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

function writeCrispChibiSpritesheet(filePath, { lowQuality = false, detachedMarks = false } = {}) {
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
  if (detachedMarks) {
    for (const [x, y] of [[9, 32], [10, 32], [11, 33], [10, 34]]) {
      const i = (y * width + (frameWidth + x)) * 4;
      rgba[i + 0] = 28;
      rgba[i + 1] = 20;
      rgba[i + 2] = 18;
      rgba[i + 3] = 255;
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
      familyProducerScriptPath,
      '--family=grass',
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
      familyProducerScriptPath,
      '--family=grass',
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
  assert.match(result.stdout, /npm run game:home-field:produce -- --scope=objects --candidate -- mushroom_cluster_small_violet --resize --chroma-key=#ff00ff/);
  assert.match(result.stdout, /Home Field scale contract/);
  assert.match(result.stdout, /Runtime asset contract/);
  assert.match(result.stdout, /Generate for the final in-game footprint, not contact-sheet beauty/);
  assert.match(result.stdout, /safe transparent padding/);
  assert.match(result.stdout, /Runtime canvas: 256x256px/);
  assert.match(result.stdout, /Visual footprint target: small field token/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*--check-alpha-halo/);
  assert.match(result.stdout, /HOME_FIELD_ASSET_ROOT=.*--check-runtime-readiness/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /HOME_FIELD_CANDIDATE_IDS=mushroom_cluster_small_violet .*game:home-field:preview -- --scope=objects/);
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
  assert.match(result.stdout, /npm run game:home-field:produce -- --scope=terrain --candidate -- path_dirt_straight --resize --crop-center/);
  assert.match(result.stdout, /--check-files --check-connectors --check-review/);
  assert.match(result.stdout, /--check-files --check-edge-profiles/);
  assert.match(result.stdout, /game:home-field:adjacency/);
  assert.match(result.stdout, /game:home-field:candidate-evidence/);
  assert.match(result.stdout, /game:home-field:preview -- --scope=terrain/);
  assert.doesNotMatch(result.stdout, /npm run game:home-field:produce -- path_dirt_straight/);
});

test('[home-field] chibi proof blocks failed local source before candidate commands', () => {
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
  assert.match(result.stdout, /# Home Field .* Next Local-Source Chibi Batch/);
  assert.match(result.stdout, /Generation mode: chibi active-roster candidate root/);
  assert.match(result.stdout, /thalla \(character\)/);
  assert.match(result.stdout, /Blocked local-source chibi proof: do not produce a candidate from the current source hash/);
  assert.match(result.stdout, /use this output only for blocker review and next-source requirements/);
  assert.doesNotMatch(result.stdout, /Use the queue-supplied local state-sheet source to produce and validate a candidate game home-field bitmap/);
  assert.doesNotMatch(result.stdout, /# Home Field .* Next Imagegen Batch/);
  assert.doesNotMatch(result.stdout, /Use the imagegen skill to create a candidate/);
  assert.doesNotMatch(result.stdout, /Grouped state sheet path \(save imagegen output HERE\)/);
  assert.doesNotMatch(result.stdout, /Copyable Sprite-Box Reference Prompt/);
  assert.doesNotMatch(result.stdout, /attach or same-context stage/);
  assert.doesNotMatch(result.stdout, /same-context staged/);
  assert.doesNotMatch(result.stdout, /chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
  assert.doesNotMatch(result.stdout, /claim-imagegen-output -- --since=<render-start-iso>/);
  assert.doesNotMatch(result.stdout, /OPENAI_IMAGEGEN_API_KEY/);
  assert.doesNotMatch(result.stdout, /referenceInputs/);
  assert.doesNotMatch(result.stdout, /view_image/);
  assert.doesNotMatch(result.stdout, /image_gen/);
  assert.match(result.stdout, /npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(result.stdout, /generation queue is the workflow authority\. This command only renders the queue-selected prompt/);
  assert.match(result.stdout, /current sourceGate is blocked_reference_proxy_palette_audit_failed/);
  assert.match(result.stdout, /do not run `npm run game:home-field:preflight-chibi-proof -- --source=/);
  assert.doesNotMatch(result.stdout, /preflight the queue-owned local source with `npm run game:home-field:preflight-chibi-proof -- --source=/);
  assert.doesNotMatch(result.stdout, /current default path is supplied local-source mode/);
  assert.match(result.stdout, new RegExp(chibiQueueLocalSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(result.stdout, /queue-printed --source archive\/stage commands/);
  assert.match(result.stdout, /Do not infer \.env, do not retry the exhausted built-in imagegen path, do not use paid API fallback/);
  assert.doesNotMatch(result.stdout, /styleReferences for visual review only in local-source mode, not as active imagegen inputs/);
  assert.doesNotMatch(result.stdout, /After source preflight passes, run `npm run game:home-field:archive-stale-chibi-proof -- thalla --source=/);
  assert.match(result.stdout, /Continue only after replacing the queue sourcePath with a new authored complete 8x4 local state sheet/);
  assert.match(result.stdout, /SourceGate recovery production attempt/);
  assert.match(result.stdout, /Exhausted repair sources that must not be reused/);
  assert.match(result.stdout, new RegExp(chibiExhaustedRepairSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(result.stdout, new RegExp(chibiExhaustedRepairSourceSha256));
  assert.match(result.stdout, new RegExp(chibiStyleRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(result.stdout, new RegExp(chibiStyleRejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiStyleRejectedCandidateSha256));
  assert.match(result.stdout, new RegExp(chibiMaskRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(result.stdout, new RegExp(chibiMaskRejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiMaskRejectedCandidateSha256));
  assert.match(result.stdout, new RegExp(chibiMotionMarksRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(result.stdout, new RegExp(chibiMotionMarksRejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiMotionMarksRejectedCandidateSha256));
  assert.match(result.stdout, new RegExp(chibiAnimeRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(result.stdout, new RegExp(chibiAnimeRejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiAnimeRejectedCandidateSha256));
  assert.match(result.stdout, new RegExp(chibiAttempt3RejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(result.stdout, new RegExp(chibiAttempt3RejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiAttempt3RejectedCandidateSha256));
  assert.match(result.stdout, /old mushroom monk|beige mascot pawn/);
  assert.match(result.stdout, /youthful little-girl/);
  assert.match(result.stdout, /skull-mask|hollow pin-dot/);
  assert.match(result.stdout, /detached motion\/action lines, squiggle marks, speed lines/);
  assert.match(result.stdout, /cute-but-generic anime|generic anime/);
  assert.match(result.stdout, /large glossy\/white (anime )?eyes|large glossy white eyes/);
  assert.match(result.stdout, /hair\/bangs\/wig fringe|visible hair bangs or wig fringe/);
  assert.match(result.stdout, /brooch\/medallion\/clasp|brooches, chest medallions/);
  assert.match(result.stdout, /character-only/);
  assert.match(result.stdout, /missing fresh authored-source capability/);
  assert.match(result.stdout, /clean blocker is not production-ready output/);
  assert.match(result.stdout, /better than older rejected lineages|better than older old-monk\/skull-mask\/anime failures|better than old-monk\/skull-mask\/anime failures/);
  assert.match(result.stdout, /visual fail checks must not be flipped|flip fail visual checks to pass/);
  assert.match(result.stdout, /mechanical validators/);
  assert.match(result.stdout, /do not split, produce a candidate, generate evidence, preview, record a verdict, run imagegen, or overwrite app-facing PNGs while the sourceGate is blocked/);
  assert.match(result.stdout, /Stop here while sourceGate is blocked; do not run split, producer, validation, evidence, preview, or verdict commands/);
  assert.match(result.stdout, /Report the blocked source path\/hash, failed reference proxy hash, failed palette counts/);
  assert.match(result.stdout, /For another production-ready run, give only the queue-only launcher/);
  assert.doesNotMatch(result.stdout, /this stages the supplied 8x4 state sheet and derives the non-production reference proxy/);
  assert.doesNotMatch(result.stdout, /Stop if any source, archive, or staging gate fails/);
  assert.doesNotMatch(result.stdout, /Run the reference-proxy verifier\/palette audit and state-sheet verifier\/palette audit/);
  assert.match(result.stdout, /Inactive built-in\/API fallback details are intentionally hidden from the default helper output/);
  assert.match(result.stdout, /--show-fallbacks` only for a future method change/);
  assert.match(result.stdout, /docs\/reference PNGs are style references, not proof source inputs/);
  assert.match(result.stdout, /Save no output to app-facing paths during the candidate proof/);
  assert.doesNotMatch(result.stdout, /In supplied complete local state-sheet mode, the 8x4 state sheet is already staged; do not regenerate it/);
  assert.doesNotMatch(result.stdout, /Grouped state sheet path \(stage supplied local source HERE\)/);
  assert.match(result.stdout, /Grouped state sheet path \(do not stage the blocked source hash here\)/);
  assert.match(result.stdout, /BLOCKED STAGE 1 LOCAL-SOURCE PROOF/);
  assert.match(result.stdout, /current queue-supplied complete 8x4 local state-sheet source already failed a hard sourceGate/);
  assert.match(result.stdout, /game:home-field:stage-chibi-local-source/);
  assert.match(result.stdout, /game:home-field:generation-queue/);
  assert.doesNotMatch(result.stdout, /verify-chibi-proof-files -- --reference/);
  assert.doesNotMatch(result.stdout, /palette-audit -- .*thalla_chibi_turnaround\.reference\.png/);
  assert.doesNotMatch(result.stdout, /thalla-reference-palette-audit\.json/);
  assert.doesNotMatch(result.stdout, /thalla-reference-palette-swatch\.png --fail-on-bloat/);
  assert.match(result.stdout, /thalla_chibi\.states\.source\.png/);
  assert.doesNotMatch(result.stdout, /verify-chibi-proof-files -- --state-sheet/);
  assert.doesNotMatch(result.stdout, /thalla-state-sheet-palette-audit\.json/);
  assert.doesNotMatch(result.stdout, /thalla-state-sheet-palette-swatch\.png --fail-on-bloat/);
  assert.doesNotMatch(result.stdout, /split-chibi-state-sheet -- --chroma-key=#ff00ff --resize/);
  assert.doesNotMatch(result.stdout, /verify-chibi-proof-files -- --frames/);
  assert.match(result.stdout, /Candidate output path \(not written while sourceGate is blocked\).*candidates\/chibi-active-roster\/latest/);
  assert.match(result.stdout, /Runtime asset contract/);
  assert.match(result.stdout, /raw source completeness/i);
  assert.match(result.stdout, /separate chibi shadow layer/);
  assert.match(result.stdout, /Animation: spritesheet-driven idle\/walk frames/);
  assert.doesNotMatch(result.stdout, /Animation: none \(single static PNG\)/);
  assert.doesNotMatch(result.stdout, /recover-chibi-alpha -- thalla/);
  assert.doesNotMatch(result.stdout, /record-chibi-verdict -- thalla --verdict=needs_regen/);
  assert.match(result.stdout, /Local-Source Style Review References/);
  assert.match(result.stdout, /The checked-in PNGs below are visual review references only for the supplied local-source run/);
  assert.match(result.stdout, /Do not attach them to imagegen, do not treat them as proof sources, and do not regenerate the reference proxy/);
  assert.match(result.stdout, /failed reference proxy hash/);
  assert.match(result.stdout, /supplied complete 8x4 local state-sheet source/i);
  assert.match(result.stdout, /one new authored supplied complete 8x4 state sheet, or explicitly repair-approved candidate-repair sheet whose source\/candidate hashes are not listed as exhausted/);
  assert.match(result.stdout, /not active imagegen inputs, not proof sources, and not files to attach to imagegen in this run/);
  assert.doesNotMatch(result.stdout, /In supplied complete local state-sheet mode, the 8x4 state sheet is already staged; do not regenerate it/);
  assert.match(result.stdout, /Final candidate input must originate from one coherent grouped state sheet, not 32 separate imagegen calls/);
  assert.match(result.stdout, /grouped state sheet itself must contain the idle bob and walk poses/);
  assert.match(result.stdout, /do not synthesize motion after split/i);
  assert.match(result.stdout, /Post-split deterministic processing may clean alpha\/chroma fringe, crop, and resize only/);
  assert.match(result.stdout, /BJD-inspired doll simplicity/);
  assert.match(result.stdout, /youthful little-girl/);
  assert.match(result.stdout, /oval\/almond doll eyes/);
  assert.match(result.stdout, /old monk|beige mascot pawn|elderly gnome|faceless mushroom token/);
  assert.match(result.stdout, /skull-mask face|hollow pin-dot eyes|blank mask face/);
  assert.match(result.stdout, /--show-fallbacks` only for a future method change/);
  assert.doesNotMatch(result.stdout, /reference-proxy verifier\/palette audit and state-sheet verifier\/palette audit/);
  assert.match(result.stdout, /supplied complete 8x4 local/);
  assert.doesNotMatch(result.stdout, /queue-owned local source/);
  assert.doesNotMatch(result.stdout, /Skip reference imagegen/);
  assert.doesNotMatch(result.stdout, /derives the reference proxy/);
  assert.match(result.stdout, /docs\/reference\/home-field\/chibi-thalla-previous-best-2026-06-26-state-sheet\.png/);
  assert.match(result.stdout, /docs\/reference\/home-field\/chibi-thalla-liked-2026-06-23\.png/);
  assert.match(result.stdout, /docs\/reference\/home-field\/chibi-style-agent-log-reference\.png/);
  assert.match(result.stdout, /styleReferences for visual review only/);
  assert.match(result.stdout, /not proof sources/);
  assert.match(result.stdout, /new supplied complete 8x4 local state-sheet source or an intentional future method change/);
  assert.match(result.stdout, /field-sprite leader/);
  assert.match(result.stdout, /compact visible dark oval\/almond doll eyes/);
  assert.match(result.stdout, /no visible hair bangs or wig fringe/);
  assert.match(result.stdout, /no cute-but-generic anime\/chibi character-sheet style/);
  assert.match(result.stdout, /minimal\/no white sclera/);
  assert.match(result.stdout, /no brooch\/medallion\/clasp ornament/);
  assert.match(result.stdout, /limited sprite palette/i);
  assert.match(result.stdout, /12-18 artist-visible colors/);
  assert.match(result.stdout, /fewer than 20 total design colors/);
  assert.match(result.stdout, /chibi-thalla-previous-best-2026-06-26-state-sheet/);
  assert.match(result.stdout, /preserve the compact grouped-sheet charm/);
  assert.match(result.stdout, /Represent authority through cap silhouette/);
  assert.match(result.stdout, /do not use royal regalia, crown jewels, forehead gems, brooches, chest medallions, pendants/);
  assert.match(result.stdout, /scalloped collar/);
  assert.match(result.stdout, /sleeve cuff trim/);
  assert.match(result.stdout, /no royal regalia, no crown jewels, no forehead gems, no brooches, no chest medallions/);
  assert.match(result.stdout, /Do not overcorrect the palette rule into hard pixel art, clean vector\/cel icon art/);
  assert.match(result.stdout, /no overcorrected flat\/vector\/cel\/pixel style/);
  assert.match(result.stdout, /no baked foot ovals/);
  assert.match(result.stdout, /no detached motion\/action lines/);
  assert.match(result.stdout, /no squiggle marks/);
  assert.match(result.stdout, /no speed lines/);
  assert.match(result.stdout, /visible palette|palette bloat/i);
  assert.match(result.stdout, /simpler than the 2026-06-20 candidate/);
  assert.match(result.stdout, /Mechanical sheet success, alpha success, mobile readability, and chibi-quality validation do not count as style approval/);
  assert.doesNotMatch(result.stdout, /npm run game:home-field:produce-chibi-candidate -- thalla --resize --chroma-key=#ff00ff/);
  assert.doesNotMatch(result.stdout, /verify-chibi-proof-files -- --candidate/);
  assert.doesNotMatch(result.stdout, /thalla-candidate-palette-audit\.json/);
  assert.doesNotMatch(result.stdout, /thalla-candidate-palette-swatch\.png --fail-on-bloat/);
  assert.doesNotMatch(result.stdout, /produce-chibi-candidate -- thalla --resize-nearest/);
  assert.doesNotMatch(result.stdout, /HOME_FIELD_ASSET_ROOT=.*candidates\/chibi-active-roster\/latest.*--ids=thalla --check-files --check-readability/);
  assert.doesNotMatch(result.stdout, /HOME_FIELD_ASSET_ROOT=.*candidates\/chibi-active-roster\/latest.*--ids=thalla --check-files --check-runtime-readiness/);
  assert.doesNotMatch(result.stdout, /--check-chibi-animation/);
  assert.doesNotMatch(result.stdout, /--check-chibi-quality/);
  assert.match(result.stdout, /at least as crisp, contrasted, and finished as approved Home Field props/);
  assert.match(result.stdout, /4 meaningful walk poses distributed across 6 slots/);
  assert.doesNotMatch(result.stdout, /game:home-field:candidate-evidence/);
  assert.doesNotMatch(result.stdout, /candidate-evidence requires thalla-reference\/state-sheet\/candidate palette audit JSON plus swatch PNGs/);
  assert.doesNotMatch(result.stdout, /HOME_FIELD_CANDIDATE_IDS=thalla .*chibi-candidate-preview/);
  assert.doesNotMatch(result.stdout, /npm run game:home-field:produce -- thalla/);
  assert.doesNotMatch(result.stdout, /rerun imagegen with adjusted constraints/);
});

test('[home-field] placeholder chibi prompt stays legacy-only', () => {
  const prompts = JSON.parse(fs.readFileSync(homeFieldPromptsPath, 'utf8'));
  const placeholder = prompts.prompts.character_placeholder_silhouette;

  assert.match(placeholder.details, /PLACEHOLDER-ONLY LEGACY PER-FRAME GENERATION/);
  assert.match(placeholder.constraints, /Current Stage 1 Thalla proof candidates must follow the grouped 8x4 source-sheet and 32 split-frame contract/);
  assert.doesNotMatch(placeholder.constraints, /full 32-frame animation is a later optional polish stage/);
});

test('[home-field] Thalla chibi prompt details persist the local-source default path', () => {
  const prompts = JSON.parse(fs.readFileSync(homeFieldPromptsPath, 'utf8'));
  const prompt = prompts.prompts.character_thalla_chibi;

  assert.match(prompt.details, /BLOCKED STAGE 1 LOCAL-SOURCE PROOF/);
  assert.match(prompt.details, /already failed a hard sourceGate/);
  assert.match(prompt.details, /generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(prompt.details, /blocked source path/);
  assert.match(prompt.details, new RegExp(chibiQueueLocalSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt.details, /Do not preflight, archive, stage, split, produce, validate, evidence, preview, record a verdict, run imagegen, or overwrite app-facing PNGs for this same source hash/);
  assert.match(prompt.details, /deterministic non-production reference proxy/);
  assert.match(prompt.details, /skip reference imagegen/);
  assert.match(prompt.details, /styleReferences for visual review only/);
  assert.match(prompt.details, /not proof sources and must not be attached to imagegen in this run/);
  assert.match(prompt.details, /12-18 artist-visible colors/);
  assert.match(prompt.details, /fewer than 20 total design colors/);
  assert.match(prompt.details, /new authored complete 8x4 local source/);
  assert.match(prompt.details, /SourceGate recovery production attempt/);
  assert.match(prompt.details, /Exhausted repair sources that must not be reused/);
  assert.match(prompt.details, new RegExp(chibiExhaustedRepairSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt.details, new RegExp(chibiExhaustedRepairSourceSha256));
  assert.match(prompt.details, new RegExp(chibiExhaustedRepairCandidateSha256));
  assert.match(prompt.details, new RegExp(chibiStyleRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt.details, new RegExp(chibiStyleRejectedSourceSha256));
  assert.match(prompt.details, new RegExp(chibiStyleRejectedCandidateSha256));
  assert.match(prompt.details, new RegExp(chibiMaskRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt.details, new RegExp(chibiMaskRejectedSourceSha256));
  assert.match(prompt.details, new RegExp(chibiMaskRejectedCandidateSha256));
  assert.match(prompt.details, new RegExp(chibiMotionMarksRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt.details, new RegExp(chibiMotionMarksRejectedSourceSha256));
  assert.match(prompt.details, new RegExp(chibiMotionMarksRejectedCandidateSha256));
  assert.match(prompt.details, new RegExp(chibiAnimeRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt.details, new RegExp(chibiAnimeRejectedSourceSha256));
  assert.match(prompt.details, new RegExp(chibiAnimeRejectedCandidateSha256));
  assert.match(prompt.details, new RegExp(chibiAttempt3RejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt.details, new RegExp(chibiAttempt3RejectedSourceSha256));
  assert.match(prompt.details, new RegExp(chibiAttempt3RejectedCandidateSha256));
  assert.match(prompt.details, /old mushroom monk or beige mascot pawn/);
  assert.match(prompt.details, /youthful little-girl/);
  assert.match(prompt.details, /liked Thalla reference is the primary positive style target/);
  assert.match(prompt.details, /cute dark storybook warmth/);
  assert.match(prompt.details, /simple BJD-inspired chibi doll face/);
  assert.match(prompt.details, /smooth BJD-like face planes/);
  assert.match(prompt.details, /softness through shape language/);
  assert.match(prompt.details, /charm survived palette repair/);
  assert.match(prompt.details, /soft BJD doll face was not flattened/);
  assert.match(prompt.details, /older cute little-girl references were much better/);
  assert.match(prompt.details, /skull-mask\/hollow pin-dot face/);
  assert.match(prompt.details, /compact visible oval\/almond doll eyes/);
  assert.match(prompt.details, /detached black motion\/squiggle marks/);
  assert.match(prompt.details, /cute but polished generic anime\/chibi style regression/);
  assert.match(prompt.details, /mostly dark compact oval\/almond doll features with minimal\/no white sclera/);
  assert.match(prompt.details, /human hair, bangs, or wig locks/);
  assert.match(prompt.details, /brooch, medallion, clasp/);
  assert.match(prompt.details, /1774x887 sheet/);
  assert.match(prompt.details, /only improves over older rejected failures/);
  assert.match(prompt.details, /tiny uniform mascot\/token read/);
  assert.match(prompt.details, /upgrade needs_regen to needs_review/);
  assert.match(prompt.details, /validators, palette\/alpha\/readability passes/);
  assert.match(prompt.details, /character-only/);
  assert.match(prompt.details, /no detached motion\/action lines, squiggle marks, speed lines/);
  assert.match(prompt.details, /missing fresh authored-source capability/);
  assert.match(prompt.details, /clean blocker is not production-ready output/);
  assert.match(prompt.size, /one new authored supplied complete 8x4 state sheet, or explicitly repair-approved candidate-repair sheet whose source\/candidate hashes are not listed as exhausted/);
  assert.match(prompt.constraints, /Stage 1 blocked local-source validation until sourceGate is cleared/);
  assert.match(prompt.constraints, /exhausted repair sources/);
  assert.match(prompt.constraints, /sourceGateRecovery\.exhaustedRepairSources/);
  assert.match(prompt.constraints, new RegExp(chibiStyleRejectedSourceSha256));
  assert.match(prompt.constraints, new RegExp(chibiStyleRejectedCandidateSha256));
  assert.match(prompt.constraints, new RegExp(chibiMaskRejectedSourceSha256));
  assert.match(prompt.constraints, new RegExp(chibiMaskRejectedCandidateSha256));
  assert.match(prompt.constraints, new RegExp(chibiMotionMarksRejectedSourceSha256));
  assert.match(prompt.constraints, new RegExp(chibiMotionMarksRejectedCandidateSha256));
  assert.match(prompt.constraints, new RegExp(chibiAnimeRejectedSourceSha256));
  assert.match(prompt.constraints, new RegExp(chibiAnimeRejectedCandidateSha256));
  assert.match(prompt.constraints, new RegExp(chibiAttempt3RejectedSourceSha256));
  assert.match(prompt.constraints, new RegExp(chibiAttempt3RejectedCandidateSha256));
  assert.match(prompt.constraints, /No elderly monk/);
  assert.match(prompt.constraints, /no beige mascot pawn/);
  assert.match(prompt.constraints, /no skull-mask face/);
  assert.match(prompt.constraints, /no hollow pin-dot eyes/);
  assert.match(prompt.constraints, /no detached motion\/action lines/);
  assert.match(prompt.constraints, /no squiggle marks/);
  assert.match(prompt.constraints, /no speed lines/);
  assert.match(prompt.constraints, /no cute-but-generic anime\/chibi character sheet/);
  assert.match(prompt.constraints, /no polished high-res turnaround normalized down as proof/);
  assert.match(prompt.constraints, /no large glossy\/white anime eyes/);
  assert.match(prompt.constraints, /no visible hair\/bangs\/wig fringe under the mushroom cap/);
  assert.match(prompt.constraints, /no brooch\/medallion\/clasp-like chest ornament/);
  assert.match(prompt.constraints, /no charm-destroying quantization/);
  assert.match(prompt.constraints, /no relative-improvement-only style approval/);
  assert.match(prompt.constraints, /no tiny uniform mascot\/token read/);
  assert.match(prompt.constraints, /no hard toy-like palette repair/);
  assert.match(prompt.constraints, /youthful little-girl BJD-inspired chibi doll read/);
  assert.match(prompt.constraints, /compact visible oval\/almond doll eyes/);
  assert.match(prompt.constraints, /do not stage any of those hashes again through the queue --source command/);
  assert.match(prompt.constraints, /styleReferences for visual review only/);
  assert.match(prompt.constraints, /not active imagegen inputs/);
  assert.match(prompt.constraints, /not files to attach to imagegen in this run/);
  assert.doesNotMatch(prompt.details, /HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS/);
  assert.doesNotMatch(prompt.details, /OPENAI_IMAGEGEN_API_KEY/);
  assert.doesNotMatch(prompt.details, /preflight-chibi-proof -- --env-file=<explicit-env-file>/);
  assert.doesNotMatch(prompt.details, /queue-backed built-in same-context staging path/);
  assert.doesNotMatch(prompt.details, /claim-imagegen-output/);
  assert.doesNotMatch(prompt.details, /attach or same-context stage/);
  assert.doesNotMatch(prompt.details, /passive view_image reference exposure/);
  assert.doesNotMatch(prompt.details, /chibi-reference-api-proof/);
  assert.doesNotMatch(prompt.details, /image_gen/);
  assert.doesNotMatch(prompt.constraints, /attached or staged as actual same-context image inputs/);
  assert.doesNotMatch(prompt.constraints, /passive view_image-only generation/);
});

test('[home-field] chibi proof launcher carries explicit local-source workflow', () => {
  const prompt = fs.readFileSync(runChibiProofPromptPath, 'utf8');
  const shortLauncher = prompt.match(/```text\n([\s\S]*?)\n```/)?.[1] || '';

  assert.match(prompt, /Short Launcher Prompt Template/);
  assert.match(prompt, /Use this launcher only when the queue item reports a ready active path/);
  assert.match(prompt, /If the queue prints a blocked source gate/);
  assert.match(prompt, /prompt-issuance gate/);
  assert.match(shortLauncher, /run `npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof`/);
  assert.match(shortLauncher, /use the printed queue results to generate what is needed/);
  assert.doesNotMatch(shortLauncher, /OPENAI_IMAGEGEN_API_KEY/);
  assert.doesNotMatch(shortLauncher, /HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1/);
  assert.doesNotMatch(shortLauncher, /plain OPENAI_API_KEY/);
  assert.doesNotMatch(shortLauncher, /Prefer built-in\/imagegen skill output/);
  assert.match(prompt, /app\/shared\/home-field\/home-field-generation-queue\.json/);
  assert.match(prompt, /default queue command must print the run title, canonical doc, prompt-issuance gate, sourceGate recovery instructions when blocked, local-source agent instructions, active source mode, style references, first-class `--source` commands/);
  assert.match(prompt, /Built-in imagegen flags, API fallback env rules, and exhausted method-gate history are inactive for this run and must print only with `--show-fallbacks`/);
  assert.match(prompt, /If the queue reports `sourceGate` blocked for the current source hash, stop before archive\/stage/);
  assert.match(prompt, /sourceGateRecovery\.copyablePrompt/);
  assert.match(prompt, /sourceGateRecovery\.exhaustedRepairSources/);
  assert.match(prompt, new RegExp(chibiStyleRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt, new RegExp(chibiStyleRejectedSourceSha256));
  assert.match(prompt, new RegExp(chibiStyleRejectedCandidateSha256));
  assert.match(prompt, new RegExp(chibiMaskRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt, new RegExp(chibiMaskRejectedSourceSha256));
  assert.match(prompt, new RegExp(chibiMaskRejectedCandidateSha256));
  assert.match(prompt, /youthful little-girl mushroom-elf chibi/);
  assert.match(prompt, /compact but visible dark oval\/almond doll eyes/);
  assert.match(prompt, /cute dark storybook/);
  assert.match(prompt, /simple BJD-inspired chibi doll face/);
  assert.match(prompt, /smooth BJD-like face planes/);
  assert.match(prompt, /charm survived palette repair/);
  assert.match(prompt, /hard toy-like palette repair/);
  assert.match(prompt, new RegExp(chibiCharmBaselineSourceSha256));
  assert.match(prompt, new RegExp(chibiCharmBaselineCandidateSha256));
  assert.match(prompt, /skull-mask face/);
  assert.match(prompt, /hollow pin-dot eyes/);
  assert.match(prompt, new RegExp(chibiAnimeRejectedSourceSha256));
  assert.match(prompt, new RegExp(chibiAnimeRejectedCandidateSha256));
  assert.match(prompt, new RegExp(chibiAttempt3RejectedSourceSha256));
  assert.match(prompt, new RegExp(chibiAttempt3RejectedCandidateSha256));
  assert.match(prompt, /cute-but-generic anime regression/);
  assert.match(prompt, /large glossy\/white anime eyes/);
  assert.match(prompt, /hair\/bangs or wig fringe/);
  assert.match(prompt, /brooch\/medallion-like ornament/);
  assert.match(prompt, /1774x887/);
  assert.match(prompt, /old mushroom monk\/beige mascot pawn/);
  assert.match(prompt, /only improved over older rejected failures/);
  assert.match(prompt, /tiny uniform mascot\/token read/);
  assert.match(prompt, /upgrade `needs_regen` or failed visual checks/);
  assert.match(prompt, /missing fresh authored-source capability/);
  assert.match(prompt, /clean block as a healthy production-ready image run/);
  assert.match(prompt, /default local-source run must use `npm run game:home-field:preflight-chibi-proof -- --source=<queue localSourceMode\.sourcePath>`/);
  assert.match(prompt, /archive-stale-chibi-proof -- thalla --source=<queue localSourceMode\.sourcePath>/);
  assert.match(prompt, /stage-chibi-local-source -- --source=<queue localSourceMode\.sourcePath>/);
  assert.match(prompt, /Do not infer `\.env`/);
  assert.match(prompt, /do not retry the exhausted built-in imagegen path/);
  assert.match(prompt, /do not use paid API fallback in the default local-source run/);
  assert.match(prompt, /Use `--show-fallbacks` on the queue command only when intentionally inspecting inactive methods/);
  assert.doesNotMatch(prompt, /default launcher now uses explicit CLI\/API fallback/);
  assert.doesNotMatch(prompt, /Use the explicit CLI\/API helper path by default/);
  assert.doesNotMatch(prompt, /chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
  assert.doesNotMatch(prompt, /claim-imagegen-output -- --since=<render-start-iso>/);
  assert.doesNotMatch(prompt, /If two exact-prompt image-guided reference attempts/);
  assert.doesNotMatch(prompt, /Generate the final states as ONE coherent `8x4` state sheet/);
  assert.match(prompt, /Do not use the checked-in PNGs under `docs\/reference\/home-field\/` as local proof sources/);
  assert.match(prompt, /When a supplied complete local state-sheet run is ready/);
  assert.match(prompt, /If `sourceGate` records that the current source hash failed/);
  assert.match(prompt, /localSourceMode\.sourcePath/);
  assert.match(prompt, new RegExp(chibiQueueLocalSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt, /preflight-chibi-proof -- --source=/);
  assert.match(prompt, /npm run game:home-field:stage-chibi-local-source -- --source=/);
  assert.match(prompt, /different supplied local state-sheet PNG must be passed explicitly with `--source` or recorded in the queue source path/);
  assert.doesNotMatch(prompt, /HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS/);
  assert.match(prompt, /Do not run reference imagegen for this local-source run/);
  assert.match(prompt, /styleReferences` for visual review only, not as active image inputs/);
  assert.match(prompt, /still run the read-only `npm run game:home-field:next -- --preset=chibi-proof` helper/);
  assert.match(prompt, /thalla-reference-palette-swatch\.png --fail-on-bloat/);
  assert.match(prompt, /thalla-state-sheet-palette-swatch\.png --fail-on-bloat/);
  assert.match(prompt, /thalla-candidate-palette-swatch\.png --fail-on-bloat/);
  assert.match(prompt, /--reason-stdin/);
  assert.match(prompt, /Do not create a relative `\.agent\/\.\.\.` reason file from the hub root/);
});

test('[home-field] imagegen requirements keep fallback methods out of default queue output', () => {
  const requirements = fs.readFileSync(homeFieldImagegenRequirementsPath, 'utf8');

  assert.match(requirements, /app\/shared\/home-field\/home-field-generation-queue\.json/);
  assert.match(requirements, /default output must describe the active run path only/);
  assert.match(requirements, /inactive built-in\/API fallback history is printed only with `--show-fallbacks`/);
  assert.match(requirements, /active default path is not imagegen/);
  assert.match(requirements, /Prompt issuance is source-hash gated/);
  assert.match(requirements, /A supplied local `sourcePath` can make the queue ready only until that exact source hash fails/);
  assert.match(requirements, /default queue output must stop issuing a production launcher for that same hash/);
  assert.match(requirements, /Preflight must reject a `--source` PNG whose sha256 matches a blocked `sourceGate`/);
  assert.match(requirements, /sourceGateRecovery/);
  assert.match(requirements, /sourceGateRecovery\.exhaustedRepairSources/);
  assert.match(requirements, /user rejected for missing the required style read/);
  assert.match(requirements, /old monk, beige mascot pawn, elderly gnome, faceless mushroom token, skull-mask face/);
  assert.match(requirements, /youthful little-girl Thalla style/);
  assert.match(requirements, /skull-mask face/);
  assert.match(requirements, /hollow pin-dot-eye mask/);
  assert.match(requirements, /visible oval\/almond doll eyes/);
  assert.match(requirements, /cute generic anime\/chibi character sheet/);
  assert.match(requirements, /large glossy\/white anime eyes/);
  assert.match(requirements, /visible hair\/bangs\/wig fringe/);
  assert.match(requirements, /brooch\/medallion\/clasp-like chest ornament/);
  assert.match(requirements, /high-res polished turnaround normalized down to `512x256`/);
  assert.match(requirements, /better than older rejected lineages/);
  assert.match(requirements, /positive references as an absolute target/);
  assert.match(requirements, /upgrade `needs_regen` to `needs_review`/);
  assert.match(requirements, /flip visual fail checks to pass/);
  assert.match(requirements, /self-authored `needs_review` prose/);
  assert.match(requirements, /detached motion\/action lines/);
  assert.match(requirements, /squiggle marks/);
  assert.match(requirements, /character-only/);
  assert.match(requirements, /raw generated source, repaired source, final candidate, and positive references/);
  assert.match(requirements, /cute dark storybook warmth/);
  assert.match(requirements, /simple BJD-inspired chibi doll face/);
  assert.match(requirements, /smooth BJD-like face planes/);
  assert.match(requirements, /flattens the liked reference's soft doll-face warmth into a hard toy, flat icon, or generic mascot/);
  assert.match(requirements, /whether charm survived palette repair/);
  assert.match(requirements, /exhausted source hashes before archive\/stage/);
  assert.match(requirements, /missing fresh authored-source capability/);
  assert.match(requirements, /copyable queue-only launcher/);
  assert.match(requirements, /run the queue script and use the printed queue `SourceGate recovery production attempt` results/);
  assert.match(requirements, /If no replacement source already exists/);
  assert.match(requirements, /A clean blocker report is not production readiness/);
  assert.match(requirements, /healthy queue behavior and still be an incomplete production attempt/);
  assert.match(requirements, /default `commands\.preflight` and `commands\.archiveStale` entries must be those local `--source` commands/);
  assert.match(requirements, /`referenceInputs` are not active imagegen inputs in supplied local-source mode/);
  assert.match(requirements, /The queue uses `styleReferences` for checked-in visual review references/);
  assert.match(requirements, /Do not tell the local-source worker to attach those images to imagegen/);
  assert.match(requirements, /Prompt issuance is gated too/);
  assert.match(requirements, /ready supplied source path/);
  assert.match(requirements, /localSourceMode\.sourcePath/);
  assert.match(requirements, new RegExp(chibiQueueLocalSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(requirements, /exact local commands/);
  assert.match(requirements, /npm run game:home-field:stage-chibi-local-source -- --source=<queue localSourceMode\.sourcePath>/);
  assert.match(requirements, /Inactive methods belong under `inactiveMethods` or `fallbacks` and are hidden from default output/);
  assert.match(requirements, /npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof --show-fallbacks/);
});

test('[home-field] local chibi source queue sourcePath rule is persisted in agent docs', () => {
  const sourcePathRule = /localSourceMode\.sourcePath|queue JSON `generationContract\.stateSheet\.localSourceMode\.sourcePath`|queue JSON generationContract\.stateSheet\.localSourceMode\.sourcePath/;
  const files = [
    runChibiProofPromptPath,
    runMinimalHomeFieldPromptPath,
    homeFieldImagegenRequirementsPath,
    homeFieldAgentFlowPath,
    homeFieldChibiCandidateContractPath
  ];

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    assert.match(text, sourcePathRule, filePath);
    assert.match(text, /--source/, filePath);
    assert.doesNotMatch(text, /HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS/, filePath);
  }
});

test('[home-field] repo agent instructions distinguish sourceGate blockers from production readiness', () => {
  const agents = fs.readFileSync(mushroomAgentsPath, 'utf8');

  assert.match(agents, /Home Field chibi production-run prompts and queue work/);
  assert.match(agents, /blocked `sourceGate`/);
  assert.match(agents, /production objective as still unmet/);
  assert.match(agents, /next pasted prompt must stay queue-only/);
  assert.match(agents, /use the printed queue `SourceGate recovery production attempt` results to generate what is needed/);
  assert.match(agents, /sourceGateRecovery/);
  assert.match(agents, /sourceGateRecovery\.exhaustedRepairSources/);
  assert.match(agents, /user-rejected style sources/);
  assert.match(agents, /old mushroom monk, beige mascot pawn, elderly gnome, faceless mushroom-token, skull-mask, hollow pin-dot-eye, blank-mask, detached motion\/squiggle-mark, cute-but-generic anime, or tiny uniform mascot\/token reads/);
  assert.match(agents, /youthful little-girl mushroom-elf chibi/);
  assert.match(agents, /compact visible oval\/almond doll eyes/);
  assert.match(agents, /large glossy\/white anime eyes/);
  assert.match(agents, /visible hair\/bangs\/wig fringe under the mushroom cap/);
  assert.match(agents, /brooch\/medallion\/clasp-like chest ornament/);
  assert.match(agents, /polished high-res anime turnaround normalized down to `512x256`/);
  assert.match(agents, /better than older rejected lineages/);
  assert.match(agents, /tiny mascot\/token/);
  assert.match(agents, /Do not flip failed visual checks to pass/);
  assert.match(agents, /upgrade `needs_regen` to `needs_review`/);
  assert.match(agents, /detached motion\/squiggle-mark/);
  assert.match(agents, /character-only/);
  assert.match(agents, /no detached motion\/action lines/);
  assert.match(agents, /raw generated source, repaired source or candidate, and positive references/);
  assert.match(agents, /old liked reference softness/);
  assert.match(agents, /hard toy, flat icon, or generic mascot/);
  assert.match(agents, /missing fresh authored-source capability/);
  assert.match(agents, /Final handoff must clearly say whether production-ready PNGs were actually produced/);
  assert.match(agents, /a correct blocker report is not production readiness/);
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
    chibiStageLocalSourceScriptPath,
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
  const inactiveBuiltin = item.inactiveMethods.find((method) => method.id === 'builtin_same_context_reference_staging');
  const inactiveApi = item.inactiveMethods.find((method) => method.id === 'paid_api_reference_fallback');

  assert.equal(queue.schemaVersion, 1);
  assert.ok(item, 'expected thalla-stage1-chibi-proof queue item');
  assert.equal(item.status, 'blocked_supplied_local_state_sheet_palette_gate_failed');
  assert.equal(item.activeSourceMode, 'supplied_local_state_sheet');
  assert.equal(item.ownerRole, 'Producer/Validation Worker');
  assert.equal(item.displayTitle, 'Thalla Home Field chibi Stage 1 proof');
  assert.match(item.minimalLauncherPrompt, /generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(item.minimalLauncherPrompt, /use the printed queue results to generate what is needed/);
  assert.equal(item.promptPolicy.issueLauncherWhenStatus, 'new_source_or_repair_method_only');
  assert.match(item.promptPolicy.action, /Do not issue another production launcher/);
  assert.match(item.promptPolicy.action, /failed the hard palette audit/);
  assert.match(item.promptPolicy.action, /sourcePath/);
  assert.match(item.promptPolicy.blockedPromptAction, /new authored complete 8x4 local state-sheet PNG/);
  assert.match(item.promptPolicy.blockedPromptAction, /repair method is secondary/);
  assert.match(item.promptPolicy.blockedShortResponse, /current supplied local source hash failed/);
  assert.equal(item.sourceGateRecovery.mode, 'method-change-production-attempt');
  assert.match(item.sourceGateRecovery.summary, /another production-ready run/);
  assert.match(item.sourceGateRecovery.summary, /next pasted prompt must stay queue-only/);
  assert.match(item.sourceGateRecovery.summary, /printed queue SourceGate recovery production attempt results/);
  assert.match(item.sourceGateRecovery.copyablePrompt, /generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.match(item.sourceGateRecovery.copyablePrompt, /use the printed queue SourceGate recovery production attempt results to generate what is needed/);
  assert.notEqual(item.sourceGateRecovery.copyablePrompt, item.minimalLauncherPrompt);
  assert.doesNotMatch(item.sourceGateRecovery.copyablePrompt, /method-change production attempt/);
  assert.doesNotMatch(item.sourceGateRecovery.copyablePrompt, /not the blocked default queue launcher/);
  assert.doesNotMatch(item.sourceGateRecovery.copyablePrompt, /--source=<new-source-png>/);
  assert.doesNotMatch(item.sourceGateRecovery.copyablePrompt, /palette-cleanup/);
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /do not inline these method-change details into the copyable user prompt/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /Do not stop only because no replacement source already exists/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /new authored complete 8x4 local state-sheet source/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /repair only as a secondary explicit method/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /exhausted repair source/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /Do not adopt/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /missing fresh authored-source capability/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /passing palette\/count scripts alone is not production-ready/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /Use `--source=<new-source-png>`/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /youthful little-girl mushroom-elf chibi/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /old monk, beige mascot pawn, elderly gnome, faceless mushroom token, skull-mask face/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /oval\/almond doll eyes/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /skull-mask face, hollow pin-dot eyes, or blank mask/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /cute dark storybook/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /simple BJD-inspired chibi doll face/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /smooth BJD-like face planes/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /detached motion\/action lines, squiggle marks, speed lines/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /cute-but-generic anime style/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /large glossy\/white anime eyes/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /visible human hair, bangs, or wig locks/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /brooch, medallion, clasp/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /oversized polished character sheet/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /normalization as technical processing only/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /character-only/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /raw generated source, repaired source, final candidate, and the two positive references/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /doll-face warmth/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /better than older rejected lineages/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /absolute target/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /upgrade needs_regen to needs_review/.test(action)));
  assert.ok(item.sourceGateRecovery.requiredActions.some((action) => /mechanical validators/.test(action)));
  assert.equal(item.sourceGateRecovery.exhaustedRepairSources.length, 6);
  const exhaustedRepairSource = item.sourceGateRecovery.exhaustedRepairSources.find((source) => source.path === chibiExhaustedRepairSourcePath);
  const styleRejectedSource = item.sourceGateRecovery.exhaustedRepairSources.find((source) => source.path === chibiStyleRejectedSourcePath);
  const maskRejectedSource = item.sourceGateRecovery.exhaustedRepairSources.find((source) => source.path === chibiMaskRejectedSourcePath);
  const motionMarksRejectedSource = item.sourceGateRecovery.exhaustedRepairSources.find((source) => source.path === chibiMotionMarksRejectedSourcePath);
  const animeRejectedSource = item.sourceGateRecovery.exhaustedRepairSources.find((source) => source.path === chibiAnimeRejectedSourcePath);
  const attempt3RejectedSource = item.sourceGateRecovery.exhaustedRepairSources.find((source) => source.path === chibiAttempt3RejectedSourcePath);
  assert.ok(exhaustedRepairSource, 'expected exhausted palette-repair source');
  assert.equal(exhaustedRepairSource.sourceSha256, chibiExhaustedRepairSourceSha256);
  assert.equal(exhaustedRepairSource.candidateSha256, chibiExhaustedRepairCandidateSha256);
  assert.equal(exhaustedRepairSource.verdict, 'needs_regen');
  assert.match(exhaustedRepairSource.rollout, /codex-019f2204/);
  assert.match(exhaustedRepairSource.reason, /Do not rerun/);
  assert.match(exhaustedRepairSource.reason, /not production-ready/);
  assert.ok(styleRejectedSource, 'expected user-rejected style source');
  assert.equal(styleRejectedSource.sourceSha256, chibiStyleRejectedSourceSha256);
  assert.equal(styleRejectedSource.candidateSha256, chibiStyleRejectedCandidateSha256);
  assert.equal(styleRejectedSource.verdict, 'needs_regen');
  assert.match(styleRejectedSource.rollout, /codex-019f23e4/);
  assert.match(styleRejectedSource.reason, /old mushroom monk\/mascot pawn/);
  assert.match(styleRejectedSource.reason, /youthful little-girl/);
  assert.ok(maskRejectedSource, 'expected user-rejected mask-face source');
  assert.equal(maskRejectedSource.sourceSha256, chibiMaskRejectedSourceSha256);
  assert.equal(maskRejectedSource.candidateSha256, chibiMaskRejectedCandidateSha256);
  assert.equal(maskRejectedSource.verdict, 'needs_regen');
  assert.match(maskRejectedSource.rollout, /codex-019f2409/);
  assert.match(maskRejectedSource.reason, /older cute little-girl references were much better/);
  assert.match(maskRejectedSource.reason, /skull-mask\/hollow pin-dot face/);
  assert.ok(motionMarksRejectedSource, 'expected motion-mark rejected source');
  assert.equal(motionMarksRejectedSource.sourceSha256, chibiMotionMarksRejectedSourceSha256);
  assert.equal(motionMarksRejectedSource.candidateSha256, chibiMotionMarksRejectedCandidateSha256);
  assert.equal(motionMarksRejectedSource.verdict, 'needs_regen');
  assert.match(motionMarksRejectedSource.rollout, /codex-019f24ce/);
  assert.match(motionMarksRejectedSource.reason, /charm-improved/);
  assert.match(motionMarksRejectedSource.reason, /detached motion\/squiggle marks/);
  assert.ok(animeRejectedSource, 'expected cute generic anime rejected source');
  assert.equal(animeRejectedSource.sourceSha256, chibiAnimeRejectedSourceSha256);
  assert.equal(animeRejectedSource.candidateSha256, chibiAnimeRejectedCandidateSha256);
  assert.equal(animeRejectedSource.verdict, 'needs_regen');
  assert.match(animeRejectedSource.rollout, /codex-019f2501/);
  assert.match(animeRejectedSource.reason, /generic anime chibi turnaround/);
  assert.match(animeRejectedSource.reason, /large glossy\/white eyes/);
  assert.match(animeRejectedSource.reason, /visible hair\/bangs or wig fringe/);
  assert.match(animeRejectedSource.reason, /brooch\/medallion-like status ornament/);
  assert.match(animeRejectedSource.reason, /not production-ready/);
  assert.ok(attempt3RejectedSource, 'expected relative-improvement attempt3 rejected source');
  assert.equal(attempt3RejectedSource.sourceSha256, chibiAttempt3RejectedSourceSha256);
  assert.equal(attempt3RejectedSource.candidateSha256, chibiAttempt3RejectedCandidateSha256);
  assert.equal(attempt3RejectedSource.verdict, 'needs_regen');
  assert.match(attempt3RejectedSource.rollout, /codex-019f252f/);
  assert.match(attempt3RejectedSource.reason, /real style regression/);
  assert.match(attempt3RejectedSource.reason, /better than older old-monk\/skull-mask\/anime failures/);
  assert.match(attempt3RejectedSource.reason, /tiny uniform mascot\/token read/);
  assert.match(attempt3RejectedSource.reason, /visual fail checks must not be flipped to pass/);
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /new source path and sha256/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /must not match .*exhausted repair source\/candidate hash/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /youthful little-girl Thalla chibi/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /old monk, beige mascot pawn, elderly gnome, faceless mushroom token, skull-mask face/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /visible oval\/almond eyes/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /skull-mask face/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /detached motion\/action\/squiggle\/speed-line marks/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /character-only/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /raw imagegen sheet's soft\/charming face/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /generic anime\/doll turnaround/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /minimal\/no white sclera/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /hair\/wig fringe/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /brooch\/medallion\/clasp/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /oversized polished sheet/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /flat toy, hard icon, or generic mascot/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /repair experiment/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /visual review clears the original source defects/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /production-ready candidate output from an intentional blocker/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /merely an improvement over older rejected lineages/.test(criterion)));
  assert.ok(item.sourceGateRecovery.successCriteria.some((criterion) => /mechanical validators alone cannot upgrade/.test(criterion)));
  assert.ok(item.agentInstructions.some((instruction) => /existing Thalla Home Field chibi Stage 1 source hash as blocked/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /Follow app\/shared\/home-field\/RUN_CHIBI_PROOF_PROMPT\.md exactly/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /sourceGateRecovery\.copyablePrompt/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /queue-only sourceGateRecovery\.copyablePrompt/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /generic minimal launcher/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /printed SourceGate recovery production attempt section/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /do not stop merely because no replacement source already exists/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /new authored complete 8x4 source/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /not a production-ready shortcut/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /Do not rerun the exhausted repair source/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiExhaustedRepairSourcePath)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiExhaustedRepairSourceSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiExhaustedRepairCandidateSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiStyleRejectedSourcePath)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiStyleRejectedSourceSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiStyleRejectedCandidateSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiMaskRejectedSourcePath)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiMaskRejectedSourceSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiMaskRejectedCandidateSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiMotionMarksRejectedSourcePath)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiMotionMarksRejectedSourceSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiMotionMarksRejectedCandidateSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiAnimeRejectedSourcePath)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiAnimeRejectedSourceSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiAnimeRejectedCandidateSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiAttempt3RejectedSourcePath)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiAttempt3RejectedSourceSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiAttempt3RejectedCandidateSha256)));
  assert.ok(item.agentInstructions.some((instruction) => /youthful little-girl mushroom-elf chibi/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /oval\/almond doll eyes/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /old monk, beige mascot pawn, elderly gnome, faceless mushroom-token/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /skull-mask face, hollow pin-dot eyes, blank mask face/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiCharmBaselineSourceSha256)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiCharmBaselineCandidateSha256)));
  assert.ok(item.agentInstructions.some((instruction) => /baseline to beat, not as approval/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /charm survived palette repair/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /relative comparison to older rejected lineages/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /upgrade needs_regen to needs_review/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /tiny uniform mascot\/token read/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /detached motion\/action lines, squiggle marks, speed lines/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /needs_regen even if palette, alpha, animation, and readability validators pass/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /merely cute generic anime\/chibi/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /large glossy white eyes/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /visible hair\/bangs\/wig fringe/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /brooch\/medallion\/clasp ornament/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /missing fresh authored-source capability/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /production-ready PNGs were not produced/.test(instruction)));
  assert.match(item.commands.recordVerdict, /--reason-stdin/);
  assert.doesNotMatch(item.commands.recordVerdict, /--reason-file/);
  assert.ok(item.agentInstructions.some((instruction) => /generationContract\.stateSheet\.localSourceMode\.sourcePath/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /complete 8x4 local state-sheet source/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /Do not rerun preflight\/archive\/stage/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /sourceGate records/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /new complete 8x4 local state-sheet source|new authored complete 8x4 source/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /palette-cleanup or repair method/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /preserves blocked-source visual defects/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => instruction.includes(chibiQueueLocalSourcePath)));
  assert.ok(item.agentInstructions.some((instruction) => /styleReferences as visual review references only/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /reference imagegen is skipped/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /must not attach styleReferences to imagegen/.test(instruction)));
  assert.ok(item.agentInstructions.some((instruction) => /failed reference proxy hash, failed palette audit counts/.test(instruction)));
  assert.ok(item.agentInstructions.every((instruction) => !/HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS/.test(instruction)));
  assert.ok(item.agentInstructions.every((instruction) => !/OPENAI_IMAGEGEN_API_KEY|HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE|plain OPENAI_API_KEY|referenceInputs/.test(instruction)));
  assert.equal(item.assetId, 'thalla');
  assert.equal(item.assetType, 'character');
  assert.equal(Object.hasOwn(item, 'env'), false);
  assert.equal(Object.hasOwn(item, 'builtInImagegen'), false);
  assert.equal(Object.hasOwn(item, 'methodGate'), false);
  assert.equal(Object.hasOwn(item, 'referenceInputs'), false);
  assert.equal(item.sourceGate.rollout, 'codex-019f1f94-ed13-7701-85a2-62a97f7431e7');
  assert.equal(item.sourceGate.status, 'blocked_reference_proxy_palette_audit_failed');
  assert.equal(item.sourceGate.sourcePath, chibiQueueLocalSourcePath);
  assert.equal(item.sourceGate.sourceSha256, '19eb3f1abc5bbaba1e88eb36c8ca308353f0e0d756528cbbddfc05430bb868fa');
  assert.equal(item.sourceGate.referenceProxySha256, '8eb95c9f5a96439affccd6795bfff846a6128bc631a02ccddeccfe04743a75ec');
  assert.match(item.sourceGate.failedCommand, /thalla-reference-palette-audit\.json/);
  assert.equal(item.sourceGate.evidence.exactColorsAtLeastSignificantThreshold, 31);
  assert.equal(item.sourceGate.evidence.targetMaxSignificantExactColors, 20);
  assert.equal(item.sourceGate.evidence.exactColorsAtLeastMinorThreshold, 98);
  assert.equal(item.sourceGate.evidence.coarseStep32SignificantBins, 57);
  assert.match(item.sourceGate.action, /Do not rerun this exact supplied source hash/);
  assert.ok(inactiveBuiltin, 'expected inactive built-in method');
  assert.equal(inactiveBuiltin.status, 'exhausted');
  assert.equal(inactiveBuiltin.showWith, '--show-fallbacks');
  assert.equal(inactiveBuiltin.builtInImagegen.defaultPath, true);
  assert.equal(inactiveBuiltin.builtInImagegen.sameContextRequired, true);
  assert.deepEqual(inactiveBuiltin.builtInImagegen.confirmationFlags, [
    'HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1',
    'HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1'
  ]);
  assert.match(inactiveBuiltin.builtInImagegen.referenceStaging, /Load all 3 referenceInputs PNGs with view_image/);
  assert.equal(inactiveBuiltin.methodGate.rollout, 'codex-019f1eb1-1027-7752-95cf-d4f37cb0041c');
  assert.equal(inactiveBuiltin.methodGate.status, 'blocked_builtin_same_context_reference_staging_exhausted');
  assert.match(inactiveBuiltin.methodGate.reason, /failed the reference verifier/);
  assert.match(inactiveBuiltin.methodGate.reason, /91 significant exact colors/);
  assert.match(inactiveBuiltin.methodGate.allowedPath, /Do not run the built-in same-context staging path again/);
  assert.match(inactiveBuiltin.methodGate.stopIf, /Stop before archive\/imagegen/);
  assert.ok(inactiveApi, 'expected inactive paid API fallback');
  assert.equal(inactiveApi.showWith, '--show-fallbacks');
  assert.equal(inactiveApi.env.doNotInferEnvFile, true);
  assert.equal(inactiveApi.env.doNotUseRepoDotEnvUnlessUserExplicitlySaysItContainsRequiredKeys, true);
  assert.deepEqual(inactiveApi.env.requiredKeys, []);
  assert.deepEqual(inactiveApi.env.apiFallbackRequiredKeys, ['OPENAI_IMAGEGEN_API_KEY']);
  assert.equal(inactiveApi.env.plainOpenAiApiKeyIgnored, true);
  assert.equal(inactiveApi.env.apiFallbackRequiresSkillUnavailable, true);
  assert.equal(inactiveApi.env.apiFallbackFlag, 'HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1');
  assert.match(inactiveApi.env.blockedRunEvidence.rollout, /codex-019f1dbd-e6dd-70e0-a7fe-53977b1cc831/);
  assert.match(inactiveApi.commands.preflight, /preflight-chibi-proof -- --env-file=<explicit-env-file>/);
  assert.match(inactiveApi.commands.archiveStale, /archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>/);
  assert.match(inactiveApi.commands.referenceApiProof, /chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
  assert.equal(item.generationContract.stateSheet.stopIfPromptOnly, true);
  assert.equal(Object.hasOwn(item.generationContract.stateSheet, 'stopIfReferenceCannotBeAttachedAsActualImageInput'), false);
  assert.equal(Object.hasOwn(item.generationContract.stateSheet, 'requiredReferenceImageInput'), false);
  assert.match(item.generationContract.stateSheet.method, /supplied complete 8x4 local state-sheet source/);
  assert.match(item.generationContract.stateSheet.motionRule, /detached motion\/action\/squiggle\/speed-line marks/);
  assert.equal(item.generationContract.stateSheet.localSourceMode.sourcePath, chibiQueueLocalSourcePath);
  assert.equal(item.generationContract.stateSheet.localSourceMode.sourceKind, 'supplied-complete-8x4-local-state-sheet');
  assert.equal(Object.hasOwn(item.generationContract.stateSheet.localSourceMode, 'envKey'), false);
  assert.equal(Object.hasOwn(item.generationContract.stateSheet.localSourceMode, 'envPolicy'), false);
  assert.equal(item.generationContract.stateSheet.localSourceMode.completeStateSheetAllowed, true);
  assert.equal(item.generationContract.stateSheet.localSourceMode.preflightCommand, `npm run game:home-field:preflight-chibi-proof -- --source=${chibiQueueLocalSourcePath}`);
  assert.equal(item.generationContract.stateSheet.localSourceMode.archiveCommand, `npm run game:home-field:archive-stale-chibi-proof -- thalla --source=${chibiQueueLocalSourcePath}`);
  assert.equal(item.generationContract.stateSheet.localSourceMode.stageCommand, `npm run game:home-field:stage-chibi-local-source -- --source=${chibiQueueLocalSourcePath}`);
  assert.match(item.generationContract.stateSheet.localSourceMode.derivesReferenceProxy, /thalla_chibi_turnaround\.reference\.png/);
  assert.equal(item.generationContract.stateSheet.localSourceMode.skipImagegen, true);
  assert.match(item.commands.queue, /generation-queue -- --id=thalla-stage1-chibi-proof/);
  assert.equal(item.commands.preflight, `npm run game:home-field:preflight-chibi-proof -- --source=${chibiQueueLocalSourcePath}`);
  assert.equal(item.commands.archiveStale, `npm run game:home-field:archive-stale-chibi-proof -- thalla --source=${chibiQueueLocalSourcePath}`);
  assert.equal(item.commands.stageLocalSource, `npm run game:home-field:stage-chibi-local-source -- --source=${chibiQueueLocalSourcePath}`);
  assert.equal(Object.hasOwn(item.commands, 'preflightLocalSource'), false);
  assert.equal(Object.hasOwn(item.commands, 'archiveStaleLocalSource'), false);
  assert.equal(Object.hasOwn(item.commands, 'referenceApiProof'), false);
  assert.ok(item.stopRules.some((rule) => /preflight with the queue-owned --source path/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /archive-stale-chibi-proof with the same --source path/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /stage-chibi-local-source with the same --source path fails/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /detached non-character motion\/action\/squiggle\/speed-line marks/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /generic anime\/doll turnaround/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /large glossy\/white eyes/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /hair\/bangs\/wig fringe/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /brooch\/medallion\/clasp ornament/.test(rule)));
  assert.ok(item.stopRules.some((rule) => /Do not run reference imagegen, built-in imagegen, or paid API fallback in the default local-source run/.test(rule)));
  assert.ok(item.finalResponseMustReport.includes('supplied source path and sha256'));
  assert.ok(item.finalResponseMustReport.includes('archive result and staged local-source provenance manifest'));
  assert.ok(item.finalResponseMustReport.includes('statement that reference imagegen was skipped and a deterministic reference proxy was derived'));
  assert.ok(item.finalResponseMustReport.includes('candidate folder path'));
  assert.ok(item.finalResponseMustReport.includes('that no app-facing PNG was overwritten'));

  for (const reference of item.styleReferences) {
    assert.equal(fs.existsSync(path.join(repoRoot, reference.path)), true, reference.path);
    assert.match(reference.usage, /visual style reference/);
    assert.match(reference.usage, /not an active imagegen input/);
  }

  const likedThallaReference = item.styleReferences.find((reference) => reference.path === 'docs/reference/home-field/chibi-thalla-liked-2026-06-23.png');
  assert.ok(likedThallaReference, 'expected liked Thalla style reference');
  assert.match(likedThallaReference.role, /primary positive youthful little-girl Thalla/);
  assert.match(likedThallaReference.role, /compact oval\/almond doll eyes/);
  assert.match(likedThallaReference.role, /rounded-cheek appeal/);
});

test('[home-field] generation queue printer exposes local-source defaults without fallback dirt', () => {
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
  assert.match(result.stdout, /use the printed queue results to generate what is needed/);
  assert.match(result.stdout, /status: blocked_supplied_local_state_sheet_palette_gate_failed/);
  assert.match(result.stdout, /active source mode: supplied_local_state_sheet/);
  assert.match(result.stdout, /owner role: Producer\/Validation Worker/);
  assert.match(result.stdout, /Prompt issuance gate:/);
  assert.doesNotMatch(result.stdout, /Prompt issuance gate \(blocked\):/);
  assert.match(result.stdout, /issue launcher when: new_source_or_repair_method_only/);
  assert.match(result.stdout, /action: .*same supplied local state-sheet source hash/);
  assert.match(result.stdout, /blocked action: .*new authored complete 8x4 local state-sheet PNG/);
  assert.match(result.stdout, /blocked action: .*repair method is secondary/);
  assert.match(result.stdout, /blocked short response: Blocked: the current supplied local source hash failed/);
  assert.match(result.stdout, /SourceGate recovery production attempt:/);
  assert.match(result.stdout, /mode: method-change-production-attempt/);
  assert.match(result.stdout, /summary: .*printed queue SourceGate recovery production attempt results/);
  assert.match(result.stdout, /copyable queue-only prompt:/);
  assert.match(result.stdout, /run `npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof` and use the printed queue SourceGate recovery production attempt results to generate what is needed/);
  assert.doesNotMatch(result.stdout, /run a Thalla Home Field chibi Stage 1 method-change production attempt/);
  assert.match(result.stdout, /Prefer producing or accepting a genuinely new authored complete 8x4 local state-sheet source/);
  assert.match(result.stdout, /repair only as a secondary explicit method/);
  assert.match(result.stdout, /Do not adopt any exhausted repair source or candidate hash listed below/);
  assert.match(result.stdout, /missing fresh authored-source capability/);
  assert.match(result.stdout, /passing palette\/count scripts alone is not production-ready/);
  assert.match(result.stdout, /Reject cute-but-generic anime style explicitly/);
  assert.match(result.stdout, /large glossy\/white anime eyes/);
  assert.match(result.stdout, /visible human hair, bangs, or wig locks/);
  assert.match(result.stdout, /brooch, medallion, clasp/);
  assert.match(result.stdout, /oversized polished character sheet/);
  assert.match(result.stdout, /normalization as technical processing only/);
  assert.match(result.stdout, /detached motion\/action lines, squiggle marks, speed lines/);
  assert.match(result.stdout, /character-only/);
  assert.match(result.stdout, /Do not stop only because no replacement source already exists/);
  assert.match(result.stdout, /better than older rejected lineages/);
  assert.match(result.stdout, /absolute target/);
  assert.match(result.stdout, /upgrade needs_regen to needs_review/);
  assert.match(result.stdout, /mechanical validators/);
  assert.match(result.stdout, /do not use the blocked queue source hash/);
  assert.match(result.stdout, /--source=<new-source-png>/);
  assert.match(result.stdout, /repair experiment/);
  assert.match(result.stdout, /exhausted repair sources:/);
  assert.match(result.stdout, new RegExp(`path: ${chibiExhaustedRepairSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, new RegExp(`source sha256: ${chibiExhaustedRepairSourceSha256}`));
  assert.match(result.stdout, new RegExp(`candidate sha256: ${chibiExhaustedRepairCandidateSha256}`));
  assert.match(result.stdout, /verdict: needs_regen/);
  assert.match(result.stdout, /Do not rerun this exhausted repair source/);
  assert.match(result.stdout, new RegExp(`path: ${chibiStyleRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, new RegExp(`source sha256: ${chibiStyleRejectedSourceSha256}`));
  assert.match(result.stdout, new RegExp(`candidate sha256: ${chibiStyleRejectedCandidateSha256}`));
  assert.match(result.stdout, /verdict: needs_regen/);
  assert.match(result.stdout, /old mushroom monk\/mascot pawn/);
  assert.match(result.stdout, /youthful little-girl/);
  assert.match(result.stdout, new RegExp(`path: ${chibiMaskRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, new RegExp(`source sha256: ${chibiMaskRejectedSourceSha256}`));
  assert.match(result.stdout, new RegExp(`candidate sha256: ${chibiMaskRejectedCandidateSha256}`));
  assert.match(result.stdout, /older cute little-girl references were much better/);
  assert.match(result.stdout, /skull-mask\/hollow pin-dot face/);
  assert.match(result.stdout, new RegExp(`path: ${chibiMotionMarksRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, new RegExp(`source sha256: ${chibiMotionMarksRejectedSourceSha256}`));
  assert.match(result.stdout, new RegExp(`candidate sha256: ${chibiMotionMarksRejectedCandidateSha256}`));
  assert.match(result.stdout, /charm-improved/);
  assert.match(result.stdout, /detached motion\/squiggle marks/);
  assert.match(result.stdout, new RegExp(`path: ${chibiAnimeRejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, new RegExp(`source sha256: ${chibiAnimeRejectedSourceSha256}`));
  assert.match(result.stdout, new RegExp(`candidate sha256: ${chibiAnimeRejectedCandidateSha256}`));
  assert.match(result.stdout, /cute-but-user-rejected anime recovery source/);
  assert.match(result.stdout, /generic anime chibi turnaround/);
  assert.match(result.stdout, /large glossy\/white eyes/);
  assert.match(result.stdout, /visible hair\/bangs or wig fringe/);
  assert.match(result.stdout, /brooch\/medallion-like status ornament/);
  assert.match(result.stdout, new RegExp(`path: ${chibiAttempt3RejectedSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, new RegExp(`source sha256: ${chibiAttempt3RejectedSourceSha256}`));
  assert.match(result.stdout, new RegExp(`candidate sha256: ${chibiAttempt3RejectedCandidateSha256}`));
  assert.match(result.stdout, /real style regression/);
  assert.match(result.stdout, /tiny uniform mascot\/token read/);
  assert.match(result.stdout, /visual fail checks must not be flipped to pass/);
  assert.match(result.stdout, /must not match the blocked source hash or any exhausted repair source\/candidate hash/);
  assert.match(result.stdout, /liked Thalla reference/);
  assert.match(result.stdout, /visible oval\/almond eyes/);
  assert.match(result.stdout, /old monk, beige mascot pawn, elderly gnome, faceless mushroom token, skull-mask face/);
  assert.match(result.stdout, /skull-mask face/);
  assert.match(result.stdout, /detached motion\/action\/squiggle\/speed-line marks/);
  assert.match(result.stdout, /cute dark storybook/);
  assert.match(result.stdout, /simple BJD-inspired chibi doll face/);
  assert.match(result.stdout, /smooth BJD-like face planes/);
  assert.match(result.stdout, /raw generated source, repaired source, final candidate, and the two positive references/);
  assert.match(result.stdout, /doll-face warmth/);
  assert.match(result.stdout, /raw imagegen sheet's soft\/charming face/);
  assert.match(result.stdout, /generic anime\/doll turnaround/);
  assert.match(result.stdout, /minimal\/no white sclera/);
  assert.match(result.stdout, /hair\/wig fringe/);
  assert.match(result.stdout, /brooch\/medallion\/clasp/);
  assert.match(result.stdout, /oversized polished sheet/);
  assert.match(result.stdout, /flat toy, hard icon, or generic mascot/);
  assert.match(result.stdout, /visual review clears the original source defects/);
  assert.match(result.stdout, /production-ready candidate output from an intentional blocker/);
  assert.match(result.stdout, /merely an improvement over older rejected lineages/);
  assert.match(result.stdout, /mechanical validators alone cannot upgrade/);
  assert.match(result.stdout, /required actions:/);
  assert.match(result.stdout, /success criteria:/);
  assert.match(result.stdout, /Agent instructions:/);
  assert.match(result.stdout, /Follow app\/shared\/home-field\/RUN_CHIBI_PROOF_PROMPT\.md exactly/);
  assert.match(result.stdout, /sourceGateRecovery\.copyablePrompt/);
  assert.match(result.stdout, /generic minimal launcher/);
  assert.match(result.stdout, /printed SourceGate recovery production attempt section/);
  assert.match(result.stdout, /production-ready PNGs were not produced unless a new candidate passes every listed gate/);
  assert.match(result.stdout, /recordVerdict: .*--reason-stdin/);
  assert.doesNotMatch(result.stdout, /recordVerdict: .*--reason-file/);
  assert.match(result.stdout, /Do not rerun preflight\/archive\/stage for the current generationContract\.stateSheet\.localSourceMode\.sourcePath/);
  assert.match(result.stdout, /sourceGate records that this exact source hash failed the reference palette audit/);
  assert.match(result.stdout, /If the user supplies a new complete 8x4 local state-sheet source/);
  assert.match(result.stdout, /new authored complete 8x4 source/);
  assert.match(result.stdout, /not a production-ready shortcut/);
  assert.match(result.stdout, /Do not rerun the exhausted repair source/);
  assert.match(result.stdout, /Do not rerun the user-rejected SourceGate recovery source/);
  assert.match(result.stdout, new RegExp(chibiStyleRejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiStyleRejectedCandidateSha256));
  assert.match(result.stdout, /Do not rerun the user-rejected imagegen SourceGate recovery source/);
  assert.match(result.stdout, new RegExp(chibiMaskRejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiMaskRejectedCandidateSha256));
  assert.match(result.stdout, /Do not rerun the charm-improved but rejected SourceGate recovery source/);
  assert.match(result.stdout, new RegExp(chibiMotionMarksRejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiMotionMarksRejectedCandidateSha256));
  assert.match(result.stdout, /Do not rerun the cute-but-user-rejected anime recovery source/);
  assert.match(result.stdout, new RegExp(chibiAnimeRejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiAnimeRejectedCandidateSha256));
  assert.match(result.stdout, /Do not rerun the attempt3 SourceGate recovery source/);
  assert.match(result.stdout, new RegExp(chibiAttempt3RejectedSourceSha256));
  assert.match(result.stdout, new RegExp(chibiAttempt3RejectedCandidateSha256));
  assert.match(result.stdout, /youthful little-girl mushroom-elf chibi/);
  assert.match(result.stdout, /oval\/almond doll eyes/);
  assert.match(result.stdout, /skull-mask face, hollow pin-dot eyes, blank mask face/);
  assert.match(result.stdout, /detached motion\/action lines, squiggle marks, speed lines/);
  assert.match(result.stdout, /needs_regen even if palette, alpha, animation, and readability validators pass/);
  assert.match(result.stdout, /merely cute generic anime\/chibi/);
  assert.match(result.stdout, /large glossy white eyes/);
  assert.match(result.stdout, /visible hair\/bangs\/wig fringe/);
  assert.match(result.stdout, /brooch\/medallion\/clasp ornament/);
  assert.match(result.stdout, new RegExp(chibiCharmBaselineSourceSha256));
  assert.match(result.stdout, new RegExp(chibiCharmBaselineCandidateSha256));
  assert.match(result.stdout, /baseline to beat, not as approval/);
  assert.match(result.stdout, /charm survived palette repair/);
  assert.match(result.stdout, /relative comparison to older rejected lineages/);
  assert.match(result.stdout, /self-authored needs_review reason/);
  assert.match(result.stdout, /same needs_regen verdict/);
  assert.match(result.stdout, /If a palette-cleanup or repair method is intentionally adopted/);
  assert.match(result.stdout, /Treat styleReferences as visual review references only/);
  assert.match(result.stdout, /reference imagegen is skipped/);
  assert.match(result.stdout, /must not attach styleReferences to imagegen/);
  assert.doesNotMatch(result.stdout, /Built-in imagegen path \(blocked by method gate\):/);
  assert.doesNotMatch(result.stdout, /Built-in imagegen default path:/);
  assert.doesNotMatch(result.stdout, /Method gate \/ allowed method change:/);
  assert.doesNotMatch(result.stdout, /OPENAI_IMAGEGEN_API_KEY/);
  assert.doesNotMatch(result.stdout, /HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1/);
  assert.doesNotMatch(result.stdout, /plain OPENAI_API_KEY is ignored/);
  assert.doesNotMatch(result.stdout, /referenceInputs/);
  assert.match(result.stdout, /Blocked local-source plan:/);
  assert.match(result.stdout, new RegExp(`source path: ${chibiQueueLocalSourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, /source exists: (yes|no)/);
  assert.match(result.stdout, /preflight command: npm run game:home-field:preflight-chibi-proof -- --source=.*thalla_tetro_cleaned_2026-06-30\.states\.source\.png/);
  assert.match(result.stdout, /archive command: npm run game:home-field:archive-stale-chibi-proof -- thalla --source=.*thalla_tetro_cleaned_2026-06-30\.states\.source\.png/);
  assert.match(result.stdout, /stage command: npm run game:home-field:stage-chibi-local-source -- --source=.*thalla_tetro_cleaned_2026-06-30\.states\.source\.png/);
  assert.doesNotMatch(result.stdout, /env override:/i);
  assert.doesNotMatch(result.stdout, /HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS/);
  assert.match(result.stdout, /reference proxy: .*thalla_chibi_turnaround\.reference\.png/);
  assert.match(result.stdout, /reference imagegen skipped: yes/);
  assert.match(result.stdout, /source gate:/);
  assert.match(result.stdout, /status: blocked_reference_proxy_palette_audit_failed/);
  assert.match(result.stdout, /source sha256: 19eb3f1abc5bbaba1e88eb36c8ca308353f0e0d756528cbbddfc05430bb868fa/);
  assert.match(result.stdout, /reference proxy sha256: 8eb95c9f5a96439affccd6795bfff846a6128bc631a02ccddeccfe04743a75ec/);
  assert.match(result.stdout, /palette evidence: significant exact 31\/20, minor 98, coarse32 significant 57/);
  assert.match(result.stdout, /action: Do not rerun this exact supplied source hash/);
  assert.match(result.stdout, /Style references \(visual review only\):/);
  assert.match(result.stdout, /not an active imagegen input in supplied local-source mode/);
  assert.match(result.stdout, /Commands after sourceGate is cleared \(do not run for the blocked source hash\):/);
  assert.match(result.stdout, /preflight: npm run game:home-field:preflight-chibi-proof -- --source=/);
  assert.match(result.stdout, /archiveStale: npm run game:home-field:archive-stale-chibi-proof -- thalla --source=/);
  assert.match(result.stdout, /stageLocalSource: npm run game:home-field:stage-chibi-local-source -- --source=/);
  assert.doesNotMatch(result.stdout, /preflightLocalSource:/);
  assert.doesNotMatch(result.stdout, /archiveStaleLocalSource:/);
  assert.doesNotMatch(result.stdout, /referenceApiProof:/);
  assert.match(result.stdout, /active mode: supplied local 8x4 source ->/);
  assert.match(result.stdout, /state sheet generation: skipped; staged from supplied source/);
  assert.match(result.stdout, /Do not run reference imagegen, built-in imagegen, or paid API fallback in the default local-source run/);
  assert.match(result.stdout, /supplied source path and sha256/);
  assert.match(result.stdout, /archive result and staged local-source provenance manifest/);
  assert.match(result.stdout, /that no app-facing PNG was overwritten/);
  assert.match(result.stdout, /final response must report:/i);
});

test('[home-field] generation queue printer shows fallback history only on request', () => {
  const result = spawnSync(process.execPath, [
    generationQueueScriptPath,
    '--id=thalla-stage1-chibi-proof',
    '--show-fallbacks'
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Inactive\/fallback methods \(\-\-show-fallbacks\):/);
  assert.match(result.stdout, /Built-in imagegen same-context reference staging/);
  assert.match(result.stdout, /status: exhausted/);
  assert.match(result.stdout, /default visibility: hidden; print with --show-fallbacks/);
  assert.match(result.stdout, /flags: HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1/);
  assert.match(result.stdout, /reference staging: Load all 3 referenceInputs PNGs with view_image/);
  assert.match(result.stdout, /method gate:/);
  assert.match(result.stdout, /status: blocked_builtin_same_context_reference_staging_exhausted/);
  assert.match(result.stdout, /91 significant exact colors/);
  assert.match(result.stdout, /Paid API reference fallback/);
  assert.match(result.stdout, /paid API fallback env:/);
  assert.match(result.stdout, /fallback keys: OPENAI_IMAGEGEN_API_KEY/);
  assert.match(result.stdout, /paid fallback also requires HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1/);
  assert.match(result.stdout, /plain OPENAI_API_KEY is ignored/);
  assert.match(result.stdout, /referenceApiProof: npm run game:home-field:chibi-reference-api-proof -- --env-file=<explicit-env-file>/);
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
  assert.equal(pkg.scripts['game:home-field:stage-chibi-local-source'], 'node app/scripts/stage-home-field-chibi-local-source.js');
  assert.equal(pkg.scripts['game:home-field:generation-queue'], 'node app/scripts/print-home-field-generation-queue.js');
  assert.equal(pkg.scripts['game:home-field:recover-chibi-alpha'], 'node app/scripts/recover-home-field-chibi-alpha.js');
  assert.equal(pkg.scripts['game:home-field:record-chibi-verdict'], 'node app/scripts/record-home-field-chibi-verdict.js');
  assert.equal(pkg.scripts['shrink:screenshots'], 'bash ../bash/shrink-screenshots.sh');
});

test('[home-field] chibi local state-sheet source staging writes proof paths and provenance', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-local-source-stage-test');
  const sourcePath = path.join(fixtureDir, 'supplied-thalla-states.png');
  const statePath = path.join(repoRoot, '.agent/home-field-workspace/raw/thalla_chibi.states.source.png');
  const referencePath = path.join(repoRoot, '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png');
  const provenancePath = path.join(repoRoot, '.agent/home-field-workspace/review/thalla-local-state-sheet-source.manifest.json');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeChibiSpritesheet(sourcePath);

  return withPreservedFiles([statePath, referencePath, provenancePath], () => {
    try {
      const result = spawnSync(process.execPath, [chibiStageLocalSourceScriptPath, `--source=${sourcePath}`], {
        cwd: repoRoot,
        encoding: 'utf8'
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /home-field chibi local source stage: PASS/);
      assert.match(result.stdout, /reference proxy/);
      assert.equal(fileSha256(statePath), fileSha256(sourcePath));
      const manifest = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
      assert.equal(manifest.mode, 'supplied-complete-8x4-local-state-sheet');
      assert.equal(manifest.source.path, sourcePath);
      assert.equal(manifest.source.width, 512);
      assert.equal(manifest.source.height, 256);
      assert.equal(manifest.source.cellWidth, 64);
      assert.equal(manifest.referenceProxy.productionGeneratedReference, false);
      assert.match(manifest.referenceProxy.sha256, /^[a-f0-9]{64}$/);

      const referenceVerify = spawnSync(process.execPath, [chibiVerifyScriptPath, '--reference'], {
        cwd: repoRoot,
        encoding: 'utf8'
      });
      assert.equal(referenceVerify.status, 0, referenceVerify.stderr || referenceVerify.stdout);
      assert.match(referenceVerify.stdout, /Reference sprite-box occupancy: 4 major blob/);

      const stateVerify = spawnSync(process.execPath, [chibiVerifyScriptPath, '--state-sheet'], {
        cwd: repoRoot,
        encoding: 'utf8'
      });
      assert.equal(stateVerify.status, 0, stateVerify.stderr || stateVerify.stdout);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
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

test('[home-field] record chibi verdict accepts reason text from stdin', () => {
  const reviewPath = path.join(repoRoot, 'docs/home-field-asset-review.json');
  return withPreservedFile(reviewPath, () => {
    const fixtureDir = path.join(repoRoot, 'tmp/home-field-record-chibi-verdict-stdin-test');
    const manifestPath = path.join(fixtureDir, 'candidate-evidence.manifest.json');
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      generatedAt: '2026-07-02T00:00:00.000Z',
      candidateRoot: '.agent/home-field-workspace/candidates/chibi-active-roster/latest',
      ids: ['thalla'],
      entries: [{
        id: 'thalla',
        candidateOutput: { path: 'candidate/spritesheet.png', sha256: 'a'.repeat(64) },
        rawSource: { path: 'raw/thalla_chibi.states.source.png', sha256: 'b'.repeat(64) },
        chibiSources: {
          reference: { path: 'reference/thalla_chibi_turnaround.reference.png', sha256: 'c'.repeat(64) }
        }
      }],
      previews: [],
      manifestSha256: 'd'.repeat(64)
    }, null, 2));

    try {
      const result = spawnSync(process.execPath, [
        recordChibiVerdictScriptPath,
        'thalla',
        '--verdict=needs_review',
        '--reason-stdin',
        `--manifest=${path.relative(repoRoot, manifestPath)}`
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
        input: 'Visual critic: stdin reason avoids ignored scratch-file placement.'
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8')).assets.find((entry) => entry.id === 'thalla');
      assert.equal(review.verdict, 'needs_review');
      assert.equal(review.reason, 'Visual critic: stdin reason avoids ignored scratch-file placement.');
      assert.equal(review.candidateSha256, 'a'.repeat(64));
      assert.equal(review.rawSourceSha256, 'b'.repeat(64));
      assert.equal(review.referenceSha256, 'c'.repeat(64));
      assert.equal(review.candidateEvidenceSha256, 'd'.repeat(64));
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});

test('[home-field] record chibi verdict rejects stale default tmp candidate evidence', () => {
  const reviewPath = path.join(repoRoot, 'docs/home-field-asset-review.json');
  const manifestPath = path.join(repoRoot, '.agent/home-field-workspace/review/candidate-evidence.manifest.json');
  return withPreservedFiles([reviewPath, manifestPath], () => {
    const fixtureDir = path.join(repoRoot, 'tmp/home-field-record-chibi-verdict-stale-default-test');
    const reasonPath = path.join(fixtureDir, 'reason.txt');
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(reasonPath, 'Visual critic: do not trust stale tmp evidence.');
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      generatedAt: '2026-07-02T16:03:51.622Z',
      candidateRoot: 'tmp/home-field-chibi-stale-notes-candidates',
      ids: ['thalla'],
      entries: [{
        id: 'thalla',
        candidateOutput: { path: 'tmp/home-field-chibi-stale-notes-candidates/web/public/home-field/characters/thalla/spritesheet.png', sha256: '1'.repeat(64) },
        rawSource: { path: 'tmp/home-field-chibi-stale-notes-candidates/raw/thalla_chibi.states.source.png', sha256: '2'.repeat(64) },
        chibiSources: {
          reference: { path: '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png', sha256: '3'.repeat(64) }
        }
      }],
      manifestSha256: '4'.repeat(64)
    }, null, 2));
    const reviewBefore = fs.readFileSync(reviewPath, 'utf8');

    try {
      const result = spawnSync(process.execPath, [
        recordChibiVerdictScriptPath,
        'thalla',
        '--verdict=needs_review',
        `--reason-file=${path.relative(repoRoot, reasonPath)}`
      ], {
        cwd: repoRoot,
        encoding: 'utf8'
      });

      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.match(result.stderr, /candidateRoot must be \.agent\/home-field-workspace\/candidates\/chibi-active-roster\/latest/);
      assert.match(result.stderr, /HOME_FIELD_CANDIDATE_ROOT=\.agent\/home-field-workspace\/candidates\/chibi-active-roster\/latest/);
      assert.equal(fs.readFileSync(reviewPath, 'utf8'), reviewBefore);
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

    writeCrispChibiSpritesheet(outputAbs, { detachedMarks: true });
    const failedDetachedMarks = spawnSync(process.execPath, [
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
    assert.equal(failedDetachedMarks.status, 1, failedDetachedMarks.stderr || failedDetachedMarks.stdout);
    assert.match(failedDetachedMarks.stderr, /detached_non_character_marks/);
    assert.match(failedDetachedMarks.stderr, /motion\/action lines, squiggle marks, speed lines/);

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
  assert.match(result.stderr, /supplied local proof source PNG path outside docs\/reference/);
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
  const result = spawnSync(process.execPath, [chibiPreflightScriptPath, `--source=${checkedInReference}`], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: '',
      OPENAI_IMAGEGEN_API_KEY: '',
      HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
      HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
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

test('[home-field] chibi proof preflight accepts supplied local source argument', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-preflight-test');
  const localInput = path.join(fixtureDir, 'thalla-reference.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeTinyTransparentFixture(localInput);

  try {
    const result = spawnSync(process.execPath, [chibiPreflightScriptPath, `--source=${localInput}`], {
      cwd: repoRoot,
      env: {
        ...process.env,
        OPENAI_API_KEY: '',
        OPENAI_IMAGEGEN_API_KEY: '',
        HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
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

test('[home-field] chibi proof preflight blocks a source matching queue sourceGate hash', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-preflight-source-gate-test');
  const localInput = path.join(fixtureDir, 'thalla-states.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeChibiSpritesheet(localInput);

  return withPreservedFile(homeFieldGenerationQueuePath, () => {
    try {
      const queue = JSON.parse(fs.readFileSync(homeFieldGenerationQueuePath, 'utf8'));
      const item = queue.items.find((entry) => entry.id === 'thalla-stage1-chibi-proof');
      item.sourceGate = {
        rollout: 'test-rollout',
        status: 'blocked_reference_proxy_palette_audit_failed',
        sourcePath: path.relative(repoRoot, localInput),
        sourceSha256: fileSha256(localInput),
        referenceProxyPath: '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png',
        referenceProxySha256: '8eb95c9f5a96439affccd6795bfff846a6128bc631a02ccddeccfe04743a75ec',
        failedCommand: 'npm run game:home-field:palette-audit -- <fixture> --fail-on-bloat',
        evidence: {
          exactColorsAtLeastSignificantThreshold: 31,
          targetMaxSignificantExactColors: 20,
          exactColorsAtLeastMinorThreshold: 98,
          coarseStep32SignificantBins: 57
        },
        action: 'Do not rerun this exact supplied source hash.'
      };
      fs.writeFileSync(homeFieldGenerationQueuePath, `${JSON.stringify(queue, null, 2)}\n`);

      const result = spawnSync(process.execPath, [chibiPreflightScriptPath, `--source=${localInput}`], {
        cwd: repoRoot,
        env: {
          ...process.env,
          OPENAI_API_KEY: '',
          OPENAI_IMAGEGEN_API_KEY: '',
          HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
          HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
          HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
          HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '1',
          HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: '1'
        },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.match(result.stdout, /Queue local-source gate:/);
      assert.match(result.stdout, /status: blocked_reference_proxy_palette_audit_failed/);
      assert.match(result.stdout, /current --source hash blocked: yes/);
      assert.match(result.stdout, /Output capability: skipped because the current --source hash is blocked by the queue local-source gate/);
      assert.doesNotMatch(result.stdout, /OPENAI_IMAGEGEN_API_KEY|API fallback ready|built-in Codex Desktop imagegen/);
      assert.match(result.stderr, /supplied --source PNG matches a queue-recorded failed local-source hash/);
      assert.match(result.stderr, /Do not archive, stage, split, produce, validate, evidence, preview, record a verdict, run imagegen, or overwrite app-facing PNGs/);
      assert.match(result.stderr, /replace the source with a new authored source or explicitly adopt a documented secondary repair method first/);
      assert.doesNotMatch(result.stderr, /OPENAI_IMAGEGEN_API_KEY|HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE|Plain OPENAI_API_KEY|built-in imagegen/);
      assert.doesNotMatch(result.stdout, /Preflight passed/);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});

test('[home-field] chibi proof preflight blocks a source matching exhausted repair hash', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-preflight-exhausted-repair-test');
  const localInput = path.join(fixtureDir, 'thalla-repair-states.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeChibiSpritesheet(localInput);

  return withPreservedFile(homeFieldGenerationQueuePath, () => {
    try {
      const queue = JSON.parse(fs.readFileSync(homeFieldGenerationQueuePath, 'utf8'));
      const item = queue.items.find((entry) => entry.id === 'thalla-stage1-chibi-proof');
      item.sourceGateRecovery = {
        ...item.sourceGateRecovery,
        exhaustedRepairSources: [{
          path: path.relative(repoRoot, localInput),
          sourceSha256: fileSha256(localInput),
          candidatePath: '.agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png',
          candidateSha256: chibiExhaustedRepairCandidateSha256,
          verdict: 'needs_regen',
          rollout: 'test-rollout',
          commit: 'test-commit',
          reason: 'Do not rerun this exhausted repair source as another production attempt; it is not production-ready.'
        }]
      };
      fs.writeFileSync(homeFieldGenerationQueuePath, `${JSON.stringify(queue, null, 2)}\n`);

      const result = spawnSync(process.execPath, [chibiPreflightScriptPath, `--source=${localInput}`], {
        cwd: repoRoot,
        env: {
          ...process.env,
          OPENAI_API_KEY: '',
          OPENAI_IMAGEGEN_API_KEY: '',
          HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
          HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
          HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
          HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '1',
          HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: '1'
        },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.match(result.stdout, /Queue local-source gate:/);
      assert.match(result.stdout, /current --source hash blocked: no/);
      assert.match(result.stdout, /current --source exhausted repair: yes/);
      assert.match(result.stdout, /exhausted repair sources:/);
      assert.match(result.stdout, new RegExp(fileSha256(localInput)));
      assert.match(result.stdout, new RegExp(chibiExhaustedRepairCandidateSha256));
      assert.match(result.stdout, /Output capability: skipped because the current --source hash is listed as an exhausted repair source/);
      assert.match(result.stderr, /supplied --source PNG matches a queue-recorded exhausted repair source/);
      assert.match(result.stderr, /Do not archive, stage, split, produce, validate, evidence, preview, record a verdict, run imagegen, or overwrite app-facing PNGs/);
      assert.match(result.stderr, /Exhausted repair source sha256:/);
      assert.match(result.stderr, /Exhausted repair candidate sha256:/);
      assert.match(result.stderr, /source\/candidate hashes are not listed as exhausted/);
      assert.match(result.stderr, /new authored source or a stronger explicit repair method first/);
      assert.doesNotMatch(result.stderr, /OPENAI_IMAGEGEN_API_KEY|HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE|Plain OPENAI_API_KEY|built-in imagegen/);
      assert.doesNotMatch(result.stdout, /Preflight passed/);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});

test('[home-field] chibi proof preflight identifies supplied complete local state sheet', () => {
  const fixtureDir = path.join(repoRoot, 'tmp/home-field-chibi-preflight-state-sheet-test');
  const localInput = path.join(fixtureDir, 'thalla-states.png');
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  writeChibiSpritesheet(localInput);

  try {
    const result = spawnSync(process.execPath, [chibiPreflightScriptPath, `--source=${localInput}`], {
      cwd: repoRoot,
      env: {
        ...process.env,
        OPENAI_API_KEY: '',
        OPENAI_IMAGEGEN_API_KEY: '',
        HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE: '',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE: '',
        HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES: '',
        HOME_FIELD_REQUIRE_EXPLICIT_IMAGE_OUTPUT: '1',
        HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN: '1'
      },
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Preflight passed/);
    assert.match(result.stdout, /local image inputs supplied: 1/);
    assert.match(result.stdout, /complete 8x4 state sheet: yes \(64x64 cells\)/);
    assert.match(result.stdout, /local complete state-sheet staging command: npm run game:home-field:stage-chibi-local-source/);
    assert.match(result.stdout, /skip reference imagegen and the exhausted built-in reference-staging path/);
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
  const result = spawnSync(process.execPath, [nextScriptPath, '--family=grass'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Generation mode: shared grass-family meadow source/);
  assert.match(result.stdout, /grass_family_meadow\.source\.png/);
  assert.match(result.stdout, /npm run game:home-field:produce-family -- --family=grass --candidate/);
  assert.match(result.stdout, /candidate game home-field bitmap/);
  assert.match(result.stdout, /--plan=lower-band/);
  assert.match(result.stdout, /Home Field scale contract/);
  assert.match(result.stdout, /Do not change zoom level between crop zones/);
  assert.match(result.stdout, /game:home-field:grass-family-sheet/);
  assert.match(result.stdout, /Do not save separate per-tile raw PNGs/);
});
