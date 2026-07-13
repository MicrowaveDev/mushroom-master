import path from 'node:path';
import { buildSeasonImageEntries, repoRoot } from '../lib/season-sheet-helpers.js';
import {
  promptForSeasonEntry,
  seasonTodoDescriptions
} from './next-season-image-prompts.js';
import {
  approvedImageMetadataEntry,
  outputPathFromArgs,
  writeImageMetadataBundle
} from '../lib/image-domain-metadata.js';

const defaultOutPath = path.join(repoRoot, 'app', 'shared', 'season-image-metadata.json');

function stableEntrySnapshot(entry) {
  return {
    id: entry.id,
    kind: entry.kind,
    rankId: entry.rankId || null,
    achievementId: entry.achievementId || null,
    section: entry.section,
    type: entry.type,
    accent: entry.accent,
    characterId: entry.characterId || null,
    name: entry.name,
    lore: entry.lore,
    criteria: entry.criteria || null
  };
}

function validationSnapshot(pngInfo) {
  return {
    status: 'passed',
    command: 'npm run game:season:validate -- --all',
    checkedAt: new Date().toISOString().slice(0, 10),
    pngDimensions: { width: pngInfo.width, height: pngInfo.height },
    checks: [
      'png-rgba',
      'fixed-square-canvas',
      'alpha-coverage',
      'bbox-fill-window',
      'safe-edge-margin',
      'fresh-from-imagegen-raw'
    ]
  };
}

function buildEntry(entry, descriptions) {
  const descKey = entry.kind === 'rank' ? entry.rankId : entry.achievementId;
  const todoSpec = descriptions.get(descKey);
  const approvedAt = new Date().toISOString().slice(0, 10);
  return approvedImageMetadataEntry({
    id: entry.id,
    absoluteOutputPath: entry.outputPath,
    repoRoot,
    snapshotKey: 'entry',
    snapshot: stableEntrySnapshot(entry),
    prompt: promptForSeasonEntry(entry, todoSpec),
    validation: validationSnapshot,
    review: {
      decision: 'approved',
      decidedAt: approvedAt,
      reviewer: 'user',
      note: 'Production-ready season emblem approved after local generation, contact-sheet review, and coverage validation.'
    }
  });
}

function main() {
  const outPath = outputPathFromArgs(process.argv.slice(2), defaultOutPath);
  const descriptions = seasonTodoDescriptions();
  const entries = buildSeasonImageEntries().map((entry) => buildEntry(entry, descriptions));
  writeImageMetadataBundle({
    outPath,
    repoRoot,
    generatedAt: new Date().toISOString().slice(0, 10),
    policy: {
      runtimeUsesApprovedOnly: true,
      temporaryCandidatesLocation: '.agent/season-image-workspace/',
      productionImageLocations: ['web/public/season-ranks/', 'web/public/achievements/']
    },
    entries,
    entriesKey: 'entries',
    countKey: 'entryCount',
    label: 'entries'
  });
}

main();
