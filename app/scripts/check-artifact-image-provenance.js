import path from 'node:path';
import { repoRoot } from './artifact-sheet-helpers.js';
import { checkProvenance } from './lib/bitmap-image-toolkit.js';

const defaultMetadataPath = path.join(repoRoot, 'app', 'shared', 'artifact-image-metadata.json');

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

  const { entries } = checkProvenance({
    metadataPath,
    allowedOutputPrefix: 'web/public/artifacts/',
    entriesKey: 'artifacts',
    countKey: 'artifactCount',
    promptIncludes: 'Use the imagegen skill to create a production game artifact bitmap.',
    fail
  });

  // Artifact-specific extra check: visual classification snapshot must be present.
  for (const entry of entries) {
    if (!entry.visualClassification?.role?.id || !entry.visualClassification?.shine?.id) {
      fail(`${entry.id}: missing visual classification snapshot`);
    }
  }

  if (!process.exitCode) {
    console.log(`OK artifact image provenance: ${entries.length} approved artifacts`);
  }
}

main();
