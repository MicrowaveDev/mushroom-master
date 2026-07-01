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
 *   --terrain-candidate print terrain candidate producer guidance instead of app-facing producer guidance
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
const CANDIDATE_PROMPT_MARKER = 'Use the imagegen skill to create a candidate game home-field bitmap; do not approve or overwrite app assets.';

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

function runtimeAssetContractBlock(asset) {
  if (!['terrain', 'prop', 'exit', 'character', 'effect'].includes(asset.type)) return '';
  if (asset.type === 'terrain') {
    return [
      '## Runtime asset contract',
      'Generate for the final in-game footprint, not contact-sheet beauty. The processed PNG plus metadata, validation, review evidence, and composed scene proof are the asset; the raw image alone is not enough.',
      'Terrain runtime role: this is walkable or blocking ground inside a tilemap, not a full illustration. It must repeat or connect according to its metadata without becoming the visual star of the scene.',
      'Source completeness: the source must include enough surrounding pattern context for the producer crop plan. Reject sources with clipped focal marks, hard bands, scene objects, horizon, or edge lighting that will become tile seams.',
      'Allowed deterministic post-processing: crop/family crop, edge/value normalization, resize, and terrain-specific seamless cleanup only. Do not add props, paths, objects, or focal marks after generation.',
      'Approval evidence: judge the candidate first in composed mobile and desktop clean field screenshots; contact, adjacency, grass-family, and edge-profile sheets are supporting evidence.'
    ].join('\n');
  }
  const shadowPolicy = asset.type === 'character'
    ? 'Do not bake a ground shadow into the frame; the renderer supplies the shared separate chibi shadow layer.'
    : 'Bake only the compact prop shadow expected by the asset contract; do not include floor planes, terrain patches, or long scene shadows.';
  return [
    '## Runtime asset contract',
    'Generate for the final in-game footprint, not contact-sheet beauty. The processed PNG plus metadata, validation, review evidence, and composed scene proof are the asset; the raw image alone is not enough.',
    'Raw source completeness: the source must contain the whole silhouette with breathing room. Do not accept clipped cap tips, feet, roots, ears, robes, props, or shadow edges.',
    `Anchor/pivot: use the declared anchor ${JSON.stringify(asset.anchor)}. Keep the visible base/feet close to that bottom anchor so runtime placement and animation do not float or jitter.`,
    'Alpha/edge safety: use true transparency or flat #ff00ff chroma key, leave safe transparent padding around the visible alpha, and avoid colored fringe that would bleed during browser/canvas filtering.',
    shadowPolicy,
    'Allowed deterministic post-processing: alpha/chroma cleanup, crop/fit, and resize only. Do not change identity, silhouette, pose, lighting, style, or animation after generation.',
    'Approval evidence: judge the candidate first in composed mobile and desktop clean field screenshots; contact, alpha/halo, and mobile-readability sheets are supporting evidence.'
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

function formatAssetPrompt({ asset, promptEntry, anchor, idx, total, fieldContext = false, objectCandidate = false, chibiCandidate = false, terrainCandidate = false }) {
  const candidateRoot = chibiCandidate
    ? '.agent/home-field-workspace/candidates/chibi-active-roster/latest'
    : terrainCandidate
      ? '.agent/home-field-workspace/candidates/terrain-family/latest'
      : '.agent/home-field-workspace/candidates/object-layer/latest';
  const lines = [];
  lines.push(`\n=== [${idx}/${total}] ${asset.id} (${asset.type}) ===`);
  lines.push((objectCandidate || chibiCandidate || terrainCandidate) ? CANDIDATE_PROMPT_MARKER : PROMPT_MARKER);
  lines.push('');
  lines.push(`Asset id: ${asset.id}`);
  lines.push(`Asset type: ${asset.type}`);
  lines.push(`Asset role: ${asset.role || '(none)'}`);
  lines.push(`Prompt key: ${asset.promptKey}`);
  if (chibiCandidate && asset.type === 'character') {
    lines.push(`Raw source manifest path: ${asset.sourcePath}`);
    lines.push('Grouped state sheet path (save imagegen output HERE): .agent/home-field-workspace/raw/thalla_chibi.states.source.png');
    lines.push('Raw frame save paths: generated by splitting the state sheet into the per-frame thalla_chibi.frame_*.source.png paths listed in the prompt details and chibi candidate contract.');
  } else {
    lines.push(`Raw source path (save imagegen output HERE, with PNG extension): ${asset.sourcePath}`);
  }
  lines.push(`Final approved path (do NOT save imagegen output here): ${asset.outputPath}`);
  if (objectCandidate || chibiCandidate || terrainCandidate) {
    lines.push(`Candidate output path (written by candidate producer): ${candidateRoot}/${asset.outputPath}`);
  }
  lines.push(`Public URL (runtime): ${asset.publicPath}`);
  lines.push(`Canvas size: ${asset.width}x${asset.height} px`);
  lines.push(`Anchor convention: ${JSON.stringify(asset.anchor)} (${anchorLabel(asset)})`);
  lines.push(`Collision: ${asset.collision}`);

  if (asset.type === 'character' || asset.spritesheet) {
    lines.push('Animation: spritesheet-driven idle/walk frames; see layout below.');
  } else if (asset.animation) {
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
      lines.push('Idle action: col 0 normal planted pose, col 1 little 1-3px bob/squish that loops back to normal; keep it standing, not a crouch or deep squat.');
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
    const runtimeContract = runtimeAssetContractBlock(asset);
    if (runtimeContract) {
      lines.push(runtimeContract);
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
  const referencePrompt = chibiReferenceTurnaroundPromptBlock(asset, { chibiCandidate });
  if (referencePrompt) {
    lines.push(referencePrompt);
    lines.push('');
  }
  lines.push('## Save and report');
  if (chibiCandidate && asset.type === 'character') {
    lines.push('Save the non-production sprite-box reference sheet to: .agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png');
    lines.push('If built-in imagegen produced a discoverable file outside the repo, claim it with: npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png --verify=reference');
    lines.push('Immediately verify the saved reference with: npm run game:home-field:verify-chibi-proof-files -- --reference');
    lines.push('Immediately audit the saved reference palette with: npm run game:home-field:palette-audit -- .agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png --out=.agent/home-field-workspace/review/thalla-reference-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-reference-palette-swatch.png --fail-on-bloat');
    lines.push('Save the final 8x4 state sheet to: .agent/home-field-workspace/raw/thalla_chibi.states.source.png');
    lines.push('If built-in imagegen produced a discoverable file outside the repo, claim it with: npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=.agent/home-field-workspace/raw/thalla_chibi.states.source.png --verify=state-sheet');
    lines.push('Immediately verify the saved state sheet with: npm run game:home-field:verify-chibi-proof-files -- --state-sheet');
    lines.push('Immediately audit the saved state-sheet palette with: npm run game:home-field:palette-audit -- .agent/home-field-workspace/raw/thalla_chibi.states.source.png --out=.agent/home-field-workspace/review/thalla-state-sheet-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-state-sheet-palette-swatch.png --fail-on-bloat');
    lines.push('Then split the state sheet into raw frames with: npm run game:home-field:split-chibi-state-sheet -- --chroma-key=#ff00ff --resize');
    lines.push('The grouped state sheet itself must contain the idle bob and walk poses; do not synthesize motion after split by shifting, squashing, stretching, repainting, or otherwise changing frame pose/silhouette.');
    lines.push('Post-split deterministic processing may clean alpha/chroma fringe, crop, and resize only; it must not alter pose, motion, silhouette, style, or identity.');
    lines.push('After splitting, the individual raw frame files must exist at the per-frame paths listed above, not at the single manifest sourcePath.');
    lines.push('Immediately verify all saved raw frames with: npm run game:home-field:verify-chibi-proof-files -- --frames');
  } else {
    lines.push(`After generation, save the raw imagegen output to: ${asset.sourcePath}`);
  }
  lines.push('Then run the recommended producer command:');
  lines.push(`  ${recommendedProduceCommand(asset, { fieldContext, objectCandidate, chibiCandidate, terrainCandidate })}`);
  if (chibiCandidate && asset.type === 'character') {
    lines.push('Then verify the composed candidate spritesheet:');
    lines.push('  npm run game:home-field:verify-chibi-proof-files -- --candidate');
    lines.push('Then audit the composed candidate palette:');
    lines.push('  npm run game:home-field:palette-audit -- .agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png --out=.agent/home-field-workspace/review/thalla-candidate-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-candidate-palette-swatch.png --fail-on-bloat');
  }
  lines.push('Then run:');
  if (objectCandidate || chibiCandidate || terrainCandidate) {
    lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-review`);
    if (!terrainCandidate) {
      lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-alpha-halo`);
      lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-readability`);
      lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-runtime-readiness`);
      if (chibiCandidate) {
        lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-chibi-animation`);
        lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-chibi-quality`);
        lines.push(`  npm run game:home-field:recover-chibi-alpha -- ${asset.id}  # only if alpha/halo validation fails from recoverable chroma fringe`);
      }
    } else {
      lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-connectors --check-review`);
      lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${asset.id} --check-files --check-edge-profiles --check-family-cohesion`);
    }
    lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:sheet`);
    if (terrainCandidate) {
      lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:adjacency`);
    } else {
      lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:mobile-readability-sheet -- --ids=${asset.id}`);
      lines.push(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:alpha-sheet -- --ids=${asset.id}`);
    }
    if (chibiCandidate) {
      lines.push('  # candidate-evidence requires thalla-reference/state-sheet/candidate palette audit JSON plus swatch PNGs');
    }
    lines.push(`  HOME_FIELD_CANDIDATE_ROOT=${candidateRoot} HOME_FIELD_CANDIDATE_IDS=${asset.id} npm run game:home-field:candidate-evidence`);
    if (chibiCandidate) {
      lines.push(`  npm run game:home-field:record-chibi-verdict -- ${asset.id} --verdict=needs_regen --reason-file=<visual-critic-reason.txt>`);
    }
    const previewCommand = chibiCandidate
      ? 'game:home-field:chibi-candidate-preview'
      : terrainCandidate
        ? 'game:home-field:terrain-candidate-preview'
        : 'game:home-field:object-candidate-preview';
    lines.push(`  HOME_FIELD_CANDIDATE_IDS=${asset.id} HOME_FIELD_CANDIDATE_ROOT=${candidateRoot} npm run ${previewCommand}`);
  } else {
    lines.push('  npm run game:home-field:validate -- --check-files --check-connectors --check-review');
    lines.push('  npm run game:home-field:sheet');
    lines.push('  npm run game:home-field:adjacency');
    lines.push('  npx playwright test --config=tests/game/playwright.config.js tests/game/home-field-preview.spec.js --reporter=line');
  }
  if (objectCandidate || chibiCandidate) {
    lines.push('Until those pass and the contact sheet, alpha/readability sheets, and candidate preview look at least as crisp and finished as the approved props, do not commit the image; rerun imagegen with adjusted constraints.');
  } else {
    lines.push('Until those pass and the contact sheet, adjacency sheet, and clean preview look better, do not commit the image; rerun imagegen with adjusted constraints.');
  }
  return lines.join('\n');
}

function chibiReferenceTurnaroundPromptBlock(asset, { chibiCandidate = false } = {}) {
  if (!chibiCandidate || asset.type !== 'character' || asset.id !== 'thalla') return '';
  return [
    '## Copyable Sprite-Box Reference Prompt',
    'Before imagegen, attach these checked-in PNGs as actual image inputs and label their roles:',
    '- `docs/reference/home-field/chibi-thalla-previous-best-2026-06-26-state-sheet.png` — positive compact grouped-sheet proportions and charm; fix palette bloat/ornament.',
    '- `docs/reference/home-field/chibi-thalla-liked-2026-06-23.png` — positive Thalla face/cap/robe appeal only; simplify heavily.',
    '- `docs/reference/home-field/chibi-style-agent-log-reference.png` — target scale, outline weight, and scene-scale simplicity only; do not copy symbols/costumes.',
    '',
    'Paste this exact prompt into imagegen for the non-production reference sheet, with those local PNGs attached as actual image inputs. Do not hand-compose or add extra style terms. Do not run this as another text-only generation; viewing the PNGs in chat or listing their filesystem paths is not enough. If the available imagegen surface only exposes a prompt field, it is not reference-capable for this proof. If the imagegen path cannot attach the checked-in PNGs as actual image inputs to the generation call, stop and report that image-guided generation is required.',
    '',
    'Method gate after rollout codex-019f1a6c-3143-7631-b3a4-73da0f052070: do not run this unchanged through the same built-in sprite-box imagegen path again. The reference-bound compact-canvas prompt still produced oversized anime/sticker turnaround art with palette bloat. Before another reference attempt, use a concrete method change such as a different reference-capable generation/editing path, supplied local proof source PNGs, or a revised helper/prompt that changes the generation method rather than only adding more negative wording. The checked-in docs/reference PNGs are style references, not supplied proof source PNGs. If no method change is available, stop and report this blocker.',
    '',
    '```text',
    'Create one non-production sprite-box reference sheet for Thalla only, for the Mushroom Battles Home Field chibi proof.',
    '',
    'Input images: use the attached checked-in reference images as guidance. Preserve the compact sprite proportions and charm of the previous-best state sheet as the primary layout/scale authority, use the liked Thalla image only for simplified face/cap/robe appeal, and use the chibi style reference only for field-sprite scale/outline simplicity.',
    '',
    'Purpose: consistency reference only; do not make final runtime frames, a full character illustration, a character-design showcase, or enlarged hero turnaround art. The 2026-06-29 image-guided attempts already failed by producing large painterly turnaround figures; avoid that exact failure.',
    '',
    'Layout: create a compact sprite extraction guide, not a conventional turnaround sheet. Target a compact source sheet around 512x384 or smaller, never a 1536x1024 showcase canvas. Place the same Thalla chibi in four tiny invisible 96x96 source-sprite boxes on one flat #ff00ff sheet: down, up, left, right. Each visible character must stay inside its own 96x96 box with generous magenta around it, like the compact checked-in state sheet, and should be designed to downscale to 64px. Do not scale the characters up for presentation; the visible character blob should stay roughly 64-96px tall in the generated PNG. Leave at least 70% of the sheet empty #ff00ff space. Do not fill quadrants, do not enlarge the figures to showcase-art size, and do not use borders, labels, grass, floor plane, text, or UI.',
    '',
    'Style target: hand-drawn elevated 2.5D field sprite with BJD-inspired chibi doll simplicity. Squat field-sprite proportions, oversized but not eye-dominated head, tiny grounded body, simple costume blocks, warm dark irregular outline, rounded cheeks, tiny mouth/nose, mitten-like hands, tiny planted feet, visible elf ears when ears are shown, and enough top of the mushroom cap/head visible to belong on the map. Design for 64px readability first: broad shape clusters, small dark seed/dot eyes with only a tiny gold life glint, no eyelashes or glossy anime eye shine, no painterly surface texture, no enlarged illustration detail.',
    '',
    'Thalla identity: ancient gold-white mushroom-elf field-sprite leader; mushroom-elf biology, not a human with a mushroom hat or hair under a cap; the mushroom cap is part of the character biology, not a removable hat; black seed eyes with fiery-gold life; 1-2 large flat gold mycelium/spore marks total across the whole sprite; simple fungal robe/cap silhouette; warm bone/gold/white/brown palette; calm biostasis stillness. Avoid visual royalty language in the art.',
    '',
    'Status simplification: represent authority through cap silhouette, robe blocks, posture, and 1-2 flat mycelium/spore marks only. Use one plain robe block with no layered cape/collar ornament. No royal regalia, crown jewel, forehead gem, brooch, chest medallion, pendant, jewelry-like cap crest, gold filigree, scalloped collar, ornamental robe border, decorative trim cluster, sleeve cuff trim, clasp, collar jewel, or repeated gold badge.',
    '',
    'Palette plan: 12-18 artist-visible colors, fewer than 20 total design colors excluding transparency and #ff00ff. Use shared cap/robe/skin/gold ramps instead of many local beige, cream, blush, glow, or gold shades. Use broad flat clusters and one-step shadows/highlights, not watercolor texture, painterly gradients, airbrushed blush, soft glow, or many near-duplicate tones.',
    '',
    'Preserve direction: prioritize the checked-in 2026-06-26 previous-best Thalla state sheet over generic chibi/anime defaults: keep its squat proportions, cap/body/face charm, and coherent state-sheet feel while fixing palette bloat, ornament, and sticker softness. Use the 2026-06-23 liked Thalla image only as positive face/cap/robe appeal, simplified into the field-sprite read. Use the chibi style reference only for proportions, outline weight, BJD-inspired simplicity, and scene-scale simplicity; do not copy characters, costumes, symbols, or composition.',
    '',
    'Hard avoids: no pixel art, no tiny beige doll sprite, no generic elf, no straight portrait sticker, no human with mushroom hat, no visible hair bangs or wig fringe, no large anime/fashion turnaround, no enlarged showcase turnaround, no quadrant-filling character art, no full-height polished character-design figures, no soft painterly turnaround sheet, no earrings, no jewelry, no royal regalia, no crown jewel, no forehead gem, no brooch, no chest medallion, no pendant, no jewelry-like cap crest, no scalloped collar, no ornamental robe border, no decorative trim clusters, no sleeve cuff trim, no repeated gold badges, no hard flat cel/vector icon art, no cold exactly-16-swatches exercise, no dense cap spots, no scattered gold freckles, no many gold droplets, no ornate filigree, no watercolor/painterly cap texture, no particle halo, no huge white portrait eyes, no glossy anime eyes, no eyelashes, no eye-dominated face, no realistic doll photo, no glossy toy render, no baked blob/cast shadow, no foot oval, no floor contact patch.',
    '```'
  ].join('\n');
}

function recommendedProduceCommand(asset, { fieldContext = false, objectCandidate = false, chibiCandidate = false, terrainCandidate = false } = {}) {
  const canUseObjectCandidate = objectCandidate && (asset.type === 'prop' || asset.type === 'exit');
  const canUseChibiCandidate = chibiCandidate && asset.type === 'character';
  const canUseTerrainCandidate = terrainCandidate && asset.type === 'terrain';
  const base = canUseObjectCandidate
    ? `npm run game:home-field:produce-object-candidate -- ${asset.id}`
    : canUseChibiCandidate
      ? `npm run game:home-field:produce-chibi-candidate -- ${asset.id}`
      : canUseTerrainCandidate
        ? `npm run game:home-field:produce-terrain-candidate -- ${asset.id}`
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
    return `${base} --resize --chroma-key=#ff00ff`;
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
  const terrainCandidate = hasFlag(argv, 'terrain-candidate');

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
  if (terrainCandidate) console.log('Generation mode: terrain-family candidate root');
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
  if (chibiCandidate) {
    console.log('  0. Run `npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof`, `npm run game:home-field:chibi-proof-context`, this read-only `npm run game:home-field:next-chibi-proof` helper, then preflight the intended image path. Prefer built-in/imagegen skill output with `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1 npm run game:home-field:preflight-chibi-proof` when the launcher/user explicitly confirmed built-in disk output plus actual reference-image input binding for this same session. Use `npm run game:home-field:preflight-chibi-proof -- --env-file=<explicit-env-file>` only for the paid API fallback when the env file contains OPENAI_IMAGEGEN_API_KEY plus HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1. Plain OPENAI_API_KEY is ignored. If preflight or the method gate fails, stop before stale-file archive/imagegen but include this helper output in the blocker report.');
    console.log('  1. Read the prompt block and copyable Sprite-Box Reference Prompt below; state the chibi palette, style-preservation, scale/face/biology, and status-simplification plans before imagegen.');
    console.log('  2. If preflight fails only because built-in disk output is unconfirmed and reference-image input binding is already confirmed, run one tiny diagnostic non-candidate built-in imagegen probe in the same agent context, then `npm run game:home-field:find-imagegen-output -- --since-minutes=5`; rerun preflight with HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 plus HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1 only if a newer file is found.');
    console.log('  3. Run `npm run game:home-field:archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>` only when the same preflight-passing API fallback env is being used; for built-in/local paths, run archive under the same confirmed capability environment.');
    console.log('  4. Attach the checked-in Thalla reference PNGs as actual image inputs, then use the exact copyable Sprite-Box Reference Prompt for the reference sheet. Prefer built-in/imagegen skill output when it can save PNGs and attach those references. Use `npm run game:home-field:chibi-reference-api-proof -- --env-file=<explicit-env-file>` only as the paid API fallback after HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1 is set, so env loading, SDK setup, exact prompt extraction, API-source normalization, verifier, and palette audit happen serially. Stop at the visual reference gate if palette, style, or status-ornament drift appears. Do not run another text-only reference attempt. If two exact-prompt image-guided reference attempts fail the same visual gate, stop and report instead of burning more blind retries.');
    console.log('  5. Use built-in/imagegen skill output as the normal proof-art path after same-agent file output and reference-image input binding are confirmed, or use supplied local proof source PNG inputs. docs/reference PNGs are style references, not proof source inputs. GPT-image-2 API fallback reference output may be normalized from a required API size such as 1024x768 to the 512x384 sprite-box source before verifier/audit, but palette audit must still pass. Save each generated PNG to the required repo path or claim it with `npm run game:home-field:claim-imagegen-output`.');
  } else {
    console.log('  1. Read the prompt block below.');
    console.log('  2. Use the imagegen skill with the subject + details + style anchor.');
  }
  if (chibiCandidate) {
    console.log('  6. Only after the reference gate passes, generate one coherent 8x4 state sheet through a reference-capable image path with the passed reference attached as an actual image input, save it to .agent/home-field-workspace/raw/thalla_chibi.states.source.png, then split it into raw frames. Stop if only prompt-text state-sheet generation is available.');
  } else {
    console.log('  3. Save raw output to the listed sourcePath under .agent/home-field-workspace/raw/.');
  }
  if (terrainCandidate) {
    console.log('  4. Run `npm run game:home-field:produce-terrain-candidate -- <id>` to crop, resize, and write the candidate terrain PNG.');
  } else if (objectCandidate) {
    console.log('  4. Run `npm run game:home-field:produce-object-candidate -- <id>` to crop, chroma-key, and write the candidate PNG.');
  } else if (chibiCandidate) {
    console.log('  7. Run `npm run game:home-field:produce-chibi-candidate -- <id>` to compose frames and write the candidate spritesheet.');
  } else {
    console.log('  4. Run `npm run game:home-field:produce -- <id>` to crop, chroma-key, and write the app-facing PNG.');
  }
  if (objectCandidate || chibiCandidate || terrainCandidate) {
    console.log(chibiCandidate
      ? '  8. Run the scoped candidate-root validation commands printed below.'
      : '  5. Run the scoped candidate-root validation commands printed below.');
    console.log(terrainCandidate
      ? '  6. Refresh contact, adjacency, candidate evidence, and candidate preview proof.'
      : chibiCandidate
        ? '  9. Refresh contact, mobile-readability, alpha/halo, candidate evidence, and candidate preview proof; Visual Critic must fail visible palette bloat through styleCohesionCheck/stageContractCheck; use recover-chibi-alpha only for recoverable chroma fringe.'
        : '  6. Refresh contact, mobile-readability, alpha/halo, candidate evidence, and candidate preview proof.');
  } else {
    console.log('  5. Run `npm run game:home-field:validate -- --check-files --check-connectors --check-review` to check schema, files, review rows, and adjacency.');
    console.log('  6. Run `npm run game:home-field:sheet` and `npm run game:home-field:adjacency` to refresh review proof.');
  }
  const stopStep = chibiCandidate ? 10 : 7;
  if (batch?.name === 'terrain-grass') {
    console.log(`  ${stopStep}. Stop after these 3 grass tiles. Update review JSON before generating path or edge families.`);
  } else if (batch?.name?.startsWith('terrain-')) {
    console.log(`  ${stopStep}. Stop after this terrain family. Update review JSON before generating another family.`);
  } else {
    console.log(`  ${stopStep}. Stop after this batch. Update review JSON before generating another batch.`);
  }
  console.log(`  ${stopStep + 1}. Commit only after validate + sheets pass.`);

  if (terrainCandidate && slice.length > 1) {
    const familyIds = slice.map((asset) => asset.id).join(',');
    const candidateRoot = '.agent/home-field-workspace/candidates/terrain-family/latest';
    console.log('');
    console.log('Family-level proof commands for this terrain batch:');
    console.log(`  npm run game:home-field:produce-terrain-candidate -- ${slice.map((asset) => asset.id).join(' ')} --resize --crop-center`);
    console.log(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${familyIds} --check-files --check-connectors --check-review`);
    console.log(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:validate -- --ids=${familyIds} --check-files --check-edge-profiles --check-family-cohesion`);
    console.log(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:sheet`);
    console.log(`  HOME_FIELD_ASSET_ROOT=${candidateRoot} npm run game:home-field:adjacency`);
    console.log(`  HOME_FIELD_CANDIDATE_ROOT=${candidateRoot} HOME_FIELD_CANDIDATE_IDS=${familyIds} npm run game:home-field:candidate-evidence`);
    console.log(`  HOME_FIELD_CANDIDATE_ROOT=${candidateRoot} HOME_FIELD_CANDIDATE_IDS=${familyIds} npm run game:home-field:terrain-candidate-preview`);
    console.log('Per-asset commands below are fallback diagnostics; use the family-level commands for batch review.');
  }

  slice.forEach((asset, idx) => {
    const promptEntry = promptsDoc.prompts[asset.promptKey];
    console.log(formatAssetPrompt({ asset, promptEntry, anchor, idx: idx + 1, total: slice.length, fieldContext, objectCandidate, chibiCandidate, terrainCandidate }));
  });

  console.log('');
  console.log('---');
  console.log(`Done. ${slice.length} prompt(s) emitted.`);
  if (!all && slice.length < pending.length) {
    console.log(`Run again with --limit=${pending.length} or --all to see the remaining ${pending.length - slice.length}.`);
  }
}

main();
