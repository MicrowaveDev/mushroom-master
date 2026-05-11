import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artifactFusionRecipes,
  findArtifactFusionMatches,
  fusionIngredientRowIdSet
} from '../../app/shared/artifact-fusions.js';

const artifacts = new Map([
  ['sporeblade', { id: 'sporeblade', family: 'damage' }],
  ['mirrorloop_knot', { id: 'mirrorloop_knot', family: 'stun' }],
  ['amber_fang', { id: 'amber_fang', family: 'damage' }],
  ['haste_wisp', { id: 'haste_wisp', family: 'damage' }],
  ['riftfang_comet', { id: 'riftfang_comet', family: 'damage', fusionOnly: true }],
  ['biostasis_crown_seed', { id: 'biostasis_crown_seed', family: 'stun', fusionOnly: true }],
  ['abyss_bow_knot', { id: 'abyss_bow_knot', family: 'stun', fusionOnly: true }],
  ['opening_bell_spore', { id: 'opening_bell_spore', family: 'stun', fusionOnly: true }],
  ['portal_cut_sickle', { id: 'portal_cut_sickle', family: 'damage', fusionOnly: true }],
  ['starter_bag', { id: 'starter_bag', family: 'bag', starterOnly: true }],
  ['starter_item', { id: 'starter_item', family: 'damage', starterOnly: true }]
]);

function getArtifact(id) {
  return artifacts.get(id) || null;
}

function row(id, artifactId, x = 0, y = 0, width = 1, height = 1) {
  return { id, artifactId, x, y, width, height };
}

test('[fusion] finds portal-cut sickle recipe from adjacent placed row ids', () => {
  const matches = findArtifactFusionMatches([
    row('a', 'sporeblade', 0, 0),
    row('b', 'mirrorloop_knot', 1, 0)
  ], getArtifact);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].recipeId, 'portal_cut_sickle');
  assert.equal(matches[0].resultArtifactId, 'portal_cut_sickle');
  assert.deepEqual(matches[0].ingredientRowIds, ['a', 'b']);
  assert.deepEqual([...fusionIngredientRowIdSet(matches)].sort(), ['a', 'b']);
});

test('[fusion] ships multiple deterministic recipe results', () => {
  assert.deepEqual(artifactFusionRecipes.map((recipe) => recipe.resultArtifactId), [
    'portal_cut_sickle',
    'riftfang_comet',
    'biostasis_crown_seed',
    'abyss_bow_knot',
    'opening_bell_spore'
  ]);

  const matches = findArtifactFusionMatches([
    row('fang', 'amber_fang', 0, 0),
    row('wisp', 'haste_wisp', 1, 0)
  ], getArtifact);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].recipeId, 'riftfang_comet');
  assert.equal(matches[0].resultArtifactId, 'riftfang_comet');
  assert.deepEqual(matches[0].ingredientRowIds, ['fang', 'wisp']);
});

test('[fusion] ignores bags, starter-only rows, and existing fusion results', () => {
  const matches = findArtifactFusionMatches([
    row('bag', 'starter_bag', 0, 0),
    row('starter', 'starter_item', 1, 0),
    row('fusion', 'portal_cut_sickle', 2, 0),
    row('blade', 'sporeblade', 3, 0)
  ], getArtifact);

  assert.equal(matches.length, 0);
});

test('[fusion] consumes each duplicate row only once', () => {
  const matches = findArtifactFusionMatches([
    row('blade_one', 'sporeblade', 0, 0),
    row('knot_one', 'mirrorloop_knot', 1, 0),
    row('blade_two', 'sporeblade', 0, 1),
    row('knot_two', 'mirrorloop_knot', 1, 1)
  ], getArtifact);

  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((match) => match.ingredientRowIds), [
    ['blade_one', 'knot_one'],
    ['blade_two', 'knot_two']
  ]);
});

test('[fusion] does not reuse one row for repeated same-artifact ingredients', () => {
  const recipes = [{
    id: 'double_sporeblade',
    resultArtifactId: 'portal_cut_sickle',
    ingredientArtifactIds: ['sporeblade', 'sporeblade']
  }];

  assert.equal(findArtifactFusionMatches([
    row('only_blade', 'sporeblade', 0, 0)
  ], getArtifact, recipes).length, 0);

  const matches = findArtifactFusionMatches([
    row('blade_one', 'sporeblade', 0, 0),
    row('blade_two', 'sporeblade', 1, 0)
  ], getArtifact, recipes);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].ingredientRowIds, ['blade_one', 'blade_two']);
});

test('[fusion] ignores backpack rows and non-adjacent grid rows', () => {
  assert.equal(findArtifactFusionMatches([
    row('blade', 'sporeblade', -1, -1),
    row('knot', 'mirrorloop_knot', 0, 0)
  ], getArtifact).length, 0);

  assert.equal(findArtifactFusionMatches([
    row('blade', 'sporeblade', 0, 0),
    row('knot', 'mirrorloop_knot', 2, 0)
  ], getArtifact).length, 0);

  assert.equal(findArtifactFusionMatches([
    row('blade', 'sporeblade', 0, 0),
    row('knot', 'mirrorloop_knot', 1, 1)
  ], getArtifact).length, 0);
});

test('[fusion] can skip a non-adjacent duplicate and use the adjacent copy', () => {
  const matches = findArtifactFusionMatches([
    row('far_blade', 'sporeblade', 0, 0),
    row('knot', 'mirrorloop_knot', 3, 0),
    row('near_blade', 'sporeblade', 2, 0)
  ], getArtifact);

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].ingredientRowIds, ['near_blade', 'knot']);
});
