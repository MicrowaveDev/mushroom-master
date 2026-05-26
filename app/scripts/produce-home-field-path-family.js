#!/usr/bin/env node
/**
 * Produce the Home Field path family from one shared source image.
 *
 * Independent path tile generation can pass metadata checks while drifting in
 * palette, brush scale, and path-band placement. This producer crops the path
 * family from one wide source so the connected terrain reads as one tileset.
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
const candidateDir = path.join(workspace, 'candidates', 'terrain-family', 'latest');
const DEFAULT_SOURCE = '.agent/home-field-workspace/raw/path_family_strip.source.png';
const FAMILY_IDS = ['path_h_end_w', 'path_dirt_straight', 'path_spore_glow', 'path_h_end_e', 'path_destination_row'];

const CROP_PLAN = {
  path_h_end_w: {
    label: 'west end fade from shared horizontal path',
    center: { x: 0.24, y: 0.40 },
    ratio: 0.30,
    quiet: 0.10
  },
  path_dirt_straight: {
    label: 'straight dirt path from shared horizontal path',
    center: { x: 0.38, y: 0.40 },
    ratio: 0.30,
    quiet: 0.10
  },
  path_spore_glow: {
    label: 'restrained glow path from shared horizontal path',
    center: { x: 0.52, y: 0.40 },
    ratio: 0.30,
    quiet: 0.08
  },
  path_h_end_e: {
    label: 'east end fade from shared horizontal path',
    center: { x: 0.66, y: 0.40 },
    ratio: 0.30,
    quiet: 0.10
  },
  path_destination_row: {
    label: 'isolated grass-compatible destination landing from same source',
    center: { x: 0.52, y: 0.72 },
    ratio: 0.30,
    quiet: 0.12
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
    candidate: false
  };
  for (const arg of argv) {
    if (arg.startsWith('--source=')) args.source = arg.slice('--source='.length);
    else if (arg === '--candidate') args.candidate = true;
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
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

function quietTerrainContrast(image, amount) {
  if (!amount) return image;
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
    console.error('Usage: produce-home-field-path-family.js [--source=.agent/home-field-workspace/raw/path_family_strip.source.png] [--candidate]');
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
    console.error(`Missing path family asset metadata: ${missing.join(', ')}`);
    process.exit(1);
  }
  const targets = FAMILY_IDS.map((id) => byId.get(id));
  const sourceAbs = path.resolve(repoRoot, args.source);
  if (!fs.existsSync(sourceAbs)) {
    console.error(`Shared path source missing: ${path.relative(repoRoot, sourceAbs)}`);
    process.exit(1);
  }
  const source = readPngAsRgba(sourceAbs);
  if (source.width < 1024 || source.height < 512) {
    console.error(`Shared path source ${source.width}x${source.height} is too small; expected at least 1024x512 for coordinated path-family crops.`);
    process.exit(1);
  }

  const outputRoot = args.candidate ? candidateDir : repoRoot;
  if (args.candidate) {
    fs.rmSync(candidateDir, { recursive: true, force: true });
    ensureDir(candidateDir);
  }

  console.log(`Producing path family from ${path.relative(repoRoot, sourceAbs)} (${source.width}x${source.height})...`);
  if (args.candidate) {
    console.log(`  candidate root: ${path.relative(repoRoot, candidateDir)}`);
  }

  const outputs = [];
  for (const target of targets) {
    const plan = CROP_PLAN[target.id];
    const { image: cropped, rect } = cropNormalizedSquare(source, plan);
    let image = resizeRgba(cropped, target.width, target.height);
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
  const manifestPath = path.join(manifestDir, `produce-path-family-${stamp}.json`);
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
      oneSharedSourceForPathFamily: true,
      independentPerTileImagegenForbidden: true,
      candidateMode: args.candidate,
      outputRoot: path.relative(repoRoot, outputRoot)
    },
    outputs
  }, null, 2)}\n`);
  console.log(`  manifest: ${path.relative(repoRoot, manifestPath)}`);
  console.log('');
  if (args.candidate) {
    const ids = FAMILY_IDS.join(',');
    const env = `HOME_FIELD_ASSET_ROOT=${path.relative(repoRoot, candidateDir)}`;
    console.log(`Next: review with \`${env} npm run game:home-field:validate -- --ids=${ids} --check-files --check-connectors --check-review\`, \`${env} npm run game:home-field:validate -- --ids=${ids} --check-files --check-edge-profiles --check-family-cohesion\`, \`${env} npm run game:home-field:sheet\`, \`${env} npm run game:home-field:adjacency\`, and \`HOME_FIELD_CANDIDATE_ROOT=${path.relative(repoRoot, candidateDir)} HOME_FIELD_CANDIDATE_IDS=${ids} npm run game:home-field:terrain-candidate-preview\`.`);
    console.log(`Finder folder: ${candidateDir}`);
    console.log(`Final-response link: Candidate folder: [open in Finder](${candidateDir})`);
    console.log(`Final-response link: Candidate evidence: [manifest](${path.join(workspace, 'review', 'candidate-evidence.manifest.json')})`);
    console.log(`Final-response link: Adjacency sheet: [adjacency sheet](${path.join(workspace, 'review', 'adjacency-sheet.png')})`);
    console.log(`Final-response link: Candidate field mobile: [mobile field screenshot](${path.join(workspace, 'review', 'home-field-candidate-mobile-clean.png')})`);
    console.log(`Final-response link: Candidate field desktop: [desktop field screenshot](${path.join(workspace, 'review', 'home-field-candidate-desktop-clean.png')})`);
  } else {
    console.log('Next: `npm run game:home-field:validate -- --check-files --check-connectors --check-review`, `npm run game:home-field:sheet`, and `npm run game:home-field:adjacency`.');
  }
}

main();
