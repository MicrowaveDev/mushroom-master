#!/usr/bin/env node
/**
 * Verify required Home Field chibi proof PNGs exist immediately after generation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../../shared/repo-root.js';
import { readPngAsRgba, readPngHeader } from '../lib/bitmap-image-toolkit.js';

const referencePath = '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png';
const stateSheetPath = '.agent/home-field-workspace/raw/thalla_chibi.states.source.png';
const directions = ['down', 'up', 'left', 'right'];
const framePaths = directions.flatMap((dir) => [
  `.agent/home-field-workspace/raw/thalla_chibi.frame_idle_${dir}_0.source.png`,
  `.agent/home-field-workspace/raw/thalla_chibi.frame_idle_${dir}_1.source.png`,
  ...Array.from({ length: 6 }, (_, idx) => `.agent/home-field-workspace/raw/thalla_chibi.frame_walk_${dir}_${idx}.source.png`)
]);
const candidatePath = '.agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png';
const referenceSpriteBoxMax = 128;
const referenceMajorBlobMinPixels = 200;

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

function verifyPng(relPath, errors, { expectedWidth = null, expectedHeight = null } = {}) {
  const abs = path.resolve(repoRoot, relPath);
  if (!fs.existsSync(abs)) {
    errors.push(`missing ${relPath}`);
    return;
  }
  try {
    const header = readPngHeader(abs);
    if (expectedWidth && header.width !== expectedWidth) {
      errors.push(`${relPath} width=${header.width}, expected ${expectedWidth}`);
    }
    if (expectedHeight && header.height !== expectedHeight) {
      errors.push(`${relPath} height=${header.height}, expected ${expectedHeight}`);
    }
    console.log(`OK ${relPath} ${header.width}x${header.height}`);
  } catch (err) {
    errors.push(`${relPath} is not a readable PNG: ${err.message}`);
  }
}

function isReferenceBackground(r, g, b, a) {
  if (a <= 16) return true;
  return r >= 220 && g <= 88 && b >= 180 && Math.abs(r - b) <= 96;
}

function findVisibleBlobs(image) {
  const { width, height, rgba } = image;
  const visible = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    visible[i] = isReferenceBackground(rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3]) ? 0 : 1;
  }

  const seen = new Uint8Array(width * height);
  const blobs = [];
  const stack = [];
  for (let start = 0; start < visible.length; start += 1) {
    if (!visible[start] || seen[start]) continue;
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const idx = stack.pop();
      const x = idx % width;
      const y = Math.floor(idx / width);
      pixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x + 1 < width ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y + 1 < height ? idx + width : -1
      ];
      for (const next of neighbors) {
        if (next < 0 || !visible[next] || seen[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    blobs.push({
      pixels,
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    });
  }
  return blobs.sort((a, b) => b.pixels - a.pixels);
}

function verifyReferenceSpriteBoxes(relPath, errors) {
  const abs = path.resolve(repoRoot, relPath);
  if (!fs.existsSync(abs)) return;
  try {
    const image = readPngAsRgba(abs);
    const majorBlobs = findVisibleBlobs(image)
      .filter((blob) => blob.pixels >= referenceMajorBlobMinPixels);
    const oversizeBlobs = majorBlobs
      .filter((blob) => blob.width > referenceSpriteBoxMax || blob.height > referenceSpriteBoxMax);
    if (majorBlobs.length < 4) {
      errors.push(`${relPath} has ${majorBlobs.length} major non-magenta sprite blobs, expected at least 4 tiny source-sprite views`);
    }
    if (oversizeBlobs.length > 0) {
      const summary = oversizeBlobs
        .slice(0, 4)
        .map((blob) => `${blob.width}x${blob.height}`)
        .join(', ');
      errors.push(`${relPath} has oversized source-sprite blob(s) ${summary}; expected each major blob to fit within ${referenceSpriteBoxMax}x${referenceSpriteBoxMax}px for the 96x96 sprite-box reference contract`);
    }
    console.log(`Reference sprite-box occupancy: ${majorBlobs.length} major blob(s), max ${Math.max(0, ...majorBlobs.map((blob) => blob.width))}x${Math.max(0, ...majorBlobs.map((blob) => blob.height))}`);
  } catch (err) {
    errors.push(`${relPath} reference sprite-box occupancy check failed: ${err.message}`);
  }
}

function main() {
  const errors = [];
  const explicitPath = optionValue('path');
  if (explicitPath) {
    verifyPng(explicitPath, errors);
  } else {
    const checkAll = hasFlag('all') || (!hasFlag('reference') && !hasFlag('state-sheet') && !hasFlag('frames') && !hasFlag('candidate'));
    if (checkAll || hasFlag('reference')) {
      verifyPng(referencePath, errors);
      verifyReferenceSpriteBoxes(referencePath, errors);
    }
    if (checkAll || hasFlag('state-sheet')) verifyPng(stateSheetPath, errors);
    if (checkAll || hasFlag('frames')) {
      framePaths.forEach((framePath) => verifyPng(framePath, errors, { expectedWidth: 64, expectedHeight: 64 }));
    }
    if (checkAll || hasFlag('candidate')) verifyPng(candidatePath, errors, { expectedWidth: 512, expectedHeight: 256 });
  }

  if (errors.length > 0) {
    console.error(`home-field chibi proof file verification: FAIL (${errors.length})`);
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
  console.log('Freshness warning: this check proves files exist and have expected dimensions only; it does not prove they were generated in the current run. Do not use stale rejected .agent files as generation evidence.');
  console.log('home-field chibi proof file verification: PASS');
}

main();
