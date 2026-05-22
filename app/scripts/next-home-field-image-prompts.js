#!/usr/bin/env node
/**
 * Prompt queue for the Home Field hub imagegen pipeline.
 *
 * Reads app/shared/home-field/home-field-assets.json plus prompts and style anchor,
 * filters to missing assets, and prints ready-to-feed prompts for an imagegen agent
 * (e.g. Codex driving the imagegen skill).
 *
 * Args:
 *   --limit=N         max prompts to emit (default 5)
 *   --all             emit every missing prompt regardless of limit
 *   --type=<t>        comma-separated filter: terrain|prop|exit|character|effect
 *   --id=<a,b,c>      comma-separated asset id filter
 *   --batch=<name>    predefined batch (proof-static | proof-animated | proof-character | full)
 *   --include-existing  also emit prompts for assets whose outputPath already exists
 *
 * Mirrors the artifact and season-image pipelines (next-artifact-image-prompts.js,
 * next-season-image-prompts.js). The PROMPT_MARKER line is the recognised handshake
 * for the imagegen skill.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');

const ASSETS_PATH = path.join(sharedDir, 'home-field-assets.json');
const PROMPTS_PATH = path.join(sharedDir, 'home-field-prompts.json');
const STYLE_ANCHOR_PATH = path.join(sharedDir, 'home-field-style-anchor.json');

const PROMPT_MARKER = 'Use the imagegen skill to create a production game home-field bitmap.';

const BATCHES = {
  'proof-static': [
    'grass_base_01',
    'grass_base_02',
    'path_destination_row',
    'mushroom_cluster_small_amber',
    'mycelium_lantern_amber',
    'arena_mushroom_arch',
    'journey_gate_under_construction'
  ],
  'proof-animated': [
    'spore_motes_loop',
    'tap_ripple'
  ],
  'proof-character': ['_placeholder'],
  // 'full' is the union of every queue; treated as no filter at all
  full: null
};

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function parseListFlag(argv, name) {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.slice(name.length + 3).split(',').map((s) => s.trim()).filter(Boolean);
}

function parseLimit(argv) {
  const arg = argv.find((a) => a.startsWith('--limit='));
  if (!arg) return 5;
  const n = Number(arg.slice('--limit='.length));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function styleAnchorBlock(anchor) {
  const s = anchor.style;
  const rej = anchor.rejections.map((r) => `- ${r}`).join('\n');
  return [
    '## Style anchor (apply to every prompt)',
    `World: ${s.world}`,
    `Palette: primary=${s.palette.primary}; accents=${s.palette.accents}; shadows=${s.palette.shadows}`,
    `Lighting: ${s.lighting}`,
    `Outline: ${s.outline}`,
    `Shadow style: ${s.shadowStyle}`,
    `Ambient: ${s.ambient}`,
    `Scale and camera: ${s.scale}`,
    '',
    'Hard rejections:',
    rej
  ].join('\n');
}

function formatAssetPrompt({ asset, promptEntry, anchor, idx, total }) {
  const lines = [];
  lines.push(`\n=== [${idx}/${total}] ${asset.id} (${asset.type}) ===`);
  lines.push(PROMPT_MARKER);
  lines.push('');
  lines.push(`Asset id: ${asset.id}`);
  lines.push(`Asset type: ${asset.type}`);
  lines.push(`Asset role: ${asset.role || '(none)'}`);
  lines.push(`Prompt key: ${asset.promptKey}`);
  lines.push(`Raw source path (save imagegen output HERE, with PNG extension): ${asset.sourcePath}`);
  lines.push(`Final approved path (will be written by produce step, do NOT save imagegen output here): ${asset.outputPath}`);
  lines.push(`Public URL (runtime): ${asset.publicPath}`);
  lines.push(`Canvas size: ${asset.width}x${asset.height} px`);
  lines.push(`Anchor convention: ${JSON.stringify(asset.anchor)} (${anchorLabel(asset)})`);
  lines.push(`Collision: ${asset.collision}`);

  if (asset.animation) {
    const a = asset.animation;
    lines.push(`Animation: ${a.frames} frames at ${a.fps} fps (loop=${a.loop}), each frame ${a.frameWidth}x${a.frameHeight}, strip ${a.frameWidth * a.frames}x${a.frameHeight}, stillFrameIndex=${a.stillFrameIndex}`);
  } else {
    lines.push('Animation: none (single static PNG)');
  }
  lines.push('');

  if (asset.type === 'character' || (asset.spritesheet)) {
    const s = asset.spritesheet;
    if (s) {
      lines.push(`Spritesheet layout: ${s.cols} cols x ${s.rows} rows of ${s.frameWidth}x${s.frameHeight} frames (total canvas ${s.width}x${s.height}).`);
      lines.push(`Row order top-to-bottom: ${s.rowOrder.join(', ')}.`);
      lines.push(`Frames per row: ${s.framesPerRow.idle.length} idle (cols ${s.framesPerRow.idle.join(',')}) + ${s.framesPerRow.walk.length} walk (cols ${s.framesPerRow.walk.join(',')}).`);
      lines.push('');
    }
  }

  if (promptEntry) {
    lines.push('## Subject');
    lines.push(promptEntry.subject);
    lines.push('');
    lines.push('## Details');
    lines.push(promptEntry.details);
    lines.push('');
    lines.push('## Size');
    lines.push(promptEntry.size);
    lines.push('');
    lines.push('## Transparency');
    lines.push(promptEntry.transparency);
    lines.push('');
    lines.push('## Constraints');
    lines.push(promptEntry.constraints);
    lines.push('');
  } else {
    lines.push(`(!) No prompt entry found in home-field-prompts.json for key "${asset.promptKey}"`);
    lines.push('');
  }

  lines.push(styleAnchorBlock(anchor));
  lines.push('');
  lines.push('## Save and report');
  lines.push(`After generation, save the raw imagegen output to: ${asset.sourcePath}`);
  lines.push('Then run:');
  lines.push(`  npm run game:home-field:produce -- ${asset.id}`);
  lines.push('  npm run game:home-field:validate');
  lines.push('Until both pass, do not commit the image; rerun imagegen with adjusted constraints.');
  return lines.join('\n');
}

function anchorLabel(asset) {
  switch (asset.type) {
    case 'terrain': return 'tile top-left (0,0)';
    case 'prop': return 'ground entity, feet/base';
    case 'exit': return 'ground entity, feet/base';
    case 'effect': return 'floating effect, visual center';
    case 'character': return 'character chibi, feet/base';
    default: return 'see Renderer Contract';
  }
}

function characterEntryToAsset(c) {
  return {
    id: c.id,
    type: 'character',
    role: 'chibi_spritesheet',
    promptKey: c.promptKey,
    sourcePath: c.sourcePath,
    outputPath: c.outputPath,
    publicPath: c.publicPath,
    width: c.spritesheet.width,
    height: c.spritesheet.height,
    anchor: { x: 0.5, y: 0.95 },
    collision: 'walkable',
    animation: null,
    spritesheet: c.spritesheet,
    status: c.status
  };
}

function parseBatchFlag(argv) {
  const arg = argv.find((a) => a.startsWith('--batch='));
  if (!arg) return null;
  const name = arg.slice('--batch='.length).trim();
  if (!(name in BATCHES)) {
    throw new Error(`Unknown --batch="${name}". Valid: ${Object.keys(BATCHES).join(', ')}`);
  }
  return { name, ids: BATCHES[name] };
}

function main() {
  const argv = process.argv.slice(2);
  const limit = parseLimit(argv);
  const all = hasFlag(argv, 'all');
  const typeFilter = parseListFlag(argv, 'type');
  let idFilter = parseListFlag(argv, 'id');
  const batch = parseBatchFlag(argv);
  if (batch && batch.ids) {
    idFilter = (idFilter || []).concat(batch.ids);
  }
  const includeExisting = hasFlag(argv, 'include-existing');

  const assetsDoc = loadJson(ASSETS_PATH);
  const promptsDoc = loadJson(PROMPTS_PATH);
  const anchor = loadJson(STYLE_ANCHOR_PATH);

  const allAssets = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map(characterEntryToAsset)
  ];

  const pending = allAssets.filter((a) => {
    if (typeFilter && !typeFilter.includes(a.type)) return false;
    if (idFilter && !idFilter.includes(a.id)) return false;
    if (includeExisting) return true;
    const outputAbs = path.join(repoRoot, a.outputPath);
    if (fs.existsSync(outputAbs)) return false;
    return a.status !== 'approved';
  });

  const slice = all ? pending : pending.slice(0, limit);

  console.log('# Home Field — Next Imagegen Batch');
  console.log('');
  console.log(`Workspace root: ${repoRoot}`);
  if (batch) console.log(`Batch: ${batch.name}`);
  console.log(`Pending assets: ${pending.length}; emitting: ${slice.length}`);
  if (pending.length === 0) {
    console.log('');
    console.log('All home-field assets are present. Nothing to generate.');
    return;
  }
  console.log('');
  console.log('Workflow per asset:');
  console.log('  1. Read the prompt block below.');
  console.log('  2. Use the imagegen skill with the subject + details + style anchor.');
  console.log('  3. Save raw output to the listed sourcePath under .agent/home-field-workspace/raw/.');
  console.log('  4. Run `npm run game:home-field:produce -- <id>` to crop, chroma-key, and write the app-facing PNG.');
  console.log('  5. Run `npm run game:home-field:validate` to check schema, dimensions, alpha, animation strips.');
  console.log('  6. Run `npm run game:home-field:sheet` to refresh the contact sheet for review.');
  console.log('  7. Commit only after validate + sheet pass.');

  slice.forEach((asset, idx) => {
    const promptEntry = promptsDoc.prompts[asset.promptKey];
    console.log(formatAssetPrompt({ asset, promptEntry, anchor, idx: idx + 1, total: slice.length }));
  });

  console.log('');
  console.log('---');
  console.log(`Done. ${slice.length} prompt(s) emitted.`);
  if (!all && slice.length < pending.length) {
    console.log(`Run again with --limit=${pending.length} or --all to see the remaining ${pending.length - slice.length}.`);
  }
}

main();
