import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer';
import { artifacts } from '../../../app/server/game-data.js';
import { getBagShape } from '../../../app/shared/bag-shape.js';

const args = process.argv.slice(2);
const allowUnchanged = args.includes('--allow-unchanged');
const allowClippedSource = args.includes('--allow-clipped-source');
const forceCellMask = args.includes('--force-cell-mask');
const organicMask = args.includes('--organic-mask');
const positionalArgs = args.filter((arg) => ![
  '--allow-unchanged',
  '--allow-clipped-source',
  '--force-cell-mask',
  '--organic-mask',
  '--no-organic-mask'
].includes(arg));
const [inputPath, artifactId, outputPath] = positionalArgs;

if (!inputPath || !artifactId || !outputPath) {
  console.error('Usage: node chroma-key-artifact.mjs input.png artifact_id output.png [--allow-unchanged] [--allow-clipped-source] [--force-cell-mask] [--organic-mask]');
  process.exit(2);
}

const artifact = artifacts.find((item) => item.id === artifactId);
if (!artifact) {
  console.error(`Unknown artifact: ${artifactId}`);
  process.exit(2);
}

function shapeForArtifact(item) {
  if (item.family === 'bag' && item.shape) return getBagShape(item, 0);
  return Array.from({ length: item.height }, () => Array(item.width).fill(1));
}

const shape = shapeForArtifact(artifact);
const rows = shape.length;
const cols = shape[0]?.length || 1;
const occupiedCells = shape.flat().filter(Boolean).length;
const hasMaskGaps = occupiedCells < rows * cols;
const cellPx = 160;
const outWidth = cols * cellPx;
const outHeight = rows * cellPx;
const inputData = fs.readFileSync(inputPath).toString('base64');

function bufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const browser = await puppeteer.launch({ headless: 'new' });
try {
  const page = await browser.newPage();
  const pngBase64 = await page.evaluate(
    async ({ inputData, outWidth, outHeight, shape, hasMaskGaps, forceCellMask, organicMask, allowClippedSource }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${inputData}`;
      await image.decode();

      const src = document.createElement('canvas');
      src.width = image.naturalWidth;
      src.height = image.naturalHeight;
      const srcCtx = src.getContext('2d', { willReadFrequently: true });
      srcCtx.drawImage(image, 0, 0);

      const srcData = srcCtx.getImageData(0, 0, src.width, src.height);
      let minX = src.width;
      let minY = src.height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < src.height; y += 1) {
        for (let x = 0; x < src.width; x += 1) {
          const i = (y * src.width + x) * 4;
          const r = srcData.data[i];
          const g = srcData.data[i + 1];
          const b = srcData.data[i + 2];
          const magentaDistance = Math.abs(r - 255) + Math.abs(g - 0) + Math.abs(b - 255);
          const isStrongMagenta = r > 150 && b > 135 && g < 140 && Math.abs(r - b) < 95;
          const isKey = magentaDistance < 140 || isStrongMagenta;
          if (isKey) {
            srcData.data[i + 3] = 0;
            continue;
          }
          if (srcData.data[i + 3] > 12) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      const sourceMarginPx = Math.max(8, Math.round(Math.min(src.width, src.height) * 0.02));
      const sourceMargins = {
        left: minX,
        right: src.width - 1 - maxX,
        top: minY,
        bottom: src.height - 1 - maxY
      };
      const clippedEdges = Object.entries(sourceMargins)
        .filter(([, value]) => value < sourceMarginPx)
        .map(([side, value]) => `${side}=${value}px`);
      if (clippedEdges.length && !allowClippedSource) {
        throw new Error(
          `raw source appears clipped or contaminated at canvas edge (${clippedEdges.join(', ')}; need at least ${sourceMarginPx}px). Use an uncut imagegen source or an approved archive candidate; rerunning conversion cannot restore missing pixels.`
        );
      }
      srcCtx.putImageData(srcData, 0, 0);

      const cropW = Math.max(1, maxX - minX + 1);
      const cropH = Math.max(1, maxY - minY + 1);
      const pad = Math.round(Math.max(cropW, cropH) * 0.035);
      const sx = Math.max(0, minX - pad);
      const sy = Math.max(0, minY - pad);
      const sw = Math.min(src.width - sx, cropW + pad * 2);
      const sh = Math.min(src.height - sy, cropH + pad * 2);

      const out = document.createElement('canvas');
      out.width = outWidth;
      out.height = outHeight;
      const outCtx = out.getContext('2d', { willReadFrequently: true });
      outCtx.clearRect(0, 0, outWidth, outHeight);

      const isSingle = outWidth === outHeight;
      const isWide = outWidth > outHeight;
      const isTall = outHeight > outWidth;
      const targetW = outWidth * (hasMaskGaps ? 0.98 : isWide ? 0.9 : isTall ? 0.84 : 0.96);
      const targetH = outHeight * (hasMaskGaps ? 0.96 : isTall ? 0.9 : isWide ? 0.86 : 0.96);
      const dw = Math.min(outWidth * (hasMaskGaps ? 0.995 : 0.94), targetW);
      const dh = Math.min(outHeight * (hasMaskGaps ? 0.985 : 0.94), targetH);
      const dx = (outWidth - dw) / 2;
      const dy = (outHeight - dh) / 2;
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);

      const outData = outCtx.getImageData(0, 0, outWidth, outHeight);
      const cellW = outWidth / shape[0].length;
      const cellH = outHeight / shape.length;
      const shouldApplyCellMask = hasMaskGaps && forceCellMask;
      const shouldApplyOrganicMask = hasMaskGaps && !forceCellMask && organicMask;
      const gapClearPx = shouldApplyCellMask ? Math.max(14, Math.round(Math.min(cellW, cellH) * 0.13)) : 0;
      const gapFeatherPx = shouldApplyCellMask ? Math.max(gapClearPx + 8, Math.round(Math.min(cellW, cellH) * 0.21)) : 0;
      const organicBaseClearPx = shouldApplyOrganicMask ? Math.max(18, Math.round(Math.min(cellW, cellH) * 0.12)) : 0;
      const organicClearAmplitudePx = shouldApplyOrganicMask ? Math.max(28, Math.round(Math.min(cellW, cellH) * 0.21)) : 0;
      const organicFeatherPx = shouldApplyOrganicMask ? Math.max(8, Math.round(Math.min(cellW, cellH) * 0.065)) : 0;
      const isEmptyMaskNeighbor = (row, col) => (
        row >= 0
        && row < shape.length
        && col >= 0
        && col < shape[0].length
        && !shape[row][col]
      );
      const organicClearForT = (t) => {
        const clamped = Math.max(0, Math.min(1, t));
        const curve = Math.pow(Math.sin(Math.PI * clamped), 0.62);
        return organicBaseClearPx + organicClearAmplitudePx * curve;
      };
      const applyOrganicGap = (distance, t, alpha) => {
        const clearPx = organicClearForT(t);
        if (distance <= clearPx) return 0;
        if (distance < clearPx + organicFeatherPx) {
          const fade = (distance - clearPx) / organicFeatherPx;
          return Math.round(alpha * Math.max(0, Math.min(1, fade)));
        }
        return alpha;
      };
      for (let y = 0; y < outHeight; y += 1) {
        for (let x = 0; x < outWidth; x += 1) {
          const row = Math.min(shape.length - 1, Math.floor(y / cellH));
          const col = Math.min(shape[0].length - 1, Math.floor(x / cellW));
          const offset = (y * outWidth + x) * 4 + 3;
          if ((shouldApplyCellMask || shouldApplyOrganicMask) && !shape[row][col]) {
            outData.data[offset] = 0;
            continue;
          }

          if (shouldApplyCellMask) {
            let distanceToGap = Infinity;
            if (isEmptyMaskNeighbor(row, col - 1)) {
              distanceToGap = Math.min(distanceToGap, x - col * cellW);
            }
            if (isEmptyMaskNeighbor(row, col + 1)) {
              distanceToGap = Math.min(distanceToGap, (col + 1) * cellW - 1 - x);
            }
            if (isEmptyMaskNeighbor(row - 1, col)) {
              distanceToGap = Math.min(distanceToGap, y - row * cellH);
            }
            if (isEmptyMaskNeighbor(row + 1, col)) {
              distanceToGap = Math.min(distanceToGap, (row + 1) * cellH - 1 - y);
            }

            if (distanceToGap <= gapClearPx) {
              outData.data[offset] = 0;
            } else if (distanceToGap < gapFeatherPx) {
              const t = (distanceToGap - gapClearPx) / (gapFeatherPx - gapClearPx);
              outData.data[offset] = Math.round(outData.data[offset] * Math.max(0, Math.min(1, t)));
            }
          }

          if (shouldApplyOrganicMask) {
            let alpha = outData.data[offset];
            if (isEmptyMaskNeighbor(row, col - 1)) {
              alpha = applyOrganicGap(x - col * cellW, (y - row * cellH) / cellH, alpha);
            }
            if (isEmptyMaskNeighbor(row, col + 1)) {
              alpha = applyOrganicGap((col + 1) * cellW - 1 - x, (y - row * cellH) / cellH, alpha);
            }
            if (isEmptyMaskNeighbor(row - 1, col)) {
              alpha = applyOrganicGap(y - row * cellH, (x - col * cellW) / cellW, alpha);
            }
            if (isEmptyMaskNeighbor(row + 1, col)) {
              alpha = applyOrganicGap((row + 1) * cellH - 1 - y, (x - col * cellW) / cellW, alpha);
            }
            outData.data[offset] = alpha;
          }
        }
      }
      outCtx.putImageData(outData, 0, 0);
      return out.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    },
    { inputData, outWidth, outHeight, shape, hasMaskGaps, forceCellMask, organicMask, allowClippedSource }
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const nextBuffer = Buffer.from(pngBase64, 'base64');
  if (fs.existsSync(outputPath)) {
    const previousHash = bufferHash(fs.readFileSync(outputPath));
    const nextHash = bufferHash(nextBuffer);
    if (previousHash === nextHash && !allowUnchanged) {
      throw new Error(
        `${path.relative(process.cwd(), outputPath)} is byte-identical after processing ${path.relative(process.cwd(), inputPath)}; image processing did not update the artifact PNG. Use a new imagegen source, adjust processing, or pass --allow-unchanged only for intentional idempotent rebuilds.`
      );
    }
  }
  fs.writeFileSync(outputPath, nextBuffer);
} finally {
  await browser.close();
}
