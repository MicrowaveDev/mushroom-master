#!/usr/bin/env node
/**
 * Archive live Thalla chibi proof files only after chibi preflight passes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../../shared/repo-root.js';
import { fileSha256 } from '../lib/bitmap-image-toolkit.js';

const workspace = path.join(repoRoot, '.agent', 'home-field-workspace');
const supportedIds = new Set(['thalla']);

function usage() {
  console.log(`Usage: archive-home-field-chibi-proof <id>

Runs game:home-field:preflight-chibi-proof with the current environment or an
explicit env file. Only after preflight passes, moves the exact live chibi proof
paths for <id> into .agent/home-field-workspace/rejected/<id>-chibi-proof-<timestamp>/
and writes an archive manifest. Supported id: thalla.

Options:
  --env-file=<path>  Pass an explicit imagegen env file through to preflight.
  --source=<png>     Pass one supplied complete local state-sheet PNG through to preflight.
`);
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`) || (name === 'h' && argv.includes('-h'));
}

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function parseArgs(argv) {
  const opts = {
    id: '',
    preflightArgs: []
  };
  for (const arg of argv) {
    if (arg.startsWith('--env-file=')) {
      opts.preflightArgs.push(arg);
    } else if (arg.startsWith('--source=')) {
      opts.preflightArgs.push(arg);
    } else if (!arg.startsWith('-') && !opts.id) {
      opts.id = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return opts;
}

function runPreflight(preflightArgs) {
  const args = ['run', 'game:home-field:preflight-chibi-proof'];
  if (preflightArgs.length > 0) args.push('--', ...preflightArgs);
  const result = spawnSync('npm', args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8'
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error('preflight failed; no stale chibi proof files were archived');
  }
}

function listRawFiles(prefix) {
  const rawDir = path.join(workspace, 'raw');
  if (!fs.existsSync(rawDir)) return [];
  return fs.readdirSync(rawDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.source.png'))
    .map((name) => path.join(rawDir, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .sort();
}

function movePath(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    fs.cpSync(src, dest, { recursive: true, force: false, errorOnExist: true });
    fs.rmSync(src, { recursive: true, force: true });
  }
}

function statEntry(src, category, dest) {
  const stat = fs.statSync(src);
  const entry = {
    category,
    from: rel(src),
    to: rel(dest),
    type: stat.isDirectory() ? 'directory' : 'file'
  };
  if (stat.isFile()) {
    entry.bytes = stat.size;
    entry.sha256 = fileSha256(src);
  }
  return entry;
}

function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    usage();
    return;
  }

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    console.error(`Usage error: ${err.message}`);
    usage();
    process.exit(1);
  }

  const id = parsed.id;
  if (!id || !supportedIds.has(id)) {
    console.error(`Usage error: expected supported chibi id (${[...supportedIds].join(', ')})`);
    usage();
    process.exit(1);
  }

  try {
    runPreflight(parsed.preflightArgs);

    const prefix = `${id}_chibi`;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveRoot = path.join(workspace, 'rejected', `${id}-chibi-proof-${stamp}`);
    if (fs.existsSync(archiveRoot)) throw new Error(`archive root already exists: ${rel(archiveRoot)}`);

    const moves = [];
    for (const raw of listRawFiles(prefix)) {
      moves.push({ category: 'raw', src: raw, dest: path.join(archiveRoot, 'raw', path.basename(raw)) });
    }

    const reference = path.join(workspace, 'reference', `${prefix}_turnaround.reference.png`);
    if (fs.existsSync(reference)) {
      moves.push({ category: 'reference', src: reference, dest: path.join(archiveRoot, 'reference', path.basename(reference)) });
    }

    const candidate = path.join(workspace, 'candidates', 'chibi-active-roster', 'latest');
    if (fs.existsSync(candidate)) {
      moves.push({ category: 'candidate', src: candidate, dest: path.join(archiveRoot, 'candidate', 'latest') });
    }

    const entries = moves.map(({ src, dest, category }) => statEntry(src, category, dest));
    for (const move of moves) movePath(move.src, move.dest);

    fs.mkdirSync(archiveRoot, { recursive: true });
    const manifest = {
      schemaVersion: 1,
      archivedAt: new Date().toISOString(),
      id,
      policy: 'preflight passed before moving live stale proof files',
      archiveRoot: rel(archiveRoot),
      moved: entries
    };
    const manifestPath = path.join(archiveRoot, 'archive-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`home-field stale chibi proof archive: ${entries.length} item(s) moved`);
    console.log(`  archive: ${rel(archiveRoot)}`);
    console.log(`  manifest: ${rel(manifestPath)}`);
    for (const entry of entries) {
      console.log(`  ${entry.category}: ${entry.from} -> ${entry.to}`);
    }
  } catch (err) {
    console.error(`home-field stale chibi proof archive: FAIL - ${err.message}`);
    process.exit(1);
  }
}

main();
