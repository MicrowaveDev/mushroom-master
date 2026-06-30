#!/usr/bin/env node
/**
 * Diagnostic palette audit for Home Field chibi proof images.
 *
 * This is a style gate helper, not an approval shortcut. It measures the
 * non-magenta visible pixels, writes an optional swatch, and leaves biology,
 * pose, ornament, and composed-scene fit to visual review.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  encodeDeterministicPng,
  fileSha256,
  readPngAsRgba,
  repoRoot
} from './lib/bitmap-image-toolkit.js';

const DEFAULT_BG = '#ff00ff';
const DEFAULT_SIGNIFICANT_THRESHOLD = 0.001;
const DEFAULT_MINOR_THRESHOLD = 0.0005;
const EXACT_VISIBLE_LIMIT = 20;
const COARSE_32_WARN_LIMIT = 48;

function usage() {
  return [
    'Usage: npm run game:home-field:palette-audit -- <png> [--out=<json>] [--swatch=<png>] [--fail-on-bloat]',
    '',
    'Audits non-magenta visible colors for the Thalla Home Field chibi proof.',
    'The output is diagnostic evidence; passing this helper does not approve chibi style.'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    input: null,
    out: null,
    swatch: null,
    background: DEFAULT_BG,
    alphaThreshold: 16,
    significantThreshold: DEFAULT_SIGNIFICANT_THRESHOLD,
    minorThreshold: DEFAULT_MINOR_THRESHOLD,
    failOnBloat: false,
    jsonOnly: false
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (arg === '--fail-on-bloat') {
      opts.failOnBloat = true;
    } else if (arg === '--json') {
      opts.jsonOnly = true;
    } else if (arg.startsWith('--out=')) {
      opts.out = arg.slice('--out='.length);
    } else if (arg.startsWith('--swatch=')) {
      opts.swatch = arg.slice('--swatch='.length);
    } else if (arg.startsWith('--background=')) {
      opts.background = arg.slice('--background='.length);
    } else if (arg.startsWith('--alpha-threshold=')) {
      opts.alphaThreshold = Number(arg.slice('--alpha-threshold='.length));
    } else if (arg.startsWith('--threshold=')) {
      opts.significantThreshold = Number(arg.slice('--threshold='.length));
    } else if (arg.startsWith('--minor-threshold=')) {
      opts.minorThreshold = Number(arg.slice('--minor-threshold='.length));
    } else if (!opts.input) {
      opts.input = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!opts.input) throw new Error(usage());
  if (!Number.isFinite(opts.alphaThreshold) || opts.alphaThreshold < 0) {
    throw new Error('--alpha-threshold must be a non-negative number');
  }
  if (!Number.isFinite(opts.significantThreshold) || opts.significantThreshold <= 0) {
    throw new Error('--threshold must be a positive fraction');
  }
  if (!Number.isFinite(opts.minorThreshold) || opts.minorThreshold <= 0) {
    throw new Error('--minor-threshold must be a positive fraction');
  }
  return opts;
}

function resolveRepoPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function parseHexColor(value) {
  const match = /^#?([a-f0-9]{6})$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid color: ${value}`);
  const n = Number.parseInt(match[1], 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    hex: `#${match[1].toLowerCase()}`
  };
}

function colorKey(r, g, b) {
  return (r << 16) | (g << 8) | b;
}

function rgbFromKey(key) {
  return {
    r: (key >> 16) & 255,
    g: (key >> 8) & 255,
    b: key & 255
  };
}

function hexFromKey(key) {
  const { r, g, b } = rgbFromKey(key);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function isNearBackground(r, g, b, background) {
  const dr = r - background.r;
  const dg = g - background.g;
  const db = b - background.b;
  const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
  if (distance <= 18) return true;

  // Built-in imagegen can anti-alias the hot-magenta field. Thalla's palette
  // should not contain saturated magenta, so this wider exclusion is safe here.
  return r >= 220 && g <= 88 && b >= 180 && Math.abs(r - b) <= 96;
}

function quantizedKey(r, g, b, step) {
  const toBucketCenter = (value) => {
    const bucket = Math.floor(value / step);
    return Math.min(255, (bucket * step) + Math.floor(step / 2));
  };
  return colorKey(toBucketCenter(r), toBucketCenter(g), toBucketCenter(b));
}

function recordsFromCounts(counts, total) {
  return [...counts.entries()]
    .map(([key, count]) => ({
      hex: hexFromKey(key),
      count,
      pct: total > 0 ? count / total : 0
    }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
}

function countAtThreshold(records, threshold) {
  return records.filter((record) => record.pct >= threshold).length;
}

function analyzePalette(filePath, opts) {
  const image = readPngAsRgba(filePath);
  const background = parseHexColor(opts.background);
  const exactCounts = new Map();
  const coarseCountsByStep = new Map([[16, new Map()], [24, new Map()], [32, new Map()]]);
  let visiblePixels = 0;
  let excludedPixels = 0;
  let transparentPixels = 0;
  let magentaPixels = 0;

  for (let i = 0; i < image.rgba.length; i += 4) {
    const r = image.rgba[i];
    const g = image.rgba[i + 1];
    const b = image.rgba[i + 2];
    const a = image.rgba[i + 3];
    if (a <= opts.alphaThreshold) {
      transparentPixels += 1;
      excludedPixels += 1;
      continue;
    }
    if (isNearBackground(r, g, b, background)) {
      magentaPixels += 1;
      excludedPixels += 1;
      continue;
    }
    visiblePixels += 1;
    const exact = colorKey(r, g, b);
    exactCounts.set(exact, (exactCounts.get(exact) || 0) + 1);
    for (const [step, counts] of coarseCountsByStep.entries()) {
      const key = quantizedKey(r, g, b, step);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  if (visiblePixels === 0) {
    throw new Error('No visible non-background pixels found after alpha/magenta exclusion');
  }

  const exactRecords = recordsFromCounts(exactCounts, visiblePixels);
  const coarseBins = {};
  for (const [step, counts] of coarseCountsByStep.entries()) {
    const records = recordsFromCounts(counts, visiblePixels);
    coarseBins[`step${step}`] = {
      unique: records.length,
      atLeastSignificantThreshold: countAtThreshold(records, opts.significantThreshold),
      top: records.slice(0, 16)
    };
  }

  const exactAtSignificant = countAtThreshold(exactRecords, opts.significantThreshold);
  const exactAtMinor = countAtThreshold(exactRecords, opts.minorThreshold);
  const coarse32Significant = coarseBins.step32.atLeastSignificantThreshold;
  const status = exactAtSignificant > EXACT_VISIBLE_LIMIT
    ? 'fail'
    : coarse32Significant > COARSE_32_WARN_LIMIT
      ? 'warn'
      : 'pass';
  const note = status === 'fail'
    ? `Exact significant colors exceed ${EXACT_VISIBLE_LIMIT}; palette bloat is likely.`
    : status === 'warn'
      ? `Dominant exact colors fit the ${EXACT_VISIBLE_LIMIT}-color budget, but coarse 32-step bins remain high.`
      : 'Dominant palette fits the diagnostic color budget; still run the visual biology/style gate.';

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      path: path.relative(repoRoot, filePath),
      width: image.width,
      height: image.height,
      sha256: fileSha256(filePath)
    },
    exclusion: {
      alphaThreshold: opts.alphaThreshold,
      background: background.hex,
      rule: 'exclude alpha <= threshold and hot-magenta/#ff00ff-like background pixels',
      totalPixels: image.width * image.height,
      visiblePixels,
      excludedPixels,
      transparentPixels,
      magentaPixels
    },
    thresholds: {
      significantPct: opts.significantThreshold,
      minorPct: opts.minorThreshold
    },
    counts: {
      exactUniqueRgb: exactRecords.length,
      exactColorsAtLeastSignificantThreshold: exactAtSignificant,
      exactColorsAtLeastMinorThreshold: exactAtMinor,
      coarseBins
    },
    budget: {
      target: '12-18 artist-visible colors, fewer than 20 visible design colors excluding transparency/#ff00ff',
      exactSignificantLimit: EXACT_VISIBLE_LIMIT,
      coarse32WarningLimit: COARSE_32_WARN_LIMIT,
      status,
      note
    },
    topColors: exactRecords.slice(0, 32),
    swatchColors: exactRecords.filter((record) => record.pct >= opts.minorThreshold).slice(0, 96)
  };
}

function drawSwatch(records, outPath) {
  const colors = records.slice(0, 96);
  const cell = 18;
  const gap = 2;
  const cols = Math.min(16, Math.max(1, colors.length));
  const rows = Math.max(1, Math.ceil(colors.length / cols));
  const width = gap + (cols * (cell + gap));
  const height = gap + (rows * (cell + gap));
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 46;
    rgba[i + 1] = 43;
    rgba[i + 2] = 52;
    rgba[i + 3] = 255;
  }

  colors.forEach((record, idx) => {
    const rgb = parseHexColor(record.hex);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x0 = gap + (col * (cell + gap));
    const y0 = gap + (row * (cell + gap));
    for (let y = 0; y < cell; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const off = ((y0 + y) * width + x0 + x) * 4;
        const border = x === 0 || y === 0 || x === cell - 1 || y === cell - 1;
        rgba[off] = border ? 14 : rgb.r;
        rgba[off + 1] = border ? 13 : rgb.g;
        rgba[off + 2] = border ? 17 : rgb.b;
        rgba[off + 3] = 255;
      }
    }
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, encodeDeterministicPng({ width, height, rgba }));
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const inputPath = resolveRepoPath(opts.input);
    const audit = analyzePalette(inputPath, opts);

    let swatchPath = opts.swatch ? resolveRepoPath(opts.swatch) : null;
    if (!swatchPath && opts.out) {
      const outPath = resolveRepoPath(opts.out);
      const ext = path.extname(outPath);
      const base = ext ? outPath.slice(0, -ext.length) : outPath;
      swatchPath = `${base}-swatch.png`;
    }
    if (swatchPath) {
      drawSwatch(audit.swatchColors, swatchPath);
      audit.artifacts = {
        swatch: {
          path: path.relative(repoRoot, swatchPath),
          sha256: fileSha256(swatchPath)
        }
      };
    }

    if (opts.out) {
      const outPath = resolveRepoPath(opts.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(audit, null, 2));
    }

    if (opts.jsonOnly) {
      console.log(JSON.stringify(audit, null, 2));
    } else {
      console.log(`home-field chibi palette audit: ${audit.budget.status.toUpperCase()}`);
      console.log(`source: ${audit.source.path} (${audit.source.width}x${audit.source.height}, sha256 ${audit.source.sha256})`);
      console.log(`visible pixels: ${audit.exclusion.visiblePixels}/${audit.exclusion.totalPixels} after alpha/#ff00ff exclusion`);
      console.log(`exact colors >=0.10%: ${audit.counts.exactColorsAtLeastSignificantThreshold} (target <=${EXACT_VISIBLE_LIMIT})`);
      console.log(`exact colors >=0.05%: ${audit.counts.exactColorsAtLeastMinorThreshold}`);
      console.log(`coarse 32-step bins >=0.10%: ${audit.counts.coarseBins.step32.atLeastSignificantThreshold} (warning >${COARSE_32_WARN_LIMIT})`);
      console.log(`note: ${audit.budget.note}`);
      if (audit.artifacts?.swatch) console.log(`swatch: ${audit.artifacts.swatch.path}`);
      if (opts.out) console.log(`json: ${path.relative(repoRoot, resolveRepoPath(opts.out))}`);
    }

    if (opts.failOnBloat && audit.budget.status === 'fail') process.exit(2);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
