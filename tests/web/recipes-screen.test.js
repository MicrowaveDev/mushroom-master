import assert from 'node:assert/strict';
import test from 'node:test';
import { RecipesScreen } from '../../web/src/pages/RecipesScreen.js';

function viewModel(extra = {}) {
  const vm = { ...extra };
  for (const [key, getter] of Object.entries(RecipesScreen.computed)) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  return vm;
}

test('recipes screen delegates generic catalog page shell to core', () => {
  assert.equal(RecipesScreen.components.CoreRecipesScreen.name, 'RecipesScreen');
  assert.equal(RecipesScreen.components.ArtifactCatalogBrowser.name, 'ArtifactCatalogBrowser');
  assert.match(RecipesScreen.template, /core-recipes-screen/);
  assert.match(RecipesScreen.template, /#catalog/);
  assert.match(RecipesScreen.template, /artifact-catalog-browser/);

  const vm = viewModel({
    t: {
      recipes: 'Recipes',
      recipesTitle: 'Recipe catalog',
      recipesIntro: 'Browse combinations'
    }
  });

  assert.deepEqual(vm.labels, {
    eyebrow: 'Recipes',
    title: 'Recipe catalog',
    intro: 'Browse combinations'
  });
});
