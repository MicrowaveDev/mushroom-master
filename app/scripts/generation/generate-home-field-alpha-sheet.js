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
  fileSha256,
  readPngRgba
} from '../lib/bitmap-image-toolkit.js';
import {
  compositeAlphaDiagnosticRaster,
  createRaster,
  cropRaster,
  fillRaster,
  paintCheckerboard
} from '@microwavedev/backpack-game-core/tooling/raster';
import { renderRasterReview } from '@microwavedev/backpack-game-core/tooling/image-review';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
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

function parseIds(argv) {
  const arg = argv.find((item) => item.startsWith('--ids='));
  if (!arg) return null;
  return new Set(arg.slice('--ids='.length).split(',').map((id) => id.trim()).filter(Boolean));
}

function reviewImageForAsset(asset, image) {
  if (asset.type !== 'character' || !asset.spritesheet) return image;
  return cropRaster(image, {
    x: 0,
    y: 0,
    width: asset.spritesheet.frameWidth,
    height: asset.spritesheet.frameHeight
  });
}

function main() {
  const ids = parseIds(process.argv.slice(2));
  const assetsDoc = loadJson(assetsPath);
  const assets = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((character) => ({ ...character, type: 'character' }))
  ]
    .filter((asset) => asset.type !== 'terrain')
    .filter((asset) => !ids || ids.has(asset.id))
    .filter((asset) => fs.existsSync(path.join(assetRoot, asset.outputPath)));

  if (assets.length === 0) {
    throw new Error('No matching transparent Home Field assets found for alpha sheet');
  }

  const rows = Math.ceil(assets.length / COLS);
  const width = PAD + COLS * (CELL * 3 + PAD);
  const height = PAD + rows * (HEADER + CELL + PAD);
  const canvas = createRaster(width, height, DARK);
  const entries = [];

  assets.forEach((asset, index) => {
    const imagePath = path.join(assetRoot, asset.outputPath);
    const image = reviewImageForAsset(asset, readPngRgba(imagePath));
    const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = PAD + col * (CELL * 3 + PAD);
    const y = PAD + row * (HEADER + CELL + PAD) + HEADER;

    paintCheckerboard(canvas, { x, y, width: CELL, height: CELL }, {
      size: 16,
      colors: [CHECK_A, CHECK_B]
    });
    fillRaster(canvas, DARK, { x: x + CELL, y, width: CELL, height: CELL });
    fillRaster(canvas, [12, 18, 14, 255], { x: x + CELL * 2, y, width: CELL, height: CELL });
    compositeAlphaDiagnosticRaster(canvas, image, { x, y, mode: 'color', clip: false });
    compositeAlphaDiagnosticRaster(canvas, image, { x: x + CELL, y, mode: 'mask', clip: false });
    compositeAlphaDiagnosticRaster(canvas, image, { x: x + CELL * 2, y, mode: 'edge', edgeColor: HOT, clip: false });

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

  renderRasterReview({
    render: () => canvas,
    outputPath: outPng,
    manifestPath: outManifest,
    root: repoRoot,
    manifest: {
      schemaVersion: 1,
      sourceRoot: path.relative(repoRoot, assetRoot) || '.',
      entries
    }
  });
  console.log(`home-field alpha/halo sheet: ${assets.length} asset(s) -> ${path.relative(repoRoot, outPng)}`);
}

main();
