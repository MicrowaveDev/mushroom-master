import { findArtifactFusionMatches } from '../../shared/artifact-fusions.js';
import { getArtifactById } from '../game-data.js';
import {
  deleteLoadoutItem,
  insertLoadoutItem,
  nextSortOrder,
  readCurrentRoundItems
} from './game-run-loadout.js';

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

    applied.push({
      recipeId: match.recipeId,
      resultArtifactId: match.resultArtifactId,
      resultRowId,
      ingredientRowIds: match.ingredientRowIds,
      ingredientArtifactIds: match.ingredientArtifactIds,
      ingredients: match.ingredients
    });
  }

  return applied;
}
