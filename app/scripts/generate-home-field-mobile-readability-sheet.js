#!/usr/bin/env node
/**
 * Focused small-size proof sheet for Home Field object-layer props.
 *
 * The normal contact sheet shows assets at 256px, which can hide mobile-scale
 * readability problems. This sheet repeats selected transparent props at common
 * in-field sizes so reviewers can reject noisy details before promotion.
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
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = process.env.HOME_FIELD_ASSETS_PATH
  ? path.resolve(process.env.HOME_FIELD_ASSETS_PATH)
  : path.join(sharedDir, 'home-field-assets.json');
const assetRoot = process.env.HOME_FIELD_ASSET_ROOT
  ? path.resolve(repoRoot, process.env.HOME_FIELD_ASSET_ROOT)
  : repoRoot;
const reviewDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'review');
const outPng = path.join(reviewDir, 'mobile-readability-sheet.png');
const outManifest = path.join(reviewDir, 'mobile-readability-sheet.manifest.json');

const SIZES = [128, 96, 64, 48, 32];
const CELL = 160;
const PAD = 16;
const BG = [42, 31, 26, 255];
const FIELD = [55, 91, 55, 255];
const DARK_FIELD = [35, 58, 43, 255];
const CHECKER_A = [80, 70, 60, 255];
const CHECKER_B = [62, 52, 44, 255];

function parseIds(argv) {
  const arg = argv.find((item) => item.startsWith('--ids='));
  const raw = arg ? arg.slice('--ids='.length) : process.env.HOME_FIELD_CANDIDATE_IDS;
  if (!raw) return null;
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean));
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

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

function paintCheckerboard(canvas, x, y, w, h, size = 16) {
  for (let yy = 0; yy < h; yy += size) {
    for (let xx = 0; xx < w; xx += size) {
      const odd = ((Math.floor(xx / size) + Math.floor(yy / size)) & 1) === 1;
      fillRect(canvas, x + xx, y + yy, Math.min(size, w - xx), Math.min(size, h - yy), odd ? CHECKER_A : CHECKER_B);
    }
  }
}

function blitToRect(canvas, image, dstX, dstY, dstW, dstH) {
  const xScale = image.width / dstW;
  const yScale = image.height / dstH;
  for (let yy = 0; yy < dstH; yy += 1) {
    const sy = Math.min(image.height - 1, Math.floor(yy * yScale));
    for (let xx = 0; xx < dstW; xx += 1) {
      const sx = Math.min(image.width - 1, Math.floor(xx * xScale));
      const si = (sy * image.width + sx) * 4;
      const sA = image.rgba[si + 3];
      if (sA === 0) continue;
      const di = ((dstY + yy) * canvas.width + (dstX + xx)) * 4;
      const a = sA / 255;
      canvas.rgba[di + 0] = Math.round(image.rgba[si + 0] * a + canvas.rgba[di + 0] * (1 - a));
      canvas.rgba[di + 1] = Math.round(image.rgba[si + 1] * a + canvas.rgba[di + 1] * (1 - a));
      canvas.rgba[di + 2] = Math.round(image.rgba[si + 2] * a + canvas.rgba[di + 2] * (1 - a));
      canvas.rgba[di + 3] = 255;
    }
  }
}

function main() {
  ensureDir(reviewDir);
  const ids = parseIds(process.argv.slice(2));
  const assetsDoc = loadJson(ASSETS_PATH);
  const entries = assetsDoc.assets
    .filter((entry) => entry.type === 'prop' || entry.type === 'exit')
    .filter((entry) => !ids || ids.has(entry.id))
    .filter((entry) => fs.existsSync(path.join(assetRoot, entry.outputPath)))
    .sort((a, b) => a.id.localeCompare(b.id));

  const width = PAD + SIZES.length * (CELL + PAD);
  const height = PAD + Math.max(1, entries.length) * (CELL + PAD);
  const canvas = makeCanvas(width, height, BG);

  for (let row = 0; row < entries.length; row += 1) {
    const entry = entries[row];
    const image = readPngRgba(path.join(assetRoot, entry.outputPath));
    for (let col = 0; col < SIZES.length; col += 1) {
      const cellX = PAD + col * (CELL + PAD);
      const cellY = PAD + row * (CELL + PAD);
      if (col === 0) paintCheckerboard(canvas, cellX, cellY, CELL, CELL);
      else fillRect(canvas, cellX, cellY, CELL, CELL, col % 2 === 0 ? DARK_FIELD : FIELD);
      const size = SIZES[col];
      const x = cellX + Math.floor((CELL - size) / 2);
      const y = cellY + Math.floor((CELL - size) / 2);
      blitToRect(canvas, image, x, y, size, size);
    }
  }

  const png = encodeDeterministicPng(canvas);
  fs.writeFileSync(outPng, png);
  fs.writeFileSync(outManifest, JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(repoRoot, assetRoot) || '.',
    sizes: SIZES,
    outputHash: bufferSha256(png),
    entries: entries.map((entry) => ({
      id: entry.id,
      outputPath: entry.outputPath,
      sha256: fileSha256(path.join(assetRoot, entry.outputPath))
    }))
  }, null, 2));

  console.log(`home-field mobile readability sheet: ${entries.length} asset(s) -> ${path.relative(repoRoot, outPng)}`);
}

main();
