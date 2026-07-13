import fs from 'node:fs';
import path from 'node:path';
import { metadataEntriesHash, readPngHeader } from './bitmap-image-toolkit.js';

export function outputPathFromArgs(argv, defaultPath) {
  const outArg = argv.find((arg) => arg.startsWith('--out='));
  return outArg ? path.resolve(outArg.slice('--out='.length)) : defaultPath;
}

export function approvedImageMetadataEntry({
  id,
  absoluteOutputPath,
  repoRoot,
  snapshotKey,
  snapshot,
  extra = {},
  prompt,
  validation,
  review
}) {
  if (!fs.existsSync(absoluteOutputPath)) {
    throw new Error(`Missing approved image: ${path.relative(repoRoot, absoluteOutputPath)}`);
  }
  const png = readPngHeader(absoluteOutputPath);
  return {
    id,
    status: 'approved',
    outputPath: path.relative(repoRoot, absoluteOutputPath),
    png,
    [snapshotKey]: snapshot,
    ...extra,
    prompt,
    validation: validation(png),
    review,
    candidates: []
  };
}

export function writeImageMetadataBundle({
  outPath,
  repoRoot,
  generatedAt,
  policy,
  entries,
  entriesKey,
  countKey,
  label
}) {
  const metadata = {
    schemaVersion: 1,
    generatedAt,
    status: 'approved-production-baseline',
    policy,
    [countKey]: entries.length,
    metadataHash: metadataEntriesHash(entries),
    [entriesKey]: entries
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`generated ${path.relative(repoRoot, outPath)} with ${entries.length} approved ${label}`);
  return metadata;
}
