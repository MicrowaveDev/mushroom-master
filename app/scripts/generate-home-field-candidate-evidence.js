#!/usr/bin/env node
/**
 * Bind a candidate review to exact local evidence.
 *
 * This does not approve art. It writes a small manifest with candidate PNG
 * hashes and clean-preview screenshot hashes so review rows can reference the
 * exact files that were inspected.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileSha256, bufferSha256 } from './lib/bitmap-image-toolkit.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const sharedDir = path.join(repoRoot, 'app', 'shared', 'home-field');
const assetsPath = process.env.HOME_FIELD_ASSETS_PATH
  ? path.resolve(repoRoot, process.env.HOME_FIELD_ASSETS_PATH)
  : path.join(sharedDir, 'home-field-assets.json');
const candidateRoot = process.env.HOME_FIELD_CANDIDATE_ROOT
  ? path.resolve(repoRoot, process.env.HOME_FIELD_CANDIDATE_ROOT)
  : path.join(repoRoot, '.agent', 'home-field-workspace', 'candidates', 'terrain-family', 'latest');
const reviewDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'review');
const outPath = path.join(reviewDir, 'candidate-evidence.manifest.json');
const manifestDir = path.join(repoRoot, '.agent', 'home-field-workspace', 'manifests');
const recoveredFailureNotesPath = path.join(reviewDir, 'recovered-failure-notes.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseListArg(argv, name) {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.slice(name.length + 3).split(',').map((v) => v.trim()).filter(Boolean);
}

function candidateIds(argv) {
  const explicit = parseListArg(argv, 'ids');
  if (explicit) return explicit;
  const envIds = process.env.HOME_FIELD_CANDIDATE_IDS;
  if (!envIds) return [];
  return envIds.split(',').map((v) => v.trim()).filter(Boolean);
}

function allAssets(doc) {
  return [
    ...(doc.assets || []),
    ...(doc.characters || []).map((character) => ({
      ...character,
      type: 'character',
      outputPath: character.outputPath,
      sourcePath: character.sourcePath
    }))
  ];
}

function hashIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return {
    path: path.relative(repoRoot, filePath),
    sha256: fileSha256(filePath)
  };
}

function characterSourceBase(asset) {
  if (!asset.sourcePath) return asset.id;
  const name = path.basename(asset.sourcePath);
  for (const suffix of ['.states.source.png', '.source.png']) {
    if (name.endsWith(suffix)) return name.slice(0, -suffix.length);
  }
  return path.parse(name).name;
}

function chibiFramePaths(asset) {
  const base = characterSourceBase(asset);
  const sourceDir = asset.sourcePath
    ? path.dirname(path.join(repoRoot, asset.sourcePath))
    : path.join(repoRoot, '.agent', 'home-field-workspace', 'raw');
  const directions = asset.spritesheet?.rowOrder || ['down', 'up', 'left', 'right'];
  const idleCols = asset.spritesheet?.framesPerRow?.idle || [0, 1];
  const walkCols = asset.spritesheet?.framesPerRow?.walk || [2, 3, 4, 5, 6, 7];
  return directions.flatMap((dir) => [
    ...idleCols.map((_, idx) => path.join(sourceDir, `${base}.frame_idle_${dir}_${idx}.source.png`)),
    ...walkCols.map((_, idx) => path.join(sourceDir, `${base}.frame_walk_${dir}_${idx}.source.png`))
  ]);
}

function chibiSourceEvidence(asset, missing) {
  if (asset.type !== 'character' || !asset.spritesheet) return null;
  const base = characterSourceBase(asset);
  const rawDir = asset.sourcePath
    ? path.dirname(path.join(repoRoot, asset.sourcePath))
    : path.join(repoRoot, '.agent', 'home-field-workspace', 'raw');
  const referencePath = path.join(repoRoot, '.agent', 'home-field-workspace', 'reference', `${base}_turnaround.reference.png`);
  const stateSheetPath = path.join(rawDir, `${base}.states.source.png`);
  const framePaths = chibiFramePaths(asset);
  const frameHashes = framePaths.map((framePath) => hashIfExists(framePath));
  const missingFrames = framePaths
    .filter((framePath, idx) => !frameHashes[idx])
    .map((framePath) => path.relative(repoRoot, framePath));
  const reference = hashIfExists(referencePath);
  const groupedStateSheet = hashIfExists(stateSheetPath);
  if (!reference) missing.push(`missing chibi reference sheet: ${path.relative(repoRoot, referencePath)}`);
  if (!groupedStateSheet) missing.push(`missing chibi grouped state sheet: ${path.relative(repoRoot, stateSheetPath)}`);
  if (missingFrames.length > 0) {
    missing.push(`missing chibi split frames for "${asset.id}": ${missingFrames.slice(0, 4).join(', ')}${missingFrames.length > 4 ? ` (+${missingFrames.length - 4} more)` : ''}`);
  }
  const presentFrameHashes = frameHashes.filter(Boolean);
  const frameSetSha256 = bufferSha256(Buffer.from(JSON.stringify(presentFrameHashes, null, 2)));
  return {
    reference,
    groupedStateSheet,
    splitFrames: {
      expected: framePaths.length,
      present: presentFrameHashes.length,
      missing: missingFrames,
      frameSetSha256,
      frames: presentFrameHashes
    }
  };
}

function latestSharedSourceFor(ids) {
  if (!fs.existsSync(manifestDir)) return null;
  const required = new Set(ids);
  const candidates = fs.readdirSync(manifestDir)
    .filter((name) => /^produce-(grass|path)-family-.*\.json$/.test(name))
    .map((name) => {
      const filePath = path.join(manifestDir, name);
      return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of candidates) {
    let doc;
    try {
      doc = loadJson(candidate.filePath);
    } catch {
      continue;
    }
    const outputIds = new Set((doc.outputs || []).map((entry) => entry.id));
    const coversAll = [...required].every((id) => outputIds.has(id));
    const isSharedFamily = doc.policy?.oneSharedSourceForGrassFamily || doc.policy?.oneSharedSourceForPathFamily;
    if (!coversAll || !isSharedFamily || !doc.source?.path) continue;
    const abs = path.resolve(repoRoot, doc.source.path);
    const hashed = hashIfExists(abs);
    if (!hashed) continue;
    return {
      ...hashed,
      producerManifest: path.relative(repoRoot, candidate.filePath)
    };
  }
  return null;
}

function screenshotEvidence() {
  const names = [
    'home-field-candidate-mobile-clean.png',
    'home-field-candidate-desktop-clean.png',
    'contact-sheet.png',
    'grass-family-sheet.png',
    'adjacency-sheet.png',
    'mobile-readability-sheet.png',
    'alpha-halo-sheet.png'
  ];
  return names
    .map((name) => hashIfExists(path.join(reviewDir, name)))
    .filter(Boolean);
}

function previewEvidence() {
  const names = [
    'home-field-candidate-mobile-clean.png',
    'home-field-candidate-mobile-clean.json',
    'home-field-candidate-desktop-clean.png',
    'home-field-candidate-desktop-clean.json'
  ];
  return names
    .map((name) => hashIfExists(path.join(reviewDir, name)))
    .filter(Boolean);
}

function recoveredFailureNotes() {
  const fallback = {
    status: 'none',
    notes: []
  };
  if (!fs.existsSync(recoveredFailureNotesPath)) return fallback;
  try {
    const parsed = loadJson(recoveredFailureNotesPath);
    return {
      path: path.relative(repoRoot, recoveredFailureNotesPath),
      ...parsed
    };
  } catch (err) {
    return {
      path: path.relative(repoRoot, recoveredFailureNotesPath),
      status: 'parse_error',
      error: err.message,
      raw: fs.readFileSync(recoveredFailureNotesPath, 'utf8')
    };
  }
}

function separateShadowTileEvidence(byId) {
  const shadow = byId.get('chibi_shadow');
  if (!shadow) return null;
  return {
    id: shadow.id,
    role: shadow.role || 'shared_chibi_ground_shadow',
    policy: 'separate renderer/asset layer; not baked into chibi frames',
    rawSource: shadow.sourcePath ? hashIfExists(path.join(repoRoot, shadow.sourcePath)) : null,
    candidateOutput: hashIfExists(path.join(candidateRoot, shadow.outputPath))
  };
}

function main() {
  const argv = process.argv.slice(2);
  const ids = candidateIds(argv);
  if (ids.length === 0) {
    console.error('Usage: HOME_FIELD_CANDIDATE_IDS=id_a,id_b HOME_FIELD_CANDIDATE_ROOT=<root> npm run game:home-field:candidate-evidence');
    console.error('   or: node app/scripts/generate-home-field-candidate-evidence.js --ids=id_a,id_b');
    process.exit(1);
  }

  const assetsDoc = loadJson(assetsPath);
  const byId = new Map(allAssets(assetsDoc).map((asset) => [asset.id, asset]));
  const missing = [];
  const sharedRawSource = latestSharedSourceFor(ids);
  const entries = ids.map((id) => {
    const asset = byId.get(id);
    if (!asset) {
      missing.push(`unknown asset id: ${id}`);
      return null;
    }
    const candidateOutput = path.join(candidateRoot, asset.outputPath);
    const rawSource = asset.sourcePath ? path.join(repoRoot, asset.sourcePath) : null;
    const output = hashIfExists(candidateOutput);
    const chibiSources = chibiSourceEvidence(asset, missing);
    if (!output) missing.push(`missing candidate output: ${path.relative(repoRoot, candidateOutput)}`);
    return {
      id,
      type: asset.type,
      candidateOutput: output,
      rawSource: chibiSources?.groupedStateSheet || sharedRawSource || (rawSource ? hashIfExists(rawSource) : null),
      ...(chibiSources ? { chibiSources } : {})
    };
  }).filter(Boolean);

  if (missing.length > 0) {
    for (const message of missing) console.error(message);
    process.exit(1);
  }

  ensureDir(reviewDir);
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    candidateRoot: path.relative(repoRoot, candidateRoot),
    ids,
    entries,
    previews: previewEvidence(),
    reviewEvidence: screenshotEvidence(),
    separateShadowTile: separateShadowTileEvidence(byId),
    recoveredFailureNotes: recoveredFailureNotes(),
    ...(sharedRawSource ? { sharedRawSource } : {})
  };
  const encoded = Buffer.from(JSON.stringify(manifest, null, 2));
  manifest.manifestSha256 = bufferSha256(encoded);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  console.log(`home-field candidate evidence: ${path.relative(repoRoot, outPath)}`);
}

main();
