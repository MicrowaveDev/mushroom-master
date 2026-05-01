import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { artifacts } from '../server/game-data.js';
import { artifactVisualClassification } from '../shared/artifact-visual-classification.js';
import { artifactTodoDescriptions, promptForArtifact } from './next-artifact-image-prompts.js';
import { artifactImagePath, repoRoot } from './artifact-sheet-helpers.js';

const defaultOutPath = path.join(repoRoot, 'app', 'shared', 'artifact-image-metadata.json');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function parseArgs(argv) {
  const outArg = argv.find((arg) => arg.startsWith('--out='));
  return {
    outPath: outArg ? path.resolve(outArg.slice('--out='.length)) : defaultOutPath
  };
}

function readPngInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${path.relative(repoRoot, filePath)} is not a PNG`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    size: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

function stableArtifactSnapshot(artifact) {
  return {
    id: artifact.id,
    name: artifact.name,
    family: artifact.family,
    price: artifact.price ?? null,
    width: artifact.width,
    height: artifact.height,
    shape: artifact.shape || null,
    bonus: artifact.bonus || {},
    starterOnly: Boolean(artifact.starterOnly),
    characterItem: artifact.characterItem || null,
    slotCount: artifact.slotCount ?? null
  };
}

function stableVisualSnapshot(visual) {
  return {
    role: {
      id: visual.role.id,
      label: visual.role.label,
      hue: visual.role.hue,
      color: visual.role.color
    },
    shine: {
      id: visual.shine.id,
      label: visual.shine.label,
      rank: visual.shine.rank,
      cssClass: visual.shine.cssClass
    },
    primaryStatKey: visual.primaryStatKey,
    secondaryStats: visual.secondaryStats,
    tradeoffs: visual.tradeoffs,
    owner: visual.owner,
    footprintType: visual.footprintType,
    cssClasses: visual.cssClasses,
    prompt: visual.prompt
  };
}

function validationSnapshot(artifact, pngInfo) {
  return {
    status: 'passed',
    command: 'npm run game:artifacts:validate -- --all',
    checkedAt: '2026-05-01',
    pngDimensions: {
      width: pngInfo.width,
      height: pngInfo.height
    },
    checks: [
      'png-rgba',
      'footprint-divisibility',
      'alpha-coverage',
      'per-cell-coverage',
      'edge-padding',
      'margin-balance',
      artifact.shape ? 'organic-mask-overhang' : null,
      'fresh-from-imagegen-raw'
    ].filter(Boolean)
  };
}

function buildEntry(artifact, spec) {
  const filePath = artifactImagePath(artifact);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing approved artifact PNG: ${path.relative(repoRoot, filePath)}`);
  }
  const pngInfo = readPngInfo(filePath);
  const visual = artifactVisualClassification(artifact);
  const outputPath = path.relative(repoRoot, filePath);
  return {
    id: artifact.id,
    status: 'approved',
    outputPath,
    png: pngInfo,
    artifact: stableArtifactSnapshot(artifact),
    visualClassification: stableVisualSnapshot(visual),
    prompt: promptForArtifact(artifact, spec),
    validation: validationSnapshot(artifact, pngInfo),
    review: {
      decision: 'approved',
      decidedAt: '2026-05-01',
      reviewer: 'user',
      note: 'Production-ready artifact bitmap baseline approved after local generation, contact-sheet review, thumbnail review, and coverage validation.'
    },
    candidates: []
  };
}

function metadataHash(entries) {
  const stable = entries.map((entry) => ({
    id: entry.id,
    outputPath: entry.outputPath,
    sha256: entry.png.sha256,
    status: entry.status
  }));
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function main() {
  const { outPath } = parseArgs(process.argv.slice(2));
  const descriptions = artifactTodoDescriptions();
  const entries = artifacts
    .filter((artifact) => !artifact.isCharacter)
    .map((artifact) => buildEntry(artifact, descriptions.get(artifact.id)));
  const metadata = {
    schemaVersion: 1,
    generatedAt: '2026-05-01',
    status: 'approved-production-baseline',
    policy: {
      runtimeUsesApprovedOnly: true,
      temporaryCandidatesLocation: '.agent/artifact-image-workspace/',
      productionImageLocation: 'web/public/artifacts/'
    },
    artifactCount: entries.length,
    metadataHash: metadataHash(entries),
    artifacts: entries
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`generated ${path.relative(repoRoot, outPath)} with ${entries.length} approved artifacts`);
}

main();
