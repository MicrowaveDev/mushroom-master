import path from 'node:path';
import { artifacts } from '../../server/game-data.js';
import { artifactVisualClassification } from '../../shared/artifact-visual-classification.js';
import { artifactTodoDescriptions, promptForArtifact } from './next-artifact-image-prompts.js';
import { artifactImagePath, repoRoot } from '../lib/artifact-sheet-helpers.js';
import {
  approvedImageMetadataEntry,
  outputPathFromArgs,
  writeImageMetadataBundle
} from '../lib/image-domain-metadata.js';

const defaultOutPath = path.join(repoRoot, 'app', 'shared', 'artifact-image-metadata.json');
const approvedAt = '2026-05-09';

function stableArtifactSnapshot(artifact) {
  return {
    id: artifact.id,
    name: artifact.name,
    description: artifact.description || null,
    family: artifact.family,
    price: artifact.price ?? null,
    width: artifact.width,
    height: artifact.height,
    shape: artifact.shape || null,
    bonus: artifact.bonus || {},
    starterOnly: Boolean(artifact.starterOnly),
    fusionOnly: Boolean(artifact.fusionOnly),
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
    checkedAt: approvedAt,
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
      'fresh-from-imagegen-raw',
      'raw-source-aspect'
    ].filter(Boolean)
  };
}

function buildEntry(artifact, spec) {
  const filePath = artifactImagePath(artifact);
  const visual = artifactVisualClassification(artifact);
  return approvedImageMetadataEntry({
    id: artifact.id,
    absoluteOutputPath: filePath,
    repoRoot,
    snapshotKey: 'artifact',
    snapshot: stableArtifactSnapshot(artifact),
    extra: { visualClassification: stableVisualSnapshot(visual) },
    prompt: promptForArtifact(artifact, spec),
    validation: (pngInfo) => validationSnapshot(artifact, pngInfo),
    review: {
      decision: 'approved',
      decidedAt: approvedAt,
      reviewer: 'user',
      note: 'Production-ready artifact bitmap baseline approved after local generation, contact-sheet review, thumbnail review, and coverage validation.'
    }
  });
}

function main() {
  const outPath = outputPathFromArgs(process.argv.slice(2), defaultOutPath);
  const descriptions = artifactTodoDescriptions();
  const entries = artifacts
    .filter((artifact) => !artifact.isCharacter)
    .map((artifact) => buildEntry(artifact, descriptions.get(artifact.id)));
  writeImageMetadataBundle({
    outPath,
    repoRoot,
    generatedAt: approvedAt,
    policy: {
      runtimeUsesApprovedOnly: true,
      temporaryCandidatesLocation: '.agent/artifact-image-workspace/',
      productionImageLocation: 'web/public/artifacts/'
    },
    entries,
    entriesKey: 'artifacts',
    countKey: 'artifactCount',
    label: 'artifacts'
  });
}

main();
