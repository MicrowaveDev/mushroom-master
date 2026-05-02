// Shared primitives for the bitmap image pipelines (artifacts, season
// emblems, achievements). Asset-agnostic: PNG decode, alpha analysis,
// hashing, deterministic Puppeteer contact-sheet rendering with manifest
// tracking, metadata bundling, and provenance verification.
//
// Per-domain logic (footprint rules, descriptor lists, prompt templates)
// stays in the per-domain script next to its asset list.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const toolkitPath = fileURLToPath(import.meta.url);
export const repoRoot = path.resolve(path.dirname(toolkitPath), '..', '..', '..');

// ---------- hashing ----------

export function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function bufferSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---------- html ----------

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// ---------- PNG decode ----------

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function readPngHeader(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${path.relative(repoRoot, filePath)} is not a PNG`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    size: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

export function readPngRgba(filePath) {
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

// ---------- alpha analysis ----------

export function alphaAt(image, x, y) {
  return image.rgba[(y * image.width + x) * 4 + 3];
}

export function alphaStats(image, rect, alphaThreshold = 24) {
  let count = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (alphaAt(image, x, y) < alphaThreshold) continue;
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
  const hasAlpha = bboxWidth > 0 && bboxHeight > 0;
  return {
    coverage: area ? count / area : 0,
    minX: hasAlpha ? minX : null,
    minY: hasAlpha ? minY : null,
    maxX: hasAlpha ? maxX : null,
    maxY: hasAlpha ? maxY : null,
    marginLeft: hasAlpha ? minX - rect.x : rect.width,
    marginRight: hasAlpha ? rect.x + rect.width - 1 - maxX : rect.width,
    marginTop: hasAlpha ? minY - rect.y : rect.height,
    marginBottom: hasAlpha ? rect.y + rect.height - 1 - maxY : rect.height,
    bboxWidth,
    bboxHeight,
    bboxFillX: rect.width ? bboxWidth / rect.width : 0,
    bboxFillY: rect.height ? bboxHeight / rect.height : 0
  };
}

// ---------- freshness ----------

export function resolveFreshAfterTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (fs.existsSync(value)) return fs.statSync(value).mtimeMs;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  throw new Error(`Cannot interpret freshAfter value: ${value}`);
}

// ---------- contact-sheet manifest tracking ----------

export function defaultManifestPathFor(outPath) {
  const ext = path.extname(outPath);
  const base = ext ? outPath.slice(0, -ext.length) : outPath;
  return `${base}.manifest.json`;
}

export function tempPngPathFor(outPath) {
  return `${outPath}.${process.pid}.${Date.now()}.tmp.png`;
}

export function readPreviousManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function inputEntriesFromPaths(entries) {
  return entries.map(({ id, filePath }) => {
    const stats = fs.statSync(filePath);
    return {
      id,
      path: path.relative(repoRoot, filePath),
      sha256: fileSha256(filePath),
      size: stats.size,
      mtimeMs: Math.round(stats.mtimeMs)
    };
  });
}

export function inputSetHash(entries) {
  const stableEntries = entries
    .map(({ id, path: relPath, sha256, size }) => ({ id, path: relPath, sha256, size }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return bufferSha256(Buffer.from(JSON.stringify(stableEntries)));
}

export function changedIdsFromManifest(currentInputs, previousManifest) {
  if (!previousManifest?.inputs) {
    return currentInputs.map((entry) => entry.id);
  }
  const previousById = new Map(previousManifest.inputs.map((entry) => [entry.id, entry]));
  return currentInputs
    .filter((entry) => previousById.get(entry.id)?.sha256 !== entry.sha256)
    .map((entry) => entry.id);
}

export function writeSheetManifest({
  manifestPath,
  outPath,
  outputHash,
  outputSize,
  inputHash,
  inputs,
  changedIds,
  previousManifest,
  inputsKey = 'inputs'
}) {
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    output: {
      path: path.relative(repoRoot, outPath),
      sha256: outputHash,
      size: outputSize
    },
    inputSetHash: inputHash,
    changedIds,
    previousOutputSha256: previousManifest?.output?.sha256 || null,
    [inputsKey]: inputs
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// ---------- metadata bundle ----------

export function metadataEntriesHash(entries, fields = ['id', 'outputPath', 'sha256', 'status']) {
  const stable = entries.map((entry) => {
    const subset = {};
    for (const field of fields) {
      subset[field] = field === 'sha256' ? (entry.png?.sha256 ?? entry.sha256) : entry[field];
    }
    return subset;
  });
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function buildMetadataBundle({
  schemaVersion = 1,
  generatedAt,
  status,
  policy,
  entries,
  countKey = 'entryCount',
  entriesKey = 'entries',
  ...extra
}) {
  return {
    schemaVersion,
    generatedAt,
    status,
    policy,
    [countKey]: entries.length,
    metadataHash: metadataEntriesHash(entries),
    ...extra,
    [entriesKey]: entries
  };
}

// ---------- provenance ----------

export function checkProvenance({
  metadataPath,
  allowedOutputPrefix,
  schemaVersion = 1,
  entriesKey = 'entries',
  countKey = 'entryCount',
  promptIncludes = null,
  fail = (message) => {
    console.error(message);
    process.exitCode = 1;
  }
}) {
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing image metadata: ${path.relative(repoRoot, metadataPath)}`);
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  if (metadata.schemaVersion !== schemaVersion) fail(`Unexpected schemaVersion: ${metadata.schemaVersion}`);
  if (!metadata.policy?.runtimeUsesApprovedOnly) fail('Metadata policy.runtimeUsesApprovedOnly must be true');
  const entries = metadata[entriesKey];
  if (!Array.isArray(entries) || !entries.length) {
    fail(`Metadata must contain approved entries under "${entriesKey}"`);
    return { metadata, entries: [] };
  }

  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) fail(`Duplicate metadata entry: ${entry.id}`);
    seen.add(entry.id);
    if (entry.status !== 'approved') fail(`${entry.id}: status must be approved`);
    if (!entry.outputPath || !entry.outputPath.startsWith(allowedOutputPrefix)) {
      fail(`${entry.id}: outputPath must point at ${allowedOutputPrefix}`);
      continue;
    }
    if (promptIncludes && !entry.prompt?.includes(promptIncludes)) {
      fail(`${entry.id}: missing full generation prompt`);
    }
    if (!entry.validation || entry.validation.status !== 'passed') {
      fail(`${entry.id}: validation status must be passed`);
    }
    if (!entry.review || entry.review.decision !== 'approved') {
      fail(`${entry.id}: review decision must be approved`);
    }

    const filePath = path.join(repoRoot, entry.outputPath);
    if (!fs.existsSync(filePath)) {
      fail(`${entry.id}: missing PNG at ${entry.outputPath}`);
      continue;
    }
    const actualSha = fileSha256(filePath);
    if (actualSha !== entry.png?.sha256) {
      fail(`${entry.id}: sha256 mismatch, metadata=${entry.png?.sha256} actual=${actualSha}`);
    }
  }

  if (metadata[countKey] !== entries.length) {
    fail(`${countKey} ${metadata[countKey]} does not match entries ${entries.length}`);
  }

  return { metadata, entries };
}
