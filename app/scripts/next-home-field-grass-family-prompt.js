#!/usr/bin/env node
/**
 * Print the preferred grass-family imagegen prompt.
 *
 * This is intentionally one prompt for one shared meadow source. The producer
 * crops grass_base_01, grass_base_02, and grass_flowers_01 from that source so
 * the family shares lighting, brushwork, and value range.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const STYLE_ANCHOR_PATH = path.join(sharedDir, 'home-field-style-anchor.json');
const PROMPT_MARKER = 'Use the imagegen skill to create a production game home-field bitmap.';

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function styleAnchorBlock(anchor) {
  const s = anchor.style;
  const rej = anchor.rejections.map((r) => `- ${r}`).join('\n');
  return [
    '## Style anchor',
    `World: ${s.world}`,
    `Palette: primary=${s.palette.primary}; accents=${s.palette.accents}; shadows=${s.palette.shadows}`,
    `Lighting: ${s.lighting}`,
    `Outline: ${s.outline}`,
    `Shape language: ${s.shapeLanguage}`,
    `Texture/rendering: ${s.texture}`,
    `Terrain reference: ${s.terrainReference}`,
    `Production bar: ${s.productionBar}`,
    `Scene fit: ${s.sceneFit}`,
    `Chibi fit: ${s.chibiFit}`,
    `Shadow style: ${s.shadowStyle}`,
    `Ambient: ${s.ambient}`,
    `Scale and camera: ${s.scale}`,
    '',
    'Hard rejections:',
    rej
  ].join('\n');
}

function main() {
  const anchor = loadJson(STYLE_ANCHOR_PATH);
  console.log('# Home Field — Grass Family Imagegen Prompt');
  console.log('');
  console.log(`Workspace root: ${repoRoot}`);
  console.log('Generation mode: shared grass-family meadow source');
  console.log('Emits one imagegen prompt and one producer command for: grass_base_01, grass_base_02, grass_flowers_01');
  console.log('');
  console.log('Save the raw imagegen output exactly here:');
  console.log('  .agent/home-field-workspace/raw/grass_family_meadow.source.png');
  console.log('');
  console.log('After saving the raw source, run:');
  console.log('  npm run game:home-field:produce-grass-family');
  console.log('If the focused sheet or clean preview still shows blocky value transitions, rerun the same raw source with at most these fallbacks before review:');
  console.log('  npm run game:home-field:produce-grass-family -- --plan=lower-band');
  console.log('  npm run game:home-field:produce-grass-family -- --plan=upper-band');
  console.log('');
  console.log('Then run:');
  console.log('  npm run game:home-field:validate -- --check-files --check-connectors --check-review');
  console.log('  npm run game:home-field:sheet');
  console.log('  npm run game:home-field:grass-family-sheet');
  console.log('  npm run game:home-field:adjacency');
  console.log('  npx playwright test --config=tests/game/playwright.config.js tests/game/home-field-preview.spec.js --reporter=line');
  console.log('');
  console.log('---');
  console.log(PROMPT_MARKER);
  console.log('');
  console.log('## Subject');
  console.log('One large production-quality 2D top-down meadow source image for a reusable game-hub grass tile family.');
  console.log('');
  console.log('## Required output');
  console.log('Create one continuous 3x2 or 4x3 dark-green meadow patch, at least 1024x768 if the tool allows. This is NOT a final map screenshot and NOT three separate tiles. It is one shared source used to crop three coordinated 256x256 grass tiles.');
  console.log('');
  console.log('## Composition');
  console.log('The whole image should be a quiet walkable ground plane: broad muted moss-green and fungal-teal color fields, soft low-contrast moss shadows, sparse hand-drawn grass strokes, and a few tiny yellow-green flecks. Keep most of the field open so 64px chibi feet and compact blob shadows stay readable.');
  console.log('');
  console.log('## Crop zones the producer will use');
  console.log('- Center-left quiet area -> grass_base_01');
  console.log('- Center-right quiet area with the same value range -> grass_base_02');
  console.log('- Nearby lower-center sparse accent area -> grass_flowers_01');
  console.log('');
  console.log('Make these regions feel like parts of the same meadow. Do not create separate lighting pools, borders, columns, square cells, diagonal bands, or different texture styles in each region.');
  console.log('');
  console.log('## Hard constraints');
  console.log('- No paths, props, mushrooms, characters, signs, exits, horizon, sky, UI, text, vignette, or focal object.');
  console.log('- No dense grass texture, realistic grass blades, clover carpet, repeated stamp clusters, visible rows/columns, diagonal mottling, checkerboard distribution, or hard value bands.');
  console.log('- The source should look calm and slightly boring alone, but cohesive when the three crops are tiled together.');
  console.log('- Flowers must be tiny and sparse; object-layer props carry most foliage personality later.');
  console.log('');
  console.log(styleAnchorBlock(anchor));
  console.log('');
  console.log('## Save and report');
  console.log('Save only one raw PNG to .agent/home-field-workspace/raw/grass_family_meadow.source.png. Do not save separate per-tile raw PNGs for this grass run.');
}

main();
