import fs from 'node:fs';
import path from 'node:path';
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

function quantize(value, step) {
  return Math.max(0, Math.min(255, Math.round(value / step) * step));
}

function pixelOffset(image, x, y) {
  return (y * image.width + x) * 4;
}

function averageNeighbors(image, x, y, minimumAlpha) {
  let totalWeight = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  const samples = [
    [x - 1, y, 1],
    [x + 1, y, 1],
    [x, y - 1, 1],
    [x, y + 1, 1],
    [x - 1, y - 1, 0.5],
    [x + 1, y - 1, 0.5],
    [x - 1, y + 1, 0.5],
    [x + 1, y + 1, 0.5]
  ];
  for (const [sampleX, sampleY, weight] of samples) {
    if (sampleX < 0 || sampleX >= image.width || sampleY < 0 || sampleY >= image.height) continue;
    const offset = pixelOffset(image, sampleX, sampleY);
    const alpha = image.rgba[offset + 3];
    if (alpha < minimumAlpha) continue;
    totalWeight += weight;
    r += image.rgba[offset] * weight;
    g += image.rgba[offset + 1] * weight;
    b += image.rgba[offset + 2] * weight;
  }
  if (!totalWeight) return null;
  return [r / totalWeight, g / totalWeight, b / totalWeight];
}

function normalizeImage(image, policy) {
  const next = Buffer.from(image.rgba);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = pixelOffset(image, x, y);
      const alpha = image.rgba[offset + 3];
      if (alpha < policy.minimumAlpha) {
        next[offset] = 0;
        next[offset + 1] = 0;
        next[offset + 2] = 0;
        next[offset + 3] = 0;
        continue;
      }

      const average = policy.neighborBlend > 0
        ? averageNeighbors(image, x, y, policy.minimumAlpha)
        : null;
      for (let channel = 0; channel < 3; channel += 1) {
        const source = image.rgba[offset + channel];
        const blended = average
          ? source * (1 - policy.neighborBlend) + average[channel] * policy.neighborBlend
          : source;
        next[offset + channel] = quantize(blended, policy.quantizeStep);
      }
    }
  }
  return { width: image.width, height: image.height, rgba: next };
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
  const normalized = normalizeImage(image, policy);
  fs.writeFileSync(imagePath, encodeDeterministicPng(normalized));
  const after = fileSha256(imagePath);
  const invalidationPath = path.join(repoRoot, '.agent', 'artifact-image-workspace', 'processed', `${artifact.id}.normalization.json`);
  fs.mkdirSync(path.dirname(invalidationPath), { recursive: true });
  fs.writeFileSync(invalidationPath, `${JSON.stringify({
    id: artifact.id,
    policy: policy.label,
    beforeSha256: before,
    afterSha256: after,
    provenanceStatus: 'invalidated_until_regenerated'
  }, null, 2)}\n`);
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
