#!/usr/bin/env node
/**
 * Process raw imagegen output into the app-facing PNG for one or more home-field assets.
 *
 * Usage:
 *   npm run game:home-field:produce -- grass_base_01 grass_base_02
 *   npm run game:home-field:produce -- --all-missing
 *
 * Behavior per asset:
 *   1. Read .agent/home-field-workspace/raw/<id>.source.png.
 *   2. Optionally remove a chroma-key background (default: no chroma-key; imagegen
 *      should return transparent PNG. Pass --chroma-key=#ff00ff to force removal).
 *   3. Validate dimensions match home-field-assets.json.
 *   4. Write the deterministic PNG to the asset's outputPath (under web/public/home-field/).
 *
 * This script does NOT call imagegen. It assumes imagegen output already exists at the
 * raw source path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  encodeDeterministicPng,
  readPngRgba,
  alphaStats
} from './lib/bitmap-image-toolkit.js';
import { validateAssets } from '../shared/home-field/home-field-validator.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = path.join(sharedDir, 'home-field-assets.json');
const workspace = process.env.HOME_FIELD_WORKSPACE
  ? path.resolve(process.env.HOME_FIELD_WORKSPACE)
  : path.join(repoRoot, '.agent', 'home-field-workspace');
const manifestDir = path.join(workspace, 'manifests');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseArgs(argv) {
  const ids = [];
  let chromaKey = null;
  let allMissing = false;
  for (const arg of argv) {
    if (arg === '--all-missing') allMissing = true;
    else if (arg.startsWith('--chroma-key=')) chromaKey = arg.slice('--chroma-key='.length);
    else ids.push(arg.replace(/\.png$/, ''));
  }
  return { ids, chromaKey, allMissing };
}

function chromaKeyScriptPath() {
  const candidate = path.join(
    process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex'),
    'skills',
    '.system',
    'imagegen',
    'scripts',
    'remove_chroma_key.py'
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function pythonBin() {
  const bundled = path.join(
    process.env.HOME || '',
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'python',
    'bin',
    'python3'
  );
  return process.env.PYTHON || (fs.existsSync(bundled) ? bundled : 'python3');
}

function runChromaKey(rawPath, outPath, keyColor) {
  const script = chromaKeyScriptPath();
  if (!script) {
    console.warn(`  chroma-key requested but script not found at ${script}; copying raw to staging instead.`);
    fs.copyFileSync(rawPath, outPath);
    return;
  }
  const result = spawnSync(pythonBin(), [script, rawPath, outPath, '--key', keyColor], {
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    throw new Error(`chroma-key script exited with status ${result.status}`);
  }
}

function processEntry(entry, opts) {
  const rawAbs = path.join(repoRoot, entry.sourcePath);
  const outAbs = path.join(repoRoot, entry.outputPath);
  ensureDir(path.dirname(outAbs));

  if (!fs.existsSync(rawAbs)) {
    return { id: entry.id, ok: false, reason: `raw missing: ${entry.sourcePath}` };
  }

  const stagedPath = path.join(workspace, 'processed', `${entry.id}.staged.png`);
  ensureDir(path.dirname(stagedPath));

  if (opts.chromaKey) {
    runChromaKey(rawAbs, stagedPath, opts.chromaKey);
  } else {
    fs.copyFileSync(rawAbs, stagedPath);
  }

  const expectedWidth = entry.width;
  const expectedHeight = entry.height;
  const image = readPngRgba(stagedPath);
  if (image.width !== expectedWidth || image.height !== expectedHeight) {
    return {
      id: entry.id,
      ok: false,
      reason: `dimensions mismatch: file ${image.width}x${image.height}, expected ${expectedWidth}x${expectedHeight}`
    };
  }

  // Re-encode deterministically (strip metadata, normalize) so commits are reproducible.
  const encoded = encodeDeterministicPng({
    width: image.width,
    height: image.height,
    rgba: image.rgba
  });
  fs.writeFileSync(outAbs, encoded);

  // Alpha sanity for transparent-required types.
  let alphaSummary = null;
  if (entry.type !== 'terrain') {
    const stats = alphaStats(image, { x: 0, y: 0, w: image.width, h: image.height });
    alphaSummary = `coverage=${(stats.coverage * 100).toFixed(1)}%`;
    if (stats.coverage > 0.985) {
      return { id: entry.id, ok: false, reason: `no transparency detected; alpha coverage ${alphaSummary}` };
    }
  }

  return { id: entry.id, ok: true, output: entry.outputPath, alpha: alphaSummary };
}

function characterEntryToAsset(c) {
  return {
    id: c.id,
    type: 'character',
    sourcePath: c.sourcePath,
    outputPath: c.outputPath,
    width: c.spritesheet.width,
    height: c.spritesheet.height
  };
}

function writeManifest(results, opts) {
  ensureDir(manifestDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestPath = path.join(manifestDir, `produce-${stamp}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    options: opts,
    results
  }, null, 2));
  console.log(`  manifest: ${path.relative(repoRoot, manifestPath)}`);
}

function main() {
  const { ids, chromaKey, allMissing } = parseArgs(process.argv.slice(2));
  if (ids.length === 0 && !allMissing) {
    console.error('Usage: produce-home-field-assets.js <asset_id...> | --all-missing [--chroma-key=#ff00ff]');
    process.exit(1);
  }

  const assetsDoc = loadJson(ASSETS_PATH);
  const schemaCheck = validateAssets(assetsDoc);
  if (!schemaCheck.ok) {
    console.error('home-field-assets.json failed schema validation; refusing to run:');
    for (const e of schemaCheck.errors) console.error(`  [${e.code}] ${e.message}`);
    process.exit(1);
  }

  const allEntries = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map(characterEntryToAsset)
  ];
  const byId = new Map(allEntries.map((e) => [e.id, e]));

  let targets = [];
  if (allMissing) {
    targets = allEntries.filter((e) => !fs.existsSync(path.join(repoRoot, e.outputPath)));
  } else {
    for (const id of ids) {
      const entry = byId.get(id);
      if (!entry) {
        console.error(`Unknown asset id: ${id}`);
        process.exit(1);
      }
      targets.push(entry);
    }
  }

  if (targets.length === 0) {
    console.log('Nothing to produce.');
    return;
  }

  console.log(`Producing ${targets.length} asset${targets.length === 1 ? '' : 's'}...`);
  const results = [];
  for (const target of targets) {
    const r = processEntry(target, { chromaKey });
    if (r.ok) {
      console.log(`  ${target.id}: OK -> ${r.output}${r.alpha ? ` (${r.alpha})` : ''}`);
    } else {
      console.error(`  ${target.id}: FAIL — ${r.reason}`);
    }
    results.push(r);
  }
  writeManifest(results, { chromaKey, allMissing });

  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
