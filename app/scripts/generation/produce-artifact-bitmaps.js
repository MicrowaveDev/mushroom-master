import fs from 'node:fs';
import path from 'node:path';
import { alphaBounds } from '@microwavedev/backpack-game-core/tooling/image-analysis';
import { fitRasterAlphaToCanvas } from '@microwavedev/backpack-game-core/tooling/raster';
import { runChildProcessSync } from '@microwavedev/backpack-game-core/tooling/runners';
import { artifacts } from '../../server/game-data.js';
import { repoRoot } from '../../shared/repo-root.js';
import {
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
  try {
    runChildProcessSync(command, args, { stdio: 'inherit' });
  } catch (error) {
    process.exit(error.result?.code ?? 1);
  }
}

function fitAlphaToSafeCanvas(filePath) {
  const image = readPngRgba(filePath);
  const bounds = alphaBounds(image, { threshold: 23 });
  if (!bounds) {
    throw new Error(`${path.relative(repoRoot, filePath)} has no visible alpha after chroma-key removal`);
  }

  const safeMargin = Math.max(8, Math.round(Math.min(image.width, image.height) * 0.08));
  const fitted = fitRasterAlphaToCanvas(image, {
    width: image.width,
    height: image.height,
    margin: safeMargin,
    threshold: 23,
    resize: 'nearest',
    mode: 'copy'
  });
  fs.writeFileSync(filePath, encodeDeterministicPng(fitted.image));
  console.log(
    `fit ${path.relative(repoRoot, filePath)} bbox=${bounds.width}x${bounds.height} scale=${fitted.scale.toFixed(3)} margin=${safeMargin}px`
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
