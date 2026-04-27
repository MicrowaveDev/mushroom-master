import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { artifacts } from '../server/game-data.js';
import { getBagShape } from '../shared/bag-shape.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function parseArgs(argv) {
  const ids = [];
  let all = false;
  for (const arg of argv) {
    if (arg === '--all') all = true;
    else ids.push(arg.replace(/\.png$/, ''));
  }
  return { all, ids };
}

function readPngRgba(filePath) {
  const buf = fs.readFileSync(filePath);
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`${path.basename(filePath)} must be an 8-bit RGBA PNG after chroma-key removal`);
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * bytesPerPixel);
  let src = 0;
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const row = Buffer.from(inflated.subarray(src, src + stride));
    src += stride;
    const outStart = y * stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = prev[x] || 0;
      const upLeft = x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
      let value = row[x];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (value + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      row[x] = value;
      rgba[outStart + x] = value;
    }
    prev = row;
  }

  return { width, height, rgba };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function alphaAt(image, x, y) {
  return image.rgba[(y * image.width + x) * 4 + 3];
}

function alphaStats(image, rect) {
  let count = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (alphaAt(image, x, y) < 24) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const area = rect.width * rect.height;
  const bboxWidth = maxX >= minX ? maxX - minX + 1 : 0;
  const bboxHeight = maxY >= minY ? maxY - minY + 1 : 0;
  return {
    coverage: area ? count / area : 0,
    bboxWidth,
    bboxHeight,
    bboxFillX: rect.width ? bboxWidth / rect.width : 0,
    bboxFillY: rect.height ? bboxHeight / rect.height : 0
  };
}

function shapeForArtifact(artifact) {
  if (artifact.family === 'bag' && artifact.shape) return getBagShape(artifact, 0);
  return Array.from({ length: artifact.height }, () => Array(artifact.width).fill(1));
}

function thresholdsFor(artifact) {
  const cells = artifact.width * artifact.height;
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
    bboxFillX: artifact.width > 1 ? 0.78 : 0.58,
    bboxFillY: artifact.height > 1 ? 0.78 : 0.58
  };
}

function validateArtifact(artifact) {
  const filePath = path.join(artifactDir, `${artifact.id}.png`);
  if (!fs.existsSync(filePath)) return { skipped: true, id: artifact.id };

  const image = readPngRgba(filePath);
  const shape = shapeForArtifact(artifact);
  const rows = shape.length;
  const cols = shape[0]?.length || 1;
  const cellWidth = image.width / cols;
  const cellHeight = image.height / rows;
  const thresholds = thresholdsFor(artifact);
  const total = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
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
      if (!occupied && stats.coverage > 0.02) {
        failures.push(`empty mask cell ${col},${row} is not transparent enough (${formatPct(stats.coverage)})`);
      }
    }
  }

  return { id: artifact.id, image, total, failures };
}

function formatPct(value) {
  return `${Math.round(value * 100)}%`;
}

const { all, ids } = parseArgs(process.argv.slice(2));
const targets = all
  ? artifacts
  : artifacts.filter((artifact) => ids.includes(artifact.id));

if (!targets.length) {
  console.error('Usage: npm run game:artifacts:validate -- --all OR npm run game:artifacts:validate -- artifact_id [...artifact_id]');
  process.exit(2);
}

let failed = false;
for (const artifact of targets) {
  const result = validateArtifact(artifact);
  if (result.skipped) {
    console.log(`SKIP ${result.id}: no PNG`);
    continue;
  }
  const summary = `${result.id}: coverage=${formatPct(result.total.coverage)} bbox=${formatPct(result.total.bboxFillX)}x${formatPct(result.total.bboxFillY)}`;
  if (result.failures.length) {
    failed = true;
    console.error(`FAIL ${summary}`);
    for (const failure of result.failures) console.error(`  - ${failure}`);
  } else {
    console.log(`OK   ${summary}`);
  }
}

if (failed) process.exit(1);
