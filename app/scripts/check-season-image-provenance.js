import path from 'node:path';
import { repoRoot } from './season-sheet-helpers.js';
import { checkProvenance, fileSha256 } from './lib/bitmap-image-toolkit.js';
import fs from 'node:fs';

const defaultMetadataPath = path.join(repoRoot, 'app', 'shared', 'season-image-metadata.json');

function parseArgs(argv) {
  const metadataArg = argv.find((arg) => arg.startsWith('--metadata='));
  return {
    metadataPath: metadataArg ? path.resolve(metadataArg.slice('--metadata='.length)) : defaultMetadataPath
  };
}

function main() {
  const { metadataPath } = parseArgs(process.argv.slice(2));
  const fail = (message) => {
    console.error(message);
    process.exitCode = 1;
  };

  // Season metadata may live in either web/public/season-ranks/ or
  // web/public/achievements/, so we relax the prefix check and verify
  // the path manually below.
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing season image metadata: ${path.relative(repoRoot, metadataPath)}`);
  }
  const raw = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const allowedPrefixes = ['web/public/season-ranks/', 'web/public/achievements/'];

  const { entries } = checkProvenance({
    metadataPath,
    // Pass any allowed prefix; we'll re-check below for the full set.
    allowedOutputPrefix: '',
    promptIncludes: 'Use the imagegen skill to create a production game season bitmap.',
    fail
  });

  for (const entry of entries) {
    if (!allowedPrefixes.some((prefix) => entry.outputPath?.startsWith(prefix))) {
      fail(`${entry.id}: outputPath must start with one of ${allowedPrefixes.join(' / ')}`);
    }
    if (!entry.entry?.kind || !entry.entry?.type) {
      fail(`${entry.id}: missing entry.kind / entry.type snapshot`);
    }
  }

  if (!process.exitCode) {
    console.log(`OK season image provenance: ${entries.length} approved entries`);
  }
}

main();
