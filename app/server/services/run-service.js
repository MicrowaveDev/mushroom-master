import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import {
  BAG_BASE_CHANCE,
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  bags,
  CHALLENGE_WINNER_BONUS,
  combatArtifacts,
  DAILY_BATTLE_LIMIT,
  getArtifactById,
  getArtifactPrice,
  getCompletionBonus,
  getShopRefreshCost,
  GHOST_BOT_MAX_AGE_DAYS,
  GHOST_BUDGET_DISCOUNT,
  GHOST_SNAPSHOT_MAX_COUNT,
  getStarterPreset,
  MAX_ROUNDS_PER_RUN,
  mushrooms,
  RATING_FLOOR,
  ROUND_INCOME,
  runRewardTable,
  SHOP_OFFER_SIZE,
  STARTING_LIVES
} from '../game-data.js';
import {
  computeLevel,
  createId,
  createRng,
  dayKey,
  expectedScore,
  kFactor,
  nowIso,
  parseJson
} from '../lib/utils.js';
import { shuffleWithRng, simulateBattle } from './battle-engine.js';
import {
  getActiveSnapshot,
  getDailyUsage,
  recordBattle
} from './battle-service.js';
import { isBag } from './artifact-helpers.js';
import { withRunLock } from './ready-manager.js';
import { createBotGhostSnapshot, createBotLoadout } from './bot-loadout.js';
import {
  applyRunPlacements,
  copyRoundForward,
  deleteLoadoutItemByIdScoped,
  deleteOneByArtifactId,
  insertLoadoutItem,
  insertRefund,
  nextSortOrder,
  readCurrentRoundItems
} from './game-run-loadout.js';

// In test environments, set REWARD_MULTIPLIER=N to scale spore+mycelium rewards
// so unlocks can be reached after a handful of rounds instead of hundreds.
// Defaults to 1 (no scaling) and is ignored in production.
function rewardMultiplier() {
  if (process.env.NODE_ENV === 'production') return 1;
  const n = parseInt(process.env.REWARD_MULTIPLIER ?? '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function generateShopOffer(rng, count = SHOP_OFFER_SIZE, roundsSinceBag = 1) {
  const combatPool = [...combatArtifacts];
  const bagPool = [...bags];
  const offer = [];
  let hasBag = false;
  const perSlotChance = BAG_BASE_CHANCE + roundsSinceBag * BAG_ESCALATION_STEP;

  for (let i = 0; i < count; i++) {
    const forceBag = !hasBag && roundsSinceBag >= BAG_PITY_THRESHOLD && i === count - 1;
    const isBagSlot = forceBag || (bagPool.length > 0 && rng() < perSlotChance);

    if (isBagSlot && bagPool.length > 0) {
      const idx = Math.floor(rng() * bagPool.length);
      offer.push(bagPool[idx].id);
      bagPool.splice(idx, 1);
      hasBag = true;
    } else if (combatPool.length > 0) {
      const idx = Math.floor(rng() * combatPool.length);
      offer.push(combatPool[idx].id);
      combatPool.splice(idx, 1);
    }
  }

  return { offer, hasBag };
}

// getShopState / saveShopState (legacy player_shop_state blob) deleted
// 2026-04-13. Game-run shop state lives in game_run_shop_states.

export async function startGameRun(playerId, mode = 'solo') {
  if (mode !== 'solo') {
    throw new Error('Invalid mode — use /challenge for challenge runs');
  }
  return withTransaction(async (client) => {
    const existingRun = await client.query(
      `SELECT id FROM game_run_players WHERE player_id = $1 AND is_active = 1`,
      [playerId]
    );
    if (existingRun.rowCount) {
      throw new Error('You already have an active game run');
    }

    const usage = await getDailyUsage(client, playerId);
    if (usage >= DAILY_BATTLE_LIMIT) {
      throw new Error('Daily battle limit reached');
    }

    const runId = createId('run');
    const now = nowIso();
    const initialCoins = ROUND_INCOME[0];

    await client.query(
      `INSERT INTO game_runs (id, mode, status, current_round, started_at)
       VALUES ($1, $2, 'active', 1, $3)`,
      [runId, mode, now]
    );

    const runPlayerId = createId('grp');
    await client.query(
      `INSERT INTO game_run_players (id, game_run_id, player_id, is_active, completed_rounds, wins, losses, lives_remaining, coins)
       VALUES ($1, $2, $3, 1, 0, 0, 0, $4, $5)`,
      [runPlayerId, runId, playerId, STARTING_LIVES, initialCoins]
    );

    const rng = createRng(`${runId}:shop:1`);
    const initialRoundsSinceBag = 1;
    const { offer: shopOffer, hasBag } = generateShopOffer(rng, SHOP_OFFER_SIZE, initialRoundsSinceBag);
    await client.query(
      `INSERT INTO game_run_shop_states (id, game_run_id, player_id, round_number, refresh_count, rounds_since_bag, offer_json, updated_at)
       VALUES ($1, $2, $3, 1, 0, $4, $5, $6)`,
      [createId('shopstate'), runId, playerId, hasBag ? 0 : initialRoundsSinceBag, JSON.stringify(shopOffer), now]
    );

    const currentDay = dayKey(new Date());
    await client.query(
      `INSERT INTO daily_rate_limits (player_id, day_key, battle_starts)
       VALUES ($1, $2, 1)
       ON CONFLICT (player_id, day_key)
       DO UPDATE SET battle_starts = daily_rate_limits.battle_starts + 1`,
      [playerId, currentDay]
    );

    // Seed the character's signature starter preset (two 1x1 lore-tied items
    // at (0,0) and (1,0)). These are free — they're not bought from the shop
    // and don't deduct coins — but they count toward ghost budget scaling in
    // resolveRound() because playerSpent uses getArtifactPrice().
    const activeMushroomResult = await client.query(
      `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
      [playerId]
    );
    const activeMushroomId = activeMushroomResult.rowCount
      ? activeMushroomResult.rows[0].mushroom_id
      : null;
    let activePresetId = 'default';
    if (activeMushroomId) {
      const presetResult = await client.query(
        `SELECT active_preset FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
        [playerId, activeMushroomId]
      );
      if (presetResult.rowCount) activePresetId = presetResult.rows[0].active_preset || 'default';
    }
    const starterItems = activeMushroomId ? getStarterPreset(activeMushroomId, activePresetId) : [];
    for (const item of starterItems) {
      await insertLoadoutItem(client, {
        gameRunId: runId,
        playerId,
        roundNumber: 1,
        artifactId: item.artifactId,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        bagId: null,
        sortOrder: item.sortOrder,
        purchasedRound: 1,
        freshPurchase: false
      });
    }

    return {
      id: runId,
      mode,
      status: 'active',
      currentRound: 1,
      startedAt: now,
      endedAt: null,
      endReason: null,
      shopOffer,
      starterItems,
      player: {
        id: runPlayerId,
        playerId,
        completedRounds: 0,
        wins: 0,
        losses: 0,
        livesRemaining: STARTING_LIVES,
        coins: initialCoins
      }
    };
  });
}

export async function getActiveGameRun(playerId) {
  const result = await query(
    `SELECT gr.id, gr.mode, gr.status, gr.current_round, gr.started_at, gr.ended_at, gr.end_reason,
            grp.id AS grp_id, grp.completed_rounds, grp.wins, grp.losses, grp.lives_remaining, grp.coins
     FROM game_run_players grp
     JOIN game_runs gr ON gr.id = grp.game_run_id
     WHERE grp.player_id = $1 AND grp.is_active = 1`,
    [playerId]
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0];
  const currentRound = row.current_round;
  const [roundsResult, shopResult, loadoutRows] = await Promise.all([
    query(
      `SELECT id, round_number, battle_id, created_at FROM game_rounds WHERE game_run_id = $1 ORDER BY round_number ASC`,
      [row.id]
    ),
    query(
      `SELECT offer_json FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3`,
      [row.id, playerId, currentRound]
    ),
    readCurrentRoundItems(null, row.id, playerId, currentRound)
  ]);

  const shopOffer = shopResult.rowCount ? parseJson(shopResult.rows[0].offer_json, []) : [];

  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    currentRound,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    shopOffer,
    loadoutItems: loadoutRows,
    player: {
      id: row.grp_id,
      playerId,
      completedRounds: row.completed_rounds,
      wins: row.wins,
      losses: row.losses,
      livesRemaining: row.lives_remaining,
      coins: row.coins
    },
    rounds: roundsResult.rows.map((r) => ({
      id: r.id,
      roundNumber: r.round_number,
      battleId: r.battle_id,
      createdAt: r.created_at
    }))
  };
}

async function payCompletionBonus(client, playerId, mushroomId, wins) {
  const bonus = getCompletionBonus(wins);
  if (bonus.spore > 0) {
    await client.query(
      `UPDATE players SET spore = spore + $2, updated_at = $3 WHERE id = $1`,
      [playerId, bonus.spore, nowIso()]
    );
  }
  if (bonus.mycelium > 0 && mushroomId) {
    await client.query(
      `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
      [playerId, mushroomId, bonus.mycelium]
    );
  }
  return bonus;
}

async function applyBatchElo(client, playerId, opponentRating, wins, losses) {
  if (wins + losses === 0) return null;
  const playerResult = await client.query('SELECT rating, rated_battle_count FROM players WHERE id = $1', [playerId]);
  if (!playerResult.rowCount) return null;
  const player = playerResult.rows[0];
  const actualScore = wins / (wins + losses);
  const k = kFactor(player.rating, player.rated_battle_count);
  const ratingAfter = Math.max(RATING_FLOOR, Math.round(
    player.rating + k * (actualScore - expectedScore(player.rating, opponentRating))
  ));
  await client.query(
    `UPDATE players SET rating = $2, rated_battle_count = rated_battle_count + 1, updated_at = $3 WHERE id = $1`,
    [playerId, ratingAfter, nowIso()]
  );
  return { ratingBefore: player.rating, ratingAfter };
}

export async function abandonGameRun(playerId, gameRunId) {
  return withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT * FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const run = runResult.rows[0];

    const allPlayersResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1`,
      [gameRunId]
    );
    const callerRow = allPlayersResult.rows.find((r) => r.player_id === playerId);
    if (!callerRow || !callerRow.is_active) {
      throw new Error('Player is not part of this game run');
    }

    for (const grp of allPlayersResult.rows) {
      if (!grp.is_active) continue;

      const activeChar = await client.query(
        `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
        [grp.player_id]
      );
      const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : null;
      await payCompletionBonus(client, grp.player_id, mushroomId, grp.wins);

      if (run.mode === 'challenge' && grp.wins + grp.losses > 0) {
        const opponent = allPlayersResult.rows.find((r) => r.player_id !== grp.player_id);
        const opponentRating = opponent
          ? ((await client.query('SELECT rating FROM players WHERE id = $1', [opponent.player_id])).rows[0]?.rating ?? 1000)
          : 1000;
        await applyBatchElo(client, grp.player_id, opponentRating, grp.wins, grp.losses);
      }
    }

    const now = nowIso();
    await client.query(
      `UPDATE game_runs SET status = 'abandoned', ended_at = $2, end_reason = 'abandoned' WHERE id = $1`,
      [gameRunId, now]
    );

    await client.query(
      `UPDATE game_run_players SET is_active = 0 WHERE game_run_id = $1`,
      [gameRunId]
    );

    return {
      id: gameRunId,
      mode: run.mode,
      status: 'abandoned',
      currentRound: run.current_round,
      startedAt: run.started_at,
      endedAt: now,
      endReason: 'abandoned',
      player: {
        id: callerRow.id,
        playerId,
        completedRounds: callerRow.completed_rounds,
        wins: callerRow.wins,
        losses: callerRow.losses,
        livesRemaining: callerRow.lives_remaining,
        coins: callerRow.coins
      }
    };
  });
}

export async function getGameRun(gameRunId, viewerPlayerId) {
  const runResult = await query(`SELECT * FROM game_runs WHERE id = $1`, [gameRunId]);
  if (!runResult.rowCount) {
    throw new Error('Game run not found');
  }
  const run = runResult.rows[0];

  const playersResult = await query(
    `SELECT * FROM game_run_players WHERE game_run_id = $1`,
    [gameRunId]
  );

  const viewerPlayer = playersResult.rows.find((r) => r.player_id === viewerPlayerId);
  if (!viewerPlayer) {
    throw new Error('You are not part of this game run');
  }

  const roundsResult = await query(
    `SELECT id, round_number, battle_id, created_at FROM game_rounds WHERE game_run_id = $1 ORDER BY round_number ASC`,
    [gameRunId]
  );

  const shopResult = await query(
    `SELECT offer_json FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3`,
    [gameRunId, viewerPlayerId, run.current_round]
  );
  const shopOffer = shopResult.rowCount ? parseJson(shopResult.rows[0].offer_json, []) : [];

  return {
    id: run.id,
    mode: run.mode,
    status: run.status,
    currentRound: run.current_round,
    startedAt: run.started_at,
    endedAt: run.ended_at,
    endReason: run.end_reason,
    shopOffer,
    players: playersResult.rows.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      completedRounds: r.completed_rounds,
      wins: r.wins,
      losses: r.losses,
      livesRemaining: r.lives_remaining,
      coins: r.coins
    })),
    rounds: roundsResult.rows.map((r) => ({
      id: r.id,
      roundNumber: r.round_number,
      battleId: r.battle_id,
      createdAt: r.created_at
    }))
  };
}

async function getRunGhostSnapshot(client, playerId, gameRunId, roundNumber, ghostBudget) {
  // Find player's active mushroom — opponents must use a different one
  const playerMushroomResult = await client.query(
    `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
    [playerId]
  );
  const playerMushroomId = playerMushroomResult.rowCount ? playerMushroomResult.rows[0].mushroom_id : null;

  // Round-robin opponent mushroom from the pool excluding the player's own mushroom.
  // Shuffle once per run, then cycle by round number — each opponent mushroom is
  // seen before any repeats.
  const opponentMushroomIds = mushrooms.map((m) => m.id).filter((id) => id !== playerMushroomId);
  const shuffleRng = createRng(`${gameRunId}:ghost-order`);
  const order = shuffleWithRng(opponentMushroomIds, shuffleRng);
  const targetMushroomId = order[(roundNumber - 1) % order.length];

  // Unified ghost path (§2.4): real player rows and synthetic bot rows both
  // live in game_run_loadout_items. Query 1 tries to find a real player who
  // completed this round number with the target mushroom. If none, fall back
  // to the bot path which inserts deterministic rows under a synthetic run id.

  // Build the exclusion set: the current player, and any opponent they've
  // already faced in this run.
  const facedResult = await client.query(
    `SELECT DISTINCT opponent_player_id FROM game_rounds
     WHERE game_run_id = $1 AND opponent_player_id IS NOT NULL`,
    [gameRunId]
  );
  const excludedPlayerIds = [...new Set(facedResult.rows.map((r) => r.opponent_player_id))];
  excludedPlayerIds.push(playerId);

  // Query 1 — find a real player game_run with a round-N loadout for the
  // target mushroom. We need to join through game_run_players + player_active_character
  // to match mushroom, since game_run_loadout_items itself doesn't carry mushroom.
  const excludePlaceholders = excludedPlayerIds.map((_, i) => `$${i + 4}`).join(', ');
  const realResult = await client.query(
    `SELECT DISTINCT grli.game_run_id, grli.player_id
     FROM game_run_loadout_items grli
     JOIN player_active_character pac ON pac.player_id = grli.player_id
     WHERE grli.round_number = $1
       AND grli.game_run_id != $2
       AND pac.mushroom_id = $3
       AND grli.player_id NOT IN (${excludePlaceholders})
       AND grli.game_run_id NOT LIKE 'ghost:bot:%'
     ORDER BY RANDOM()
     LIMIT 1`,
    [roundNumber, gameRunId, targetMushroomId, ...excludedPlayerIds]
  );

  if (realResult.rowCount) {
    const { game_run_id: ghostRunId, player_id: ghostPlayerId } = realResult.rows[0];
    const items = await readCurrentRoundItems(client, ghostRunId, ghostPlayerId, roundNumber);
    if (items.length > 0) {
      return {
        playerId: ghostPlayerId,
        mushroomId: targetMushroomId,
        loadout: {
          gridWidth: 3,
          gridHeight: 2,
          items
        }
      };
    }
  }

  // Query 2 — bot fallback. Generate a deterministic loadout and write it
  // into game_run_loadout_items under a synthetic run id. The seed is
  // (mushroom, budget, gameRunId, roundNumber) so repeated calls in the same
  // context produce the same rows (idempotent).
  const botBudget = Math.max(3, ghostBudget);
  const syntheticRunId = `ghost:bot:${targetMushroomId}:${botBudget}:${gameRunId}:${roundNumber}`;
  const syntheticPlayerId = 'bot';

  // Check for an existing synthetic row set before regenerating.
  const existing = await readCurrentRoundItems(client, syntheticRunId, syntheticPlayerId, roundNumber);
  if (existing.length > 0) {
    return {
      playerId: null,
      mushroomId: targetMushroomId,
      loadout: { gridWidth: 3, gridHeight: 2, items: existing }
    };
  }

  const targetMushroom = mushrooms.find((m) => m.id === targetMushroomId);
  let botLoadout;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const rng = createRng(`${syntheticRunId}:attempt:${attempt}`);
      botLoadout = createBotLoadout(targetMushroom, rng, botBudget);
      break;
    } catch {
      continue;
    }
  }
  if (!botLoadout) {
    // Final fallback — createBotGhostSnapshot has its own retry loop.
    return createBotGhostSnapshot(`${syntheticRunId}:fallback`, targetMushroomId, botBudget);
  }

  for (const [index, item] of botLoadout.items.entries()) {
    await insertLoadoutItem(client, {
      gameRunId: syntheticRunId,
      playerId: syntheticPlayerId,
      roundNumber,
      artifactId: item.artifactId,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      bagId: null,
      sortOrder: index,
      purchasedRound: roundNumber,
      freshPurchase: false
    });
  }

  const inserted = await readCurrentRoundItems(client, syntheticRunId, syntheticPlayerId, roundNumber);
  return {
    playerId: null,
    mushroomId: targetMushroomId,
    loadout: { gridWidth: 3, gridHeight: 2, items: inserted }
  };
}

async function resolveChallengeRound(client, run, gameRunId) {
  const roundNumber = run.current_round;

  const grpResult = await client.query(
    `SELECT * FROM game_run_players WHERE game_run_id = $1 AND is_active = 1 ORDER BY id ASC`,
    [gameRunId]
  );
  if (grpResult.rowCount !== 2) {
    throw new Error('Challenge run requires exactly 2 active players');
  }
  const [grpA, grpB] = grpResult.rows;

  const snapshotA = await getActiveSnapshot(client, grpA.player_id);
  const snapshotB = await getActiveSnapshot(client, grpB.player_id);

  const battleSeed = crypto.randomBytes(16).toString('hex');
  const simulation = simulateBattle({ left: snapshotA, right: snapshotB }, battleSeed);

  if (!simulation.winnerSide) {
    simulation.winnerSide = Math.random() < 0.5 ? 'left' : 'right';
    simulation.outcome = simulation.winnerSide === 'left' ? 'win' : 'loss';
  }

  const battle = await recordBattle(client, {
    leftSnapshot: snapshotA, rightSnapshot: snapshotB, simulation, battleSeed,
    mode: 'run_challenge',
    opponentKind: 'player',
    ratedScope: 'none',
    challengeId: null,
    initiatorPlayerId: grpA.player_id
  });

  const outcomeA = simulation.winnerSide === 'left' ? 'win' : 'loss';
  const outcomeB = simulation.winnerSide === 'right' ? 'win' : 'loss';

  const playerResults = {};

  for (const [grp, snapshot, outcome, opponentId] of [
    [grpA, snapshotA, outcomeA, grpB.player_id],
    [grpB, snapshotB, outcomeB, grpA.player_id]
  ]) {
    const rewards = runRewardTable[outcome];
    const mult = rewardMultiplier();
    const sporeAwarded = rewards.spore * mult;
    const myceliumAwarded = rewards.mycelium * mult;
    const roundIncome = roundNumber < MAX_ROUNDS_PER_RUN ? ROUND_INCOME[roundNumber] : 0;

    await client.query(
      `INSERT INTO game_rounds (id, game_run_id, round_number, battle_id, player_id, outcome, opponent_player_id, spore_awarded, mycelium_awarded, rating_before, rating_after, coins_income, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL, $10, $11)`,
      [
        createId('ground'), gameRunId, roundNumber, battle.id, grp.player_id,
        outcome, opponentId, sporeAwarded, myceliumAwarded, roundIncome, nowIso()
      ]
    );

    const newLives = outcome === 'loss' ? grp.lives_remaining - 1 : grp.lives_remaining;
    const newWins = outcome === 'win' ? grp.wins + 1 : grp.wins;
    const newLosses = outcome === 'loss' ? grp.losses + 1 : grp.losses;
    const completedRounds = grp.completed_rounds + 1;
    const newCoins = grp.coins + roundIncome;

    await client.query(
      `UPDATE game_run_players SET completed_rounds = $2, wins = $3, losses = $4, lives_remaining = $5, coins = $6 WHERE id = $1`,
      [grp.id, completedRounds, newWins, newLosses, newLives, newCoins]
    );

    await client.query(
      `UPDATE players SET spore = spore + $2, updated_at = $3 WHERE id = $1`,
      [grp.player_id, sporeAwarded, nowIso()]
    );

    const activeChar = await client.query(
      `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`, [grp.player_id]
    );
    const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : snapshot.mushroomId;

    await client.query(
      `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
      [grp.player_id, mushroomId, myceliumAwarded]
    );

    playerResults[grp.player_id] = {
      completedRounds,
      wins: newWins,
      losses: newLosses,
      livesRemaining: newLives,
      coins: newCoins,
      mushroomId,
      lastRound: {
        roundNumber,
        battleId: battle.id,
        outcome,
        rewards
      }
    };
  }

  const anyEliminated = Object.values(playerResults).some((p) => p.livesRemaining <= 0);
  const maxRounds = Object.values(playerResults).every((p) => p.completedRounds >= MAX_ROUNDS_PER_RUN);
  const runEnded = anyEliminated || maxRounds;
  let endReason = null;

  if (runEnded) {
    endReason = anyEliminated ? 'max_losses' : 'max_rounds';

    const pA = playerResults[grpA.player_id];
    const pB = playerResults[grpB.player_id];
    const winnerPlayerId = pA.losses < pB.losses ? grpA.player_id : pB.losses < pA.losses ? grpB.player_id : null;

    for (const [grp, pr] of [[grpA, pA], [grpB, pB]]) {
      await payCompletionBonus(client, grp.player_id, pr.mushroomId, pr.wins);

      const opponentGrp = grp === grpA ? grpB : grpA;
      const opponentRating = (await client.query('SELECT rating FROM players WHERE id = $1', [opponentGrp.player_id])).rows[0]?.rating ?? 1000;
      await applyBatchElo(client, grp.player_id, opponentRating, pr.wins, pr.losses);

      if (winnerPlayerId === grp.player_id) {
        await client.query(
          `UPDATE players SET spore = spore + $2, updated_at = $3 WHERE id = $1`,
          [grp.player_id, CHALLENGE_WINNER_BONUS.spore, nowIso()]
        );
        await client.query(
          `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
          [grp.player_id, pr.mushroomId, CHALLENGE_WINNER_BONUS.mycelium]
        );
      }
    }

    await client.query(
      `UPDATE game_runs SET status = 'completed', ended_at = $2, end_reason = $3 WHERE id = $1`,
      [gameRunId, nowIso(), endReason]
    );
    await client.query(
      `UPDATE game_run_players SET is_active = 0 WHERE game_run_id = $1`,
      [gameRunId]
    );
  } else {
    await client.query(
      `UPDATE game_runs SET current_round = current_round + 1 WHERE id = $1`,
      [gameRunId]
    );
    const nextRound = roundNumber + 1;
    for (const grp of [grpA, grpB]) {
      // Copy round N loadout → round N+1 per player (§2.3 copy-forward).
      await copyRoundForward(client, gameRunId, grp.player_id, roundNumber, nextRound);

      // Insert a new shop state row for round N+1 (§2.8).
      const prevShopState = await client.query(
        `SELECT rounds_since_bag FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3`,
        [gameRunId, grp.player_id, roundNumber]
      );
      const prevRoundsSinceBag = prevShopState.rowCount ? prevShopState.rows[0].rounds_since_bag : 1;
      const newRoundsSinceBag = prevRoundsSinceBag + 1;
      const shopRng = createRng(`${gameRunId}:shop:${nextRound}:${grp.player_id}`);
      const { offer: newOffer, hasBag } = generateShopOffer(shopRng, SHOP_OFFER_SIZE, newRoundsSinceBag);
      await client.query(
        `INSERT INTO game_run_shop_states (id, game_run_id, player_id, round_number, refresh_count, rounds_since_bag, offer_json, updated_at)
         VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
        [createId('shopstate'), gameRunId, grp.player_id, nextRound, hasBag ? 0 : newRoundsSinceBag, JSON.stringify(newOffer), nowIso()]
      );
    }
  }

  return {
    id: gameRunId,
    mode: 'challenge',
    status: runEnded ? 'completed' : 'active',
    currentRound: runEnded ? roundNumber : roundNumber + 1,
    endedAt: runEnded ? nowIso() : null,
    endReason,
    runEnded,
    completionBonus: runEnded
      ? Object.fromEntries(Object.entries(playerResults).map(([pid, pr]) => [pid, getCompletionBonus(pr.wins)]))
      : null,
    playerResults
  };
}

export async function resolveRound(playerId, gameRunId) {
  return withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT * FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const run = runResult.rows[0];

    if (run.mode === 'challenge') {
      return resolveChallengeRound(client, run, gameRunId);
    }

    const grpResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this game run');
    }
    const grp = grpResult.rows[0];

    if (grp.completed_rounds >= MAX_ROUNDS_PER_RUN) {
      throw new Error('All rounds completed');
    }
    if (grp.lives_remaining <= 0) {
      throw new Error('No lives remaining');
    }

    const roundNumber = run.current_round;

    const leftSnapshot = await getActiveSnapshot(client, playerId);
    // Ghost budget rules (see docs/balance.md for rationale):
    //   base     = player's actual spent coins × (1 - GHOST_BUDGET_DISCOUNT)
    //   cap      = cumulative round income up to this round (an upper bound)
    //   grace    = multiplier for early rounds (round 1: 0.7, round 2: 0.85, 3+: 1.0)
    //   floor    = 3 coins (always enough for one cheap item)
    const playerSpent = leftSnapshot.loadout.items.reduce((sum, item) => {
      const artifact = getArtifactById(item.artifactId);
      return sum + (artifact ? getArtifactPrice(artifact) : 0);
    }, 0);
    const cumulativeIncome = ROUND_INCOME
      .slice(0, Math.max(1, roundNumber))
      .reduce((s, c) => s + c, 0);
    const graceFactor = roundNumber === 1 ? 0.7 : roundNumber === 2 ? 0.85 : 1.0;
    const base = Math.min(playerSpent, cumulativeIncome) * (1 - GHOST_BUDGET_DISCOUNT);
    const ghostBudget = Math.max(3, Math.floor(base * graceFactor));
    const rightSnapshot = await getRunGhostSnapshot(client, playerId, gameRunId, roundNumber, ghostBudget);

    const battleSeed = crypto.randomBytes(16).toString('hex');
    const simulation = simulateBattle({ left: leftSnapshot, right: rightSnapshot }, battleSeed);

    if (!simulation.winnerSide) {
      simulation.winnerSide = Math.random() < 0.5 ? 'left' : 'right';
      simulation.outcome = simulation.winnerSide === 'left' ? 'win' : 'loss';
    }

    const outcome = simulation.winnerSide === 'left' ? 'win' : 'loss';

    const battle = await recordBattle(client, {
      leftSnapshot, rightSnapshot, simulation, battleSeed,
      mode: 'run_solo',
      opponentKind: rightSnapshot.playerId ? 'ghost_snapshot' : 'ghost_bot',
      ratedScope: 'one_sided',
      challengeId: null,
      initiatorPlayerId: playerId
    });

    const rewards = runRewardTable[outcome];
    const mult = rewardMultiplier();
    const sporeAwarded = rewards.spore * mult;
    const myceliumAwarded = rewards.mycelium * mult;
    const playerResult = await client.query('SELECT rating, rated_battle_count FROM players WHERE id = $1', [playerId]);
    const player = playerResult.rows[0];
    const opponentRating = rightSnapshot.playerId
      ? ((await client.query('SELECT rating FROM players WHERE id = $1', [rightSnapshot.playerId])).rows[0]?.rating ?? player.rating)
      : player.rating;

    const actualScore = outcome === 'win' ? 1 : 0;
    const k = kFactor(player.rating, player.rated_battle_count, 'solo_run');
    const ratingAfter = Math.max(RATING_FLOOR, Math.round(
      player.rating + k * (actualScore - expectedScore(player.rating, opponentRating))
    ));

    const roundIncome = roundNumber < MAX_ROUNDS_PER_RUN ? ROUND_INCOME[roundNumber] : 0;
    await client.query(
      `INSERT INTO game_rounds (id, game_run_id, round_number, battle_id, player_id, outcome, opponent_player_id, spore_awarded, mycelium_awarded, rating_before, rating_after, coins_income, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        createId('ground'), gameRunId, roundNumber, battle.id, playerId,
        outcome, rightSnapshot.playerId || null,
        sporeAwarded, myceliumAwarded,
        player.rating, ratingAfter, roundIncome, nowIso()
      ]
    );

    const newLives = outcome === 'loss' ? grp.lives_remaining - 1 : grp.lives_remaining;
    const newWins = outcome === 'win' ? grp.wins + 1 : grp.wins;
    const newLosses = outcome === 'loss' ? grp.losses + 1 : grp.losses;
    const completedRounds = grp.completed_rounds + 1;
    const newCoins = grp.coins + roundIncome;

    await client.query(
      `UPDATE game_run_players SET completed_rounds = $2, wins = $3, losses = $4, lives_remaining = $5, coins = $6 WHERE id = $1`,
      [grp.id, completedRounds, newWins, newLosses, newLives, newCoins]
    );

    await client.query(
      `UPDATE players SET spore = spore + $2, rating = $3, rated_battle_count = rated_battle_count + 1, updated_at = $4 WHERE id = $1`,
      [playerId, sporeAwarded, ratingAfter, nowIso()]
    );

    const activeChar = await client.query(
      `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`, [playerId]
    );
    const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : leftSnapshot.mushroomId;

    const mushroomRow = await client.query(
      `SELECT mycelium FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
      [playerId, mushroomId]
    );
    const myceliumBefore = mushroomRow.rowCount ? mushroomRow.rows[0].mycelium : 0;

    await client.query(
      `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
      [playerId, mushroomId, myceliumAwarded]
    );

    const levelBefore = computeLevel(myceliumBefore).level;
    const levelAfter = computeLevel(myceliumBefore + myceliumAwarded).level;

    // Ghost snapshots are no longer written to a separate table (§2.4).
    // The round-N loadout rows in game_run_loadout_items ARE the snapshot —
    // future runs query them directly via getRunGhostSnapshot.

    let runEnded = false;
    let endReason = null;

    if (newLives <= 0) {
      runEnded = true;
      endReason = 'max_losses';
    } else if (completedRounds >= MAX_ROUNDS_PER_RUN) {
      runEnded = true;
      endReason = 'max_rounds';
    }

    if (runEnded) {
      await payCompletionBonus(client, playerId, mushroomId, newWins);
      await client.query(
        `UPDATE game_runs SET status = 'completed', ended_at = $2, end_reason = $3 WHERE id = $1`,
        [gameRunId, nowIso(), endReason]
      );
      await client.query(
        `UPDATE game_run_players SET is_active = 0 WHERE game_run_id = $1`,
        [gameRunId]
      );
    } else {
      await client.query(
        `UPDATE game_runs SET current_round = current_round + 1 WHERE id = $1`,
        [gameRunId]
      );
      const nextRound = roundNumber + 1;

      // Copy round N loadout → round N+1 (§2.3 copy-forward).
      await copyRoundForward(client, gameRunId, playerId, roundNumber, nextRound);

      // Insert a NEW shop state row for round N+1 (§2.8 round-scoped shop state).
      // The old row for round N stays as frozen history.
      const prevShopState = await client.query(
        `SELECT rounds_since_bag FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3`,
        [gameRunId, playerId, roundNumber]
      );
      const prevRoundsSinceBag = prevShopState.rowCount ? prevShopState.rows[0].rounds_since_bag : 1;
      const newRoundsSinceBag = prevRoundsSinceBag + 1;
      const shopRng = createRng(`${gameRunId}:shop:${nextRound}`);
      const { offer: newOffer, hasBag } = generateShopOffer(shopRng, SHOP_OFFER_SIZE, newRoundsSinceBag);
      await client.query(
        `INSERT INTO game_run_shop_states (id, game_run_id, player_id, round_number, refresh_count, rounds_since_bag, offer_json, updated_at)
         VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
        [createId('shopstate'), gameRunId, playerId, nextRound, hasBag ? 0 : newRoundsSinceBag, JSON.stringify(newOffer), nowIso()]
      );
    }

    return {
      id: gameRunId,
      mode: run.mode,
      status: runEnded ? 'completed' : 'active',
      currentRound: runEnded ? roundNumber : roundNumber + 1,
      endedAt: runEnded ? nowIso() : null,
      endReason,
      completionBonus: runEnded ? getCompletionBonus(newWins) : null,
      player: {
        completedRounds,
        wins: newWins,
        losses: newLosses,
        livesRemaining: newLives,
        coins: newCoins
      },
      lastRound: {
        roundNumber,
        battleId: battle.id,
        outcome,
        rewards,
        ratingBefore: player.rating,
        ratingAfter,
        levelBefore,
        levelAfter
      }
    };
  });
}

/**
 * Service entrypoint for `PUT /api/artifact-loadout`. Deliberately thin:
 * its only job is to enforce the run-membership guard and hand off to the
 * pure reconciler (`applyRunPlacements`). Every save this endpoint handles
 * is a full-state sync of the current round's builder/container/active-bags
 * state — see the contract on `applyRunPlacements` and the invariants
 * pinned by `tests/game/bridge-pin.test.js`.
 *
 * DO NOT ADD LOGIC HERE. No coin math, no shop mutations, no cross-table
 * side effects. If you need a new mutation surface, write a dedicated
 * endpoint (see `buyRunShopItem` / `sellRunItem` / `refreshRunShop` for
 * the shape). Growing this function re-creates the multi-source
 * reconciliation problem the loadout refactor solved (loadout-refactor-plan.md §1.2).
 *
 * The legacy `/place`/`/unplace`/`/activate-bag` granular-endpoint plan in
 * docs/post-review-followups.md Batch C1 is indefinitely deferred. Full-
 * state sync is fine at this app size, and the row-id threading in
 * docs/client-row-id-refactor.md made it duplicate-safe. Treat this
 * endpoint shape as the permanent contract, not a transitional one.
 */
export async function applyRunLoadoutPlacements(playerId, gameRunId, items) {
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

    await applyRunPlacements(client, gameRunId, playerId, currentRound, items);
    return { ok: true };
  }));
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

    // Insert into the new run-scoped table. Container coords (-1,-1) until placed.
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
      bagId: null,
      sortOrder,
      purchasedRound: currentRound,
      freshPurchase: true
    });

    // id: the newly-inserted loadout row id. The client stores this on its
    // container slot so follow-up actions (place, sell, drag) can target
    // the specific row even when duplicates exist. See docs/client-row-id-refactor.md.
    return { id: newRowId, coins: newCoins, artifactId, price, shopOffer: newOffer };
  }));
}

export async function refreshRunShop(playerId, gameRunId) {
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
    const { offer: newOffer, hasBag } = generateShopOffer(rng, SHOP_OFFER_SIZE, currentRoundsSinceBag);

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
 * artifact list. Used by Playwright tests to eliminate RNG/pity/refresh
 * polling loops that race cold Vite compilation. Does NOT charge coins and
 * does NOT increment refresh_count — the shop appears "as if" it was rolled
 * this way from the start.
 *
 * Gated by `NODE_ENV !== 'production'` at the route layer.
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
 *
 * Accepts either a direct row id or a bare artifactId. When both are
 * supplied, the row id wins (it disambiguates duplicates). Callers should
 * prefer passing `id` whenever they know it — hitting this by artifactId
 * only works because the server picks "the most recently added matching
 * row" via sort_order, which is correct for the UI's last-click pattern
 * but brittle if the client state drifts. See docs/client-row-id-refactor.md.
 *
 * The `target` argument accepts the legacy string form (artifactId) so
 * existing tests and the few callers that still pass a bare string keep
 * working. New code should pass an object `{ id, artifactId }`.
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

    // Resolve the candidate row: prefer id (disambiguates duplicates),
    // fall back to artifactId for legacy callers.
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
      const contentsCount = currentRows.filter((r) => r.bagId === resolvedArtifactId).length;
      if (contentsCount > 0) {
        throw new Error('Cannot sell a bag that contains items — empty it first');
      }
    }

    const price = getArtifactPrice(artifact);
    // Graduated refund: fresh this round = full price, otherwise half.
    // purchased_round is preserved across round copy-forward (§2.2).
    // [Req 4-K]: half-price refund is rounded down with a MINIMUM of 1 coin
    // — selling a 1-coin artifact in a later round must still return 1, not 0.
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

export async function createChallengeRun(challengerPlayerId, inviteePlayerId, challengeId) {
  return withTransaction(async (client) => {
    const inviteeUsage = await getDailyUsage(client, inviteePlayerId);
    if (inviteeUsage >= DAILY_BATTLE_LIMIT) {
      throw new Error('The invited player has reached their daily battle limit');
    }

    const runId = createId('run');
    const now = nowIso();
    const initialCoins = ROUND_INCOME[0];

    await client.query(
      `INSERT INTO game_runs (id, mode, status, current_round, started_at)
       VALUES ($1, 'challenge', 'active', 1, $2)`,
      [runId, now]
    );

    const players = [challengerPlayerId, inviteePlayerId];
    const playerResults = {};

    for (const pid of players) {
      const grpId = createId('grp');
      await client.query(
        `INSERT INTO game_run_players (id, game_run_id, player_id, is_active, completed_rounds, wins, losses, lives_remaining, coins)
         VALUES ($1, $2, $3, 1, 0, 0, 0, $4, $5)`,
        [grpId, runId, pid, STARTING_LIVES, initialCoins]
      );

      const rng = createRng(`${runId}:shop:1:${pid}`);
      const { offer: shopOffer, hasBag } = generateShopOffer(rng, SHOP_OFFER_SIZE, 1);
      await client.query(
        `INSERT INTO game_run_shop_states (id, game_run_id, player_id, round_number, refresh_count, rounds_since_bag, offer_json, updated_at)
         VALUES ($1, $2, $3, 1, 0, $4, $5, $6)`,
        [createId('shopstate'), runId, pid, hasBag ? 0 : 1, JSON.stringify(shopOffer), now]
      );

      // Seed the character signature starter preset for this player. Same
      // contract as startGameRun above — two lore-tied 1x1 items at (0,0)
      // and (1,0), free, excluded from shop and ghost pools.
      const activeCharResult = await client.query(
        `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
        [pid]
      );
      const activeMushroomId = activeCharResult.rowCount
        ? activeCharResult.rows[0].mushroom_id
        : null;
      let activePresetId = 'default';
      if (activeMushroomId) {
        const presetResult = await client.query(
          `SELECT active_preset FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
          [pid, activeMushroomId]
        );
        if (presetResult.rowCount) activePresetId = presetResult.rows[0].active_preset || 'default';
      }
      const starterItems = activeMushroomId ? getStarterPreset(activeMushroomId, activePresetId) : [];
      for (const item of starterItems) {
        await insertLoadoutItem(client, {
          gameRunId: runId,
          playerId: pid,
          roundNumber: 1,
          artifactId: item.artifactId,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          bagId: null,
          sortOrder: item.sortOrder,
          purchasedRound: 1,
          freshPurchase: false
        });
      }

      const currentDay = dayKey(new Date());
      await client.query(
        `INSERT INTO daily_rate_limits (player_id, day_key, battle_starts)
         VALUES ($1, $2, 1)
         ON CONFLICT (player_id, day_key)
         DO UPDATE SET battle_starts = daily_rate_limits.battle_starts + 1`,
        [pid, currentDay]
      );

      playerResults[pid] = { id: grpId, playerId: pid, coins: initialCoins, shopOffer };
    }

    await client.query(
      `UPDATE friend_challenges SET status = 'accepted', accepted_at = $2, game_run_id = $3 WHERE id = $1`,
      [challengeId, now, runId]
    );

    return {
      id: runId,
      mode: 'challenge',
      status: 'active',
      currentRound: 1,
      startedAt: now,
      players: playerResults
    };
  });
}

/**
 * Prune ghost snapshot rows to keep the table bounded.
 *
 * Two strategies:
 * 1. **Synthetic bot rows** (`ghost:bot:*`): deleted after `botMaxAgeDays`.
 *    These are deterministic and cheap to regenerate.
 * 2. **Real-player snapshot rows**: kept at a minimum pool size. When the total
 *    count exceeds `maxSnapshots`, the oldest rows beyond that limit are deleted.
 *    This preserves the ghost pool while preventing unbounded growth.
 */
export async function pruneOldGhostSnapshots(
  botMaxAgeDays = GHOST_BOT_MAX_AGE_DAYS,
  maxSnapshots = GHOST_SNAPSHOT_MAX_COUNT
) {
  // 1. Age-based prune for synthetic bot rows
  const botCutoff = new Date(Date.now() - botMaxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const botResult = await query(
    `DELETE FROM game_run_loadout_items
     WHERE game_run_id LIKE 'ghost:bot:%' AND created_at < $1`,
    [botCutoff]
  );

  // 2. Count-based prune for real-player snapshot rows.
  //    Find completed runs with snapshot rows, keep the newest `maxSnapshots`
  //    distinct (game_run_id, player_id, round_number) groups, delete the rest.
  //    Uses GROUP BY for SQLite/PostgreSQL compatibility (no DISTINCT ON).
  const cutoffResult = await query(
    `SELECT MAX(created_at) AS latest FROM game_run_loadout_items
     WHERE game_run_id NOT LIKE 'ghost:bot:%'
     GROUP BY game_run_id, player_id, round_number
     ORDER BY latest DESC
     LIMIT 1 OFFSET $1`,
    [maxSnapshots]
  );

  let prunedSnapshots = 0;
  if (cutoffResult.rowCount) {
    const snapshotCutoff = cutoffResult.rows[0].latest;
    const overflowResult = await query(
      `DELETE FROM game_run_loadout_items
       WHERE id IN (
         SELECT grli.id FROM game_run_loadout_items grli
         JOIN game_runs gr ON gr.id = grli.game_run_id
         WHERE gr.status != 'active'
           AND grli.game_run_id NOT LIKE 'ghost:bot:%'
           AND grli.created_at < $1
       )`,
      [snapshotCutoff]
    );
    prunedSnapshots = overflowResult.rowCount;
  }

  return {
    prunedBots: botResult.rowCount,
    prunedSnapshots
  };
}

export async function getGameRunHistory(playerId, limit = 20) {
  const result = await query(
    `SELECT gr.id, gr.mode, gr.status, gr.current_round, gr.started_at, gr.ended_at, gr.end_reason,
            grp.completed_rounds, grp.wins, grp.losses, grp.lives_remaining
     FROM game_run_players grp
     JOIN game_runs gr ON gr.id = grp.game_run_id
     WHERE grp.player_id = $1 AND gr.status != 'active'
     ORDER BY gr.ended_at DESC
     LIMIT $2`,
    [playerId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    status: row.status,
    currentRound: row.current_round,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    completedRounds: row.completed_rounds,
    wins: row.wins,
    losses: row.losses,
    livesRemaining: row.lives_remaining
  }));
}
