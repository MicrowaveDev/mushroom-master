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
 *   --ignore-review-gate  print prompts even when existing candidates still need review
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
const REVIEW_PATH = path.join(repoRoot, 'docs', 'home-field-asset-review.json');

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
    s.shapeLanguage ? `Shape language: ${s.shapeLanguage}` : null,
    s.texture ? `Texture/rendering: ${s.texture}` : null,
    `Shadow style: ${s.shadowStyle}`,
    `Ambient: ${s.ambient}`,
    `Scale and camera: ${s.scale}`,
    '',
    'Hard rejections:',
    rej
  ].filter(Boolean).join('\n');
}

function tilemapContractBlock(asset) {
  if (asset.type !== 'terrain') return '';
  const tile = asset.tile || null;
  const connectivityLines = tile
    ? [
      `Declared terrain set: ${tile.terrainSet}`,
      `Declared placement: ${tile.placement}`,
      `Declared edge connectors: north=${tile.connectors?.n}; east=${tile.connectors?.e}; south=${tile.connectors?.s}; west=${tile.connectors?.w}`,
      tile.canTouch?.length ? `Allowed direct neighbor asset ids: ${tile.canTouch.join(', ')}` : null,
      tile.needsTransitionFor?.length ? `Requires transition tile before touching connector tokens: ${tile.needsTransitionFor.join(', ')}` : null,
      tile.requiresTransitionsAtEnds ? 'This connector tile must not sit directly beside grass at its open path ends; use explicit end/transition tiles.' : null,
      tile.maxPerViewport ? `Max visual density: no more than ${tile.maxPerViewport} copy/copies per initial viewport.` : null
    ].filter(Boolean)
    : ['(!) Missing tile connectivity metadata; do not generate until the manifest declares terrainSet, placement, and NESW connectors.'];
  return [
    '## Tilemap contract (terrain assets only)',
    'This image is ONE reusable tile cell from a tilemap tileset, not a full scene, wallpaper, splash image, or complete field illustration.',
    `It must work when repeated edge-to-edge in a Phaser/Tiled tile layer at ${asset.width}x${asset.height}px.`,
    '',
    'Connectivity metadata to obey:',
    ...connectivityLines,
    '',
    'Composition rules: top-down/2.5D ground surface only; no horizon, no sky, no large foreground object, no scene focal point, no full-screen composition.',
    'Pattern rules: prefer a low-frequency, intentional tile pattern with broad readable shapes. Avoid dense random texture, realistic blade detail, unique center marks, or high-detail noise that becomes wallpaper when repeated.',
    'Edge rules: north/south/east/west edges must connect cleanly to compatible tiles; keep edge values calm and avoid marks cut off at boundaries.',
    'Connector rules: the art on each edge must visually match its declared connector token. Horizontal path tiles expose exact west/east path connectors at the same Y position and width; vertical path tiles expose exact north/south path connectors at the same X position and width; free grass exposes grass on every edge; transition tiles explicitly bridge unlike tokens.',
    'Scale rules: terrain details are ground texture only and should be sparse. Props, exits, large mushrooms, signs, lanterns, characters, and blockers belong in object layers, not terrain tiles.',
    'Acceptance rule: if the tile looks nice by itself but fails as a repeated 3x3 patch or creates a visible focal pattern in a 7x4 map, reject and regenerate.'
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
    const tileContract = tilemapContractBlock(asset);
    if (tileContract) {
      lines.push(tileContract);
      lines.push('');
    }
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

function loadReviewDoc() {
  if (!fs.existsSync(REVIEW_PATH)) return null;
  return loadJson(REVIEW_PATH);
}

function findReviewGateBlockers(allAssets, reviewDoc) {
  const reviewById = new Map((reviewDoc?.assets || []).map((entry) => [entry.id, entry]));
  return allAssets.filter((asset) => {
    if (!['generated', 'needs_review'].includes(asset.status)) return false;
    const review = reviewById.get(asset.id);
    return !review || review.verdict === 'pending' || review.verdict === 'needs_review';
  });
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
  const ignoreReviewGate = hasFlag(argv, 'ignore-review-gate');

  const assetsDoc = loadJson(ASSETS_PATH);
  const promptsDoc = loadJson(PROMPTS_PATH);
  const anchor = loadJson(STYLE_ANCHOR_PATH);

  const allAssets = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map(characterEntryToAsset)
  ];

  const reviewDoc = loadReviewDoc();
  const reviewBlockers = findReviewGateBlockers(allAssets, reviewDoc);
  if (reviewBlockers.length > 0 && !ignoreReviewGate) {
    console.error('# Home Field — Review Gate Blocked');
    console.error('');
    console.error('Existing generated candidates still need a checked-in visual verdict before the next batch can proceed.');
    console.error(`Review manifest: ${path.relative(repoRoot, REVIEW_PATH)}`);
    console.error('');
    for (const asset of reviewBlockers) {
      console.error(`- ${asset.id} (${asset.type}, status=${asset.status})`);
    }
    console.error('');
    console.error('Update the review manifest with verdict=approved|needs_regen|rejected and accepted=true only for human-approved production assets.');
    console.error('Use --ignore-review-gate only for an intentional regeneration pass on the blocked assets.');
    process.exit(1);
  }

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
