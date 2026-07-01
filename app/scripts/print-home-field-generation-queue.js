#!/usr/bin/env node
/**
 * Print and validate the structured Home Field image-generation queue.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../shared/repo-root.js';

const queuePath = path.join(repoRoot, 'app/shared/home-field/home-field-generation-queue.json');

function usage() {
  return [
    'Usage: npm run game:home-field:generation-queue -- [--id=<queue-id>] [--asset-id=<asset-id>] [--type=<asset-type>] [--json]',
    '',
    'Prints machine-readable Home Field generation queue items and validates local reference paths.',
    '',
    'Options:',
    '  --id=<queue-id>       Select one queue item id.',
    '  --asset-id=<asset-id> Select items for one asset id.',
    '  --type=<asset-type>   Select items for one asset type.',
    '  --json                Emit selected items as JSON.'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    id: '',
    assetId: '',
    type: '',
    json: false
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg.startsWith('--id=')) {
      opts.id = arg.slice('--id='.length);
    } else if (arg.startsWith('--asset-id=')) {
      opts.assetId = arg.slice('--asset-id='.length);
    } else if (arg.startsWith('--type=')) {
      opts.type = arg.slice('--type='.length);
    } else {
      throw new Error(`Unexpected argument: ${arg}\n\n${usage()}`);
    }
  }
  return opts;
}

function loadQueue() {
  return JSON.parse(fs.readFileSync(queuePath, 'utf8'));
}

function relExists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function validateQueue(queue) {
  const issues = [];
  if (queue.schemaVersion !== 1) issues.push('schemaVersion must be 1');
  if (!Array.isArray(queue.items)) issues.push('items must be an array');
  const seen = new Set();
  for (const item of queue.items || []) {
    if (!item.id) {
      issues.push('item is missing id');
      continue;
    }
    if (seen.has(item.id)) issues.push(`duplicate item id: ${item.id}`);
    seen.add(item.id);
    if (!item.assetId) issues.push(`${item.id}: missing assetId`);
    if (!item.commands?.preflight) issues.push(`${item.id}: missing preflight command`);
    if (!item.commands?.scopedPrompt) issues.push(`${item.id}: missing scoped prompt command`);
    if (!item.env?.envFileArg) issues.push(`${item.id}: missing env.envFileArg`);
    if (item.env?.doNotInferEnvFile !== true) issues.push(`${item.id}: env.doNotInferEnvFile must be true`);
    for (const key of item.env?.requiredKeys || []) {
      if (typeof key !== 'string' || !key) issues.push(`${item.id}: invalid required env key`);
    }
    for (const reference of item.referenceInputs || []) {
      if (!reference.path) {
        issues.push(`${item.id}: reference input missing path`);
      } else if (!relExists(reference.path)) {
        issues.push(`${item.id}: missing reference input ${reference.path}`);
      }
      if (!reference.role) issues.push(`${item.id}: reference input ${reference.path || '<missing>'} missing role`);
      if (reference.mustAttachAsActualImageInput !== true) {
        issues.push(`${item.id}: reference input ${reference.path || '<missing>'} must require actual image attachment`);
      }
    }
    if (item.generationContract?.stateSheet?.stopIfPromptOnly !== true) {
      issues.push(`${item.id}: state sheet must stop if only prompt text is available`);
    }
    if (!item.generationContract?.stateSheet?.requiredReferenceImageInput) {
      issues.push(`${item.id}: state sheet missing required reference image input`);
    }
  }
  return issues;
}

function selectItems(items, opts) {
  return items.filter((item) => {
    if (opts.id && item.id !== opts.id) return false;
    if (opts.assetId && item.assetId !== opts.assetId) return false;
    if (opts.type && item.assetType !== opts.type) return false;
    return true;
  });
}

function printItem(item) {
  console.log(`=== ${item.id} ===`);
  console.log(`asset: ${item.assetId} (${item.assetType})`);
  console.log(`pipeline: ${item.pipeline}`);
  console.log(`status: ${item.status}`);
  console.log(`env: pass ${item.env.envFileArg}; required keys: ${(item.env.requiredKeys || []).join(', ') || 'none'}`);
  if (item.env.doNotInferEnvFile) {
    console.log('env rule: do not infer .env or neighboring repo env files; the launcher must provide the explicit env file.');
  }
  if (item.env.blockedRunEvidence) {
    console.log(`latest blocker: ${item.env.blockedRunEvidence.rollout} - ${item.env.blockedRunEvidence.reason}`);
  }
  console.log('');
  console.log('References:');
  for (const reference of item.referenceInputs || []) {
    console.log(`  - ${reference.path} (${reference.role})`);
  }
  console.log('');
  console.log('Required commands:');
  for (const key of ['context', 'preflight', 'scopedPrompt', 'archiveStale', 'referenceApiProof']) {
    if (item.commands?.[key]) console.log(`  ${key}: ${item.commands[key]}`);
  }
  console.log('');
  console.log('Production state-sheet gate:');
  console.log(`  required reference image input: ${item.generationContract.stateSheet.requiredReferenceImageInput}`);
  console.log(`  stop if prompt-only: ${item.generationContract.stateSheet.stopIfPromptOnly ? 'yes' : 'no'}`);
  console.log(`  stop if reference cannot attach: ${item.generationContract.stateSheet.stopIfReferenceCannotBeAttachedAsActualImageInput ? 'yes' : 'no'}`);
  console.log(`  layout: ${item.generationContract.stateSheet.layout}`);
  console.log('');
  console.log('Stop rules:');
  for (const rule of item.stopRules || []) console.log(`  - ${rule}`);
  console.log('');
  console.log('Final response must report:');
  for (const field of item.finalResponseMustReport || []) console.log(`  - ${field}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const queue = loadQueue();
  const issues = validateQueue(queue);
  const items = selectItems(queue.items || [], opts);

  if (issues.length > 0) {
    console.error(`home-field generation queue: FAIL (${issues.length} issue(s))`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  if (items.length === 0) {
    console.error('home-field generation queue: FAIL - no items matched the filters');
    process.exit(1);
  }

  if (opts.json) {
    console.log(JSON.stringify({ ...queue, items }, null, 2));
    return;
  }

  console.log(`# Home Field Generation Queue (${items.length}/${queue.items.length} item(s))`);
  console.log(`Source: ${path.relative(repoRoot, queuePath)}`);
  console.log('');
  items.forEach((item, idx) => {
    if (idx > 0) console.log('');
    printItem(item);
  });
}

try {
  main();
} catch (err) {
  console.error(`home-field generation queue: FAIL - ${err.message}`);
  process.exit(1);
}
