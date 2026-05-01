import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer';
import { artifactVisualClassification } from '../shared/artifact-visual-classification.js';
import {
  artifactFootprintLabel,
  artifactImagePath,
  artifactImageDataUrl,
  buildArtifactSections,
  escapeHtml,
  repoRoot,
  artifactDir
} from './artifact-sheet-helpers.js';

const defaultOutPath = path.join(artifactDir, 'contact-sheet.png');
const sheetCellPx = 50;
const sheetCellGap = 8;
const sheetStagePadX = 24;
const sheetStagePadY = 28;
const sheetTextHeight = 52;

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

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function bufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function defaultManifestPathFor(outPath) {
  const ext = path.extname(outPath);
  const base = ext ? outPath.slice(0, -ext.length) : outPath;
  return `${base}.manifest.json`;
}

function tempPngPathFor(outPath) {
  return `${outPath}.${process.pid}.${Date.now()}.tmp.png`;
}

function readPreviousManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function artifactInputEntries(sections) {
  return sections.flatMap(([, items]) => items.map((artifact) => {
    const imagePath = artifactImagePath(artifact);
    const stats = fs.statSync(imagePath);
    return {
      id: artifact.id,
      path: path.relative(repoRoot, imagePath),
      sha256: fileHash(imagePath),
      size: stats.size,
      mtimeMs: Math.round(stats.mtimeMs)
    };
  }));
}

function inputSetHash(entries) {
  const stableEntries = entries
    .map(({ id, path, sha256, size }) => ({ id, path, sha256, size }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return bufferHash(Buffer.from(JSON.stringify(stableEntries)));
}

function changedArtifactIds(currentInputs, previousManifest) {
  if (!previousManifest?.artifactInputs) {
    return currentInputs.map((entry) => entry.id);
  }
  const previousById = new Map(previousManifest.artifactInputs.map((entry) => [entry.id, entry]));
  return currentInputs
    .filter((entry) => previousById.get(entry.id)?.sha256 !== entry.sha256)
    .map((entry) => entry.id);
}

function writeSheetManifest({ manifestPath, outPath, outputHash, outputSize, inputHash, inputs, changedIds, previousManifest }) {
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    output: {
      path: path.relative(repoRoot, outPath),
      sha256: outputHash,
      size: outputSize
    },
    inputSetHash: inputHash,
    changedArtifactIds: changedIds,
    previousOutputSha256: previousManifest?.output?.sha256 || null,
    artifactInputs: inputs
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function sheetDimensionsForArtifact(artifact) {
  const rows = artifact.shape?.length || artifact.height || 1;
  const cols = artifact.shape?.[0]?.length || artifact.width || 1;
  const cellGap = sheetCellGap;
  const cellPx = sheetCellPx;
  return {
    cols,
    rows,
    cellGap,
    cellPx,
    boardWidth: cols * cellPx + cellGap * Math.max(0, cols - 1),
    boardHeight: rows * cellPx + cellGap * Math.max(0, rows - 1)
  };
}

function sheetStageForArtifact(artifact) {
  const dims = sheetDimensionsForArtifact(artifact);
  return {
    ...dims,
    stageWidth: dims.boardWidth + sheetStagePadX,
    stageHeight: dims.boardHeight + sheetStagePadY,
    tileHeight: dims.boardHeight + sheetStagePadY + sheetTextHeight
  };
}

function shapeForArtifact(artifact) {
  if (artifact.shape) return artifact.shape;
  return Array.from({ length: artifact.height || 1 }, () => Array(artifact.width || 1).fill(1));
}

function renderPreviewCells(artifact) {
  return shapeForArtifact(artifact)
    .map((row) => row.map((filled) => (
      `<div class="game-cell${filled ? '' : ' game-cell--empty'}"></div>`
    )).join(''))
    .join('');
}

function renderTile(artifact, { changedIds, highlightChanged }) {
  const visual = artifactVisualClassification(artifact);
  const dataUrl = artifactImageDataUrl(artifact);
  const footprint = artifactFootprintLabel(artifact);
  const { cols, rows, cellGap, cellPx, boardWidth, boardHeight, stageWidth, stageHeight, tileHeight } = sheetStageForArtifact(artifact);
  const isChanged = highlightChanged && changedIds.has(artifact.id);
  return `
    <div
      class="tile ${visual.cssClasses.join(' ')}${isChanged ? ' tile--changed' : ''}"
      data-artifact-id="${escapeHtml(artifact.id)}"
      style="--role-color: ${visual.role.color}; --tile-height: ${tileHeight}px; --stage-width: ${stageWidth}px; --stage-height: ${stageHeight}px;"
    >
      ${isChanged ? '<div class="change-marker">updated</div>' : ''}
      <div
        class="icon-stage"
        style="--cols: ${cols}; --rows: ${rows}; --cell: ${cellPx}px; --cell-gap: ${cellGap}px; --board-width: ${boardWidth}px; --board-height: ${boardHeight}px;"
      >
        <div class="game-grid" aria-hidden="true">${renderPreviewCells(artifact)}</div>
        <div
          class="icon"
          style="--board-width: ${boardWidth}px; --board-height: ${boardHeight}px; background-image: url('${dataUrl}')"
        ></div>
      </div>
      <div class="label">${escapeHtml(artifact.id)}</div>
      <div class="meta">
        <span>${escapeHtml(visual.role.label)}</span>
        <span>${escapeHtml(visual.shine.label)}</span>
        <span>${escapeHtml(footprint)}</span>
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
        background: var(--section-color, #b98245);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(4, 260px);
        gap: 8px;
        align-items: start;
      }
      .tile {
        position: relative;
        height: var(--tile-height);
        display: grid;
        grid-template-rows: var(--stage-height) 18px 18px;
        place-items: center;
        padding: 8px 8px 6px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--role-color) 24%, rgba(123, 91, 59, 0.22));
        border-radius: 8px;
        background: #fbf7ee;
      }
      .tile::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        background: var(--role-color);
        opacity: 0.82;
      }
      .tile--changed {
        border-color: #2c7e8f;
        box-shadow:
          inset 0 0 0 2px rgba(44, 126, 143, 0.28),
          0 0 0 1px rgba(44, 126, 143, 0.18);
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
      .artifact-shine--bright {
        border-color: color-mix(in srgb, var(--role-color) 46%, white);
      }
      .artifact-shine--radiant,
      .artifact-shine--signature {
        border-color: color-mix(in srgb, var(--role-color) 72%, white);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--role-color) 16%, transparent);
      }
      .icon-stage {
        position: relative;
        width: var(--stage-width);
        height: var(--stage-height);
        display: grid;
        place-items: center;
      }
      .game-grid {
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 1;
        width: var(--board-width);
        height: var(--board-height);
        display: grid;
        grid-template-columns: repeat(var(--cols), var(--cell));
        grid-template-rows: repeat(var(--rows), var(--cell));
        gap: var(--cell-gap);
        transform: translate(-50%, -50%);
        opacity: 0.42;
      }
      .game-cell {
        position: relative;
        min-width: 0;
        min-height: 0;
        border-radius: 9px;
        border: 1px solid color-mix(in srgb, var(--role-color) 18%, rgba(94, 70, 39, 0.1));
        background:
          radial-gradient(circle at top, rgba(140, 188, 135, 0.1), transparent 52%),
          rgba(255, 251, 244, 0.78);
        box-shadow: 0 4px 8px rgba(91, 64, 36, 0.04);
        overflow: hidden;
      }
      .game-cell::after {
        display: none;
      }
      .game-cell--empty {
        visibility: hidden;
      }
      .game-cell--empty::after {
        display: none;
      }
      .icon {
        width: var(--board-width);
        height: var(--board-height);
      }
      .icon {
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 3;
        transform: translate(-50%, -50%);
        background-repeat: no-repeat;
        background-position: center;
        background-size: 100% 100%;
        filter:
          drop-shadow(0 6px 8px rgba(76, 52, 27, 0.16))
          drop-shadow(0 1px 1px rgba(255, 255, 255, 0.5));
      }
      .label {
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        text-align: center;
        font-weight: 700;
      }
      .meta {
        display: flex;
        justify-content: center;
        gap: 5px;
        width: 100%;
        min-width: 0;
        color: rgba(63, 51, 40, 0.66);
        font-size: 10px;
        line-height: 1;
        text-transform: uppercase;
      }
      .meta span {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      ${sections.map(([section, items]) => {
        const first = items[0];
        const visual = artifactVisualClassification(first);
        const sectionColor = section === 'Character Artifacts' || section === 'Signature Starters'
          ? '#d4a54a'
          : visual.role.color;
        return `
          <section class="section" style="--section-color: ${sectionColor};">
            <h2 class="section-title">${escapeHtml(section)}</h2>
            <div class="grid">
              ${items.map((artifact) => renderTile(artifact, { changedIds, highlightChanged })).join('')}
            </div>
          </section>`;
      }).join('')}
    </main>
  </body>
</html>`;
}

async function validateContactSheetDom(page, sections) {
  const expected = Object.fromEntries(
    sections.flatMap(([, items]) => items.map((artifact) => {
      const dims = sheetDimensionsForArtifact(artifact);
      const stage = sheetStageForArtifact(artifact);
      const shape = shapeForArtifact(artifact);
      const cells = shape.flat();
      return [artifact.id, {
        width: dims.boardWidth,
        height: dims.boardHeight,
        stageWidth: stage.stageWidth,
        stageHeight: stage.stageHeight,
        tileHeight: stage.tileHeight,
        cellPx: dims.cellPx,
        cellGap: dims.cellGap,
        cellCount: cells.length,
        emptyCount: cells.filter((cell) => !cell).length
      }];
    }))
  );
  const errors = await page.evaluate((expected) => {
    const errors = [];
    const overlayCount = document.querySelectorAll('.footprint, .footprint-cell, .footprint-cell--empty').length;
    if (overlayCount) {
      errors.push(`contact sheet must not render legacy footprint-cell overlays; found ${overlayCount}`);
    }

    for (const tile of document.querySelectorAll('.tile')) {
      const id = tile.getAttribute('data-artifact-id');
      const expectedDims = expected[id];
      if (!id || !expectedDims) {
        errors.push(`tile is missing expected artifact metadata: ${id || '<missing id>'}`);
        continue;
      }

      const stage = tile.querySelector('.icon-stage');
      const grid = tile.querySelector('.game-grid');
      const icon = tile.querySelector('.icon');
      if (!stage || !grid || !icon) {
        errors.push(`${id}: tile must contain one icon stage, game grid, and icon overlay`);
        continue;
      }

      const stageChildren = Array.from(stage.children);
      if (stageChildren.length !== 2 || stageChildren[0] !== grid || stageChildren[1] !== icon) {
        errors.push(`${id}: icon stage must render game grid below the artifact image`);
      }

      const stageStyle = getComputedStyle(stage);
      if (stageStyle.backgroundImage !== 'none' || stageStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        errors.push(`${id}: icon stage must have no visible background`);
      }

      const gridRect = grid.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const tileRect = tile.getBoundingClientRect();
      const actualWidth = Math.round(icon.offsetWidth);
      const actualHeight = Math.round(icon.offsetHeight);
      if (Math.round(tileRect.height) !== expectedDims.tileHeight) {
        errors.push(`${id}: tile height ${Math.round(tileRect.height)} does not match compact expected ${expectedDims.tileHeight}`);
      }
      if (Math.round(stageRect.width) !== expectedDims.stageWidth || Math.round(stageRect.height) !== expectedDims.stageHeight) {
        errors.push(`${id}: preview stage ${Math.round(stageRect.width)}x${Math.round(stageRect.height)} does not match compact expected ${expectedDims.stageWidth}x${expectedDims.stageHeight}`);
      }
      if (actualWidth !== expectedDims.width || actualHeight !== expectedDims.height) {
        errors.push(`${id}: rendered image footprint ${actualWidth}x${actualHeight} does not match expected ${expectedDims.width}x${expectedDims.height}`);
      }
      if (Math.round(gridRect.width) !== expectedDims.width || Math.round(gridRect.height) !== expectedDims.height) {
        errors.push(`${id}: rendered game grid ${Math.round(gridRect.width)}x${Math.round(gridRect.height)} does not match expected ${expectedDims.width}x${expectedDims.height}`);
      }
      const stageCenterX = stageRect.left + stageRect.width / 2;
      const stageCenterY = stageRect.top + stageRect.height / 2;
      const iconCenterX = iconRect.left + iconRect.width / 2;
      const iconCenterY = iconRect.top + iconRect.height / 2;
      const gridCenterX = gridRect.left + gridRect.width / 2;
      const gridCenterY = gridRect.top + gridRect.height / 2;
      if (Math.abs(stageCenterX - iconCenterX) > 0.5 || Math.abs(stageCenterY - iconCenterY) > 0.5) {
        errors.push(`${id}: artifact image is not centered in the preview stage`);
      }
      if (Math.abs(gridCenterX - iconCenterX) > 0.5 || Math.abs(gridCenterY - iconCenterY) > 0.5) {
        errors.push(`${id}: artifact image is not centered over its grid cells`);
      }

      const cells = Array.from(grid.querySelectorAll('.game-cell'));
      if (cells.length !== expectedDims.cellCount) {
        errors.push(`${id}: board patch cell count ${cells.length} does not match expected ${expectedDims.cellCount}`);
      }
      const visibleCell = cells[0];
      if (visibleCell) {
        const cellRect = visibleCell.getBoundingClientRect();
        if (Math.round(cellRect.width) !== expectedDims.cellPx || Math.round(cellRect.height) !== expectedDims.cellPx) {
          errors.push(`${id}: game grid cell size ${Math.round(cellRect.width)}x${Math.round(cellRect.height)} does not match fixed ${expectedDims.cellPx}px`);
        }
      }
      const gridStyle = getComputedStyle(grid);
      if (Number.parseFloat(gridStyle.gap) !== expectedDims.cellGap) {
        errors.push(`${id}: game grid gap ${gridStyle.gap} does not match fixed ${expectedDims.cellGap}px`);
      }
      const emptyCells = cells.filter((cell) => cell.classList.contains('game-cell--empty'));
      if (emptyCells.length !== expectedDims.emptyCount) {
        errors.push(`${id}: hidden mask cell count ${emptyCells.length} does not match expected ${expectedDims.emptyCount}`);
      }
      const gridZ = Number.parseInt(getComputedStyle(grid).zIndex, 10);
      const iconZ = Number.parseInt(getComputedStyle(icon).zIndex, 10);
      if (!(iconZ > gridZ)) {
        errors.push(`${id}: artifact image must be layered above the game grid cells`);
      }
      for (const cell of emptyCells) {
        if (getComputedStyle(cell).visibility !== 'hidden') {
          errors.push(`${id}: mask-empty cells must be hidden in the game-grid preview`);
          break;
        }
      }
    }

    return errors;
  }, expected);

  if (errors.length) {
    throw new Error(`Contact sheet validation failed:\n- ${errors.join('\n- ')}`);
  }
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
  const sections = buildArtifactSections();
  const inputs = artifactInputEntries(sections);
  const previousManifest = writeManifest ? readPreviousManifest(manifestPath) : null;
  const changedIds = changedArtifactIds(inputs, previousManifest);
  const inputHash = inputSetHash(inputs);
  const html = renderHtml(sections, {
    changedIds: new Set(changedIds),
    highlightChanged
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let tmpPath = null;

  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 1600, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    await page.setViewport({ width: 1120, height, deviceScaleFactor: 1 });
    await validateContactSheetDom(page, sections);
    if (validateOnly) {
      console.log('contact sheet validation OK');
      return;
    }
    const previousHash = fs.existsSync(outPath) ? fileHash(outPath) : null;
    tmpPath = tempPngPathFor(outPath);
    await page.screenshot({ path: tmpPath, clip: { x: 0, y: 0, width: 1120, height } });
    const nextHash = fileHash(tmpPath);
    if (previousHash && previousHash === nextHash && !allowUnchanged) {
      fs.unlinkSync(tmpPath);
      tmpPath = null;
      throw new Error(
        `contact sheet output is byte-identical to existing ${path.relative(repoRoot, outPath)}; artifact PNG inputs did not change. Update the artifact PNGs first, or pass --allow-unchanged when an identical deterministic sheet is expected.`
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
        previousManifest
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
