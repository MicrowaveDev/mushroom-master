import fs from 'node:fs';
import path from 'node:path';
import { readPngHeader } from '../../scripts/lib/bitmap-image-toolkit.js';

export const HOME_FIELD_ASSET_STATES = Object.freeze([
  'missing',
  'exists',
  'mechanically_valid',
  'needs_regen',
  'needs_review',
  'approved',
  'production_ready'
]);

function allEntries(assetsDoc) {
  return [
    ...(assetsDoc.assets || []),
    ...(assetsDoc.characters || []).map((entry) => ({
      ...entry,
      type: 'character',
      width: entry.spritesheet?.width,
      height: entry.spritesheet?.height
    }))
  ];
}

function queueBlockers(queueDoc) {
  const blockers = new Map();
  for (const item of queueDoc?.items || []) {
    const status = item.sourceGate?.status || '';
    if (item.assetId && /blocked|failed|exhausted/i.test(status)) {
      blockers.set(item.assetId, {
        queueItemId: item.id,
        sourceGateStatus: status,
        sourceSha256: item.sourceGate?.sourceSha256 || null
      });
    }
  }
  return blockers;
}

function inspectFile(entry, assetRoot) {
  const absolutePath = path.join(assetRoot, entry.outputPath);
  if (!fs.existsSync(absolutePath)) {
    return { exists: false, dimensionsValid: false, fileError: null };
  }
  try {
    const header = readPngHeader(absolutePath);
    return {
      exists: true,
      dimensionsValid: header.width === entry.width && header.height === entry.height,
      actualDimensions: `${header.width}x${header.height}`,
      expectedDimensions: `${entry.width}x${entry.height}`,
      fileError: null
    };
  } catch (error) {
    return { exists: true, dimensionsValid: false, fileError: error.message };
  }
}

function stateFor({ entry, review, file, blocker }) {
  if (!file.exists) return 'missing';
  if (['needs_regen', 'rejected'].includes(review?.verdict)) return 'needs_regen';
  if (['pending', 'needs_review'].includes(review?.verdict) || !review) return 'needs_review';
  if (!file.dimensionsValid) return 'exists';
  if (entry.status === 'approved' && review?.verdict === 'approved' && review?.accepted === true) {
    return blocker ? 'approved' : 'production_ready';
  }
  if (review?.verdict === 'approved' || entry.status === 'approved') return 'approved';
  return 'mechanically_valid';
}

export function buildHomeFieldStatus({ assetsDoc, reviewDoc, queueDoc, assetRoot }) {
  const reviews = new Map((reviewDoc?.assets || []).map((entry) => [entry.id, entry]));
  const blockers = queueBlockers(queueDoc);
  const entries = allEntries(assetsDoc).map((entry) => {
    const review = reviews.get(entry.id) || null;
    const blocker = blockers.get(entry.id) || null;
    const file = inspectFile(entry, assetRoot);
    const state = stateFor({ entry, review, file, blocker });
    return {
      id: entry.id,
      type: entry.type,
      outputPath: entry.outputPath,
      manifestStatus: entry.status,
      reviewVerdict: review?.verdict || 'unreviewed',
      reviewAccepted: review?.accepted === true,
      state,
      productionReady: state === 'production_ready',
      ...file,
      blocker
    };
  });
  const stateCounts = Object.fromEntries(HOME_FIELD_ASSET_STATES.map((state) => [
    state,
    entries.filter((entry) => entry.state === state).length
  ]));
  return {
    total: entries.length,
    productionReady: stateCounts.production_ready,
    allProductionReady: entries.length > 0 && stateCounts.production_ready === entries.length,
    stateCounts,
    entries
  };
}

export function formatHomeFieldStatus(status) {
  const lines = [
    '# Home Field production status',
    '',
    `Production ready: ${status.productionReady}/${status.total}`,
    `States: ${HOME_FIELD_ASSET_STATES.map((state) => `${state}=${status.stateCounts[state]}`).join(', ')}`,
    ''
  ];
  for (const entry of status.entries) {
    const blocker = entry.blocker ? ` blocker=${entry.blocker.sourceGateStatus}` : '';
    lines.push(`[${entry.productionReady ? 'x' : ' '}] ${entry.id} state=${entry.state} manifest=${entry.manifestStatus} review=${entry.reviewVerdict}${blocker}`);
  }
  lines.push('');
  lines.push(status.allProductionReady
    ? 'All registered assets are production ready.'
    : 'Not all registered assets are production ready. File existence alone is not approval.');
  return lines.join('\n');
}
