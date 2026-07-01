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
    if (!item.displayTitle) issues.push(`${item.id}: missing displayTitle`);
    if (!item.assetId) issues.push(`${item.id}: missing assetId`);
    if (!item.minimalLauncherPrompt) issues.push(`${item.id}: missing minimalLauncherPrompt`);
    if (item.minimalLauncherPrompt && !item.minimalLauncherPrompt.includes(item.commands?.queue || '<missing>')) {
      issues.push(`${item.id}: minimalLauncherPrompt must include the queue command`);
    }
    if (!Array.isArray(item.agentInstructions) || item.agentInstructions.length === 0) {
      issues.push(`${item.id}: agentInstructions must be a non-empty array`);
    }
    const agentInstructionText = (item.agentInstructions || []).join('\n');
    if (item.promptSource?.runDoc && !agentInstructionText.includes(item.promptSource.runDoc)) {
      issues.push(`${item.id}: agentInstructions must mention ${item.promptSource.runDoc}`);
    }
    if (item.env?.doNotInferEnvFile === true && !/Do not infer `?\.env`?/i.test(agentInstructionText)) {
      issues.push(`${item.id}: agentInstructions must say not to infer .env`);
    }
    if (item.env?.plainOpenAiApiKeyIgnored === true && !/plain OPENAI_API_KEY is ignored/i.test(agentInstructionText)) {
      issues.push(`${item.id}: agentInstructions must say plain OPENAI_API_KEY is ignored`);
    }
    if (item.env?.apiFallbackRequiresSkillUnavailable === true && !agentInstructionText.includes('HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1')) {
      issues.push(`${item.id}: agentInstructions must mention HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1`);
    }
    if ((item.referenceInputs || []).length > 0 && !/actual image inputs/i.test(agentInstructionText)) {
      issues.push(`${item.id}: agentInstructions must require actual image inputs for references`);
    }
    const methodGateStatus = item.methodGate?.status || '';
    const itemStatusBlocked = /blocked|exhausted/i.test(item.status || '');
    const methodGateBlocked = /blocked|exhausted/i.test(methodGateStatus);
    const promptIssueBlocked = itemStatusBlocked || methodGateBlocked;
    const methodGateAllowed = /allowed/i.test(methodGateStatus) && !methodGateBlocked;
    if (promptIssueBlocked) {
      if (item.promptPolicy?.issueLauncherWhenStatus !== 'allowed_or_with_unblock_input_only') {
        issues.push(`${item.id}: blocked items must set promptPolicy.issueLauncherWhenStatus=allowed_or_with_unblock_input_only`);
      }
      const blockedPromptAction = item.promptPolicy?.blockedPromptAction || '';
      const blockedShortResponse = item.promptPolicy?.blockedShortResponse || '';
      if (!/Do not give minimalLauncherPrompt/i.test(blockedPromptAction) || !/concrete allowed unblock input/i.test(blockedPromptAction)) {
        issues.push(`${item.id}: blocked promptPolicy.blockedPromptAction must forbid giving the launcher without a concrete unblock input`);
      }
      if (!/Blocked:/i.test(blockedShortResponse) || !/allowed non-built-in path|explicit paid fallback env file|supplied proof source PNGs/i.test(blockedShortResponse)) {
        issues.push(`${item.id}: blocked promptPolicy.blockedShortResponse must tell agents not to start another blocked production run`);
      }
      if (!/Do not give the minimalLauncherPrompt back to the user/i.test(agentInstructionText) || !/concrete allowed unblock input/i.test(agentInstructionText)) {
        issues.push(`${item.id}: agentInstructions must forbid returning a blocked launcher prompt without concrete unblock input`);
      }
    }
    if (item.methodGate && methodGateAllowed && !/current allowed method change/i.test(agentInstructionText)) {
      issues.push(`${item.id}: agentInstructions must name the current allowed method change`);
    }
    if (item.methodGate && methodGateBlocked && !/exhausted|do not run it again/i.test(agentInstructionText)) {
      issues.push(`${item.id}: agentInstructions must say the built-in method is exhausted or must not run again`);
    }
    if (item.generationContract?.stateSheet?.requiredReferenceImageInput && !/grouped 8x4 state sheet/i.test(agentInstructionText)) {
      issues.push(`${item.id}: agentInstructions must mention the grouped 8x4 state sheet reference-input gate`);
    }
    const localSourceMode = item.generationContract?.stateSheet?.localSourceMode;
    if (localSourceMode?.completeStateSheetAllowed === true) {
      if (!item.commands?.stageLocalSource) {
        issues.push(`${item.id}: local state-sheet source mode must include commands.stageLocalSource`);
      }
      if (!agentInstructionText.includes(localSourceMode.envKey || 'HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS')) {
        issues.push(`${item.id}: agentInstructions must mention the local source env key`);
      }
      if (!agentInstructionText.includes(item.commands?.stageLocalSource || '<missing-stage-command>')) {
        issues.push(`${item.id}: agentInstructions must mention the local source stage command`);
      }
      if (!/complete 8x4 local state-sheet/i.test(agentInstructionText)) {
        issues.push(`${item.id}: agentInstructions must describe complete 8x4 local state-sheet source mode`);
      }
      if (!/Do not run reference imagegen/i.test(agentInstructionText)) {
        issues.push(`${item.id}: agentInstructions must skip reference imagegen for local state-sheet source mode`);
      }
    }
    if (!item.commands?.preflight) issues.push(`${item.id}: missing preflight command`);
    if (!item.commands?.scopedPrompt) issues.push(`${item.id}: missing scoped prompt command`);
    if (!item.env?.envFileArg) issues.push(`${item.id}: missing env.envFileArg`);
    if (item.env?.doNotInferEnvFile !== true) issues.push(`${item.id}: env.doNotInferEnvFile must be true`);
    for (const key of item.env?.requiredKeys || []) {
      if (typeof key !== 'string' || !key) issues.push(`${item.id}: invalid required env key`);
      if (key === 'OPENAI_API_KEY') {
        issues.push(`${item.id}: Home Field image generation must require OPENAI_IMAGEGEN_API_KEY, not plain OPENAI_API_KEY`);
      }
    }
    for (const key of item.env?.apiFallbackRequiredKeys || []) {
      if (typeof key !== 'string' || !key) issues.push(`${item.id}: invalid API fallback env key`);
      if (key === 'OPENAI_API_KEY') {
        issues.push(`${item.id}: API fallback must require OPENAI_IMAGEGEN_API_KEY, not plain OPENAI_API_KEY`);
      }
    }
    if (!Array.isArray(item.env?.apiFallbackRequiredKeys)) {
      issues.push(`${item.id}: env.apiFallbackRequiredKeys must be an array`);
    }
    if (item.env?.plainOpenAiApiKeyIgnored !== true) {
      issues.push(`${item.id}: env.plainOpenAiApiKeyIgnored must be true`);
    }
    if (item.env?.apiFallbackRequiresSkillUnavailable !== true) {
      issues.push(`${item.id}: env.apiFallbackRequiresSkillUnavailable must be true`);
    }
    if (item.builtInImagegen?.defaultPath === true) {
      const builtIn = item.builtInImagegen;
      const flags = builtIn.confirmationFlags || [];
      if (builtIn.sameContextRequired !== true) {
        issues.push(`${item.id}: builtInImagegen.sameContextRequired must be true`);
      }
      if (!flags.includes('HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1')) {
        issues.push(`${item.id}: builtInImagegen.confirmationFlags must include HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1`);
      }
      if (!flags.includes('HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1')) {
        issues.push(`${item.id}: builtInImagegen.confirmationFlags must include HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1`);
      }
      if (!/preflight-chibi-proof/.test(builtIn.preflightCommand || '')) {
        issues.push(`${item.id}: builtInImagegen.preflightCommand must name preflight-chibi-proof`);
      }
      if (!/referenceInputs/.test(builtIn.referenceStaging || '') || !/view_image/.test(builtIn.referenceStaging || '')) {
        issues.push(`${item.id}: builtInImagegen.referenceStaging must tell agents to load referenceInputs with view_image`);
      }
      if (!/image_gen/.test(builtIn.generationCall || '') || !/references/i.test(builtIn.generationCall || '')) {
        issues.push(`${item.id}: builtInImagegen.generationCall must tell agents to use built-in image_gen with references`);
      }
      if (!/claim-imagegen-output/.test(builtIn.afterRender || '')) {
        issues.push(`${item.id}: builtInImagegen.afterRender must tell agents how to claim built-in output files`);
      }
      if (!/Passive viewing/.test(builtIn.notEnough || '') || !/not enough/.test(builtIn.notEnough || '')) {
        issues.push(`${item.id}: builtInImagegen.notEnough must reject passive viewing`);
      }
      if (!item.methodGate) {
        issues.push(`${item.id}: builtin-ready items must include a methodGate`);
      }
    } else if (item.status?.includes('builtin')) {
      issues.push(`${item.id}: builtin-ready items must include builtInImagegen.defaultPath=true`);
    }
    if (item.methodGate) {
      if (!item.methodGate.rollout) issues.push(`${item.id}: methodGate missing rollout`);
      if (!methodGateAllowed && !methodGateBlocked) {
        issues.push(`${item.id}: methodGate.status must mark the path allowed or blocked/exhausted`);
      }
      if (methodGateAllowed && !/current allowed method change/i.test(item.methodGate.reason || '')) {
        issues.push(`${item.id}: methodGate.reason must say current allowed method change`);
      }
      if (methodGateAllowed && !/one fresh reference-attempt batch/i.test(item.methodGate.allowedPath || '')) {
        issues.push(`${item.id}: methodGate.allowedPath must limit the queued path to one fresh reference-attempt batch`);
      }
      if (methodGateAllowed && !/same visual gate twice/i.test(item.methodGate.stopIf || '')) {
        issues.push(`${item.id}: methodGate.stopIf must stop after repeated same-gate failure`);
      }
      if (methodGateBlocked && !/failed|exhausted/i.test(item.methodGate.reason || '')) {
        issues.push(`${item.id}: blocked methodGate.reason must explain the failed or exhausted path`);
      }
      if (methodGateBlocked && !/Do not run|Continue only/i.test(item.methodGate.allowedPath || '')) {
        issues.push(`${item.id}: blocked methodGate.allowedPath must say not to run the exhausted path`);
      }
      if (methodGateBlocked && !/Stop before archive\/imagegen/i.test(item.methodGate.stopIf || '')) {
        issues.push(`${item.id}: blocked methodGate.stopIf must stop before archive/imagegen`);
      }
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
  console.log(`=== ${item.displayTitle || item.id} ===`);
  console.log(`id: ${item.id}`);
  console.log(`asset: ${item.assetId} (${item.assetType})`);
  console.log(`pipeline: ${item.pipeline}`);
  console.log(`status: ${item.status}`);
  console.log('');
  console.log('Minimal launcher prompt:');
  console.log(`  ${item.minimalLauncherPrompt}`);
  console.log('');
  if (item.promptPolicy) {
    const promptIssueBlocked = /blocked|exhausted/i.test(`${item.status || ''} ${item.methodGate?.status || ''}`);
    console.log(promptIssueBlocked ? 'Prompt issuance gate (blocked):' : 'Prompt issuance gate:');
    console.log(`  issue launcher when: ${item.promptPolicy.issueLauncherWhenStatus}`);
    if (item.promptPolicy.blockedPromptAction) console.log(`  blocked action: ${item.promptPolicy.blockedPromptAction}`);
    if (item.promptPolicy.blockedShortResponse) console.log(`  blocked short response: ${item.promptPolicy.blockedShortResponse}`);
    console.log('');
  }
  console.log('Agent instructions:');
  for (const instruction of item.agentInstructions || []) console.log(`  - ${instruction}`);
  console.log('');
  if (item.builtInImagegen?.defaultPath) {
    const methodGateBlocked = /blocked|exhausted/i.test(item.methodGate?.status || '');
    console.log(methodGateBlocked ? 'Built-in imagegen path (blocked by method gate):' : 'Built-in imagegen default path:');
    console.log(`  flags: ${(item.builtInImagegen.confirmationFlags || []).join(' ')}`);
    console.log(`  preflight: ${item.builtInImagegen.preflightCommand}`);
    console.log(`  reference staging: ${item.builtInImagegen.referenceStaging}`);
    console.log(`  imagegen call: ${item.builtInImagegen.generationCall}`);
    console.log(`  after render: ${item.builtInImagegen.afterRender}`);
    console.log(`  not enough: ${item.builtInImagegen.notEnough}`);
    console.log('');
  }
  if (item.methodGate) {
    console.log('Method gate / allowed method change:');
    console.log(`  rollout: ${item.methodGate.rollout}`);
    console.log(`  status: ${item.methodGate.status}`);
    console.log(`  reason: ${item.methodGate.reason}`);
    console.log(`  allowed path: ${item.methodGate.allowedPath}`);
    console.log(`  stop if: ${item.methodGate.stopIf}`);
    console.log('');
  }
  const localSourceMode = item.generationContract?.stateSheet?.localSourceMode;
  if (localSourceMode?.completeStateSheetAllowed) {
    console.log('Supplied local state-sheet source path:');
    console.log(`  env key: ${localSourceMode.envKey}`);
    console.log(`  allowed source: one complete 8x4 local PNG outside ${localSourceMode.sourceMustBeOutside}`);
    console.log(`  stage command: ${localSourceMode.stageCommand}`);
    console.log(`  stages to: ${localSourceMode.stagesTo}`);
    console.log(`  reference proxy: ${localSourceMode.derivesReferenceProxy}`);
    console.log(`  continue at: ${localSourceMode.continueAt}`);
    console.log(`  skip imagegen: ${localSourceMode.skipImagegen ? 'yes' : 'no'}`);
    console.log('');
  }
  console.log(`env fallback arg: pass ${item.env.envFileArg} only for paid API fallback; always-required keys: ${(item.env.requiredKeys || []).join(', ') || 'none'}`);
  console.log(`env fallback keys: ${(item.env.apiFallbackRequiredKeys || []).join(', ') || 'none'}`);
  if (item.env.doNotInferEnvFile) {
    console.log('env rule: do not infer .env or neighboring repo env files; the launcher must provide the explicit env file.');
  }
  if (item.env.plainOpenAiApiKeyIgnored) {
    console.log('env rule: plain OPENAI_API_KEY is ignored for Home Field image generation; use OPENAI_IMAGEGEN_API_KEY only for explicit paid API fallback.');
  }
  if (item.env.apiFallbackRequiresSkillUnavailable) {
    console.log('env rule: paid API fallback also requires HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1 after built-in/imagegen skill output is unavailable.');
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
  for (const key of ['context', 'preflight', 'scopedPrompt', 'archiveStale', 'stageLocalSource', 'referenceApiProof']) {
    if (item.commands?.[key]) console.log(`  ${key}: ${item.commands[key]}`);
  }
  console.log('');
  console.log('Production state-sheet gate:');
  console.log(`  required reference image input: ${item.generationContract.stateSheet.requiredReferenceImageInput}`);
  console.log(`  stop if prompt-only: ${item.generationContract.stateSheet.stopIfPromptOnly ? 'yes' : 'no'}`);
  console.log(`  stop if reference cannot attach: ${item.generationContract.stateSheet.stopIfReferenceCannotBeAttachedAsActualImageInput ? 'yes' : 'no'}`);
  if (localSourceMode?.completeStateSheetAllowed) {
    console.log(`  local source mode: ${localSourceMode.envKey} -> ${localSourceMode.stageCommand}; deterministic reference proxy derived, reference imagegen skipped`);
  }
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
