#!/usr/bin/env node
/**
 * Contact-sheet generator stub for the Home Field hub pipeline.
 *
 * Builds a deterministic contact sheet of currently-present app-facing PNGs
 * (everything that exists under web/public/home-field/**) so reviewers can scan style,
 * silhouettes, and terrain tiling at once.
 *
 * Output:
 *   .agent/home-field-workspace/review/contact-sheet.png
 *   .agent/home-field-workspace/review/contact-sheet.manifest.json
 *
 * The first PR after Phase 0 should expand this further to:
 *   - animation strip preview for effects
 *   - chibi spritesheet preview at 1x and 2x scale
 *   - separate map-preview.png that renders the home-field-map.json layout
 *
 * For now, this stub is enough to wire the package alias and CI gate. It writes a
 * placeholder manifest and exits successfully even when no PNGs exist yet, so the
 * `npm run game:home-field:sheet` alias works during Phase 0.
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
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = path.join(sharedDir, 'home-field-assets.json');
const assetRoot = process.env.HOME_FIELD_ASSET_ROOT
  ? path.resolve(repoRoot, process.env.HOME_FIELD_ASSET_ROOT)
  : repoRoot;
const reviewDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'review');
const outPng = path.join(reviewDir, 'contact-sheet.png');
const outManifest = path.join(reviewDir, 'contact-sheet.manifest.json');

const CELL_SIZE = 256;
const COLS = 4;
const PAD = 16;
const HEADER = 48;
const BG = [42, 31, 26, 255]; // warm umber background
const CHECKER_A = [80, 70, 60, 255];
const CHECKER_B = [62, 52, 44, 255];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const assetsDoc = loadJson(ASSETS_PATH);
  const allEntries = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((c) => ({
      id: c.id,
      type: 'character',
      outputPath: c.outputPath
    }))
  ];

  const presentEntries = allEntries.filter((e) =>
    fs.existsSync(path.join(assetRoot, e.outputPath))
  );

  if (presentEntries.length === 0) {
    // Write an empty 1x1 placeholder so the alias never produces a missing file.
    const placeholder = createRaster(1, 1, BG);
    renderRasterReview({
      render: () => placeholder,
      outputPath: outPng,
      manifestPath: outManifest,
      root: repoRoot,
      manifest: { schemaVersion: 1, status: 'empty', cellCount: 0, entries: [] }
    });
    console.log('home-field contact sheet: no PNGs present yet; wrote 1x1 placeholder.');
    return;
  }

  // Sort deterministically by type then id.
  const typeOrder = { terrain: 0, prop: 1, exit: 2, effect: 3, character: 4 };
  presentEntries.sort((a, b) => {
    const ta = typeOrder[a.type] ?? 99;
    const tb = typeOrder[b.type] ?? 99;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  const rows = Math.ceil(presentEntries.length / COLS);
  const width = PAD + COLS * (CELL_SIZE + PAD);
  const height = HEADER + PAD + rows * (CELL_SIZE + PAD + HEADER);
  const canvas = createRaster(width, height, BG);

  for (let i = 0; i < presentEntries.length; i += 1) {
    const e = presentEntries[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cellX = PAD + col * (CELL_SIZE + PAD);
    const cellY = HEADER + PAD + row * (CELL_SIZE + PAD + HEADER);

    paintCheckerboard(canvas, { x: cellX, y: cellY, width: CELL_SIZE, height: CELL_SIZE }, {
      size: 16,
      colors: [CHECKER_B, CHECKER_A]
    });
    try {
      const img = readPngRgba(path.join(assetRoot, e.outputPath));
      if (e.type === 'terrain') {
        repeatRasterGrid(canvas, img, { x: cellX, y: cellY, width: CELL_SIZE, height: CELL_SIZE }, {
          rows: 3,
          columns: 3,
          resize: 'nearest',
          mode: 'max-alpha'
        });
      } else {
        compositeRasterToRect(canvas, img, { x: cellX, y: cellY, width: CELL_SIZE, height: CELL_SIZE }, {
          fit: 'contain',
          resize: 'nearest',
          mode: 'max-alpha'
        });
      }
    } catch {
      // skip malformed PNG; cell stays as checkerboard
    }
  }

  const entries = presentEntries.map((e) => ({
    id: e.id,
    type: e.type,
    outputPath: e.outputPath,
    sourceRoot: path.relative(repoRoot, assetRoot) || '.',
    sha256: fileSha256(path.join(assetRoot, e.outputPath))
  }));
  renderRasterReview({
    render: () => canvas,
    outputPath: outPng,
    manifestPath: outManifest,
    root: repoRoot,
    manifest: {
      schemaVersion: 1,
      status: 'preview',
      sourceRoot: path.relative(repoRoot, assetRoot) || '.',
      cellCount: presentEntries.length,
      entries
    }
  });

  console.log(`home-field contact sheet: ${presentEntries.length} cell(s) -> ${path.relative(repoRoot, outPng)}`);
}

main();
