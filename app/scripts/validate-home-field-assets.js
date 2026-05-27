#!/usr/bin/env node
/**
 * CLI wrapper around app/shared/home-field/home-field-validator.js.
 *
 * Run:
 *   npm run game:home-field:validate
 *   npm run game:home-field:validate -- --check-files
 *   npm run game:home-field:validate -- --check-connectors
 *   npm run game:home-field:validate -- --check-review
 *   npm run game:home-field:validate -- --check-edge-profiles
 *   npm run game:home-field:validate -- --check-family-cohesion
 *   npm run game:home-field:validate -- --production
 *   npm run game:home-field:validate -- --production --full-registry-production
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

function activeProductionIds(assetsDoc, mapDoc) {
  const ids = new Set();
  for (const layer of mapDoc.layers || []) {
    const items = layer.type === 'tileLayer'
      ? layer.tiles || []
      : layer.type === 'objectLayer'
        ? layer.objects || []
        : layer.type === 'effectLayer'
          ? layer.effects || []
          : [];
    for (const item of items) {
      if (item.assetId) ids.add(item.assetId);
    }
  }
  for (const character of assetsDoc.characters || []) {
    if (character.status === 'approved' && !character.id.startsWith('_')) {
      ids.add(character.id);
    }
  }
  return ids;
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

function terrainLayer(mapDoc) {
  return (mapDoc.layers || []).find((layer) => layer.type === 'tileLayer' && layer.id === 'terrain');
}

function averageEdgeRgb(image, side, band = null, thickness = 6) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const xRange = side === 'w'
    ? [0, thickness]
    : side === 'e'
      ? [image.width - thickness, image.width]
      : [band?.start ?? 0, band?.end ?? image.width];
  const yRange = side === 'n'
    ? [0, thickness]
    : side === 's'
      ? [image.height - thickness, image.height]
      : [band?.start ?? 0, band?.end ?? image.height];
  for (let y = Math.max(0, yRange[0]); y < Math.min(image.height, yRange[1]); y += 1) {
    for (let x = Math.max(0, xRange[0]); x < Math.min(image.width, xRange[1]); x += 1) {
      const i = (y * image.width + x) * 4;
      r += image.rgba[i + 0];
      g += image.rgba[i + 1];
      b += image.rgba[i + 2];
      count += 1;
    }
  }
  return count ? [r / count, g / count, b / count] : [0, 0, 0];
}

function rgbDistance(a, b) {
  return Math.sqrt(((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2));
}

function averageRgb(image, region = null) {
  const x0 = region?.x ?? 0;
  const y0 = region?.y ?? 0;
  const x1 = Math.min(image.width, x0 + (region?.width ?? image.width));
  const y1 = Math.min(image.height, y0 + (region?.height ?? image.height));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = Math.max(0, y0); y < y1; y += 1) {
    for (let x = Math.max(0, x0); x < x1; x += 1) {
      const i = (y * image.width + x) * 4;
      r += image.rgba[i + 0];
      g += image.rgba[i + 1];
      b += image.rgba[i + 2];
      count += 1;
    }
  }
  return count ? [r / count, g / count, b / count] : [0, 0, 0];
}

function luminance(rgb) {
  return (rgb[0] * 0.2126) + (rgb[1] * 0.7152) + (rgb[2] * 0.0722);
}

function checkTerrainFamilyCohesion(assetsDoc, errors, { ids = null } = {}) {
  if (!ids) return;
  const terrain = (assetsDoc.assets || []).filter((asset) => asset.type === 'terrain' && ids.has(asset.id));
  if (terrain.length < 2) return;
  const imageCache = new Map();
  const imageFor = (asset) => {
    if (imageCache.has(asset.id)) return imageCache.get(asset.id);
    const abs = path.join(ASSET_ROOT, asset.outputPath);
    if (!fs.existsSync(abs)) return null;
    const image = readPngRgba(abs);
    imageCache.set(asset.id, image);
    return image;
  };

  const grassEdgeSamples = [];
  const pathBandSamples = [];
  for (const asset of terrain) {
    const image = imageFor(asset);
    if (!image) continue;
    const edgeThickness = Math.max(8, Math.round(Math.min(image.width, image.height) * 0.08));
    const connectors = asset.tile?.connectors || {};
    for (const side of ['n', 'e', 's', 'w']) {
      if (connectors[side] !== 'grass') continue;
      const region = side === 'n'
        ? { x: 0, y: 0, width: image.width, height: edgeThickness }
        : side === 's'
          ? { x: 0, y: image.height - edgeThickness, width: image.width, height: edgeThickness }
          : side === 'w'
            ? { x: 0, y: 0, width: edgeThickness, height: image.height }
            : { x: image.width - edgeThickness, y: 0, width: edgeThickness, height: image.height };
      grassEdgeSamples.push({ id: asset.id, side, rgb: averageRgb(image, region) });
    }
    if (asset.tile?.pathBand?.axis === 'horizontal') {
      const half = asset.tile.pathBand.pathWidth / 2;
      const y = Math.max(0, Math.round(asset.tile.pathBand.pathCenterY - half));
      const height = Math.min(image.height - y, Math.round(asset.tile.pathBand.pathWidth));
      pathBandSamples.push({ id: asset.id, rgb: averageRgb(image, { x: 0, y, width: image.width, height }) });
    }
  }

  if (grassEdgeSamples.length >= 2) {
    const avg = grassEdgeSamples.reduce((sum, sample) => {
      sum[0] += sample.rgb[0];
      sum[1] += sample.rgb[1];
      sum[2] += sample.rgb[2];
      return sum;
    }, [0, 0, 0]).map((v) => v / grassEdgeSamples.length);
    for (const sample of grassEdgeSamples) {
      const distance = rgbDistance(sample.rgb, avg);
      if (distance > 34) {
        errors.push({
          scope: 'family_cohesion',
          code: 'grass_edge_outlier',
          message: `terrain "${sample.id}" ${sample.side} grass edge RGB distance from family average is ${distance.toFixed(1)} > 34; likely palette/value drift even if connector metadata passes`
        });
      }
    }
  }

  if (pathBandSamples.length >= 2) {
    const avgLum = pathBandSamples.reduce((sum, sample) => sum + luminance(sample.rgb), 0) / pathBandSamples.length;
    for (const sample of pathBandSamples) {
      const delta = Math.abs(luminance(sample.rgb) - avgLum);
      if (delta > 24) {
        errors.push({
          scope: 'family_cohesion',
          code: 'path_band_value_outlier',
          message: `terrain "${sample.id}" path-band luminance differs from family average by ${delta.toFixed(1)} > 24; likely dirt/glow band mismatch`
        });
      }
    }
  }
}

function pathBandFor(asset, side) {
  const band = asset.tile?.pathBand;
  if (!band) return null;
  if (band.axis === 'horizontal' && ['w', 'e'].includes(side)) {
    const half = band.pathWidth / 2;
    return {
      start: Math.round(band.pathCenterY - half),
      end: Math.round(band.pathCenterY + half)
    };
  }
  if (band.axis === 'vertical' && ['n', 's'].includes(side)) {
    const half = band.pathWidth / 2;
    return {
      start: Math.round(band.pathCenterX - half),
      end: Math.round(band.pathCenterX + half)
    };
  }
  return null;
}

function checkTerrainEdgeProfiles(assetsDoc, mapDoc, errors, { ids = null } = {}) {
  const layer = terrainLayer(mapDoc);
  if (!layer) return;
  const terrainById = new Map((assetsDoc.assets || []).filter((asset) => asset.type === 'terrain').map((asset) => [asset.id, asset]));
  const tileSize = mapDoc.world?.tileSize || mapDoc.tileSize || 256;
  const byCell = new Map();
  for (const tile of layer.tiles || []) {
    byCell.set(`${tile.x / tileSize},${tile.y / tileSize}`, tile.assetId);
  }
  const imageCache = new Map();
  const imageFor = (asset) => {
    if (imageCache.has(asset.id)) return imageCache.get(asset.id);
    const abs = path.join(ASSET_ROOT, asset.outputPath);
    if (!fs.existsSync(abs)) return null;
    const image = readPngRgba(abs);
    imageCache.set(asset.id, image);
    return image;
  };
  const checks = [
    { dx: 1, dy: 0, aSide: 'e', bSide: 'w', dir: 'horizontal' },
    { dx: 0, dy: 1, aSide: 's', bSide: 'n', dir: 'vertical' }
  ];
  for (const tile of layer.tiles || []) {
    const cx = tile.x / tileSize;
    const cy = tile.y / tileSize;
    for (const check of checks) {
      const neighborId = byCell.get(`${cx + check.dx},${cy + check.dy}`);
      if (!neighborId) continue;
      if (ids && !ids.has(tile.assetId) && !ids.has(neighborId)) continue;
      const asset = terrainById.get(tile.assetId);
      const neighbor = terrainById.get(neighborId);
      if (!asset || !neighbor) continue;
      const connector = asset.tile?.connectors?.[check.aSide];
      const neighborConnector = neighbor.tile?.connectors?.[check.bSide];
      if (!connector || connector !== neighborConnector) continue;
      const image = imageFor(asset);
      const neighborImage = imageFor(neighbor);
      if (!image || !neighborImage) continue;
      const band = pathBandFor(asset, check.aSide) || pathBandFor(neighbor, check.bSide);
      const distance = rgbDistance(
        averageEdgeRgb(image, check.aSide, band),
        averageEdgeRgb(neighborImage, check.bSide, band)
      );
      const threshold = connector.startsWith('path') ? 52 : connector.startsWith('edge') ? 62 : 48;
      if (distance > threshold) {
        errors.push({
          scope: 'edge_profiles',
          code: 'edge_profile_mismatch',
          message: `${check.dir} neighbor "${asset.id}" ${check.aSide} -> "${neighbor.id}" ${check.bSide} share connector "${connector}" but edge RGB distance is ${distance.toFixed(1)} > ${threshold}; inspect adjacency sheet and regenerate if the seam is visible`
        });
      }
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
  const wantEdgeProfileCheck = hasFlag(argv, 'check-edge-profiles');
  const wantFamilyCohesionCheck = hasFlag(argv, 'check-family-cohesion');
  const wantProduction = hasFlag(argv, 'production');
  const wantFullRegistryProduction = hasFlag(argv, 'full-registry-production');
  let ids = parseIds(argv);

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
  if (wantProduction && !ids && !wantFullRegistryProduction) {
    ids = activeProductionIds(assetsDoc, mapDoc);
  }

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
  if (wantEdgeProfileCheck || wantProduction) {
    checkTerrainEdgeProfiles(assetsDoc, mapDoc, errors, { ids });
  }
  if (wantFamilyCohesionCheck || wantProduction) {
    checkTerrainFamilyCohesion(assetsDoc, errors, { ids });
  }

  if (errors.length === 0) {
    console.log('home-field validation: PASS');
    const modes = [];
    if (wantFileCheck || wantProduction) modes.push('file existence/dimensions');
    if (wantConnectorCheck || wantProduction) modes.push('tile connectors');
    if (wantReviewCheck || wantProduction) modes.push('review manifest');
    if (wantAlphaHaloCheck || wantProduction) modes.push('alpha halo/fringe');
    if (wantReadabilityCheck || wantProduction) modes.push('object readability bounds');
    if (wantEdgeProfileCheck || wantProduction) modes.push('terrain edge profiles');
    if (wantFamilyCohesionCheck || wantProduction) modes.push('terrain family cohesion');
    if (wantProduction) modes.push('production approval');
    const modeText = modes.length > 0
      ? ` + ${modes.join(' + ')}`
      : ' (schema only; pass --check-files to verify PNGs; pass --check-connectors to validate tile adjacency)';
    const productionScopeText = wantProduction && !wantFullRegistryProduction
      ? ' active production scene'
      : '';
    const scopeText = ids ? ` scope=${[...ids].join(',')}` : productionScopeText;
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
