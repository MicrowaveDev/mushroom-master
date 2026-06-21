#!/usr/bin/env node
/**
 * Read-only preflight for the Thalla Home Field chibi proof.
 *
 * The proof pipeline must produce real PNG files under .agent/home-field-workspace.
 * This check prevents agents from archiving stale candidates before confirming the
 * current environment can materialize imagegen output on disk.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../shared/repo-root.js';

const requiredReferencePath = '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png';
const requiredFramePaths = [
  '.agent/home-field-workspace/raw/thalla_chibi.frame_idle_down_0.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_idle_down_1.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_walk_down.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_idle_up_0.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_idle_up_1.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_walk_up.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_idle_left_0.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_idle_left_1.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_walk_left.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_idle_right_0.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_idle_right_1.source.png',
  '.agent/home-field-workspace/raw/thalla_chibi.frame_walk_right.source.png'
];

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function parseLocalInputs(value) {
  if (!value) return [];
  return value
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function main() {
  const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex');
  const cliPath = path.join(codexHome, 'skills/.system/imagegen/scripts/image_gen.py');
  const hasCli = fileExists(cliPath);
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
  const cliReady = hasCli && hasApiKey;
  const builtinDiskReady = process.env.HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE === '1';
  const localInputs = parseLocalInputs(process.env.HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS);
  const missingLocalInputs = localInputs.filter((inputPath) => !fileExists(path.resolve(repoRoot, inputPath)));
  const localInputsReady = localInputs.length > 0 && missingLocalInputs.length === 0;
  const ok = cliReady || builtinDiskReady || localInputsReady;

  console.log('# Home Field Chibi Proof Preflight');
  console.log('');
  console.log(`Repository: ${repoRoot}`);
  console.log(`Reference output path: ${requiredReferencePath}`);
  console.log(`Raw frame output slots: ${requiredFramePaths.length}`);
  console.log('');
  console.log('Output capability:');
  console.log(`- imagegen CLI helper: ${hasCli ? cliPath : 'missing'}`);
  console.log(`- OPENAI_API_KEY: ${hasApiKey ? 'set' : 'missing'}`);
  console.log(`- CLI fallback ready: ${cliReady ? 'yes' : 'no'}`);
  console.log(`- built-in imagegen disk save confirmed: ${builtinDiskReady ? 'yes' : 'no'}`);
  console.log(`- local image inputs supplied: ${localInputs.length}`);
  if (missingLocalInputs.length > 0) {
    console.log(`- missing local image inputs: ${missingLocalInputs.join(', ')}`);
  }

  if (!ok) {
    console.error('');
    console.error('Preflight failed: no proven way to write imagegen PNGs to the required repo paths.');
    console.error('');
    console.error('Before moving or deleting stale Thalla raw/candidate files, provide one of:');
    console.error('- OPENAI_API_KEY with the installed imagegen CLI helper');
    console.error('- HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 after confirming built-in imagegen output can be saved to disk');
    console.error(`- HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS with existing source PNG paths separated by ${JSON.stringify(path.delimiter)}`);
    process.exit(1);
  }

  console.log('');
  console.log('Preflight passed: output capability is available. It is safe to start the documented cleanup/regeneration flow.');
}

main();
