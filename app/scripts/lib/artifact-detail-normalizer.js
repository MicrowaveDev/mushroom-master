import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteJson } from '@microwavedev/backpack-game-core/tooling/evidence';
import { normalizeRasterDetail } from '@microwavedev/backpack-game-core/tooling/raster';
import { artifacts } from '../../server/game-data.js';
import { getBagShape } from '../../shared/bag-shape.js';
import {
  repoRoot,
  readPngRgba,
  encodeDeterministicPng,
  fileSha256
} from './bitmap-image-toolkit.js';

const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const cellPx = 160;

function shapeForArtifact(artifact) {
  if (artifact.family === 'bag') return getBagShape(artifact);
  return Array.from({ length: artifact.height || 1 }, () => Array(artifact.width || 1).fill(1));
}

function detailPolicyFor(shape) {
  const occupiedCells = shape.flat().filter(Boolean).length || 1;
  if (occupiedCells === 1) {
    return {
      label: 'single-cell-strong',
      quantizeStep: 18,
      neighborBlend: 0.18,
      minimumAlpha: 10
    };
  }
  if (occupiedCells <= 2) {
    return {
      label: 'two-cell-medium',
      quantizeStep: 12,
      neighborBlend: 0.10,
      minimumAlpha: 8
    };
  }
  if (occupiedCells <= 4) {
    return {
      label: 'four-cell-light',
      quantizeStep: 8,
      neighborBlend: 0.05,
      minimumAlpha: 6
    };
  }
  return {
    label: 'large-footprint-preserve',
    quantizeStep: 6,
    neighborBlend: 0.025,
    minimumAlpha: 5
  };
}

function validateExpectedDimensions(artifact, image, shape) {
  const rows = shape.length || 1;
  const cols = shape[0]?.length || 1;
  const expectedWidth = cols * cellPx;
  const expectedHeight = rows * cellPx;
  if (image.width !== expectedWidth || image.height !== expectedHeight) {
    throw new Error(
      `${artifact.id}: image is ${image.width}x${image.height}, expected displayed footprint ${cols}x${rows} at ${expectedWidth}x${expectedHeight}`
    );
  }
}

export function normalizeArtifact(artifact) {
  const imagePath = path.join(artifactDir, `${artifact.id}.png`);
  if (!fs.existsSync(imagePath)) {
    throw new Error(`${artifact.id}: missing PNG at ${path.relative(repoRoot, imagePath)}`);
  }
  const shape = shapeForArtifact(artifact);
  const image = readPngRgba(imagePath);
  validateExpectedDimensions(artifact, image, shape);
  const policy = detailPolicyFor(shape);
  const before = fileSha256(imagePath);
  const normalized = normalizeRasterDetail(image, policy);
  fs.writeFileSync(imagePath, encodeDeterministicPng(normalized));
  const after = fileSha256(imagePath);
  const invalidationPath = path.join(repoRoot, '.agent', 'artifact-image-workspace', 'processed', `${artifact.id}.normalization.json`);
  fs.mkdirSync(path.dirname(invalidationPath), { recursive: true });
  atomicWriteJson(invalidationPath, {
    id: artifact.id,
    policy: policy.label,
    beforeSha256: before,
    afterSha256: after,
    provenanceStatus: 'invalidated_until_regenerated'
  });
  return {
    id: artifact.id,
    policy: policy.label,
    changed: before !== after,
    beforeSha256: before,
    afterSha256: after,
    invalidationPath
  };
}

export function normalizeArtifacts({ all = false, ids = [] } = {}) {
  const targets = all
    ? artifacts.filter((artifact) => !artifact.isCharacter)
    : artifacts.filter((artifact) => ids.includes(artifact.id));

  if (!targets.length) {
    throw new Error('No matching artifacts selected for detail normalization');
  }

  return targets.map(normalizeArtifact);
}
