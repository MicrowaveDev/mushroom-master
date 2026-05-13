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

function canUseFusionIngredient(row, getArtifact, recipe) {
  if (!row?.id || !row.artifactId) return false;
  const artifact = getArtifact(row.artifactId);
  if (!artifact) return false;
  if (artifact.family === 'bag') return false;
  if (artifact.starterOnly) return false;
  if (artifact.fusionOnly && !recipe.allowFusionIngredients) return false;
  if (!isPlacedFusionRow(row)) return false;
  return true;
}

function rowMatchesIngredient(row, ingredientArtifactId, getArtifact, recipe) {
  return row.artifactId === ingredientArtifactId
    && canUseFusionIngredient(row, getArtifact, recipe);
}

function normalizeRowPlacement(row) {
  return {
    x: Number(row.x ?? -1),
    y: Number(row.y ?? -1),
    width: Math.max(1, Number(row.width ?? 1)),
    height: Math.max(1, Number(row.height ?? 1))
  };
}

function isPlacedFusionRow(row) {
  const placement = normalizeRowPlacement(row);
  return Number.isFinite(placement.x)
    && Number.isFinite(placement.y)
    && Number.isFinite(placement.width)
    && Number.isFinite(placement.height)
    && placement.x >= 0
    && placement.y >= 0;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function rowsTouchBySide(a, b) {
  const left = normalizeRowPlacement(a);
  const right = normalizeRowPlacement(b);
  const leftRight = left.x + left.width;
  const rightRight = right.x + right.width;
  const leftBottom = left.y + left.height;
  const rightBottom = right.y + right.height;

  const horizontalTouch = (leftRight === right.x || rightRight === left.x)
    && intervalsOverlap(left.y, leftBottom, right.y, rightBottom);
  const verticalTouch = (leftBottom === right.y || rightBottom === left.y)
    && intervalsOverlap(left.x, leftRight, right.x, rightRight);
  return horizontalTouch || verticalTouch;
}

function ingredientRowsAreConnected(rows) {
  if (rows.length <= 1) return true;

  const visited = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const current = queue.shift();
    for (let idx = 0; idx < rows.length; idx += 1) {
      if (visited.has(idx)) continue;
      if (!rowsTouchBySide(rows[current], rows[idx])) continue;
      visited.add(idx);
      queue.push(idx);
    }
  }

  return visited.size === rows.length;
}

function findIngredientCombination(sourceRows, recipe, getArtifact, usedRowIds) {
  const ingredients = recipe.ingredientArtifactIds;

  function search(index, selected, selectedIds) {
    if (index >= ingredients.length) {
      return ingredientRowsAreConnected(selected) ? selected : null;
    }

    const ingredientArtifactId = ingredients[index];
    for (const candidate of sourceRows) {
      if (usedRowIds.has(candidate.id) || selectedIds.has(candidate.id)) continue;
      if (!rowMatchesIngredient(candidate, ingredientArtifactId, getArtifact, recipe)) continue;

      const nextSelected = [...selected, candidate];
      const nextIds = new Set(selectedIds);
      nextIds.add(candidate.id);
      const match = search(index + 1, nextSelected, nextIds);
      if (match) return match;
    }

    return null;
  }

  return search(0, [], new Set());
}

export function findArtifactFusionMatches(rows, getArtifact, recipes = artifactFusionRecipes) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const usedRowIds = new Set();
  const matches = [];

  for (const recipe of recipes) {
    if (!recipe?.resultArtifactId || !Array.isArray(recipe.ingredientArtifactIds)) continue;

    while (true) {
      const ingredients = findIngredientCombination(sourceRows, recipe, getArtifact, usedRowIds);
      if (!ingredients) break;

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
