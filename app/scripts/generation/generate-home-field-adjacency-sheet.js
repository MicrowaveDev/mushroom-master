#!/usr/bin/env node
/**
 * Terrain adjacency proof sheet for the Home Field asset pipeline.
 *
 * Shows representative neighbor runs that metadata-only connector validation cannot
 * judge visually: grass variants, path bands, side-edge stacks, and every unique
 * adjacent terrain pair used by home-field-map.json.
 *
 * Output:
 *   .agent/home-field-workspace/review/adjacency-sheet.png
 *   .agent/home-field-workspace/review/adjacency-sheet.manifest.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeDeterministicPng,
  readPngRgba,
  fileSha256,
  bufferSha256
} from '../lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const assetsPath = path.join(sharedDir, 'home-field-assets.json');
const mapPath = path.join(sharedDir, 'home-field-map.json');
const assetRoot = process.env.HOME_FIELD_ASSET_ROOT
  ? path.resolve(repoRoot, process.env.HOME_FIELD_ASSET_ROOT)
  : repoRoot;
const reviewDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'review');
const outPng = path.join(reviewDir, 'adjacency-sheet.png');
const outManifest = path.join(reviewDir, 'adjacency-sheet.manifest.json');

const TILE = 96;
const GAP = 12;
const PAD = 18;
const BG = [33, 39, 31, 255];
const EMPTY = [52, 58, 48, 255];
const CHECKER_A = [72, 82, 66, 255];
const CHECKER_B = [58, 68, 54, 255];

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

function paintCheckerboard(canvas, x, y, w, h, size = 12) {
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
      canvas.rgba[di + 3] = Math.max(canvas.rgba[di + 3], sA);
    }
  }
}

function terrainLayer(mapDoc) {
  return (mapDoc.layers || []).find((layer) => layer.type === 'tileLayer' && layer.id === 'terrain');
}

function collectMapRows(layer, tileSize) {
  const rows = new Map();
  for (const tile of layer.tiles || []) {
    const row = tile.y / tileSize;
    const col = tile.x / tileSize;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push({ col, assetId: tile.assetId });
  }
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, tiles]) => ({
      row,
      assets: tiles.sort((a, b) => a.col - b.col).map((tile) => tile.assetId)
    }));
}

function collectUniquePairs(layer, tileSize) {
  const byCell = new Map();
  for (const tile of layer.tiles || []) {
    byCell.set(`${tile.x / tileSize},${tile.y / tileSize}`, tile);
  }

  const pairs = new Map();
  for (const tile of layer.tiles || []) {
    const cx = tile.x / tileSize;
    const cy = tile.y / tileSize;
    for (const [dir, nx, ny] of [['horizontal', cx + 1, cy], ['vertical', cx, cy + 1]]) {
      const neighbor = byCell.get(`${nx},${ny}`);
      if (!neighbor) continue;
      const key = `${dir}:${tile.assetId}>${neighbor.assetId}`;
      pairs.set(key, { dir, assets: [tile.assetId, neighbor.assetId] });
    }
  }
  return [...pairs.values()].sort((a, b) => `${a.dir}:${a.assets.join('>')}`.localeCompare(`${b.dir}:${b.assets.join('>')}`));
}

function loadImages(assetById) {
  const images = new Map();
  for (const asset of assetById.values()) {
    const abs = path.join(assetRoot, asset.outputPath);
    if (!fs.existsSync(abs)) continue;
    try {
      images.set(asset.id, readPngRgba(abs));
    } catch {
      // Leave malformed assets as empty cells; validation reports the file issue.
    }
  }
  return images;
}

function drawTile(canvas, images, assetId, x, y) {
  paintCheckerboard(canvas, x, y, TILE, TILE);
  const img = images.get(assetId);
  if (img) blitToRect(canvas, img, x, y, TILE, TILE);
}

function drawRun(canvas, images, assetIds, x, y) {
  assetIds.forEach((assetId, idx) => drawTile(canvas, images, assetId, x + idx * TILE, y));
}

function drawVerticalRun(canvas, images, assetIds, x, y) {
  assetIds.forEach((assetId, idx) => drawTile(canvas, images, assetId, x, y + idx * TILE));
}

function main() {
  ensureDir(reviewDir);
  const assetsDoc = loadJson(assetsPath);
  const mapDoc = loadJson(mapPath);
  const layer = terrainLayer(mapDoc);
  const tileSize = mapDoc.world?.tileSize || 256;
  const terrainAssets = assetsDoc.assets.filter((asset) => asset.type === 'terrain');
  const assetById = new Map(terrainAssets.map((asset) => [asset.id, asset]));
  const images = loadImages(assetById);

  if (!layer) {
    const canvas = makeCanvas(1, 1, BG);
    const buf = encodeDeterministicPng(canvas);
    fs.writeFileSync(outPng, buf);
    fs.writeFileSync(outManifest, JSON.stringify({
      schemaVersion: 1,
      status: 'empty',
      generatedAt: new Date().toISOString(),
      outputHash: bufferSha256(buf),
      proofs: []
    }, null, 2));
    console.log('home-field adjacency sheet: no terrain layer; wrote 1x1 placeholder.');
    return;
  }

  const pathRun = ['grass_base_01', 'path_h_end_w', 'path_dirt_straight', 'path_spore_glow', 'path_h_end_e', 'grass_base_02'];
  const leftEdgeStack = ['edge_left_forest_01', 'edge_left_forest_01', 'edge_left_forest_01', 'edge_left_forest_01'];
  const rightEdgeStack = ['edge_right_forest_01', 'edge_right_forest_01', 'edge_right_forest_01', 'edge_right_forest_01'];
  const rows = collectMapRows(layer, tileSize);
  const pairs = collectUniquePairs(layer, tileSize);

  const mapWidth = Math.max(...rows.map((row) => row.assets.length), pathRun.length) * TILE;
  const pathY = PAD;
  const edgeY = pathY + TILE + GAP;
  const mapY = edgeY + leftEdgeStack.length * TILE + GAP;
  const pairsY = mapY + rows.length * TILE + GAP;
  const pairCols = 4;
  const pairBlock = TILE * 2;
  const pairRows = Math.ceil(pairs.length / pairCols);
  const width = PAD * 2 + Math.max(mapWidth, pairCols * pairBlock + (pairCols - 1) * GAP);
  const height = pairsY + Math.max(1, pairRows) * pairBlock + PAD;
  const canvas = makeCanvas(width, height, BG);

  drawRun(canvas, images, pathRun, PAD, pathY);
  drawVerticalRun(canvas, images, leftEdgeStack, PAD, edgeY);
  drawVerticalRun(canvas, images, rightEdgeStack, PAD + TILE + GAP, edgeY);

  rows.forEach((row, idx) => drawRun(canvas, images, row.assets, PAD, mapY + idx * TILE));

  pairs.forEach((pair, idx) => {
    const col = idx % pairCols;
    const row = Math.floor(idx / pairCols);
    const x = PAD + col * (pairBlock + GAP);
    const y = pairsY + row * pairBlock;
    fillRect(canvas, x, y, pairBlock, pairBlock, EMPTY);
    if (pair.dir === 'horizontal') {
      drawRun(canvas, images, pair.assets, x, y + Math.floor(TILE / 2));
    } else {
      drawVerticalRun(canvas, images, pair.assets, x + Math.floor(TILE / 2), y);
    }
  });

  const buf = encodeDeterministicPng(canvas);
  fs.writeFileSync(outPng, buf);

  const usedIds = new Set([
    ...pathRun,
    ...leftEdgeStack,
    ...rightEdgeStack,
    ...rows.flatMap((row) => row.assets),
    ...pairs.flatMap((pair) => pair.assets)
  ]);
  fs.writeFileSync(outManifest, JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: 'preview',
    sourceRoot: path.relative(repoRoot, assetRoot) || '.',
    outputHash: bufferSha256(buf),
    tileSize: TILE,
    proofs: {
      pathRun,
      leftEdgeStack,
      rightEdgeStack,
      mapRows: rows,
      uniquePairs: pairs
    },
    entries: [...usedIds].sort().map((id) => {
      const asset = assetById.get(id);
      const abs = asset ? path.join(assetRoot, asset.outputPath) : null;
      return {
        id,
        outputPath: asset?.outputPath || null,
        sha256: abs && fs.existsSync(abs) ? fileSha256(abs) : null
      };
    })
  }, null, 2));

  console.log(`home-field adjacency sheet: ${pairs.length} unique pair(s) -> ${path.relative(repoRoot, outPng)}`);
}

main();
