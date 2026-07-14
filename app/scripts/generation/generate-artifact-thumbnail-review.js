import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { captureTallPage } from '@microwavedev/backpack-game-core/tooling/image-review';
import { encodeDeterministicPng, stitchVerticalImages } from '@microwavedev/backpack-game-core/tooling/image';
import { artifactVisualClassification } from '../../shared/artifact-visual-classification.js';
import {
  artifactFootprintLabel,
  artifactImageDataUrl,
  buildArtifactSections,
  escapeHtml,
  repoRoot
} from '../lib/artifact-sheet-helpers.js';

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
const SCREENSHOT_TILE_HEIGHT = 1400;
const SECTION_CHUNK_SIZE = 8;
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

function chunkSection([section, items]) {
  const chunks = [];
  for (let index = 0; index < items.length; index += SECTION_CHUNK_SIZE) {
    const suffix = index === 0 ? '' : ' (continued)';
    chunks.push([`${section}${suffix}`, items.slice(index, index + SECTION_CHUNK_SIZE)]);
  }
  return chunks;
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

function renderHtml(sections, { showHeader = true } = {}) {
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
      ${showHeader ? `
        <h1 class="sheet-title">Artifact Thumbnail Review</h1>
        <p class="sheet-note">Deterministic local evidence: transparent, real prep/grid cell background, grayscale, and role/shine warning labels at 32px, 48px, and 64px.</p>
      ` : ''}
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
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const sectionScreenshots = [];
    const chunks = sections.flatMap(chunkSection);
    for (const [index, section] of chunks.entries()) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1560, height: 1800, deviceScaleFactor: 1 });
      await page.setContent(renderHtml([section], { showHeader: index === 0 }), { waitUntil: 'load', timeout: 0 });
      const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
      await page.setViewport({ width: 1560, height: Math.min(height, SCREENSHOT_TILE_HEIGHT), deviceScaleFactor: 1 });
      sectionScreenshots.push(await captureTallPage({ page, width: 1560, height, tileHeight: SCREENSHOT_TILE_HEIGHT }));
      await page.close();
    }
    fs.writeFileSync(outPath, encodeDeterministicPng(stitchVerticalImages(sectionScreenshots)));
    console.log(`generated ${path.relative(repoRoot, outPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
