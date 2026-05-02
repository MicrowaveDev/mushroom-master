import fs from 'node:fs';
import path from 'node:path';
import { artifacts } from '../server/game-data.js';
import { repoRoot, escapeHtml } from './lib/bitmap-image-toolkit.js';

export { repoRoot, escapeHtml };
export const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');

export const artifactSectionOrder = [
  'Damage',
  'Armor',
  'Stun',
  'Character Artifacts',
  'Signature Starters',
  'Bags',
  'Utility'
];

export function sectionForArtifact(artifact) {
  if (artifact.family === 'bag') return 'Bags';
  if (artifact.starterOnly) return 'Signature Starters';
  if (artifact.characterItem) return 'Character Artifacts';
  if (artifact.family === 'damage') return 'Damage';
  if (artifact.family === 'armor') return 'Armor';
  if (artifact.family === 'stun') return 'Stun';
  return 'Utility';
}

export function compareArtifacts(a, b) {
  return a.id.localeCompare(b.id, 'en');
}

export function buildArtifactSections({ includeCharacters = false } = {}) {
  const sections = new Map(artifactSectionOrder.map((section) => [section, []]));
  for (const artifact of artifacts.filter((item) => includeCharacters || !item.isCharacter)) {
    const section = sectionForArtifact(artifact);
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(artifact);
  }
  for (const items of sections.values()) {
    items.sort(compareArtifacts);
  }
  return Array.from(sections.entries()).filter(([, items]) => items.length);
}

export function artifactImagePath(artifact) {
  return path.join(artifactDir, `${artifact.id}.png`);
}

export function artifactImageDataUrl(artifact) {
  const imagePath = artifactImagePath(artifact);
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Missing artifact image: ${path.relative(repoRoot, imagePath)}`);
  }
  return `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;
}

export function artifactFootprintLabel(artifact) {
  return artifact.shape
    ? `${artifact.shape[0]?.length || artifact.width}x${artifact.shape.length}`
    : `${artifact.width}x${artifact.height}`;
}
