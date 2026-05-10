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

function row(id, artifactId) {
  return { id, artifactId, x: -1, y: -1, width: 1, height: 1 };
}

test('[fusion] finds portal-cut sickle recipe from owned row ids', () => {
  const matches = findArtifactFusionMatches([
    row('a', 'sporeblade'),
    row('b', 'mirrorloop_knot')
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
    row('fang', 'amber_fang'),
    row('wisp', 'haste_wisp')
  ], getArtifact);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].recipeId, 'riftfang_comet');
  assert.equal(matches[0].resultArtifactId, 'riftfang_comet');
  assert.deepEqual(matches[0].ingredientRowIds, ['fang', 'wisp']);
});

test('[fusion] ignores bags, starter-only rows, and existing fusion results', () => {
  const matches = findArtifactFusionMatches([
    row('bag', 'starter_bag'),
    row('starter', 'starter_item'),
    row('fusion', 'portal_cut_sickle'),
    row('blade', 'sporeblade')
  ], getArtifact);

  assert.equal(matches.length, 0);
});

test('[fusion] consumes each duplicate row only once', () => {
  const matches = findArtifactFusionMatches([
    row('blade_one', 'sporeblade'),
    row('knot_one', 'mirrorloop_knot'),
    row('blade_two', 'sporeblade'),
    row('knot_two', 'mirrorloop_knot')
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
    row('only_blade', 'sporeblade')
  ], getArtifact, recipes).length, 0);

  const matches = findArtifactFusionMatches([
    row('blade_one', 'sporeblade'),
    row('blade_two', 'sporeblade')
  ], getArtifact, recipes);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].ingredientRowIds, ['blade_one', 'blade_two']);
});
