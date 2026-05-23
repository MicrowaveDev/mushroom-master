#!/usr/bin/env node
/**
 * Generate deterministic proof terrain cells for the home-field tilemap.
 *
 * These are intentionally tile-first: one 256x256 orthographic cell per PNG,
 * with wrapped edge painting so review can judge actual repetition before
 * commissioning or accepting final illustrated art.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeDeterministicPng } from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const outputDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'raw');
const TILE = 256;

const TERRAIN_IDS = [
  'grass_base_01',
  'grass_base_02',
  'grass_flowers_01',
  'path_dirt_straight',
  'path_spore_glow',
  'path_destination_row',
  'edge_roots_01',
  'edge_moss_rocks_01'
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function colorMix(a, b, t) {
  return [
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
    Math.round((a[3] ?? 255) + ((b[3] ?? 255) - (a[3] ?? 255)) * t)
  ];
}

function setPixel(rgba, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const i = (y * TILE + x) * 4;
  const a = clamp(alpha * ((color[3] ?? 255) / 255), 0, 1);
  const inv = 1 - a;
  rgba[i] = Math.round(rgba[i] * inv + color[0] * a);
  rgba[i + 1] = Math.round(rgba[i + 1] * inv + color[1] * a);
  rgba[i + 2] = Math.round(rgba[i + 2] * inv + color[2] * a);
  rgba[i + 3] = 255;
}

function fill(rgba, color) {
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const i = (y * TILE + x) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = 255;
    }
  }
}

function periodicNoise(x, y, seed = 0) {
  const ax = (Math.PI * 2 * x) / TILE;
  const ay = (Math.PI * 2 * y) / TILE;
  const v =
    Math.sin(ax + seed * 0.61) * 0.34 +
    Math.cos(ay * 1.15 + seed * 0.43) * 0.28 +
    Math.sin(ax * 2 + ay + seed * 0.27) * 0.18 +
    Math.cos(ax - ay * 2 + seed * 0.19) * 0.2;
  return v;
}

function addBaseNoise(rgba, dark, light, seed) {
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const n = periodicNoise(x, y, seed);
      const t = clamp(0.5 + n * 0.48, 0, 1);
      setPixel(rgba, x, y, colorMix(dark, light, t), 0.34);
    }
  }
}

function paintEllipse(rgba, cx, cy, rx, ry, color, alpha = 1, feather = 0.28) {
  const minX = Math.floor(cx - rx - 2);
  const maxX = Math.ceil(cx + rx + 2);
  const minY = Math.floor(cy - ry - 2);
  const maxY = Math.ceil(cy + ry + 2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const edge = clamp((1 - d) / feather, 0, 1);
      setPixel(rgba, ((x % TILE) + TILE) % TILE, ((y % TILE) + TILE) % TILE, color, alpha * edge);
    }
  }
}

function paintWrappedEllipse(rgba, cx, cy, rx, ry, color, alpha = 1, feather = 0.28) {
  for (const ox of [-TILE, 0, TILE]) {
    for (const oy of [-TILE, 0, TILE]) {
      paintEllipse(rgba, cx + ox, cy + oy, rx, ry, color, alpha, feather);
    }
  }
}

function paintBrushStroke(rgba, x0, y0, x1, y1, radius, color, alpha = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    paintWrappedEllipse(rgba, x, y, radius * (0.82 + 0.18 * Math.sin(t * Math.PI)), radius * 0.55, color, alpha, 0.55);
  }
}

function makeGrass({ variant = 0, flowers = false } = {}) {
  const rgba = Buffer.alloc(TILE * TILE * 4);
  const base = variant === 0 ? [84, 131, 73, 255] : [76, 124, 81, 255];
  fill(rgba, base);
  addBaseNoise(rgba, [57, 102, 64, 255], [139, 171, 105, 255], 8 + variant);

  const patches = variant === 0
    ? [
        [32, 44, 72, 44, [133, 160, 91, 255], 0.38],
        [208, 220, 86, 42, [56, 102, 71, 255], 0.28],
        [236, 52, 48, 64, [158, 176, 107, 255], 0.22],
        [112, 158, 100, 54, [70, 116, 64, 255], 0.24]
      ]
    : [
        [12, 116, 78, 50, [141, 166, 99, 255], 0.32],
        [184, 22, 98, 48, [62, 105, 76, 255], 0.26],
        [224, 164, 72, 64, [151, 171, 106, 255], 0.24],
        [86, 226, 96, 42, [61, 107, 65, 255], 0.2]
      ];

  for (const [x, y, rx, ry, color, alpha] of patches) {
    paintWrappedEllipse(rgba, x, y, rx, ry, color, alpha, 0.42);
  }

  paintBrushStroke(rgba, -24, 180, 88, 146, 10, [168, 184, 116, 255], 0.045);
  paintBrushStroke(rgba, 164, 280, 294, 224, 9, [43, 92, 64, 255], 0.045);

  if (flowers) {
    const flowerDots = [
      [40, 72, [226, 190, 88, 255]],
      [54, 78, [244, 218, 126, 255]],
      [204, 48, [173, 126, 216, 255]],
      [218, 58, [211, 178, 91, 255]],
      [154, 214, [232, 206, 120, 255]],
      [164, 224, [177, 130, 214, 255]]
    ];
    for (const [x, y, color] of flowerDots) {
      paintWrappedEllipse(rgba, x, y, 4.5, 3.5, color, 0.78, 0.5);
      paintWrappedEllipse(rgba, x + 1, y + 1, 1.6, 1.2, [250, 240, 190, 255], 0.7, 0.5);
    }
  }
  return rgba;
}

function makeHorizontalPath({ glow = false } = {}) {
  const rgba = makeGrass({ variant: glow ? 1 : 0 });
  const centerY = 132;
  for (let y = 0; y < TILE; y += 1) {
    const dist = Math.abs(y - centerY);
    const width = 39 + 7 * Math.sin((Math.PI * 2 * y) / TILE);
    if (dist > width + 18) continue;
    const edge = clamp((width + 18 - dist) / 18, 0, 1);
    for (let x = 0; x < TILE; x += 1) {
      const n = periodicNoise(x, y, 21);
      const c = colorMix([135, 100, 67, 255], [206, 164, 98, 255], clamp(0.52 + n * 0.34, 0, 1));
      setPixel(rgba, x, y, c, edge * 0.92);
    }
  }
  paintBrushStroke(rgba, -16, 114, 276, 120, 6, [239, 211, 134, 255], 0.18);
  paintBrushStroke(rgba, -18, 154, 278, 146, 5, [83, 61, 43, 255], 0.12);
  if (glow) {
    paintWrappedEllipse(rgba, 128, 132, 72, 32, [225, 190, 91, 255], 0.2, 0.7);
    for (const x of [42, 98, 170, 218]) {
      paintWrappedEllipse(rgba, x, 132 + 7 * Math.sin(x), 5, 4, [247, 220, 112, 255], 0.55, 0.6);
    }
  }
  return rgba;
}

function makeDestinationPath() {
  const rgba = makeGrass({ variant: 1 });
  for (let y = 0; y < TILE; y += 1) {
    const taper = y < 112 ? 0.45 : 1;
    const width = 30 + 26 * taper;
    for (let x = 0; x < TILE; x += 1) {
      const centerOffset = Math.abs(x - 128);
      if (centerOffset > width + 18) continue;
      const edge = clamp((width + 18 - centerOffset) / 18, 0, 1);
      const n = periodicNoise(x, y, 27);
      const c = colorMix([132, 95, 62, 255], [205, 160, 94, 255], clamp(0.56 + n * 0.3, 0, 1));
      setPixel(rgba, x, y, c, edge * 0.74);
    }
  }
  paintWrappedEllipse(rgba, 128, 112, 90, 44, [170, 128, 78, 255], 0.5, 0.5);
  paintBrushStroke(rgba, 78, 116, 178, 108, 7, [229, 197, 122, 255], 0.13);
  paintBrushStroke(rgba, 106, 236, 150, 264, 6, [81, 62, 44, 255], 0.1);
  return rgba;
}

function makeEdgeRoots() {
  const rgba = makeGrass({ variant: 1 });
  paintWrappedEllipse(rgba, 22, 128, 88, 184, [38, 71, 45, 255], 0.46, 0.58);
  paintWrappedEllipse(rgba, 232, 128, 82, 184, [39, 72, 46, 255], 0.4, 0.58);
  paintWrappedEllipse(rgba, 126, 18, 164, 48, [47, 80, 50, 255], 0.24, 0.62);
  paintWrappedEllipse(rgba, 128, 238, 164, 54, [50, 84, 52, 255], 0.2, 0.62);

  const rootColor = [91, 64, 45, 255];
  const rootLight = [137, 96, 56, 255];
  const strokes = [
    [-26, 70, 82, 128, 6],
    [30, -20, 112, 104, 5],
    [286, 84, 180, 150, 6],
    [216, 280, 150, 166, 5],
    [70, 132, 188, 172, 4]
  ];
  for (const [x0, y0, x1, y1, radius] of strokes) {
    paintBrushStroke(rgba, x0, y0, x1, y1, radius, rootColor, 0.3);
    paintBrushStroke(rgba, x0 + 3, y0 + 2, x1 + 3, y1 + 2, Math.max(2, radius * 0.34), rootLight, 0.16);
  }

  const leafClumps = [
    [52, 56, 30, 16], [202, 74, 34, 18], [38, 184, 34, 18],
    [216, 190, 30, 16], [124, 46, 38, 14], [132, 218, 42, 16]
  ];
  for (const [x, y, rx, ry] of leafClumps) {
    paintWrappedEllipse(rgba, x, y, rx, ry, [127, 153, 86, 255], 0.18, 0.6);
  }
  return rgba;
}

function makeEdgeMossRocks() {
  const rgba = makeGrass({ variant: 0 });
  paintWrappedEllipse(rgba, 28, 126, 90, 176, [48, 84, 58, 255], 0.3, 0.58);
  paintWrappedEllipse(rgba, 226, 132, 88, 176, [48, 84, 58, 255], 0.28, 0.58);
  paintWrappedEllipse(rgba, 128, 8, 158, 42, [55, 91, 59, 255], 0.22, 0.6);
  paintWrappedEllipse(rgba, 128, 248, 150, 40, [54, 90, 58, 255], 0.2, 0.6);

  const rocks = [
    [34, 54, 22, 13],
    [228, 74, 24, 14],
    [30, 164, 28, 16],
    [222, 194, 26, 15],
    [128, 28, 34, 12],
    [132, 226, 36, 13]
  ];
  for (const [x, y, rx, ry] of rocks) {
    paintWrappedEllipse(rgba, x, y, rx, ry, [91, 98, 78, 255], 0.34, 0.48);
    paintWrappedEllipse(rgba, x - 4, y - 3, rx * 0.58, ry * 0.46, [143, 149, 112, 255], 0.2, 0.55);
    paintWrappedEllipse(rgba, x + 6, y + 4, rx * 0.62, ry * 0.42, [55, 68, 57, 255], 0.14, 0.58);
  }

  const moss = [
    [64, 92], [92, 178], [196, 98], [184, 190], [130, 202]
  ];
  for (const [x, y] of moss) {
    paintWrappedEllipse(rgba, x, y, 22, 10, [151, 174, 96, 255], 0.18, 0.6);
  }
  return rgba;
}

function writeTile(id, rgba) {
  fs.mkdirSync(outputDir, { recursive: true });
  const out = path.join(outputDir, `${id}.source.png`);
  fs.writeFileSync(out, encodeDeterministicPng({ width: TILE, height: TILE, rgba }));
  console.log(`wrote ${path.relative(repoRoot, out)}`);
}

function main() {
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const ids = wanted.length > 0 ? wanted : TERRAIN_IDS;
  for (const id of ids) {
    if (id === 'grass_base_01') writeTile(id, makeGrass({ variant: 0 }));
    else if (id === 'grass_base_02') writeTile(id, makeGrass({ variant: 1 }));
    else if (id === 'grass_flowers_01') writeTile(id, makeGrass({ variant: 1, flowers: true }));
    else if (id === 'path_dirt_straight') writeTile(id, makeHorizontalPath());
    else if (id === 'path_spore_glow') writeTile(id, makeHorizontalPath({ glow: true }));
    else if (id === 'path_destination_row') writeTile(id, makeDestinationPath());
    else if (id === 'edge_roots_01') writeTile(id, makeEdgeRoots());
    else if (id === 'edge_moss_rocks_01') writeTile(id, makeEdgeMossRocks());
    else throw new Error(`Unknown proof tile id "${id}". Supported: ${TERRAIN_IDS.join(', ')}`);
  }
}

main();
