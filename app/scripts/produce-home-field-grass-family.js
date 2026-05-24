#!/usr/bin/env node
/**
 * Produce the first Home Field grass family from one shared meadow source.
 *
 * The independent per-tile imagegen path made technically valid tiles that still
 * clashed as a family. This script keeps the three grass cells in one lighting
 * and brush language by cropping coordinated regions from one larger raw meadow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeDeterministicPng,
  fileSha256,
  readPngAsRgba
} from './lib/bitmap-image-toolkit.js';
import { validateAssets } from '../shared/home-field/home-field-validator.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = process.env.HOME_FIELD_ASSETS_PATH
  ? path.resolve(process.env.HOME_FIELD_ASSETS_PATH)
  : path.join(sharedDir, 'home-field-assets.json');
const workspace = process.env.HOME_FIELD_WORKSPACE
  ? path.resolve(process.env.HOME_FIELD_WORKSPACE)
  : path.join(repoRoot, '.agent', 'home-field-workspace');
const manifestDir = path.join(workspace, 'manifests');
const candidateDir = path.join(workspace, 'candidates', 'grass-family', 'latest');
const DEFAULT_SOURCE = '.agent/home-field-workspace/raw/grass_family_meadow.source.png';

const FAMILY_IDS = ['grass_base_01', 'grass_base_02', 'grass_flowers_01'];
const DEFAULT_PLAN = 'tight-center';
const CROP_PLANS = {
  'tight-center': {
    description: 'Preferred default: nearby central crops to reduce family value jumps.',
    crops: {
      grass_base_01: {
        label: 'quiet center-left crop',
        center: { x: 0.46, y: 0.50 },
        ratio: 0.24,
        quiet: 0.56
      },
      grass_base_02: {
        label: 'quiet center-right crop',
        center: { x: 0.54, y: 0.50 },
        ratio: 0.24,
        quiet: 0.56
      },
      grass_flowers_01: {
        label: 'nearby sparse accent crop',
        center: { x: 0.50, y: 0.58 },
        ratio: 0.24,
        quiet: 0.50
      }
    }
  },
  'lower-band': {
    description: 'Fallback when the central source has focal marks; crops a tighter lower band.',
    crops: {
      grass_base_01: {
        label: 'quiet lower-left band crop',
        center: { x: 0.44, y: 0.62 },
        ratio: 0.24,
        quiet: 0.56
      },
      grass_base_02: {
        label: 'quiet lower-right band crop',
        center: { x: 0.56, y: 0.62 },
        ratio: 0.24,
        quiet: 0.56
      },
      grass_flowers_01: {
        label: 'nearby lower accent crop',
        center: { x: 0.50, y: 0.70 },
        ratio: 0.24,
        quiet: 0.50
      }
    }
  },
  'upper-band': {
    description: 'Fallback when the lower source has focal marks; crops a tighter upper band.',
    crops: {
      grass_base_01: {
        label: 'quiet upper-left band crop',
        center: { x: 0.44, y: 0.38 },
        ratio: 0.24,
        quiet: 0.56
      },
      grass_base_02: {
        label: 'quiet upper-right band crop',
        center: { x: 0.56, y: 0.38 },
        ratio: 0.24,
        quiet: 0.56
      },
      grass_flowers_01: {
        label: 'nearby upper accent crop',
        center: { x: 0.50, y: 0.46 },
        ratio: 0.24,
        quiet: 0.50
      }
    }
  }
};

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    plan: DEFAULT_PLAN,
    candidate: false,
    noSeamless: false
  };
  for (const arg of argv) {
    if (arg.startsWith('--source=')) args.source = arg.slice('--source='.length);
    else if (arg.startsWith('--plan=')) args.plan = arg.slice('--plan='.length);
    else if (arg === '--list-plans') {
      console.log(Object.entries(CROP_PLANS).map(([name, plan]) => `${name}: ${plan.description}`).join('\n'));
      process.exit(0);
    }
    else if (arg === '--candidate') args.candidate = true;
    else if (arg === '--no-seamless') args.noSeamless = true;
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!CROP_PLANS[args.plan]) {
    throw new Error(`Unknown --plan="${args.plan}". Valid plans: ${Object.keys(CROP_PLANS).join(', ')}`);
  }
  return args;
}

function resizeRgba(srcImage, dstWidth, dstHeight) {
  const { width: sw, height: sh, rgba: src } = srcImage;
  const dst = Buffer.alloc(dstWidth * dstHeight * 4);
  const xRatio = sw / dstWidth;
  const yRatio = sh / dstHeight;
  if (sw < dstWidth || sh < dstHeight) {
    for (let y = 0; y < dstHeight; y += 1) {
      const sy = Math.min(sh - 1, Math.floor(y * yRatio));
      for (let x = 0; x < dstWidth; x += 1) {
        const sx = Math.min(sw - 1, Math.floor(x * xRatio));
        const si = (sy * sw + sx) * 4;
        const di = (y * dstWidth + x) * 4;
        dst[di + 0] = src[si + 0];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      }
    }
    return { width: dstWidth, height: dstHeight, rgba: dst };
  }

  for (let y = 0; y < dstHeight; y += 1) {
    const sy0 = Math.floor(y * yRatio);
    const sy1 = Math.min(sh, Math.ceil((y + 1) * yRatio));
    for (let x = 0; x < dstWidth; x += 1) {
      const sx0 = Math.floor(x * xRatio);
      const sx1 = Math.min(sw, Math.ceil((x + 1) * xRatio));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = sy0; yy < sy1; yy += 1) {
        for (let xx = sx0; xx < sx1; xx += 1) {
          const si = (yy * sw + xx) * 4;
          r += src[si + 0];
          g += src[si + 1];
          b += src[si + 2];
          a += src[si + 3];
          n += 1;
        }
      }
      const di = (y * dstWidth + x) * 4;
      dst[di + 0] = Math.round(r / n);
      dst[di + 1] = Math.round(g / n);
      dst[di + 2] = Math.round(b / n);
      dst[di + 3] = Math.round(a / n);
    }
  }
  return { width: dstWidth, height: dstHeight, rgba: dst };
}

function cropNormalizedSquare(srcImage, crop) {
  const cropSize = Math.max(1, Math.floor(Math.min(srcImage.width, srcImage.height) * crop.ratio));
  const centerX = Math.round(srcImage.width * crop.center.x);
  const centerY = Math.round(srcImage.height * crop.center.y);
  const startX = Math.max(0, Math.min(srcImage.width - cropSize, centerX - Math.floor(cropSize / 2)));
  const startY = Math.max(0, Math.min(srcImage.height - cropSize, centerY - Math.floor(cropSize / 2)));
  const rgba = Buffer.alloc(cropSize * cropSize * 4);
  for (let y = 0; y < cropSize; y += 1) {
    const srcOff = ((startY + y) * srcImage.width + startX) * 4;
    const dstOff = y * cropSize * 4;
    srcImage.rgba.copy(rgba, dstOff, srcOff, srcOff + cropSize * 4);
  }
  return {
    image: { width: cropSize, height: cropSize, rgba },
    rect: { x: startX, y: startY, width: cropSize, height: cropSize }
  };
}

function smootherstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function blendPair(rgba, leftIndex, rightIndex, weight) {
  for (let c = 0; c < 4; c += 1) {
    const avg = Math.round((rgba[leftIndex + c] + rgba[rightIndex + c]) / 2);
    rgba[leftIndex + c] = Math.round(rgba[leftIndex + c] * (1 - weight) + avg * weight);
    rgba[rightIndex + c] = Math.round(rgba[rightIndex + c] * (1 - weight) + avg * weight);
  }
}

function makeTerrainSeamless(image, margin = 48) {
  const { width, height } = image;
  const rgba = Buffer.from(image.rgba);
  const edge = Math.max(1, Math.min(margin, Math.floor(Math.min(width, height) / 3)));
  for (let y = 0; y < height; y += 1) {
    for (let d = 0; d < edge; d += 1) {
      const weight = 1 - smootherstep(d / edge);
      blendPair(rgba, (y * width + d) * 4, (y * width + (width - 1 - d)) * 4, weight);
    }
  }
  for (let x = 0; x < width; x += 1) {
    for (let d = 0; d < edge; d += 1) {
      const weight = 1 - smootherstep(d / edge);
      blendPair(rgba, (d * width + x) * 4, ((height - 1 - d) * width + x) * 4, weight);
    }
  }
  return { width, height, rgba };
}

function quietTerrainContrast(image, amount) {
  let r = 0, g = 0, b = 0;
  const count = image.width * image.height;
  for (let i = 0; i < image.rgba.length; i += 4) {
    r += image.rgba[i + 0];
    g += image.rgba[i + 1];
    b += image.rgba[i + 2];
  }
  const avg = [r / count, g / count, b / count];
  const rgba = Buffer.from(image.rgba);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i + 0] = Math.round(rgba[i + 0] * (1 - amount) + avg[0] * amount);
    rgba[i + 1] = Math.round(rgba[i + 1] * (1 - amount) + avg[1] * amount);
    rgba[i + 2] = Math.round(rgba[i + 2] * (1 - amount) + avg[2] * amount);
  }
  return { width: image.width, height: image.height, rgba };
}

function allEntries(assetsDoc) {
  return [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((c) => ({
      ...c,
      type: 'character',
      width: c.spritesheet.width,
      height: c.spritesheet.height
    }))
  ];
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error('Usage: produce-home-field-grass-family.js [--source=.agent/home-field-workspace/raw/grass_family_meadow.source.png] [--plan=tight-center|lower-band|upper-band] [--candidate] [--no-seamless]');
    process.exit(1);
  }

  const assetsDoc = loadJson(ASSETS_PATH);
  const schemaCheck = validateAssets(assetsDoc);
  if (!schemaCheck.ok) {
    console.error('home-field-assets.json failed schema validation; refusing to run:');
    for (const e of schemaCheck.errors) console.error(`  [${e.code}] ${e.message}`);
    process.exit(1);
  }
  const byId = new Map(allEntries(assetsDoc).map((entry) => [entry.id, entry]));
  const missing = FAMILY_IDS.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    console.error(`Missing grass family asset metadata: ${missing.join(', ')}`);
    process.exit(1);
  }
  const targets = FAMILY_IDS.map((id) => byId.get(id));

  const sourceAbs = path.resolve(repoRoot, args.source);
  if (!fs.existsSync(sourceAbs)) {
    console.error(`Shared meadow source missing: ${path.relative(repoRoot, sourceAbs)}`);
    process.exit(1);
  }
  const source = readPngAsRgba(sourceAbs);
  if (source.width < 768 || source.height < 512) {
    console.error(`Shared meadow source ${source.width}x${source.height} is too small; expected at least 768x512 for coordinated crops.`);
    process.exit(1);
  }

  const cropPlan = CROP_PLANS[args.plan];
  const outputRoot = args.candidate ? candidateDir : repoRoot;
  if (args.candidate) {
    fs.rmSync(candidateDir, { recursive: true, force: true });
    ensureDir(candidateDir);
  }
  console.log(`Producing grass family from ${path.relative(repoRoot, sourceAbs)} (${source.width}x${source.height}) with plan "${args.plan}"...`);
  if (args.candidate) {
    console.log(`  candidate root: ${path.relative(repoRoot, candidateDir)}`);
  }
  const outputs = [];
  for (const target of targets) {
    const plan = cropPlan.crops[target.id];
    const { image: cropped, rect } = cropNormalizedSquare(source, plan);
    let image = resizeRgba(cropped, target.width, target.height);
    if (!args.noSeamless) image = makeTerrainSeamless(image);
    image = quietTerrainContrast(image, plan.quiet);
    const outAbs = path.join(outputRoot, target.outputPath);
    ensureDir(path.dirname(outAbs));
    fs.writeFileSync(outAbs, encodeDeterministicPng(image));
    outputs.push({
      id: target.id,
      outputPath: target.outputPath,
      writtenPath: path.relative(repoRoot, outAbs),
      crop: { ...plan, rect },
      sha256: fileSha256(outAbs)
    });
    console.log(`  ${target.id}: OK (${plan.label}) -> ${path.relative(repoRoot, outAbs)}`);
  }

  ensureDir(manifestDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestPath = path.join(manifestDir, `produce-grass-family-${stamp}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      path: path.relative(repoRoot, sourceAbs),
      width: source.width,
      height: source.height,
      sha256: fileSha256(sourceAbs)
    },
    policy: {
      oneSharedSourceForGrassFamily: true,
      independentPerTileImagegenForbidden: true,
      candidateMode: args.candidate,
      outputRoot: path.relative(repoRoot, outputRoot),
      seamlessTerrain: !args.noSeamless,
      cropPlanName: args.plan,
      cropPlanDescription: cropPlan.description
    },
    outputs
  }, null, 2)}\n`);
  console.log(`  manifest: ${path.relative(repoRoot, manifestPath)}`);
  console.log('');
  if (args.candidate) {
    const env = `HOME_FIELD_ASSET_ROOT=${path.relative(repoRoot, candidateDir)}`;
    console.log(`Next: review the candidate with \`${env} npm run game:home-field:validate -- --ids=${FAMILY_IDS.join(',')} --check-files --check-connectors --check-review\`, \`${env} npm run game:home-field:sheet\`, \`${env} npm run game:home-field:grass-family-sheet\`, and \`${env} npm run game:home-field:adjacency\`.`);
    console.log(`Finder folder: ${candidateDir}`);
    console.log(`Final-response link: Candidate folder: [open in Finder](${candidateDir})`);
  } else {
    console.log('Next: `npm run game:home-field:validate -- --check-files --check-connectors --check-review`, `npm run game:home-field:sheet`, and `npm run game:home-field:adjacency`.');
  }
}

main();
