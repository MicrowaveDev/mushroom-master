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
  readPngRgba,
  fileSha256
} from '../lib/bitmap-image-toolkit.js';
import {
  compositeRasterToRect,
  createRaster,
  fillRaster,
  paintCheckerboard
} from '@microwavedev/backpack-game-core/tooling/raster';
import { renderRasterReview } from '@microwavedev/backpack-game-core/tooling/image-review';

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
  paintCheckerboard(canvas, { x, y, width: TILE, height: TILE }, {
    size: 12,
    colors: [CHECKER_B, CHECKER_A]
  });
  const img = images.get(assetId);
  if (img) compositeRasterToRect(canvas, img, { x, y, width: TILE, height: TILE }, {
    resize: 'nearest',
    mode: 'max-alpha'
  });
}

function drawRun(canvas, images, assetIds, x, y) {
  assetIds.forEach((assetId, idx) => drawTile(canvas, images, assetId, x + idx * TILE, y));
}

function drawVerticalRun(canvas, images, assetIds, x, y) {
  assetIds.forEach((assetId, idx) => drawTile(canvas, images, assetId, x, y + idx * TILE));
}

function main() {
  const assetsDoc = loadJson(assetsPath);
  const mapDoc = loadJson(mapPath);
  const layer = terrainLayer(mapDoc);
  const tileSize = mapDoc.world?.tileSize || 256;
  const terrainAssets = assetsDoc.assets.filter((asset) => asset.type === 'terrain');
  const assetById = new Map(terrainAssets.map((asset) => [asset.id, asset]));
  const images = loadImages(assetById);

  if (!layer) {
    const canvas = createRaster(1, 1, BG);
    renderRasterReview({
      render: () => canvas,
      outputPath: outPng,
      manifestPath: outManifest,
      root: repoRoot,
      manifest: { schemaVersion: 1, status: 'empty', proofs: [] }
    });
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
  const canvas = createRaster(width, height, BG);

  drawRun(canvas, images, pathRun, PAD, pathY);
  drawVerticalRun(canvas, images, leftEdgeStack, PAD, edgeY);
  drawVerticalRun(canvas, images, rightEdgeStack, PAD + TILE + GAP, edgeY);

  rows.forEach((row, idx) => drawRun(canvas, images, row.assets, PAD, mapY + idx * TILE));

  pairs.forEach((pair, idx) => {
    const col = idx % pairCols;
    const row = Math.floor(idx / pairCols);
    const x = PAD + col * (pairBlock + GAP);
    const y = pairsY + row * pairBlock;
    fillRaster(canvas, EMPTY, { x, y, width: pairBlock, height: pairBlock });
    if (pair.dir === 'horizontal') {
      drawRun(canvas, images, pair.assets, x, y + Math.floor(TILE / 2));
    } else {
      drawVerticalRun(canvas, images, pair.assets, x + Math.floor(TILE / 2), y);
    }
  });

  const usedIds = new Set([
    ...pathRun,
    ...leftEdgeStack,
    ...rightEdgeStack,
    ...rows.flatMap((row) => row.assets),
    ...pairs.flatMap((pair) => pair.assets)
  ]);
  renderRasterReview({
    render: () => canvas,
    outputPath: outPng,
    manifestPath: outManifest,
    root: repoRoot,
    manifest: {
      schemaVersion: 1,
      status: 'preview',
      sourceRoot: path.relative(repoRoot, assetRoot) || '.',
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
    }
  });

  console.log(`home-field adjacency sheet: ${pairs.length} unique pair(s) -> ${path.relative(repoRoot, outPng)}`);
}

main();
