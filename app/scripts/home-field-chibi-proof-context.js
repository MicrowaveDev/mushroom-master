#!/usr/bin/env node
/**
 * Print the narrow context needed for the Thalla Stage 1 chibi proof.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../shared/repo-root.js';

const workspace = '.agent/home-field-workspace';
const candidateRoot = `${workspace}/candidates/chibi-active-roster/latest`;
const referencePath = `${workspace}/reference/thalla_chibi_turnaround.reference.png`;
const candidatePath = `${candidateRoot}/web/public/home-field/characters/thalla/spritesheet.png`;
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
  console.log('Required commands:');
  console.log('  npm run game:home-field:preflight-chibi-proof');
  console.log('  npm run game:home-field:next-chibi-proof');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --reference');
  console.log('  npm run game:home-field:verify-chibi-proof-files -- --frames');
  console.log('  npm run game:home-field:produce-chibi-candidate -- thalla --resize --chroma-key=#ff00ff');
  console.log('  HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-alpha-halo --check-readability --check-chibi-animation');
  console.log('  npm run game:home-field:chibi-candidate-preview');
  console.log('');
  console.log('Required paths:');
  console.log(`  reference: ${referencePath} (${exists(referencePath) ? 'exists' : 'missing'})`);
  console.log(`  raw frames: ${existingFrameCount}/${framePaths.length} present`);
  console.log(`  candidate: ${candidatePath} (${exists(candidatePath) ? 'exists' : 'missing'})`);
  console.log('');
  console.log('Frame contract: 4 directions x (2 idle + 6 walk) = 32 isolated character-only frames.');
  console.log('Shadow contract: no baked shadow in chibi frames; use the separate chibi_shadow renderer/asset layer.');
}

main();
