#!/usr/bin/env node
/**
 * Process raw imagegen output into the app-facing PNG for one or more home-field assets.
 *
 * Usage:
 *   npm run game:home-field:produce -- grass_base_01 grass_base_02
 *   npm run game:home-field:produce -- --all-missing
 *   npm run game:home-field:produce -- bush_cluster_dark_01 --candidate
 *
 * Behavior per asset:
 *   1. Read .agent/home-field-workspace/raw/<id>.source.png.
 *   2. Optionally remove a chroma-key background (default: no chroma-key; imagegen
 *      should return transparent PNG. Pass --chroma-key=#ff00ff to force removal).
 *   3. Validate dimensions match home-field-assets.json.
 *   4. Write the deterministic PNG to the asset's outputPath (under web/public/home-field/)
 *      or, with --candidate, under .agent/home-field-workspace/candidates/object-layer/latest.
 *
 * This script does NOT call imagegen. It assumes imagegen output already exists at the
 * raw source path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeEvidenceManifest } from '@microwavedev/backpack-game-core/tooling/evidence';
import {
  composePngFrameGrid,
  findIndexedFiles
} from '@microwavedev/backpack-game-core/tooling/frame-files';
import { averageRegionRgb, rgbDistance } from '@microwavedev/backpack-game-core/tooling/image-analysis';
import {
  encodeDeterministicPng,
  readPngAsRgba,
  readPngRgba,
  alphaStats
} from '../lib/bitmap-image-toolkit.js';
import {
  blendRasterOppositeEdges,
  blendRasterTowardAverage,
  compositeRaster,
  createRaster,
  cropRaster,
  resizeRasterHybrid,
  resizeRasterNearest
} from '@microwavedev/backpack-game-core/tooling/raster';
import { runChildProcessSync } from '@microwavedev/backpack-game-core/tooling/runners';
import { validateAssets } from '../../shared/home-field/home-field-validator.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = process.env.HOME_FIELD_ASSETS_PATH
  ? path.resolve(process.env.HOME_FIELD_ASSETS_PATH)
  : path.join(sharedDir, 'home-field-assets.json');
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
  let help = false;
  let chromaKey = null;
  let allMissing = false;
  let candidate = false;
  let candidateRoot = path.join(workspace, 'candidates', 'object-layer', 'latest');
  let resize = null;
  let seamlessTerrain = false;
  let cropCenter = null;
  let quietTerrain = null;
  let scope = null;
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--all-missing') allMissing = true;
    else if (arg === '--candidate') candidate = true;
    else if (arg.startsWith('--candidate-root=')) {
      candidate = true;
      candidateRoot = path.resolve(repoRoot, arg.slice('--candidate-root='.length));
    }
    else if (arg.startsWith('--scope=')) {
      scope = arg.slice('--scope='.length);
      const roots = {
        objects: 'object-layer',
        chibi: 'chibi-active-roster',
        terrain: 'terrain-family'
      };
      if (!roots[scope]) {
        throw new Error(`--scope must be one of ${Object.keys(roots).join('|')}`);
      }
      candidate = true;
      candidateRoot = path.join(workspace, 'candidates', roots[scope], 'latest');
    }
    else if (arg === '--resize') resize = 'lanczos';
    else if (arg === '--resize-nearest') resize = 'nearest';
    else if (arg === '--seamless-terrain') seamlessTerrain = true;
    else if (arg === '--crop-center') cropCenter = 0.82;
    else if (arg.startsWith('--crop-center=')) cropCenter = Number(arg.slice('--crop-center='.length));
    else if (arg === '--quiet-terrain') quietTerrain = 0.35;
    else if (arg.startsWith('--quiet-terrain=')) quietTerrain = Number(arg.slice('--quiet-terrain='.length));
    else if (arg.startsWith('--chroma-key=')) chromaKey = arg.slice('--chroma-key='.length);
    else ids.push(arg.replace(/\.png$/, ''));
  }
  if (cropCenter !== null && (!Number.isFinite(cropCenter) || cropCenter <= 0 || cropCenter > 1)) {
    throw new Error('--crop-center must be a number in the range (0, 1]');
  }
  if (quietTerrain !== null && (!Number.isFinite(quietTerrain) || quietTerrain < 0 || quietTerrain > 1)) {
    throw new Error('--quiet-terrain must be a number in the range [0, 1]');
  }
  return { ids, help, chromaKey, allMissing, candidate, candidateRoot, resize, seamlessTerrain, cropCenter, quietTerrain, scope };
}

function printUsage(stream = console.error) {
  stream('Usage: produce-home-field-assets.js <asset_id...> | --all-missing');
  stream('  Options:');
  stream('    --scope=objects|chibi|terrain  write to the matching candidate workspace');
  stream('    --help                 print this help and exit');
  stream('    --chroma-key=#ff00ff   strip a flat key color from imagegen output before alpha check');
  stream('    --candidate             write under .agent/home-field-workspace/candidates/object-layer/latest instead of web/public');
  stream('    --candidate-root=<dir>  write candidate outputs under a custom root');
  stream('    --resize               Lanczos downscale raw to target dimensions (use for terrain/props/exits/chibi candidates)');
  stream('    --resize-nearest       nearest-neighbor downscale (diagnostic only; do not use for Home Field chibi production candidates)');
  stream('    --seamless-terrain     softly harmonize opposite terrain edges for repeatable ground tiles');
  stream('    --crop-center[=0.82]   crop terrain raw around center before resize to remove imagegen edge vignettes');
  stream('    --quiet-terrain[=0.35] reduce broad generated lighting variation so repeats are less obvious');
}

function resizeRgba(srcImage, dstWidth, dstHeight, mode) {
  return mode === 'nearest'
    ? resizeRasterNearest(srcImage, dstWidth, dstHeight)
    : resizeRasterHybrid(srcImage, dstWidth, dstHeight);
}

function cropCenterRgba(srcImage, ratio) {
  if (!ratio || ratio >= 1) return srcImage;
  const cropSize = Math.max(1, Math.floor(Math.min(srcImage.width, srcImage.height) * ratio));
  const startX = Math.floor((srcImage.width - cropSize) / 2);
  const startY = Math.floor((srcImage.height - cropSize) / 2);
  return cropRaster(srcImage, { x: startX, y: startY, width: cropSize, height: cropSize });
}

function makeTerrainSeamless(image, margin = 48) {
  return blendRasterOppositeEdges(image, { margin });
}

function quietTerrainContrast(image, amount) {
  if (!amount) return image;
  return blendRasterTowardAverage(image, amount);
}

function detectOpaqueCheckerboardMatte(image) {
  const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
  if (stats.coverage < 0.985) return null;

  const s = Math.max(4, Math.floor(Math.min(image.width, image.height) * 0.08));
  const corners = [
    averageRegionRgb(image, { x: 0, y: 0, width: s, height: s }),
    averageRegionRgb(image, { x: image.width - s, y: 0, width: s, height: s }),
    averageRegionRgb(image, { x: 0, y: image.height - s, width: s, height: s }),
    averageRegionRgb(image, { x: image.width - s, y: image.height - s, width: s, height: s })
  ];
  const distances = [
    rgbDistance(corners[0], corners[1]),
    rgbDistance(corners[0], corners[2]),
    rgbDistance(corners[1], corners[3]),
    rgbDistance(corners[2], corners[3])
  ];
  const maxDistance = Math.max(...distances);
  const avgBrightness = corners
    .map((c) => (c[0] + c[1] + c[2]) / 3)
    .reduce((sum, v) => sum + v, 0) / corners.length;
  if (maxDistance >= 10 && maxDistance <= 70 && avgBrightness >= 70 && avgBrightness <= 210) {
    return `opaque checkerboard-like matte detected in corners (max RGB distance ${maxDistance.toFixed(1)}); regenerate on a flat chroma-key background or pass --chroma-key`;
  }
  return null;
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
  const result = runChildProcessSync(
    pythonBin(),
    [
      script,
      '--input',
      rawPath,
      '--out',
      outPath,
      '--key-color',
      keyColor,
      '--soft-matte',
      '--despill',
      '--force'
    ],
    { stdio: 'inherit', allowFailure: true }
  );
  if (result.status !== 0) {
    throw new Error(`chroma-key script exited with status ${result.status}`);
  }
}

function outputAbsFor(entry, opts) {
  return opts.candidate
    ? path.join(opts.candidateRoot, entry.outputPath)
    : path.join(repoRoot, entry.outputPath);
}

function outputLabelFor(entry, opts) {
  return opts.candidate
    ? path.relative(repoRoot, path.join(opts.candidateRoot, entry.outputPath))
    : entry.outputPath;
}

function processStaticEntry(entry, opts) {
  const rawAbs = path.join(repoRoot, entry.sourcePath);
  const outAbs = outputAbsFor(entry, opts);
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

  let image = readPngAsRgba(stagedPath);
  if (opts.cropCenter && entry.type === 'terrain') {
    image = cropCenterRgba(image, opts.cropCenter);
  }
  if (image.width !== entry.width || image.height !== entry.height) {
    if (opts.resize) {
      image = resizeRgba(image, entry.width, entry.height, opts.resize);
    } else {
      return {
        id: entry.id,
        ok: false,
        reason: `dimensions mismatch: file ${image.width}x${image.height}, expected ${entry.width}x${entry.height} (pass --resize or --resize-nearest to scale)`
      };
    }
  }
  if (opts.seamlessTerrain && entry.type === 'terrain') {
    image = makeTerrainSeamless(image);
  }
  if (opts.quietTerrain && entry.type === 'terrain') {
    image = quietTerrainContrast(image, opts.quietTerrain);
  }

  let alphaSummary = null;
  if (entry.type !== 'terrain') {
    const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
    alphaSummary = `coverage=${(stats.coverage * 100).toFixed(1)}%`;
    if (stats.coverage > 0.985) {
      const matteReason = detectOpaqueCheckerboardMatte(image);
      return { id: entry.id, ok: false, reason: matteReason || `no transparency detected; alpha coverage ${alphaSummary}` };
    }
  }

  const encoded = encodeDeterministicPng({
    width: image.width,
    height: image.height,
    rgba: image.rgba
  });
  fs.writeFileSync(outAbs, encoded);

  return { id: entry.id, ok: true, output: outputLabelFor(entry, opts), alpha: alphaSummary, mode: 'static' };
}

function processAnimatedEntry(entry, opts) {
  const a = entry.animation;
  if (!a) return processStaticEntry(entry, opts);

  const rawAbs = path.join(repoRoot, entry.sourcePath);
  const sourceDir = path.dirname(entry.sourcePath);
  const sourceBaseName = path.basename(entry.sourcePath, '.source.png');
  const frameFiles = findIndexedFiles(sourceDir, {
    root: repoRoot,
    prefix: `${sourceBaseName}.frame_`,
    suffix: '.source.png'
  });

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
    strip = composePngFrameGrid(frameFiles.map(({ file }) => file), {
      root: repoRoot,
      frameWidth: a.frameWidth,
      frameHeight: a.frameHeight,
      resize: opts.resize ? (opts.resize === 'nearest' ? 'nearest' : 'hybrid') : undefined,
      mode: 'copy'
    });
  } catch (err) {
    const resizeHint = !opts.resize && /, expected \d+x\d+$/.test(err.message)
      ? ' (pass --resize to scale)'
      : '';
    return { id: entry.id, ok: false, reason: `${err.message}${resizeHint}` };
  }

  if (strip.width !== entry.width || strip.height !== entry.height) {
    return {
      id: entry.id,
      ok: false,
      reason: `composed strip ${strip.width}x${strip.height} != expected ${entry.width}x${entry.height}`
    };
  }

  const outAbs = outputAbsFor(entry, opts);
  ensureDir(path.dirname(outAbs));
  fs.writeFileSync(outAbs, encodeDeterministicPng(strip));

  // Alpha sanity (effects must be transparent).
  const stats = alphaStats({ width: strip.width, height: strip.height, rgba: strip.rgba }, { x: 0, y: 0, width: strip.width, height: strip.height });
  const alphaSummary = `coverage=${(stats.coverage * 100).toFixed(1)}%`;
  if (stats.coverage > 0.985) {
    return { id: entry.id, ok: false, reason: `composed strip has no transparency; alpha ${alphaSummary}` };
  }

  return { id: entry.id, ok: true, output: outputLabelFor(entry, opts), alpha: alphaSummary, mode: `frames(${a.frames})` };
}

function processEntry(entry, opts) {
  if (entry.type === 'character' && entry.spritesheet) return processCharacterPlaceholder(entry, opts);
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

function processCharacterPlaceholder(entry, opts = {}) {
  const s = entry.spritesheet;
  const baseName = path.basename(entry.sourcePath, '.source.png'); // e.g. _placeholder_chibi
  const dir = path.dirname(entry.sourcePath);
  const rawDir = path.join(repoRoot, dir);
  if (!fs.existsSync(rawDir)) {
    return { id: entry.id, ok: false, reason: `raw dir missing: ${dir}` };
  }

  const directions = [
    { row: 0, key: 'down' },
    { row: 1, key: 'up' },
    { row: 2, key: 'left' },
    { row: 3, key: 'right' }
  ];
  const walkCols = s.framesPerRow?.walk || [2, 3, 4, 5, 6, 7];
  const required = [
    { row: 0, col: 0, file: `${baseName}.frame_idle_down_0.source.png` },
    { row: 0, col: 1, file: `${baseName}.frame_idle_down_1.source.png` },
    { row: 1, col: 0, file: `${baseName}.frame_idle_up_0.source.png` },
    { row: 1, col: 1, file: `${baseName}.frame_idle_up_1.source.png` },
    { row: 2, col: 0, file: `${baseName}.frame_idle_left_0.source.png` },
    { row: 2, col: 1, file: `${baseName}.frame_idle_left_1.source.png` },
    { row: 3, col: 0, file: `${baseName}.frame_idle_right_0.source.png` },
    { row: 3, col: 1, file: `${baseName}.frame_idle_right_1.source.png` }
  ];
  for (const direction of directions) {
    const explicitWalkFiles = walkCols.map((_, idx) => `${baseName}.frame_walk_${direction.key}_${idx}.source.png`);
    const hasExplicitWalkSet = explicitWalkFiles.every((file) => fs.existsSync(path.join(rawDir, file)));
    if (hasExplicitWalkSet) {
      explicitWalkFiles.forEach((file, idx) => {
        required.push({ row: direction.row, col: walkCols[idx], file });
      });
    } else {
      required.push({ row: direction.row, col: 'walk', file: `${baseName}.frame_walk_${direction.key}.source.png` });
    }
  }

  const missing = required.filter((r) => !fs.existsSync(path.join(rawDir, r.file)));
  if (missing.length > 0) {
    return {
      id: entry.id,
      ok: false,
      reason: `missing ${missing.length} placeholder frame(s): ${missing.map((m) => m.file).join(', ')}`
    };
  }

  const sheet = createRaster(s.width, s.height);
  for (const r of required) {
    let frame = readPngRgba(path.join(rawDir, r.file));
    if (frame.width !== s.frameWidth || frame.height !== s.frameHeight) {
      if (opts.resize) {
        frame = resizeRgba(frame, s.frameWidth, s.frameHeight, opts.resize);
      } else {
        return {
          id: entry.id,
          ok: false,
          reason: `frame ${r.file} is ${frame.width}x${frame.height}, expected ${s.frameWidth}x${s.frameHeight} (pass --resize)`
        };
      }
    }
    if (r.col === 'walk') {
      // Legacy placeholder fallback: replicate the single walk frame across the row.
      for (const col of walkCols) {
        compositeRaster(sheet, frame, {
          x: col * s.frameWidth,
          y: r.row * s.frameHeight,
          mode: 'copy'
        });
      }
    } else {
      compositeRaster(sheet, frame, {
        x: r.col * s.frameWidth,
        y: r.row * s.frameHeight,
        mode: 'copy'
      });
    }
  }

  const outAbs = outputAbsFor(entry, opts);
  ensureDir(path.dirname(outAbs));
  fs.writeFileSync(outAbs, encodeDeterministicPng(sheet));

  const stats = alphaStats(sheet, { x: 0, y: 0, width: s.width, height: s.height });
  return {
    id: entry.id,
    ok: true,
    output: outputLabelFor(entry, opts),
    alpha: `coverage=${(stats.coverage * 100).toFixed(1)}%`,
    mode: 'character_spritesheet(compact)'
  };
}

function writeManifest(results, opts) {
  ensureDir(manifestDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestPath = path.join(manifestDir, `produce-${stamp}.json`);
  writeEvidenceManifest({ manifestPath, generatedAt: null, manifest: {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    options: opts,
    results
  } });
  console.log(`  manifest: ${path.relative(repoRoot, manifestPath)}`);
}

function main() {
  const { ids, help, chromaKey, allMissing, candidate, candidateRoot, resize, seamlessTerrain, cropCenter, quietTerrain } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage(console.log);
    return;
  }
  if (ids.length === 0 && !allMissing) {
    printUsage();
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
    const r = processEntry(target, { chromaKey, candidate, candidateRoot, resize, seamlessTerrain, cropCenter, quietTerrain });
    if (r.ok) {
      console.log(`  ${target.id}: OK [${r.mode || 'static'}] -> ${r.output}${r.alpha ? ` (${r.alpha})` : ''}`);
    } else {
      console.error(`  ${target.id}: FAIL — ${r.reason}`);
    }
    results.push(r);
  }
  writeManifest(results, {
    chromaKey,
    allMissing,
    candidate,
    candidateRoot: candidate ? path.relative(repoRoot, candidateRoot) : null,
    resize,
    seamlessTerrain,
    cropCenter,
    quietTerrain
  });

  const failed = results.filter((r) => !r.ok);
  const done = results.length - failed.length;
  console.log('');
  console.log(`Summary: ${done} OK, ${failed.length} failed.`);
  if (done > 0) {
    if (candidate) {
      const env = `HOME_FIELD_ASSET_ROOT=${path.relative(repoRoot, candidateRoot)}`;
      console.log(`Next: \`${env} npm run game:home-field:validate -- --check-files\` then \`${env} npm run game:home-field:sheet\`.`);
    } else {
      console.log('Next: `npm run game:home-field:validate -- --check-files` then `npm run game:home-field:sheet`.');
    }
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
