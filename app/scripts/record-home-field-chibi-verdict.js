#!/usr/bin/env node
/**
 * Record a chibi review verdict from the current candidate evidence manifest.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../shared/repo-root.js';

const supportedIds = new Set(['thalla']);
const allowedVerdicts = new Set(['needs_review', 'needs_regen', 'rejected', 'pending']);
const reviewPath = path.join(repoRoot, 'docs', 'home-field-asset-review.json');
const defaultManifestPath = path.join(repoRoot, '.agent', 'home-field-workspace', 'review', 'candidate-evidence.manifest.json');
const defaultCandidateRoot = path.join(repoRoot, '.agent', 'home-field-workspace', 'candidates', 'chibi-active-roster', 'latest');

function usage() {
  console.log(`Usage: record-home-field-chibi-verdict <id> --verdict=<needs_review|needs_regen|rejected|pending> (--reason-file=<path>|--reason=<text>|--reason-stdin) [--manifest=<path>]

Updates docs/home-field-asset-review.json for the chibi id by copying candidate,
reference, raw source, screenshot, and evidence-manifest hashes from the current
candidate-evidence.manifest.json. This helper never records approved/accepted
production sign-off. Prefer --reason-stdin for generated .agent review notes so
the verdict does not depend on creating an ignored scratch file in the right
working directory.
`);
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`) || (name === 'h' && argv.includes('-h'));
}

function optionValue(argv, name) {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveRepoPath(value) {
  return path.resolve(repoRoot, value);
}

function repoRelative(value) {
  if (!value || typeof value !== 'string') return '';
  const absolutePath = path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function isDefaultManifest(manifestPath) {
  return path.resolve(manifestPath) === defaultManifestPath;
}

function isTmpRepoPath(value) {
  const relativePath = repoRelative(value);
  return relativePath === 'tmp' || relativePath.startsWith('tmp/');
}

function candidatePathList(manifest, entry) {
  return [
    manifest.candidateRoot,
    entry.candidateOutput?.path,
    entry.rawSource?.path,
    entry.chibiSources?.reference?.path,
    entry.chibiSources?.groupedStateSheet?.path,
    ...(entry.chibiSources?.splitFrames?.frames || []).map((frame) => frame.path),
    ...(manifest.previews || []).map((preview) => preview.path)
  ].filter(Boolean);
}

function regenerationCommand() {
  return 'HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest HOME_FIELD_CANDIDATE_IDS=thalla npm run game:home-field:candidate-evidence';
}

function validateDefaultManifestFreshness(manifest, entry, manifestPath) {
  if (!isDefaultManifest(manifestPath)) return;

  const expectedRoot = repoRelative(defaultCandidateRoot);
  const actualRoot = repoRelative(manifest.candidateRoot);
  if (actualRoot !== expectedRoot) {
    throw new Error(`default candidate evidence manifest candidateRoot must be ${expectedRoot}; found ${actualRoot || '<missing>'}. Regenerate evidence with: ${regenerationCommand()}`);
  }

  const stalePath = candidatePathList(manifest, entry).find((value) => isTmpRepoPath(value));
  if (stalePath) {
    throw new Error(`default candidate evidence manifest contains stale tmp path ${repoRelative(stalePath)}. Regenerate evidence with: ${regenerationCommand()}`);
  }
}

function readReason({ reasonFile, inlineReason, reasonStdin }) {
  const sourceCount = [reasonFile, inlineReason, reasonStdin].filter(Boolean).length;
  if (sourceCount !== 1) {
    throw new Error('exactly one of --reason-file, --reason, or --reason-stdin is required');
  }
  const reason = reasonFile
    ? fs.readFileSync(resolveRepoPath(reasonFile), 'utf8')
    : reasonStdin
      ? fs.readFileSync(0, 'utf8')
      : inlineReason;
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('review reason must contain non-empty text');
  return trimmed;
}

function findHash(list, name) {
  return (list || []).find((entry) => entry.path?.endsWith(name))?.sha256 || null;
}

function setIfValue(target, key, value) {
  if (value) target[key] = value;
}

function main() {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    usage();
    return;
  }

  const id = argv.find((arg) => !arg.startsWith('-'));
  const verdict = optionValue(argv, 'verdict');
  const reasonFile = optionValue(argv, 'reason-file');
  const inlineReason = optionValue(argv, 'reason');
  const reasonStdin = hasFlag(argv, 'reason-stdin');
  const manifestFile = optionValue(argv, 'manifest') || defaultManifestPath;

  if (!id || !supportedIds.has(id)) {
    console.error(`Usage error: expected supported chibi id (${[...supportedIds].join(', ')})`);
    usage();
    process.exit(1);
  }
  if (!allowedVerdicts.has(verdict)) {
    console.error(`Usage error: --verdict must be one of ${[...allowedVerdicts].join('|')}; approved verdicts require explicit human promotion outside this helper`);
    process.exit(1);
  }

  try {
    const reason = readReason({ reasonFile, inlineReason, reasonStdin });

    const manifestAbs = resolveRepoPath(manifestFile);
    const manifest = loadJson(manifestAbs);
    const entry = (manifest.entries || []).find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`candidate evidence manifest does not contain id "${id}"`);
    validateDefaultManifestFreshness(manifest, entry, manifestAbs);

    const reviewDoc = loadJson(reviewPath);
    const review = (reviewDoc.assets || []).find((row) => row.id === id);
    if (!review) throw new Error(`docs/home-field-asset-review.json has no row for "${id}"`);

    review.verdict = verdict;
    review.accepted = false;
    review.reason = reason;
    review.candidateRoot = manifest.candidateRoot;
    review.candidateEvidenceManifest = path.relative(repoRoot, manifestAbs);
    setIfValue(review, 'candidateEvidenceSha256', manifest.manifestSha256);
    setIfValue(review, 'candidateSha256', entry.candidateOutput?.sha256);
    setIfValue(review, 'referenceSha256', entry.chibiSources?.reference?.sha256);
    setIfValue(review, 'rawSourceSha256', entry.rawSource?.sha256);
    setIfValue(review, 'mobileScreenshotSha256', findHash(manifest.previews, 'home-field-candidate-mobile-clean.png'));
    setIfValue(review, 'desktopScreenshotSha256', findHash(manifest.previews, 'home-field-candidate-desktop-clean.png'));

    fs.writeFileSync(reviewPath, `${JSON.stringify(reviewDoc, null, 2)}\n`);
    console.log(`home-field chibi verdict recorded: ${id} -> ${verdict}`);
    console.log(`  review: ${path.relative(repoRoot, reviewPath)}`);
    console.log(`  evidence: ${review.candidateEvidenceManifest}`);
    console.log(`  candidate sha256: ${review.candidateSha256 || 'missing'}`);
  } catch (err) {
    console.error(`home-field chibi verdict record: FAIL - ${err.message}`);
    process.exit(1);
  }
}

main();
