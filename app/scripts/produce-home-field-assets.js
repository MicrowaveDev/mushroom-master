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

function findFrameRaws(sourcePath) {
  const dir = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath, '.source.png');
  const absDir = path.join(repoRoot, dir);
  if (!fs.existsSync(absDir)) return [];
  const re = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.frame_(\\d+)\\.source\\.png$`);
  const matches = fs
    .readdirSync(absDir)
    .map((f) => {
      const m = f.match(re);
      return m ? { file: path.join(dir, f), index: Number(m[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
  return matches;
}

function composeStrip(frameFiles, frameWidth, frameHeight) {
  const stripWidth = frameWidth * frameFiles.length;
  const stripHeight = frameHeight;
  const stripRgba = Buffer.alloc(stripWidth * stripHeight * 4);

  for (let f = 0; f < frameFiles.length; f += 1) {
    const frame = readPngRgba(path.join(repoRoot, frameFiles[f].file));
    if (frame.width !== frameWidth || frame.height !== frameHeight) {
      throw new Error(`frame ${frameFiles[f].file} is ${frame.width}x${frame.height}, expected ${frameWidth}x${frameHeight}`);
    }
    for (let y = 0; y < frameHeight; y += 1) {
      const srcOff = y * frameWidth * 4;
      const dstOff = (y * stripWidth + f * frameWidth) * 4;
      frame.rgba.copy(stripRgba, dstOff, srcOff, srcOff + frameWidth * 4);
    }
  }
  return { width: stripWidth, height: stripHeight, rgba: stripRgba };
}

function processStaticEntry(entry, opts) {
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

  const image = readPngRgba(stagedPath);
  if (image.width !== entry.width || image.height !== entry.height) {
    return {
      id: entry.id,
      ok: false,
      reason: `dimensions mismatch: file ${image.width}x${image.height}, expected ${entry.width}x${entry.height}`
    };
  }

  const encoded = encodeDeterministicPng({
    width: image.width,
    height: image.height,
    rgba: image.rgba
  });
  fs.writeFileSync(outAbs, encoded);

  let alphaSummary = null;
  if (entry.type !== 'terrain') {
    const stats = alphaStats(image, { x: 0, y: 0, w: image.width, h: image.height });
    alphaSummary = `coverage=${(stats.coverage * 100).toFixed(1)}%`;
    if (stats.coverage > 0.985) {
      return { id: entry.id, ok: false, reason: `no transparency detected; alpha coverage ${alphaSummary}` };
    }
  }

  return { id: entry.id, ok: true, output: entry.outputPath, alpha: alphaSummary, mode: 'static' };
}

function processAnimatedEntry(entry, opts) {
  const a = entry.animation;
  if (!a) return processStaticEntry(entry, opts);

  const rawAbs = path.join(repoRoot, entry.sourcePath);
  const frameFiles = findFrameRaws(entry.sourcePath);

  if (frameFiles.length === 0) {
    if (fs.existsSync(rawAbs)) {
      // Raw is a pre-composed strip; treat as static and let dimension check handle it.
      return processStaticEntry(entry, opts);
    }
    return {
      id: entry.id,
      ok: false,
      reason: `no raw frames found at ${path.dirname(entry.sourcePath)}/${path.basename(entry.sourcePath, '.source.png')}.frame_NN.source.png and no pre-composed strip at ${entry.sourcePath}`
    };
  }

  if (frameFiles.length !== a.frames) {
    return {
      id: entry.id,
      ok: false,
      reason: `expected ${a.frames} frame files, found ${frameFiles.length}`
    };
  }

  let strip;
  try {
    strip = composeStrip(frameFiles, a.frameWidth, a.frameHeight);
  } catch (err) {
    return { id: entry.id, ok: false, reason: err.message };
  }

  if (strip.width !== entry.width || strip.height !== entry.height) {
    return {
      id: entry.id,
      ok: false,
      reason: `composed strip ${strip.width}x${strip.height} != expected ${entry.width}x${entry.height}`
    };
  }

  const outAbs = path.join(repoRoot, entry.outputPath);
  ensureDir(path.dirname(outAbs));
  fs.writeFileSync(outAbs, encodeDeterministicPng(strip));

  // Alpha sanity (effects must be transparent).
  const stats = alphaStats({ width: strip.width, height: strip.height, rgba: strip.rgba }, { x: 0, y: 0, w: strip.width, h: strip.height });
  const alphaSummary = `coverage=${(stats.coverage * 100).toFixed(1)}%`;
  if (stats.coverage > 0.985) {
    return { id: entry.id, ok: false, reason: `composed strip has no transparency; alpha ${alphaSummary}` };
  }

  return { id: entry.id, ok: true, output: entry.outputPath, alpha: alphaSummary, mode: `frames(${a.frames})` };
}

function processEntry(entry, opts) {
  if (entry.type === 'character' && entry.spritesheet) return processCharacterPlaceholder(entry);
  if (entry.animation) return processAnimatedEntry(entry, opts);
  return processStaticEntry(entry, opts);
}

function characterEntryToAsset(c) {
  return {
    id: c.id,
    type: 'character',
    sourcePath: c.sourcePath,
    outputPath: c.outputPath,
    width: c.spritesheet.width,
    height: c.spritesheet.height,
    spritesheet: c.spritesheet
  };
}

function copyFrameInto(targetRgba, targetWidth, frame, dstRow, dstCol, frameWidth, frameHeight) {
  for (let y = 0; y < frameHeight; y += 1) {
    const srcOff = y * frameWidth * 4;
    const dstOff = ((dstRow * frameHeight + y) * targetWidth + dstCol * frameWidth) * 4;
    frame.rgba.copy(targetRgba, dstOff, srcOff, srcOff + frameWidth * 4);
  }
}

function processCharacterPlaceholder(entry) {
  const s = entry.spritesheet;
  const baseName = path.basename(entry.sourcePath, '.source.png'); // e.g. _placeholder_chibi
  const dir = path.dirname(entry.sourcePath);
  const rawDir = path.join(repoRoot, dir);
  if (!fs.existsSync(rawDir)) {
    return { id: entry.id, ok: false, reason: `raw dir missing: ${dir}` };
  }

  const required = [
    { row: 0, col: 0, file: `${baseName}.frame_idle_down_0.source.png` },
    { row: 0, col: 1, file: `${baseName}.frame_idle_down_1.source.png` },
    { row: 0, col: 'walk', file: `${baseName}.frame_walk_down.source.png` },
    { row: 1, col: 0, file: `${baseName}.frame_idle_up_0.source.png` },
    { row: 1, col: 1, file: `${baseName}.frame_idle_up_1.source.png` },
    { row: 1, col: 'walk', file: `${baseName}.frame_walk_up.source.png` },
    { row: 2, col: 0, file: `${baseName}.frame_idle_left_0.source.png` },
    { row: 2, col: 1, file: `${baseName}.frame_idle_left_1.source.png` },
    { row: 2, col: 'walk', file: `${baseName}.frame_walk_left.source.png` },
    { row: 3, col: 0, file: `${baseName}.frame_idle_right_0.source.png` },
    { row: 3, col: 1, file: `${baseName}.frame_idle_right_1.source.png` },
    { row: 3, col: 'walk', file: `${baseName}.frame_walk_right.source.png` }
  ];

  const missing = required.filter((r) => !fs.existsSync(path.join(rawDir, r.file)));
  if (missing.length > 0) {
    return {
      id: entry.id,
      ok: false,
      reason: `missing ${missing.length} placeholder frame(s): ${missing.map((m) => m.file).join(', ')}`
    };
  }

  const sheetRgba = Buffer.alloc(s.width * s.height * 4);
  for (const r of required) {
    const frame = readPngRgba(path.join(rawDir, r.file));
    if (frame.width !== s.frameWidth || frame.height !== s.frameHeight) {
      return {
        id: entry.id,
        ok: false,
        reason: `frame ${r.file} is ${frame.width}x${frame.height}, expected ${s.frameWidth}x${s.frameHeight}`
      };
    }
    if (r.col === 'walk') {
      // Replicate the walk frame across columns 2..7 of the row.
      for (let col = 2; col < 8; col += 1) {
        copyFrameInto(sheetRgba, s.width, frame, r.row, col, s.frameWidth, s.frameHeight);
      }
    } else {
      copyFrameInto(sheetRgba, s.width, frame, r.row, r.col, s.frameWidth, s.frameHeight);
    }
  }

  const outAbs = path.join(repoRoot, entry.outputPath);
  ensureDir(path.dirname(outAbs));
  fs.writeFileSync(outAbs, encodeDeterministicPng({ width: s.width, height: s.height, rgba: sheetRgba }));

  const stats = alphaStats({ width: s.width, height: s.height, rgba: sheetRgba }, { x: 0, y: 0, w: s.width, h: s.height });
  return {
    id: entry.id,
    ok: true,
    output: entry.outputPath,
    alpha: `coverage=${(stats.coverage * 100).toFixed(1)}%`,
    mode: 'character_placeholder(12+repl)'
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
      console.log(`  ${target.id}: OK [${r.mode || 'static'}] -> ${r.output}${r.alpha ? ` (${r.alpha})` : ''}`);
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
