import fs from 'node:fs';
import path from 'node:path';
import { artifacts, getArtifactById } from '../../server/game-data.js';
import { artifactFusionRecipes } from '../../shared/artifact-fusions.js';
import { repoRoot } from '../../shared/repo-root.js';

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

const recipeIds = new Set();
const resultIds = new Set();
const ingredientPairs = new Set();

for (const recipe of artifactFusionRecipes) {
  if (recipeIds.has(recipe.id)) fail(`duplicate recipe id ${recipe.id}`);
  recipeIds.add(recipe.id);

  if (resultIds.has(recipe.resultArtifactId)) fail(`duplicate fusion result ${recipe.resultArtifactId}`);
  resultIds.add(recipe.resultArtifactId);

  const result = getArtifactById(recipe.resultArtifactId);
  if (!result) fail(`missing result artifact ${recipe.resultArtifactId}`);
  else if (!result.fusionOnly) fail(`result artifact ${recipe.resultArtifactId} must be fusionOnly`);

  if (!Array.isArray(recipe.ingredientArtifactIds) || recipe.ingredientArtifactIds.length < 2) {
    fail(`recipe ${recipe.id} must have at least two ingredients`);
  }

  const normalizedPair = [...recipe.ingredientArtifactIds].sort().join('+');
  if (ingredientPairs.has(normalizedPair)) fail(`duplicate ingredient set ${normalizedPair}`);
  ingredientPairs.add(normalizedPair);

  for (const ingredientId of recipe.ingredientArtifactIds) {
    const ingredient = getArtifactById(ingredientId);
    if (!ingredient) fail(`recipe ${recipe.id} references missing ingredient ${ingredientId}`);
    else if (ingredient.family === 'bag' || ingredient.fusionOnly || ingredient.starterOnly) {
      fail(`recipe ${recipe.id} uses ineligible ingredient ${ingredientId}`);
    }
  }

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

const fusionOnlyArtifacts = artifacts.filter((artifact) => artifact.fusionOnly);
const unreferencedFusionOnly = fusionOnlyArtifacts.filter((artifact) => !resultIds.has(artifact.id));
if (unreferencedFusionOnly.length > 0) {
  fail(`fusionOnly artifacts without recipes: ${unreferencedFusionOnly.map((artifact) => artifact.id).join(', ')}`);
}

if (!process.exitCode) {
  ok(`${artifactFusionRecipes.length} fusion recipes have valid data, PNGs, and derived UI counts`);
}
