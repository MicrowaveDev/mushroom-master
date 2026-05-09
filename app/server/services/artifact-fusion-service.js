import { findArtifactFusionMatches } from '../../shared/artifact-fusions.js';
import { query } from '../db.js';
import { getArtifactById } from '../game-data.js';
import { createId, nowIso } from '../lib/utils.js';
import {
  deleteLoadoutItem,
  insertLoadoutItem,
  nextSortOrder,
  readCurrentRoundItems
} from './game-run-loadout.js';

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function shapeFusionReveal(row) {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    sourceRoundNumber: row.source_round_number,
    resultRoundNumber: row.result_round_number,
    resultArtifactId: row.result_artifact_id,
    resultRowId: row.result_row_id,
    ingredientArtifactIds: parseJson(row.ingredient_artifact_ids_json, []),
    ingredients: parseJson(row.ingredient_rows_json, [])
  };
}

async function recordFusionReveal(client, {
  gameRunId,
  playerId,
  sourceRoundNumber,
  resultRoundNumber,
  match,
  resultRowId
}) {
  const id = createId('grfusion');
  await client.query(
    `INSERT INTO game_run_fusions
       (id, game_run_id, player_id, source_round_number, result_round_number,
        recipe_id, result_artifact_id, result_row_id,
        ingredient_artifact_ids_json, ingredient_rows_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      gameRunId,
      playerId,
      sourceRoundNumber,
      resultRoundNumber,
      match.recipeId,
      match.resultArtifactId,
      resultRowId,
      JSON.stringify(match.ingredientArtifactIds),
      JSON.stringify(match.ingredients),
      nowIso()
    ]
  );
  return id;
}

export async function applyRoundStartFusions(client, gameRunId, playerId, roundNumber) {
  const rows = await readCurrentRoundItems(client, gameRunId, playerId, roundNumber);
  const matches = findArtifactFusionMatches(rows, getArtifactById);
  if (!matches.length) return [];

  let sortOrder = await nextSortOrder(client, gameRunId, playerId, roundNumber);
  const applied = [];

  for (const match of matches) {
    const resultArtifact = getArtifactById(match.resultArtifactId);
    if (!resultArtifact) continue;

    const ingredientRows = match.ingredientRowIds
      .map((rowId) => rows.find((row) => row.id === rowId))
      .filter(Boolean);
    if (ingredientRows.length !== match.ingredientRowIds.length) continue;

    for (const row of ingredientRows) {
      await deleteLoadoutItem(client, row.id);
    }

    const resultRowId = await insertLoadoutItem(client, {
      gameRunId,
      playerId,
      roundNumber,
      artifactId: resultArtifact.id,
      x: -1,
      y: -1,
      width: resultArtifact.width,
      height: resultArtifact.height,
      sortOrder,
      purchasedRound: roundNumber,
      freshPurchase: false
    });
    sortOrder += 1;

    const revealId = await recordFusionReveal(client, {
      gameRunId,
      playerId,
      sourceRoundNumber: roundNumber - 1,
      resultRoundNumber: roundNumber,
      match,
      resultRowId
    });

    applied.push({
      id: revealId,
      recipeId: match.recipeId,
      sourceRoundNumber: roundNumber - 1,
      resultRoundNumber: roundNumber,
      resultArtifactId: match.resultArtifactId,
      resultRowId,
      ingredientRowIds: match.ingredientRowIds,
      ingredientArtifactIds: match.ingredientArtifactIds,
      ingredients: match.ingredients
    });
  }

  return applied;
}

export async function readFusionReveals(client, gameRunId, playerId, resultRoundNumber) {
  const q = client?.query ? client.query.bind(client) : query;
  const result = await q(
    `SELECT id, recipe_id, source_round_number, result_round_number, result_artifact_id,
            result_row_id, ingredient_artifact_ids_json, ingredient_rows_json, created_at
     FROM game_run_fusions
     WHERE game_run_id = $1 AND player_id = $2 AND result_round_number = $3
     ORDER BY created_at ASC, id ASC`,
    [gameRunId, playerId, resultRoundNumber]
  );
  return result.rows.map(shapeFusionReveal);
}
