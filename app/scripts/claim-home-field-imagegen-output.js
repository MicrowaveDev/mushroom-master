#!/usr/bin/env node
/**
 * Claim the newest bounded Codex imagegen output into a Home Field proof path.
 *
 * This wraps the repeated "find generated file, copy it, hash it, verify it"
 * proof step without scanning unrelated user folders.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../shared/repo-root.js';
import { fileSha256 } from './lib/bitmap-image-toolkit.js';

const imageExts = new Set(['.png', '.webp', '.jpg', '.jpeg']);
const verifyStages = new Set(['reference', 'state-sheet', 'frames', 'candidate']);
const verifyDestinations = new Map([
  ['reference', '.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png'],
  ['state-sheet', '.agent/home-field-workspace/raw/thalla_chibi.states.source.png'],
  ['candidate', '.agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png']
]);

function usage() {
  console.log(`Usage: claim-home-field-imagegen-output --since=<iso> --dest=<path> [--verify=reference|state-sheet|frames|candidate]

Finds image files newer than --since in bounded Codex/OpenAI output roots,
copies the newest one to --dest, records hashes, and optionally runs
game:home-field:verify-chibi-proof-files for the matching proof stage.

Options:
  --since=<iso>          Required unless --since-minutes is used. Only files newer than this timestamp count.
  --since-minutes=<n>    Relative fallback window. Prefer --since for proof runs.
  --dest=<path>          Required destination under this repository.
  --verify=<stage>       Optional verifier stage: reference, state-sheet, frames, or candidate.
  --root=<path>          Extra bounded root. May be repeated; use path.delimiter inside npm if needed.
  --include-temp         Include /private/var/folders as one bounded macOS temp retry.
  --limit=<n>            Number of newer candidates to list in the manifest. Default: 10.
`);
}

function optionValue(argv, name) {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`) || (name === 'h' && argv.includes('-h'));
}

function parseListArg(argv, name) {
  const values = [];
  const prefix = `--${name}=`;
  for (const arg of argv) {
    if (!arg.startsWith(prefix)) continue;
    values.push(...arg.slice(prefix.length).split(path.delimiter).map((entry) => entry.trim()).filter(Boolean));
  }
  return values;
}

function parseCutoff(argv) {
  const since = optionValue(argv, 'since');
  if (since) {
    const ms = Date.parse(since);
    if (!Number.isFinite(ms)) throw new Error(`--since must be an ISO timestamp, got "${since}"`);
    return { cutoffMs: ms, label: since };
  }
  const sinceMinutesRaw = optionValue(argv, 'since-minutes');
  if (sinceMinutesRaw) {
    const minutes = Number(sinceMinutesRaw);
    if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('--since-minutes must be a positive number');
    return {
      cutoffMs: Date.now() - (minutes * 60 * 1000),
      label: `${minutes} minute(s) ago`
    };
  }
  throw new Error('missing required --since=<iso> (or --since-minutes=<n> for diagnostics)');
}

function safeRelative(filePath) {
  const rel = path.relative(repoRoot, filePath);
  return rel.startsWith('..') ? filePath : rel;
}

function walkImages(root, { maxDepth, cutoffMs, out }) {
  if (!root || !fs.existsSync(root)) return;
  const resolvedRoot = path.resolve(root);
  const stack = [{ dir: resolvedRoot, depth: 0 }];
  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (entry.isDirectory()) {
        if (depth < maxDepth) stack.push({ dir: fullPath, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile() || !imageExts.has(path.extname(entry.name).toLowerCase())) continue;
      if (stat.mtimeMs <= cutoffMs) continue;
      out.push({
        path: fullPath,
        mtime: new Date(stat.mtimeMs).toISOString(),
        bytes: stat.size,
        sha256: fileSha256(fullPath)
      });
    }
  }
}

function findNewerImages(argv, cutoffMs, limit) {
  const home = process.env.HOME || '';
  const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
  const roots = [
    path.join(codexHome, 'generated_images'),
    path.join(codexHome, 'images'),
    path.join(home, 'Library', 'Application Support', 'Codex'),
    path.join(home, 'Library', 'Caches', 'Codex'),
    path.join(home, 'Library', 'Application Support', 'OpenAI'),
    path.join(home, 'Library', 'Caches', 'OpenAI'),
    ...parseListArg(argv, 'root')
  ];
  if (hasFlag(argv, 'include-temp')) roots.push('/private/var/folders');

  const found = [];
  for (const root of roots) {
    walkImages(root, {
      maxDepth: root === '/private/var/folders' ? 8 : 6,
      cutoffMs,
      out: found
    });
  }

  found.sort((a, b) => Date.parse(b.mtime) - Date.parse(a.mtime));
  const unique = [];
  const seen = new Set();
  for (const entry of found) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    unique.push(entry);
    if (unique.length >= limit) break;
  }
  return unique;
}

function runVerifier(stage) {
  const result = spawnSync('npm', [
    'run',
    'game:home-field:verify-chibi-proof-files',
    '--',
    `--${stage}`
  ], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`verify-chibi-proof-files -- --${stage} failed with status ${result.status}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    usage();
    return;
  }

  try {
    const { cutoffMs, label } = parseCutoff(argv);
    const dest = optionValue(argv, 'dest');
    if (!dest) throw new Error('missing required --dest=<path>');
    const verify = optionValue(argv, 'verify');
    if (verify && !verifyStages.has(verify)) {
      throw new Error(`--verify must be one of ${[...verifyStages].join('|')}`);
    }
    const limit = Number(optionValue(argv, 'limit') || 10);
    if (!Number.isFinite(limit) || limit < 1) throw new Error('--limit must be a positive number');

    const candidates = findNewerImages(argv, cutoffMs, limit);
    if (candidates.length === 0) {
      console.error(`home-field imagegen claim: no newer image files found after ${label}`);
      process.exit(1);
    }

    const selected = candidates[0];
    const destAbs = path.resolve(repoRoot, dest);
    const destRel = path.relative(repoRoot, destAbs);
    if (destRel.startsWith('..') || path.isAbsolute(destRel)) {
      throw new Error('--dest must resolve inside this repository');
    }
    if (destRel.startsWith(`web${path.sep}public${path.sep}home-field${path.sep}`)) {
      throw new Error('--dest must not point at app-facing web/public/home-field output; use candidate/reference/raw proof paths');
    }
    const normalizedDestRel = destRel.split(path.sep).join('/');
    const expectedDest = verifyDestinations.get(verify);
    if (expectedDest && normalizedDestRel !== expectedDest) {
      throw new Error(`--verify=${verify} requires --dest=${expectedDest}`);
    }
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(selected.path, destAbs);
    const destStat = fs.statSync(destAbs);
    const claim = {
      schemaVersion: 1,
      claimedAt: new Date().toISOString(),
      cutoff: new Date(cutoffMs).toISOString(),
      selected,
      destination: {
        path: safeRelative(destAbs),
        bytes: destStat.size,
        sha256: fileSha256(destAbs)
      },
      newerCandidates: candidates,
      verify: verify || null
    };

    const manifestDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'manifests');
    fs.mkdirSync(manifestDir, { recursive: true });
    const stamp = claim.claimedAt.replace(/[:.]/g, '-');
    const manifestPath = path.join(manifestDir, `imagegen-claim-${stamp}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(claim, null, 2));

    console.log(`home-field imagegen claim: copied ${selected.path}`);
    console.log(`  dest: ${claim.destination.path}`);
    console.log(`  dest sha256: ${claim.destination.sha256}`);
    console.log(`  manifest: ${safeRelative(manifestPath)}`);
    if (verify) runVerifier(verify);
  } catch (err) {
    console.error(`home-field imagegen claim: FAIL - ${err.message}`);
    process.exit(1);
  }
}

main();
