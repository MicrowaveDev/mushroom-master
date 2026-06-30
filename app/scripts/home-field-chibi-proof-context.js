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

function main() {
  const existingFrameCount = framePaths.filter(exists).length;
  console.log('# Thalla Home Field Chibi Proof Context');
  console.log('');
  console.log('Built-in imagegen environment prefix:');
  console.log('  HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1  # use only when the launcher/user explicitly confirms both built-in disk output and actual reference-image input binding for this same session');
  console.log('');
  console.log('Required commands:');
  console.log('  npm run game:home-field:preflight-chibi-proof');
  console.log('  npm run game:home-field:find-imagegen-output -- --since-minutes=5  # diagnostic only after reference binding is confirmed and built-in disk output is still unconfirmed');
  console.log('  npm run game:home-field:archive-stale-chibi-proof -- thalla');
  console.log('  npm run game:home-field:next-chibi-proof');
  console.log('  npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png --verify=reference');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --reference');
  console.log('  npm run game:home-field:palette-audit -- .agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png --out=.agent/home-field-workspace/review/thalla-reference-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-reference-palette-swatch.png');
  console.log('  npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=.agent/home-field-workspace/raw/thalla_chibi.states.source.png --verify=state-sheet');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --state-sheet');
  console.log('  npm run game:home-field:palette-audit -- .agent/home-field-workspace/raw/thalla_chibi.states.source.png --out=.agent/home-field-workspace/review/thalla-state-sheet-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-state-sheet-palette-swatch.png');
  console.log('  npm run game:home-field:split-chibi-state-sheet -- --chroma-key=#ff00ff --resize');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --frames');
  console.log('  npm run game:home-field:produce-chibi-candidate -- thalla --resize --chroma-key=#ff00ff');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --candidate');
  console.log('  npm run game:home-field:palette-audit -- .agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png --out=.agent/home-field-workspace/review/thalla-candidate-palette-audit.json --swatch=.agent/home-field-workspace/review/thalla-candidate-palette-swatch.png');
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
  console.log(`  reference palette audit: ${referencePaletteAuditPath} (${exists(referencePaletteAuditPath) ? 'exists' : 'missing'})`);
  console.log(`  state sheet palette audit: ${stateSheetPaletteAuditPath} (${exists(stateSheetPaletteAuditPath) ? 'exists' : 'missing'})`);
  console.log(`  candidate palette audit: ${candidatePaletteAuditPath} (${exists(candidatePaletteAuditPath) ? 'exists' : 'missing'})`);
  console.log('');
  console.log('Freshness warning: existing .agent files are not proof of a fresh run. After rejection, run archive-stale-chibi-proof only after preflight passes, then regenerate and bind the new source chain in candidate-evidence.manifest.json.');
  console.log('Output probe warning: the only imagegen allowed before preflight passes is one tiny non-candidate built-in output probe after reference-image input binding is confirmed and disk output is still unconfirmed; do not run the probe when reference binding is unavailable.');
  console.log('Reference-input warning: current Thalla proof art needs the checked-in PNGs attached as actual imagegen inputs. Viewing them in chat or naming them in text is not image-guided generation.');
  console.log('Frame contract: generate one coherent 8x4 chibi state sheet, split it, then verify 32 isolated character-only frames.');
  console.log('Motion contract: idle bob and walk poses must exist in the grouped state sheet itself; do not synthesize motion after split.');
  console.log('Palette contract: state the plan before imagegen, target 12-18 artist-visible colors, stay under 20 visible design colors excluding transparency/#ff00ff, run palette-audit on reference/state/candidate images, and fail palette bloat through styleCohesionCheck/stageContractCheck.');
  console.log('Runtime contract: raw source must be unclipped; alpha edges, anchor/footing, separate shadow, and runtime-scale read must pass before style review.');
  console.log('Post-split processing may clean alpha/chroma fringe, crop, and resize only; it must not alter pose, motion, silhouette, style, or identity.');
  console.log('Shadow contract: no baked shadow in chibi frames; use the separate chibi_shadow renderer/asset layer.');
}

main();
