#!/usr/bin/env node
/**
 * Verify required Home Field chibi proof PNGs exist immediately after generation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../shared/repo-root.js';
import { readPngHeader } from './lib/bitmap-image-toolkit.js';

const referencePath = '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png';
const directions = ['down', 'up', 'left', 'right'];
const framePaths = directions.flatMap((dir) => [
  `.agent/home-field-workspace/raw/thalla_chibi.frame_idle_${dir}_0.source.png`,
  `.agent/home-field-workspace/raw/thalla_chibi.frame_idle_${dir}_1.source.png`,
  ...Array.from({ length: 6 }, (_, idx) => `.agent/home-field-workspace/raw/thalla_chibi.frame_walk_${dir}_${idx}.source.png`)
]);
const candidatePath = '.agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png';

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

function main() {
  const errors = [];
  const explicitPath = optionValue('path');
  if (explicitPath) {
    verifyPng(explicitPath, errors);
  } else {
    const checkAll = hasFlag('all') || (!hasFlag('reference') && !hasFlag('frames') && !hasFlag('candidate'));
    if (checkAll || hasFlag('reference')) verifyPng(referencePath, errors);
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
  console.log('home-field chibi proof file verification: PASS');
}

main();
