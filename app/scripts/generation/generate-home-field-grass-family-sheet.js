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
  readPngRgba,
  fileSha256
} from '../lib/bitmap-image-toolkit.js';
import {
  compositeRasterToRect,
  createRaster,
  paintCheckerboard,
  repeatRasterGrid
} from '@microwavedev/backpack-game-core/tooling/raster';
import { renderRasterReview } from '@microwavedev/backpack-game-core/tooling/image-review';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
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

function drawTile(canvas, images, id, x, y) {
  paintCheckerboard(canvas, { x, y, width: TILE, height: TILE }, {
    size: 12,
    colors: [CHECKER_B, CHECKER_A]
  });
  compositeRasterToRect(canvas, images.get(id), { x, y, width: TILE, height: TILE }, {
    resize: 'nearest',
    mode: 'copy'
  });
}

function drawRepeat(canvas, images, id, x, y, cols = 3, rows = 3) {
  repeatRasterGrid(canvas, images.get(id), { x, y, width: cols * TILE, height: rows * TILE }, {
    rows,
    columns: cols,
    resize: 'nearest',
    mode: 'copy'
  });
}

function drawPattern(canvas, images, pattern, x, y) {
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < pattern.length; col += 1) {
      drawTile(canvas, images, pattern[(col + row) % pattern.length], x + col * TILE, y + row * TILE);
    }
  }
}

function main() {
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
  const canvas = createRaster(width, height, BG);

  IDS.forEach((id, idx) => {
    drawRepeat(canvas, images, id, PAD + idx * (repeatW + GAP), repeatsY);
  });
  PATTERNS.forEach((pattern, idx) => {
    drawPattern(canvas, images, pattern, PAD, patternsY + idx * (TILE * 3 + GAP));
  });

  renderRasterReview({
    render: () => canvas,
    outputPath: outPng,
    manifestPath: outManifest,
    root: repoRoot,
    manifest: {
      schemaVersion: 1,
      status: 'preview',
      sourceRoot: path.relative(repoRoot, assetRoot) || '.',
      proof: {
        repeatBlocks: IDS,
        mixedPatterns: PATTERNS
      },
      entries
    }
  });
  console.log(`home-field grass-family sheet: ${path.relative(repoRoot, outPng)}`);
}

main();
