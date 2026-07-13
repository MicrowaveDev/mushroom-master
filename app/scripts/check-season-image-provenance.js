import path from 'node:path';
import { buildSeasonImageEntries, repoRoot } from './season-sheet-helpers.js';
import { checkImageDomainProvenance, metadataPathFromArgs } from './lib/image-domain-provenance.js';

const metadataPath = metadataPathFromArgs(
  process.argv.slice(2),
  path.join(repoRoot, 'app', 'shared', 'season-image-metadata.json')
);
const expectedEntries = buildSeasonImageEntries();
const allowedPrefixes = ['web/public/season-ranks/', 'web/public/achievements/'];
const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};
const entries = checkImageDomainProvenance({
  metadataPath,
  promptIncludes: 'Use the imagegen skill to create a production game season bitmap.',
  expectedEntries,
  onFailure: fail,
  validateEntry: (entry) => [
    ...(!allowedPrefixes.some((prefix) => entry.outputPath?.startsWith(prefix))
      ? [`outputPath must start with one of ${allowedPrefixes.join(' / ')}`]
      : []),
    ...(!entry.entry?.kind || !entry.entry?.type ? ['missing entry.kind / entry.type snapshot'] : [])
  ]
});
if (!process.exitCode) console.log(`OK season image provenance: ${entries.length}/${expectedEntries.length} approved entries`);
