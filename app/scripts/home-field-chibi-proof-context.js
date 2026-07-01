#!/usr/bin/env node
/**
 * Print the narrow context needed for the Thalla Stage 1 chibi proof.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../shared/repo-root.js';

const workspace = '.agent/home-field-workspace';
const candidateRoot = `${workspace}/candidates/chibi-active-roster/latest`;
const reviewDir = `${workspace}/review`;
const referencePath = `${workspace}/reference/thalla_chibi_turnaround.reference.png`;
const stateSheetPath = `${workspace}/raw/thalla_chibi.states.source.png`;
const candidatePath = `${candidateRoot}/web/public/home-field/characters/thalla/spritesheet.png`;
const localSourceManifestPath = `${reviewDir}/thalla-local-state-sheet-source.manifest.json`;
const generationQueuePath = 'app/shared/home-field/home-field-generation-queue.json';
const generationQueueItemId = 'thalla-stage1-chibi-proof';
const referencePaletteAuditPath = `${reviewDir}/thalla-reference-palette-audit.json`;
const stateSheetPaletteAuditPath = `${reviewDir}/thalla-state-sheet-palette-audit.json`;
const candidatePaletteAuditPath = `${reviewDir}/thalla-candidate-palette-audit.json`;
const directions = ['down', 'up', 'left', 'right'];
const framePaths = directions.flatMap((dir) => [
  `${workspace}/raw/thalla_chibi.frame_idle_${dir}_0.source.png`,
  `${workspace}/raw/thalla_chibi.frame_idle_${dir}_1.source.png`,
  ...Array.from({ length: 6 }, (_, idx) => `${workspace}/raw/thalla_chibi.frame_walk_${dir}_${idx}.source.png`)
]);

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function chibiLocalSourceMode() {
  try {
    const queue = JSON.parse(fs.readFileSync(path.join(repoRoot, generationQueuePath), 'utf8'));
    const item = (queue.items || []).find((entry) => entry.id === generationQueueItemId);
    return item?.generationContract?.stateSheet?.localSourceMode || null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  return {
    showFallbacks: argv.includes('--show-fallbacks')
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const existingFrameCount = framePaths.filter(exists).length;
  const localSource = chibiLocalSourceMode();
  const localPreflightCommand = localSource?.preflightCommand || 'npm run game:home-field:preflight-chibi-proof -- --source=<png>';
  const localArchiveCommand = localSource?.archiveCommand || 'npm run game:home-field:archive-stale-chibi-proof -- thalla --source=<png>';
  const localStageCommand = localSource?.stageCommand || 'npm run game:home-field:stage-chibi-local-source -- --source=<png>';
  console.log('# Thalla Home Field Chibi Proof Context');
  console.log('');
  console.log('Active default path: supplied complete 8x4 local state-sheet source');
  console.log(`  sourcePath: ${localSource?.sourcePath || '<missing queue localSourceMode.sourcePath>'}`);
  console.log('  reference inputs: styleReferences for visual review only; not active imagegen inputs');
  console.log('  fallback history: hidden by default; use --show-fallbacks only when intentionally planning a future method change');
  console.log('');
  console.log('Required commands:');
  console.log('  npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof # structured queue item; default output is the local-source run contract');
  console.log('  npm run game:home-field:next-chibi-proof  # read-only local-source prompt, paths, validation commands, and style references');
  console.log(`  ${localPreflightCommand} # queue-owned supplied complete 8x4 local state-sheet source`);
  console.log(`  ${localArchiveCommand} # queue-owned local-source archive preflights with the same --source path`);
  console.log(`  ${localStageCommand} # stages state sheet and derives reference proxy without imagegen`);
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --reference');
  console.log('  npm run game:home-field:palette-audit -- .agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png --out=.agent/home-field-workspace/review/thalla-reference-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-reference-palette-swatch.png --fail-on-bloat');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --state-sheet');
  console.log('  npm run game:home-field:palette-audit -- .agent/home-field-workspace/raw/thalla_chibi.states.source.png --out=.agent/home-field-workspace/review/thalla-state-sheet-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-state-sheet-palette-swatch.png --fail-on-bloat');
  console.log('  npm run game:home-field:split-chibi-state-sheet -- --chroma-key=#ff00ff --resize');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --frames');
  console.log('  npm run game:home-field:produce-chibi-candidate -- thalla --resize --chroma-key=#ff00ff');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --candidate');
  console.log('  npm run game:home-field:palette-audit -- .agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png --out=.agent/home-field-workspace/review/thalla-candidate-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-candidate-palette-swatch.png --fail-on-bloat');
  console.log('  npm run game:home-field:recover-chibi-alpha -- thalla  # only if alpha/halo validation fails from recoverable chroma fringe');
  console.log('  HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-alpha-halo --check-readability --check-runtime-readiness --check-chibi-animation');
  console.log('  HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-chibi-quality');
  console.log('  HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest HOME_FIELD_CANDIDATE_IDS=thalla npm run game:home-field:candidate-evidence');
  console.log('  npm run game:home-field:record-chibi-verdict -- thalla --verdict=needs_regen --reason-file=<visual-critic-reason.txt>');
  console.log('  npm run game:home-field:chibi-candidate-preview');
  console.log('');
  console.log('Required paths:');
  console.log(`  reference: ${referencePath} (${exists(referencePath) ? 'exists' : 'missing'})`);
  console.log(`  state sheet: ${stateSheetPath} (${exists(stateSheetPath) ? 'exists' : 'missing'})`);
  console.log(`  raw frames: ${existingFrameCount}/${framePaths.length} present`);
  console.log(`  candidate: ${candidatePath} (${exists(candidatePath) ? 'exists' : 'missing'})`);
  console.log(`  local source provenance: ${localSourceManifestPath} (${exists(localSourceManifestPath) ? 'exists' : 'missing'})`);
  console.log(`  reference palette audit: ${referencePaletteAuditPath} (${exists(referencePaletteAuditPath) ? 'exists' : 'missing'})`);
  console.log(`  state sheet palette audit: ${stateSheetPaletteAuditPath} (${exists(stateSheetPaletteAuditPath) ? 'exists' : 'missing'})`);
  console.log(`  candidate palette audit: ${candidatePaletteAuditPath} (${exists(candidatePaletteAuditPath) ? 'exists' : 'missing'})`);
  console.log('');
  console.log('Freshness warning: existing .agent files are not proof of a fresh run. After rejection, run archive-stale-chibi-proof only after source preflight passes, then stage the queue source and bind the new source chain in candidate-evidence.manifest.json.');
  console.log('Blocker reporting warning: if source preflight, archive, or staging blocks the run, still run the read-only next-chibi-proof helper before final response and report that no split frames, candidate, preview, app overwrite, or fallback imagegen occurred.');
  console.log(`Prompt issuance warning: this queue item is ready because it has a concrete supplied complete local 8x4 state-sheet source (${localSource?.sourcePath || '<missing>'}); use the queue-printed --source commands. Do not infer .env or retry inactive methods from memory.`);
  console.log('Style-reference warning: docs/reference PNGs are style references only for visual review; local source PNGs must be proof sources, not the checked-in reference images.');
  console.log(`Local state-sheet source warning: use the queue-owned source path with --source: preflight ${localPreflightCommand}; archive ${localArchiveCommand}; stage ${localStageCommand}. A different supplied complete 8x4 local state-sheet PNG must be passed explicitly with --source or recorded in the queue sourcePath. Skip reference imagegen, verify/audit the derived reference proxy and staged state sheet, then split and validate candidate evidence.`);
  console.log('Frame contract: use one coherent supplied 8x4 chibi state sheet, split it, then verify 32 isolated character-only frames.');
  console.log('Motion contract: idle bob and walk poses must exist in the grouped state sheet itself; do not synthesize motion after split.');
  console.log('Palette contract: state the plan before staging/audit, target 12-18 artist-visible colors, stay under 20 visible design colors excluding transparency/#ff00ff, run palette-audit on reference/state/candidate images, and fail palette bloat through styleCohesionCheck/stageContractCheck.');
  console.log('Runtime contract: raw source must be unclipped; alpha edges, anchor/footing, separate shadow, and runtime-scale read must pass before style review.');
  console.log('Post-split processing may clean alpha/chroma fringe, crop, and resize only; it must not alter pose, motion, silhouette, style, or identity.');
  console.log('Shadow contract: no baked shadow in chibi frames; use the separate chibi_shadow renderer/asset layer.');
  if (opts.showFallbacks) {
    console.log('');
    console.log('Inactive/fallback method notes (--show-fallbacks):');
    console.log('  Built-in imagegen environment prefix: HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1');
    console.log('  API fallback environment prefix: HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1 OPENAI_IMAGEGEN_API_KEY=<key>; plain OPENAI_API_KEY is ignored');
    console.log('  API fallback commands: npm run game:home-field:preflight-chibi-proof -- --env-file=<explicit-env-file>; npm run game:home-field:archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>; npm run game:home-field:chibi-reference-api-proof -- --env-file=<explicit-env-file>');
    console.log('  Built-in output diagnostic: npm run game:home-field:find-imagegen-output -- --since-minutes=5 only for a future method change after reference binding is confirmed.');
    console.log('  Claim helper for future imagegen outputs: npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=<documented-path> --verify=<reference|state-sheet>');
  }
}

main();
