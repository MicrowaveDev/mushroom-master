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
import { repoRoot } from '../shared/repo-root.js';
import {
  encodeDeterministicPng,
  readPngAsRgba
} from './lib/bitmap-image-toolkit.js';

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
  const dst = Buffer.alloc(dstWidth * dstHeight * 4);
  const xRatio = srcImage.width / dstWidth;
  const yRatio = srcImage.height / dstHeight;
  if (srcImage.width < dstWidth || srcImage.height < dstHeight) {
    for (let y = 0; y < dstHeight; y += 1) {
      const sy = Math.min(srcImage.height - 1, Math.floor(y * yRatio));
      for (let x = 0; x < dstWidth; x += 1) {
        const sx = Math.min(srcImage.width - 1, Math.floor(x * xRatio));
        const srcOff = (sy * srcImage.width + sx) * 4;
        const dstOff = (y * dstWidth + x) * 4;
        srcImage.rgba.copy(dst, dstOff, srcOff, srcOff + 4);
      }
    }
    return { width: dstWidth, height: dstHeight, rgba: dst };
  }

  for (let y = 0; y < dstHeight; y += 1) {
    const sy0 = Math.floor(y * yRatio);
    const sy1 = Math.min(srcImage.height, Math.ceil((y + 1) * yRatio));
    for (let x = 0; x < dstWidth; x += 1) {
      const sx0 = Math.floor(x * xRatio);
      const sx1 = Math.min(srcImage.width, Math.ceil((x + 1) * xRatio));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = sy0; yy < sy1; yy += 1) {
        for (let xx = sx0; xx < sx1; xx += 1) {
          const srcOff = (yy * srcImage.width + xx) * 4;
          r += srcImage.rgba[srcOff + 0];
          g += srcImage.rgba[srcOff + 1];
          b += srcImage.rgba[srcOff + 2];
          a += srcImage.rgba[srcOff + 3];
          n += 1;
        }
      }
      const dstOff = (y * dstWidth + x) * 4;
      dst[dstOff + 0] = Math.round(r / n);
      dst[dstOff + 1] = Math.round(g / n);
      dst[dstOff + 2] = Math.round(b / n);
      dst[dstOff + 3] = Math.round(a / n);
    }
  }
  return { width: dstWidth, height: dstHeight, rgba: dst };
}

function cropFrame(sheet, row, col, cellWidth, cellHeight) {
  const rgba = Buffer.alloc(cellWidth * cellHeight * 4);
  for (let y = 0; y < cellHeight; y += 1) {
    const srcOff = ((row * cellHeight + y) * sheet.width + col * cellWidth) * 4;
    const dstOff = y * cellWidth * 4;
    sheet.rgba.copy(rgba, dstOff, srcOff, srcOff + (cellWidth * 4));
  }
  return { width: cellWidth, height: cellHeight, rgba };
}

function applyChromaKey(image, rgb, tolerance) {
  const rgba = Buffer.from(image.rgba);
  for (let i = 0; i < rgba.length; i += 4) {
    const distance = Math.sqrt(
      ((rgba[i + 0] - rgb[0]) ** 2) +
      ((rgba[i + 1] - rgb[1]) ** 2) +
      ((rgba[i + 2] - rgb[2]) ** 2)
    );
    if (distance <= tolerance) {
      rgba[i + 3] = 0;
    }
  }
  return { width: image.width, height: image.height, rgba };
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
  if ((sheet.width % COLS !== 0 || sheet.height % ROWS !== 0) && hasFlag('resize')) {
    sheet = resizeFrame(sheet, COLS * FRAME_WIDTH, ROWS * FRAME_HEIGHT);
  }
  if (sheet.width % COLS !== 0 || sheet.height % ROWS !== 0) {
    console.error(`state sheet must divide into ${COLS}x${ROWS} cells, got ${sourceSize}; pass --resize for larger proportional source sheets`);
    process.exit(1);
  }

  const cellWidth = sheet.width / COLS;
  const cellHeight = sheet.height / ROWS;
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
