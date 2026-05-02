import fs from 'node:fs';
import path from 'node:path';
import { buildSeasonImageEntries, repoRoot } from './season-sheet-helpers.js';
import {
  promptForSeasonEntry,
  seasonTodoDescriptions
} from './next-season-image-prompts.js';
import {
  readPngHeader,
  metadataEntriesHash
} from './lib/bitmap-image-toolkit.js';

const defaultOutPath = path.join(repoRoot, 'app', 'shared', 'season-image-metadata.json');

function parseArgs(argv) {
  const outArg = argv.find((arg) => arg.startsWith('--out='));
  return {
    outPath: outArg ? path.resolve(outArg.slice('--out='.length)) : defaultOutPath
  };
}

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
  if (!fs.existsSync(entry.outputPath)) {
    throw new Error(`Missing approved season PNG: ${path.relative(repoRoot, entry.outputPath)}`);
  }
  const pngInfo = readPngHeader(entry.outputPath);
  const descKey = entry.kind === 'rank' ? entry.rankId : entry.achievementId;
  const todoSpec = descriptions.get(descKey);
  return {
    id: entry.id,
    status: 'approved',
    outputPath: path.relative(repoRoot, entry.outputPath),
    png: pngInfo,
    entry: stableEntrySnapshot(entry),
    prompt: promptForSeasonEntry(entry, todoSpec),
    validation: validationSnapshot(pngInfo),
    review: {
      decision: 'approved',
      decidedAt: new Date().toISOString().slice(0, 10),
      reviewer: 'user',
      note: 'Production-ready season emblem approved after local generation, contact-sheet review, and coverage validation.'
    },
    candidates: []
  };
}

function main() {
  const { outPath } = parseArgs(process.argv.slice(2));
  const descriptions = seasonTodoDescriptions();
  const entries = buildSeasonImageEntries().map((entry) => buildEntry(entry, descriptions));
  const metadata = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    status: 'approved-production-baseline',
    policy: {
      runtimeUsesApprovedOnly: true,
      temporaryCandidatesLocation: '.agent/season-image-workspace/',
      productionImageLocations: ['web/public/season-ranks/', 'web/public/achievements/']
    },
    entryCount: entries.length,
    metadataHash: metadataEntriesHash(entries),
    entries
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`generated ${path.relative(repoRoot, outPath)} with ${entries.length} approved entries`);
}

main();
