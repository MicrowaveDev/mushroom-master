#!/usr/bin/env node
/**
 * Read-only preflight for the Thalla Home Field chibi proof.
 *
 * The proof pipeline must produce real PNG files under .agent/home-field-workspace.
 * The proof cannot continue from chat-visible images alone. It needs a real
 * PNG that the filesystem pipeline can hash, split, validate, and preview.
 * Current Thalla reference generation also needs real reference-image input
 * binding; merely viewing local PNGs in the agent chat context is not enough.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../shared/repo-root.js';

const requiredReferencePath = '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png';
const requiredStateSheetPath = '.agent/home-field-workspace/raw/thalla_chibi.states.source.png';
const requiredFramePaths = ['down', 'up', 'left', 'right'].flatMap((dir) => [
  `.agent/home-field-workspace/raw/thalla_chibi.frame_idle_${dir}_0.source.png`,
  `.agent/home-field-workspace/raw/thalla_chibi.frame_idle_${dir}_1.source.png`,
  ...Array.from({ length: 6 }, (_, idx) => `.agent/home-field-workspace/raw/thalla_chibi.frame_walk_${dir}_${idx}.source.png`)
]);

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

function normalizeRepoRelative(inputPath) {
  const resolved = path.resolve(repoRoot, inputPath);
  return path.relative(repoRoot, resolved).split(path.sep).join('/');
}

function main() {
  const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex');
  const cliPath = path.join(codexHome, 'skills/.system/imagegen/scripts/image_gen.py');
  const hasCli = fileExists(cliPath);
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
  const cliReady = hasCli && hasApiKey;
  const builtinDisabled = process.env.HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN === '1';
  const builtinDiskConfirmed = process.env.HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE === '1';
  const builtinReferencesConfirmed = process.env.HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES === '1';
  const builtinReady = builtinDiskConfirmed && builtinReferencesConfirmed && !builtinDisabled;
  const localInputs = parseLocalInputs(process.env.HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS);
  const missingLocalInputs = localInputs.filter((inputPath) => !fileExists(path.resolve(repoRoot, inputPath)));
  const rejectedLocalInputs = localInputs.filter((inputPath) => normalizeRepoRelative(inputPath).startsWith('docs/reference/home-field/'));
  const localInputsReady = localInputs.length > 0 && missingLocalInputs.length === 0 && rejectedLocalInputs.length === 0;
  const ok = cliReady || builtinReady || localInputsReady;

  console.log('# Home Field Chibi Proof Preflight');
  console.log('');
  console.log(`Repository: ${repoRoot}`);
  console.log(`Reference output path: ${requiredReferencePath}`);
  console.log(`State sheet output path: ${requiredStateSheetPath}`);
  console.log(`Raw frame output slots: ${requiredFramePaths.length}`);
  console.log('');
  console.log('Output capability:');
  console.log(`- imagegen CLI helper: ${hasCli ? cliPath : 'missing'}`);
  console.log(`- OPENAI_API_KEY: ${hasApiKey ? 'set' : 'missing'}`);
  console.log(`- CLI fallback ready: ${cliReady ? 'yes' : 'no'}`);
  console.log(`- built-in Codex Desktop imagegen proof-art ready: ${builtinReady ? 'yes' : 'no'}`);
  console.log(`- built-in imagegen disk save explicitly confirmed: ${builtinDiskConfirmed ? 'yes' : 'no'}`);
  console.log(`- built-in imagegen reference-input explicitly confirmed: ${builtinReferencesConfirmed ? 'yes' : 'no'}`);
  console.log(`- local image inputs supplied: ${localInputs.length}`);
  if (missingLocalInputs.length > 0) {
    console.log(`- missing local image inputs: ${missingLocalInputs.join(', ')}`);
  }
  if (rejectedLocalInputs.length > 0) {
    console.log(`- rejected local image inputs: ${rejectedLocalInputs.join(', ')}`);
  }

  if (!ok) {
    console.error('');
    console.error('Preflight failed: no allowed reference-capable way to produce image PNGs for the required repo paths.');
    console.error('');
    console.error('Before archiving stale Thalla raw/candidate files, provide one of:');
    console.error('- HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 and HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1 after confirming built-in image_gen writes discoverable PNG files and can attach the checked-in reference PNGs as actual image inputs from the same agent context that will run imagegen');
    console.error('- OPENAI_API_KEY with the installed imagegen CLI helper, after the user explicitly requests CLI fallback and the path can use the required local/reference image inputs');
    console.error(`- HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS with existing proof source PNG paths separated by ${JSON.stringify(path.delimiter)}, not checked-in docs/reference style images`);
    console.error('');
    console.error('Fresh Codex sessions do not inherit HOME_FIELD_* flags from prior chats. If the launcher/user explicitly confirmed built-in save plus reference-image input support for this same session, rerun this preflight with HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1.');
    console.error('');
    console.error('Viewing PNGs with view_image or mentioning them in the text prompt is not reference-image binding.');
    if (rejectedLocalInputs.length > 0) {
      console.error('The checked-in docs/reference PNGs are style/reference material only. They are not supplied proof source PNGs and must not be used to bypass reference-capable imagegen.');
    }
    console.error('');
    if (!builtinDisabled && !builtinReferencesConfirmed) {
      console.error('Do not run the built-in output diagnostic yet: it proves disk capture only and cannot unblock this Thalla proof until reference-image input binding is confirmed.');
      console.error('First provide a reference-capable imagegen path, supplied local proof source PNG inputs outside docs/reference, or explicit reference-capable CLI fallback.');
    } else if (!builtinDisabled && !builtinDiskConfirmed) {
      console.error('Because reference-image input binding is already confirmed and built-in disk capture is the remaining blocker, run one tiny diagnostic non-candidate image_gen probe in this same agent context, then run `npm run game:home-field:find-imagegen-output -- --since-minutes=5`.');
      console.error('Count only a file newer than the probe start; use `--include-temp` for one bounded retry. If a file is found, rerun this preflight with HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 plus HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1.');
    }
    console.error('Do not archive stale files before preflight passes.');
    process.exit(1);
  }

  console.log('');
  console.log('Preflight passed: an image output path is available. It is safe to run `npm run game:home-field:archive-stale-chibi-proof -- thalla` and start the documented regeneration flow.');
  if (builtinReady) {
    console.log('Note: using Codex Desktop built-in image_gen only because disk save and reference-image input binding were explicitly confirmed; save and verify each generated PNG at the documented repo path before producer/validation steps.');
  }
}

main();
