#!/usr/bin/env node
/**
 * Print the preferred path-family imagegen prompt.
 *
 * This is intentionally one prompt for one shared path source. The producer
 * crops the west end, straight, glow, east end, and destination landing from
 * that source so the family shares camera, palette, brushwork, and path band.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const STYLE_ANCHOR_PATH = path.join(sharedDir, 'home-field-style-anchor.json');
const PROMPT_MARKER = 'Use the imagegen skill to create a candidate game home-field bitmap; do not approve or overwrite app assets.';
const FAMILY_IDS = ['path_h_end_w', 'path_dirt_straight', 'path_spore_glow', 'path_h_end_e', 'path_destination_row'];
const IDS = FAMILY_IDS.join(',');
const candidateRoot = '.agent/home-field-workspace/candidates/terrain-family/latest';

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
  console.log('# Home Field — Path Family Imagegen Prompt');
  console.log('');
  console.log(`Workspace root: ${repoRoot}`);
  console.log('Generation mode: shared path-family source');
  console.log(`Emits one imagegen prompt and one producer command for: ${IDS}`);
  console.log('');
  console.log('Save the raw imagegen output exactly here:');
  console.log('  .agent/home-field-workspace/raw/path_family_strip.source.png');
  console.log('');
  console.log('After saving the raw source, run:');
  console.log('  npm run game:home-field:produce-path-family-candidate');
  console.log('');
  console.log('Then run the family-level proof commands:');
  console.log(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${IDS} --check-files --check-connectors --check-review`);
  console.log(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${IDS} --check-files --check-edge-profiles --check-family-cohesion`);
  console.log(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:sheet`);
  console.log(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:adjacency`);
  console.log(`  HOME_FIELD_CANDIDATE_ROOT=${candidateRoot} HOME_FIELD_CANDIDATE_IDS=${IDS} npm run game:home-field:candidate-evidence`);
  console.log(`  HOME_FIELD_CANDIDATE_ROOT=${candidateRoot} HOME_FIELD_CANDIDATE_IDS=${IDS} npm run game:home-field:terrain-candidate-preview`);
  console.log('  npm run game:home-field:combined-candidate-preview');
  console.log('Do not overwrite web/public/home-field/terrain/ until explicit human approval. Candidate preview screenshots use Playwright route interception and are safe before promotion.');
  console.log('');
  console.log('---');
  console.log(PROMPT_MARKER);
  console.log('');
  console.log('## Subject');
  console.log('One large production-quality candidate 2D top-down path-family source image for a reusable game-hub terrain tileset.');
  console.log('');
  console.log('## Required output');
  console.log('Create one continuous wide top-down meadow/path source, ideally 1792x768 or larger. This is NOT a final map screenshot and NOT five separate tile images. It is one shared source used to crop five coordinated 256x256 terrain cells. Use the same elevated top-down 2.5D camera, lighting, palette, brush scale, dirt color, grass value range, and texture density across the whole source.');
  console.log('');
  console.log('## Layout the producer expects');
  console.log('Upper-middle band: a single horizontal path sequence across the source: grass guard | west path end fade | straight dirt path | soft spore-glow path variant | east path end fade | grass guard. The dirt band must stay centered at the same Y position and visual width across all path crops.');
  console.log('Lower-middle area: one isolated destination landing patch in the same grass/dirt style. It should have grass-compatible edges on all four sides and must not look like a path connector row.');
  console.log('');
  console.log('## Tile outputs cropped from this one source');
  console.log('- path_h_end_w: west grass-to-path end fade, open path connector on east edge only.');
  console.log('- path_dirt_straight: same horizontal dirt band, connector on west/east edges.');
  console.log('- path_spore_glow: same horizontal dirt band with a restrained amber guide accent, connector on west/east edges.');
  console.log('- path_h_end_e: east path-to-grass end fade, open path connector on west edge only.');
  console.log('- path_destination_row: isolated grass-compatible destination landing patch, no connector-row read.');
  console.log('');
  console.log('## Home Field scale contract');
  console.log('Runtime terrain tiles are 256x256 cells in a 1792x1024 map. Terrain is the stage for 64px chibis and 32-96px object-layer props, so dirt texture, glow, cracks, pebbles, and grass marks must stay broad, sparse, and lower-contrast than characters and props. Do not change zoom level between crop zones.');
  console.log('');
  console.log('## Hard constraints');
  console.log('- No characters, props, mushrooms, signs, exits, horizon, sky, UI, text, vignette, or focal object.');
  console.log('- No five independent square tiles, no visible panel borders, no pasted strips, no different renderers between sections, no strong center symbols, no realistic soil texture, no dense pebbles, no spotlight glow.');
  console.log('- The path band must align visually across west-end, straight, glow, and east-end crops. If one crop has a different dirt color, brush density, Y position, width, camera, or lighting, regenerate the shared source.');
  console.log('- The destination landing must share the same grass/dirt palette but remain grass-compatible on every edge.');
  console.log('- The cropped tiles must blend with the current Home Field grass in mobile and desktop clean previews. If the candidate appears as visible square patches pasted onto the field, it fails even when validators pass.');
  console.log('');
  console.log(styleAnchorBlock(anchor));
  console.log('');
  console.log('## Save and report');
  console.log('Save only one raw PNG to .agent/home-field-workspace/raw/path_family_strip.source.png. Do not save separate per-tile raw PNGs for this path run.');
  console.log('Final response must include these clickable Markdown links, not backticked paths:');
  console.log(`Candidate folder: [open in Finder](${repoRoot}/.agent/home-field-workspace/candidates/terrain-family/latest)`);
  console.log(`Candidate evidence: [manifest](${repoRoot}/.agent/home-field-workspace/review/candidate-evidence.manifest.json)`);
  console.log(`Adjacency sheet: [adjacency sheet](${repoRoot}/.agent/home-field-workspace/review/adjacency-sheet.png)`);
  console.log(`Candidate field mobile: [mobile field screenshot](${repoRoot}/.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png)`);
  console.log(`Candidate field desktop: [desktop field screenshot](${repoRoot}/.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png)`);
  console.log('Visual Critic must wait for final evidence for the latest raw hash before editing review rows. Do not mark cleanPreviewCheck pass if square tile boundaries are visible.');
}

main();
