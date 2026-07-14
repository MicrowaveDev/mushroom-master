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
  readPngRgba,
  fileSha256
} from '../lib/bitmap-image-toolkit.js';
import {
  compositeRasterToRect,
  createRaster,
  cropRaster,
  fillRaster,
  paintCheckerboard
} from '@microwavedev/backpack-game-core/tooling/raster';
import { renderRasterReview } from '@microwavedev/backpack-game-core/tooling/image-review';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
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

function reviewImageForAsset(entry, image) {
  if (entry.type !== 'character' || !entry.spritesheet) return image;
  return cropRaster(image, {
    x: 0,
    y: 0,
    width: entry.spritesheet.frameWidth,
    height: entry.spritesheet.frameHeight
  });
}

function main() {
  const ids = parseIds(process.argv.slice(2));
  const assetsDoc = loadJson(ASSETS_PATH);
  const entries = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((character) => ({ ...character, type: 'character' }))
  ]
    .filter((entry) => entry.type === 'prop' || entry.type === 'exit' || entry.type === 'character')
    .filter((entry) => !ids || ids.has(entry.id))
    .filter((entry) => fs.existsSync(path.join(assetRoot, entry.outputPath)))
    .sort((a, b) => a.id.localeCompare(b.id));

  const width = PAD + SIZES.length * (CELL + PAD);
  const height = PAD + Math.max(1, entries.length) * (CELL + PAD);
  const canvas = createRaster(width, height, BG);

  for (let row = 0; row < entries.length; row += 1) {
    const entry = entries[row];
    const image = reviewImageForAsset(entry, readPngRgba(path.join(assetRoot, entry.outputPath)));
    for (let col = 0; col < SIZES.length; col += 1) {
      const cellX = PAD + col * (CELL + PAD);
      const cellY = PAD + row * (CELL + PAD);
      if (col === 0) paintCheckerboard(canvas, { x: cellX, y: cellY, width: CELL, height: CELL }, {
        size: 16,
        colors: [CHECKER_B, CHECKER_A]
      });
      else fillRaster(canvas, col % 2 === 0 ? DARK_FIELD : FIELD, { x: cellX, y: cellY, width: CELL, height: CELL });
      const size = SIZES[col];
      const x = cellX + Math.floor((CELL - size) / 2);
      const y = cellY + Math.floor((CELL - size) / 2);
      compositeRasterToRect(canvas, image, { x, y, width: size, height: size }, {
        resize: 'nearest',
        mode: 'opaque'
      });
    }
  }

  renderRasterReview({
    render: () => canvas,
    outputPath: outPng,
    manifestPath: outManifest,
    root: repoRoot,
    manifest: {
      schemaVersion: 1,
      sourceRoot: path.relative(repoRoot, assetRoot) || '.',
      sizes: SIZES,
      entries: entries.map((entry) => ({
        id: entry.id,
        outputPath: entry.outputPath,
        sha256: fileSha256(path.join(assetRoot, entry.outputPath))
      }))
    }
  });

  console.log(`home-field mobile readability sheet: ${entries.length} asset(s) -> ${path.relative(repoRoot, outPng)}`);
}

main();
