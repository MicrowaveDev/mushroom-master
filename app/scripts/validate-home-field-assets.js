#!/usr/bin/env node
/**
 * CLI wrapper around app/shared/home-field/home-field-validator.js.
 *
 * Run:
 *   npm run game:home-field:validate
 *   npm run game:home-field:validate -- --check-files
 *
 * Default behavior validates schema only (does not require any PNGs to exist yet),
 * so Phase 0 can land before imagegen runs. Pass --check-files to also assert that
 * each asset's outputPath exists with the expected dimensions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAll } from '../shared/home-field/home-field-validator.js';
import { readPngHeader } from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = path.join(sharedDir, 'home-field-assets.json');
const MAP_PATH = path.join(sharedDir, 'home-field-map.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function checkFiles(assetsDoc, errors) {
  const allEntries = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((c) => ({
      id: c.id,
      outputPath: c.outputPath,
      width: c.spritesheet.width,
      height: c.spritesheet.height,
      isCharacter: true
    }))
  ];
  for (const a of allEntries) {
    const abs = path.join(repoRoot, a.outputPath);
    if (!fs.existsSync(abs)) {
      errors.push({ scope: 'files', code: 'missing', message: `asset "${a.id}" output missing: ${a.outputPath}` });
      continue;
    }
    try {
      const header = readPngHeader(abs);
      if (header.width !== a.width || header.height !== a.height) {
        errors.push({
          scope: 'files',
          code: 'dimensions',
          message: `asset "${a.id}" dimensions mismatch: file ${header.width}x${header.height}, expected ${a.width}x${a.height}`
        });
      }
    } catch (err) {
      errors.push({ scope: 'files', code: 'png_header', message: `asset "${a.id}" cannot read PNG header: ${err.message}` });
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const wantFileCheck = hasFlag(argv, 'check-files');

  if (!fs.existsSync(ASSETS_PATH)) {
    console.error(`home-field-assets.json not found at ${ASSETS_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(MAP_PATH)) {
    console.error(`home-field-map.json not found at ${MAP_PATH}`);
    process.exit(1);
  }

  const assetsDoc = loadJson(ASSETS_PATH);
  const mapDoc = loadJson(MAP_PATH);

  const result = validateAll(assetsDoc, mapDoc);
  const errors = [...result.errors];

  if (wantFileCheck) {
    checkFiles(assetsDoc, errors);
  }

  if (errors.length === 0) {
    console.log('home-field validation: PASS');
    const fileMode = wantFileCheck ? ' + file existence/dimensions' : ' (schema only; pass --check-files to verify PNGs)';
    console.log(`  schema for ${assetsDoc.assets.length} assets + ${(assetsDoc.characters || []).length} characters + ${(mapDoc.layers || []).length} map layers${fileMode}`);
    process.exit(0);
  }

  console.error(`home-field validation: FAIL (${errors.length} error${errors.length === 1 ? '' : 's'})`);
  for (const err of errors) {
    console.error(`  [${err.scope}.${err.code}] ${err.message}`);
  }
  process.exit(1);
}

main();
