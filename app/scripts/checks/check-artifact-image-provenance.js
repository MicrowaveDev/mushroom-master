import path from 'node:path';
import { repoRoot } from '../lib/artifact-sheet-helpers.js';
import { checkImageDomainProvenance, metadataPathFromArgs } from '../lib/image-domain-provenance.js';

const metadataPath = metadataPathFromArgs(
  process.argv.slice(2),
  path.join(repoRoot, 'app', 'shared', 'artifact-image-metadata.json')
);
const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};
const entries = checkImageDomainProvenance({
  metadataPath,
  allowedOutputPrefix: 'web/public/artifacts/',
  entriesKey: 'artifacts',
  countKey: 'artifactCount',
  promptIncludes: 'Use the imagegen skill to create a production game artifact bitmap.',
  onFailure: fail,
  validateEntry: (entry) => entry.visualClassification?.role?.id && entry.visualClassification?.shine?.id
    ? []
    : ['missing visual classification snapshot']
});
if (!process.exitCode) console.log(`OK artifact image provenance: ${entries.length} approved artifacts`);
