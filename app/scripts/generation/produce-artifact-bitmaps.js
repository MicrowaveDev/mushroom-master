import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { artifacts } from '../../server/game-data.js';
import { repoRoot } from '../../shared/repo-root.js';
import {
  alphaStats,
  encodeDeterministicPng,
  readPngRgba
} from '../lib/bitmap-image-toolkit.js';
import { normalizeArtifact } from '../lib/artifact-detail-normalizer.js';

const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
const workspace = process.env.ARTIFACT_IMAGE_WORKSPACE
  ? path.resolve(process.env.ARTIFACT_IMAGE_WORKSPACE)
  : path.join(repoRoot, '.agent', 'artifact-image-workspace');
const rawDir = path.join(workspace, 'raw');
const outDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const chromaKeyScript = path.join(
  process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex'),
  'skills',
  '.system',
  'imagegen',
  'scripts',
  'remove_chroma_key.py'
);
const bundledPython = path.join(
  process.env.HOME || '',
  '.cache',
  'codex-runtimes',
  'codex-primary-runtime',
  'dependencies',
  'python',
  'bin',
  'python3'
);
const pythonBin = process.env.PYTHON || (fs.existsSync(bundledPython) ? bundledPython : 'python3');

function parseArgs(argv) {
  const ids = [];
  let keyColor = '#ff00ff';
  let force = true;
  let fit = true;
  let normalizeDetail = false;
  for (const arg of argv) {
    if (arg === '--no-force') force = false;
    else if (arg === '--no-fit') fit = false;
    else if (arg === '--normalize-detail') normalizeDetail = true;
    else if (arg.startsWith('--key=')) keyColor = arg.slice('--key='.length);
    else ids.push(arg.replace(/\.png$/, ''));
  }
  return { ids, keyColor, force, fit, normalizeDetail };
}

function sourceFor(id) {
  const candidates = [
    path.join(rawDir, `${id}.source.png`),
    path.join(rawDir, `${id}.png`)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function fitAlphaToSafeCanvas(filePath) {
  const image = readPngRgba(filePath);
  const bounds = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
  if (!bounds.bboxWidth || !bounds.bboxHeight) {
    throw new Error(`${path.relative(repoRoot, filePath)} has no visible alpha after chroma-key removal`);
  }

  const safeMargin = Math.max(8, Math.round(Math.min(image.width, image.height) * 0.08));
  const targetWidth = image.width - safeMargin * 2;
  const targetHeight = image.height - safeMargin * 2;
  const scale = Math.min(targetWidth / bounds.bboxWidth, targetHeight / bounds.bboxHeight);
  const fittedWidth = Math.max(1, Math.round(bounds.bboxWidth * scale));
  const fittedHeight = Math.max(1, Math.round(bounds.bboxHeight * scale));
  const targetX = Math.round((image.width - fittedWidth) / 2);
  const targetY = Math.round((image.height - fittedHeight) / 2);
  const rgba = Buffer.alloc(image.width * image.height * 4);

  for (let y = 0; y < fittedHeight; y += 1) {
    const srcY = bounds.minY + Math.min(bounds.bboxHeight - 1, Math.floor(y / scale));
    for (let x = 0; x < fittedWidth; x += 1) {
      const srcX = bounds.minX + Math.min(bounds.bboxWidth - 1, Math.floor(x / scale));
      const source = (srcY * image.width + srcX) * 4;
      const target = ((targetY + y) * image.width + targetX + x) * 4;
      image.rgba.copy(rgba, target, source, source + 4);
    }
  }

  fs.writeFileSync(filePath, encodeDeterministicPng({ width: image.width, height: image.height, rgba }));
  console.log(
    `fit ${path.relative(repoRoot, filePath)} bbox=${bounds.bboxWidth}x${bounds.bboxHeight} scale=${scale.toFixed(3)} margin=${safeMargin}px`
  );
}

const { ids, keyColor, force, fit, normalizeDetail } = parseArgs(process.argv.slice(2));
if (ids.length === 0) {
  console.error('Usage: npm run game:artifacts:produce -- artifact_id...');
  console.error(`Expected raw sources at ${path.relative(repoRoot, rawDir)}/{artifact_id}.source.png`);
  process.exit(1);
}

if (!fs.existsSync(chromaKeyScript)) {
  console.error(`Missing chroma-key helper: ${chromaKeyScript}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

for (const id of ids) {
  if (!artifactById.has(id)) {
    console.error(`Unknown artifact id: ${id}`);
    process.exit(1);
  }
  const source = sourceFor(id);
  if (!fs.existsSync(source)) {
    console.error(`Missing raw source for ${id}: ${path.relative(repoRoot, source)}`);
    process.exit(1);
  }

  const outPath = path.join(outDir, `${id}.png`);
  run(pythonBin, [
    chromaKeyScript,
    '--input',
    source,
    '--out',
    outPath,
    '--key-color',
    keyColor,
    '--soft-matte',
    ...(force ? ['--force'] : [])
  ]);
  if (fit) {
    fitAlphaToSafeCanvas(outPath);
  }
  if (normalizeDetail) {
    const normalized = normalizeArtifact(artifactById.get(id));
    console.log(`normalized ${id} (${normalized.policy}); provenance invalidated until regenerated after review`);
  }
  run('npm', ['run', 'game:artifacts:validate', '--', id]);
}

console.log(`Produced and validated ${ids.length} artifact PNG${ids.length === 1 ? '' : 's'}.`);
