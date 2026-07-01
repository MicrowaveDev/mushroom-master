#!/usr/bin/env node
/**
 * Stage one supplied complete 8x4 chibi state sheet into the proof workspace.
 *
 * This is for user-supplied proof PNGs, not checked-in style/reference PNGs.
 * It copies the source sheet unchanged, then derives a small non-production
 * reference proxy from the first idle cell of each direction so candidate
 * evidence can bind the same local source chain without running imagegen.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  encodeDeterministicPng,
  fileSha256,
  readPngAsRgba,
  readPngHeader,
  repoRoot
} from './lib/bitmap-image-toolkit.js';

const COLS = 8;
const ROWS = 4;
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const WORKSPACE = '.agent/home-field-workspace';
const STATE_SHEET_PATH = `${WORKSPACE}/raw/thalla_chibi.states.source.png`;
const REFERENCE_PATH = `${WORKSPACE}/reference/thalla_chibi_turnaround.reference.png`;
const PROVENANCE_PATH = `${WORKSPACE}/review/thalla-local-state-sheet-source.manifest.json`;
const GENERATION_QUEUE_PATH = 'app/shared/home-field/home-field-generation-queue.json';
const GENERATION_QUEUE_ITEM_ID = 'thalla-stage1-chibi-proof';
const MAGENTA = [255, 0, 255, 255];

function usage() {
  return [
    'Usage: npm run game:home-field:stage-chibi-local-source -- [--source=<png>]',
    '',
    'Stages one supplied complete 8x4 Thalla state-sheet PNG from',
    '--source or the queue localSourceMode.sourcePath into the proof workspace.',
    'The source must be outside docs/reference/home-field/.'
  ].join('\n');
}

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

function queueLocalSourcePath() {
  try {
    const queue = JSON.parse(fs.readFileSync(path.join(repoRoot, GENERATION_QUEUE_PATH), 'utf8'));
    const item = (queue.items || []).find((entry) => entry.id === GENERATION_QUEUE_ITEM_ID);
    return item?.generationContract?.stateSheet?.localSourceMode?.sourcePath || '';
  } catch {
    return '';
  }
}

function resolveRepoPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(repoRoot, inputPath);
}

function repoRel(absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join('/');
}

function assertNotCheckedInReference(absPath) {
  const rel = repoRel(absPath);
  if (rel.startsWith('docs/reference/home-field/')) {
    throw new Error(`checked-in style/reference PNG is not a local proof source: ${rel}`);
  }
}

function assertCompleteStateSheet(header, sourceLabel) {
  const cellWidth = header.width / COLS;
  const cellHeight = header.height / ROWS;
  if (
    header.width % COLS !== 0 ||
    header.height % ROWS !== 0 ||
    cellWidth !== cellHeight ||
    cellWidth < 64
  ) {
    throw new Error(`${sourceLabel} must be a complete ${COLS}x${ROWS} state sheet with square cells at least 64px; got ${header.width}x${header.height}`);
  }
  return { cellWidth, cellHeight };
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

function resizeFrame(srcImage, dstWidth, dstHeight) {
  const dst = Buffer.alloc(dstWidth * dstHeight * 4);
  const xRatio = srcImage.width / dstWidth;
  const yRatio = srcImage.height / dstHeight;
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

function makeReferenceProxy(sheet, cellWidth, cellHeight) {
  const width = 512;
  const height = 384;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i + 0] = MAGENTA[0];
    rgba[i + 1] = MAGENTA[1];
    rgba[i + 2] = MAGENTA[2];
    rgba[i + 3] = MAGENTA[3];
  }

  DIRECTIONS.forEach((direction, row) => {
    const cropped = cropFrame(sheet, row, 0, cellWidth, cellHeight);
    const frame = resizeFrame(cropped, 64, 64);
    const dstX = 56 + row * 112;
    const dstY = 160;
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const srcOff = (y * frame.width + x) * 4;
        const dstOff = ((dstY + y) * width + dstX + x) * 4;
        const alpha = frame.rgba[srcOff + 3];
        if (alpha <= 16) continue;
        rgba[dstOff + 0] = frame.rgba[srcOff + 0];
        rgba[dstOff + 1] = frame.rgba[srcOff + 1];
        rgba[dstOff + 2] = frame.rgba[srcOff + 2];
        rgba[dstOff + 3] = 255;
      }
    }
  });

  return { width, height, rgba };
}

function sourceFromArgs() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(usage());
    process.exit(0);
  }
  const explicit = optionValue('source');
  if (explicit) return explicit;
  const queueSource = queueLocalSourcePath();
  if (queueSource) return queueSource;
  throw new Error('expected --source or a queue localSourceMode.sourcePath');
}

function main() {
  const source = sourceFromArgs();
  const sourceAbs = resolveRepoPath(source);
  if (!fs.existsSync(sourceAbs)) throw new Error(`missing local source PNG: ${source}`);
  assertNotCheckedInReference(sourceAbs);

  const header = readPngHeader(sourceAbs);
  const { cellWidth, cellHeight } = assertCompleteStateSheet(header, source);
  const sheet = readPngAsRgba(sourceAbs);

  const stateAbs = path.resolve(repoRoot, STATE_SHEET_PATH);
  const referenceAbs = path.resolve(repoRoot, REFERENCE_PATH);
  const provenanceAbs = path.resolve(repoRoot, PROVENANCE_PATH);
  fs.mkdirSync(path.dirname(stateAbs), { recursive: true });
  fs.mkdirSync(path.dirname(referenceAbs), { recursive: true });
  fs.mkdirSync(path.dirname(provenanceAbs), { recursive: true });

  if (path.resolve(sourceAbs) !== path.resolve(stateAbs)) {
    fs.copyFileSync(sourceAbs, stateAbs);
  }
  fs.writeFileSync(referenceAbs, encodeDeterministicPng(makeReferenceProxy(sheet, cellWidth, cellHeight)));

  const manifest = {
    schemaVersion: 1,
    stagedAt: new Date().toISOString(),
    mode: 'supplied-complete-8x4-local-state-sheet',
    source: {
      path: path.isAbsolute(source) ? source : repoRel(sourceAbs),
      width: header.width,
      height: header.height,
      cellWidth,
      cellHeight,
      sha256: fileSha256(sourceAbs)
    },
    stagedStateSheet: {
      path: STATE_SHEET_PATH,
      sha256: fileSha256(stateAbs)
    },
    referenceProxy: {
      path: REFERENCE_PATH,
      derivedFrom: 'first idle cell of each direction from stagedStateSheet',
      productionGeneratedReference: false,
      sha256: fileSha256(referenceAbs)
    }
  };
  fs.writeFileSync(provenanceAbs, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('home-field chibi local source stage: PASS');
  console.log(`  source: ${manifest.source.path}`);
  console.log(`  source sha256: ${manifest.source.sha256}`);
  console.log(`  state sheet: ${STATE_SHEET_PATH}`);
  console.log(`  reference proxy: ${REFERENCE_PATH}`);
  console.log(`  provenance: ${PROVENANCE_PATH}`);
}

try {
  main();
} catch (err) {
  console.error(`home-field chibi local source stage: FAIL - ${err.message}`);
  process.exit(1);
}
