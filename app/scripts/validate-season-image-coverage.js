import fs from 'node:fs';
import path from 'node:path';
import {
  repoRoot,
  readPngRgba,
  alphaStats
} from './lib/bitmap-image-toolkit.js';
import { buildSeasonImageEntries, relativeOutputPath } from './season-sheet-helpers.js';

const seasonImageWorkspace = process.env.SEASON_IMAGE_WORKSPACE
  ? path.resolve(process.env.SEASON_IMAGE_WORKSPACE)
  : path.join(repoRoot, '.agent', 'season-image-workspace');
const imagegenRawDir = path.join(seasonImageWorkspace, 'raw');

// Season emblems are uniform 192x192 medallions, simpler than the artifact
// rules: no shape masks, no per-cell coverage. Tightest expectation is a
// safe transparent border + a recognizable centered subject.
const TARGET_DIM = 192;
const SAFE_MARGIN = 6;          // px from any canvas edge
const MIN_COVERAGE = 0.18;      // ≥18% non-transparent pixels
const MIN_BBOX_FILL = 0.62;     // subject fills ≥62% of canvas on both axes
const MAX_BBOX_FILL = 0.94;     // and ≤94% (otherwise it touches edges)

function parseArgs(argv) {
  const ids = [];
  let all = false;
  let freshFromImagegenRaw = true;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') all = true;
    else if (arg === '--no-fresh-from-imagegen-raw') freshFromImagegenRaw = false;
    else if (arg === '--fresh-from-imagegen-raw') freshFromImagegenRaw = true;
    else ids.push(arg.replace(/\.png$/, ''));
  }
  return { all, ids, freshFromImagegenRaw };
}

function rawSourceCandidatesFor(entry) {
  const baseId = entry.kind === 'rank' ? entry.rankId : entry.achievementId;
  return [
    path.join(imagegenRawDir, `${baseId}.png`),
    path.join(imagegenRawDir, `${entry.id}.png`)
  ];
}

function checkFreshness(entry, problems) {
  if (!fs.existsSync(entry.outputPath)) return;
  const appMtime = fs.statSync(entry.outputPath).mtimeMs;
  const candidates = rawSourceCandidatesFor(entry);
  const present = candidates.filter((p) => fs.existsSync(p));
  if (!present.length) return;
  for (const candidate of present) {
    const rawMtime = fs.statSync(candidate).mtimeMs;
    if (rawMtime > appMtime) {
      problems.push(`raw source ${path.relative(repoRoot, candidate)} is newer than app PNG (${new Date(rawMtime).toISOString()} > ${new Date(appMtime).toISOString()})`);
    }
  }
}

function validateEntry(entry, { freshFromImagegenRaw }) {
  const problems = [];
  if (!fs.existsSync(entry.outputPath)) {
    return { problems: [`missing PNG at ${relativeOutputPath(entry)}`] };
  }

  const image = readPngRgba(entry.outputPath);
  if (image.width !== TARGET_DIM || image.height !== TARGET_DIM) {
    problems.push(`expected ${TARGET_DIM}x${TARGET_DIM}, got ${image.width}x${image.height}`);
  }

  const stats = alphaStats(image, { x: 0, y: 0, width: image.width, height: image.height });
  if (stats.coverage < MIN_COVERAGE) {
    problems.push(`alpha coverage ${(stats.coverage * 100).toFixed(1)}% is below minimum ${(MIN_COVERAGE * 100).toFixed(0)}%`);
  }
  if (stats.bboxFillX < MIN_BBOX_FILL || stats.bboxFillY < MIN_BBOX_FILL) {
    problems.push(`bbox fill ${(stats.bboxFillX * 100).toFixed(0)}%x${(stats.bboxFillY * 100).toFixed(0)}% is below ${(MIN_BBOX_FILL * 100).toFixed(0)}%`);
  }
  if (stats.bboxFillX > MAX_BBOX_FILL || stats.bboxFillY > MAX_BBOX_FILL) {
    problems.push(`bbox fill ${(stats.bboxFillX * 100).toFixed(0)}%x${(stats.bboxFillY * 100).toFixed(0)}% is above ${(MAX_BBOX_FILL * 100).toFixed(0)}% (subject touches the canvas edge)`);
  }
  if (stats.marginLeft < SAFE_MARGIN || stats.marginRight < SAFE_MARGIN
      || stats.marginTop < SAFE_MARGIN || stats.marginBottom < SAFE_MARGIN) {
    problems.push(`safe edge margin under ${SAFE_MARGIN}px (left=${stats.marginLeft}, right=${stats.marginRight}, top=${stats.marginTop}, bottom=${stats.marginBottom})`);
  }

  if (freshFromImagegenRaw) checkFreshness(entry, problems);

  return {
    problems,
    summary: `coverage=${(stats.coverage * 100).toFixed(0)}% bbox=${(stats.bboxFillX * 100).toFixed(0)}%x${(stats.bboxFillY * 100).toFixed(0)}%`
  };
}

function main() {
  const { all, ids, freshFromImagegenRaw } = parseArgs(process.argv.slice(2));
  const entries = buildSeasonImageEntries();
  const subset = all
    ? entries
    : entries.filter((entry) => {
        const baseId = entry.kind === 'rank' ? entry.rankId : entry.achievementId;
        return ids.includes(entry.id) || ids.includes(baseId);
      });

  if (!subset.length) {
    if (ids.length) {
      console.error(`No matching season entries for: ${ids.join(', ')}`);
      process.exit(1);
    }
    console.log('Pass --all or one or more entry ids.');
    process.exit(1);
  }

  let failures = 0;
  for (const entry of subset) {
    const { problems, summary } = validateEntry(entry, { freshFromImagegenRaw });
    if (problems.length) {
      failures += 1;
      console.error(`FAIL ${entry.id}:`);
      for (const problem of problems) console.error(`  - ${problem}`);
    } else {
      console.log(`OK   ${entry.id}: ${summary}`);
    }
  }

  if (failures) {
    console.error(`\n${failures} season image(s) failed validation`);
    process.exit(1);
  }
}

main();
