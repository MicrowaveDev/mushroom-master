import fs from 'node:fs';
import path from 'node:path';
import { artifacts, getArtifactById } from '../../server/game-data.js';
import { artifactFusionRecipes } from '../../shared/artifact-fusions.js';
import { repoRoot } from '../../shared/repo-root.js';
import { validateFusionCatalog } from '@microwavedev/backpack-game-core/modules/fusion';

const artifactDir = path.join(repoRoot, 'web', 'public', 'artifacts');
const scanFiles = [
  'tests/game/fusion-ui.spec.js',
  'tests/game/screenshots.spec.js'
];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK ${message}`);
}

const resultIds = new Set();
for (const recipe of artifactFusionRecipes) resultIds.add(recipe.resultArtifactId);
for (const issue of validateFusionCatalog({
  recipes: artifactFusionRecipes,
  artifacts,
  isIngredientEligible: (artifact) => artifact.family !== 'bag' && !artifact.fusionOnly && !artifact.starterOnly
})) {
  fail(issue.message);
}

for (const recipe of artifactFusionRecipes) {

  const imagePath = path.join(artifactDir, `${recipe.resultArtifactId}.png`);
  if (!fs.existsSync(imagePath)) fail(`missing fusion result PNG ${path.relative(repoRoot, imagePath)}`);
}

for (const file of scanFiles) {
  const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  const hardcodedRecipeCount = /(?:sidebar-recipe-card|fusion-lab-recipe-card)[\s\S]{0,120}?toHaveCount\(\d+\)/;
  const hardcodedLabGridCount = /fusion-lab-list \\.artifact-grid-board--catalog[\s\S]{0,120}?toHaveCount\(\d+\)/;
  if (hardcodedRecipeCount.test(source)) {
    fail(`${file} has a hard-coded fusion recipe count; use tests/game/fusion-catalog-helpers.js`);
  }
  if (hardcodedLabGridCount.test(source)) {
    fail(`${file} has a hard-coded fusion lab artifact grid count; use tests/game/fusion-catalog-helpers.js`);
  }
}

if (!process.exitCode) {
  ok(`${artifactFusionRecipes.length} fusion recipes have valid data, PNGs, and derived UI counts`);
}
