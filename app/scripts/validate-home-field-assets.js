#!/usr/bin/env node
/**
 * CLI wrapper around app/shared/home-field/home-field-validator.js.
 *
 * Run:
 *   npm run game:home-field:validate
 *   npm run game:home-field:validate -- --check-files
 *   npm run game:home-field:validate -- --check-connectors
 *   npm run game:home-field:validate -- --check-review
 *   npm run game:home-field:validate -- --production
 *
 * Default behavior validates schema only (does not require any PNGs to exist yet),
 * so Phase 0 can land before imagegen runs. Pass --check-files to also assert that
 * each asset's outputPath exists with the expected dimensions. Pass --check-connectors
 * to assert that neighboring tile-layer edge connector tokens match.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAll, validateTileConnectors } from '../shared/home-field/home-field-validator.js';
import { alphaStats, readPngHeader, readPngRgba } from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = process.env.HOME_FIELD_ASSETS_PATH
  ? path.resolve(process.env.HOME_FIELD_ASSETS_PATH)
  : path.join(sharedDir, 'home-field-assets.json');
const MAP_PATH = process.env.HOME_FIELD_MAP_PATH
  ? path.resolve(process.env.HOME_FIELD_MAP_PATH)
  : path.join(sharedDir, 'home-field-map.json');
const REVIEW_PATH = path.join(repoRoot, 'docs', 'home-field-asset-review.json');
const ASSET_ROOT = process.env.HOME_FIELD_ASSET_ROOT
  ? path.resolve(repoRoot, process.env.HOME_FIELD_ASSET_ROOT)
  : repoRoot;
const REVIEW_VERDICTS = new Set(['pending', 'needs_review', 'needs_regen', 'rejected', 'approved', 'placeholder']);
const REVIEW_CHECKS = [
  'repeatCheck',
  'connectorCheck',
  'cleanPreviewCheck',
  'sceneFitCheck',
  'familyCohesionCheck',
  'styleCohesionCheck',
  'alphaCheck',
  'scaleCheck'
];
const REVIEW_CHECK_VALUES = new Set(['pass', 'fail', 'pending', 'placeholder', 'not_applicable']);
const DEFAULT_ALPHA_HALO_THRESHOLD = 0;

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function parseIds(argv) {
  const arg = argv.find((item) => item.startsWith('--ids='));
  if (!arg) return null;
  return new Set(arg.slice('--ids='.length).split(',').map((id) => id.trim()).filter(Boolean));
}

function scopedEntries(entries, ids) {
  return ids ? entries.filter((entry) => ids.has(entry.id)) : entries;
}

function checkFiles(assetsDoc, errors, { ids = null } = {}) {
  const allEntries = scopedEntries([
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((c) => ({
      id: c.id,
      outputPath: c.outputPath,
      width: c.spritesheet.width,
      height: c.spritesheet.height,
      isCharacter: true
    }))
  ], ids);
  for (const a of allEntries) {
    const abs = path.join(ASSET_ROOT, a.outputPath);
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

function isVisibleChromaFringe(r, g, b, a) {
  if (a <= 16) return false;
  const magentaKey = r > 180 && b > 140 && g < 100;
  const saturatedPink = r > 150 && b > 110 && r - g > 80 && b - g > 55;
  return magentaKey || saturatedPink;
}

function checkAlphaHalo(assetsDoc, errors, { ids = null, threshold = DEFAULT_ALPHA_HALO_THRESHOLD } = {}) {
  for (const asset of scopedEntries(allEntries(assetsDoc), ids)) {
    if (asset.type === 'terrain') continue;
    const abs = path.join(ASSET_ROOT, asset.outputPath);
    if (!fs.existsSync(abs)) {
      errors.push({ scope: 'alpha_halo', code: 'missing', message: `asset "${asset.id}" output missing: ${asset.outputPath}` });
      continue;
    }
    let image;
    try {
      image = readPngRgba(abs);
    } catch (err) {
      errors.push({ scope: 'alpha_halo', code: 'png_read', message: `asset "${asset.id}" cannot read PNG pixels: ${err.message}` });
      continue;
    }

    let fringePixels = 0;
    for (let offset = 0; offset < image.rgba.length; offset += 4) {
      if (isVisibleChromaFringe(
        image.rgba[offset + 0],
        image.rgba[offset + 1],
        image.rgba[offset + 2],
        image.rgba[offset + 3]
      )) {
        fringePixels += 1;
      }
    }

    if (fringePixels > threshold) {
      errors.push({
        scope: 'alpha_halo',
        code: 'visible_chroma_fringe',
        message: `asset "${asset.id}" has ${fringePixels} visible magenta/pink fringe pixel${fringePixels === 1 ? '' : 's'} after alpha processing; rerun chroma-key cleanup or regenerate with cleaner transparency`
      });
    }
  }
}

function checkObjectReadabilityBounds(assetsDoc, errors, { ids = null } = {}) {
  for (const asset of scopedEntries(allEntries(assetsDoc), ids)) {
    const rule = asset.readability;
    if (!rule || asset.type === 'terrain') continue;
    const abs = path.join(ASSET_ROOT, asset.outputPath);
    if (!fs.existsSync(abs)) {
      errors.push({ scope: 'readability', code: 'missing', message: `asset "${asset.id}" output missing: ${asset.outputPath}` });
      continue;
    }

    let image;
    try {
      image = readPngRgba(abs);
    } catch (err) {
      errors.push({ scope: 'readability', code: 'png_read', message: `asset "${asset.id}" cannot read PNG pixels: ${err.message}` });
      continue;
    }

    const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
    if (rule.minBboxWidth && stats.bboxWidth < rule.minBboxWidth) {
      errors.push({
        scope: 'readability',
        code: 'bbox_too_narrow',
        message: `asset "${asset.id}" visible bbox width ${stats.bboxWidth}px is below readability.minBboxWidth ${rule.minBboxWidth}px; regenerate larger or crop/fit the object inside the canvas`
      });
    }
    if (rule.minBboxHeight && stats.bboxHeight < rule.minBboxHeight) {
      errors.push({
        scope: 'readability',
        code: 'bbox_too_short',
        message: `asset "${asset.id}" visible bbox height ${stats.bboxHeight}px is below readability.minBboxHeight ${rule.minBboxHeight}px; regenerate larger or crop/fit the object inside the canvas`
      });
    }
  }
}

function loadReviewDoc(errors) {
  if (!fs.existsSync(REVIEW_PATH)) {
    errors.push({
      scope: 'review',
      code: 'missing_review_doc',
      message: `review manifest missing: ${path.relative(repoRoot, REVIEW_PATH)}`
    });
    return null;
  }
  try {
    return loadJson(REVIEW_PATH);
  } catch (err) {
    errors.push({
      scope: 'review',
      code: 'invalid_json',
      message: `review manifest is not valid JSON: ${err.message}`
    });
    return null;
  }
}

function allEntries(assetsDoc) {
  return [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((c) => ({
      ...c,
      type: 'character'
    }))
  ];
}

function checkReview(assetsDoc, errors, { production = false, ids = null } = {}) {
  const reviewDoc = loadReviewDoc(errors);
  if (!reviewDoc) return;
  const reviews = new Map((reviewDoc.assets || []).map((entry) => [entry.id, entry]));
  const knownIds = new Set(allEntries(assetsDoc).map((asset) => asset.id));
  const approvedIds = [];

  for (const review of reviewDoc.assets || []) {
    if (ids && !ids.has(review.id)) continue;
    if (!knownIds.has(review.id)) {
      errors.push({
        scope: 'review',
        code: 'unknown_asset_review',
        message: `review row references unknown asset "${review.id}"`
      });
    }
    if (!REVIEW_VERDICTS.has(review.verdict)) {
      errors.push({
        scope: 'review',
        code: 'invalid_verdict',
        message: `asset "${review.id}" review verdict must be one of ${[...REVIEW_VERDICTS].join('|')}, got "${review.verdict}"`
      });
    }
    if (typeof review.accepted !== 'boolean') {
      errors.push({
        scope: 'review',
        code: 'invalid_accepted',
        message: `asset "${review.id}" review accepted must be boolean`
      });
    }
    if (typeof review.reason !== 'string' || review.reason.length === 0) {
      errors.push({
        scope: 'review',
        code: 'missing_reason',
        message: `asset "${review.id}" review reason must be a non-empty string`
      });
    }
    for (const check of REVIEW_CHECKS) {
      if (!REVIEW_CHECK_VALUES.has(review[check])) {
        errors.push({
          scope: 'review',
          code: 'invalid_check',
          message: `asset "${review.id}" ${check} must be one of ${[...REVIEW_CHECK_VALUES].join('|')}, got "${review[check]}"`
        });
      }
    }
    if (review.verdict === 'approved') {
      const failed = REVIEW_CHECKS.filter((check) => !['pass', 'not_applicable'].includes(review[check]));
      if (failed.length > 0) {
        errors.push({
          scope: 'review',
          code: 'approved_with_failed_checks',
          message: `asset "${review.id}" is approved but has non-passing checks: ${failed.join(', ')}`
        });
      }
    }
  }

  for (const asset of scopedEntries(allEntries(assetsDoc), ids)) {
    const review = reviews.get(asset.id);
    if (!review) {
      errors.push({
        scope: 'review',
        code: 'missing_asset_review',
        message: `asset "${asset.id}" has no row in docs/home-field-asset-review.json`
      });
      continue;
    }
    if (asset.status === 'approved') {
      approvedIds.push(asset.id);
      if (review.verdict !== 'approved' || review.accepted !== true) {
        errors.push({
          scope: 'review',
          code: 'approved_without_acceptance',
          message: `asset "${asset.id}" is status=approved but review verdict is "${review.verdict}" accepted=${review.accepted}`
        });
      }
    }
    if (review.verdict === 'approved' && review.accepted !== true) {
      errors.push({
        scope: 'review',
        code: 'approved_review_not_accepted',
        message: `asset "${asset.id}" review verdict is approved but accepted is not true`
      });
    }
    if (asset.status === 'placeholder' && production) {
      errors.push({
        scope: 'review',
        code: 'placeholder_in_production',
        message: `asset "${asset.id}" is a placeholder and cannot pass production validation`
      });
    }
    if (production && asset.status !== 'approved') {
      errors.push({
        scope: 'review',
        code: 'not_approved_for_production',
        message: `asset "${asset.id}" status=${asset.status}; production requires status=approved`
      });
    }
  }

  if (production && approvedIds.length === 0) {
    errors.push({
      scope: 'review',
      code: 'no_approved_assets',
      message: 'production validation requires at least one explicitly approved home-field asset'
    });
  }
}

function main() {
  const argv = process.argv.slice(2);
  const wantFileCheck = hasFlag(argv, 'check-files');
  const wantConnectorCheck = hasFlag(argv, 'check-connectors');
  const wantReviewCheck = hasFlag(argv, 'check-review');
  const wantAlphaHaloCheck = hasFlag(argv, 'check-alpha-halo');
  const wantReadabilityCheck = hasFlag(argv, 'check-readability');
  const wantProduction = hasFlag(argv, 'production');
  const ids = parseIds(argv);

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

  if (wantFileCheck || wantProduction) {
    checkFiles(assetsDoc, errors, { ids });
  }
  if (wantConnectorCheck || wantProduction) {
    const connectorResult = validateTileConnectors(assetsDoc, mapDoc);
    errors.push(...connectorResult.errors.map((e) => ({ scope: 'connectors', ...e })));
  }
  if (wantReviewCheck || wantProduction) {
    checkReview(assetsDoc, errors, { production: wantProduction, ids });
  }
  if (wantAlphaHaloCheck || wantProduction) {
    checkAlphaHalo(assetsDoc, errors, { ids });
  }
  if (wantReadabilityCheck || wantProduction) {
    checkObjectReadabilityBounds(assetsDoc, errors, { ids });
  }

  if (errors.length === 0) {
    console.log('home-field validation: PASS');
    const modes = [];
    if (wantFileCheck || wantProduction) modes.push('file existence/dimensions');
    if (wantConnectorCheck || wantProduction) modes.push('tile connectors');
    if (wantReviewCheck || wantProduction) modes.push('review manifest');
    if (wantAlphaHaloCheck || wantProduction) modes.push('alpha halo/fringe');
    if (wantReadabilityCheck || wantProduction) modes.push('object readability bounds');
    if (wantProduction) modes.push('production approval');
    const modeText = modes.length > 0
      ? ` + ${modes.join(' + ')}`
      : ' (schema only; pass --check-files to verify PNGs; pass --check-connectors to validate tile adjacency)';
    const scopeText = ids ? ` scope=${[...ids].join(',')}` : '';
    console.log(`  schema for ${assetsDoc.assets.length} assets + ${(assetsDoc.characters || []).length} characters + ${(mapDoc.layers || []).length} map layers${modeText}${scopeText}`);
    process.exit(0);
  }

  console.error(`home-field validation: FAIL (${errors.length} error${errors.length === 1 ? '' : 's'})`);
  for (const err of errors) {
    console.error(`  [${err.scope}.${err.code}] ${err.message}`);
  }
  process.exit(1);
}

main();
