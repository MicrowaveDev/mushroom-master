import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import {
  buildSeasonSections,
  escapeHtml,
  repoRoot,
  seasonImageDataUrl
} from './season-sheet-helpers.js';
import {
  fileSha256,
  defaultManifestPathFor,
  tempPngPathFor,
  readPreviousManifest,
  inputSetHash,
  changedIdsFromManifest,
  writeSheetManifest
} from './lib/bitmap-image-toolkit.js';

const seasonImageWorkspace = process.env.SEASON_IMAGE_WORKSPACE
  ? path.resolve(process.env.SEASON_IMAGE_WORKSPACE)
  : path.join(repoRoot, '.agent', 'season-image-workspace');
const seasonReviewDir = path.join(seasonImageWorkspace, 'review');
const defaultOutPath = path.join(seasonReviewDir, 'contact-sheet.png');
const TILE_SIZE = 132;          // square tile per emblem
const TILE_LABEL_HEIGHT = 38;
const TILE_PADDING = 10;

function parseArgs(argv) {
  const outArg = argv.find((arg) => arg.startsWith('--out='));
  const manifestArg = argv.find((arg) => arg.startsWith('--manifest='));
  const outPath = outArg ? path.resolve(outArg.slice('--out='.length)) : defaultOutPath;
  return {
    outPath,
    manifestPath: manifestArg
      ? path.resolve(manifestArg.slice('--manifest='.length))
      : defaultManifestPathFor(outPath),
    validateOnly: argv.includes('--validate-only'),
    allowUnchanged: argv.includes('--allow-unchanged'),
    highlightChanged: argv.includes('--highlight-changed'),
    writeManifest: !argv.includes('--no-manifest')
  };
}

function entryInputs(sections) {
  return sections.flatMap(([, items]) => items.map((entry) => {
    const stats = fs.statSync(entry.outputPath);
    return {
      id: entry.id,
      path: path.relative(repoRoot, entry.outputPath),
      sha256: fileSha256(entry.outputPath),
      size: stats.size,
      mtimeMs: Math.round(stats.mtimeMs)
    };
  }));
}

function renderTile(entry, { changedIds, highlightChanged }) {
  const dataUrl = seasonImageDataUrl(entry);
  const isChanged = highlightChanged && changedIds.has(entry.id);
  const sub = entry.kind === 'rank' ? 'rank' : (entry.characterId || entry.type);
  return `
    <div
      class="tile tile--${entry.type}${isChanged ? ' tile--changed' : ''}"
      data-entry-id="${escapeHtml(entry.id)}"
    >
      ${isChanged ? '<div class="change-marker">updated</div>' : ''}
      <div class="emblem" style="background-image: url('${dataUrl}')"></div>
      <div class="label">${escapeHtml(entry.name?.en || entry.id)}</div>
      <div class="meta">
        <span>${escapeHtml(entry.type)}</span>
        <span>${escapeHtml(sub)}</span>
      </div>
    </div>`;
}

function renderHtml(sections, { changedIds = new Set(), highlightChanged = false } = {}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        width: 1120px;
        background: #f7f2e7;
        color: #3f3328;
        font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .sheet {
        width: 1120px;
        padding: 18px 18px 22px;
      }
      .section {
        margin: 0 0 16px;
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
        background: #b98245;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
      }
      .tile {
        position: relative;
        height: ${TILE_SIZE + TILE_LABEL_HEIGHT}px;
        display: grid;
        grid-template-rows: ${TILE_SIZE}px 1fr;
        place-items: center;
        padding: ${TILE_PADDING}px;
        border: 1px solid rgba(123, 91, 59, 0.22);
        border-radius: 10px;
        background: #fbf7ee;
        overflow: hidden;
      }
      .tile--rank        { border-color: #c98a4a; }
      .tile--season      { border-color: #d8ba66; }
      .tile--general     { border-color: #8a9b6f; }
      .tile--character   { border-color: #b07d47; }
      .tile--changed {
        box-shadow:
          inset 0 0 0 2px rgba(44, 126, 143, 0.32),
          0 0 0 1px rgba(44, 126, 143, 0.18);
        border-color: #2c7e8f;
      }
      .change-marker {
        position: absolute;
        top: 6px;
        right: 6px;
        padding: 2px 5px;
        border-radius: 5px;
        background: #2c7e8f;
        color: #fffdf8;
        font-size: 9px;
        font-weight: 800;
        line-height: 1;
        text-transform: uppercase;
      }
      .emblem {
        width: ${TILE_SIZE - 12}px;
        height: ${TILE_SIZE - 12}px;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        filter: drop-shadow(0 4px 8px rgba(76, 52, 27, 0.18));
      }
      .label {
        width: 100%;
        font-weight: 700;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .meta {
        display: flex;
        justify-content: center;
        gap: 6px;
        color: rgba(63, 51, 40, 0.66);
        font-size: 10px;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      ${sections.map(([section, items]) => `
        <section class="section">
          <h2 class="section-title">${escapeHtml(section)}</h2>
          <div class="grid">
            ${items.map((entry) => renderTile(entry, { changedIds, highlightChanged })).join('')}
          </div>
        </section>
      `).join('')}
    </main>
  </body>
</html>`;
}

async function main() {
  const {
    outPath,
    manifestPath,
    validateOnly,
    allowUnchanged,
    highlightChanged,
    writeManifest
  } = parseArgs(process.argv.slice(2));

  const sections = buildSeasonSections();
  const inputs = entryInputs(sections);
  const previousManifest = writeManifest ? readPreviousManifest(manifestPath) : null;
  const changedIds = changedIdsFromManifest(inputs, previousManifest);
  const inputHash = inputSetHash(inputs);
  const html = renderHtml(sections, { changedIds: new Set(changedIds), highlightChanged });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let tmpPath = null;

  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 1600, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    await page.setViewport({ width: 1120, height, deviceScaleFactor: 1 });

    if (validateOnly) {
      console.log('season contact sheet validation OK');
      return;
    }

    const previousHash = fs.existsSync(outPath) ? fileSha256(outPath) : null;
    tmpPath = tempPngPathFor(outPath);
    await page.screenshot({ path: tmpPath, clip: { x: 0, y: 0, width: 1120, height } });
    const nextHash = fileSha256(tmpPath);
    if (previousHash && previousHash === nextHash && !allowUnchanged) {
      fs.unlinkSync(tmpPath);
      tmpPath = null;
      throw new Error(
        `season contact sheet output is byte-identical to existing ${path.relative(repoRoot, outPath)}; inputs did not change. Update the source PNGs first, or pass --allow-unchanged when an identical deterministic sheet is expected.`
      );
    }
    fs.renameSync(tmpPath, outPath);
    tmpPath = null;
    if (writeManifest) {
      const outStats = fs.statSync(outPath);
      writeSheetManifest({
        manifestPath,
        outPath,
        outputHash: nextHash,
        outputSize: outStats.size,
        inputHash,
        inputs,
        changedIds,
        previousManifest,
        inputsKey: 'inputs'
      });
    }
    const unchangedLabel = previousHash === nextHash ? ' (unchanged allowed)' : '';
    const manifestLabel = writeManifest ? ` and ${path.relative(repoRoot, manifestPath)}` : '';
    const changedLabel = changedIds.length ? `; changed inputs: ${changedIds.join(', ')}` : '; changed inputs: none';
    console.log(`generated ${path.relative(repoRoot, outPath)}${manifestLabel}${unchangedLabel}${changedLabel}`);
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
