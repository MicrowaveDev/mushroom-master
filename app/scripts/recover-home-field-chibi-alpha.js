#!/usr/bin/env node
/**
 * Try bounded chroma-key tolerances for the Thalla grouped state sheet.
 */

import { spawnSync } from 'node:child_process';
import { repoRoot } from '../shared/repo-root.js';

const supportedIds = new Set(['thalla']);
const defaultTolerances = [28, 64, 96, 128, 160, 180, 182];
const candidateRoot = '.agent/home-field-workspace/candidates/chibi-active-roster/latest';

function usage() {
  console.log(`Usage: recover-home-field-chibi-alpha <id> [--tolerances=28,64,96,128,160,180,182] [--chroma-key=#ff00ff]

Re-splits the grouped chibi state sheet with each safe chroma tolerance, rebuilds
the chibi candidate, verifies frames/candidate files, and stops at the first
tolerance that passes --check-alpha-halo for the candidate root. Supported id:
thalla.
`);
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`) || (name === 'h' && argv.includes('-h'));
}

function optionValue(argv, name) {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

function parseTolerances(argv) {
  const raw = optionValue(argv, 'tolerances');
  const values = raw
    ? raw.split(',').map((item) => Number(item.trim())).filter((value) => Number.isFinite(value))
    : defaultTolerances;
  if (values.length === 0) throw new Error('--tolerances must contain at least one number');
  for (const value of values) {
    if (value < 0 || value > 182) {
      throw new Error(`unsafe chroma tolerance ${value}; keep recovery tolerances in [0, 182]`);
    }
  }
  return values;
}

function run(label, command, args, env = process.env) {
  console.log(`\n# ${label}`);
  console.log(`${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: 'inherit'
  });
  return result.status === 0;
}

function tryTolerance(id, chromaKey, tolerance) {
  const env = {
    ...process.env,
    HOME_FIELD_ASSET_ROOT: candidateRoot
  };
  return run(`split tolerance ${tolerance}`, 'npm', [
    'run',
    'game:home-field:split-chibi-state-sheet',
    '--',
    `--chroma-key=${chromaKey}`,
    `--chroma-tolerance=${tolerance}`,
    '--resize'
  ])
    && run('verify frames', 'npm', ['run', 'game:home-field:verify-chibi-proof-files', '--', '--frames'])
    && run('produce candidate', 'npm', [
      'run',
      'game:home-field:produce',
      '--',
      '--scope=chibi',
      '--candidate',
      id,
      '--resize',
      `--chroma-key=${chromaKey}`
    ])
    && run('verify candidate', 'npm', ['run', 'game:home-field:verify-chibi-proof-files', '--', '--candidate'])
    && run('validate alpha halo', 'npm', [
      'run',
      'game:home-field:validate',
      '--',
      `--ids=${id}`,
      '--check-files',
      '--check-alpha-halo'
    ], env);
}

function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    usage();
    return;
  }
  const id = argv.find((arg) => !arg.startsWith('-'));
  if (!id || !supportedIds.has(id)) {
    console.error(`Usage error: expected supported chibi id (${[...supportedIds].join(', ')})`);
    usage();
    process.exit(1);
  }

  try {
    const tolerances = parseTolerances(argv);
    const chromaKey = optionValue(argv, 'chroma-key') || '#ff00ff';
    for (const tolerance of tolerances) {
      if (tryTolerance(id, chromaKey, tolerance)) {
        console.log(`\nhome-field chibi alpha recovery: PASS tolerance=${tolerance}`);
        return;
      }
      console.log(`\nhome-field chibi alpha recovery: tolerance=${tolerance} did not pass; trying next safe tolerance`);
    }
    console.error(`home-field chibi alpha recovery: FAIL after tolerances ${tolerances.join(', ')}`);
    process.exit(1);
  } catch (err) {
    console.error(`home-field chibi alpha recovery: FAIL - ${err.message}`);
    process.exit(1);
  }
}

main();
