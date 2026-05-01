import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';

const [inputPath, columnsArg, rowsArg, ...ids] = process.argv.slice(2);

if (!inputPath || !columnsArg || !rowsArg || !ids.length) {
  console.error('Usage: node split-imagegen-sheet.mjs input.png columns rows artifact_id [...]');
  process.exit(2);
}

const columns = Number(columnsArg);
const rows = Number(rowsArg);
if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns <= 0 || rows <= 0) {
  console.error('columns and rows must be positive integers');
  process.exit(2);
}
if (ids.length > columns * rows) {
  console.error(`too many ids for ${columns}x${rows} sheet`);
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const rawDir = path.join(repoRoot, '.agent', 'tasks', 'artifact-imagegen-regeneration', 'raw');
const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const chromaScript = path.join(repoRoot, '.agent', 'tasks', 'artifact-simple-regeneration', 'chroma-key-artifact.mjs');

fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(artifactDir, { recursive: true });

const inputData = fs.readFileSync(inputPath).toString('base64');
const browser = await puppeteer.launch({ headless: 'new' });
try {
  const page = await browser.newPage();
  const crops = await page.evaluate(
    async ({ inputData, columns, rows, ids }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${inputData}`;
      await image.decode();

      const source = document.createElement('canvas');
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      const sourceCtx = source.getContext('2d');
      sourceCtx.drawImage(image, 0, 0);

      const cellW = Math.floor(source.width / columns);
      const cellH = Math.floor(source.height / rows);
      return ids.map((id, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const crop = document.createElement('canvas');
        crop.width = cellW;
        crop.height = cellH;
        crop.getContext('2d').drawImage(
          source,
          col * cellW,
          row * cellH,
          cellW,
          cellH,
          0,
          0,
          cellW,
          cellH
        );
        return {
          id,
          pngBase64: crop.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
        };
      });
    },
    { inputData, columns, rows, ids }
  );

  for (const { id, pngBase64 } of crops) {
    const rawPath = path.join(rawDir, `${id}.source.png`);
    const outPath = path.join(artifactDir, `${id}.png`);
    fs.writeFileSync(rawPath, Buffer.from(pngBase64, 'base64'));
    execFileSync(process.execPath, [chromaScript, rawPath, id, outPath], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    console.log(`processed ${path.relative(repoRoot, outPath)}`);
  }
} finally {
  await browser.close();
}
