#!/usr/bin/env node
/**
 * Quick status view for the Home Field hub imagegen pipeline.
 *
 * Run:
 *   npm run game:home-field:status
 *   npm run game:home-field:status -- --pending     # only pending
 *   npm run game:home-field:status -- --done        # only done
 *   npm run game:home-field:status -- --json        # machine-readable
 *
 * Prints, per asset, whether the app-facing PNG exists and whether the schema
 * validates. Designed for an agent driving the pipeline to know in one call
 * how far along it is.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAll } from '../shared/home-field/home-field-validator.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const ASSETS_PATH = path.join(sharedDir, 'home-field-assets.json');
const MAP_PATH = path.join(sharedDir, 'home-field-map.json');
const REVIEW_PATH = path.join(repoRoot, 'docs', 'home-field-asset-review.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

function summarize(allEntries, reviewById) {
  return allEntries.map((e) => {
    const outAbs = path.join(repoRoot, e.outputPath);
    const exists = fs.existsSync(outAbs);
    const review = reviewById.get(e.id);
    return {
      id: e.id,
      type: e.type,
      kind: e.animation ? 'animated' : (e.type === 'character' ? 'spritesheet' : 'static'),
      outputPath: e.outputPath,
      fileStatus: exists ? 'done' : 'pending',
      manifestStatus: e.status,
      reviewVerdict: review?.verdict || 'unreviewed',
      accepted: review?.accepted === true
    };
  });
}

function main() {
  const argv = process.argv.slice(2);
  const onlyPending = hasFlag(argv, 'pending');
  const onlyDone = hasFlag(argv, 'done');
  const asJson = hasFlag(argv, 'json');

  const assetsDoc = loadJson(ASSETS_PATH);
  const mapDoc = loadJson(MAP_PATH);
  const reviewDoc = fs.existsSync(REVIEW_PATH) ? loadJson(REVIEW_PATH) : { assets: [] };
  const reviewById = new Map((reviewDoc.assets || []).map((entry) => [entry.id, entry]));
  const allEntries = [
    ...assetsDoc.assets,
    ...(assetsDoc.characters || []).map((c) => ({
      id: c.id,
      type: 'character',
      outputPath: c.outputPath,
      animation: null,
      status: c.status
    }))
  ];

  const rows = summarize(allEntries, reviewById);
  const total = rows.length;
  const done = rows.filter((r) => r.fileStatus === 'done').length;
  const pending = total - done;
  const approved = rows.filter((r) => r.manifestStatus === 'approved' && r.accepted).length;
  const placeholders = rows.filter((r) => r.manifestStatus === 'placeholder').length;

  const schema = validateAll(assetsDoc, mapDoc);

  if (asJson) {
    const filtered = onlyPending
      ? rows.filter((r) => r.fileStatus === 'pending')
      : onlyDone
        ? rows.filter((r) => r.fileStatus === 'done')
        : rows;
    console.log(JSON.stringify({
      total,
      done,
      pending,
      schemaOk: schema.ok,
      schemaErrors: schema.errors,
      entries: filtered
    }, null, 2));
    return;
  }

  console.log('# Home Field — pipeline status');
  console.log('');
  console.log(`Progress: ${done}/${total} produced (${pending} pending)`);
  console.log(`Approved: ${approved}/${total} accepted (${placeholders} placeholder)`);
  console.log(`Schema:   ${schema.ok ? 'PASS' : `FAIL (${schema.errors.length} error${schema.errors.length === 1 ? '' : 's'})`}`);
  if (!schema.ok) {
    for (const err of schema.errors.slice(0, 5)) {
      console.log(`  [${err.scope}.${err.code}] ${err.message}`);
    }
    if (schema.errors.length > 5) console.log(`  ... and ${schema.errors.length - 5} more`);
  }
  console.log('');

  const byKind = {
    static: rows.filter((r) => r.kind === 'static'),
    animated: rows.filter((r) => r.kind === 'animated'),
    spritesheet: rows.filter((r) => r.kind === 'spritesheet')
  };

  for (const [kind, list] of Object.entries(byKind)) {
    if (list.length === 0) continue;
    const kDone = list.filter((r) => r.fileStatus === 'done').length;
    console.log(`## ${kind}  ${kDone}/${list.length}`);
    for (const r of list) {
      if (onlyPending && r.fileStatus !== 'pending') continue;
      if (onlyDone && r.fileStatus !== 'done') continue;
      const mark = r.fileStatus === 'done' ? '[x]' : '[ ]';
      console.log(`  ${mark} ${r.id.padEnd(36)} (${r.type}; ${r.manifestStatus}; review=${r.reviewVerdict}${r.accepted ? ', accepted' : ''})`);
    }
    console.log('');
  }

  if (pending === 0) {
    console.log('All assets produced. Run `npm run game:home-field:sheet` for the contact-sheet review.');
  } else {
    console.log(`Next: \`npm run game:home-field:next -- --limit=${Math.min(5, pending)}\``);
  }
}

main();
