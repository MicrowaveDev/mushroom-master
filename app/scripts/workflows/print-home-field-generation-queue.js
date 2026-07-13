#!/usr/bin/env node
/**
 * Print and validate the structured Home Field image-generation queue.
 */

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../../shared/repo-root.js';

const queuePath = path.join(repoRoot, 'app/shared/home-field/home-field-generation-queue.json');
const retiredLocalInputEnv = ['HOME', 'FIELD', 'CHIBI', 'LOCAL', 'IMAGE', 'INPUTS'].join('_');
const sha256Pattern = /^[a-f0-9]{64}$/i;

function usage() {
  return [
    'Usage: npm run game:home-field:generation-queue -- [--id=<queue-id>] [--asset-id=<asset-id>] [--type=<asset-type>] [--json] [--show-fallbacks]',
    '',
    'Prints machine-readable Home Field generation queue items and validates local reference paths.',
    '',
    'Options:',
    '  --id=<queue-id>       Select one queue item id.',
    '  --asset-id=<asset-id> Select items for one asset id.',
    '  --type=<asset-type>   Select items for one asset type.',
    '  --json                Emit selected items as JSON.',
    '  --show-fallbacks     Also print inactive imagegen/API fallback history.'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    id: '',
    assetId: '',
    type: '',
    json: false,
    showFallbacks: false
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--show-fallbacks') {
      opts.showFallbacks = true;
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

function sourcePathExists(sourcePath) {
  if (!sourcePath) return false;
  const abs = path.isAbsolute(sourcePath) ? sourcePath : path.join(repoRoot, sourcePath);
  return fs.existsSync(abs);
}

function isBlockedStatus(status) {
  return /blocked|exhausted/i.test(status || '');
}

function inactiveMethods(item) {
  return Array.isArray(item.inactiveMethods) ? item.inactiveMethods : [];
}

function builtinInactiveMethod(item) {
  return inactiveMethods(item).find((method) => method.builtInImagegen || method.methodGate) || null;
}

function apiFallbackInactiveMethod(item) {
  return inactiveMethods(item).find((method) => method.env) || null;
}

function localSourceGateBlocked(item) {
  return isBlockedStatus(item.sourceGate?.status || '');
}

function validateEnvBlock(issues, itemId, env, label) {
  if (!env.envFileArg) issues.push(`${itemId}: ${label} missing envFileArg`);
  if (env.doNotInferEnvFile !== true) issues.push(`${itemId}: ${label}.doNotInferEnvFile must be true`);
  if (!Array.isArray(env.apiFallbackRequiredKeys)) {
    issues.push(`${itemId}: ${label}.apiFallbackRequiredKeys must be an array`);
  }
  for (const key of env.requiredKeys || []) {
    if (typeof key !== 'string' || !key) issues.push(`${itemId}: invalid required env key`);
    if (key === 'OPENAI_API_KEY') {
      issues.push(`${itemId}: Home Field image generation must require OPENAI_IMAGEGEN_API_KEY, not plain OPENAI_API_KEY`);
    }
  }
  for (const key of env.apiFallbackRequiredKeys || []) {
    if (typeof key !== 'string' || !key) issues.push(`${itemId}: invalid API fallback env key`);
    if (key === 'OPENAI_API_KEY') {
      issues.push(`${itemId}: API fallback must require OPENAI_IMAGEGEN_API_KEY, not plain OPENAI_API_KEY`);
    }
  }
  if (env.plainOpenAiApiKeyIgnored !== true) {
    issues.push(`${itemId}: ${label}.plainOpenAiApiKeyIgnored must be true`);
  }
  if (env.apiFallbackRequiresSkillUnavailable !== true) {
    issues.push(`${itemId}: ${label}.apiFallbackRequiresSkillUnavailable must be true`);
  }
}

function validateBuiltInBlock(issues, itemId, builtIn, hasMethodGate) {
  if (builtIn.defaultPath !== true) return;
  const flags = builtIn.confirmationFlags || [];
  if (builtIn.sameContextRequired !== true) {
    issues.push(`${itemId}: builtInImagegen.sameContextRequired must be true`);
  }
  if (!flags.includes('HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1')) {
    issues.push(`${itemId}: builtInImagegen.confirmationFlags must include HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1`);
  }
  if (!flags.includes('HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1')) {
    issues.push(`${itemId}: builtInImagegen.confirmationFlags must include HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1`);
  }
  if (!/preflight-chibi-proof/.test(builtIn.preflightCommand || '')) {
    issues.push(`${itemId}: builtInImagegen.preflightCommand must name preflight-chibi-proof`);
  }
  if (!/referenceInputs/.test(builtIn.referenceStaging || '') || !/view_image/.test(builtIn.referenceStaging || '')) {
    issues.push(`${itemId}: builtInImagegen.referenceStaging must tell agents to load referenceInputs with view_image`);
  }
  if (!/image_gen/.test(builtIn.generationCall || '') || !/references/i.test(builtIn.generationCall || '')) {
    issues.push(`${itemId}: builtInImagegen.generationCall must tell agents to use built-in image_gen with references`);
  }
  if (!/claim-imagegen-output/.test(builtIn.afterRender || '')) {
    issues.push(`${itemId}: builtInImagegen.afterRender must tell agents how to claim built-in output files`);
  }
  if (!/Passive viewing/.test(builtIn.notEnough || '') || !/not enough/.test(builtIn.notEnough || '')) {
    issues.push(`${itemId}: builtInImagegen.notEnough must reject passive viewing`);
  }
  if (!hasMethodGate) {
    issues.push(`${itemId}: built-in inactive method must include a methodGate`);
  }
}

function validateMethodGate(issues, itemId, methodGate) {
  if (!methodGate) return;
  const methodGateStatus = methodGate.status || '';
  const methodGateAllowed = /allowed/i.test(methodGateStatus) && !isBlockedStatus(methodGateStatus);
  const methodGateBlocked = isBlockedStatus(methodGateStatus);
  if (!methodGate.rollout) issues.push(`${itemId}: methodGate missing rollout`);
  if (!methodGateAllowed && !methodGateBlocked) {
    issues.push(`${itemId}: methodGate.status must mark the path allowed or blocked/exhausted`);
  }
  if (methodGateAllowed && !/current allowed method change/i.test(methodGate.reason || '')) {
    issues.push(`${itemId}: methodGate.reason must say current allowed method change`);
  }
  if (methodGateBlocked && !/failed|exhausted/i.test(methodGate.reason || '')) {
    issues.push(`${itemId}: blocked methodGate.reason must explain the failed or exhausted path`);
  }
  if (methodGateBlocked && !/Do not run|Continue only/i.test(methodGate.allowedPath || '')) {
    issues.push(`${itemId}: blocked methodGate.allowedPath must say not to run the exhausted path`);
  }
  if (methodGateBlocked && !/Stop before archive\/imagegen/i.test(methodGate.stopIf || '')) {
    issues.push(`${itemId}: blocked methodGate.stopIf must stop before archive/imagegen`);
  }
}

function validateSourceGateRecovery(issues, itemId, recovery, queueCommand) {
  if (!recovery) {
    issues.push(`${itemId}: blocked sourceGate must include sourceGateRecovery`);
    return;
  }
  if (recovery.mode !== 'method-change-production-attempt') {
    issues.push(`${itemId}: sourceGateRecovery.mode must be method-change-production-attempt`);
  }
  if (!/another production-ready run/i.test(recovery.summary || '')) {
    issues.push(`${itemId}: sourceGateRecovery.summary must address another production-ready run`);
  }
  const copyablePrompt = recovery.copyablePrompt || '';
  if (!copyablePrompt.includes(queueCommand || 'generation-queue')) {
    issues.push(`${itemId}: sourceGateRecovery.copyablePrompt must include the queue command`);
  }
  if (!/printed queue .*results/i.test(copyablePrompt)) {
    issues.push(`${itemId}: sourceGateRecovery.copyablePrompt must tell agents to use the printed queue results`);
  }
  if (!/SourceGate recovery production attempt results/i.test(copyablePrompt)) {
    issues.push(`${itemId}: sourceGateRecovery.copyablePrompt must point to the printed SourceGate recovery production attempt results`);
  }
  if (/method-change production attempt|--source=<new-source-png>|palette-cleanup|blocked default queue launcher/i.test(copyablePrompt)) {
    issues.push(`${itemId}: sourceGateRecovery.copyablePrompt must stay queue-only; put method-change details in requiredActions`);
  }
  if (!Array.isArray(recovery.requiredActions) || recovery.requiredActions.length < 4) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must list the new-source workflow`);
  }
  if (!Array.isArray(recovery.successCriteria) || recovery.successCriteria.length < 3) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must list production-readiness criteria`);
  }
  const exhaustedRepairSources = recovery.exhaustedRepairSources || [];
  if (!Array.isArray(exhaustedRepairSources) || exhaustedRepairSources.length < 1) {
    issues.push(`${itemId}: sourceGateRecovery.exhaustedRepairSources must list exhausted repair sources/candidates`);
  } else {
    for (const [idx, source] of exhaustedRepairSources.entries()) {
      const label = `${itemId}: sourceGateRecovery.exhaustedRepairSources[${idx}]`;
      if (!source.path) issues.push(`${label} missing path`);
      if (!sha256Pattern.test(source.sourceSha256 || '')) issues.push(`${label} missing 64-char sourceSha256`);
      if (!sha256Pattern.test(source.candidateSha256 || '')) issues.push(`${label} missing 64-char candidateSha256`);
      if (source.verdict !== 'needs_regen') issues.push(`${label}.verdict must be needs_regen`);
      if (!/do not rerun|exhausted|not production-ready/i.test(source.reason || '')) {
        issues.push(`${label}.reason must say the repair is exhausted/do-not-rerun/not production-ready`);
      }
    }
  }
  const requiredText = (recovery.requiredActions || []).join('\n');
  const criteriaText = (recovery.successCriteria || []).join('\n');
  if (!/method-change details/i.test(requiredText) || !/copyable user prompt/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must say method-change details stay in queue output, not the prompt`);
  }
  if (!/Prefer .*new authored complete 8x4 local state-sheet source/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must prefer a new authored complete 8x4 local source`);
  }
  if (!/repair only as a secondary explicit method/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must make repair secondary to new authored source`);
  }
  if (!/exhausted repair source/i.test(requiredText) || !/Do not adopt/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must say not to adopt exhausted repair sources`);
  }
  if (!/missing fresh authored-source capability/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must tell agents to report missing fresh authored-source capability`);
  }
  if (!/passing palette\/count scripts alone is not production-ready/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must reject palette-only production readiness`);
  }
  if (!/better than older rejected lineages/i.test(requiredText) || !/absolute target/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must reject relative-improvement-only visual approval`);
  }
  if (!/upgrade needs_regen to needs_review/i.test(requiredText) || !/mechanical validators/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must prevent validator-only upgrades from needs_regen to needs_review`);
  }
  if (!/generic anime/i.test(requiredText) || !/glossy\/white anime eyes/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must reject cute-but-generic anime styling and glossy anime eyes`);
  }
  if (!/hair.*bangs.*wig/i.test(requiredText) || !/brooch.*medallion.*clasp/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must reject hair/wig cap drift and brooch/medallion/clasp ornament`);
  }
  if (!/oversized polished character sheet/i.test(requiredText) || !/normalization as technical processing only/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must say oversized polished sheets are not style-approved by normalization`);
  }
  if (!/repair method/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must allow only an explicit documented repair method`);
  }
  if (!/--source=<new-source-png>/.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must tell agents to use --source=<new-source-png>`);
  }
  if (!/blocked queue source hash/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must reject the blocked queue source hash`);
  }
  if (!/Do not stop only because no replacement source already exists/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must prevent blocker-only completion when no replacement source already exists`);
  }
  if (!/detached motion\/action lines/i.test(requiredText) || !/character-only/i.test(requiredText)) {
    issues.push(`${itemId}: sourceGateRecovery.requiredActions must reject detached motion/action/squiggle marks and require character-only frames`);
  }
  if (!/production-ready candidate output from an intentional blocker/i.test(criteriaText)) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must distinguish production-ready output from a blocker`);
  }
  if (!/merely an improvement over older rejected lineages/i.test(criteriaText) || !/positive references/i.test(criteriaText)) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must reject relative-improvement-only candidates`);
  }
  if (!/mechanical validators alone cannot upgrade/i.test(criteriaText)) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must prevent validator-only verdict upgrades`);
  }
  if (!/detached motion\/action\/squiggle\/speed-line marks/i.test(criteriaText) || !/character-only/i.test(criteriaText)) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must reject detached non-character marks`);
  }
  if (!/generic anime\/doll turnaround/i.test(criteriaText) || !/minimal\/no white sclera/i.test(criteriaText)) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must reject generic anime/doll turnaround eyes`);
  }
  if (!/hair\/wig fringe/i.test(criteriaText) || !/brooch\/medallion\/clasp/i.test(criteriaText)) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must reject hair/wig fringe and brooch/medallion/clasp drift`);
  }
  if (!/must not match .*exhausted repair source\/candidate hash/i.test(criteriaText)) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must reject blocked/exhausted repair source and candidate hashes`);
  }
  if (!/repair experiment/i.test(criteriaText) || !/visual review clears the original source defects/i.test(criteriaText)) {
    issues.push(`${itemId}: sourceGateRecovery.successCriteria must label repair runs and require visual clearance before production-ready claims`);
  }
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
    const localSourceMode = item.generationContract?.stateSheet?.localSourceMode;
    const activeLocalSource = item.activeSourceMode === 'supplied_local_state_sheet';
    const sourcePath = localSourceMode?.sourcePath || '';
    const sourceGateBlocked = localSourceGateBlocked(item);
    const serializedActiveItem = JSON.stringify({
      ...item,
      inactiveMethods: undefined
    });
    if (serializedActiveItem.includes(retiredLocalInputEnv)) {
      issues.push(`${item.id}: active queue item must not mention retired local-input env vars; use localSourceMode.sourcePath and --source commands`);
    }
    if (item.promptSource?.runDoc && !agentInstructionText.includes(item.promptSource.runDoc)) {
      issues.push(`${item.id}: agentInstructions must mention ${item.promptSource.runDoc}`);
    }
    if (!item.commands?.preflight) issues.push(`${item.id}: missing preflight command`);
    if (!item.commands?.promptRenderer) issues.push(`${item.id}: missing prompt renderer command`);

    if (activeLocalSource) {
      if (isBlockedStatus(item.status) && !sourceGateBlocked) {
        issues.push(`${item.id}: blocked supplied local-source status requires sourceGate with blocked status`);
      }
      if (!['Producer/Validation Worker', 'Local Source Worker'].includes(item.ownerRole)) {
        issues.push(`${item.id}: supplied local-source queue item ownerRole must be Producer/Validation Worker or Local Source Worker`);
      }
      for (const field of ['env', 'builtInImagegen', 'methodGate', 'referenceInputs']) {
        if (Object.hasOwn(item, field)) {
          issues.push(`${item.id}: ${field} must not be top-level in supplied local-source mode; move inactive details behind inactiveMethods`);
        }
      }
      if (sourceGateBlocked) {
        if (item.promptPolicy?.issueLauncherWhenStatus === 'ready') {
          issues.push(`${item.id}: blocked local-source gate must not issue launcher when ready`);
        }
        if (!item.promptPolicy?.blockedPromptAction || !item.promptPolicy?.blockedShortResponse) {
          issues.push(`${item.id}: blocked local-source gate must include blockedPromptAction and blockedShortResponse`);
        }
        validateSourceGateRecovery(issues, item.id, item.sourceGateRecovery, item.commands?.queue);
        if (!item.sourceGate?.sourceSha256 || !item.sourceGate?.referenceProxySha256) {
          issues.push(`${item.id}: blocked local-source gate must record source and reference proxy hashes`);
        }
        if (!/palette/i.test(item.sourceGate?.status || '') || !/palette/i.test(item.sourceGate?.action || '')) {
          issues.push(`${item.id}: blocked local-source gate must explain palette failure and next action`);
        }
      } else if (item.promptPolicy?.issueLauncherWhenStatus !== 'ready') {
        issues.push(`${item.id}: supplied local-source promptPolicy.issueLauncherWhenStatus must be ready`);
      }
      if (!/sourcePath/.test(item.promptPolicy?.action || '') || (!sourceGateBlocked && !/--source/.test(item.promptPolicy?.action || ''))) {
        issues.push(`${item.id}: supplied local-source promptPolicy.action must point to the sourcePath and --source commands`);
      }
      if (/OPENAI_IMAGEGEN_API_KEY|HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE|OPENAI_API_KEY|built-in imagegen path|referenceInputs/i.test(agentInstructionText)) {
        issues.push(`${item.id}: supplied local-source agentInstructions must not lead with env/API/built-in/referenceInputs details`);
      }
      if (!/styleReferences as visual review references only/i.test(agentInstructionText)) {
        issues.push(`${item.id}: supplied local-source agentInstructions must describe styleReferences as visual review references`);
      }
      if (!/skips reference imagegen|reference imagegen is skipped/i.test(agentInstructionText)) {
        issues.push(`${item.id}: supplied local-source agentInstructions must say reference imagegen is skipped`);
      }
      if (!Array.isArray(item.styleReferences) || item.styleReferences.length === 0) {
        issues.push(`${item.id}: supplied local-source queue item must include styleReferences`);
      }
      if (!Array.isArray(item.inactiveMethods) || item.inactiveMethods.length === 0) {
        issues.push(`${item.id}: supplied local-source queue item must keep fallback history in inactiveMethods`);
      }
      for (const key of ['preflight', 'archiveStale', 'stageLocalSource']) {
        if (!item.commands?.[key]?.includes(`--source=${sourcePath}`)) {
          issues.push(`${item.id}: commands.${key} must use --source=${sourcePath}`);
        }
      }
      for (const oldKey of ['preflightLocalSource', 'archiveStaleLocalSource', 'referenceApiProof']) {
        if (Object.hasOwn(item.commands || {}, oldKey)) {
          issues.push(`${item.id}: commands.${oldKey} must not be a default command in supplied local-source mode`);
        }
      }
    } else {
      const promptIssueBlocked = isBlockedStatus(item.status) || isBlockedStatus(item.methodGate?.status);
      if (promptIssueBlocked && item.promptPolicy?.issueLauncherWhenStatus !== 'allowed_or_with_unblock_input_only') {
        issues.push(`${item.id}: blocked items must set promptPolicy.issueLauncherWhenStatus=allowed_or_with_unblock_input_only`);
      }
      if (item.env) validateEnvBlock(issues, item.id, item.env, 'env');
      if (item.builtInImagegen) validateBuiltInBlock(issues, item.id, item.builtInImagegen, Boolean(item.methodGate));
      validateMethodGate(issues, item.id, item.methodGate);
    }

    if (localSourceMode?.completeStateSheetAllowed === true) {
      if (!sourcePath) {
        issues.push(`${item.id}: local state-sheet source mode must include localSourceMode.sourcePath`);
      }
      if (sourcePath && sourcePath.startsWith(localSourceMode.sourceMustBeOutside || 'docs/reference/home-field/')) {
        issues.push(`${item.id}: local state-sheet sourcePath must be outside ${localSourceMode.sourceMustBeOutside}`);
      }
      for (const [field, command] of [
        ['preflightCommand', localSourceMode.preflightCommand],
        ['archiveCommand', localSourceMode.archiveCommand],
        ['stageCommand', localSourceMode.stageCommand]
      ]) {
        if (!command?.includes(`--source=${sourcePath}`)) {
          issues.push(`${item.id}: local state-sheet source mode must include localSourceMode.${field} with --source=${sourcePath}`);
        }
      }
      if (!agentInstructionText.includes(sourcePath)) {
        issues.push(`${item.id}: agentInstructions must mention the queue-owned local sourcePath`);
      }
      if (!agentInstructionText.includes('--source')) {
        issues.push(`${item.id}: agentInstructions must mention --source for local-source commands`);
      }
      if (!sourceGateBlocked && !agentInstructionText.includes(item.commands?.stageLocalSource || '<missing-stage-command>')) {
        issues.push(`${item.id}: agentInstructions must mention the local source stage command`);
      }
      if (sourceGateBlocked && !/sourceGate/i.test(agentInstructionText)) {
        issues.push(`${item.id}: blocked local-source agentInstructions must mention sourceGate`);
      }
      if (!/complete 8x4 local state-sheet/i.test(agentInstructionText)) {
        issues.push(`${item.id}: agentInstructions must describe complete 8x4 local state-sheet source mode`);
      }
      if (sourceGateBlocked && !/production-ready PNGs were not produced/i.test(agentInstructionText)) {
        issues.push(`${item.id}: blocked local-source agentInstructions must distinguish a clean block from production-ready output`);
      }
    }

    for (const reference of item.styleReferences || item.referenceInputs || []) {
      if (!reference.path) {
        issues.push(`${item.id}: style/reference input missing path`);
      } else if (!relExists(reference.path)) {
        issues.push(`${item.id}: missing style/reference input ${reference.path}`);
      }
      if (!reference.role) issues.push(`${item.id}: style/reference input ${reference.path || '<missing>'} missing role`);
      if (activeLocalSource && !/visual style reference|visual review reference/i.test(reference.usage || '')) {
        issues.push(`${item.id}: styleReference ${reference.path || '<missing>'} must be visual review only in local-source mode`);
      }
    }

    if (item.generationContract?.stateSheet?.stopIfPromptOnly !== true) {
      issues.push(`${item.id}: state sheet must stop if only prompt text is available`);
    }
    if (!activeLocalSource && !item.generationContract?.stateSheet?.requiredReferenceImageInput) {
      issues.push(`${item.id}: state sheet missing required reference image input`);
    }

    const inactiveBuiltin = builtinInactiveMethod(item);
    if (inactiveBuiltin?.builtInImagegen) {
      validateBuiltInBlock(issues, item.id, inactiveBuiltin.builtInImagegen, Boolean(inactiveBuiltin.methodGate));
      validateMethodGate(issues, item.id, inactiveBuiltin.methodGate);
    }
    const inactiveApi = apiFallbackInactiveMethod(item);
    if (inactiveApi?.env) {
      validateEnvBlock(issues, item.id, inactiveApi.env, 'inactiveMethods.env');
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

function printPromptPolicy(item) {
  if (!item.promptPolicy) return;
  console.log('Prompt issuance gate:');
  console.log(`  issue launcher when: ${item.promptPolicy.issueLauncherWhenStatus}`);
  if (item.promptPolicy.action) console.log(`  action: ${item.promptPolicy.action}`);
  if (item.promptPolicy.blockedPromptAction) console.log(`  blocked action: ${item.promptPolicy.blockedPromptAction}`);
  if (item.promptPolicy.blockedShortResponse) console.log(`  blocked short response: ${item.promptPolicy.blockedShortResponse}`);
  console.log('');
}

function printSourceGateRecovery(item) {
  const recovery = item.sourceGateRecovery;
  if (!recovery || !localSourceGateBlocked(item)) return;
  console.log('SourceGate recovery production attempt:');
  console.log(`  mode: ${recovery.mode}`);
  if (recovery.summary) console.log(`  summary: ${recovery.summary}`);
  if (recovery.copyablePrompt) {
    console.log('  copyable queue-only prompt:');
    console.log(`    ${recovery.copyablePrompt}`);
  }
  if (Array.isArray(recovery.requiredActions) && recovery.requiredActions.length > 0) {
    console.log('  required actions:');
    for (const action of recovery.requiredActions) console.log(`    - ${action}`);
  }
  if (Array.isArray(recovery.exhaustedRepairSources) && recovery.exhaustedRepairSources.length > 0) {
    console.log('  exhausted repair sources:');
    for (const source of recovery.exhaustedRepairSources) {
      console.log(`    - path: ${source.path || '<missing>'}`);
      if (source.sourceSha256) console.log(`      source sha256: ${source.sourceSha256}`);
      if (source.candidatePath) console.log(`      candidate path: ${source.candidatePath}`);
      if (source.candidateSha256) console.log(`      candidate sha256: ${source.candidateSha256}`);
      if (source.verdict) console.log(`      verdict: ${source.verdict}`);
      if (source.rollout) console.log(`      rollout: ${source.rollout}`);
      if (source.commit) console.log(`      commit: ${source.commit}`);
      if (source.reason) console.log(`      reason: ${source.reason}`);
    }
  }
  if (Array.isArray(recovery.successCriteria) && recovery.successCriteria.length > 0) {
    console.log('  success criteria:');
    for (const criterion of recovery.successCriteria) console.log(`    - ${criterion}`);
  }
  console.log('');
}

function printLocalSourceMode(item) {
  const localSourceMode = item.generationContract?.stateSheet?.localSourceMode;
  if (!localSourceMode?.completeStateSheetAllowed) return;
  const sourceGate = item.sourceGate;
  const sourceBlocked = localSourceGateBlocked(item);
  console.log(sourceBlocked ? 'Blocked local-source plan:' : 'Active local-source plan:');
  console.log(`  source path: ${localSourceMode.sourcePath || '<missing>'}`);
  console.log(`  source exists: ${sourcePathExists(localSourceMode.sourcePath) ? 'yes' : 'no'}`);
  console.log(`  source kind: ${localSourceMode.sourceKind || 'complete 8x4 local state-sheet'}`);
  console.log(`  allowed source: one complete 8x4 local PNG outside ${localSourceMode.sourceMustBeOutside}`);
  console.log(`  preflight command: ${localSourceMode.preflightCommand}`);
  console.log(`  archive command: ${localSourceMode.archiveCommand}`);
  console.log(`  stage command: ${localSourceMode.stageCommand}`);
  console.log(`  stages to: ${localSourceMode.stagesTo}`);
  console.log(`  reference proxy: ${localSourceMode.derivesReferenceProxy}`);
  console.log(`  continue at: ${localSourceMode.continueAt}`);
  console.log(`  reference imagegen skipped: ${localSourceMode.skipImagegen ? 'yes' : 'no'}`);
  if (sourceGate) {
    console.log('  source gate:');
    console.log(`    rollout: ${sourceGate.rollout || '<missing>'}`);
    console.log(`    status: ${sourceGate.status || '<missing>'}`);
    if (sourceGate.sourceSha256) console.log(`    source sha256: ${sourceGate.sourceSha256}`);
    if (sourceGate.referenceProxySha256) console.log(`    reference proxy sha256: ${sourceGate.referenceProxySha256}`);
    if (sourceGate.failedCommand) console.log(`    failed command: ${sourceGate.failedCommand}`);
    const evidence = sourceGate.evidence || {};
    if (Object.keys(evidence).length > 0) {
      console.log(`    palette evidence: significant exact ${evidence.exactColorsAtLeastSignificantThreshold ?? '<missing>'}/${evidence.targetMaxSignificantExactColors ?? '<missing>'}, minor ${evidence.exactColorsAtLeastMinorThreshold ?? '<missing>'}, coarse32 significant ${evidence.coarseStep32SignificantBins ?? '<missing>'}`);
    }
    if (sourceGate.action) console.log(`    action: ${sourceGate.action}`);
  }
  console.log('');
}

function printStyleReferences(item) {
  const references = item.styleReferences || item.referenceInputs || [];
  if (references.length === 0) return;
  console.log(item.styleReferences ? 'Style references (visual review only):' : 'References:');
  for (const reference of references) {
    const usage = reference.usage ? `; ${reference.usage}` : '';
    console.log(`  - ${reference.path} (${reference.role}${usage})`);
  }
  console.log('');
}

function printCommands(item) {
  console.log(localSourceGateBlocked(item)
    ? 'Commands after sourceGate is cleared (do not run for the blocked source hash):'
    : 'Required commands:');
  for (const key of [
    'promptRenderer',
    'preflight',
    'archiveStale',
    'stageLocalSource',
    'verifyReference',
    'auditReferencePalette',
    'verifyStateSheet',
    'auditStateSheetPalette',
    'splitStateSheet',
    'verifyFrames',
    'produceCandidate',
    'verifyCandidate',
    'auditCandidatePalette',
    'candidateEvidence',
    'preview',
    'recordVerdict'
  ]) {
    if (item.commands?.[key]) console.log(`  ${key}: ${item.commands[key]}`);
  }
  console.log('');
}

function printStateSheetGate(item) {
  const stateSheet = item.generationContract?.stateSheet || {};
  const localSourceMode = stateSheet.localSourceMode;
  console.log('Production state-sheet gate:');
  if (localSourceMode?.completeStateSheetAllowed && item.activeSourceMode === 'supplied_local_state_sheet') {
    console.log(`  active mode: supplied local 8x4 source -> ${localSourceMode.stageCommand}`);
    console.log('  state sheet generation: skipped; staged from supplied source');
    console.log(`  reference proxy: ${localSourceMode.derivesReferenceProxy}`);
  } else {
    console.log(`  required reference image input: ${stateSheet.requiredReferenceImageInput}`);
    console.log(`  stop if prompt-only: ${stateSheet.stopIfPromptOnly ? 'yes' : 'no'}`);
    console.log(`  stop if reference cannot attach: ${stateSheet.stopIfReferenceCannotBeAttachedAsActualImageInput ? 'yes' : 'no'}`);
  }
  console.log(`  layout: ${stateSheet.layout}`);
  console.log('');
}

function printInactiveMethods(item) {
  const methods = inactiveMethods(item);
  if (methods.length === 0) return;
  console.log('Inactive/fallback methods (--show-fallbacks):');
  for (const method of methods) {
    console.log(`  - ${method.label || method.id}`);
    console.log(`    id: ${method.id || '<missing>'}`);
    console.log(`    status: ${method.status || '<missing>'}`);
    if (method.reason) console.log(`    reason: ${method.reason}`);
    if (method.showWith) console.log(`    default visibility: hidden; print with ${method.showWith}`);
    if (method.builtInImagegen) {
      const builtIn = method.builtInImagegen;
      console.log('    built-in imagegen:');
      console.log(`      flags: ${(builtIn.confirmationFlags || []).join(' ')}`);
      console.log(`      preflight: ${builtIn.preflightCommand}`);
      console.log(`      reference staging: ${builtIn.referenceStaging}`);
      console.log(`      imagegen call: ${builtIn.generationCall}`);
      console.log(`      after render: ${builtIn.afterRender}`);
      console.log(`      not enough: ${builtIn.notEnough}`);
    }
    if (method.methodGate) {
      console.log('    method gate:');
      console.log(`      rollout: ${method.methodGate.rollout}`);
      console.log(`      status: ${method.methodGate.status}`);
      console.log(`      reason: ${method.methodGate.reason}`);
      console.log(`      allowed path: ${method.methodGate.allowedPath}`);
      console.log(`      stop if: ${method.methodGate.stopIf}`);
    }
    if (method.env) {
      const env = method.env;
      console.log('    paid API fallback env:');
      console.log(`      env file arg: ${env.envFileArg}`);
      console.log(`      always-required keys: ${(env.requiredKeys || []).join(', ') || 'none'}`);
      console.log(`      fallback keys: ${(env.apiFallbackRequiredKeys || []).join(', ') || 'none'}`);
      if (env.doNotInferEnvFile) console.log('      rule: do not infer .env or neighboring repo env files');
      if (env.plainOpenAiApiKeyIgnored) console.log('      rule: plain OPENAI_API_KEY is ignored for Home Field image generation');
      if (env.apiFallbackRequiresSkillUnavailable) console.log(`      rule: paid fallback also requires ${env.apiFallbackFlag}`);
      if (env.blockedRunEvidence) console.log(`      latest blocker: ${env.blockedRunEvidence.rollout} - ${env.blockedRunEvidence.reason}`);
    }
    if (method.commands) {
      console.log('    commands:');
      for (const [key, command] of Object.entries(method.commands)) console.log(`      ${key}: ${command}`);
    }
  }
  console.log('');
}

function printItem(item, opts) {
  console.log(`=== ${item.displayTitle || item.id} ===`);
  console.log(`id: ${item.id}`);
  console.log(`asset: ${item.assetId} (${item.assetType})`);
  console.log(`pipeline: ${item.pipeline}`);
  console.log(`status: ${item.status}`);
  if (item.activeSourceMode) console.log(`active source mode: ${item.activeSourceMode}`);
  if (item.ownerRole) console.log(`owner role: ${item.ownerRole}`);
  console.log('');
  console.log('Minimal launcher prompt:');
  console.log(`  ${item.minimalLauncherPrompt}`);
  console.log('');
  printPromptPolicy(item);
  printSourceGateRecovery(item);
  console.log('Agent instructions:');
  for (const instruction of item.agentInstructions || []) console.log(`  - ${instruction}`);
  console.log('');
  printLocalSourceMode(item);
  printStyleReferences(item);
  printCommands(item);
  printStateSheetGate(item);
  if (opts.showFallbacks) printInactiveMethods(item);
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
    printItem(item, opts);
  });
}

try {
  main();
} catch (err) {
  console.error(`home-field generation queue: FAIL - ${err.message}`);
  process.exit(1);
}
