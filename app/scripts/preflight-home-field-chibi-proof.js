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

function usage() {
  return [
    'Usage: npm run game:home-field:preflight-chibi-proof -- [--env-file=<path>]',
    '',
    'Checks whether the current Thalla chibi proof run has an allowed way to produce real PNG files.',
    '',
    'Options:',
    '  --env-file=<path>  Load OPENAI_IMAGEGEN_API_KEY and related imagegen env from an explicit file before checking API fallback readiness.'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    envFile: ''
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (arg.startsWith('--env-file=')) {
      opts.envFile = arg.slice('--env-file='.length);
    } else {
      throw new Error(`Unexpected argument: ${arg}\n\n${usage()}`);
    }
  }
  return opts;
}

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

function resolveInputPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(repoRoot, inputPath);
}

function parseEnvFile(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const envFromFile = opts.envFile ? parseEnvFile(resolveInputPath(opts.envFile)) : {};
  const effectiveEnv = { ...process.env, ...envFromFile };
  const codexHome = effectiveEnv.CODEX_HOME || path.join(effectiveEnv.HOME || '', '.codex');
  const cliPath = path.join(codexHome, 'skills/.system/imagegen/scripts/image_gen.py');
  const hasCli = fileExists(cliPath);
  const hasImagegenApiKey = Boolean(effectiveEnv.OPENAI_IMAGEGEN_API_KEY);
  const hasImagegenApiKeyFromEnvFile = Boolean(envFromFile.OPENAI_IMAGEGEN_API_KEY);
  const hasPlainOpenAiApiKey = Boolean(effectiveEnv.OPENAI_API_KEY);
  const apiFallbackUnavailableConfirmed = effectiveEnv.HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE === '1';
  const cliReady = hasCli && hasImagegenApiKey && apiFallbackUnavailableConfirmed;
  const builtinDisabled = effectiveEnv.HOME_FIELD_DISABLE_BUILTIN_IMAGEGEN === '1';
  const builtinDiskConfirmed = effectiveEnv.HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE === '1';
  const builtinReferencesConfirmed = effectiveEnv.HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES === '1';
  const builtinReady = builtinDiskConfirmed && builtinReferencesConfirmed && !builtinDisabled;
  const localInputs = parseLocalInputs(effectiveEnv.HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS);
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
  console.log(`Explicit env file: ${opts.envFile ? path.relative(repoRoot, resolveInputPath(opts.envFile)) : 'not used'}`);
  console.log('');
  console.log('Output capability:');
  console.log(`- imagegen CLI helper: ${hasCli ? cliPath : 'missing'}`);
  console.log(`- OPENAI_IMAGEGEN_API_KEY: ${hasImagegenApiKey ? (hasImagegenApiKeyFromEnvFile ? 'set from explicit env file' : 'set') : 'missing'}`);
  console.log(`- OPENAI_API_KEY: ${hasPlainOpenAiApiKey ? 'present but ignored for Home Field image generation' : 'not used'}`);
  console.log(`- imagegen skill unavailable explicitly confirmed: ${apiFallbackUnavailableConfirmed ? 'yes' : 'no'}`);
  console.log(`- API fallback ready: ${cliReady ? 'yes' : 'no'}`);
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
    console.error('- HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 and HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1 after confirming built-in image_gen writes discoverable PNG files and can attach/use the checked-in reference PNGs as actual image inputs from the same agent context that will run imagegen');
    console.error('- HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1 plus OPENAI_IMAGEGEN_API_KEY with the installed imagegen CLI helper, preferably loaded through `npm run game:home-field:preflight-chibi-proof -- --env-file=<explicit-env-file>`, only when built-in/imagegen skill output is unavailable for this run');
    console.error(`- HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS with existing proof source PNG paths separated by ${JSON.stringify(path.delimiter)}, not checked-in docs/reference style images`);
    console.error('');
    console.error('Fresh Codex sessions do not inherit HOME_FIELD_* flags from prior chats. Prefer built-in/imagegen skill output when it can save files and attach/use reference inputs. For the built-in path, first make the local reference PNGs visible to the same imagegen context using the current imagegen skill instructions, then run the built-in image_gen call in that same context. If using explicit API fallback, rerun this preflight with `--env-file=<explicit-env-file>` containing OPENAI_IMAGEGEN_API_KEY and HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1. If the launcher/user explicitly confirmed built-in save plus reference-image input support for this same session, rerun this preflight with HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1.');
    console.error('');
    console.error('Plain OPENAI_API_KEY is intentionally ignored for Home Field image generation; set OPENAI_IMAGEGEN_API_KEY only for an explicit paid API fallback.');
    console.error('');
    console.error('Passive viewing is not enough: a view_image step counts only when it is the current imagegen skill\'s same-context input-staging step and the following built-in image_gen call explicitly uses those visible images as references.');
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

try {
  main();
} catch (err) {
  console.error(`Preflight failed: ${err.message}`);
  process.exit(1);
}
