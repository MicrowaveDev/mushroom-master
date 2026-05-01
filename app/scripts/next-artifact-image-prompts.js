import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifacts } from '../server/game-data.js';
import { getBagShape } from '../shared/bag-shape.js';
import { artifactVisualClassification } from '../shared/artifact-visual-classification.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const todoPath = path.join(repoRoot, 'docs', 'artifact-bitmap-todolist.md');
const styleGuidePath = 'docs/artifact-image-style-prompt.md';

export function parseLimit(argv) {
  const value = argv.find((arg) => arg.startsWith('--limit='));
  if (!value) return 10;
  const limit = Number(value.slice('--limit='.length));
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
}

export function parseArtifactDescriptions(markdown) {
  const descriptions = new Map();
  const itemRe = /^- \[[ x]\] `([^`]+)\.png` - `([^`]+)`, ([^.]+)\. (.+)$/gm;
  let match;
  while ((match = itemRe.exec(markdown))) {
    descriptions.set(match[2], {
      imageName: `${match[1]}.png`,
      footprint: match[3].trim(),
      description: match[4].trim()
    });
  }
  return descriptions;
}

export function footprintForArtifact(artifact) {
  if (artifact.family === 'bag' && artifact.shape) {
    const shape = getBagShape(artifact, 0);
    const mask = shape.map((row) => row.map((cell) => (cell ? 'X' : '.')).join(' ')).join('\n');
    return `${shape[0]?.length || artifact.width}x${shape.length} mask:\n${mask}`;
  }
  return `${artifact.width}x${artifact.height}`;
}

export function familyLanguage(family) {
  switch (family) {
    case 'damage':
      return 'amber, orange, red, burnt sienna, dark contour, compact cap/head/guard mass, simple sharp silhouette';
    case 'armor':
      return 'moss green, bark green, muted stone, cream, rounded protective mass, broad flat planes, at most two grain marks';
    case 'stun':
      return 'yellow-green, pale gold, electric olive, smoky cream, contained glow marks, simple spore beads';
    case 'bag':
      return 'stitched textile, bark, leather, moss cloth, mycelium fiber, clean container silhouette, simple patch/stitch accents';
    default:
      return 'mushroom-fantasy charm language with warm parchment colors';
  }
}

export function shapeRule(artifact) {
  const width = Number(artifact.width) || 1;
  const height = Number(artifact.height) || 1;
  if (artifact.family === 'bag' && artifact.shape) {
    return 'irregular bag mask: design one continuous container whose main mass follows the occupied cells; mild organic visual overhang across empty mask cells is acceptable, but no straight rectangular cutouts';
  }
  if (width === 1 && height === 1) {
    return '1x1: one centered compact symbol filling about 72-88% of the cell on both axes; visible silhouette should cover at least 28% of the canvas; no skinny diagonal line or tiny centered prop';
  }
  if (width > height && height === 1) {
    return `${width}x1 horizontal: strictly left-to-right object, filling 82-94% of the canvas width; every cell contains a connected part of the same object; no tall central blob, no strong diagonal`;
  }
  if (height > width && width === 1) {
    return `1x${height} vertical: strictly top-to-bottom object, filling 82-94% of the canvas height and 70-88% of the canvas width; every cell contains a visible continuation of the same object`;
  }
  return `${width}x${height} block: one centered blocky object filling all quadrants evenly, with meaningful content in every occupied cell`;
}

export function promptForArtifact(artifact, spec) {
  const outputPath = `web/public/artifacts/${artifact.id}.png`;
  const size = footprintForArtifact(artifact);
  const description = spec?.description || `${artifact.name.en} artifact, ${size}.`;
  const imageName = spec?.imageName || `${artifact.id}.png`;
  const visual = artifactVisualClassification(artifact);
  const approvedExamples = [
    'web/public/artifacts/ferment_phial.png',
    'web/public/artifacts/flash_cap.png',
    'web/public/artifacts/kirt_venom_fang.png',
    'web/public/artifacts/settling_guard.png',
    'web/public/artifacts/spore_lash.png',
    'web/public/artifacts/spore_needle.png'
  ].join(', ');

  return `### ${artifact.name.en} / ${artifact.name.ru}

- id: \`${artifact.id}\`
- image: \`${imageName}\`
- output: \`${outputPath}\`
- footprint: ${spec?.footprint || size}
- family: ${artifact.family}
- visual class: ${visual.role.label} / ${visual.role.hue}
- shine tier: ${visual.shine.label} (${visual.shine.id})
- description: ${description}

\`\`\`text
Use the imagegen skill to create a production game artifact bitmap.
Use ${styleGuidePath} as the style guide. Follow it exactly: simple chunky small inventory sticker matching these approved local examples: ${approvedExamples}. Use thick dark contour, flat cel-shaded color regions, one or two large highlight/accent shapes, high contrast, strict footprint direction, and a flat #ff00ff chroma-key background.

Asset: ${artifact.name.en} / ${artifact.name.ru} (${artifact.id})
Output file after approval: ${outputPath}
Footprint: ${size}
Description: ${description}
Shape rule: ${shapeRule(artifact)}

Style: simple readable fantasy inventory sticker for tiny UI cells. Prefer flat cel shading over painting. Use a thick dark brown/black contour, 2-4 main colors, broad color blocks, sparse dark internal lines, and simple cream/pale highlight blobs. The approved examples are chunky, saturated, emblem-like, and low-detail; match that simplicity more than realistic materials or generic RPG loot art. Family visual language: ${familyLanguage(artifact.family)}.

Visual classification: ${visual.prompt} The class color must be obvious at a glance, while the shine tier communicates coolness/specialness. Keep shine inside the object silhouette; do not use loose particles or a baked cast shadow.

Composition: one complete connected placement image across the whole footprint, rendered once above the inventory grid cells like Backpack Battles. Multi-cell artifacts must fill 82-94% of the main axis and each occupied cell must contain a meaningful continuation of the same object. For 1x1 artifacts, fill 72-88% of both axes and keep visible silhouette coverage above 28% of the canvas. Do not draw separate repeated icons per cell, do not leave a mostly empty cell, and do not make skinny diagonal-stick props floating in empty space.

Small icon requirement: readable at 48-64px per cell on pale rounded inventory cells. Clear outside contour first, internal decoration second. No generic RPG item icon style, no glossy loot-icon rendering, no shiny gold bevels, no photorealism, no airbrushed material, no realistic bark/soil/stone/leather texture, no grit, no scratchy edge noise, no dense bubbles, no fine cracks or fibers, no noisy halo, no construction lines, no paper texture.

Background: perfectly flat solid #ff00ff chroma-key background for removal. No shadows, gradients, texture, floor plane, frames, grid lines, cell borders, text, letters, or watermark. Do not use #ff00ff inside the artifact. Do not bake a cast shadow or outer glow into the object because the UI already adds a CSS drop shadow.

For irregular bag masks, the shape mask is a placement rule, not a clipping stencil. Keep the object visually continuous and organic; do not carve rectangular transparent holes into the art. Empty mask cells may stay chroma-key when the generated silhouette naturally leaves them empty, but small curved overhang is preferred over broken cutouts.
\`\`\``;
}

export function artifactTodoDescriptions() {
  return parseArtifactDescriptions(fs.readFileSync(todoPath, 'utf8'));
}

function main() {
  const limit = parseLimit(process.argv.slice(2));
  const descriptions = artifactTodoDescriptions();

  const missing = artifacts
    .filter((artifact) => !artifact.isCharacter)
    .filter((artifact) => !fs.existsSync(path.join(artifactDir, `${artifact.id}.png`)))
    .slice(0, limit);

  if (!missing.length) {
    console.log('All artifact production PNGs exist in web/public/artifacts/.');
    process.exit(0);
  }

  console.log(`# Next ${missing.length} Artifact Images To Generate\n`);
  console.log(`Source list: docs/artifact-bitmap-todolist.md`);
  console.log(`Style guide: ${styleGuidePath}`);
  console.log(`Skip rule: an artifact is skipped once web/public/artifacts/{artifact_id}.png exists.\n`);
  console.log(missing.map((artifact) => promptForArtifact(artifact, descriptions.get(artifact.id))).join('\n\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
