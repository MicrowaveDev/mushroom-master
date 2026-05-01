import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer';
import { artifactVisualClassification } from '../shared/artifact-visual-classification.js';
import {
  artifactFootprintLabel,
  artifactImageDataUrl,
  buildArtifactSections,
  escapeHtml,
  repoRoot
} from './artifact-sheet-helpers.js';

const defaultOutPath = path.join(
  repoRoot,
  '.agent',
  'tasks',
  'artifact-image-system',
  'phase-1',
  'raw',
  'thumbnail-review.png'
);

const THUMBNAIL_SIZES = [32, 48, 64];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});
function parseArgs(argv) {
  const outArg = argv.find((arg) => arg.startsWith('--out='));
  return {
    outPath: outArg ? path.resolve(outArg.slice('--out='.length)) : defaultOutPath
  };
}

function warningCodesForArtifact(visual) {
  return Array.from(new Set([
    ...visual.secondaryStats.map(() => 'SECONDARY_MISLEAD'),
    ...visual.tradeoffs.map(() => 'TRADEOFF_INVISIBLE')
  ]));
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
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

function readPngRgba(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Puppeteer screenshot was not a PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
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

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error('Expected Puppeteer screenshot to be an 8-bit RGB or RGBA PNG');
  }

  const sourceBytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * sourceBytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const row = Buffer.from(inflated.subarray(src, src + stride));
    src += stride;
    const outStart = y * width * 4;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= sourceBytesPerPixel ? row[x - sourceBytesPerPixel] : 0;
      const up = prev[x] || 0;
      const upLeft = x >= sourceBytesPerPixel ? prev[x - sourceBytesPerPixel] : 0;
      let value = row[x];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) value = (value + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      row[x] = value;
      const pixel = Math.floor(x / sourceBytesPerPixel);
      const channel = x % sourceBytesPerPixel;
      rgba[outStart + pixel * 4 + channel] = value;
      if (sourceBytesPerPixel === 3 && channel === 2) {
        rgba[outStart + pixel * 4 + 3] = 255;
      }
    }
    prev = row;
  }

  return { width, height, rgba };
}

function encodeDeterministicPng({ width, height, rgba }) {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND')
  ]);
}

function renderSizeSet(artifact, dataUrl, className = '') {
  return THUMBNAIL_SIZES.map((size) => `
    <span class="thumbnail thumbnail--${size} ${className}" style="width: ${size * 4}px; height: ${size * 4}px;">
      <span
        class="thumbnail-image"
        style="width: ${size}px; height: ${size}px; background-image: url('${dataUrl}');"
      ></span>
      <small>${size}px</small>
    </span>
  `).join('');
}

function renderArtifactRow(artifact) {
  const visual = artifactVisualClassification(artifact);
  const dataUrl = artifactImageDataUrl(artifact);
  const warnings = warningCodesForArtifact(visual);
  const warningHtml = warnings.length
    ? warnings.map((code) => `<span class="warning-code">${escapeHtml(code)}</span>`).join('')
    : '<span class="warning-code warning-code--pass">OK</span>';

  return `
    <div class="artifact-row ${visual.cssClasses.join(' ')}" style="--role-color: ${visual.role.color};">
      <div class="review-condition review-condition--transparent">
        <div class="condition-title">Transparent</div>
        <div class="size-set">${renderSizeSet(artifact, dataUrl)}</div>
      </div>
      <div class="review-condition review-condition--cell">
        <div class="condition-title">Grid Cell</div>
        <div class="size-set cell-bg">${renderSizeSet(artifact, dataUrl)}</div>
      </div>
      <div class="review-condition review-condition--gray">
        <div class="condition-title">Grayscale</div>
        <div class="size-set cell-bg">${renderSizeSet(artifact, dataUrl, 'thumbnail--gray')}</div>
      </div>
      <div class="review-condition review-condition--labels">
        <div class="condition-title">${escapeHtml(artifact.id)}</div>
        <div class="label-grid">
          <span>role</span><strong>${escapeHtml(visual.role.label)}</strong>
          <span>shine</span><strong>${escapeHtml(visual.shine.label)}</strong>
          <span>footprint</span><strong>${escapeHtml(artifactFootprintLabel(artifact))}</strong>
        </div>
        <div class="warning-list">${warningHtml}</div>
      </div>
    </div>`;
}

function renderHtml(sections) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        width: 1560px;
        background: #f4efe5;
        color: #3f3328;
        font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .sheet {
        width: 1560px;
        padding: 18px 18px 24px;
      }
      .sheet-title {
        margin: 0 0 4px;
        font-size: 20px;
        font-weight: 850;
      }
      .sheet-note {
        margin: 0 0 16px;
        color: rgba(63, 51, 40, 0.68);
      }
      .section {
        margin: 0 0 18px;
      }
      .section-title {
        margin: 0 0 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 800;
      }
      .section-title::before {
        content: '';
        width: 5px;
        height: 18px;
        border-radius: 999px;
        background: var(--section-color, #b98245);
      }
      .artifact-row {
        display: grid;
        grid-template-columns: repeat(3, 368px) 390px;
        gap: 8px;
        margin: 0 0 8px;
        border-left: 5px solid var(--role-color);
        background: rgba(255, 253, 245, 0.72);
      }
      .review-condition {
        min-height: 174px;
        padding: 8px;
        background: #fbf7ee;
        border: 1px solid rgba(123, 91, 59, 0.16);
      }
      .condition-title {
        margin: 0 0 8px;
        color: rgba(63, 51, 40, 0.68);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0;
        font-size: 10px;
      }
      .size-set {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        align-items: end;
      }
      .thumbnail {
        position: relative;
        display: grid;
        place-items: center;
        margin: 0 auto;
        image-rendering: pixelated;
      }
      .thumbnail-image {
        display: block;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        transform: scale(4);
        transform-origin: center;
        filter:
          drop-shadow(0 5px 7px rgba(76, 52, 27, 0.16))
          drop-shadow(0 1px 1px rgba(255, 255, 255, 0.5));
      }
      .thumbnail--gray .thumbnail-image {
        filter: grayscale(1) contrast(1.04) drop-shadow(0 5px 7px rgba(76, 52, 27, 0.16));
      }
      .thumbnail small {
        position: absolute;
        left: 4px;
        bottom: 3px;
        color: rgba(63, 51, 40, 0.58);
        font-size: 9px;
        font-weight: 700;
      }
      .cell-bg .thumbnail {
        border-radius: 14px;
        border: 1px solid rgba(94, 70, 39, 0.14);
        background:
          radial-gradient(circle at top, rgba(140, 188, 135, 0.14), transparent 52%),
          rgba(255, 251, 244, 0.96);
        box-shadow: inset 0 -8px 16px rgba(91, 64, 36, 0.06);
      }
      .label-grid {
        display: grid;
        grid-template-columns: 70px minmax(0, 1fr);
        gap: 5px 8px;
        align-items: baseline;
        margin-bottom: 10px;
      }
      .label-grid span {
        color: rgba(63, 51, 40, 0.58);
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .label-grid strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .warning-list {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .warning-code {
        padding: 3px 5px;
        border: 1px solid rgba(156, 69, 53, 0.28);
        background: rgba(156, 69, 53, 0.12);
        color: #793629;
        font-size: 9px;
        font-weight: 850;
        line-height: 1;
      }
      .warning-code--pass {
        border-color: rgba(92, 126, 73, 0.28);
        background: rgba(92, 126, 73, 0.12);
        color: #3f6534;
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <h1 class="sheet-title">Artifact Thumbnail Review</h1>
      <p class="sheet-note">Deterministic local evidence: transparent, real prep/grid cell background, grayscale, and role/shine warning labels at 32px, 48px, and 64px.</p>
      ${sections.map(([section, items]) => {
        const visual = artifactVisualClassification(items[0]);
        const sectionColor = section === 'Character Artifacts' || section === 'Signature Starters'
          ? '#d4a54a'
          : visual.role.color;
        return `
          <section class="section" style="--section-color: ${sectionColor};">
            <h2 class="section-title">${escapeHtml(section)}</h2>
            ${items.map(renderArtifactRow).join('')}
          </section>`;
      }).join('')}
    </main>
  </body>
</html>`;
}

async function main() {
  const { outPath } = parseArgs(process.argv.slice(2));
  const sections = buildArtifactSections();
  const html = renderHtml(sections);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1560, height: 1800, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    await page.setViewport({ width: 1560, height, deviceScaleFactor: 1 });
    const screenshot = await page.screenshot({ clip: { x: 0, y: 0, width: 1560, height } });
    fs.writeFileSync(outPath, encodeDeterministicPng(readPngRgba(screenshot)));
    console.log(`generated ${path.relative(repoRoot, outPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
