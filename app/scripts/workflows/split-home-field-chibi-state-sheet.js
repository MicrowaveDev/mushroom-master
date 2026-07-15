#!/usr/bin/env node
/**
 * Split one generated chibi state sheet into the canonical raw frame files.
 *
 * The generator should create one coherent 8x4 image so all states share the
 * same rendering style. This script slices it into the raw frame names consumed
 * by produce-home-field-assets.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../../shared/repo-root.js';
import {
  encodeDeterministicPng,
  readPngAsRgba
} from '../lib/bitmap-image-toolkit.js';
import {
  chromaKeyRaster,
  createFrameGridFromDimensions,
  cropRaster,
  resizeRasterHybrid
} from '@microwavedev/backpack-game-core/tooling/raster';

const DEFAULT_SOURCE = '.agent/home-field-workspace/raw/thalla_chibi.states.source.png';
const DEFAULT_OUTPUT_DIR = '.agent/home-field-workspace/raw';
const DEFAULT_PREFIX = 'thalla_chibi';
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const COLS = 8;
const ROWS = 4;
const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 64;

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseHexColor(value) {
  const hex = value.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`--chroma-key must be #rrggbb, got "${value}"`);
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16)
  ];
}

function resizeFrame(srcImage, dstWidth, dstHeight) {
  return resizeRasterHybrid(srcImage, dstWidth, dstHeight);
}

function cropFrame(sheet, row, col, cellWidth, cellHeight) {
  return cropRaster(sheet, {
    x: col * cellWidth,
    y: row * cellHeight,
    width: cellWidth,
    height: cellHeight
  });
}

function applyChromaKey(image, rgb, tolerance) {
  return chromaKeyRaster(image, rgb, { tolerance, clearRgb: false });
}

function frameName(prefix, direction, col) {
  if (col < 2) return `${prefix}.frame_idle_${direction}_${col}.source.png`;
  return `${prefix}.frame_walk_${direction}_${col - 2}.source.png`;
}

function main() {
  const source = optionValue('source') || DEFAULT_SOURCE;
  const outputDir = optionValue('output-dir') || DEFAULT_OUTPUT_DIR;
  const prefix = optionValue('prefix') || DEFAULT_PREFIX;
  const chromaKey = optionValue('chroma-key');
  const tolerance = Number(optionValue('chroma-tolerance') || 28);
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error('--chroma-tolerance must be a non-negative number');
  }

  const sourceAbs = path.resolve(repoRoot, source);
  const outputAbs = path.resolve(repoRoot, outputDir);
  if (!fs.existsSync(sourceAbs)) {
    console.error(`missing state sheet: ${source}`);
    process.exit(1);
  }

  let sheet = readPngAsRgba(sourceAbs);
  const sourceSize = `${sheet.width}x${sheet.height}`;
  let grid;
  try {
    grid = createFrameGridFromDimensions(sheet, { columns: COLS, rows: ROWS });
  } catch {
    grid = null;
  }
  if (!grid && hasFlag('resize')) {
    sheet = resizeFrame(sheet, COLS * FRAME_WIDTH, ROWS * FRAME_HEIGHT);
    grid = createFrameGridFromDimensions(sheet, { columns: COLS, rows: ROWS });
  }
  if (!grid) {
    console.error(`state sheet must divide into ${COLS}x${ROWS} cells, got ${sourceSize}; pass --resize for larger proportional source sheets`);
    process.exit(1);
  }

  const cellWidth = grid.frameWidth;
  const cellHeight = grid.frameHeight;
  const keyRgb = chromaKey ? parseHexColor(chromaKey) : null;
  fs.mkdirSync(outputAbs, { recursive: true });

  const written = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const direction = DIRECTIONS[row];
      let frame = cropFrame(sheet, row, col, cellWidth, cellHeight);
      if (keyRgb) frame = applyChromaKey(frame, keyRgb, tolerance);
      if (frame.width !== FRAME_WIDTH || frame.height !== FRAME_HEIGHT || hasFlag('resize')) {
        frame = resizeFrame(frame, FRAME_WIDTH, FRAME_HEIGHT);
      }
      const outFile = frameName(prefix, direction, col);
      const outPath = path.join(outputAbs, outFile);
      fs.writeFileSync(outPath, encodeDeterministicPng(frame));
      written.push(path.relative(repoRoot, outPath));
    }
  }

  console.log(`home-field chibi state sheet split: ${written.length} frame(s)`);
  console.log(`  source: ${source}`);
  console.log(`  grid: ${COLS}x${ROWS}, source: ${sourceSize}, working cell: ${cellWidth}x${cellHeight}, output frame: ${FRAME_WIDTH}x${FRAME_HEIGHT}`);
  console.log(`  output-dir: ${outputDir}`);
  if (keyRgb) console.log(`  chroma-key: ${chromaKey}, tolerance=${tolerance}`);
  for (const file of written) console.log(`  OK ${file}`);
}

main();
