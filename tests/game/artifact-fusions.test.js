import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findArtifactFusionMatches,
  fusionIngredientRowIdSet
} from '../../app/shared/artifact-fusions.js';

const artifacts = new Map([
  ['sporeblade', { id: 'sporeblade', family: 'damage' }],
  ['mirrorloop_knot', { id: 'mirrorloop_knot', family: 'stun' }],
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
