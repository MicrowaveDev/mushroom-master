import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.js';

export const HOME_FIELD_FAMILIES = Object.freeze({
  grass: {
    ids: ['grass_base_01', 'grass_base_02', 'grass_flowers_01'],
    sourcePath: '.agent/home-field-workspace/raw/grass_family_meadow.source.png',
    candidateRoot: '.agent/home-field-workspace/candidates/grass-family/latest',
    promptModule: './family-prompts/grass.js',
    producerModule: '../../scripts/lib/home-field-grass-family-production.js'
  },
  path: {
    ids: ['path_h_end_w', 'path_dirt_straight', 'path_spore_glow', 'path_h_end_e', 'path_destination_row'],
    sourcePath: '.agent/home-field-workspace/raw/path_family_strip.source.png',
    candidateRoot: '.agent/home-field-workspace/candidates/terrain-family/latest',
    promptModule: './family-prompts/path.js',
    producerModule: '../../scripts/lib/home-field-path-family-production.js'
  }
});

export function requireHomeFieldFamily(name) {
  const family = HOME_FIELD_FAMILIES[name];
  if (!family) throw new Error(`Unknown Home Field family "${name}". Expected: ${Object.keys(HOME_FIELD_FAMILIES).join(', ')}`);
  return family;
}

export function loadHomeFieldStyleAnchor() {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'app/shared/home-field/home-field-style-anchor.json'), 'utf8'));
}

export function formatHomeFieldStyleAnchor(anchor) {
  const style = anchor.style;
  return [
    '## Style anchor',
    `World: ${style.world}`,
    `Palette: primary=${style.palette.primary}; accents=${style.palette.accents}; shadows=${style.palette.shadows}`,
    `Lighting: ${style.lighting}`,
    `Outline: ${style.outline}`,
    `Shape language: ${style.shapeLanguage}`,
    `Texture/rendering: ${style.texture}`,
    `Terrain reference: ${style.terrainReference}`,
    `Production bar: ${style.productionBar}`,
    `Scene fit: ${style.sceneFit}`,
    `Chibi fit: ${style.chibiFit}`,
    `Shadow style: ${style.shadowStyle}`,
    `Ambient: ${style.ambient}`,
    `Scale and camera: ${style.scale}`,
    '',
    'Hard rejections:',
    anchor.rejections.map((rejection) => `- ${rejection}`).join('\n')
  ].join('\n');
}
