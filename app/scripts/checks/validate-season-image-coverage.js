import fs from 'node:fs';
import path from 'node:path';
import {
  repoRoot,
  readPngRgba
} from '../lib/bitmap-image-toolkit.js';
import { validateImagePolicy, validateOutputFreshness } from '@microwavedev/backpack-game-core/tooling/image-validation';
import { buildSeasonImageEntries, relativeOutputPath } from '../lib/season-sheet-helpers.js';

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
  for (const issue of validateOutputFreshness(entry.outputPath, rawSourceCandidatesFor(entry))) {
    const rawMtime = fs.statSync(issue.sourcePath).mtimeMs;
    const appMtime = fs.statSync(entry.outputPath).mtimeMs;
    problems.push(`raw source ${path.relative(repoRoot, issue.sourcePath)} is newer than app PNG (${new Date(rawMtime).toISOString()} > ${new Date(appMtime).toISOString()})`);
  }
}

function validateEntry(entry, { freshFromImagegenRaw }) {
  const problems = [];
  if (!fs.existsSync(entry.outputPath)) {
    return { problems: [`missing PNG at ${relativeOutputPath(entry)}`] };
  }

  const image = readPngRgba(entry.outputPath);
  const { issues, stats } = validateImagePolicy(image, {
    width: TARGET_DIM,
    height: TARGET_DIM,
    minCoverage: MIN_COVERAGE,
    minBboxFillX: MIN_BBOX_FILL,
    minBboxFillY: MIN_BBOX_FILL,
    maxBboxFillX: MAX_BBOX_FILL,
    maxBboxFillY: MAX_BBOX_FILL,
    minMargin: SAFE_MARGIN
  });
  for (const issue of issues) {
    if (issue.code === 'dimensions') problems.push(issue.message);
    else if (issue.policyKey === 'minCoverage') problems.push(`alpha coverage ${(issue.actual * 100).toFixed(1)}% is below minimum ${(issue.expected * 100).toFixed(0)}%`);
    else if (issue.policyKey === 'minBboxFillX' || issue.policyKey === 'minBboxFillY') {
      if (!problems.some((problem) => problem.startsWith('bbox fill') && problem.includes('below'))) problems.push(`bbox fill ${(stats.bboxFillX * 100).toFixed(0)}%x${(stats.bboxFillY * 100).toFixed(0)}% is below ${(MIN_BBOX_FILL * 100).toFixed(0)}%`);
    } else if (issue.policyKey === 'maxBboxFillX' || issue.policyKey === 'maxBboxFillY') {
      if (!problems.some((problem) => problem.startsWith('bbox fill') && problem.includes('above'))) problems.push(`bbox fill ${(stats.bboxFillX * 100).toFixed(0)}%x${(stats.bboxFillY * 100).toFixed(0)}% is above ${(MAX_BBOX_FILL * 100).toFixed(0)}% (subject touches the canvas edge)`);
    } else if (issue.code === 'margin') {
      problems.push(`safe edge margin under ${SAFE_MARGIN}px (left=${stats.marginLeft}, right=${stats.marginRight}, top=${stats.marginTop}, bottom=${stats.marginBottom})`);
    } else problems.push(issue.message);
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
