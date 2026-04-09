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
  GHOST_BUDGET_DISCOUNT,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_ROUNDS_PER_RUN,
  RATING_FLOOR,
  ROUND_INCOME,
  runRewardTable,
  SHOP_OFFER_SIZE,
  STARTING_LIVES
} from '../game-data.js';
import {
  createId,
  createRng,
  dayKey,
  expectedScore,
  kFactor,
  nowIso,
  parseJson
} from '../lib/utils.js';
import { simulateBattle } from './battle-engine.js';
import {
  getActiveSnapshot,
  getDailyUsage,
  recordBattle
} from './battle-service.js';
import { createBotGhostSnapshot } from './bot-loadout.js';

function generateShopOffer(rng, count = SHOP_OFFER_SIZE, roundsSinceBag = 1) {
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

export async function getShopState(playerId) {
  const result = await query(
    `SELECT payload_json FROM player_shop_state WHERE player_id = $1`,
    [playerId]
  );
  if (!result.rowCount) return null;
  return parseJson(result.rows[0].payload_json);
}

export async function saveShopState(playerId, payload) {
  const json = JSON.stringify(payload);
  await query(
    `INSERT INTO player_shop_state (player_id, payload_json, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id) DO UPDATE
     SET payload_json = $2, updated_at = $3`,
    [playerId, json, nowIso()]
  );
}

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

    return {
      id: runId,
      mode,
      status: 'active',
      currentRound: 1,
      startedAt: now,
      endedAt: null,
      endReason: null,
      shopOffer,
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
  const [roundsResult, shopResult, loadoutItemsResult] = await Promise.all([
    query(
      `SELECT id, round_number, battle_id, created_at FROM game_rounds WHERE game_run_id = $1 ORDER BY round_number ASC`,
      [row.id]
    ),
    query(
      `SELECT offer_json FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
      [row.id, playerId]
    ),
    query(
      `SELECT items.artifact_id, items.x, items.y, items.width, items.height, items.purchased_round, items.bag_id
       FROM player_artifact_loadout_items items
       JOIN player_artifact_loadouts loadouts ON loadouts.id = items.loadout_id
       WHERE loadouts.player_id = $1 AND items.purchased_round IS NOT NULL
       ORDER BY items.sort_order ASC`,
      [playerId]
    )
  ]);

  const shopOffer = shopResult.rowCount ? parseJson(shopResult.rows[0].offer_json, []) : [];

  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    currentRound: row.current_round,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    shopOffer,
    loadoutItems: loadoutItemsResult.rows.map((r) => ({
      artifactId: r.artifact_id,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      purchasedRound: r.purchased_round,
      bagId: r.bag_id
    })),
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
    `SELECT offer_json FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
    [gameRunId, viewerPlayerId]
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
  const facedResult = await client.query(
    `SELECT DISTINCT opponent_player_id FROM game_rounds WHERE game_run_id = $1 AND opponent_player_id IS NOT NULL`,
    [gameRunId]
  );
  const facedIds = [...new Set(facedResult.rows.map((r) => r.opponent_player_id))];
  facedIds.push(playerId);

  const excludePlaceholders = facedIds.map((_, i) => `$${i + 2}`).join(', ');
  const snapshotResult = await client.query(
    `SELECT * FROM game_run_ghost_snapshots
     WHERE player_id NOT IN (${excludePlaceholders})
       AND total_coins <= $1
     ORDER BY RANDOM() LIMIT 1`,
    [ghostBudget, ...facedIds]
  );

  if (snapshotResult.rowCount) {
    const row = snapshotResult.rows[0];
    const payload = parseJson(row.payload_json);
    return {
      playerId: row.player_id,
      mushroomId: row.mushroom_id,
      loadout: payload.loadout
    };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const seed = `${gameRunId}:ghost:${roundNumber}:${attempt}`;
      return createBotGhostSnapshot(seed, null, Math.max(MAX_ARTIFACT_COINS, ghostBudget));
    } catch {
      continue;
    }
  }
  return createBotGhostSnapshot(`${gameRunId}:ghost:${roundNumber}:fallback`, null, MAX_ARTIFACT_COINS);
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
    const roundIncome = roundNumber < MAX_ROUNDS_PER_RUN ? ROUND_INCOME[roundNumber] : 0;

    await client.query(
      `INSERT INTO game_rounds (id, game_run_id, round_number, battle_id, player_id, outcome, opponent_player_id, spore_awarded, mycelium_awarded, rating_before, rating_after, coins_income, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL, $10, $11)`,
      [
        createId('ground'), gameRunId, roundNumber, battle.id, grp.player_id,
        outcome, opponentId, rewards.spore, rewards.mycelium, roundIncome, nowIso()
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
      [grp.player_id, rewards.spore, nowIso()]
    );

    const activeChar = await client.query(
      `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`, [grp.player_id]
    );
    const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : snapshot.mushroomId;

    await client.query(
      `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
      [grp.player_id, mushroomId, rewards.mycelium]
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
      const shopState = await client.query(
        `SELECT rounds_since_bag FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
        [gameRunId, grp.player_id]
      );
      const prevRoundsSinceBag = shopState.rowCount ? shopState.rows[0].rounds_since_bag : 1;
      const newRoundsSinceBag = prevRoundsSinceBag + 1;
      const shopRng = createRng(`${gameRunId}:shop:${nextRound}:${grp.player_id}`);
      const { offer: newOffer, hasBag } = generateShopOffer(shopRng, SHOP_OFFER_SIZE, newRoundsSinceBag);
      await client.query(
        `UPDATE game_run_shop_states SET round_number = $2, refresh_count = 0, rounds_since_bag = $3, offer_json = $4, updated_at = $5
         WHERE game_run_id = $1 AND player_id = $6`,
        [gameRunId, nextRound, hasBag ? 0 : newRoundsSinceBag, JSON.stringify(newOffer), nowIso(), grp.player_id]
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
    const ghostBudget = Math.max(MAX_ARTIFACT_COINS, Math.floor(grp.coins * (1 - GHOST_BUDGET_DISCOUNT)));
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
        rewards.spore, rewards.mycelium,
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
      [playerId, rewards.spore, ratingAfter, nowIso()]
    );

    const activeChar = await client.query(
      `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`, [playerId]
    );
    const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : leftSnapshot.mushroomId;

    await client.query(
      `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
      [playerId, mushroomId, rewards.mycelium]
    );

    await client.query(
      `INSERT INTO game_run_ghost_snapshots (id, game_run_id, player_id, round_number, mushroom_id, payload_json, total_coins, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [createId('ghost'), gameRunId, playerId, roundNumber, leftSnapshot.mushroomId,
       JSON.stringify({ mushroomId: leftSnapshot.mushroomId, loadout: leftSnapshot.loadout }),
       grp.coins, nowIso()]
    );

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
      const shopState = await client.query(
        `SELECT rounds_since_bag FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
        [gameRunId, playerId]
      );
      const prevRoundsSinceBag = shopState.rowCount ? shopState.rows[0].rounds_since_bag : 1;
      const newRoundsSinceBag = prevRoundsSinceBag + 1;
      const shopRng = createRng(`${gameRunId}:shop:${nextRound}`);
      const { offer: newOffer, hasBag } = generateShopOffer(shopRng, SHOP_OFFER_SIZE, newRoundsSinceBag);
      await client.query(
        `UPDATE game_run_shop_states SET round_number = $2, refresh_count = 0, rounds_since_bag = $3, offer_json = $4, updated_at = $5
         WHERE game_run_id = $1 AND player_id = $6`,
        [gameRunId, nextRound, hasBag ? 0 : newRoundsSinceBag, JSON.stringify(newOffer), nowIso(), playerId]
      );
    }

    return {
      id: gameRunId,
      mode: run.mode,
      status: runEnded ? 'completed' : 'active',
      currentRound: runEnded ? roundNumber : roundNumber + 1,
      endedAt: runEnded ? nowIso() : null,
      endReason,
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
        ratingAfter
      }
    };
  });
}

export async function buyRunShopItem(playerId, gameRunId, artifactId) {
  return withTransaction(async (client) => {
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
      `SELECT offer_json FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
      [gameRunId, playerId]
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
      `UPDATE game_run_shop_states SET offer_json = $2, updated_at = $3 WHERE game_run_id = $1 AND player_id = $4`,
      [gameRunId, JSON.stringify(newOffer), nowIso(), playerId]
    );

    const loadoutResult = await client.query(
      `SELECT id FROM player_artifact_loadouts WHERE player_id = $1`,
      [playerId]
    );
    let loadoutId;
    if (loadoutResult.rowCount) {
      loadoutId = loadoutResult.rows[0].id;
    } else {
      loadoutId = createId('loadout');
      const activeChar = await client.query(
        `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
        [playerId]
      );
      const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : 'thalla';
      await client.query(
        `INSERT INTO player_artifact_loadouts (id, player_id, mushroom_id, grid_width, grid_height, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 1, $6, $6)`,
        [loadoutId, playerId, mushroomId, INVENTORY_COLUMNS, INVENTORY_ROWS, nowIso()]
      );
    }

    const maxSort = await client.query(
      `SELECT MAX(sort_order) AS max_sort FROM player_artifact_loadout_items WHERE loadout_id = $1`,
      [loadoutId]
    );
    const nextSort = (maxSort.rows[0]?.max_sort ?? -1) + 1;

    await client.query(
      `INSERT INTO player_artifact_loadout_items (id, loadout_id, artifact_id, x, y, width, height, sort_order, purchased_round, bag_id)
       VALUES ($1, $2, $3, -1, -1, $4, $5, $6, $7, NULL)`,
      [createId('loadoutitem'), loadoutId, artifactId, artifact.width, artifact.height, nextSort, currentRound]
    );

    return { coins: newCoins, artifactId, price, shopOffer: newOffer };
  });
}

export async function refreshRunShop(playerId, gameRunId) {
  return withTransaction(async (client) => {
    const grpResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this active game run');
    }
    const grp = grpResult.rows[0];

    const shopResult = await client.query(
      `SELECT * FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
      [gameRunId, playerId]
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
       WHERE game_run_id = $1 AND player_id = $5`,
      [gameRunId, hasBag ? 0 : currentRoundsSinceBag, JSON.stringify(newOffer), nowIso(), playerId]
    );

    return {
      coins: newCoins,
      shopOffer: newOffer,
      refreshCount: shop.refresh_count + 1,
      refreshCost: cost
    };
  });
}

export async function sellRunItem(playerId, gameRunId, artifactId) {
  return withTransaction(async (client) => {
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

    const loadoutResult = await client.query(
      `SELECT id FROM player_artifact_loadouts WHERE player_id = $1`,
      [playerId]
    );
    if (!loadoutResult.rowCount) {
      throw new Error('No loadout found');
    }
    const loadoutId = loadoutResult.rows[0].id;

    const itemResult = await client.query(
      `SELECT * FROM player_artifact_loadout_items WHERE loadout_id = $1 AND artifact_id = $2 LIMIT 1`,
      [loadoutId, artifactId]
    );
    if (!itemResult.rowCount) {
      throw new Error('Item not found in loadout');
    }
    const item = itemResult.rows[0];

    const artifact = getArtifactById(item.artifact_id);

    if (artifact && artifact.family === 'bag') {
      const contentsResult = await client.query(
        `SELECT COUNT(*) AS count FROM player_artifact_loadout_items WHERE loadout_id = $1 AND bag_id = $2`,
        [loadoutId, artifact.id]
      );
      if (Number(contentsResult.rows[0].count) > 0) {
        throw new Error('Cannot sell a bag that contains items — empty it first');
      }
    }

    const price = getArtifactPrice(artifact);
    const purchasedRound = item.purchased_round || 1;
    const sellPrice = purchasedRound === currentRound ? price : Math.floor(price / 2);

    await client.query(
      `DELETE FROM player_artifact_loadout_items WHERE id = $1`,
      [item.id]
    );
    const newCoins = grp.coins + sellPrice;
    await client.query(
      `UPDATE game_run_players SET coins = $2 WHERE id = $1`,
      [grp.id, newCoins]
    );

    return { coins: newCoins, sellPrice, artifactId: item.artifact_id };
  });
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

export async function pruneOldGhostSnapshots(maxAge = 14, maxCount = 10000) {
  const countResult = await query('SELECT COUNT(*) AS total FROM game_run_ghost_snapshots');
  const total = Number(countResult.rows[0].total);
  if (total <= maxCount) return { pruned: 0 };

  const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000).toISOString();
  const result = await query(
    `DELETE FROM game_run_ghost_snapshots WHERE created_at < $1`,
    [cutoff]
  );
  return { pruned: result.rowCount };
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
