import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifacts } from '../server/game-data.js';
import { getBagShape } from '../shared/bag-shape.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const todoPath = path.join(repoRoot, 'docs', 'artifact-bitmap-todolist.md');
const styleGuidePath = 'docs/artifact-image-style-prompt.md';

function parseLimit(argv) {
  const value = argv.find((arg) => arg.startsWith('--limit='));
  if (!value) return 10;
  const limit = Number(value.slice('--limit='.length));
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
}

function parseDescriptions(markdown) {
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

function footprintForArtifact(artifact) {
  if (artifact.family === 'bag' && artifact.shape) {
    const shape = getBagShape(artifact, 0);
    const mask = shape.map((row) => row.map((cell) => (cell ? 'X' : '.')).join(' ')).join('\n');
    return `${shape[0]?.length || artifact.width}x${shape.length} mask:\n${mask}`;
  }
  return `${artifact.width}x${artifact.height}`;
}

function familyLanguage(family) {
  switch (family) {
    case 'damage':
      return 'amber, orange, burnt sienna, chitin, lacquered mushroom shell, sharp diagonals';
    case 'armor':
      return 'moss green, bark green, muted stone, cream, rounded protective mass';
    case 'stun':
      return 'yellow-green, pale gold, electric olive, smoky cream, glowing spores and static';
    case 'bag':
      return 'stitched textile, bark, leather, moss cloth, mycelium fiber, decorative container language';
    default:
      return 'mushroom-fantasy charm language with warm parchment colors';
  }
}

function shapeRule(artifact) {
  const width = Number(artifact.width) || 1;
  const height = Number(artifact.height) || 1;
  if (artifact.family === 'bag' && artifact.shape) {
    return 'irregular bag mask: design the container to exactly follow the occupied cells; empty mask cells must be only chroma-key background';
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

function promptForArtifact(artifact, spec) {
  const outputPath = `web/public/artifacts/${artifact.id}.png`;
  const size = footprintForArtifact(artifact);
  const description = spec?.description || `${artifact.name.en} artifact, ${size}.`;
  const imageName = spec?.imageName || `${artifact.id}.png`;

  return `### ${artifact.name.en} / ${artifact.name.ru}

- id: \`${artifact.id}\`
- image: \`${imageName}\`
- output: \`${outputPath}\`
- footprint: ${spec?.footprint || size}
- family: ${artifact.family}
- description: ${description}

\`\`\`text
Use the imagegen skill to create a production game artifact bitmap.
Use ${styleGuidePath} as the style guide. Follow it exactly: simple small inventory icon matching data/channel/assets/ornaments/top-right-mushroom.jpg and data/channel/assets/ornaments/bottom-left-mushroom.svg. Use thick dark contour, flat or softly graded vector color regions, simple highlight shapes, sparse dark internal lines, high contrast, strict footprint direction, and a flat #ff00ff chroma-key background.

Asset: ${artifact.name.en} / ${artifact.name.ru} (${artifact.id})
Output file after approval: ${outputPath}
Footprint: ${size}
Description: ${description}
Shape rule: ${shapeRule(artifact)}

Style: simple readable fantasy inventory icon matching the two PDF mushroom ornament references. Borrow the bold thick-contour red amanita language from top-right-mushroom.jpg and the rounded blue/cream soft-gradient language from bottom-left-mushroom.svg. Use thick dark brown/black contour, flat or softly graded vector-like color planes, sparse dark internal lines, simple cream/pale highlight blobs, 2-5 main colors, minimal internal detail. Family visual language: ${familyLanguage(artifact.family)}.

Composition: one complete connected placement image across the whole footprint, rendered once above the inventory grid cells like Backpack Battles. Multi-cell artifacts must fill 82-94% of the main axis and each occupied cell must contain a meaningful continuation of the same object. For 1x1 artifacts, fill 72-88% of both axes and keep visible silhouette coverage above 28% of the canvas. Do not draw separate repeated icons per cell, do not leave a mostly empty cell, and do not make skinny diagonal-stick props floating in empty space.

Small icon requirement: readable at 48-64px per cell. Use a simple silhouette, high contrast, and very few details. No generic RPG item icon style, no glossy loot-icon rendering, no shiny gold bevels, no photorealism, no airbrushed material, no sketch scratches, no noisy halo, no construction lines, no paper texture.

Background: perfectly flat solid #ff00ff chroma-key background for removal. No shadows, gradients, texture, floor plane, frames, grid lines, cell borders, text, letters, or watermark. Do not use #ff00ff inside the artifact.

For irregular bag masks, occupied cells contain the connected artifact and empty mask cells contain only #ff00ff so they become transparent after background removal.
\`\`\``;
}

const limit = parseLimit(process.argv.slice(2));
const markdown = fs.readFileSync(todoPath, 'utf8');
const descriptions = parseDescriptions(markdown);

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
