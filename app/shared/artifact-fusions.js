export const artifactFusionRecipes = [
  {
    id: 'portal_cut_sickle',
    resultArtifactId: 'portal_cut_sickle',
    ingredientArtifactIds: ['sporeblade', 'mirrorloop_knot']
  }
];

export function getArtifactFusionRecipe(recipeId) {
  return artifactFusionRecipes.find((recipe) => recipe.id === recipeId) || null;
}

function canUseFusionIngredient(row, getArtifact, recipe) {
  if (!row?.id || !row.artifactId) return false;
  const artifact = getArtifact(row.artifactId);
  if (!artifact) return false;
  if (artifact.family === 'bag') return false;
  if (artifact.starterOnly) return false;
  if (artifact.fusionOnly && !recipe.allowFusionIngredients) return false;
  return true;
}

function rowMatchesIngredient(row, ingredientArtifactId, getArtifact, recipe) {
  return row.artifactId === ingredientArtifactId
    && canUseFusionIngredient(row, getArtifact, recipe);
}

export function findArtifactFusionMatches(rows, getArtifact, recipes = artifactFusionRecipes) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const usedRowIds = new Set();
  const matches = [];

  for (const recipe of recipes) {
    if (!recipe?.resultArtifactId || !Array.isArray(recipe.ingredientArtifactIds)) continue;

    while (true) {
      const ingredients = [];
      const ingredientRowIds = new Set();
      for (const ingredientArtifactId of recipe.ingredientArtifactIds) {
        const row = sourceRows.find((candidate) =>
          !usedRowIds.has(candidate.id)
          && !ingredientRowIds.has(candidate.id)
          && rowMatchesIngredient(candidate, ingredientArtifactId, getArtifact, recipe)
        );
        if (!row) break;
        ingredients.push(row);
        ingredientRowIds.add(row.id);
      }

      if (ingredients.length !== recipe.ingredientArtifactIds.length) break;

      for (const row of ingredients) usedRowIds.add(row.id);
      matches.push({
        recipeId: recipe.id,
        resultArtifactId: recipe.resultArtifactId,
        ingredientRowIds: ingredients.map((row) => row.id),
        ingredientArtifactIds: ingredients.map((row) => row.artifactId),
        ingredients: ingredients.map((row) => ({
          id: row.id,
          artifactId: row.artifactId,
          x: Number(row.x ?? -1),
          y: Number(row.y ?? -1),
          width: Number(row.width ?? 1),
          height: Number(row.height ?? 1)
        }))
      });
    }
  }

  return matches;
}

export function fusionIngredientRowIdSet(matches) {
  const ids = new Set();
  for (const match of matches || []) {
    for (const rowId of match.ingredientRowIds || []) ids.add(rowId);
  }
  return ids;
}
