import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { repoRoot } from './artifact-sheet-helpers.js';

const defaultMetadataPath = path.join(repoRoot, 'app', 'shared', 'artifact-image-metadata.json');

function parseArgs(argv) {
  const metadataArg = argv.find((arg) => arg.startsWith('--metadata='));
  return {
    metadataPath: metadataArg ? path.resolve(metadataArg.slice('--metadata='.length)) : defaultMetadataPath
  };
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function main() {
  const { metadataPath } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing artifact image metadata: ${path.relative(repoRoot, metadataPath)}`);
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  if (metadata.schemaVersion !== 1) fail(`Unexpected schemaVersion: ${metadata.schemaVersion}`);
  if (!metadata.policy?.runtimeUsesApprovedOnly) fail('Metadata policy.runtimeUsesApprovedOnly must be true');
  if (!Array.isArray(metadata.artifacts) || !metadata.artifacts.length) {
    fail('Metadata must contain approved artifact entries');
  }

  const seen = new Set();
  for (const entry of metadata.artifacts || []) {
    if (seen.has(entry.id)) fail(`Duplicate metadata entry: ${entry.id}`);
    seen.add(entry.id);
    if (entry.status !== 'approved') fail(`${entry.id}: status must be approved`);
    if (!entry.outputPath || !entry.outputPath.startsWith('web/public/artifacts/')) {
      fail(`${entry.id}: outputPath must point at web/public/artifacts/`);
      continue;
    }
    if (!entry.prompt?.includes('Use the imagegen skill to create a production game artifact bitmap.')) {
      fail(`${entry.id}: missing full generation prompt`);
    }
    if (!entry.visualClassification?.role?.id || !entry.visualClassification?.shine?.id) {
      fail(`${entry.id}: missing visual classification snapshot`);
    }
    if (!entry.validation || entry.validation.status !== 'passed') {
      fail(`${entry.id}: validation status must be passed`);
    }
    if (!entry.review || entry.review.decision !== 'approved') {
      fail(`${entry.id}: review decision must be approved`);
    }

    const filePath = path.join(repoRoot, entry.outputPath);
    if (!fs.existsSync(filePath)) {
      fail(`${entry.id}: missing PNG at ${entry.outputPath}`);
      continue;
    }
    const actualSha = fileSha256(filePath);
    if (actualSha !== entry.png?.sha256) {
      fail(`${entry.id}: sha256 mismatch, metadata=${entry.png?.sha256} actual=${actualSha}`);
    }
  }

  if (metadata.artifactCount !== metadata.artifacts.length) {
    fail(`artifactCount ${metadata.artifactCount} does not match entries ${metadata.artifacts.length}`);
  }

  if (!process.exitCode) {
    console.log(`OK artifact image provenance: ${metadata.artifacts.length} approved artifacts`);
  }
}

main();
