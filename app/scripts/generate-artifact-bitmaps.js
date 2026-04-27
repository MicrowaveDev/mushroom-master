import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { artifacts } from '../server/game-data.js';
import { repoRoot } from '../shared/repo-root.js';
import { getBagShape } from '../shared/bag-shape.js';
import { artifactTheme, renderArtifactSvgContent } from '../../web/src/artifacts/render.js';

const outDir = path.join(repoRoot, 'web/public/artifacts');
const cellPx = 160;
const unit = 80;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function artifactShape(artifact) {
  if (artifact.family === 'bag') return getBagShape(artifact);
  return Array.from({ length: artifact.height }, () => new Array(artifact.width).fill(1));
}

function renderSvg(artifact) {
  const shape = artifactShape(artifact);
  const rows = shape.length;
  const cols = shape[0]?.length || 1;
  const width = cols * unit;
  const height = rows * unit;
  const theme = artifactTheme(artifact);
  const clipRects = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (shape[y]?.[x]) {
        clipRects.push(`<rect x="${x * unit}" y="${y * unit}" width="${unit}" height="${unit}" rx="12" />`);
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cellPx}" height="${rows * cellPx}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(artifact.name?.en || artifact.id)}">
  <defs>
    <clipPath id="artifact-mask">
      ${clipRects.join('\n      ')}
    </clipPath>
  </defs>
  <g clip-path="url(#artifact-mask)">
    ${renderArtifactSvgContent(artifact, theme, cols, rows)}
  </g>
</svg>`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    for (const artifact of artifacts) {
      const shape = artifactShape(artifact);
      const rows = shape.length;
      const cols = shape[0]?.length || 1;
      const width = cols * cellPx;
      const height = rows * cellPx;
      const svg = renderSvg(artifact);
      const svgPath = path.join(outDir, `${artifact.id}.svg`);
      const pngPath = path.join(outDir, `${artifact.id}.png`);
      fs.writeFileSync(svgPath, svg);

      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.setContent(`
        <!doctype html>
        <html>
          <head><meta charset="utf-8"></head>
          <body style="margin:0;background:transparent;width:${width}px;height:${height}px;overflow:hidden">
            ${svg}
          </body>
        </html>
      `);
      await page.screenshot({ path: pngPath, omitBackground: true, clip: { x: 0, y: 0, width, height } });
      // eslint-disable-next-line no-console
      console.log(`generated ${path.relative(repoRoot, pngPath)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
