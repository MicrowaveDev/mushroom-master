import fs from 'node:fs';
import { cropRaster, resizeRasterHybrid } from '@microwavedev/backpack-game-core/tooling/raster';

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function resizeRgba(srcImage, dstWidth, dstHeight) {
  return resizeRasterHybrid(srcImage, dstWidth, dstHeight);
}

export function cropNormalizedSquare(srcImage, crop) {
  const cropSize = Math.max(1, Math.floor(Math.min(srcImage.width, srcImage.height) * crop.ratio));
  const centerX = Math.round(srcImage.width * crop.center.x);
  const centerY = Math.round(srcImage.height * crop.center.y);
  const startX = Math.max(0, Math.min(srcImage.width - cropSize, centerX - Math.floor(cropSize / 2)));
  const startY = Math.max(0, Math.min(srcImage.height - cropSize, centerY - Math.floor(cropSize / 2)));
  return {
    image: cropRaster(srcImage, { x: startX, y: startY, width: cropSize, height: cropSize }),
    rect: { x: startX, y: startY, width: cropSize, height: cropSize }
  };
}

export function quietTerrainContrast(image, amount) {
  const sums = [0, 0, 0];
  const count = image.width * image.height;
  for (let offset = 0; offset < image.rgba.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) sums[channel] += image.rgba[offset + channel];
  }
  const averages = sums.map((sum) => sum / count);
  const rgba = Buffer.from(image.rgba);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      rgba[offset + channel] = Math.round(rgba[offset + channel] * (1 - amount) + averages[channel] * amount);
    }
  }
  return { width: image.width, height: image.height, rgba };
}

export function allHomeFieldEntries(assetsDoc) {
  return [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((entry) => ({
      ...entry,
      type: 'character',
      width: entry.spritesheet.width,
      height: entry.spritesheet.height
    }))
  ];
}
