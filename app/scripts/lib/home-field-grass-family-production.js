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
import { writeEvidenceManifest } from '@microwavedev/backpack-game-core/tooling/evidence';
import { averageRegionRgb } from '@microwavedev/backpack-game-core/tooling/image-analysis';
import {
  blendRasterOppositeEdges,
  neutralizeRasterEdges
} from '@microwavedev/backpack-game-core/tooling/raster';
import {
  encodeDeterministicPng,
  fileSha256,
  readPngAsRgba
} from './bitmap-image-toolkit.js';
import { repoRoot } from '../../shared/repo-root.js';
import { validateAssets } from '../../shared/home-field/home-field-validator.js';
import {
  allHomeFieldEntries as allEntries,
  cropNormalizedSquare,
  ensureDir,
  loadJson,
  quietTerrainContrast,
  resizeRgba
} from './home-field-family-production.js';

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
  },
  'unified-base': {
    description: 'Production fallback: one quiet base crop owns all tile edges; variants blend only inside the tile to avoid visible columns.',
    unifiedBase: true,
    crops: {
      grass_base_01: {
        label: 'quiet unified base crop',
        center: { x: 0.50, y: 0.58 },
        ratio: 0.24,
        quiet: 0.88,
        overlayStrength: 0
      },
      grass_base_02: {
        label: 'subtle unified base variant',
        center: { x: 0.54, y: 0.58 },
        ratio: 0.24,
        quiet: 0.88,
        overlayStrength: 0.04
      },
      grass_flowers_01: {
        label: 'unified base with sparse interior accents',
        center: { x: 0.50, y: 0.70 },
        ratio: 0.24,
        quiet: 0.84,
        overlayStrength: 0.07
      }
    }
  },
  'flat-minimal': {
    description: 'Fast production fallback: source-paletted simple grass with uniform edges and tiny interior-only marks.',
    flatMinimal: true,
    crops: {
      grass_base_01: {
        label: 'flat minimal grass base',
        center: { x: 0.50, y: 0.58 },
        ratio: 0.24,
        quiet: 1,
        seed: 11,
        markCount: 3
      },
      grass_base_02: {
        label: 'flat minimal grass variant',
        center: { x: 0.50, y: 0.58 },
        ratio: 0.24,
        quiet: 1,
        seed: 11,
        markCount: 3
      },
      grass_flowers_01: {
        label: 'flat minimal sparse flower variant',
        center: { x: 0.50, y: 0.58 },
        ratio: 0.24,
        quiet: 1,
        seed: 11,
        markCount: 3,
        flowerCount: 2
      }
    }
  }
};

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

function smootherstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function makeTerrainSeamless(image, margin = 48) {
  return blendRasterOppositeEdges(image, { margin });
}

function averageRgb(image) {
  return averageRegionRgb(image);
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function matchAverageRgb(image, targetAvg, strength = 0.82) {
  const avg = averageRgb(image);
  const delta = targetAvg.map((value, index) => (value - avg[index]) * strength);
  const rgba = Buffer.from(image.rgba);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i + 0] = clampByte(rgba[i + 0] + delta[0]);
    rgba[i + 1] = clampByte(rgba[i + 1] + delta[1]);
    rgba[i + 2] = clampByte(rgba[i + 2] + delta[2]);
  }
  return { width: image.width, height: image.height, rgba };
}

function blendInteriorVariant(base, overlay, strength) {
  if (!strength) return base;
  const rgba = Buffer.from(base.rgba);
  const margin = Math.max(32, Math.floor(Math.min(base.width, base.height) * 0.28));
  for (let y = 0; y < base.height; y += 1) {
    const dy = Math.min(y, base.height - 1 - y);
    for (let x = 0; x < base.width; x += 1) {
      const dx = Math.min(x, base.width - 1 - x);
      const edgeDistance = Math.min(dx, dy);
      const edgeFade = smootherstep(edgeDistance / margin);
      const weight = strength * edgeFade;
      if (weight <= 0) continue;
      const i = (y * base.width + x) * 4;
      rgba[i + 0] = clampByte(base.rgba[i + 0] * (1 - weight) + overlay.rgba[i + 0] * weight);
      rgba[i + 1] = clampByte(base.rgba[i + 1] * (1 - weight) + overlay.rgba[i + 1] * weight);
      rgba[i + 2] = clampByte(base.rgba[i + 2] * (1 - weight) + overlay.rgba[i + 2] * weight);
      rgba[i + 3] = clampByte(base.rgba[i + 3] * (1 - weight) + overlay.rgba[i + 3] * weight);
    }
  }
  return { width: base.width, height: base.height, rgba };
}

function neutralizeEdges(image, margin = 72, strength = 0.9) {
  return neutralizeRasterEdges(image, { margin, strength });
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function blendAt(rgba, width, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  if (i < 0 || i >= rgba.length) return;
  rgba[i + 0] = clampByte(rgba[i + 0] * (1 - alpha) + color[0] * alpha);
  rgba[i + 1] = clampByte(rgba[i + 1] * (1 - alpha) + color[1] * alpha);
  rgba[i + 2] = clampByte(rgba[i + 2] * (1 - alpha) + color[2] * alpha);
  rgba[i + 3] = 255;
}

function drawSoftMark(rgba, width, height, cx, cy, rx, ry, color, alpha) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(height - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      blendAt(rgba, width, x, y, color, alpha * (1 - d));
    }
  }
}

function makeFlatMinimalGrass(target, plan, baseAvg) {
  const width = target.width;
  const height = target.height;
  const rand = seededRandom(plan.seed || 1);
  const base = [
    clampByte(baseAvg[0] * 0.92),
    clampByte(baseAvg[1] * 1.02),
    clampByte(baseAvg[2] * 0.94)
  ];
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i + 0] = base[0];
      rgba[i + 1] = base[1];
      rgba[i + 2] = base[2];
      rgba[i + 3] = 255;
    }
  }
  const margin = 34;
  for (let n = 0; n < (plan.markCount || 0); n += 1) {
    const cx = margin + rand() * (width - margin * 2);
    const cy = margin + rand() * (height - margin * 2);
    const dark = rand() > 0.45;
    const color = dark
      ? [base[0] - 16, base[1] - 10, base[2] - 8]
      : [base[0] + 18, base[1] + 22, base[2] + 8];
    drawSoftMark(rgba, width, height, cx, cy, 3 + rand() * 4, 10 + rand() * 10, color, 0.18);
  }
  for (let n = 0; n < (plan.flowerCount || 0); n += 1) {
    const cx = margin + rand() * (width - margin * 2);
    const cy = margin + rand() * (height - margin * 2);
    drawSoftMark(rgba, width, height, cx, cy, 2.2, 2.2, [base[0] + 38, base[1] + 44, base[2] + 8], 0.24);
  }
  return { width, height, rgba };
}

function normalizeFamilyAverages(items) {
  const avgs = items.map((item) => averageRgb(item.image));
  const targetAvg = [0, 1, 2].map((channel) => (
    avgs.reduce((sum, avg) => sum + avg[channel], 0) / avgs.length
  ));
  return items.map((item, index) => {
    const normalized = matchAverageRgb(item.image, targetAvg);
    return {
      ...item,
      image: normalized,
      colorNormalization: {
        beforeAverageRgb: avgs[index].map((value) => Number(value.toFixed(2))),
        targetAverageRgb: targetAvg.map((value) => Number(value.toFixed(2))),
        afterAverageRgb: averageRgb(normalized).map((value) => Number(value.toFixed(2)))
      }
    };
  });
}

export function produceGrassFamily(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    console.error('Usage: npm run game:home-field:produce-family -- --family=grass [--source=.agent/home-field-workspace/raw/grass_family_meadow.source.png] [--plan=tight-center|lower-band|upper-band] [--candidate] [--no-seamless]');
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
  const prepared = [];
  let flatMinimalBaseAvg = null;
  for (const target of targets) {
    const plan = cropPlan.crops[target.id];
    const { image: cropped, rect } = cropNormalizedSquare(source, plan);
    if (cropPlan.flatMinimal && !flatMinimalBaseAvg) flatMinimalBaseAvg = averageRgb(cropped);
    let image = resizeRgba(cropped, target.width, target.height);
    if (!args.noSeamless) image = makeTerrainSeamless(image);
    image = quietTerrainContrast(image, plan.quiet);
    if (cropPlan.flatMinimal) image = makeFlatMinimalGrass(target, plan, flatMinimalBaseAvg);
    prepared.push({ target, plan, image, rect });
  }

  if (cropPlan.unifiedBase && !cropPlan.flatMinimal) {
    const base = prepared[0]?.image;
    for (const item of prepared) {
      item.image = neutralizeEdges(blendInteriorVariant(base, item.image, item.plan.overlayStrength || 0));
    }
  }

  const outputs = [];
  for (const item of normalizeFamilyAverages(prepared)) {
    const { target, plan, rect, image, colorNormalization } = item;
    const outAbs = path.join(outputRoot, target.outputPath);
    ensureDir(path.dirname(outAbs));
    fs.writeFileSync(outAbs, encodeDeterministicPng(image));
    outputs.push({
      id: target.id,
      outputPath: target.outputPath,
      writtenPath: path.relative(repoRoot, outAbs),
      crop: { ...plan, rect },
      colorNormalization,
      sha256: fileSha256(outAbs)
    });
    console.log(`  ${target.id}: OK (${plan.label}) -> ${path.relative(repoRoot, outAbs)}`);
  }

  ensureDir(manifestDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestPath = path.join(manifestDir, `produce-grass-family-${stamp}.json`);
  writeEvidenceManifest({ manifestPath, generatedAt: null, manifest: {
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
  } });
  console.log(`  manifest: ${path.relative(repoRoot, manifestPath)}`);
  console.log('');
  if (args.candidate) {
    const env = `HOME_FIELD_ASSET_ROOT=${path.relative(repoRoot, candidateDir)}`;
    console.log(`Next: review the candidate with \`${env} npm run game:home-field:validate -- --ids=${FAMILY_IDS.join(',')} --check-files --check-connectors --check-review\`, \`${env} npm run game:home-field:sheet\`, \`${env} npm run game:home-field:grass-family-sheet\`, \`${env} npm run game:home-field:adjacency\`, and \`npm run game:home-field:preview -- --scope=grass\`.`);
    console.log(`Finder folder: ${candidateDir}`);
    console.log(`Final-response link: Candidate folder: [open in Finder](${candidateDir})`);
    console.log(`Final-response link: Candidate field mobile: [mobile field screenshot](${path.join(workspace, 'review', 'home-field-candidate-mobile-clean.png')})`);
    console.log(`Final-response link: Candidate field desktop: [desktop field screenshot](${path.join(workspace, 'review', 'home-field-candidate-desktop-clean.png')})`);
  } else {
    console.log('Next: `npm run game:home-field:validate -- --check-files --check-connectors --check-review`, `npm run game:home-field:sheet`, and `npm run game:home-field:adjacency`.');
  }
}
