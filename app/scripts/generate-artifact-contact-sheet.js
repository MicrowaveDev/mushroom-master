import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { artifacts } from '../server/game-data.js';
import { artifactVisualClassification } from '../shared/artifact-visual-classification.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const defaultOutPath = path.join(artifactDir, 'contact-sheet.png');

function parseArgs(argv) {
  const outArg = argv.find((arg) => arg.startsWith('--out='));
  return {
    outPath: outArg ? path.resolve(outArg.slice('--out='.length)) : defaultOutPath
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sectionFor(artifact) {
  if (artifact.family === 'bag') return 'Bags';
  if (artifact.starterOnly) return 'Signature Starters';
  if (artifact.characterItem) return 'Character Artifacts';
  if (artifact.family === 'damage') return 'Damage';
  if (artifact.family === 'armor') return 'Armor';
  if (artifact.family === 'stun') return 'Stun';
  return 'Utility';
}

const sectionOrder = [
  'Damage',
  'Armor',
  'Stun',
  'Character Artifacts',
  'Signature Starters',
  'Bags',
  'Utility'
];

function compareArtifacts(a, b) {
  return a.id.localeCompare(b.id, 'en');
}

function artifactImageDataUrl(artifact) {
  const imagePath = path.join(artifactDir, `${artifact.id}.png`);
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Missing artifact image: ${path.relative(repoRoot, imagePath)}`);
  }
  return `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;
}

function buildSections() {
  const sections = new Map(sectionOrder.map((section) => [section, []]));
  for (const artifact of artifacts.filter((item) => !item.isCharacter)) {
    const section = sectionFor(artifact);
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(artifact);
  }
  for (const items of sections.values()) {
    items.sort(compareArtifacts);
  }
  return Array.from(sections.entries()).filter(([, items]) => items.length);
}

function renderTile(artifact) {
  const visual = artifactVisualClassification(artifact);
  const dataUrl = artifactImageDataUrl(artifact);
  const footprint = artifact.shape
    ? `${artifact.shape[0]?.length || artifact.width}x${artifact.shape.length}`
    : `${artifact.width}x${artifact.height}`;
  return `
    <div class="tile ${visual.cssClasses.join(' ')}" style="--role-color: ${visual.role.color};">
      <div class="icon" style="background-image: url('${dataUrl}')"></div>
      <div class="label">${escapeHtml(artifact.id)}</div>
      <div class="meta">
        <span>${escapeHtml(visual.role.label)}</span>
        <span>${escapeHtml(visual.shine.label)}</span>
        <span>${escapeHtml(footprint)}</span>
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
        grid-template-columns: repeat(6, 170px);
        gap: 8px;
      }
      .tile {
        position: relative;
        height: 154px;
        display: grid;
        grid-template-rows: 96px 18px 18px;
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
      .artifact-shine--bright {
        border-color: color-mix(in srgb, var(--role-color) 46%, white);
      }
      .artifact-shine--radiant,
      .artifact-shine--signature {
        border-color: color-mix(in srgb, var(--role-color) 72%, white);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--role-color) 16%, transparent);
      }
      .icon {
        width: 96px;
        height: 96px;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
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
              ${items.map(renderTile).join('')}
            </div>
          </section>`;
      }).join('')}
    </main>
  </body>
</html>`;
}

async function main() {
  const { outPath } = parseArgs(process.argv.slice(2));
  const sections = buildSections();
  const html = renderHtml(sections);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 1600, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    await page.setViewport({ width: 1120, height, deviceScaleFactor: 1 });
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1120, height } });
    console.log(`generated ${path.relative(repoRoot, outPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
