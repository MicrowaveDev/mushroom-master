#!/usr/bin/env node
/**
 * Generate deterministic placeholder terrain cells and top-down object props
 * for layout and loading proofs. This command never writes app-facing assets
 * and its output is never eligible for production approval.
 *
 * Terrain is intentionally quiet and tile-first. Bush masses and sprouts are
 * transparent object-layer props so the field can keep painterly foliage without
 * stamping obvious shapes into every repeated grass tile.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeDeterministicPng } from '../lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
const outputDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'raw');
const TILE = 256;

const PROOF_IDS = [
  'grass_base_01',
  'grass_base_02',
  'grass_flowers_01',
  'path_dirt_straight',
  'path_spore_glow',
  'path_destination_row',
  'edge_roots_01',
  'edge_moss_rocks_01',
  'bush_cluster_dark_01',
  'bush_cluster_light_01',
  'leaf_sprout_01'
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
  const srcA = clamp(alpha * ((color[3] ?? 255) / 255), 0, 1);
  const dstA = rgba[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  rgba[i] = Math.round((color[0] * srcA + rgba[i] * dstA * (1 - srcA)) / outA);
  rgba[i + 1] = Math.round((color[1] * srcA + rgba[i + 1] * dstA * (1 - srcA)) / outA);
  rgba[i + 2] = Math.round((color[2] * srcA + rgba[i + 2] * dstA * (1 - srcA)) / outA);
  rgba[i + 3] = Math.round(outA * 255);
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
  const base = variant === 0 ? [64, 111, 58, 255] : [58, 105, 61, 255];
  fill(rgba, base);
  addBaseNoise(rgba, [48, 88, 54, 255], [94, 130, 70, 255], 8 + variant);

  const patches = variant === 0
    ? [
        [28, 42, 86, 58, [82, 126, 68, 255], 0.12],
        [220, 222, 102, 62, [42, 83, 54, 255], 0.12],
        [236, 52, 68, 78, [88, 128, 72, 255], 0.08],
        [112, 158, 120, 68, [48, 91, 56, 255], 0.1]
      ]
    : [
        [12, 116, 92, 64, [91, 131, 73, 255], 0.1],
        [184, 22, 116, 58, [45, 86, 57, 255], 0.1],
        [224, 164, 92, 78, [93, 132, 73, 255], 0.08],
        [86, 226, 108, 54, [45, 88, 54, 255], 0.08]
      ];

  for (const [x, y, rx, ry, color, alpha] of patches) {
    paintWrappedEllipse(rgba, x, y, rx, ry, color, alpha, 0.42);
  }

  paintBrushStroke(rgba, -24, 180, 88, 146, 12, [120, 153, 84, 255], 0.028);
  paintBrushStroke(rgba, 164, 280, 294, 224, 11, [38, 78, 52, 255], 0.03);

  if (flowers) {
    const flowerDots = [
      [42, 76, [153, 181, 80, 255]],
      [204, 48, [123, 156, 78, 255]],
      [218, 58, [154, 176, 82, 255]],
      [154, 214, [158, 182, 86, 255]]
    ];
    for (const [x, y, color] of flowerDots) {
      paintWrappedEllipse(rgba, x, y, 4.5, 3.5, color, 0.36, 0.5);
      paintWrappedEllipse(rgba, x + 1, y + 1, 1.5, 1.2, [201, 209, 119, 255], 0.22, 0.5);
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
  paintWrappedEllipse(rgba, 22, 128, 88, 184, [37, 70, 45, 255], 0.2, 0.62);
  paintWrappedEllipse(rgba, 232, 128, 82, 184, [39, 72, 46, 255], 0.17, 0.62);
  paintWrappedEllipse(rgba, 126, 18, 164, 48, [47, 80, 50, 255], 0.12, 0.68);
  paintWrappedEllipse(rgba, 128, 238, 164, 54, [50, 84, 52, 255], 0.1, 0.68);

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
    paintBrushStroke(rgba, x0, y0, x1, y1, radius, rootColor, 0.16);
    paintBrushStroke(rgba, x0 + 3, y0 + 2, x1 + 3, y1 + 2, Math.max(2, radius * 0.34), rootLight, 0.08);
  }

  const leafClumps = [
    [52, 56, 30, 16], [202, 74, 34, 18], [38, 184, 34, 18],
    [216, 190, 30, 16], [124, 46, 38, 14], [132, 218, 42, 16]
  ];
  for (const [x, y, rx, ry] of leafClumps) {
    paintWrappedEllipse(rgba, x, y, rx, ry, [111, 143, 78, 255], 0.1, 0.64);
  }
  return rgba;
}

function makeEdgeMossRocks() {
  const rgba = makeGrass({ variant: 0 });
  paintWrappedEllipse(rgba, 28, 126, 90, 176, [48, 84, 58, 255], 0.18, 0.64);
  paintWrappedEllipse(rgba, 226, 132, 88, 176, [48, 84, 58, 255], 0.16, 0.64);
  paintWrappedEllipse(rgba, 128, 8, 158, 42, [55, 91, 59, 255], 0.12, 0.66);
  paintWrappedEllipse(rgba, 128, 248, 150, 40, [54, 90, 58, 255], 0.11, 0.66);

  const rocks = [
    [34, 54, 22, 13],
    [228, 74, 24, 14],
    [30, 164, 28, 16],
    [222, 194, 26, 15],
    [128, 28, 34, 12],
    [132, 226, 36, 13]
  ];
  for (const [x, y, rx, ry] of rocks) {
    paintWrappedEllipse(rgba, x, y, rx, ry, [82, 93, 74, 255], 0.18, 0.54);
    paintWrappedEllipse(rgba, x - 4, y - 3, rx * 0.58, ry * 0.46, [127, 140, 100, 255], 0.1, 0.58);
    paintWrappedEllipse(rgba, x + 6, y + 4, rx * 0.62, ry * 0.42, [50, 64, 53, 255], 0.08, 0.62);
  }

  const moss = [
    [64, 92], [92, 178], [196, 98], [184, 190], [130, 202]
  ];
  for (const [x, y] of moss) {
    paintWrappedEllipse(rgba, x, y, 22, 10, [132, 160, 88, 255], 0.1, 0.64);
  }
  return rgba;
}

function paintLeaf(rgba, cx, cy, angle, length, width, color, alpha = 1) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = length / 2;
  const ry = width / 2;
  const minX = Math.floor(cx - length - 2);
  const maxX = Math.ceil(cx + length + 2);
  const minY = Math.floor(cy - length - 2);
  const maxY = Math.ceil(cy + length + 2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      const d = Math.sqrt((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry));
      if (d > 1) continue;
      const tipFade = clamp(1 - Math.abs(lx / rx) * 0.28, 0, 1);
      const edge = clamp((1 - d) / 0.22, 0, 1) * tipFade;
      setPixel(rgba, x, y, color, alpha * edge);
    }
  }
}

function paintBushCluster(rgba, cx, cy, scale, palette) {
  const shadow = palette.shadow;
  const mid = palette.mid;
  const light = palette.light;
  const lobes = [
    [-52, 16, 50, 38, shadow, 0.88],
    [-22, -18, 58, 44, mid, 0.9],
    [26, -14, 54, 42, shadow, 0.82],
    [56, 18, 46, 36, mid, 0.86],
    [8, 30, 62, 42, shadow, 0.84],
    [-68, -12, 34, 30, mid, 0.72],
    [72, -10, 32, 28, shadow, 0.7]
  ];
  for (const [x, y, rx, ry, color, alpha] of lobes) {
    paintEllipse(rgba, cx + x * scale, cy + y * scale, rx * scale, ry * scale, color, alpha, 0.42);
  }

  const rim = [
    [-78, 6], [-62, -24], [-34, -48], [4, -54], [42, -44],
    [78, -18], [82, 22], [48, 52], [10, 66], [-34, 56], [-70, 34]
  ];
  for (const [x, y] of rim) {
    paintEllipse(rgba, cx + x * scale, cy + y * scale, 15 * scale, 12 * scale, light, 0.32, 0.5);
  }

  const innerMarks = [
    [-30, 2], [18, -18], [42, 14], [-4, 24], [-58, 20], [22, 40]
  ];
  for (const [x, y] of innerMarks) {
    paintEllipse(rgba, cx + x * scale, cy + y * scale, 18 * scale, 8 * scale, light, 0.14, 0.55);
  }
}

function makeBushCluster(kind) {
  const rgba = Buffer.alloc(TILE * TILE * 4);
  const palettes = {
    dark: {
      shadow: [28, 67, 43, 238],
      mid: [43, 88, 50, 236],
      light: [92, 128, 65, 210]
    },
    light: {
      shadow: [52, 91, 47, 230],
      mid: [78, 121, 55, 232],
      light: [136, 163, 78, 210]
    }
  };
  paintBushCluster(rgba, 128, 126, kind === 'light' ? 1.02 : 1.08, palettes[kind]);
  return rgba;
}

function makeLeafSprout() {
  const rgba = Buffer.alloc(TILE * TILE * 4);
  const cx = 128;
  const cy = 158;
  paintEllipse(rgba, cx, cy + 8, 18, 8, [42, 77, 38, 120], 0.35, 0.6);
  const leaves = [
    [-0.92, 34, 15, [94, 145, 55, 230]],
    [-0.42, 42, 16, [111, 157, 63, 236]],
    [0.0, 38, 14, [135, 171, 76, 232]],
    [0.42, 42, 16, [105, 151, 62, 236]],
    [0.92, 34, 15, [85, 136, 55, 230]]
  ];
  for (const [angle, length, width, color] of leaves) {
    paintLeaf(rgba, cx, cy, -Math.PI / 2 + angle, length, width, color, 0.9);
    paintLeaf(rgba, cx + Math.cos(-Math.PI / 2 + angle) * length * 0.15, cy + Math.sin(-Math.PI / 2 + angle) * length * 0.15, -Math.PI / 2 + angle, length * 0.54, width * 0.24, [183, 198, 98, 180], 0.36);
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
  const ids = wanted.length > 0 ? wanted : PROOF_IDS;
  for (const id of ids) {
    if (id === 'grass_base_01') writeTile(id, makeGrass({ variant: 0 }));
    else if (id === 'grass_base_02') writeTile(id, makeGrass({ variant: 1 }));
    else if (id === 'grass_flowers_01') writeTile(id, makeGrass({ variant: 1, flowers: true }));
    else if (id === 'path_dirt_straight') writeTile(id, makeHorizontalPath());
    else if (id === 'path_spore_glow') writeTile(id, makeHorizontalPath({ glow: true }));
    else if (id === 'path_destination_row') writeTile(id, makeDestinationPath());
    else if (id === 'edge_roots_01') writeTile(id, makeEdgeRoots());
    else if (id === 'edge_moss_rocks_01') writeTile(id, makeEdgeMossRocks());
    else if (id === 'bush_cluster_dark_01') writeTile(id, makeBushCluster('dark'));
    else if (id === 'bush_cluster_light_01') writeTile(id, makeBushCluster('light'));
    else if (id === 'leaf_sprout_01') writeTile(id, makeLeafSprout());
    else throw new Error(`Unknown proof tile id "${id}". Supported: ${PROOF_IDS.join(', ')}`);
  }
  fs.writeFileSync(
    path.join(outputDir, 'placeholder-manifest.json'),
    `${JSON.stringify({
      status: 'placeholder',
      productionEligible: false,
      generatedIds: ids,
      outputRoot: path.relative(repoRoot, outputDir)
    }, null, 2)}\n`
  );
  console.log('placeholder-only output: never promote these files as approved production art');
}

main();
