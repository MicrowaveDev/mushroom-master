#!/usr/bin/env node
/**
 * Small deterministic polish pass for the minimal Home Field candidate.
 *
 * This does not create production art and does not touch web/public/home-field.
 * It only fixes candidate-folder presentation issues that blocked review:
 * dark matte remnants, over-bright foliage, low-identity violet caps, oversized
 * exits, and too-small chibi frame occupancy.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeDeterministicPng,
  readPngAsRgba
} from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const workspace = path.join(repoRoot, '.agent', 'home-field-workspace');
const objectRoot = path.join(workspace, 'candidates', 'object-layer', 'latest');
const chibiRoot = path.join(workspace, 'candidates', 'chibi-active-roster', 'latest');

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function save(filePath, image) {
  fs.writeFileSync(filePath, encodeDeterministicPng(image));
}

function eachPixel(image, fn) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const i = (y * image.width + x) * 4;
      fn(i, x, y);
    }
  }
}

function alphaBounds(image, threshold = 24) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  eachPixel(image, (i, x, y) => {
    if (image.rgba[i + 3] < threshold) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function floodRemoveDarkMatte(image) {
  const rgba = Buffer.from(image.rgba);
  const seen = new Uint8Array(image.width * image.height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const p = y * image.width + x;
    if (seen[p]) return;
    seen[p] = 1;
    queue.push([x, y]);
  };
  for (let x = 0; x < image.width; x += 1) {
    push(x, 0);
    push(x, image.height - 1);
  }
  for (let y = 0; y < image.height; y += 1) {
    push(0, y);
    push(image.width - 1, y);
  }
  for (let q = 0; q < queue.length; q += 1) {
    const [x, y] = queue[q];
    const i = (y * image.width + x) * 4;
    const r = rgba[i + 0];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];
    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    const matteLike = a < 12 || (luma < 34 && Math.max(r, g, b) - Math.min(r, g, b) < 24);
    if (!matteLike) continue;
    rgba[i + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return { width: image.width, height: image.height, rgba };
}

function recolorLightBush(image) {
  const rgba = Buffer.from(image.rgba);
  eachPixel({ ...image, rgba }, (i) => {
    if (rgba[i + 3] < 16) return;
    rgba[i + 0] = clampByte(rgba[i + 0] * 0.62);
    rgba[i + 1] = clampByte(rgba[i + 1] * 0.72);
    rgba[i + 2] = clampByte(rgba[i + 2] * 0.70 + 8);
  });
  return { width: image.width, height: image.height, rgba };
}

function recolorVioletMushroom(image) {
  const rgba = Buffer.from(image.rgba);
  eachPixel({ ...image, rgba }, (i) => {
    const looksLikeKeyFringe = rgba[i + 0] > 150 && rgba[i + 1] < 92 && rgba[i + 2] > 130;
    if (looksLikeKeyFringe) {
      rgba[i + 3] = 0;
      return;
    }
    if (rgba[i + 3] < 16) return;
    const r = rgba[i + 0];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const isCap = b > 40 && r > 40 && Math.abs(r - g) < 42 && Math.abs(g - b) < 52;
    if (!isCap) return;
    rgba[i + 0] = clampByte(r * 0.82 + 16);
    rgba[i + 1] = clampByte(g * 0.80 + 34);
    rgba[i + 2] = clampByte(b * 1.18 + 30);
  });
  return { width: image.width, height: image.height, rgba };
}

function resizeNearest(image, dstWidth, dstHeight) {
  const rgba = Buffer.alloc(dstWidth * dstHeight * 4);
  for (let y = 0; y < dstHeight; y += 1) {
    const sy = Math.min(image.height - 1, Math.floor(y * image.height / dstHeight));
    for (let x = 0; x < dstWidth; x += 1) {
      const sx = Math.min(image.width - 1, Math.floor(x * image.width / dstWidth));
      const si = (sy * image.width + sx) * 4;
      const di = (y * dstWidth + x) * 4;
      image.rgba.copy(rgba, di, si, si + 4);
    }
  }
  return { width: dstWidth, height: dstHeight, rgba };
}

function scaleSubject(image, scale) {
  const bounds = alphaBounds(image);
  if (!bounds) return image;
  const crop = Buffer.alloc(bounds.width * bounds.height * 4);
  for (let y = 0; y < bounds.height; y += 1) {
    const srcOff = ((bounds.minY + y) * image.width + bounds.minX) * 4;
    const dstOff = y * bounds.width * 4;
    image.rgba.copy(crop, dstOff, srcOff, srcOff + bounds.width * 4);
  }
  const scaled = resizeNearest(
    { width: bounds.width, height: bounds.height, rgba: crop },
    Math.max(1, Math.round(bounds.width * scale)),
    Math.max(1, Math.round(bounds.height * scale))
  );
  const out = Buffer.alloc(image.width * image.height * 4);
  const x0 = Math.round((image.width - scaled.width) / 2);
  const y0 = Math.round(bounds.maxY - scaled.height + 1);
  for (let y = 0; y < scaled.height; y += 1) {
    const dy = y0 + y;
    if (dy < 0 || dy >= image.height) continue;
    for (let x = 0; x < scaled.width; x += 1) {
      const dx = x0 + x;
      if (dx < 0 || dx >= image.width) continue;
      const si = (y * scaled.width + x) * 4;
      const di = (dy * image.width + dx) * 4;
      scaled.rgba.copy(out, di, si, si + 4);
    }
  }
  return { width: image.width, height: image.height, rgba: out };
}

function toneDownExit(image) {
  const rgba = Buffer.from(image.rgba);
  eachPixel({ ...image, rgba }, (i) => {
    if (rgba[i + 3] < 16) return;
    const max = Math.max(rgba[i + 0], rgba[i + 1], rgba[i + 2]);
    if (max > 180) {
      rgba[i + 0] = clampByte(rgba[i + 0] * 0.88);
      rgba[i + 1] = clampByte(rgba[i + 1] * 0.82);
      rgba[i + 2] = clampByte(rgba[i + 2] * 0.72);
    } else {
      rgba[i + 0] = clampByte(rgba[i + 0] * 0.92);
      rgba[i + 1] = clampByte(rgba[i + 1] * 0.94);
      rgba[i + 2] = clampByte(rgba[i + 2] * 0.92);
    }
  });
  return scaleSubject({ width: image.width, height: image.height, rgba }, 0.82);
}

function polishChibiSheet(image) {
  const frameWidth = 64;
  const frameHeight = 64;
  const out = Buffer.alloc(image.width * image.height * 4);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const crop = Buffer.alloc(frameWidth * frameHeight * 4);
      for (let y = 0; y < frameHeight; y += 1) {
        const srcOff = ((row * frameHeight + y) * image.width + col * frameWidth) * 4;
        const dstOff = y * frameWidth * 4;
        image.rgba.copy(crop, dstOff, srcOff, srcOff + frameWidth * 4);
      }
      let frame = scaleSubject({ width: frameWidth, height: frameHeight, rgba: crop }, 1.14);
      eachPixel(frame, (i) => {
        if (frame.rgba[i + 3] < 16) return;
        if (frame.rgba[i + 0] > 185 && frame.rgba[i + 1] > 165 && frame.rgba[i + 2] > 120) {
          frame.rgba[i + 0] = clampByte(frame.rgba[i + 0] * 0.96);
          frame.rgba[i + 1] = clampByte(frame.rgba[i + 1] * 0.91);
          frame.rgba[i + 2] = clampByte(frame.rgba[i + 2] * 0.82);
        }
      });
      for (let y = 0; y < frameHeight; y += 1) {
        const srcOff = y * frameWidth * 4;
        const dstOff = ((row * frameHeight + y) * image.width + col * frameWidth) * 4;
        frame.rgba.copy(out, dstOff, srcOff, srcOff + frameWidth * 4);
      }
    }
  }
  return { width: image.width, height: image.height, rgba: out };
}

function polishAsset(relativePath, fn) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`skip missing ${relativePath}`);
    return;
  }
  save(filePath, fn(readPngAsRgba(filePath)));
  console.log(`polished ${relativePath}`);
}

polishAsset(path.relative(repoRoot, path.join(objectRoot, 'web/public/home-field/props/leaf_sprout_01.png')), floodRemoveDarkMatte);
polishAsset(path.relative(repoRoot, path.join(objectRoot, 'web/public/home-field/props/bush_cluster_light_01.png')), recolorLightBush);
polishAsset(path.relative(repoRoot, path.join(objectRoot, 'web/public/home-field/props/mushroom_cluster_small_violet.png')), recolorVioletMushroom);
polishAsset(path.relative(repoRoot, path.join(objectRoot, 'web/public/home-field/exits/arena_mushroom_arch.png')), toneDownExit);
polishAsset(path.relative(repoRoot, path.join(objectRoot, 'web/public/home-field/exits/journey_gate_under_construction.png')), toneDownExit);
polishAsset(path.relative(repoRoot, path.join(chibiRoot, 'web/public/home-field/characters/thalla/spritesheet.png')), polishChibiSheet);
