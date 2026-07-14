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
  encodeDeterministicPng,
  readPngRgba,
  fileSha256
} from '../lib/bitmap-image-toolkit.js';
import {
  compositeRaster,
  createRaster,
  paintCheckerboard as paintRasterCheckerboard,
  resizeRasterNearest
} from '@microwavedev/backpack-game-core/tooling/raster';
import { writeEvidenceBundle } from '@microwavedev/backpack-game-core/tooling/evidence';

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

function makeCanvas(width, height, fill) {
  return createRaster(width, height, fill);
}

function paintCheckerboard(canvas, x, y, w, h, size = 16) {
  paintRasterCheckerboard(canvas, { x, y, width: w, height: h }, {
    size,
    colors: [CHECKER_B, CHECKER_A]
  });
}

function blitFit(canvas, image, dstX, dstY, dstW, dstH) {
  const scale = Math.min(dstW / image.width, dstH / image.height);
  const sw = Math.max(1, Math.round(image.width * scale));
  const sh = Math.max(1, Math.round(image.height * scale));
  const ox = dstX + Math.floor((dstW - sw) / 2);
  const oy = dstY + Math.floor((dstH - sh) / 2);
  blitToRect(canvas, image, ox, oy, sw, sh);
}

function blitToRect(canvas, image, dstX, dstY, dstW, dstH) {
  compositeRaster(canvas, resizeRasterNearest(image, dstW, dstH), {
    x: dstX,
    y: dstY,
    mode: 'max-alpha'
  });
}

function blitTerrainRepeat(canvas, image, dstX, dstY, dstW, dstH) {
  const cols = 3;
  const rows = 3;
  const tileW = Math.floor(dstW / cols);
  const tileH = Math.floor(dstH / rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = dstX + col * tileW;
      const y = dstY + row * tileH;
      const w = col === cols - 1 ? dstW - tileW * (cols - 1) : tileW;
      const h = row === rows - 1 ? dstH - tileH * (rows - 1) : tileH;
      blitToRect(canvas, image, x, y, w, h);
    }
  }
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
    const placeholder = makeCanvas(1, 1, BG);
    writeEvidenceBundle({
      outputPath: outPng,
      outputBuffer: encodeDeterministicPng(placeholder),
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
  const canvas = makeCanvas(width, height, BG);

  for (let i = 0; i < presentEntries.length; i += 1) {
    const e = presentEntries[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cellX = PAD + col * (CELL_SIZE + PAD);
    const cellY = HEADER + PAD + row * (CELL_SIZE + PAD + HEADER);

    paintCheckerboard(canvas, cellX, cellY, CELL_SIZE, CELL_SIZE);
    try {
      const img = readPngRgba(path.join(assetRoot, e.outputPath));
      if (e.type === 'terrain') {
        blitTerrainRepeat(canvas, img, cellX, cellY, CELL_SIZE, CELL_SIZE);
      } else {
        blitFit(canvas, img, cellX, cellY, CELL_SIZE, CELL_SIZE);
      }
    } catch {
      // skip malformed PNG; cell stays as checkerboard
    }
  }

  const buf = encodeDeterministicPng(canvas);
  const entries = presentEntries.map((e) => ({
    id: e.id,
    type: e.type,
    outputPath: e.outputPath,
    sourceRoot: path.relative(repoRoot, assetRoot) || '.',
    sha256: fileSha256(path.join(assetRoot, e.outputPath))
  }));
  writeEvidenceBundle({
    outputPath: outPng,
    outputBuffer: buf,
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
