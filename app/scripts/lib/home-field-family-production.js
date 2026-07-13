import fs from 'node:fs';

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function resizeRgba(srcImage, dstWidth, dstHeight) {
  const { width: sourceWidth, height: sourceHeight, rgba: source } = srcImage;
  const output = Buffer.alloc(dstWidth * dstHeight * 4);
  const xRatio = sourceWidth / dstWidth;
  const yRatio = sourceHeight / dstHeight;
  if (sourceWidth < dstWidth || sourceHeight < dstHeight) {
    for (let y = 0; y < dstHeight; y += 1) {
      const sourceY = Math.min(sourceHeight - 1, Math.floor(y * yRatio));
      for (let x = 0; x < dstWidth; x += 1) {
        const sourceX = Math.min(sourceWidth - 1, Math.floor(x * xRatio));
        const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
        source.copy(output, (y * dstWidth + x) * 4, sourceOffset, sourceOffset + 4);
      }
    }
    return { width: dstWidth, height: dstHeight, rgba: output };
  }
  for (let y = 0; y < dstHeight; y += 1) {
    const sourceY0 = Math.floor(y * yRatio);
    const sourceY1 = Math.min(sourceHeight, Math.ceil((y + 1) * yRatio));
    for (let x = 0; x < dstWidth; x += 1) {
      const sourceX0 = Math.floor(x * xRatio);
      const sourceX1 = Math.min(sourceWidth, Math.ceil((x + 1) * xRatio));
      const sums = [0, 0, 0, 0];
      let count = 0;
      for (let sourceY = sourceY0; sourceY < sourceY1; sourceY += 1) {
        for (let sourceX = sourceX0; sourceX < sourceX1; sourceX += 1) {
          const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
          for (let channel = 0; channel < 4; channel += 1) sums[channel] += source[sourceOffset + channel];
          count += 1;
        }
      }
      const outputOffset = (y * dstWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) output[outputOffset + channel] = Math.round(sums[channel] / count);
    }
  }
  return { width: dstWidth, height: dstHeight, rgba: output };
}

export function cropNormalizedSquare(srcImage, crop) {
  const cropSize = Math.max(1, Math.floor(Math.min(srcImage.width, srcImage.height) * crop.ratio));
  const centerX = Math.round(srcImage.width * crop.center.x);
  const centerY = Math.round(srcImage.height * crop.center.y);
  const startX = Math.max(0, Math.min(srcImage.width - cropSize, centerX - Math.floor(cropSize / 2)));
  const startY = Math.max(0, Math.min(srcImage.height - cropSize, centerY - Math.floor(cropSize / 2)));
  const rgba = Buffer.alloc(cropSize * cropSize * 4);
  for (let y = 0; y < cropSize; y += 1) {
    const sourceOffset = ((startY + y) * srcImage.width + startX) * 4;
    srcImage.rgba.copy(rgba, y * cropSize * 4, sourceOffset, sourceOffset + cropSize * 4);
  }
  return {
    image: { width: cropSize, height: cropSize, rgba },
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
