import { artifactFusionRecipes } from '../../app/shared/artifact-fusions.js';

export const expectedFusionRecipeCount = artifactFusionRecipes.length;
export const expectedFusionLabArtifactGridCount = artifactFusionRecipes.reduce(
  (sum, recipe) => sum + recipe.ingredientArtifactIds.length + 1,
  0
);

export function expectedFusionPlayAllTimeoutMs({
  baseMs = 3000,
  perRecipeMs = 3200
} = {}) {
  return baseMs + expectedFusionRecipeCount * perRecipeMs;
}
