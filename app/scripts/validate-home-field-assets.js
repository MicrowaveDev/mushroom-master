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
import { readPngHeader } from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = path.join(sharedDir, 'home-field-assets.json');
const MAP_PATH = path.join(sharedDir, 'home-field-map.json');
const REVIEW_PATH = path.join(repoRoot, 'docs', 'home-field-asset-review.json');
const REVIEW_VERDICTS = new Set(['pending', 'needs_review', 'needs_regen', 'rejected', 'approved', 'placeholder']);
const REVIEW_CHECKS = [
  'repeatCheck',
  'connectorCheck',
  'cleanPreviewCheck',
  'styleCohesionCheck',
  'alphaCheck',
  'scaleCheck'
];
const REVIEW_CHECK_VALUES = new Set(['pass', 'fail', 'pending', 'placeholder', 'not_applicable']);

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

function checkReview(assetsDoc, errors, { production = false } = {}) {
  const reviewDoc = loadReviewDoc(errors);
  if (!reviewDoc) return;
  const reviews = new Map((reviewDoc.assets || []).map((entry) => [entry.id, entry]));
  const knownIds = new Set(allEntries(assetsDoc).map((asset) => asset.id));
  const approvedIds = [];

  for (const review of reviewDoc.assets || []) {
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

  for (const asset of allEntries(assetsDoc)) {
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
  const wantProduction = hasFlag(argv, 'production');

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
    checkFiles(assetsDoc, errors);
  }
  if (wantConnectorCheck || wantProduction) {
    const connectorResult = validateTileConnectors(assetsDoc, mapDoc);
    errors.push(...connectorResult.errors.map((e) => ({ scope: 'connectors', ...e })));
  }
  if (wantReviewCheck || wantProduction) {
    checkReview(assetsDoc, errors, { production: wantProduction });
  }

  if (errors.length === 0) {
    console.log('home-field validation: PASS');
    const modes = [];
    if (wantFileCheck || wantProduction) modes.push('file existence/dimensions');
    if (wantConnectorCheck || wantProduction) modes.push('tile connectors');
    if (wantReviewCheck || wantProduction) modes.push('review manifest');
    if (wantProduction) modes.push('production approval');
    const modeText = modes.length > 0
      ? ` + ${modes.join(' + ')}`
      : ' (schema only; pass --check-files to verify PNGs; pass --check-connectors to validate tile adjacency)';
    console.log(`  schema for ${assetsDoc.assets.length} assets + ${(assetsDoc.characters || []).length} characters + ${(mapDoc.layers || []).length} map layers${modeText}`);
    process.exit(0);
  }

  console.error(`home-field validation: FAIL (${errors.length} error${errors.length === 1 ? '' : 's'})`);
  for (const err of errors) {
    console.error(`  [${err.scope}.${err.code}] ${err.message}`);
  }
  process.exit(1);
}

main();
