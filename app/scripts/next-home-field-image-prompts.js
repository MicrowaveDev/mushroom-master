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
 *   --batch=<name>    predefined batch (terrain-grass | terrain-path | terrain-edge | terrain-production | proof-static | proof-animated | proof-character | full)
 *   --include-existing  also emit prompts for assets whose outputPath already exists
 *   --review-verdict=<v>  filter by docs/home-field-asset-review.json verdict
 *   --status=<s>      filter by manifest status
 *   --ignore-review-gate  print prompts even when existing candidates still need review
 *   --field-context   for grass terrain, ask imagegen for a larger field context and crop the center tile
 *   --object-candidate  print object-layer candidate producer guidance instead of app-facing producer guidance
 *   --chibi-candidate   print chibi candidate producer guidance instead of app-facing producer guidance
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
const REVIEW_PATH = process.env.HOME_FIELD_REVIEW_PATH
  ? path.resolve(repoRoot, process.env.HOME_FIELD_REVIEW_PATH)
  : path.join(repoRoot, 'docs', 'home-field-asset-review.json');

const PROMPT_MARKER = 'Use the imagegen skill to create a production game home-field bitmap.';

const BATCHES = {
  'terrain-grass': [
    'grass_base_01',
    'grass_base_02',
    'grass_flowers_01'
  ],
  'terrain-path': [
    'path_h_end_w',
    'path_dirt_straight',
    'path_spore_glow',
    'path_h_end_e',
    'path_destination_row'
  ],
  'terrain-edge': [
    'edge_roots_01',
    'edge_moss_rocks_01',
    'edge_left_forest_01',
    'edge_right_forest_01'
  ],
  'terrain-production': [
    'grass_base_01',
    'grass_base_02',
    'grass_flowers_01',
    'path_dirt_straight',
    'path_spore_glow',
    'path_destination_row',
    'edge_roots_01',
    'edge_moss_rocks_01',
    'path_h_end_w',
    'path_h_end_e',
    'edge_left_forest_01',
    'edge_right_forest_01'
  ],
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
    s.terrainReference ? `Terrain reference: ${s.terrainReference}` : null,
    s.productionBar ? `Production bar: ${s.productionBar}` : null,
    s.sceneFit ? `Scene fit: ${s.sceneFit}` : null,
    s.chibiFit ? `Chibi fit: ${s.chibiFit}` : null,
    `Shadow style: ${s.shadowStyle}`,
    `Ambient: ${s.ambient}`,
    `Scale and camera: ${s.scale}`,
    '',
    'Hard rejections:',
    rej
  ].filter(Boolean).join('\n');
}

function scaleContractBlock(asset) {
  if (!['terrain', 'prop', 'exit'].includes(asset.type)) return '';
  const visualFootprint = (() => {
    if (asset.type === 'terrain') {
      return 'fills the full 256x256 terrain cell as ground only; terrain texture must stay quieter than chibis and object-layer props.';
    }
    if (asset.type === 'exit') {
      return 'landmark-sized object-layer prop; taller than a chibi but still authored for the same elevated top-down field camera, with bottom-center anchor.';
    }
    const id = asset.id;
    if (id.includes('bush') || id.includes('broccoli') || id.includes('cabbage') || id.includes('pepper') || id.includes('beetroot')) {
      return 'medium field prop; should read at roughly 48-80px in mobile preview, using a few broad masses rather than many tiny segments.';
    }
    if (id.includes('sprout') || id.includes('mushroom_cluster_small') || id.includes('mushroom_cap') || id.includes('branch') || id.includes('turnip') || id.includes('onion') || id.includes('tomato')) {
      return 'small field token; should read at roughly 32-52px in mobile preview, compact and low-detail with a clear bottom anchor.';
    }
    if (id.includes('lantern') || id.includes('signpost')) {
      return 'small-to-medium vertical prop; should read at roughly 56-96px in mobile preview, with one clear silhouette and bottom-center anchor.';
    }
    if (id.includes('tall')) {
      return 'tall field-edge prop; taller than a chibi but not a full-scene illustration, with breathing room inside the transparent source canvas.';
    }
    return 'object-layer prop; preserve the manifest canvas size but keep the in-scene footprint consistent with neighboring Home Field props.';
  })();

  return [
    '## Home Field scale contract',
    'Use the same elevated top-down 2.5D game-hub camera as the rest of Home Field. Do not mix in portrait, side-view, icon, card-art, realistic product-render, or full-scene illustration angles.',
    `Runtime canvas: ${asset.width}x${asset.height}px. This is the source/output canvas, not permission to fill the whole canvas with visual mass.`,
    `Visual footprint target: ${visualFootprint}`,
    'Style/scale consistency: match the shared moss/teal/amber/violet palette, warm dark outline treatment for object-layer assets, soft compact shadows, and low mobile-detail budget.',
    'Retina/source-size rule: larger source pixels may be used only when the workflow says so; they are for cleaner alpha and shape control, not for adding micro-detail or changing in-scene scale.',
    'Reject if the candidate looks like a different zoom level, camera angle, lighting setup, renderer, or asset class when placed next to the current Home Field terrain, props, and chibis.'
  ].join('\n');
}

function tilemapContractBlock(asset) {
  if (asset.type !== 'terrain') return '';
  const tile = asset.tile || null;
  const connectivityLines = tile
    ? [
      `Declared terrain set: ${tile.terrainSet}`,
      `Declared placement: ${tile.placement}`,
      `Declared edge connectors: north=${tile.connectors?.n}; east=${tile.connectors?.e}; south=${tile.connectors?.s}; west=${tile.connectors?.w}`,
      tile.pathBand ? `Declared path band: ${tile.pathBand.axis}; pathCenterY=${tile.pathBand.pathCenterY ?? 'n/a'}; pathCenterX=${tile.pathBand.pathCenterX ?? 'n/a'}; pathWidth=${tile.pathBand.pathWidth}` : null,
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

function fieldContextBlock(asset, { fieldContext = false } = {}) {
  if (!fieldContext || asset.type !== 'terrain' || asset.tile?.terrainSet !== 'meadow_grass') return '';
  return [
    '## Field-context generation mode (grass terrain)',
    'Do not compose this as an isolated square texture. First imagine or generate a larger continuous 3x3 or 4x4 meadow patch in the same style, then save a quiet center crop as the raw source for this tile.',
    'The raw source may be larger than 256x256. The producer command below intentionally center-crops and resizes it.',
    'The selected center crop must have no unique focal mark, no vignette, no strong diagonal band, no obvious corner lighting, and no edge-darkening. It should look boring in isolation but cohesive when repeated.',
    'For base grass, prefer broad low-contrast color fields with only a few tiny strokes. For the flower accent, keep flowers extremely sparse and avoid repeated dot grids.',
    'Reject any candidate where the larger field context reveals columns, rows, diagonal mottling, repeated stamp clusters, or visible square blocks.'
  ].join('\n');
}

function formatAssetPrompt({ asset, promptEntry, anchor, idx, total, fieldContext = false, objectCandidate = false, chibiCandidate = false }) {
  const candidateRoot = chibiCandidate
    ? '.agent/home-field-workspace/candidates/chibi-active-roster/latest'
    : '.agent/home-field-workspace/candidates/object-layer/latest';
  const lines = [];
  lines.push(`\n=== [${idx}/${total}] ${asset.id} (${asset.type}) ===`);
  lines.push(PROMPT_MARKER);
  lines.push('');
  lines.push(`Asset id: ${asset.id}`);
  lines.push(`Asset type: ${asset.type}`);
  lines.push(`Asset role: ${asset.role || '(none)'}`);
  lines.push(`Prompt key: ${asset.promptKey}`);
  if (chibiCandidate && asset.type === 'character') {
    lines.push(`Raw source manifest path: ${asset.sourcePath}`);
    lines.push('Raw frame save paths: use the per-frame thalla_chibi.frame_*.source.png paths listed in the prompt details and chibi candidate contract.');
  } else {
    lines.push(`Raw source path (save imagegen output HERE, with PNG extension): ${asset.sourcePath}`);
  }
  lines.push(`Final approved path (do NOT save imagegen output here): ${asset.outputPath}`);
  if (objectCandidate || chibiCandidate) {
    lines.push(`Candidate output path (written by candidate producer): ${candidateRoot}/${asset.outputPath}`);
  }
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
    const scaleContract = scaleContractBlock(asset);
    if (scaleContract) {
      lines.push(scaleContract);
      lines.push('');
    }
    const tileContract = tilemapContractBlock(asset);
    if (tileContract) {
      lines.push(tileContract);
      lines.push('');
    }
    const contextBlock = fieldContextBlock(asset, { fieldContext });
    if (contextBlock) {
      lines.push(contextBlock);
      lines.push('');
    }
  } else {
    lines.push(`(!) No prompt entry found in home-field-prompts.json for key "${asset.promptKey}"`);
    lines.push('');
  }

  lines.push(styleAnchorBlock(anchor));
  lines.push('');
  lines.push('## Save and report');
  if (chibiCandidate && asset.type === 'character') {
    lines.push('After generation, save the individual raw imagegen frames to the per-frame paths listed above, not to the single manifest sourcePath.');
  } else {
    lines.push(`After generation, save the raw imagegen output to: ${asset.sourcePath}`);
  }
  lines.push('Then run the recommended producer command:');
  lines.push(`  ${recommendedProduceCommand(asset, { fieldContext, objectCandidate, chibiCandidate })}`);
  lines.push('Then run:');
  if (objectCandidate || chibiCandidate) {
    lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-review`);
    lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-alpha-halo`);
    lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-readability`);
    lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:sheet`);
    lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:mobile-readability-sheet -- --ids=${asset.id}`);
    lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:alpha-sheet -- --ids=${asset.id}`);
    const previewCommand = chibiCandidate
      ? 'game:home-field:chibi-candidate-preview'
      : 'game:home-field:object-candidate-preview';
    lines.push(`  HOME_FIELD_CANDIDATE_IDS=${asset.id} HOME_FIELD_CANDIDATE_ROOT=${candidateRoot} npm run ${previewCommand}`);
  } else {
    lines.push('  npm run game:home-field:validate -- --check-files --check-connectors --check-review');
    lines.push('  npm run game:home-field:sheet');
    lines.push('  npm run game:home-field:adjacency');
    lines.push('  npx playwright test --config=tests/game/playwright.config.js tests/game/home-field-preview.spec.js --reporter=line');
  }
  if (objectCandidate || chibiCandidate) {
    lines.push('Until those pass and the contact sheet, alpha/readability sheets, and candidate preview look better, do not commit the image; rerun imagegen with adjusted constraints.');
  } else {
    lines.push('Until those pass and the contact sheet, adjacency sheet, and clean preview look better, do not commit the image; rerun imagegen with adjusted constraints.');
  }
  return lines.join('\n');
}

function recommendedProduceCommand(asset, { fieldContext = false, objectCandidate = false, chibiCandidate = false } = {}) {
  const canUseObjectCandidate = objectCandidate && (asset.type === 'prop' || asset.type === 'exit');
  const canUseChibiCandidate = chibiCandidate && asset.type === 'character';
  const base = canUseObjectCandidate
    ? `npm run game:home-field:produce-object-candidate -- ${asset.id}`
    : canUseChibiCandidate
      ? `npm run game:home-field:produce-chibi-candidate -- ${asset.id}`
    : `npm run game:home-field:produce -- ${asset.id}`;
  if (asset.type === 'terrain') {
    const placement = asset.tile?.placement || '';
    const canUseSeamless = ['free', 'accent'].includes(placement);
    if (fieldContext && canUseSeamless && asset.tile?.terrainSet === 'meadow_grass') {
      return `${base} --resize --crop-center=0.34 --seamless-terrain --quiet-terrain=0.45`;
    }
    const flags = canUseSeamless
      ? '--resize --crop-center --seamless-terrain --quiet-terrain'
      : '--resize --crop-center';
    return `${base} ${flags}`;
  }
  if (asset.type === 'prop' || asset.type === 'exit') {
    return `${base} --resize --chroma-key=#ff00ff`;
  }
  if (asset.type === 'effect') {
    return `${base} --resize --chroma-key=#ff00ff`;
  }
  if (asset.type === 'character') {
    return `${base} --resize-nearest --chroma-key=#ff00ff`;
  }
  return base;
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
  const statusFilter = parseListFlag(argv, 'status');
  const reviewFilter = parseListFlag(argv, 'review-verdict');
  let idFilter = parseListFlag(argv, 'id');
  const batch = parseBatchFlag(argv);
  if (batch && batch.ids) {
    idFilter = (idFilter || []).concat(batch.ids);
  }
  const includeExisting = hasFlag(argv, 'include-existing');
  const ignoreReviewGate = hasFlag(argv, 'ignore-review-gate');
  const fieldContext = hasFlag(argv, 'field-context');
  const objectCandidate = hasFlag(argv, 'object-candidate');
  const chibiCandidate = hasFlag(argv, 'chibi-candidate');

  const assetsDoc = loadJson(ASSETS_PATH);
  const promptsDoc = loadJson(PROMPTS_PATH);
  const anchor = loadJson(STYLE_ANCHOR_PATH);

  const allAssets = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map(characterEntryToAsset)
  ];

  const reviewDoc = loadReviewDoc();
  const reviewById = new Map((reviewDoc?.assets || []).map((entry) => [entry.id, entry]));
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
    if (statusFilter && !statusFilter.includes(a.status)) return false;
    const review = reviewById.get(a.id);
    if (reviewFilter && !reviewFilter.includes(review?.verdict || 'unreviewed')) return false;
    if (statusFilter || reviewFilter) return true;
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
  if (fieldContext) console.log('Generation mode: field-context center crop');
  if (objectCandidate) console.log('Generation mode: object-layer candidate root');
  if (chibiCandidate) console.log('Generation mode: chibi active-roster candidate root');
  console.log(`Pending assets: ${pending.length}; emitting: ${slice.length}`);
  if (pending.length === 0) {
    console.log('');
    console.log('All home-field assets are present. Nothing to generate.');
    if (idFilter) {
      console.log('If this is an intentional candidate rerun for existing app-facing assets, add --include-existing --ignore-review-gate, or use the documented rerun npm alias for that batch.');
    }
    console.log('For the next production terrain pass, use:');
    console.log('  npm run game:home-field:next -- --batch=terrain-production --review-verdict=needs_regen --all');
    return;
  }
  console.log('');
  console.log('Workflow per asset:');
  console.log('  1. Read the prompt block below.');
  console.log('  2. Use the imagegen skill with the subject + details + style anchor.');
  if (chibiCandidate) {
    console.log('  3. Save raw frame outputs to the per-frame paths listed in the prompt details under .agent/home-field-workspace/raw/.');
  } else {
    console.log('  3. Save raw output to the listed sourcePath under .agent/home-field-workspace/raw/.');
  }
  if (objectCandidate) {
    console.log('  4. Run `npm run game:home-field:produce-object-candidate -- <id>` to crop, chroma-key, and write the candidate PNG.');
  } else if (chibiCandidate) {
    console.log('  4. Run `npm run game:home-field:produce-chibi-candidate -- <id>` to compose frames and write the candidate spritesheet.');
  } else {
    console.log('  4. Run `npm run game:home-field:produce -- <id>` to crop, chroma-key, and write the app-facing PNG.');
  }
  if (objectCandidate || chibiCandidate) {
    console.log('  5. Run the scoped candidate-root validation commands printed below.');
    console.log('  6. Refresh contact, mobile-readability, alpha/halo, and candidate preview proof.');
  } else {
    console.log('  5. Run `npm run game:home-field:validate -- --check-files --check-connectors --check-review` to check schema, files, review rows, and adjacency.');
    console.log('  6. Run `npm run game:home-field:sheet` and `npm run game:home-field:adjacency` to refresh review proof.');
  }
  if (batch?.name === 'terrain-grass') {
    console.log('  7. Stop after these 3 grass tiles. Update review JSON before generating path or edge families.');
  } else if (batch?.name?.startsWith('terrain-')) {
    console.log('  7. Stop after this terrain family. Update review JSON before generating another family.');
  } else {
    console.log('  7. Stop after this batch. Update review JSON before generating another batch.');
  }
  console.log('  8. Commit only after validate + sheets pass.');

  slice.forEach((asset, idx) => {
    const promptEntry = promptsDoc.prompts[asset.promptKey];
    console.log(formatAssetPrompt({ asset, promptEntry, anchor, idx: idx + 1, total: slice.length, fieldContext, objectCandidate, chibiCandidate }));
  });

  console.log('');
  console.log('---');
  console.log(`Done. ${slice.length} prompt(s) emitted.`);
  if (!all && slice.length < pending.length) {
    console.log(`Run again with --limit=${pending.length} or --all to see the remaining ${pending.length - slice.length}.`);
  }
}

main();
