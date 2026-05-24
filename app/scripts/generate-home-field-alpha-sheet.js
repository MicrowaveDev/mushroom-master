#!/usr/bin/env node
/**
 * Generate a focused alpha/halo proof sheet for transparent Home Field assets.
 *
 * Usage:
 *   HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest \
 *     npm run game:home-field:alpha-sheet -- --ids=bush_cluster_dark_01,bush_cluster_light_01
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  alphaStats,
  bufferSha256,
  encodeDeterministicPng,
  fileSha256,
  readPngRgba
} from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const assetsPath = process.env.HOME_FIELD_ASSETS_PATH
  ? path.resolve(process.env.HOME_FIELD_ASSETS_PATH)
  : path.join(repoRoot, 'app', 'shared', 'home-field', 'home-field-assets.json');
const assetRoot = process.env.HOME_FIELD_ASSET_ROOT
  ? path.resolve(repoRoot, process.env.HOME_FIELD_ASSET_ROOT)
  : repoRoot;
const reviewDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'review');
const outPng = path.join(reviewDir, 'alpha-halo-sheet.png');
const outManifest = path.join(reviewDir, 'alpha-halo-sheet.manifest.json');

const CELL = 256;
const PAD = 18;
const HEADER = 32;
const COLS = 3;
const CHECK_A = [232, 224, 209, 255];
const CHECK_B = [150, 138, 122, 255];
const DARK = [31, 24, 28, 255];
const HOT = [255, 54, 190, 255];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseIds(argv) {
  const arg = argv.find((item) => item.startsWith('--ids='));
  if (!arg) return null;
  return new Set(arg.slice('--ids='.length).split(',').map((id) => id.trim()).filter(Boolean));
}

function makeCanvas(width, height, fill = DARK) {
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

function paintChecker(canvas, x, y, w, h, size = 16) {
  for (let yy = 0; yy < h; yy += size) {
    for (let xx = 0; xx < w; xx += size) {
      const odd = ((Math.floor(xx / size) + Math.floor(yy / size)) & 1) === 1;
      fillRect(canvas, x + xx, y + yy, Math.min(size, w - xx), Math.min(size, h - yy), odd ? CHECK_B : CHECK_A);
    }
  }
}

function blit(canvas, image, dstX, dstY, mode) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const si = (y * image.width + x) * 4;
      const a = image.rgba[si + 3];
      if (a === 0) continue;
      const di = ((dstY + y) * canvas.width + (dstX + x)) * 4;
      if (mode === 'alpha') {
        canvas.rgba[di + 0] = a;
        canvas.rgba[di + 1] = a;
        canvas.rgba[di + 2] = a;
        canvas.rgba[di + 3] = 255;
        continue;
      }
      if (mode === 'edge') {
        const edge = a > 0 && a < 245;
        canvas.rgba[di + 0] = edge ? HOT[0] : image.rgba[si + 0];
        canvas.rgba[di + 1] = edge ? HOT[1] : image.rgba[si + 1];
        canvas.rgba[di + 2] = edge ? HOT[2] : image.rgba[si + 2];
        canvas.rgba[di + 3] = 255;
        continue;
      }
      const alpha = a / 255;
      canvas.rgba[di + 0] = Math.round(image.rgba[si + 0] * alpha + canvas.rgba[di + 0] * (1 - alpha));
      canvas.rgba[di + 1] = Math.round(image.rgba[si + 1] * alpha + canvas.rgba[di + 1] * (1 - alpha));
      canvas.rgba[di + 2] = Math.round(image.rgba[si + 2] * alpha + canvas.rgba[di + 2] * (1 - alpha));
      canvas.rgba[di + 3] = 255;
    }
  }
}

function main() {
  ensureDir(reviewDir);
  const ids = parseIds(process.argv.slice(2));
  const assets = loadJson(assetsPath).assets
    .filter((asset) => asset.type !== 'terrain')
    .filter((asset) => !ids || ids.has(asset.id))
    .filter((asset) => fs.existsSync(path.join(assetRoot, asset.outputPath)));

  if (assets.length === 0) {
    throw new Error('No matching transparent Home Field assets found for alpha sheet');
  }

  const rows = Math.ceil(assets.length / COLS);
  const width = PAD + COLS * (CELL * 3 + PAD);
  const height = PAD + rows * (HEADER + CELL + PAD);
  const canvas = makeCanvas(width, height);
  const entries = [];

  assets.forEach((asset, index) => {
    const imagePath = path.join(assetRoot, asset.outputPath);
    const image = readPngRgba(imagePath);
    const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = PAD + col * (CELL * 3 + PAD);
    const y = PAD + row * (HEADER + CELL + PAD) + HEADER;

    paintChecker(canvas, x, y, CELL, CELL);
    fillRect(canvas, x + CELL, y, CELL, CELL, DARK);
    fillRect(canvas, x + CELL * 2, y, CELL, CELL, [12, 18, 14, 255]);
    blit(canvas, image, x, y, 'color');
    blit(canvas, image, x + CELL, y, 'alpha');
    blit(canvas, image, x + CELL * 2, y, 'edge');

    entries.push({
      id: asset.id,
      outputPath: asset.outputPath,
      sourceRoot: path.relative(repoRoot, assetRoot) || '.',
      sha256: fileSha256(imagePath),
      alphaCoverage: Number(stats.coverage.toFixed(4)),
      alphaBounds: {
        minX: stats.minX,
        minY: stats.minY,
        maxX: stats.maxX,
        maxY: stats.maxY,
        width: stats.bboxWidth,
        height: stats.bboxHeight
      },
      alphaMargins: {
        left: stats.marginLeft,
        right: stats.marginRight,
        top: stats.marginTop,
        bottom: stats.marginBottom
      }
    });
  });

  const buf = encodeDeterministicPng(canvas);
  fs.writeFileSync(outPng, buf);
  fs.writeFileSync(outManifest, JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(repoRoot, assetRoot) || '.',
    outputHash: bufferSha256(buf),
    entries
  }, null, 2));
  console.log(`home-field alpha/halo sheet: ${assets.length} asset(s) -> ${path.relative(repoRoot, outPng)}`);
}

main();
