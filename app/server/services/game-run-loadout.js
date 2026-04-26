// Helpers for game_run_loadout_items — the run-scoped, round-scoped loadout table
// introduced by the loadout refactor (see docs/loadout-refactor-plan.md §2.2).
//
// Every row is keyed by (game_run_id, player_id, round_number). Round N rows
// are frozen history once round N+1 starts (copy-forward model, §2.3).
//
// Functions are pure DB helpers — they accept a `client` (transaction handle
// or top-level) so callers can compose them inside a withTransaction block.

import { query } from '../db.js';
import { BAG_COLUMNS } from '../game-data.js';
import { getArtifactById } from '../game-data.js';
import { createId, nowIso } from '../lib/utils.js';
import { getEffectiveShape } from '../../shared/bag-shape.js';
import { pieceCells, validateBagPlacement, validateGridItems, validateItemCoverage } from './loadout-utils.js';
import { isBag } from './artifact-helpers.js';

async function q(client, sql, params) {
  return client ? client.query(sql, params) : query(sql, params);
}

function shapeSize(artifact, rotated) {
  const shape = getEffectiveShape(artifact, rotated);
  return {
    shape,
    cols: shape.length ? shape[0].length : 0,
    rows: shape.length
  };
}

function setsOverlap(a, b) {
  for (const key of a) {
    if (b.has(key)) return true;
  }
  return false;
}

function assignMissingBagAnchors(items) {
  const placed = [];
  const bagRows = items.filter((item) => isBag(getArtifactById(item.artifactId)) && item.active);
  for (const bag of bagRows) {
    const artifact = getArtifactById(bag.artifactId);
    const { shape, cols, rows } = shapeSize(artifact, !!bag.rotated);
    if (Number(bag.x) >= 0 && Number(bag.y) >= 0) {
      placed.push(new Set(pieceCells({ ...bag, width: cols, height: rows }, shape)));
      continue;
    }
    let chosen = null;
    const maxY = Math.max(0, ...items
      .filter((item) => isBag(getArtifactById(item.artifactId)) && item.active && Number(item.y) >= 0)
      .map((item) => {
        const itemArtifact = getArtifactById(item.artifactId);
        const size = shapeSize(itemArtifact, !!item.rotated);
        return Number(item.y) + size.rows;
      })) + rows;
    outer: for (let y = 0; y <= maxY; y += 1) {
      for (let x = 0; x + cols <= BAG_COLUMNS; x += 1) {
        const candidate = new Set(pieceCells({ ...bag, x, y, width: cols, height: rows }, shape));
        if (placed.some((cells) => setsOverlap(candidate, cells))) continue;
        chosen = { x, y, cells: candidate };
        break outer;
      }
    }
    if (!chosen) {
      chosen = {
        x: 0,
        y: maxY,
        cells: new Set(pieceCells({ ...bag, x: 0, y: maxY, width: cols, height: rows }, shape))
      };
    }
    bag.x = chosen.x;
    bag.y = chosen.y;
    placed.push(chosen.cells);
  }
}

/**
 * Insert a starter or freshly purchased item row.
 * @param {object} client - transaction client or null
 * @param {object} params - { gameRunId, playerId, roundNumber, artifact, x, y,
 *                           sortOrder, purchasedRound, freshPurchase, active }
 * @returns {string} the new row id
 */
export async function insertLoadoutItem(client, params) {
  const id = createId('grlitem');
  const artifact = getArtifactById(params.artifactId) || params.artifact;
  const width = params.width ?? artifact.width;
  const height = params.height ?? artifact.height;
  const bagRow = isBag(artifact);
  const active = bagRow && params.active ? 1 : 0;
  const rotated = bagRow && params.rotated ? 1 : 0;
  const x = bagRow && !active ? -1 : (params.x ?? -1);
  const y = bagRow && !active ? -1 : (params.y ?? -1);
  await q(client,
    `INSERT INTO game_run_loadout_items
       (id, game_run_id, player_id, round_number, artifact_id, x, y, width, height,
        sort_order, purchased_round, fresh_purchase, active, rotated, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      params.gameRunId,
      params.playerId,
      params.roundNumber,
      artifact?.id || params.artifactId,
      x,
      y,
      width,
      height,
      params.sortOrder ?? 0,
      params.purchasedRound ?? params.roundNumber,
      params.freshPurchase ? 1 : 0,
      active,
      rotated,
      nowIso()
    ]
  );
  return id;
}

/**
 * Read all current-round rows for (gameRunId, playerId).
 */
export async function readCurrentRoundItems(client, gameRunId, playerId, roundNumber) {
  const res = await q(client,
    `SELECT id, artifact_id, x, y, width, height, sort_order,
            purchased_round, fresh_purchase, active, rotated
     FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3
     ORDER BY sort_order ASC`,
    [gameRunId, playerId, roundNumber]
  );
  return res.rows.map((r) => ({
    id: r.id,
    artifactId: r.artifact_id,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    sortOrder: r.sort_order,
    purchasedRound: r.purchased_round,
    freshPurchase: !!r.fresh_purchase,
    active: !!r.active,
    rotated: !!r.rotated
  }));
}

/**
 * Copy round N rows to round N+1 (identical data; reset fresh_purchase=0).
 * purchased_round is preserved so graduated refunds can see original buy round.
 *
 */
export async function copyRoundForward(client, gameRunId, playerId, fromRound, toRound) {
  const current = await readCurrentRoundItems(client, gameRunId, playerId, fromRound);
  for (const item of current) {
    await insertLoadoutItem(client, {
      gameRunId,
      playerId,
      roundNumber: toRound,
      artifactId: item.artifactId,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      sortOrder: item.sortOrder,
      purchasedRound: item.purchasedRound,
      freshPurchase: false,
      active: item.active,
      rotated: item.rotated
    });
  }
  return current.length;
}

/**
 * Delete a single item row from the current round.
 */
export async function deleteLoadoutItem(client, itemId) {
  await q(client, `DELETE FROM game_run_loadout_items WHERE id = $1`, [itemId]);
}

/**
 * Fetch + delete a single row by its primary key, scoped to the
 * (gameRunId, playerId, roundNumber) the caller is allowed to mutate.
 * Returns the row's artifactId and purchased_round for the sell-refund
 * logic, or null if the id doesn't match an owned row in the current
 * round. See docs/client-row-id-refactor.md Phase 1.
 */
export async function deleteLoadoutItemByIdScoped(client, { rowId, gameRunId, playerId, roundNumber }) {
  const rows = await q(client,
    `SELECT id, artifact_id, purchased_round
     FROM game_run_loadout_items
     WHERE id = $1 AND game_run_id = $2 AND player_id = $3 AND round_number = $4`,
    [rowId, gameRunId, playerId, roundNumber]
  );
  if (!rows.rowCount) return null;
  const row = rows.rows[0];
  await deleteLoadoutItem(client, row.id);
  return {
    id: row.id,
    artifactId: row.artifact_id,
    purchasedRound: row.purchased_round
  };
}

/**
 * Delete all current-round rows matching an artifact_id (used when sell is
 * called by artifact_id rather than item_id — picks the most recently added
 * one for fair refund calculation).
 */
export async function deleteOneByArtifactId(client, gameRunId, playerId, roundNumber, artifactId) {
  const rows = await q(client,
    `SELECT id, purchased_round FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3 AND artifact_id = $4
     ORDER BY sort_order DESC
     LIMIT 1`,
    [gameRunId, playerId, roundNumber, artifactId]
  );
  if (!rows.rowCount) return null;
  const row = rows.rows[0];
  await deleteLoadoutItem(client, row.id);
  return { id: row.id, purchasedRound: row.purchased_round };
}

/**
 * Compute next sort_order for inserting a new item into a round.
 */
export async function nextSortOrder(client, gameRunId, playerId, roundNumber) {
  const res = await q(client,
    `SELECT MAX(sort_order) AS max_sort FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3`,
    [gameRunId, playerId, roundNumber]
  );
  return (res.rows[0]?.max_sort ?? -1) + 1;
}

/**
 * Insert a refund ledger row (used when an item is sold).
 */
export async function insertRefund(client, { gameRunId, playerId, roundNumber, artifactId, refundAmount }) {
  await q(client,
    `INSERT INTO game_run_refunds
       (id, game_run_id, player_id, round_number, artifact_id, refund_amount, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [createId('grr'), gameRunId, playerId, roundNumber, artifactId, refundAmount, nowIso()]
  );
}

/**
 * Apply a full-state placement batch to the current round's loadout rows.
 * This is the write half of `PUT /api/artifact-loadout` — the client
 * serializes its entire builder/container/active-bags state via
 * `buildLoadoutPayloadItems` and the server reconciles it against the
 * rows already in `game_run_loadout_items` for this round.
 *
 * Each payload entry carries a row `id` when the client knows it (every
 * hydrated item does; freshly-bought items might not yet). The id path
 * targets that exact row, which disambiguates duplicates cleanly — see
 * docs/client-row-id-refactor.md. Entries without an id fall back to
 * matching by artifactId in sort order, which is still correct when the
 * client state hasn't drifted.
 *
 * Bag `active` / `rotated` flags are preserved when omitted and updated
 * when present. Client-side `activateBag` / `deactivateBag` call
 * `persistRunLoadout` right after mutating state, so the round-trip closes
 * immediately.
 *
 * Callers should go through `applyRunLoadoutPlacements` in run-service.js,
 * which adds the run-membership guard. This helper is export-only for
 * testing and for the bridge in run-service.js that wraps it.
 */
export async function applyRunPlacements(client, gameRunId, playerId, roundNumber, items) {
  // Group new-table rows by artifact_id for duplicate-aware matching.
  const currentRows = await readCurrentRoundItems(client, gameRunId, playerId, roundNumber);
  const byArtifact = new Map();
  for (const row of currentRows) {
    if (!byArtifact.has(row.artifactId)) byArtifact.set(row.artifactId, []);
    byArtifact.get(row.artifactId).push(row);
  }

  // First pass: project the desired state in-memory by walking the client's
  // payload and matching it to existing rows. The client can lie about
  // width/height/coordinates; reject overlaps, out-of-bounds, dimension
  // mismatches, and uncovered cells BEFORE any DB write.
  const projectedById = new Map();
  for (const row of currentRows) {
    projectedById.set(row.id, { ...row });
  }
  const claimed = new Map();
  for (const [artifactId, bucket] of byArtifact.entries()) {
    claimed.set(artifactId, [...bucket]);
  }
  // Track which row ids were already consumed by an id-based match so the
  // sort-order fallback doesn't double-claim them for a later entry that
  // only carries an artifactId.
  const consumedRowIds = new Set();
  const updates = [];
  for (const entry of items) {
    let row = null;
    if (entry.id && projectedById.has(entry.id) && !consumedRowIds.has(entry.id)) {
      row = projectedById.get(entry.id);
      consumedRowIds.add(entry.id);
      // Remove this exact row from the artifact bucket so the fallback
      // path can't re-match it for a sibling entry that lacks an id.
      const bucket = claimed.get(row.artifactId);
      if (bucket) {
        const idx = bucket.findIndex((r) => r.id === entry.id);
        if (idx >= 0) bucket.splice(idx, 1);
      }
    } else {
      const bucket = claimed.get(entry.artifactId);
      if (!bucket || bucket.length === 0) continue;
      // Skip rows that were already consumed by an earlier id-based entry.
      let picked = null;
      while (bucket.length > 0) {
        const candidate = bucket.shift();
        if (!consumedRowIds.has(candidate.id)) {
          picked = candidate;
          consumedRowIds.add(candidate.id);
          break;
        }
      }
      if (!picked) continue;
      row = projectedById.get(picked.id);
    }
    const proposed = row;
    proposed.x = Number(entry.x ?? -1);
    proposed.y = Number(entry.y ?? -1);
    proposed.width = Number(entry.width ?? row.width);
    proposed.height = Number(entry.height ?? row.height);
    // Bag activation and rotation: missing fields preserve existing bag
    // state, explicit fields update it. Non-bag rows ignore both fields.
    const rowArtifact = getArtifactById(proposed.artifactId);
    const bagRow = isBag(rowArtifact);
    proposed.active = bagRow ? (entry.active == null ? row.active : (entry.active ? 1 : 0)) : 0;
    proposed.rotated = bagRow ? (entry.rotated == null ? row.rotated : (entry.rotated ? 1 : 0)) : 0;
    if (bagRow && !proposed.active) {
      proposed.x = -1;
      proposed.y = -1;
    }
    updates.push(proposed);
  }

  // Validate the full projected layout: bags provide cells, items occupy
  // absolute cells, and every placed item cell must be covered by a bag.
  const projected = Array.from(projectedById.values());
  assignMissingBagAnchors(projected);
  validateBagPlacement(projected);
  validateGridItems(projected);
  validateItemCoverage(projected);

  // Second pass: persist the validated updates.
  for (const proposed of updates) {
    await q(client,
      `UPDATE game_run_loadout_items
       SET x = $1, y = $2, width = $3, height = $4, active = $5, rotated = $6
       WHERE id = $7`,
      [
        proposed.x, proposed.y, proposed.width, proposed.height,
        proposed.active, proposed.rotated, proposed.id
      ]
    );
  }
}
