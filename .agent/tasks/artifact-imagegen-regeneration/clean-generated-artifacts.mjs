import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { artifacts } from '../../../app/server/game-data.js';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const ids = process.argv.slice(2);
const targets = ids.length ? ids : artifacts.filter((item) => !item.isCharacter).map((item) => item.id);

function shouldDropBackground(r, g, b, a) {
  if (a <= 16) return true;
  const magentaDistance = Math.abs(r - 255) + Math.abs(g - 0) + Math.abs(b - 255);
  const isStrongMagenta = r > 150 && b > 135 && g < 170 && Math.abs(r - b) < 110;
  const isNearWhite = r > 238 && g > 238 && b > 238;
  const isPalePinkPanel = r > 238 && b > 232 && g > 200 && Math.abs(r - b) < 45;
  return magentaDistance < 180 || isStrongMagenta || isNearWhite || isPalePinkPanel;
}

const browser = await puppeteer.launch({ headless: 'new' });
try {
  const page = await browser.newPage();
  for (const id of targets) {
    const filePath = path.join(artifactDir, `${id}.png`);
    if (!fs.existsSync(filePath)) continue;

    const inputData = fs.readFileSync(filePath).toString('base64');
    const cleanedBase64 = await page.evaluate(
      async ({ inputData, id }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${inputData}`;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixelCount = canvas.width * canvas.height;

        const dropBackground = (r, g, b, a) => {
          if (a <= 16) return true;
          const magentaDistance = Math.abs(r - 255) + Math.abs(g - 0) + Math.abs(b - 255);
          const isStrongMagenta = r > 150 && b > 135 && g < 170 && Math.abs(r - b) < 110;
          const isNearWhite = r > 238 && g > 238 && b > 238;
          const isPalePinkPanel = r > 238 && b > 232 && g > 200 && Math.abs(r - b) < 45;
          return magentaDistance < 180 || isStrongMagenta || isNearWhite || isPalePinkPanel;
        };

        for (let i = 0; i < pixelCount; i += 1) {
          const offset = i * 4;
          if (dropBackground(data.data[offset], data.data[offset + 1], data.data[offset + 2], data.data[offset + 3])) {
            data.data[offset + 3] = 0;
          }
        }

        const width = canvas.width;
        const height = canvas.height;
        const seen = new Uint8Array(pixelCount);
        const components = [];
        const stack = [];
        const neighbors = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];

        for (let start = 0; start < pixelCount; start += 1) {
          if (seen[start] || data.data[start * 4 + 3] <= 16) continue;
          seen[start] = 1;
          stack.push(start);
          const pixels = [];
          let minX = width;
          let minY = height;
          let maxX = 0;
          let maxY = 0;

          while (stack.length) {
            const current = stack.pop();
            pixels.push(current);
            const x = current % width;
            const y = Math.floor(current / width);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            for (const delta of neighbors) {
              const next = current + delta;
              if (next < 0 || next >= pixelCount || seen[next] || data.data[next * 4 + 3] <= 16) continue;
              const nx = next % width;
              const ny = Math.floor(next / width);
              if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;
              seen[next] = 1;
              stack.push(next);
            }
          }

          components.push({ pixels, area: pixels.length, minX, minY, maxX, maxY });
        }

        if (components.length > 1) {
          components.sort((a, b) => b.area - a.area);
          const largest = components[0].area;
          const keep = new Set();
          for (const component of components) {
            const nearEdge = component.minX <= 3 || component.minY <= 3 || component.maxX >= width - 4 || component.maxY >= height - 4;
            const bigEnough = component.area >= Math.max(32, largest * 0.08);
            if (component === components[0] || (bigEnough && !nearEdge)) {
              for (const pixel of component.pixels) keep.add(pixel);
            }
          }
          for (let i = 0; i < pixelCount; i += 1) {
            if (data.data[i * 4 + 3] > 16 && !keep.has(i)) {
              data.data[i * 4 + 3] = 0;
            }
          }
        }

        ctx.putImageData(data, 0, 0);
        return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      },
      { inputData, id, shouldDropBackground: shouldDropBackground.toString() }
    );

    fs.writeFileSync(filePath, Buffer.from(cleanedBase64, 'base64'));
    console.log(`cleaned web/public/artifacts/${id}.png`);
  }
} finally {
  await browser.close();
}
