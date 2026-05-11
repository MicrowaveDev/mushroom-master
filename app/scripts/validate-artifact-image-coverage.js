import fs from 'node:fs';
import path from 'node:path';
import { artifacts } from '../server/game-data.js';
import { getBagShape } from '../shared/bag-shape.js';
import {
  repoRoot,
  readPngRgba,
  readPngAsRgba,
  alphaAt,
  alphaStats,
  resolveFreshAfterTimestamp
} from './lib/bitmap-image-toolkit.js';

const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const artifactImageWorkspace = process.env.ARTIFACT_IMAGE_WORKSPACE
  ? path.resolve(process.env.ARTIFACT_IMAGE_WORKSPACE)
  : path.join(repoRoot, '.agent', 'artifact-image-workspace');
const imagegenRawDir = path.join(artifactImageWorkspace, 'raw');
const RAW_SOURCE_ASPECT_MAX_DRIFT = 1.65;
const RAW_SOURCE_ASPECT_APPROVED_EXCEPTIONS = new Set([
  // Existing approved 1x1 diagonal shard source is tall, but the final icon
  // remains square-readable and is not a two-cell source squeezed into one.
  'body_memory_splinter'
]);

function parseArgs(argv) {
  const ids = [];
  let all = false;
  let freshAfter = null;
  let freshFromImagegenRaw = true;
  let rawSourceAspect = true;
  let strictMaskTransparency = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') all = true;
    else if (arg === '--fresh-from-imagegen-raw') freshFromImagegenRaw = true;
    else if (arg === '--no-fresh-from-imagegen-raw') freshFromImagegenRaw = false;
    else if (arg === '--raw-source-aspect') rawSourceAspect = true;
    else if (arg === '--no-raw-source-aspect') rawSourceAspect = false;
    else if (arg === '--strict-mask-transparency') strictMaskTransparency = true;
    else if (arg === '--fresh-after') {
      freshAfter = argv[i + 1];
      if (!freshAfter || freshAfter.startsWith('--')) {
        throw new Error('--fresh-after requires a path, ISO date, or epoch timestamp');
      }
      i += 1;
    } else if (arg.startsWith('--fresh-after=')) {
      freshAfter = arg.slice('--fresh-after='.length);
    } else {
      ids.push(arg.replace(/\.png$/, ''));
    }
  }
  return { all, ids, freshAfter, freshFromImagegenRaw, rawSourceAspect, strictMaskTransparency };
}

function shapeForArtifact(artifact) {
  if (artifact.family === 'bag') return getBagShape(artifact, 0);
  return Array.from({ length: artifact.height }, () => Array(artifact.width).fill(1));
}

function thresholdsFor(artifact) {
  const shape = shapeForArtifact(artifact);
  const rows = shape.length || 1;
  const cols = shape[0]?.length || 1;
  const cells = shape.flat().filter(Boolean).length;
  const hasMaskGaps = shape.flat().some((cell) => !cell);
  if (artifact.family === 'bag' && hasMaskGaps) {
    return {
      totalCoverage: 0.20,
      cellCoverage: 0.18,
      bboxFillX: 0.70,
      bboxFillY: 0.70
    };
  }
  if (cells === 1) {
    return {
      totalCoverage: 0.28,
      cellCoverage: 0.22,
      bboxFillX: 0.68,
      bboxFillY: 0.68
    };
  }
  return {
    totalCoverage: 0.30,
    cellCoverage: 0.18,
    bboxFillX: cols > 1 ? 0.78 : 0.58,
    bboxFillY: rows > 1 ? 0.78 : 0.58
  };
}

function hasMaskGaps(artifact) {
  return shapeForArtifact(artifact).flat().some((cell) => !cell);
}

function allowsVisualMaskOverhang(artifact, { strictMaskTransparency = false } = {}) {
  return artifact.family === 'bag' && hasMaskGaps(artifact) && !strictMaskTransparency;
}

function shouldHaveCenteredSilhouette(artifact) {
  const shape = shapeForArtifact(artifact);
  const rows = shape.length || 1;
  const cols = shape[0]?.length || 1;
  return cols === rows && cols > 1 && !hasMaskGaps(artifact);
}

function edgePaddingFailures(artifact, image, total) {
  const failures = [];
  if (!total.bboxWidth || !total.bboxHeight) return failures;

  const minEdgePx = Math.max(8, Math.round(Math.min(image.width, image.height) * 0.04));
  const margins = {
    left: total.marginLeft,
    right: total.marginRight,
    top: total.marginTop,
    bottom: total.marginBottom
  };
  for (const [side, value] of Object.entries(margins)) {
    if (value >= minEdgePx) continue;
    failures.push(
      `alpha margin on ${side} edge ${value}px < ${minEdgePx}px; inspect the raw source, rerun conversion with more padding if raw pixels are complete, or regenerate/reselect an uncut source if the raw is clipped`
    );
  }

  if (shouldHaveCenteredSilhouette(artifact)) {
    const maxDriftPx = Math.max(10, Math.round(Math.min(image.width, image.height) * 0.05));
    const horizontalDrift = Math.abs(total.marginLeft - total.marginRight);
    const verticalDrift = Math.abs(total.marginTop - total.marginBottom);
    if (horizontalDrift > maxDriftPx) {
      failures.push(
        `centered artifact has unbalanced horizontal margins (${total.marginLeft}px left vs ${total.marginRight}px right); recenter during conversion or choose an uncut source`
      );
    }
    if (verticalDrift > maxDriftPx) {
      failures.push(
        `centered artifact has unbalanced vertical margins (${total.marginTop}px top vs ${total.marginBottom}px bottom); recenter during conversion or choose an uncut source`
      );
    }
  }

  return failures;
}

function maskGapEdges(shape) {
  const edges = [];
  const rows = shape.length;
  const cols = shape[0]?.length || 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!shape[row]?.[col]) continue;
      const neighbors = [
        { direction: 'left', emptyCol: col - 1, emptyRow: row },
        { direction: 'right', emptyCol: col + 1, emptyRow: row },
        { direction: 'top', emptyCol: col, emptyRow: row - 1 },
        { direction: 'bottom', emptyCol: col, emptyRow: row + 1 }
      ];
      for (const edge of neighbors) {
        if (
          edge.emptyRow < 0
          || edge.emptyRow >= rows
          || edge.emptyCol < 0
          || edge.emptyCol >= cols
          || shape[edge.emptyRow]?.[edge.emptyCol]
        ) {
          continue;
        }
        edges.push({ col, row, ...edge });
      }
    }
  }
  return edges;
}

function longestTruthyRun(values) {
  let longest = 0;
  let current = 0;
  let count = 0;
  for (const value of values) {
    if (value) {
      current += 1;
      count += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return { longest, count };
}

function maskClippingFailures(image, shape, cellWidth, cellHeight) {
  const failures = [];
  const occupiedCells = shape.flat().filter(Boolean).length;
  if (occupiedCells === shape.length * (shape[0]?.length || 0)) return failures;
  if (
    Math.abs(cellWidth - Math.round(cellWidth)) > 0.01
    || Math.abs(cellHeight - Math.round(cellHeight)) > 0.01
  ) {
    return failures;
  }

  const stripPx = 4;
  const alphaThreshold = 48;
  const maxStraightRunRatio = 0.60;
  const maxStraightCountRatio = 0.60;

  for (const edge of maskGapEdges(shape)) {
    const edgeLength = edge.direction === 'left' || edge.direction === 'right'
      ? Math.round(cellHeight)
      : Math.round(cellWidth);
    const inset = Math.min(10, Math.floor(edgeLength * 0.08));
    const samples = [];

    for (let i = inset; i < edgeLength - inset; i += 1) {
      let maxAlpha = 0;
      for (let stripOffset = 0; stripOffset < stripPx; stripOffset += 1) {
        let x;
        let y;
        if (edge.direction === 'left') {
          x = Math.round(edge.col * cellWidth + stripOffset);
          y = Math.round(edge.row * cellHeight + i);
        } else if (edge.direction === 'right') {
          x = Math.round((edge.col + 1) * cellWidth - 1 - stripOffset);
          y = Math.round(edge.row * cellHeight + i);
        } else if (edge.direction === 'top') {
          x = Math.round(edge.col * cellWidth + i);
          y = Math.round(edge.row * cellHeight + stripOffset);
        } else {
          x = Math.round(edge.col * cellWidth + i);
          y = Math.round((edge.row + 1) * cellHeight - 1 - stripOffset);
        }
        maxAlpha = Math.max(maxAlpha, alphaAt(image, x, y));
      }
      samples.push(maxAlpha > alphaThreshold);
    }

    const { longest, count } = longestTruthyRun(samples);
    const effectiveLength = samples.length || 1;
    const runRatio = longest / effectiveLength;
    const countRatio = count / effectiveLength;
    if (runRatio >= maxStraightRunRatio && countRatio >= maxStraightCountRatio) {
      failures.push(
        `art appears hard-clipped against empty mask cell ${edge.emptyCol},${edge.emptyRow} from occupied cell ${edge.col},${edge.row} (${edge.direction} edge has ${formatPct(runRatio)} straight alpha run); regenerate/reprocess so the silhouette naturally avoids empty cells`
      );
    }
  }

  return failures;
}

function validateArtifact(artifact, options = {}) {
  const filePath = path.join(artifactDir, `${artifact.id}.png`);
  if (!fs.existsSync(filePath)) return { skipped: true, id: artifact.id };

  const stats = fs.statSync(filePath);
  const image = readPngRgba(filePath);
  const shape = shapeForArtifact(artifact);
  const rows = shape.length;
  const cols = shape[0]?.length || 1;
  const cellWidth = image.width / cols;
  const cellHeight = image.height / rows;
  const thresholds = thresholdsFor(artifact);
  const total = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
  const allowMaskOverhang = allowsVisualMaskOverhang(artifact, options);
  const failures = [];

  if (Math.abs(cellWidth - Math.round(cellWidth)) > 0.01 || Math.abs(cellHeight - Math.round(cellHeight)) > 0.01) {
    failures.push(`image size ${image.width}x${image.height} is not divisible by footprint ${cols}x${rows}`);
  }
  if (total.coverage < thresholds.totalCoverage) {
    failures.push(`overall alpha coverage ${formatPct(total.coverage)} < ${formatPct(thresholds.totalCoverage)}`);
  }
  if (total.bboxFillX < thresholds.bboxFillX) {
    failures.push(`silhouette width fill ${formatPct(total.bboxFillX)} < ${formatPct(thresholds.bboxFillX)}`);
  }
  if (total.bboxFillY < thresholds.bboxFillY) {
    failures.push(`silhouette height fill ${formatPct(total.bboxFillY)} < ${formatPct(thresholds.bboxFillY)}`);
  }
  failures.push(...edgePaddingFailures(artifact, image, total));

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const occupied = shape[row]?.[col];
      const rect = {
        x: Math.round(col * cellWidth),
        y: Math.round(row * cellHeight),
        width: Math.round(cellWidth),
        height: Math.round(cellHeight)
      };
      const stats = alphaStats(image, rect);
      if (occupied && stats.coverage < thresholds.cellCoverage) {
        failures.push(`cell ${col},${row} alpha coverage ${formatPct(stats.coverage)} < ${formatPct(thresholds.cellCoverage)}`);
      }
      if (!occupied && !allowMaskOverhang && stats.coverage > 0.02) {
        failures.push(`empty mask cell ${col},${row} is not transparent enough (${formatPct(stats.coverage)})`);
      }
    }
  }
  if (!allowMaskOverhang) {
    failures.push(...maskClippingFailures(image, shape, cellWidth, cellHeight));
  }

  return { id: artifact.id, image, stats, total, failures };
}

function formatPct(value) {
  return `${Math.round(value * 100)}%`;
}

function formatTime(ms) {
  return new Date(ms).toISOString();
}

function isMagentaKeyPixel(r, g, b) {
  const magentaDistance = Math.abs(r - 255) + Math.abs(g - 0) + Math.abs(b - 255);
  const isStrongMagenta = r > 150 && b > 135 && g < 140 && Math.abs(r - b) < 95;
  return magentaDistance < 140 || isStrongMagenta;
}

function rawSourceSubjectStats(raw) {
  const image = readPngAsRgba(raw.filePath);
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      const r = image.rgba[offset];
      const g = image.rgba[offset + 1];
      const b = image.rgba[offset + 2];
      const alpha = image.rgba[offset + 3];
      if (alpha <= 12 || isMagentaKeyPixel(r, g, b)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  return {
    width,
    height,
    aspect: width / height
  };
}

function rawSourceAspectFailures(artifact, raw) {
  const failures = [];
  const shape = shapeForArtifact(artifact);
  const rows = shape.length || 1;
  const cols = shape[0]?.length || 1;
  const expectedAspect = cols / rows;

  let sourceStats;
  try {
    sourceStats = rawSourceSubjectStats(raw);
  } catch (error) {
    failures.push(`could not inspect raw imagegen source aspect for ${raw.label}: ${error.message}`);
    return failures;
  }

  if (!sourceStats) {
    failures.push(`raw imagegen source ${raw.label} has no non-key subject pixels to compare against footprint ${cols}x${rows}`);
    return failures;
  }

  const drift = Math.max(sourceStats.aspect / expectedAspect, expectedAspect / sourceStats.aspect);
  const maxDrift = hasMaskGaps(artifact) ? 1.9 : RAW_SOURCE_ASPECT_MAX_DRIFT;
  if (drift > maxDrift && !RAW_SOURCE_ASPECT_APPROVED_EXCEPTIONS.has(artifact.id)) {
    failures.push(
      `raw imagegen source subject aspect ${sourceStats.aspect.toFixed(2)} (${sourceStats.width}x${sourceStats.height}px bbox) does not match ${cols}x${rows} footprint aspect ${expectedAspect.toFixed(2)} (drift ${drift.toFixed(2)} > ${maxDrift}); regenerate with the correct footprint orientation instead of squeezing/stretching into web/public/artifacts/${artifact.id}.png`
    );
  }

  return failures;
}

function parseFreshAfter(value) {
  if (!value) return null;

  const resolvedPath = path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
  if (fs.existsSync(resolvedPath)) {
    return {
      label: path.relative(repoRoot, resolvedPath) || resolvedPath,
      mtimeMs: fs.statSync(resolvedPath).mtimeMs
    };
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return {
      label: value,
      mtimeMs: numeric > 1e12 ? numeric : numeric * 1000
    };
  }

  const parsedDate = Date.parse(value);
  if (Number.isFinite(parsedDate)) {
    return { label: value, mtimeMs: parsedDate };
  }

  throw new Error(`Cannot parse --fresh-after value "${value}" as a path, date, or epoch timestamp`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function newestImagegenRawFor(id) {
  if (!fs.existsSync(imagegenRawDir)) return null;
  const sourceRe = new RegExp(`^${escapeRegExp(id)}\\.source.*\\.png$`);
  const matches = fs.readdirSync(imagegenRawDir)
    .filter((entry) => sourceRe.test(entry))
    .map((entry) => {
      const filePath = path.join(imagegenRawDir, entry);
      return {
        filePath,
        label: path.relative(repoRoot, filePath),
        mtimeMs: fs.statSync(filePath).mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0] || null;
}

function freshnessFailures(artifact, stats, freshness) {
  const failures = [];
  const outputLabel = `web/public/artifacts/${artifact.id}.png`;
  const needsRaw = freshness.freshFromImagegenRaw || freshness.rawSourceAspect;
  const raw = needsRaw ? newestImagegenRawFor(artifact.id) : null;

  if (freshness.freshAfter && stats.mtimeMs <= freshness.freshAfter.mtimeMs) {
    failures.push(
      `${outputLabel} was updated at ${formatTime(stats.mtimeMs)}, not after ${freshness.freshAfter.label} (${formatTime(freshness.freshAfter.mtimeMs)}); handle the imagegen output and rewrite this PNG`
    );
  }

  if (freshness.freshFromImagegenRaw) {
    if (!raw) {
      failures.push(
        `no raw imagegen source found at ${path.relative(repoRoot, imagegenRawDir)}/${artifact.id}.source*.png; copy/process the imagegen output before accepting ${outputLabel}`
      );
    } else if (stats.mtimeMs <= raw.mtimeMs) {
      failures.push(
        `${outputLabel} was updated at ${formatTime(stats.mtimeMs)}, not after raw imagegen source ${raw.label} (${formatTime(raw.mtimeMs)}); keep cropping/keying/fitting until the app PNG is newer`
      );
    }
  }

  if (freshness.rawSourceAspect && raw) {
    failures.push(...rawSourceAspectFailures(artifact, raw));
  }

  return failures;
}

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
  parsed.freshAfter = parseFreshAfter(parsed.freshAfter);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const { all, ids } = parsed;
const targets = all
  ? artifacts
  : artifacts.filter((artifact) => ids.includes(artifact.id));

if (!targets.length) {
  console.error('Usage: npm run game:artifacts:validate -- --all OR npm run game:artifacts:validate -- artifact_id [...artifact_id]');
  console.error('Freshness defaults to --fresh-from-imagegen-raw. Raw source aspect checking defaults on. Options: --no-fresh-from-imagegen-raw OR --fresh-after <path|ISO date|epoch> OR --strict-mask-transparency OR --no-raw-source-aspect');
  process.exit(2);
}

let failed = false;
for (const artifact of targets) {
  const result = validateArtifact(artifact, parsed);
  if (result.skipped) {
    console.log(`SKIP ${result.id}: no PNG`);
    continue;
  }
  const summary = `${result.id}: coverage=${formatPct(result.total.coverage)} bbox=${formatPct(result.total.bboxFillX)}x${formatPct(result.total.bboxFillY)}`;
  const failures = [
    ...freshnessFailures(artifact, result.stats, parsed),
    ...result.failures
  ];
  if (failures.length) {
    failed = true;
    console.error(`FAIL ${summary}`);
    for (const failure of failures) console.error(`  - ${failure}`);
  } else {
    console.log(`OK   ${summary}`);
  }
}

if (failed) process.exit(1);
