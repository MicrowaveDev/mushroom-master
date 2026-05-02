import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeasonImageEntries, repoRoot } from './season-sheet-helpers.js';

const todoPath = path.join(repoRoot, 'docs', 'season-image-todolist.md');
const styleGuidePath = 'docs/season-image-style-prompt.md';

const PROMPT_MARKER = 'Use the imagegen skill to create a production game season bitmap.';

function parseLimit(argv) {
  const value = argv.find((arg) => arg.startsWith('--limit='));
  if (!value) return 10;
  const limit = Number(value.slice('--limit='.length));
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
}

export function parseSeasonDescriptions(markdown) {
  const descriptions = new Map();
  const itemRe = /^- \[[ x]\] `([^`]+)\.png` - `([^`]+)`, ([^.]+)\. (.+)$/gm;
  let match;
  while ((match = itemRe.exec(markdown))) {
    const id = match[2];
    descriptions.set(id, {
      imageName: `${match[1]}.png`,
      kindLabel: match[3].trim(),
      description: match[4].trim()
    });
  }
  return descriptions;
}

export function seasonTodoDescriptions() {
  if (!fs.existsSync(todoPath)) return new Map();
  return parseSeasonDescriptions(fs.readFileSync(todoPath, 'utf8'));
}

function paletteLanguage(entry) {
  if (entry.kind === 'rank') {
    switch (entry.rankId) {
      case 'bronze': return 'warm copper, burnt amber, dark brown contour, cream highlight';
      case 'silver': return 'cool steel grey, pale platinum, deep slate contour, white highlight';
      case 'gold':   return 'rich gold, warm amber, dark walnut contour, ivory shine';
      case 'diamond':return 'cool teal, pale cyan, deep navy contour, icy white shine';
      default: return 'mushroom-fantasy emblem palette';
    }
  }
  if (entry.type === 'season') {
    switch (entry.accent) {
      case 'bronze': return 'warm copper accent on a parchment medallion';
      case 'silver': return 'cool steel accent on a parchment medallion';
      case 'gold':   return 'gold accent on a parchment medallion';
      case 'diamond':return 'teal/cyan accent on a parchment medallion';
      default: return 'parchment medallion with neutral accent';
    }
  }
  if (entry.type === 'character') {
    return `${entry.characterId} character accent (mushroom-themed) on a parchment medallion`;
  }
  return 'moss-green / parchment palette with one warm accent';
}

export function promptForSeasonEntry(entry, spec) {
  const outputPath = path.relative(repoRoot, entry.outputPath);
  const imageName = spec?.imageName || entry.outputFileName;
  const description = spec?.description
    || (entry.lore?.en || entry.name?.en || entry.id);
  const approvedExamples = [
    'web/public/artifacts/ferment_phial.png',
    'web/public/artifacts/spore_lash.png',
    'web/public/artifacts/spore_needle.png',
    'web/public/artifacts/flash_cap.png'
  ].join(', ');

  const headerName = entry.kind === 'rank'
    ? `${entry.name?.en || entry.rankId} rank`
    : `${entry.name?.en || entry.achievementId}${entry.characterId ? ` (${entry.characterId})` : ''}`;

  return `### ${headerName}

- id: \`${entry.id}\`
- image: \`${imageName}\`
- output: \`${outputPath}\`
- size: 192x192 (square)
- kind: ${entry.kind}${entry.characterId ? ` / ${entry.characterId}` : ''}
- type: ${entry.type}
- accent: ${entry.accent}
- name (ru / en): ${entry.name?.ru || ''} / ${entry.name?.en || ''}
- lore: ${entry.lore?.en || ''}
- description: ${description}

\`\`\`text
${PROMPT_MARKER}
Use ${styleGuidePath} as the style guide. Follow it exactly: simple chunky inventory-sticker emblem matching the artifact direction in these approved examples: ${approvedExamples}. Use thick dark contour, flat cel-shaded color regions, one or two large highlight/accent shapes, high contrast, and a flat #ff00ff chroma-key background.

Asset: ${headerName} (${entry.id})
Output file after approval: ${outputPath}
Canvas: 192x192 square, transparent after chroma-key removal
Description: ${description}

Composition rule: one centered medallion-style emblem filling 70-86% of the canvas on both axes; leave a comfortable transparent margin around all four edges (no visible alpha within ~6 px of the edge). Subject reads as a single rounded badge object with one or two readable inner glyphs (mushroom motif, ring, star, gem, leaf, fang — pick from the kind / lore). Avoid loose text, avoid skinny diagonal-stick props, avoid generic RPG loot.

Palette guidance: ${paletteLanguage(entry)}.

Style: simple readable fantasy inventory sticker for tiny UI cells. Prefer flat cel shading over painting. Use a thick dark brown/black contour, 2-4 main colors, broad color blocks, sparse dark internal lines, and simple cream/pale highlight blobs. Match the approved artifact examples in chunkiness and saturation.

Background: perfectly flat solid #ff00ff chroma-key background for removal. No shadows, gradients, texture, floor plane, frames, grid lines, cell borders, text, letters, or watermark. Do not use #ff00ff inside the emblem. Do not bake a cast shadow or outer glow into the object — the UI adds its own drop shadow.
\`\`\``;
}

function main() {
  const limit = parseLimit(process.argv.slice(2));
  const descriptions = seasonTodoDescriptions();

  const missing = buildSeasonImageEntries()
    .filter((entry) => !fs.existsSync(entry.outputPath))
    .slice(0, limit);

  if (!missing.length) {
    console.log('All season production PNGs exist (ranks + achievements).');
    process.exit(0);
  }

  console.log(`# Next ${missing.length} Season Images To Generate\n`);
  console.log(`Source list: docs/season-image-todolist.md`);
  console.log(`Style guide: ${styleGuidePath}`);
  console.log(`Skip rule: an entry is skipped once its target PNG exists.\n`);
  console.log(missing.map((entry) => promptForSeasonEntry(entry, descriptions.get(entry.kind === 'rank' ? entry.rankId : entry.achievementId))).join('\n\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export { PROMPT_MARKER };
