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
  ['reliquary_bone_buckle', { id: 'reliquary_bone_buckle', family: 'armor' }],
  ['root_ash_censer', { id: 'root_ash_censer', family: 'stun' }],
  ['sour_vinegar_ampoule', { id: 'sour_vinegar_ampoule', family: 'damage' }],
  ['mirrorfloor_shard', { id: 'mirrorfloor_shard', family: 'armor' }],
  ['spore_burst_arrow', { id: 'spore_burst_arrow', family: 'damage' }],
  ['dead_city_nail', { id: 'dead_city_nail', family: 'damage' }],
  ['bubbling_grot_bomb', { id: 'bubbling_grot_bomb', family: 'damage' }],
  ['amber_resin_shield', { id: 'amber_resin_shield', family: 'armor' }],
  ['spore_lullaby_conch', { id: 'spore_lullaby_conch', family: 'stun' }],
  ['snaplight_husk', { id: 'snaplight_husk', family: 'damage' }],
  ['crystal_rift_chime', { id: 'crystal_rift_chime', family: 'stun' }],
  ['rainpuff_mine', { id: 'rainpuff_mine', family: 'stun' }],
  ['golden_garden_carapace', { id: 'golden_garden_carapace', family: 'armor' }],
  ['thornhide_scale', { id: 'thornhide_scale', family: 'armor' }],
  ['soft_wall_tile', { id: 'soft_wall_tile', family: 'armor' }],
  ['spore_snow_globe', { id: 'spore_snow_globe', family: 'stun' }],
  ['ginger_spark_bottle', { id: 'ginger_spark_bottle', family: 'stun' }],
  ['star_spore_sash', { id: 'star_spore_sash', family: 'armor' }],
  ['body_memory_splinter', { id: 'body_memory_splinter', family: 'stun' }],
  ['flashstep_tendon', { id: 'flashstep_tendon', family: 'damage' }],
  ['riftfang_comet', { id: 'riftfang_comet', family: 'damage', fusionOnly: true }],
  ['biostasis_crown_seed', { id: 'biostasis_crown_seed', family: 'stun', fusionOnly: true }],
  ['abyss_bow_knot', { id: 'abyss_bow_knot', family: 'stun', fusionOnly: true }],
  ['opening_bell_spore', { id: 'opening_bell_spore', family: 'stun', fusionOnly: true }],
  ['reliquary_ash_crown', { id: 'reliquary_ash_crown', family: 'stun', fusionOnly: true }],
  ['portal_vinegar_lens', { id: 'portal_vinegar_lens', family: 'damage', fusionOnly: true }],
  ['deadwind_arrow', { id: 'deadwind_arrow', family: 'damage', fusionOnly: true }],
  ['pressure_bloom_bulwark', { id: 'pressure_bloom_bulwark', family: 'armor', fusionOnly: true }],
  ['snap_lullaby_bell', { id: 'snap_lullaby_bell', family: 'stun', fusionOnly: true }],
  ['riftpuff_snare', { id: 'riftpuff_snare', family: 'stun', fusionOnly: true }],
  ['golden_thorn_aegis', { id: 'golden_thorn_aegis', family: 'armor', fusionOnly: true }],
  ['soft_ash_hourglass', { id: 'soft_ash_hourglass', family: 'stun', fusionOnly: true }],
  ['ginger_star_compass', { id: 'ginger_star_compass', family: 'stun', fusionOnly: true }],
  ['memory_flash_tendon', { id: 'memory_flash_tendon', family: 'damage', fusionOnly: true }],
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
    'opening_bell_spore',
    'reliquary_ash_crown',
    'portal_vinegar_lens',
    'deadwind_arrow',
    'pressure_bloom_bulwark',
    'snap_lullaby_bell',
    'riftpuff_snare',
    'golden_thorn_aegis',
    'soft_ash_hourglass',
    'ginger_star_compass',
    'memory_flash_tendon'
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

test('[fusion] finds the lore-border recipe wave from adjacent ingredients', () => {
  const matches = findArtifactFusionMatches([
    row('ash', 'root_ash_censer', 0, 0, 2, 1),
    row('buckle', 'reliquary_bone_buckle', 2, 0),
    row('vinegar', 'sour_vinegar_ampoule', 0, 1),
    row('mirror', 'mirrorfloor_shard', 1, 1),
    row('arrow', 'spore_burst_arrow', 0, 2, 2, 1),
    row('nail', 'dead_city_nail', 2, 2, 1, 2)
  ], getArtifact);

  assert.deepEqual(matches.map((match) => match.resultArtifactId), [
    'reliquary_ash_crown',
    'portal_vinegar_lens',
    'deadwind_arrow'
  ]);
  assert.deepEqual(matches.map((match) => match.ingredientRowIds), [
    ['ash', 'buckle'],
    ['vinegar', 'mirror'],
    ['arrow', 'nail']
  ]);
});

test('[fusion] finds the garden, ash, star, and memory recipe wave', () => {
  const matches = findArtifactFusionMatches([
    row('garden', 'golden_garden_carapace', 0, 0, 2, 2),
    row('thorn', 'thornhide_scale', 2, 0),
    row('wall', 'soft_wall_tile', 0, 3, 2, 1),
    row('snow', 'spore_snow_globe', 2, 3),
    row('ginger', 'ginger_spark_bottle', 0, 5, 1, 2),
    row('sash', 'star_spore_sash', 1, 5, 2, 1),
    row('memory', 'body_memory_splinter', 0, 8),
    row('tendon', 'flashstep_tendon', 1, 8, 1, 2)
  ], getArtifact);

  assert.deepEqual(matches.map((match) => match.resultArtifactId), [
    'golden_thorn_aegis',
    'soft_ash_hourglass',
    'ginger_star_compass',
    'memory_flash_tendon'
  ]);
  assert.deepEqual(matches.map((match) => match.ingredientRowIds), [
    ['garden', 'thorn'],
    ['wall', 'snow'],
    ['ginger', 'sash'],
    ['memory', 'tendon']
  ]);
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
