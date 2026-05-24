#!/usr/bin/env node
/**
 * Focused proof sheet for the first Home Field grass family.
 *
 * The full contact sheet is useful, but it hides grass-family problems among
 * props/exits. This sheet shows only grass repeats and common mixed patterns.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeDeterministicPng,
  readPngRgba,
  fileSha256,
  bufferSha256
} from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const assetRoot = process.env.HOME_FIELD_ASSET_ROOT
  ? path.resolve(repoRoot, process.env.HOME_FIELD_ASSET_ROOT)
  : repoRoot;
const reviewDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'review');
const outPng = path.join(reviewDir, 'grass-family-sheet.png');
const outManifest = path.join(reviewDir, 'grass-family-sheet.manifest.json');
const TILE = 96;
const GAP = 14;
const PAD = 18;
const BG = [33, 39, 31, 255];
const CHECKER_A = [62, 70, 56, 255];
const CHECKER_B = [52, 60, 48, 255];
const IDS = ['grass_base_01', 'grass_base_02', 'grass_flowers_01'];
const PATTERNS = [
  ['grass_base_01', 'grass_base_02', 'grass_base_01', 'grass_base_02', 'grass_base_01'],
  ['grass_base_02', 'grass_flowers_01', 'grass_base_01', 'grass_flowers_01', 'grass_base_02'],
  ['grass_base_01', 'grass_base_02', 'grass_flowers_01', 'grass_base_02', 'grass_base_01']
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function makeCanvas(width, height, fill) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4 + 0] = fill[0];
    rgba[i * 4 + 1] = fill[1];
    rgba[i * 4 + 2] = fill[2];
    rgba[i * 4 + 3] = fill[3];
  }
  return { width, height, rgba };
}

function fillRect(canvas, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    if (yy < 0 || yy >= canvas.height) continue;
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || xx >= canvas.width) continue;
      const i = (yy * canvas.width + xx) * 4;
      canvas.rgba[i + 0] = color[0];
      canvas.rgba[i + 1] = color[1];
      canvas.rgba[i + 2] = color[2];
      canvas.rgba[i + 3] = color[3];
    }
  }
}

function paintCheckerboard(canvas, x, y, w, h, size = 12) {
  for (let yy = 0; yy < h; yy += size) {
    for (let xx = 0; xx < w; xx += size) {
      const odd = ((Math.floor(xx / size) + Math.floor(yy / size)) & 1) === 1;
      fillRect(canvas, x + xx, y + yy, Math.min(size, w - xx), Math.min(size, h - yy), odd ? CHECKER_A : CHECKER_B);
    }
  }
}

function blit(canvas, image, dstX, dstY, dstW = TILE, dstH = TILE) {
  const xScale = image.width / dstW;
  const yScale = image.height / dstH;
  for (let yy = 0; yy < dstH; yy += 1) {
    const sy = Math.min(image.height - 1, Math.floor(yy * yScale));
    for (let xx = 0; xx < dstW; xx += 1) {
      const sx = Math.min(image.width - 1, Math.floor(xx * xScale));
      const si = (sy * image.width + sx) * 4;
      const di = ((dstY + yy) * canvas.width + (dstX + xx)) * 4;
      canvas.rgba[di + 0] = image.rgba[si + 0];
      canvas.rgba[di + 1] = image.rgba[si + 1];
      canvas.rgba[di + 2] = image.rgba[si + 2];
      canvas.rgba[di + 3] = image.rgba[si + 3];
    }
  }
}

function drawTile(canvas, images, id, x, y) {
  paintCheckerboard(canvas, x, y, TILE, TILE);
  blit(canvas, images.get(id), x, y);
}

function drawRepeat(canvas, images, id, x, y, cols = 3, rows = 3) {
  for (let yy = 0; yy < rows; yy += 1) {
    for (let xx = 0; xx < cols; xx += 1) {
      drawTile(canvas, images, id, x + xx * TILE, y + yy * TILE);
    }
  }
}

function drawPattern(canvas, images, pattern, x, y) {
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < pattern.length; col += 1) {
      drawTile(canvas, images, pattern[(col + row) % pattern.length], x + col * TILE, y + row * TILE);
    }
  }
}

function main() {
  ensureDir(reviewDir);
  const images = new Map();
  const entries = [];
  for (const id of IDS) {
    const rel = `web/public/home-field/terrain/${id}.png`;
    const abs = path.join(assetRoot, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`Missing grass tile: ${rel}`);
    }
    images.set(id, readPngRgba(abs));
    entries.push({ id, outputPath: rel, sha256: fileSha256(abs) });
  }

  const repeatW = TILE * 3;
  const patternW = TILE * 5;
  const width = PAD * 2 + Math.max(IDS.length * repeatW + (IDS.length - 1) * GAP, patternW);
  const repeatsY = PAD;
  const patternsY = repeatsY + TILE * 3 + GAP;
  const height = patternsY + PATTERNS.length * TILE * 3 + (PATTERNS.length - 1) * GAP + PAD;
  const canvas = makeCanvas(width, height, BG);

  IDS.forEach((id, idx) => {
    drawRepeat(canvas, images, id, PAD + idx * (repeatW + GAP), repeatsY);
  });
  PATTERNS.forEach((pattern, idx) => {
    drawPattern(canvas, images, pattern, PAD, patternsY + idx * (TILE * 3 + GAP));
  });

  const buf = encodeDeterministicPng(canvas);
  fs.writeFileSync(outPng, buf);
  fs.writeFileSync(outManifest, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: 'preview',
    sourceRoot: path.relative(repoRoot, assetRoot) || '.',
    output: path.relative(repoRoot, outPng),
    outputHash: bufferSha256(buf),
    proof: {
      repeatBlocks: IDS,
      mixedPatterns: PATTERNS
    },
    entries
  }, null, 2)}\n`);
  console.log(`home-field grass-family sheet: ${path.relative(repoRoot, outPng)}`);
}

main();
