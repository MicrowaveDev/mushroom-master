import path from 'node:path';
import { checkProvenance } from './bitmap-image-toolkit.js';

export function metadataPathFromArgs(argv, defaultPath) {
  const metadataArg = argv.find((arg) => arg.startsWith('--metadata='));
  return metadataArg ? path.resolve(metadataArg.slice('--metadata='.length)) : defaultPath;
}

export function checkImageDomainProvenance({
  metadataPath,
  allowedOutputPrefix = '',
  entriesKey,
  countKey,
  promptIncludes,
  validateEntry = () => [],
  expectedEntries = [],
  onFailure
}) {
  const { entries } = checkProvenance({
    metadataPath,
    allowedOutputPrefix,
    entriesKey,
    countKey,
    promptIncludes,
    fail: onFailure
  });
  for (const entry of entries) {
    for (const message of validateEntry(entry)) onFailure(`${entry.id}: ${message}`);
  }
  if (expectedEntries.length) {
    const expectedById = new Map(expectedEntries.map((entry) => [entry.id, entry]));
    const approvedIds = new Set(entries.map((entry) => entry.id));
    for (const expected of expectedEntries) {
      if (!approvedIds.has(expected.id)) onFailure(`${expected.id}: missing approved provenance entry`);
    }
    for (const entry of entries) {
      if (!expectedById.has(entry.id)) onFailure(`${entry.id}: approved provenance entry no longer exists in the domain source list`);
    }
  }
  return entries;
}
