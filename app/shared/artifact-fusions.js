import { findFusionMatches } from '@microwavedev/backpack-game-core';

export const artifactFusionRecipes = [
  {
    id: 'portal_cut_sickle',
    resultArtifactId: 'portal_cut_sickle',
    ingredientArtifactIds: ['sporeblade', 'mirrorloop_knot']
  },
  {
    id: 'riftfang_comet',
    resultArtifactId: 'riftfang_comet',
    ingredientArtifactIds: ['amber_fang', 'haste_wisp']
  },
  {
    id: 'biostasis_crown_seed',
    resultArtifactId: 'biostasis_crown_seed',
    ingredientArtifactIds: ['reliquary_biostasis_seal', 'triple_knot_seed']
  },
  {
    id: 'abyss_bow_knot',
    resultArtifactId: 'abyss_bow_knot',
    ingredientArtifactIds: ['heartwood_splinter_bow', 'mirrorloop_knot']
  },
  {
    id: 'opening_bell_spore',
    resultArtifactId: 'opening_bell_spore',
    ingredientArtifactIds: ['afterimage_cap', 'first_bloom_cinder']
  },
  {
    id: 'reliquary_ash_crown',
    resultArtifactId: 'reliquary_ash_crown',
    ingredientArtifactIds: ['root_ash_censer', 'reliquary_bone_buckle']
  },
  {
    id: 'portal_vinegar_lens',
    resultArtifactId: 'portal_vinegar_lens',
    ingredientArtifactIds: ['sour_vinegar_ampoule', 'mirrorfloor_shard']
  },
  {
    id: 'deadwind_arrow',
    resultArtifactId: 'deadwind_arrow',
    ingredientArtifactIds: ['spore_burst_arrow', 'dead_city_nail']
  },
  {
    id: 'pressure_bloom_bulwark',
    resultArtifactId: 'pressure_bloom_bulwark',
    ingredientArtifactIds: ['bubbling_grot_bomb', 'amber_resin_shield']
  },
  {
    id: 'snap_lullaby_bell',
    resultArtifactId: 'snap_lullaby_bell',
    ingredientArtifactIds: ['spore_lullaby_conch', 'snaplight_husk']
  },
  {
    id: 'riftpuff_snare',
    resultArtifactId: 'riftpuff_snare',
    ingredientArtifactIds: ['crystal_rift_chime', 'rainpuff_mine']
  },
  {
    id: 'golden_thorn_aegis',
    resultArtifactId: 'golden_thorn_aegis',
    ingredientArtifactIds: ['golden_garden_carapace', 'thornhide_scale']
  },
  {
    id: 'soft_ash_hourglass',
    resultArtifactId: 'soft_ash_hourglass',
    ingredientArtifactIds: ['soft_wall_tile', 'spore_snow_globe']
  },
  {
    id: 'ginger_star_compass',
    resultArtifactId: 'ginger_star_compass',
    ingredientArtifactIds: ['ginger_spark_bottle', 'star_spore_sash']
  },
  {
    id: 'memory_flash_tendon',
    resultArtifactId: 'memory_flash_tendon',
    ingredientArtifactIds: ['body_memory_splinter', 'flashstep_tendon']
  },
  {
    id: 'porcelain_rotlight_lantern',
    resultArtifactId: 'porcelain_rotlight_lantern',
    ingredientArtifactIds: ['rotlight_lantern', 'porcelain_mold_mask']
  },
  {
    id: 'vinegar_gate_chakram',
    resultArtifactId: 'vinegar_gate_chakram',
    ingredientArtifactIds: ['blue_vinegar_chakram', 'rustbone_key']
  },
  {
    id: 'voidflash_pauldron',
    resultArtifactId: 'voidflash_pauldron',
    ingredientArtifactIds: ['voidglass_pauldron', 'flashcap_knee_guard']
  },
  {
    id: 'ramaria_throne_snare',
    resultArtifactId: 'ramaria_throne_snare',
    ingredientArtifactIds: ['ramaria_snare', 'obsidian_throne_chip']
  }
];

export function getArtifactFusionRecipe(recipeId) {
  return artifactFusionRecipes.find((recipe) => recipe.id === recipeId) || null;
}

function canUseMushroomFusionIngredient({ artifact, recipe }) {
  if (artifact.family === 'bag') return false;
  if (artifact.starterOnly) return false;
  if (artifact.fusionOnly && !recipe.allowFusionIngredients) return false;
  return true;
}

export function findArtifactFusionMatches(rows, getArtifact, recipes = artifactFusionRecipes) {
  return findFusionMatches(rows, getArtifact, recipes, {
    canUseIngredient: canUseMushroomFusionIngredient
  });
}

export { fusionIngredientRowIdSet } from '@microwavedev/backpack-game-core';
