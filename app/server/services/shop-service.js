import { query, withTransaction } from '../db.js';
import {
  BAG_BASE_CHANCE,
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  bags,
  combatArtifacts,
  getArtifactById,
  getArtifactPrice,
  getEligibleCharacterItems,
  getShopRefreshCost,
  SHOP_OFFER_SIZE
} from '../game-data.js';
import {
  computeLevel,
  createId,
  createRng,
  nowIso,
  parseJson
} from '../lib/utils.js';
import { isBag } from './artifact-helpers.js';
import { bagsContainingItem } from './loadout-utils.js';
import { withRunLock } from './ready-manager.js';
import {
  deleteLoadoutItemByIdScoped,
  deleteOneByArtifactId,
  insertLoadoutItem,
  insertRefund,
  nextSortOrder,
  readCurrentRoundItems
} from './game-run-loadout.js';

/**
 * Look up the eligible character shop items for a player in a run.
 * [Req 4-Q] Solo: based on active mushroom level.
 * [Req 4-S] Challenge: capped by min(viewerLevel, opponentLevel).
 */
export async function lookupEligibleCharacterItems(client, playerId, mode, gameRunId) {
  const activeResult = await client.query(
    `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
    [playerId]
  );
  const mushroomId = activeResult.rowCount ? activeResult.rows[0].mushroom_id : null;
  if (!mushroomId) return [];

  const myceliumResult = await client.query(
    `SELECT mycelium FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
    [playerId, mushroomId]
  );
  let level = myceliumResult.rowCount ? computeLevel(myceliumResult.rows[0].mycelium).level : 1;

  if (mode === 'challenge') {
    const oppResult = await client.query(
      `SELECT grp.player_id FROM game_run_players grp WHERE grp.game_run_id = $1 AND grp.player_id != $2`,
      [gameRunId, playerId]
    );
    if (oppResult.rowCount) {
      const oppPlayerId = oppResult.rows[0].player_id;
      const oppActiveResult = await client.query(
        `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
        [oppPlayerId]
      );
      const oppMushroomId = oppActiveResult.rowCount ? oppActiveResult.rows[0].mushroom_id : null;
      if (oppMushroomId) {
        const oppMyceliumResult = await client.query(
          `SELECT mycelium FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
          [oppPlayerId, oppMushroomId]
        );
        const oppLevel = oppMyceliumResult.rowCount ? computeLevel(oppMyceliumResult.rows[0].mycelium).level : 1;
        level = Math.min(level, oppLevel);
      }
    }
  }

  return getEligibleCharacterItems(mushroomId, level);
}

/**
 * Generate a shop offer with `count` items.
 * @param {Function} rng - Seeded random number generator
 * @param {number} count - Number of items in the offer (default: SHOP_OFFER_SIZE)
 * @param {number} roundsSinceBag - Rounds since a bag last appeared (for pity)
 * @param {Array} eligibleCharacterItems - [Req 4-R] eligible character shop items;
 *   when non-empty, one slot is reserved for a random character item
 */
export function generateShopOffer(rng, count = SHOP_OFFER_SIZE, roundsSinceBag = 1, eligibleCharacterItems = []) {
  const combatPool = [...combatArtifacts];
  const bagPool = [...bags];
  const charPool = [...eligibleCharacterItems];
  const offer = [];
  let hasBag = false;
  let hasCharacterItem = false;
  const perSlotChance = BAG_BASE_CHANCE + roundsSinceBag * BAG_ESCALATION_STEP;

  for (let i = 0; i < count; i++) {
    const forceBag = !hasBag && roundsSinceBag >= BAG_PITY_THRESHOLD && i === count - 1;
    const forceChar = !hasCharacterItem && charPool.length > 0 && i === count - 1 && !forceBag;
    const isBagSlot = forceBag || (bagPool.length > 0 && rng() < perSlotChance);

    if (forceChar) {
      const idx = Math.floor(rng() * charPool.length);
      offer.push(charPool[idx].id);
      charPool.splice(idx, 1);
      hasCharacterItem = true;
    } else if (isBagSlot && bagPool.length > 0) {
      const idx = Math.floor(rng() * bagPool.length);
      offer.push(bagPool[idx].id);
      bagPool.splice(idx, 1);
      hasBag = true;
    } else if (charPool.length > 0 && !hasCharacterItem && rng() < 0.3) {
      const idx = Math.floor(rng() * charPool.length);
      offer.push(charPool[idx].id);
      charPool.splice(idx, 1);
      hasCharacterItem = true;
    } else if (combatPool.length > 0) {
      const idx = Math.floor(rng() * combatPool.length);
      offer.push(combatPool[idx].id);
      combatPool.splice(idx, 1);
    }
  }

  return { offer, hasBag };
}

export async function buyRunShopItem(playerId, gameRunId, artifactId) {
  return withRunLock(gameRunId, () => withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT current_round FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const currentRound = runResult.rows[0].current_round;

    const grpResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this active game run');
    }
    const grp = grpResult.rows[0];

    const shopResult = await client.query(
      `SELECT offer_json FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3`,
      [gameRunId, playerId, currentRound]
    );
    if (!shopResult.rowCount) {
      throw new Error('Shop state not found');
    }
    const offer = parseJson(shopResult.rows[0].offer_json, []);

    if (!offer.includes(artifactId)) {
      throw new Error('Item is not in the current shop offer');
    }

    const artifact = getArtifactById(artifactId);
    if (!artifact) {
      throw new Error('Unknown artifact');
    }
    const price = getArtifactPrice(artifact);
    if (grp.coins < price) {
      throw new Error('Not enough coins');
    }

    const newCoins = grp.coins - price;
    await client.query(
      `UPDATE game_run_players SET coins = $2 WHERE id = $1`,
      [grp.id, newCoins]
    );

    const newOffer = [...offer];
    const idx = newOffer.indexOf(artifactId);
    if (idx !== -1) newOffer.splice(idx, 1);

    await client.query(
      `UPDATE game_run_shop_states SET offer_json = $2, updated_at = $3
       WHERE game_run_id = $1 AND player_id = $4 AND round_number = $5`,
      [gameRunId, JSON.stringify(newOffer), nowIso(), playerId, currentRound]
    );

    const sortOrder = await nextSortOrder(client, gameRunId, playerId, currentRound);
    const newRowId = await insertLoadoutItem(client, {
      gameRunId,
      playerId,
      roundNumber: currentRound,
      artifactId,
      x: -1,
      y: -1,
      width: artifact.width,
      height: artifact.height,
      sortOrder,
      purchasedRound: currentRound,
      freshPurchase: true
    });

    return { id: newRowId, coins: newCoins, artifactId, price, shopOffer: newOffer };
  }));
}

export async function refreshRunShop(playerId, gameRunId) {
  return withRunLock(gameRunId, () => withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT current_round, mode FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const currentRound = runResult.rows[0].current_round;
    const runMode = runResult.rows[0].mode;

    const grpResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this active game run');
    }
    const grp = grpResult.rows[0];

    const shopResult = await client.query(
      `SELECT * FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3`,
      [gameRunId, playerId, currentRound]
    );
    if (!shopResult.rowCount) {
      throw new Error('Shop state not found');
    }
    const shop = shopResult.rows[0];

    const cost = getShopRefreshCost(shop.refresh_count);
    if (grp.coins < cost) {
      throw new Error('Not enough coins to refresh shop');
    }

    const newCoins = grp.coins - cost;
    const currentRoundsSinceBag = shop.rounds_since_bag || 1;
    const rng = createRng(`${gameRunId}:refresh:${shop.round_number}:${shop.refresh_count + 1}`);
    const charItems = await lookupEligibleCharacterItems(client, playerId, runMode, gameRunId);
    const { offer: newOffer, hasBag } = generateShopOffer(rng, SHOP_OFFER_SIZE, currentRoundsSinceBag, charItems);

    await client.query(
      `UPDATE game_run_players SET coins = $2 WHERE id = $1`,
      [grp.id, newCoins]
    );
    await client.query(
      `UPDATE game_run_shop_states SET refresh_count = refresh_count + 1, rounds_since_bag = $2, offer_json = $3, updated_at = $4
       WHERE game_run_id = $1 AND player_id = $5 AND round_number = $6`,
      [gameRunId, hasBag ? 0 : currentRoundsSinceBag, JSON.stringify(newOffer), nowIso(), playerId, currentRound]
    );

    return {
      coins: newCoins,
      shopOffer: newOffer,
      refreshCount: shop.refresh_count + 1,
      refreshCost: cost
    };
  }));
}

/**
 * Test-only: overwrite the current round's shop offer with a deterministic
 * artifact list. Gated by `NODE_ENV !== 'production'` at the route layer.
 */
export async function forceRunShopForTest(playerId, gameRunId, artifactIds) {
  if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
    throw new Error('forceRunShopForTest requires a non-empty artifactIds array');
  }
  for (const id of artifactIds) {
    if (!getArtifactById(id)) {
      throw new Error(`Unknown artifactId in force-shop: ${id}`);
    }
  }
  return withRunLock(gameRunId, () => withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT current_round FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const currentRound = runResult.rows[0].current_round;

    const grpResult = await client.query(
      `SELECT id FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this active game run');
    }

    await client.query(
      `UPDATE game_run_shop_states SET offer_json = $1, updated_at = $2
       WHERE game_run_id = $3 AND player_id = $4 AND round_number = $5`,
      [JSON.stringify(artifactIds), nowIso(), gameRunId, playerId, currentRound]
    );

    return { shopOffer: artifactIds };
  }));
}

/**
 * Sell a loadout item from the current round.
 */
export async function sellRunItem(playerId, gameRunId, target) {
  const { id: targetRowId, artifactId: targetArtifactId } = typeof target === 'string'
    ? { id: null, artifactId: target }
    : { id: target?.id || null, artifactId: target?.artifactId || null };
  if (!targetRowId && !targetArtifactId) {
    throw new Error('sellRunItem requires a row id or artifactId');
  }
  return withRunLock(gameRunId, () => withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT current_round FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const currentRound = runResult.rows[0].current_round;

    const grpResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this active game run');
    }
    const grp = grpResult.rows[0];

    const currentRows = await readCurrentRoundItems(client, gameRunId, playerId, currentRound);

    let candidate;
    if (targetRowId) {
      candidate = currentRows.find((r) => r.id === targetRowId);
    } else {
      candidate = currentRows.find((r) => r.artifactId === targetArtifactId);
    }
    if (!candidate) {
      throw new Error('Item not found in loadout');
    }

    const resolvedArtifactId = candidate.artifactId;
    const artifact = getArtifactById(resolvedArtifactId);
    if (isBag(artifact)) {
      const contents = currentRows.filter((row) => {
        const rowArtifact = getArtifactById(row.artifactId);
        return !isBag(rowArtifact)
          && Number(row.x) >= 0
          && Number(row.y) >= 0
          && bagsContainingItem(row, [candidate]).length > 0;
      });
      if (contents.length > 0) {
        throw new Error('Cannot sell a bag that contains items — empty it first');
      }
    }

    const price = getArtifactPrice(artifact);
    const isFreshThisRound = candidate.purchasedRound === currentRound;
    const sellPrice = isFreshThisRound ? price : Math.max(1, Math.floor(price / 2));

    let deleted;
    if (targetRowId) {
      deleted = await deleteLoadoutItemByIdScoped(client, {
        rowId: targetRowId,
        gameRunId,
        playerId,
        roundNumber: currentRound
      });
    } else {
      deleted = await deleteOneByArtifactId(client, gameRunId, playerId, currentRound, resolvedArtifactId);
    }
    if (!deleted) {
      throw new Error('Item not found in loadout');
    }

    await insertRefund(client, {
      gameRunId,
      playerId,
      roundNumber: currentRound,
      artifactId: resolvedArtifactId,
      refundAmount: sellPrice
    });

    const newCoins = grp.coins + sellPrice;
    await client.query(
      `UPDATE game_run_players SET coins = $2 WHERE id = $1`,
      [grp.id, newCoins]
    );

    return { id: deleted.id, coins: newCoins, sellPrice, artifactId: resolvedArtifactId };
  }));
}
