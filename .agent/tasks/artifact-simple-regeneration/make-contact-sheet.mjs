import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { artifacts } from '../../../app/server/game-data.js';

const outPath = process.argv[2] || '.agent/artifact-image-workspace/review/simple-contact-sheet.png';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');

const items = artifacts.filter((artifact) => !artifact.isCharacter);
const columns = 6;
const tileW = 128;
const tileH = 126;
const imageBox = 92;
const rows = Math.ceil(items.length / columns);
const width = columns * tileW;
const height = rows * tileH;

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        width: ${width}px;
        min-height: ${height}px;
        background: #f7f2e7;
        font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #3f3328;
      }
      .sheet {
        display: grid;
        grid-template-columns: repeat(${columns}, ${tileW}px);
        grid-auto-rows: ${tileH}px;
        width: ${width}px;
      }
      .tile {
        display: grid;
        grid-template-rows: ${imageBox}px 1fr;
        place-items: center;
        padding: 6px 4px 4px;
        background: #fbf7ee;
        border-bottom: 1px solid rgba(80, 60, 34, 0.08);
        overflow: hidden;
      }
      .tile:nth-child(12n + 7),
      .tile:nth-child(12n + 8),
      .tile:nth-child(12n + 9),
      .tile:nth-child(12n + 10),
      .tile:nth-child(12n + 11),
      .tile:nth-child(12n + 12) {
        background: #f2ecdf;
      }
      .icon {
        width: ${imageBox}px;
        height: ${imageBox}px;
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      .thumb {
        width: 100%;
        height: 100%;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        filter: drop-shadow(0 3px 4px rgba(76, 52, 27, 0.18));
      }
      .label {
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      ${items.map((artifact) => {
        const imagePath = path.join(artifactDir, `${artifact.id}.png`);
        const src = `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;
        return `<div class="tile"><div class="icon"><div class="thumb" style="background-image:url('${src}')"></div></div><div class="label">${artifact.id}</div></div>`;
      }).join('')}
    </div>
  </body>
</html>`;

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
const browser = await puppeteer.launch({ headless: 'new' });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width, height } });
} finally {
  await browser.close();
}
