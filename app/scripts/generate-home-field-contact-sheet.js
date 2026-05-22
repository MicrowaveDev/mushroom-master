#!/usr/bin/env node
/**
 * Contact-sheet generator stub for the Home Field hub pipeline.
 *
 * v1 stub: builds a deterministic grid contact sheet of currently-present app-facing PNGs
 * (everything that exists under web/public/home-field/**) so reviewers can scan style and
 * silhouettes at once.
 *
 * Output:
 *   .agent/home-field-workspace/review/contact-sheet.png
 *   .agent/home-field-workspace/review/contact-sheet.manifest.json
 *
 * The first PR after Phase 0 should expand this to:
 *   - 3x3 repetition for terrain seams
 *   - alpha-checkerboard background for transparent props
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
  fileSha256,
  bufferSha256
} from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = path.join(sharedDir, 'home-field-assets.json');
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
      const color = odd ? CHECKER_A : CHECKER_B;
      fillRect(canvas, x + xx, y + yy, Math.min(size, w - xx), Math.min(size, h - yy), color);
    }
  }
}

function blitFit(canvas, image, dstX, dstY, dstW, dstH) {
  const scale = Math.min(dstW / image.width, dstH / image.height);
  const sw = Math.max(1, Math.round(image.width * scale));
  const sh = Math.max(1, Math.round(image.height * scale));
  const ox = dstX + Math.floor((dstW - sw) / 2);
  const oy = dstY + Math.floor((dstH - sh) / 2);
  for (let yy = 0; yy < sh; yy += 1) {
    const sy = Math.floor(yy / scale);
    for (let xx = 0; xx < sw; xx += 1) {
      const sx = Math.floor(xx / scale);
      const si = (sy * image.width + sx) * 4;
      const sR = image.rgba[si + 0];
      const sG = image.rgba[si + 1];
      const sB = image.rgba[si + 2];
      const sA = image.rgba[si + 3];
      if (sA === 0) continue;
      const di = ((oy + yy) * canvas.width + (ox + xx)) * 4;
      // Alpha composite over existing canvas pixel.
      const da = canvas.rgba[di + 3];
      const a = sA / 255;
      canvas.rgba[di + 0] = Math.round(sR * a + canvas.rgba[di + 0] * (1 - a));
      canvas.rgba[di + 1] = Math.round(sG * a + canvas.rgba[di + 1] * (1 - a));
      canvas.rgba[di + 2] = Math.round(sB * a + canvas.rgba[di + 2] * (1 - a));
      canvas.rgba[di + 3] = Math.max(da, sA);
    }
  }
}

function main() {
  ensureDir(reviewDir);
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
    fs.existsSync(path.join(repoRoot, e.outputPath))
  );

  if (presentEntries.length === 0) {
    // Write an empty 1x1 placeholder so the alias never produces a missing file.
    const placeholder = makeCanvas(1, 1, BG);
    fs.writeFileSync(outPng, encodeDeterministicPng(placeholder));
    fs.writeFileSync(outManifest, JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      status: 'empty',
      cellCount: 0,
      outputHash: bufferSha256(encodeDeterministicPng(placeholder)),
      entries: []
    }, null, 2));
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
      const img = readPngRgba(path.join(repoRoot, e.outputPath));
      blitFit(canvas, img, cellX, cellY, CELL_SIZE, CELL_SIZE);
    } catch {
      // skip malformed PNG; cell stays as checkerboard
    }
  }

  const buf = encodeDeterministicPng(canvas);
  fs.writeFileSync(outPng, buf);

  const entries = presentEntries.map((e) => ({
    id: e.id,
    type: e.type,
    outputPath: e.outputPath,
    sha256: fileSha256(path.join(repoRoot, e.outputPath))
  }));
  fs.writeFileSync(outManifest, JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: 'preview',
    cellCount: presentEntries.length,
    outputHash: bufferSha256(buf),
    entries
  }, null, 2));

  console.log(`home-field contact sheet: ${presentEntries.length} cell(s) -> ${path.relative(repoRoot, outPng)}`);
}

main();
