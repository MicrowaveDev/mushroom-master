// Helpers for game_run_loadout_items — the run-scoped, round-scoped loadout table
// introduced by the loadout refactor (see docs/loadout-refactor-plan.md §2.2).
//
// Every row is keyed by (game_run_id, player_id, round_number). Round N rows
// are frozen history once round N+1 starts (copy-forward model, §2.3).
//
// Functions are pure DB helpers — they accept a `client` (transaction handle
// or top-level) so callers can compose them inside a withTransaction block.

import { query } from '../db.js';
import { getArtifactById } from '../game-data.js';
import { createId, nowIso } from '../lib/utils.js';
import { validateGridItems, validateBagContents } from './loadout-utils.js';
import { isBag } from './artifact-helpers.js';

async function q(client, sql, params) {
  return client ? client.query(sql, params) : query(sql, params);
}

/**
 * Insert a starter or freshly purchased item row.
 * @param {object} client - transaction client or null
 * @param {object} params - { gameRunId, playerId, roundNumber, artifact, x, y,
 *                           sortOrder, purchasedRound, freshPurchase, bagId }
 * @returns {string} the new row id
 */
export async function insertLoadoutItem(client, params) {
  const id = createId('grlitem');
  const artifact = getArtifactById(params.artifactId) || params.artifact;
  const width = params.width ?? artifact.width;
  const height = params.height ?? artifact.height;
  // Bags live off the main grid (active-bags bar), so their storage coords
  // are always the container sentinel. Enforced at this single write point
  // so every caller — starter preset, buy, copy-forward — is correct by
  // construction. See bag-items.test.js "normalizes bag coords" regression.
  const bagRow = isBag(artifact);
  const x = bagRow ? -1 : (params.x ?? -1);
  const y = bagRow ? -1 : (params.y ?? -1);
  // Non-bag rows can never be active or rotated; the fields are
  // meaningless for them. Bag rows default to inactive (container) and
  // unrotated unless the caller says otherwise. See
  // docs/bag-active-persistence.md and docs/bag-rotated-persistence.md.
  const active = bagRow && params.active ? 1 : 0;
  const rotated = bagRow && params.rotated ? 1 : 0;
  await q(client,
    `INSERT INTO game_run_loadout_items
       (id, game_run_id, player_id, round_number, artifact_id, x, y, width, height,
        bag_id, sort_order, purchased_round, fresh_purchase, active, rotated, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
      params.bagId || null,
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
    `SELECT id, artifact_id, x, y, width, height, bag_id, sort_order,
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
    bagId: r.bag_id || null,
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
 * `bag_id` on bagged items points at a loadout row id (see
 * docs/bag-item-placement-persistence.md). Row ids are regenerated per
 * round, so copy-forward builds an old-id → new-id map in a first pass
 * over non-bagged rows (which include the bag rows themselves), then
 * uses that map to rewrite `bag_id` on bagged rows in a second pass.
 * A bagged row whose bag_id doesn't resolve in the map is corrupt; throw
 * loudly rather than carry the dangling reference forward.
 */
export async function copyRoundForward(client, gameRunId, playerId, fromRound, toRound) {
  const current = await readCurrentRoundItems(client, gameRunId, playerId, fromRound);
  const oldToNewId = new Map();
  const nonBagged = current.filter((item) => !item.bagId);
  const bagged = current.filter((item) => !!item.bagId);

  for (const item of nonBagged) {
    const newId = await insertLoadoutItem(client, {
      gameRunId,
      playerId,
      roundNumber: toRound,
      artifactId: item.artifactId,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      bagId: null,
      sortOrder: item.sortOrder,
      purchasedRound: item.purchasedRound,
      freshPurchase: false,
      // Bag activation and rotation persist across rounds — players
      // shouldn't have to re-activate or re-rotate every bag after every
      // battle. See bag-active-persistence.md / bag-rotated-persistence.md.
      active: item.active,
      rotated: item.rotated
    });
    oldToNewId.set(item.id, newId);
  }
  for (const item of bagged) {
    const remappedBagId = oldToNewId.get(item.bagId);
    if (!remappedBagId) {
      throw new Error(`copy-forward: bagged row ${item.id} references unknown bag ${item.bagId}`);
    }
    await insertLoadoutItem(client, {
      gameRunId,
      playerId,
      roundNumber: toRound,
      artifactId: item.artifactId,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      bagId: remappedBagId,
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
    `SELECT id, artifact_id, purchased_round, bag_id
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
    purchasedRound: row.purchased_round,
    bagId: row.bag_id || null
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
 * This is a full-state sync, not a delta: any bag entry that doesn't
 * explicitly carry `active: 1` lands as `active: 0`. Client-side
 * `activateBag` / `deactivateBag` call `persistRunLoadout` right after
 * mutating state, so the round-trip closes immediately.
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
  // width/height/bag_id; we must reject overlaps, out-of-bounds, dimension
  // mismatches, and orphaned bag references BEFORE any DB write.
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
    proposed.bagId = entry.bagId || null;
    // Bag activation and rotation: a PUT /artifact-loadout payload is a
    // full-state sync, not a delta. Missing `active` / `rotated` on a bag
    // entry means "off" — the client must opt in explicitly to keep a
    // bag's activation or rotation state set. Non-bag rows ignore both
    // fields (they stay 0 at the DB level).
    const rowArtifact = getArtifactById(proposed.artifactId);
    const bagRow = isBag(rowArtifact);
    proposed.active = bagRow && entry.active ? 1 : 0;
    proposed.rotated = bagRow && entry.rotated ? 1 : 0;
    updates.push(proposed);
  }

  // Validate the full projected layout. validateGridItems enforces canonical
  // dimensions (allowing 90° rotation), bounds, and overlap. validateBagContents
  // enforces bag references, no nested bags, and slot capacity.
  const projected = Array.from(projectedById.values());
  const gridItems = projected.filter((item) => !item.bagId);
  validateGridItems(gridItems);
  validateBagContents(projected);

  // Second pass: persist the validated updates.
  for (const proposed of updates) {
    await q(client,
      `UPDATE game_run_loadout_items
       SET x = $1, y = $2, width = $3, height = $4, bag_id = $5, active = $6, rotated = $7
       WHERE id = $8`,
      [
        proposed.x, proposed.y, proposed.width, proposed.height,
        proposed.bagId, proposed.active, proposed.rotated, proposed.id
      ]
    );
  }
}
