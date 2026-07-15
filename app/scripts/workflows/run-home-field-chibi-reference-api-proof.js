#!/usr/bin/env node
/**
 * One-shot reference-capable CLI/API proof for the Thalla chibi sprite-box gate.
 *
 * This helper replaces the repeated ad hoc sequence of: find an env file, set up a
 * Python SDK environment, copy the reference prompt, call image_gen.py edit with
 * three --image inputs, resize the API-sized result, then run verifier/audit.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { atomicWriteFile } from '@microwavedev/backpack-game-core/tooling/evidence';
import { runChildProcessSync } from '@microwavedev/backpack-game-core/tooling/runners';
import { repoRoot } from '../../shared/repo-root.js';
import {
  encodeDeterministicPng,
  readPngAsRgba,
  readPngHeader
} from '../lib/bitmap-image-toolkit.js';
import { resizeRasterBox } from '@microwavedev/backpack-game-core/tooling/raster';

const referencePath = '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png';
const apiSourcePath = '.agent/home-field-workspace/reference/thalla_chibi_turnaround.api-source.png';
const promptPath = '.agent/home-field-workspace/review/thalla-reference-prompt.txt';
const auditPath = '.agent/home-field-workspace/review/thalla-reference-palette-audit.json';
const swatchPath = '.agent/home-field-workspace/review/thalla-reference-palette-swatch.png';
const blockerPath = '.agent/home-field-workspace/review/thalla-reference-gate-blocker.md';
const defaultVenvPath = '.agent/home-field-workspace/.imagegen-venv';
const imageInputs = [
  'docs/reference/home-field/chibi-thalla-previous-best-2026-06-26-state-sheet.png',
  'docs/reference/home-field/chibi-thalla-liked-2026-06-23.png',
  'docs/reference/home-field/chibi-style-agent-log-reference.png'
];

function usage() {
  return [
    'Usage: npm run game:home-field:chibi-reference-api-proof -- --env-file=<path> [options]',
    '',
    'Runs one paid API fallback Thalla sprite-box reference attempt through image_gen.py edit.',
    '',
    'Required for real API calls:',
    '  --env-file=<path>          explicit env file containing OPENAI_IMAGEGEN_API_KEY and HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1',
    '',
    'Options:',
    '  --dry-run                  print the planned command/gates without writing files or calling the API',
    '  --allow-process-env        allow OPENAI_IMAGEGEN_API_KEY plus HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE from the current process env instead of --env-file',
    '  --venv=<path>              local ignored Python venv path (default .agent/home-field-workspace/.imagegen-venv)',
    '  --python=<path>            Python executable to use instead of the helper venv',
    '  --model=<name>             image model (default gpt-image-2)',
    '  --quality=<q>              image quality (default medium)',
    '  --size=<WxH>               API request size (default 1024x768)',
    '  --normalize-reference=<WxH> resize API output before verifier/audit (default 512x384)',
    '  --no-normalize-reference   verify/audit the API output size directly',
    '  --skip-venv-install        do not install the Python openai SDK if missing',
    '',
    'The helper serializes verifier and palette audit. Palette bloat is a blocker.'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    allowProcessEnv: false,
    envFile: '',
    venv: defaultVenvPath,
    python: '',
    model: 'gpt-image-2',
    quality: 'medium',
    size: '1024x768',
    normalizeReference: '512x384',
    skipVenvInstall: false
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--allow-process-env') {
      opts.allowProcessEnv = true;
    } else if (arg.startsWith('--env-file=')) {
      opts.envFile = arg.slice('--env-file='.length);
    } else if (arg.startsWith('--venv=')) {
      opts.venv = arg.slice('--venv='.length);
    } else if (arg.startsWith('--python=')) {
      opts.python = arg.slice('--python='.length);
    } else if (arg.startsWith('--model=')) {
      opts.model = arg.slice('--model='.length);
    } else if (arg.startsWith('--quality=')) {
      opts.quality = arg.slice('--quality='.length);
    } else if (arg.startsWith('--size=')) {
      opts.size = arg.slice('--size='.length);
    } else if (arg.startsWith('--normalize-reference=')) {
      opts.normalizeReference = arg.slice('--normalize-reference='.length);
    } else if (arg === '--no-normalize-reference') {
      opts.normalizeReference = '';
    } else if (arg === '--skip-venv-install') {
      opts.skipVenvInstall = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}\n\n${usage()}`);
    }
  }
  if (!/^\d+x\d+$/.test(opts.size)) throw new Error('--size must be WIDTHxHEIGHT');
  if (opts.normalizeReference && !/^\d+x\d+$/.test(opts.normalizeReference)) {
    throw new Error('--normalize-reference must be WIDTHxHEIGHT');
  }
  return opts;
}

function resolveRepoPath(p) {
  return path.resolve(repoRoot, p);
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

function run(command, args, { env = process.env, allowFailure = false, capture = false } = {}) {
  return runChildProcessSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    allowFailure
  });
}

function bundledPythonPath() {
  const candidate = path.join(
    process.env.HOME || '',
    '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'
  );
  return fs.existsSync(candidate) ? candidate : 'python3';
}

function ensurePython(opts, env) {
  if (opts.python) return opts.python;
  const venvPython = path.resolve(repoRoot, opts.venv, 'bin/python');
  if (!fs.existsSync(venvPython)) {
    if (opts.skipVenvInstall) {
      throw new Error(`Python venv missing at ${opts.venv}; rerun without --skip-venv-install`);
    }
    run(bundledPythonPath(), ['-m', 'venv', opts.venv], { env });
  }
  const importCheck = run(venvPython, ['-c', 'import openai'], { env, allowFailure: true, capture: true });
  if (importCheck.status !== 0) {
    if (opts.skipVenvInstall) {
      throw new Error(`Python openai SDK missing in ${opts.venv}; rerun without --skip-venv-install`);
    }
    run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'openai'], { env });
  }
  return venvPython;
}

function extractReferencePrompt() {
  const result = run('npm', ['run', 'game:home-field:next', '--', '--preset=chibi-proof', '--show-fallbacks'], { capture: true });
  const match = result.stdout.match(/## Copyable Sprite-Box Reference Prompt[\s\S]*?```text\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error('Could not extract Copyable Sprite-Box Reference Prompt from the queue-owned chibi prompt renderer');
  }
  return match[1].trimEnd();
}

function writeBlockerNote({ verifierResult, paletteResult, normalized, promptSha }) {
  let auditSummary = 'palette audit JSON was not written';
  if (fs.existsSync(resolveRepoPath(auditPath))) {
    try {
      const audit = JSON.parse(fs.readFileSync(resolveRepoPath(auditPath), 'utf8'));
      auditSummary = [
        `source sha256: \`${audit.source?.sha256 || 'unknown'}\``,
        `exact significant colors: \`${audit.counts?.exactColorsAtLeastSignificantThreshold ?? 'unknown'}\``,
        `minor colors: \`${audit.counts?.exactColorsAtLeastMinorThreshold ?? 'unknown'}\``,
        `coarse 32-step bins: \`${audit.counts?.coarseBins?.step32?.atLeastSignificantThreshold ?? 'unknown'}\``,
        `budget status: \`${audit.budget?.status || 'unknown'}\``
      ].join('\n- ');
    } catch {
      auditSummary = 'palette audit JSON was written but could not be parsed';
    }
  }
  const lines = [
    '# Thalla Chibi Reference API Proof Blocker',
    '',
    'Run scope: Thalla Stage 1 chibi proof reference gate. App-facing assets were not overwritten by this helper.',
    '',
    'Method: reference-capable CLI/API fallback through `image_gen.py edit` with the three checked-in PNGs passed as actual `--image` inputs.',
    `Prompt file: \`${promptPath}\` (sha256 \`${promptSha}\`)`,
    `API source path: \`${apiSourcePath}\``,
    `Verified reference path: \`${referencePath}\``,
    normalized ? 'Normalization: API output was resized to `512x384` before verifier/audit.' : 'Normalization: disabled; verifier/audit used the API output size directly.',
    '',
    `Verifier status: ${verifierResult.status === 0 ? 'PASS' : `FAIL (${verifierResult.status})`}`,
    verifierResult.stderr ? verifierResult.stderr.trim() : '(no verifier stderr)',
    '',
    `Palette status: ${paletteResult.status === 0 ? 'PASS' : `FAIL (${paletteResult.status})`}`,
    paletteResult.stdout ? paletteResult.stdout.trim() : '(no palette stdout)',
    '',
    'Palette summary:',
    `- ${auditSummary}`,
    '',
    'Stop condition: do not generate grouped state sheets, split frames, candidate spritesheets, previews, or verdicts until the reference verifier and palette audit both pass.'
  ];
  fs.mkdirSync(path.dirname(resolveRepoPath(blockerPath)), { recursive: true });
  atomicWriteFile(resolveRepoPath(blockerPath), `${lines.join('\n')}\n`);
}

function fileHash(filePath) {
  const { sha256 } = readPngHeader(filePath);
  return sha256;
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const promptText = extractReferencePrompt();
    const outputPath = opts.normalizeReference ? apiSourcePath : referencePath;

    console.log('# Thalla Chibi Reference API Proof');
    console.log(`reference prompt chars: ${promptText.length}`);
    console.log(`image inputs: ${imageInputs.join(', ')}`);
    console.log(`api output: ${outputPath}`);
    console.log(`verified reference: ${referencePath}`);
    console.log(`normalization: ${opts.normalizeReference || 'disabled'}`);
    console.log('palette audit uses --fail-on-bloat; palette bloat blocks the flow.');

    if (opts.dryRun) {
      console.log('dry-run: no prompt file, API image, venv, verifier, palette audit, or blocker note was written.');
      console.log(`would write prompt file: ${promptPath}`);
      console.log(`would run image_gen.py edit --model ${opts.model} --quality ${opts.quality} --size ${opts.size} --no-augment --prompt-file ${promptPath} ${imageInputs.map((p) => `--image ${p}`).join(' ')} --out ${outputPath} --force`);
      console.log('would run verifier before palette audit, then palette audit with --fail-on-bloat.');
      return;
    }

    const envFromFile = opts.envFile ? parseEnvFile(resolveRepoPath(opts.envFile)) : {};
    if (!opts.envFile && !opts.allowProcessEnv) {
      throw new Error('Real API calls require explicit --env-file=<path>, or --allow-process-env when OPENAI_IMAGEGEN_API_KEY and HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1 are already exported.');
    }
    const env = { ...process.env, ...envFromFile };
    if (!env.OPENAI_IMAGEGEN_API_KEY) {
      throw new Error('OPENAI_IMAGEGEN_API_KEY is missing after loading the selected environment. Plain OPENAI_API_KEY is ignored for Home Field image generation.');
    }
    if (env.HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE !== '1') {
      throw new Error('API fallback requires HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1 after confirming built-in/imagegen skill output is unavailable for this run.');
    }
    const apiEnv = {
      ...env,
      OPENAI_API_KEY: env.OPENAI_IMAGEGEN_API_KEY
    };

    const python = ensurePython(opts, apiEnv);
    fs.mkdirSync(path.dirname(resolveRepoPath(promptPath)), { recursive: true });
    atomicWriteFile(resolveRepoPath(promptPath), `${promptText}\n`);
    const promptSha = fileHashLike(resolveRepoPath(promptPath));

    fs.mkdirSync(path.dirname(resolveRepoPath(outputPath)), { recursive: true });
    const imageGenPath = path.join(process.env.HOME || '', '.codex/skills/.system/imagegen/scripts/image_gen.py');
    const apiArgs = [
      imageGenPath,
      'edit',
      '--model', opts.model,
      '--quality', opts.quality,
      '--size', opts.size,
      '--no-augment',
      '--prompt-file', promptPath,
      ...imageInputs.flatMap((p) => ['--image', p]),
      '--out', outputPath,
      '--force'
    ];
    run(python, apiArgs, { env: apiEnv });

    let normalized = false;
    if (opts.normalizeReference) {
      const [w, h] = opts.normalizeReference.split('x').map(Number);
      const src = readPngAsRgba(resolveRepoPath(apiSourcePath));
      const resized = resizeRasterBox(src, w, h);
      fs.writeFileSync(resolveRepoPath(referencePath), encodeDeterministicPng(resized));
      normalized = true;
      console.log(`normalized API source ${apiSourcePath} to ${referencePath} (${w}x${h})`);
    }

    const verifierResult = run('npm', ['run', 'game:home-field:verify-chibi-proof-files', '--', '--reference'], {
      env: apiEnv,
      allowFailure: true,
      capture: true
    });
    process.stdout.write(verifierResult.stdout || '');
    process.stderr.write(verifierResult.stderr || '');

    const paletteResult = run('npm', [
      'run',
      'game:home-field:palette-audit',
      '--',
      referencePath,
      `--out=${auditPath}`,
      `--swatch=${swatchPath}`,
      '--fail-on-bloat'
    ], {
      env: apiEnv,
      allowFailure: true,
      capture: true
    });
    process.stdout.write(paletteResult.stdout || '');
    process.stderr.write(paletteResult.stderr || '');

    if (verifierResult.status !== 0 || paletteResult.status !== 0) {
      writeBlockerNote({ verifierResult, paletteResult, normalized, promptSha });
      console.error(`Reference API proof blocked; see ${blockerPath}`);
      process.exit(1);
    }

    console.log(`Reference API proof passed. Reference sha256: ${fileHash(resolveRepoPath(referencePath))}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

function fileHashLike(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

main();
