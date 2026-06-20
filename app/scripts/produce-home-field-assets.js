#!/usr/bin/env node
/**
 * Process raw imagegen output into the app-facing PNG for one or more home-field assets.
 *
 * Usage:
 *   npm run game:home-field:produce -- grass_base_01 grass_base_02
 *   npm run game:home-field:produce -- --all-missing
 *   npm run game:home-field:produce -- bush_cluster_dark_01 --candidate
 *
 * Behavior per asset:
 *   1. Read .agent/home-field-workspace/raw/<id>.source.png.
 *   2. Optionally remove a chroma-key background (default: no chroma-key; imagegen
 *      should return transparent PNG. Pass --chroma-key=#ff00ff to force removal).
 *   3. Validate dimensions match home-field-assets.json.
 *   4. Write the deterministic PNG to the asset's outputPath (under web/public/home-field/)
 *      or, with --candidate, under .agent/home-field-workspace/candidates/object-layer/latest.
 *
 * This script does NOT call imagegen. It assumes imagegen output already exists at the
 * raw source path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  encodeDeterministicPng,
  readPngAsRgba,
  readPngRgba,
  alphaStats
} from './lib/bitmap-image-toolkit.js';
import { validateAssets } from '../shared/home-field/home-field-validator.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = process.env.HOME_FIELD_ASSETS_PATH
  ? path.resolve(process.env.HOME_FIELD_ASSETS_PATH)
  : path.join(sharedDir, 'home-field-assets.json');
const workspace = process.env.HOME_FIELD_WORKSPACE
  ? path.resolve(process.env.HOME_FIELD_WORKSPACE)
  : path.join(repoRoot, '.agent', 'home-field-workspace');
const manifestDir = path.join(workspace, 'manifests');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseArgs(argv) {
  const ids = [];
  let chromaKey = null;
  let allMissing = false;
  let candidate = false;
  let candidateRoot = path.join(workspace, 'candidates', 'object-layer', 'latest');
  let resize = null;
  let seamlessTerrain = false;
  let cropCenter = null;
  let quietTerrain = null;
  for (const arg of argv) {
    if (arg === '--all-missing') allMissing = true;
    else if (arg === '--candidate') candidate = true;
    else if (arg.startsWith('--candidate-root=')) {
      candidate = true;
      candidateRoot = path.resolve(repoRoot, arg.slice('--candidate-root='.length));
    }
    else if (arg === '--resize') resize = 'lanczos';
    else if (arg === '--resize-nearest') resize = 'nearest';
    else if (arg === '--seamless-terrain') seamlessTerrain = true;
    else if (arg === '--crop-center') cropCenter = 0.82;
    else if (arg.startsWith('--crop-center=')) cropCenter = Number(arg.slice('--crop-center='.length));
    else if (arg === '--quiet-terrain') quietTerrain = 0.35;
    else if (arg.startsWith('--quiet-terrain=')) quietTerrain = Number(arg.slice('--quiet-terrain='.length));
    else if (arg.startsWith('--chroma-key=')) chromaKey = arg.slice('--chroma-key='.length);
    else ids.push(arg.replace(/\.png$/, ''));
  }
  if (cropCenter !== null && (!Number.isFinite(cropCenter) || cropCenter <= 0 || cropCenter > 1)) {
    throw new Error('--crop-center must be a number in the range (0, 1]');
  }
  if (quietTerrain !== null && (!Number.isFinite(quietTerrain) || quietTerrain < 0 || quietTerrain > 1)) {
    throw new Error('--quiet-terrain must be a number in the range [0, 1]');
  }
  return { ids, chromaKey, allMissing, candidate, candidateRoot, resize, seamlessTerrain, cropCenter, quietTerrain };
}

function resizeRgba(srcImage, dstWidth, dstHeight, mode) {
  const { width: sw, height: sh, rgba: src } = srcImage;
  const dst = Buffer.alloc(dstWidth * dstHeight * 4);
  const xRatio = sw / dstWidth;
  const yRatio = sh / dstHeight;
  if (mode === 'nearest') {
    for (let y = 0; y < dstHeight; y += 1) {
      const sy = Math.min(sh - 1, Math.floor(y * yRatio));
      for (let x = 0; x < dstWidth; x += 1) {
        const sx = Math.min(sw - 1, Math.floor(x * xRatio));
        const si = (sy * sw + sx) * 4;
        const di = (y * dstWidth + x) * 4;
        dst[di + 0] = src[si + 0];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      }
    }
    return { width: dstWidth, height: dstHeight, rgba: dst };
  }
  // Box-average downscale (cheap "lanczos-like" for downscaling). For upscaling fall
  // back to nearest to keep this dependency-free; we shouldn't need to upscale.
  if (sw < dstWidth || sh < dstHeight) {
    return resizeRgba(srcImage, dstWidth, dstHeight, 'nearest');
  }
  for (let y = 0; y < dstHeight; y += 1) {
    const sy0 = Math.floor(y * yRatio);
    const sy1 = Math.min(sh, Math.ceil((y + 1) * yRatio));
    for (let x = 0; x < dstWidth; x += 1) {
      const sx0 = Math.floor(x * xRatio);
      const sx1 = Math.min(sw, Math.ceil((x + 1) * xRatio));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = sy0; yy < sy1; yy += 1) {
        for (let xx = sx0; xx < sx1; xx += 1) {
          const si = (yy * sw + xx) * 4;
          r += src[si + 0];
          g += src[si + 1];
          b += src[si + 2];
          a += src[si + 3];
          n += 1;
        }
      }
      const di = (y * dstWidth + x) * 4;
      dst[di + 0] = Math.round(r / n);
      dst[di + 1] = Math.round(g / n);
      dst[di + 2] = Math.round(b / n);
      dst[di + 3] = Math.round(a / n);
    }
  }
  return { width: dstWidth, height: dstHeight, rgba: dst };
}

function cropCenterRgba(srcImage, ratio) {
  if (!ratio || ratio >= 1) return srcImage;
  const cropSize = Math.max(1, Math.floor(Math.min(srcImage.width, srcImage.height) * ratio));
  const startX = Math.floor((srcImage.width - cropSize) / 2);
  const startY = Math.floor((srcImage.height - cropSize) / 2);
  const rgba = Buffer.alloc(cropSize * cropSize * 4);
  for (let y = 0; y < cropSize; y += 1) {
    const srcOff = ((startY + y) * srcImage.width + startX) * 4;
    const dstOff = y * cropSize * 4;
    srcImage.rgba.copy(rgba, dstOff, srcOff, srcOff + cropSize * 4);
  }
  return { width: cropSize, height: cropSize, rgba };
}

function smootherstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function blendPixelPair(rgba, width, leftIndex, rightIndex, edgeWeight) {
  for (let c = 0; c < 4; c += 1) {
    const avg = Math.round((rgba[leftIndex + c] + rgba[rightIndex + c]) / 2);
    rgba[leftIndex + c] = Math.round(rgba[leftIndex + c] * (1 - edgeWeight) + avg * edgeWeight);
    rgba[rightIndex + c] = Math.round(rgba[rightIndex + c] * (1 - edgeWeight) + avg * edgeWeight);
  }
}

function makeTerrainSeamless(image, margin = 48) {
  const { width, height } = image;
  const rgba = Buffer.from(image.rgba);
  const edge = Math.max(1, Math.min(margin, Math.floor(Math.min(width, height) / 3)));

  for (let y = 0; y < height; y += 1) {
    for (let d = 0; d < edge; d += 1) {
      const edgeWeight = 1 - smootherstep(d / edge);
      const leftIndex = (y * width + d) * 4;
      const rightIndex = (y * width + (width - 1 - d)) * 4;
      blendPixelPair(rgba, width, leftIndex, rightIndex, edgeWeight);
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let d = 0; d < edge; d += 1) {
      const edgeWeight = 1 - smootherstep(d / edge);
      const topIndex = (d * width + x) * 4;
      const bottomIndex = ((height - 1 - d) * width + x) * 4;
      blendPixelPair(rgba, width, topIndex, bottomIndex, edgeWeight);
    }
  }

  return { width, height, rgba };
}

function quietTerrainContrast(image, amount) {
  if (!amount) return image;
  let r = 0;
  let g = 0;
  let b = 0;
  const count = image.width * image.height;
  for (let i = 0; i < image.rgba.length; i += 4) {
    r += image.rgba[i + 0];
    g += image.rgba[i + 1];
    b += image.rgba[i + 2];
  }
  const avg = [r / count, g / count, b / count];
  const rgba = Buffer.from(image.rgba);
  for (let i = 0; i < rgba.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      rgba[i + c] = Math.round(rgba[i + c] * (1 - amount) + avg[c] * amount);
    }
  }
  return { width: image.width, height: image.height, rgba };
}

function sampleAverageRgb(image, x0, y0, w, h) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = y0; y < y0 + h; y += 1) {
    if (y < 0 || y >= image.height) continue;
    for (let x = x0; x < x0 + w; x += 1) {
      if (x < 0 || x >= image.width) continue;
      const i = (y * image.width + x) * 4;
      r += image.rgba[i + 0];
      g += image.rgba[i + 1];
      b += image.rgba[i + 2];
      count += 1;
    }
  }
  return count > 0 ? [r / count, g / count, b / count] : [0, 0, 0];
}

function rgbDistance(a, b) {
  return Math.sqrt(
    ((a[0] - b[0]) ** 2)
    + ((a[1] - b[1]) ** 2)
    + ((a[2] - b[2]) ** 2)
  );
}

function detectOpaqueCheckerboardMatte(image) {
  const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
  if (stats.coverage < 0.985) return null;

  const s = Math.max(4, Math.floor(Math.min(image.width, image.height) * 0.08));
  const corners = [
    sampleAverageRgb(image, 0, 0, s, s),
    sampleAverageRgb(image, image.width - s, 0, s, s),
    sampleAverageRgb(image, 0, image.height - s, s, s),
    sampleAverageRgb(image, image.width - s, image.height - s, s, s)
  ];
  const distances = [
    rgbDistance(corners[0], corners[1]),
    rgbDistance(corners[0], corners[2]),
    rgbDistance(corners[1], corners[3]),
    rgbDistance(corners[2], corners[3])
  ];
  const maxDistance = Math.max(...distances);
  const avgBrightness = corners
    .map((c) => (c[0] + c[1] + c[2]) / 3)
    .reduce((sum, v) => sum + v, 0) / corners.length;
  if (maxDistance >= 10 && maxDistance <= 70 && avgBrightness >= 70 && avgBrightness <= 210) {
    return `opaque checkerboard-like matte detected in corners (max RGB distance ${maxDistance.toFixed(1)}); regenerate on a flat chroma-key background or pass --chroma-key`;
  }
  return null;
}

function chromaKeyScriptPath() {
  const candidate = path.join(
    process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex'),
    'skills',
    '.system',
    'imagegen',
    'scripts',
    'remove_chroma_key.py'
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function pythonBin() {
  const bundled = path.join(
    process.env.HOME || '',
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'python',
    'bin',
    'python3'
  );
  return process.env.PYTHON || (fs.existsSync(bundled) ? bundled : 'python3');
}

function runChromaKey(rawPath, outPath, keyColor) {
  const script = chromaKeyScriptPath();
  if (!script) {
    console.warn(`  chroma-key requested but script not found at ${script}; copying raw to staging instead.`);
    fs.copyFileSync(rawPath, outPath);
    return;
  }
  const result = spawnSync(
    pythonBin(),
    [
      script,
      '--input',
      rawPath,
      '--out',
      outPath,
      '--key-color',
      keyColor,
      '--soft-matte',
      '--despill',
      '--force'
    ],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    throw new Error(`chroma-key script exited with status ${result.status}`);
  }
}

function findFrameRaws(sourcePath) {
  const dir = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath, '.source.png');
  const absDir = path.join(repoRoot, dir);
  if (!fs.existsSync(absDir)) return [];
  const re = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.frame_(\\d+)\\.source\\.png$`);
  const matches = fs
    .readdirSync(absDir)
    .map((f) => {
      const m = f.match(re);
      return m ? { file: path.join(dir, f), index: Number(m[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
  return matches;
}

function composeStrip(frameFiles, frameWidth, frameHeight, opts = {}) {
  const stripWidth = frameWidth * frameFiles.length;
  const stripHeight = frameHeight;
  const stripRgba = Buffer.alloc(stripWidth * stripHeight * 4);

  for (let f = 0; f < frameFiles.length; f += 1) {
    let frame = readPngAsRgba(path.join(repoRoot, frameFiles[f].file));
    if (frame.width !== frameWidth || frame.height !== frameHeight) {
      if (opts.resize) {
        frame = resizeRgba(frame, frameWidth, frameHeight, opts.resize);
      } else {
        throw new Error(`frame ${frameFiles[f].file} is ${frame.width}x${frame.height}, expected ${frameWidth}x${frameHeight} (pass --resize to scale)`);
      }
    }
    for (let y = 0; y < frameHeight; y += 1) {
      const srcOff = y * frameWidth * 4;
      const dstOff = (y * stripWidth + f * frameWidth) * 4;
      frame.rgba.copy(stripRgba, dstOff, srcOff, srcOff + frameWidth * 4);
    }
  }
  return { width: stripWidth, height: stripHeight, rgba: stripRgba };
}

function outputAbsFor(entry, opts) {
  return opts.candidate
    ? path.join(opts.candidateRoot, entry.outputPath)
    : path.join(repoRoot, entry.outputPath);
}

function outputLabelFor(entry, opts) {
  return opts.candidate
    ? path.relative(repoRoot, path.join(opts.candidateRoot, entry.outputPath))
    : entry.outputPath;
}

function processStaticEntry(entry, opts) {
  const rawAbs = path.join(repoRoot, entry.sourcePath);
  const outAbs = outputAbsFor(entry, opts);
  ensureDir(path.dirname(outAbs));

  if (!fs.existsSync(rawAbs)) {
    return { id: entry.id, ok: false, reason: `raw missing: ${entry.sourcePath}` };
  }

  const stagedPath = path.join(workspace, 'processed', `${entry.id}.staged.png`);
  ensureDir(path.dirname(stagedPath));

  if (opts.chromaKey) {
    runChromaKey(rawAbs, stagedPath, opts.chromaKey);
  } else {
    fs.copyFileSync(rawAbs, stagedPath);
  }

  let image = readPngAsRgba(stagedPath);
  if (opts.cropCenter && entry.type === 'terrain') {
    image = cropCenterRgba(image, opts.cropCenter);
  }
  if (image.width !== entry.width || image.height !== entry.height) {
    if (opts.resize) {
      image = resizeRgba(image, entry.width, entry.height, opts.resize);
    } else {
      return {
        id: entry.id,
        ok: false,
        reason: `dimensions mismatch: file ${image.width}x${image.height}, expected ${entry.width}x${entry.height} (pass --resize or --resize-nearest to scale)`
      };
    }
  }
  if (opts.seamlessTerrain && entry.type === 'terrain') {
    image = makeTerrainSeamless(image);
  }
  if (opts.quietTerrain && entry.type === 'terrain') {
    image = quietTerrainContrast(image, opts.quietTerrain);
  }

  let alphaSummary = null;
  if (entry.type !== 'terrain') {
    const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
    alphaSummary = `coverage=${(stats.coverage * 100).toFixed(1)}%`;
    if (stats.coverage > 0.985) {
      const matteReason = detectOpaqueCheckerboardMatte(image);
      return { id: entry.id, ok: false, reason: matteReason || `no transparency detected; alpha coverage ${alphaSummary}` };
    }
  }

  const encoded = encodeDeterministicPng({
    width: image.width,
    height: image.height,
    rgba: image.rgba
  });
  fs.writeFileSync(outAbs, encoded);

  return { id: entry.id, ok: true, output: outputLabelFor(entry, opts), alpha: alphaSummary, mode: 'static' };
}

function processAnimatedEntry(entry, opts) {
  const a = entry.animation;
  if (!a) return processStaticEntry(entry, opts);

  const rawAbs = path.join(repoRoot, entry.sourcePath);
  const frameFiles = findFrameRaws(entry.sourcePath);

  if (frameFiles.length === 0) {
    if (fs.existsSync(rawAbs)) {
      // Raw is a pre-composed strip; treat as static and let dimension check handle it.
      return processStaticEntry(entry, opts);
    }
    return {
      id: entry.id,
      ok: false,
      reason: `no raw frames found at ${path.dirname(entry.sourcePath)}/${path.basename(entry.sourcePath, '.source.png')}.frame_NN.source.png and no pre-composed strip at ${entry.sourcePath}`
    };
  }

  if (frameFiles.length !== a.frames) {
    return {
      id: entry.id,
      ok: false,
      reason: `expected ${a.frames} frame files, found ${frameFiles.length}`
    };
  }

  let strip;
  try {
    strip = composeStrip(frameFiles, a.frameWidth, a.frameHeight, { resize: opts.resize });
  } catch (err) {
    return { id: entry.id, ok: false, reason: err.message };
  }

  if (strip.width !== entry.width || strip.height !== entry.height) {
    return {
      id: entry.id,
      ok: false,
      reason: `composed strip ${strip.width}x${strip.height} != expected ${entry.width}x${entry.height}`
    };
  }

  const outAbs = outputAbsFor(entry, opts);
  ensureDir(path.dirname(outAbs));
  fs.writeFileSync(outAbs, encodeDeterministicPng(strip));

  // Alpha sanity (effects must be transparent).
  const stats = alphaStats({ width: strip.width, height: strip.height, rgba: strip.rgba }, { x: 0, y: 0, width: strip.width, height: strip.height });
  const alphaSummary = `coverage=${(stats.coverage * 100).toFixed(1)}%`;
  if (stats.coverage > 0.985) {
    return { id: entry.id, ok: false, reason: `composed strip has no transparency; alpha ${alphaSummary}` };
  }

  return { id: entry.id, ok: true, output: outputLabelFor(entry, opts), alpha: alphaSummary, mode: `frames(${a.frames})` };
}

function processEntry(entry, opts) {
  if (entry.type === 'character' && entry.spritesheet) return processCharacterPlaceholder(entry, opts);
  if (entry.animation) return processAnimatedEntry(entry, opts);
  return processStaticEntry(entry, opts);
}

function characterEntryToAsset(c) {
  return {
    id: c.id,
    type: 'character',
    sourcePath: c.sourcePath,
    outputPath: c.outputPath,
    width: c.spritesheet.width,
    height: c.spritesheet.height,
    spritesheet: c.spritesheet
  };
}

function copyFrameInto(targetRgba, targetWidth, frame, dstRow, dstCol, frameWidth, frameHeight) {
  for (let y = 0; y < frameHeight; y += 1) {
    const srcOff = y * frameWidth * 4;
    const dstOff = ((dstRow * frameHeight + y) * targetWidth + dstCol * frameWidth) * 4;
    frame.rgba.copy(targetRgba, dstOff, srcOff, srcOff + frameWidth * 4);
  }
}

function processCharacterPlaceholder(entry, opts = {}) {
  const s = entry.spritesheet;
  const baseName = path.basename(entry.sourcePath, '.source.png'); // e.g. _placeholder_chibi
  const dir = path.dirname(entry.sourcePath);
  const rawDir = path.join(repoRoot, dir);
  if (!fs.existsSync(rawDir)) {
    return { id: entry.id, ok: false, reason: `raw dir missing: ${dir}` };
  }

  const required = [
    { row: 0, col: 0, file: `${baseName}.frame_idle_down_0.source.png` },
    { row: 0, col: 1, file: `${baseName}.frame_idle_down_1.source.png` },
    { row: 0, col: 'walk', file: `${baseName}.frame_walk_down.source.png` },
    { row: 1, col: 0, file: `${baseName}.frame_idle_up_0.source.png` },
    { row: 1, col: 1, file: `${baseName}.frame_idle_up_1.source.png` },
    { row: 1, col: 'walk', file: `${baseName}.frame_walk_up.source.png` },
    { row: 2, col: 0, file: `${baseName}.frame_idle_left_0.source.png` },
    { row: 2, col: 1, file: `${baseName}.frame_idle_left_1.source.png` },
    { row: 2, col: 'walk', file: `${baseName}.frame_walk_left.source.png` },
    { row: 3, col: 0, file: `${baseName}.frame_idle_right_0.source.png` },
    { row: 3, col: 1, file: `${baseName}.frame_idle_right_1.source.png` },
    { row: 3, col: 'walk', file: `${baseName}.frame_walk_right.source.png` }
  ];

  const missing = required.filter((r) => !fs.existsSync(path.join(rawDir, r.file)));
  if (missing.length > 0) {
    return {
      id: entry.id,
      ok: false,
      reason: `missing ${missing.length} placeholder frame(s): ${missing.map((m) => m.file).join(', ')}`
    };
  }

  const sheetRgba = Buffer.alloc(s.width * s.height * 4);
  for (const r of required) {
    let frame = readPngRgba(path.join(rawDir, r.file));
    if (frame.width !== s.frameWidth || frame.height !== s.frameHeight) {
      if (opts.resize) {
        frame = resizeRgba(frame, s.frameWidth, s.frameHeight, opts.resize);
      } else {
        return {
          id: entry.id,
          ok: false,
          reason: `frame ${r.file} is ${frame.width}x${frame.height}, expected ${s.frameWidth}x${s.frameHeight} (pass --resize)`
        };
      }
    }
    if (r.col === 'walk') {
      // Replicate the walk frame across columns 2..7 of the row.
      for (let col = 2; col < 8; col += 1) {
        copyFrameInto(sheetRgba, s.width, frame, r.row, col, s.frameWidth, s.frameHeight);
      }
    } else {
      copyFrameInto(sheetRgba, s.width, frame, r.row, r.col, s.frameWidth, s.frameHeight);
    }
  }

  const outAbs = outputAbsFor(entry, opts);
  ensureDir(path.dirname(outAbs));
  fs.writeFileSync(outAbs, encodeDeterministicPng({ width: s.width, height: s.height, rgba: sheetRgba }));

  const stats = alphaStats({ width: s.width, height: s.height, rgba: sheetRgba }, { x: 0, y: 0, width: s.width, height: s.height });
  return {
    id: entry.id,
    ok: true,
    output: outputLabelFor(entry, opts),
    alpha: `coverage=${(stats.coverage * 100).toFixed(1)}%`,
    mode: 'character_placeholder(12+repl)'
  };
}

function writeManifest(results, opts) {
  ensureDir(manifestDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestPath = path.join(manifestDir, `produce-${stamp}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    options: opts,
    results
  }, null, 2));
  console.log(`  manifest: ${path.relative(repoRoot, manifestPath)}`);
}

function main() {
  const { ids, chromaKey, allMissing, candidate, candidateRoot, resize, seamlessTerrain, cropCenter, quietTerrain } = parseArgs(process.argv.slice(2));
  if (ids.length === 0 && !allMissing) {
    console.error('Usage: produce-home-field-assets.js <asset_id...> | --all-missing');
    console.error('  Options:');
    console.error('    --chroma-key=#ff00ff   strip a flat key color from imagegen output before alpha check');
    console.error('    --candidate             write under .agent/home-field-workspace/candidates/object-layer/latest instead of web/public');
    console.error('    --candidate-root=<dir>  write candidate outputs under a custom root');
    console.error('    --resize               Lanczos downscale raw to target dimensions (use for terrain/props/exits/chibi candidates)');
    console.error('    --resize-nearest       nearest-neighbor downscale (diagnostic only; do not use for Home Field chibi production candidates)');
    console.error('    --seamless-terrain     softly harmonize opposite terrain edges for repeatable ground tiles');
    console.error('    --crop-center[=0.82]   crop terrain raw around center before resize to remove imagegen edge vignettes');
    console.error('    --quiet-terrain[=0.35] reduce broad generated lighting variation so repeats are less obvious');
    process.exit(1);
  }

  const assetsDoc = loadJson(ASSETS_PATH);
  const schemaCheck = validateAssets(assetsDoc);
  if (!schemaCheck.ok) {
    console.error('home-field-assets.json failed schema validation; refusing to run:');
    for (const e of schemaCheck.errors) console.error(`  [${e.code}] ${e.message}`);
    process.exit(1);
  }

  const allEntries = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map(characterEntryToAsset)
  ];
  const byId = new Map(allEntries.map((e) => [e.id, e]));

  let targets = [];
  if (allMissing) {
    targets = allEntries.filter((e) => !fs.existsSync(path.join(repoRoot, e.outputPath)));
  } else {
    for (const id of ids) {
      const entry = byId.get(id);
      if (!entry) {
        console.error(`Unknown asset id: ${id}`);
        process.exit(1);
      }
      targets.push(entry);
    }
  }

  if (targets.length === 0) {
    console.log('Nothing to produce.');
    return;
  }

  console.log(`Producing ${targets.length} asset${targets.length === 1 ? '' : 's'}...`);
  const results = [];
  for (const target of targets) {
    const r = processEntry(target, { chromaKey, candidate, candidateRoot, resize, seamlessTerrain, cropCenter, quietTerrain });
    if (r.ok) {
      console.log(`  ${target.id}: OK [${r.mode || 'static'}] -> ${r.output}${r.alpha ? ` (${r.alpha})` : ''}`);
    } else {
      console.error(`  ${target.id}: FAIL — ${r.reason}`);
    }
    results.push(r);
  }
  writeManifest(results, {
    chromaKey,
    allMissing,
    candidate,
    candidateRoot: candidate ? path.relative(repoRoot, candidateRoot) : null,
    resize,
    seamlessTerrain,
    cropCenter,
    quietTerrain
  });

  const failed = results.filter((r) => !r.ok);
  const done = results.length - failed.length;
  console.log('');
  console.log(`Summary: ${done} OK, ${failed.length} failed.`);
  if (done > 0) {
    if (candidate) {
      const env = `HOME_FIELD_ASSET_ROOT=${path.relative(repoRoot, candidateRoot)}`;
      console.log(`Next: \`${env} npm run game:home-field:validate -- --check-files\` then \`${env} npm run game:home-field:sheet\`.`);
    } else {
      console.log('Next: `npm run game:home-field:validate -- --check-files` then `npm run game:home-field:sheet`.');
    }
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
