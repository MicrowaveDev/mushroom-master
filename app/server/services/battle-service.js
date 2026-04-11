import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import {
  DAILY_BATTLE_LIMIT,
  getArtifactById,
  getMushroomById,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  mushrooms,
  RATING_FLOOR,
  rewardTable,
  ROUND_INCOME
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
import { randomInt, shuffleWithRng, simulateBattle } from './battle-engine.js';
import { createBotGhostSnapshot } from './bot-loadout.js';
import { validateLoadoutItems } from './loadout-utils.js';

export async function getActiveSnapshot(client, playerId) {
  // Active mushroom is always read from player_active_character.
  const activeResult = await client.query(
    `SELECT * FROM player_active_character WHERE player_id = $1`,
    [playerId]
  );
  if (!activeResult.rowCount) {
    throw new Error('Active mushroom not selected');
  }
  const mushroomId = activeResult.rows[0].mushroom_id;

  // Prefer the run-scoped new table if the player is in an active game run.
  // Legacy single-battle path falls back to player_artifact_loadout_items.
  const activeRunResult = await client.query(
    `SELECT grp.game_run_id, gr.current_round
     FROM game_run_players grp
     JOIN game_runs gr ON gr.id = grp.game_run_id
     WHERE grp.player_id = $1 AND grp.is_active = 1`,
    [playerId]
  );

  let items;
  let runBudget;
  if (activeRunResult.rowCount) {
    const { game_run_id: gameRunId, current_round: currentRound } = activeRunResult.rows[0];
    const rows = await client.query(
      `SELECT artifact_id, x, y, width, height, bag_id, sort_order
       FROM game_run_loadout_items
       WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3
       ORDER BY sort_order ASC`,
      [gameRunId, playerId, currentRound]
    );
    items = rows.rows.map((row) => ({
      artifactId: row.artifact_id,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      sortOrder: row.sort_order,
      bagId: row.bag_id || null
    }));
    runBudget = ROUND_INCOME.slice(0, currentRound).reduce((sum, c) => sum + c, 0);
  } else {
    const loadoutResult = await client.query(
      `SELECT * FROM player_artifact_loadouts WHERE player_id = $1`,
      [playerId]
    );
    if (!loadoutResult.rowCount) {
      throw new Error('Artifact loadout not saved');
    }
    const loadoutItemsResult = await client.query(
      `SELECT items.*
       FROM player_artifact_loadout_items items
       JOIN player_artifact_loadouts loadouts ON loadouts.id = items.loadout_id
       WHERE loadouts.player_id = $1
       ORDER BY items.sort_order ASC`,
      [playerId]
    );
    items = loadoutItemsResult.rows.map((row) => ({
      artifactId: row.artifact_id,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      sortOrder: row.sort_order,
      bagId: row.bag_id || null
    }));
    runBudget = MAX_ARTIFACT_COINS;
  }

  validateLoadoutItems(items, runBudget);

  return {
    playerId,
    mushroomId,
    loadout: {
      gridWidth: INVENTORY_COLUMNS,
      gridHeight: INVENTORY_ROWS,
      items
    }
  };
}

export async function getRandomGhostSnapshot(client, playerId, seedInput) {
  const rng = createRng(`${seedInput}:ghost`);
  const targetMushroom = mushrooms[randomInt(rng, mushrooms.length)];
  const result = await client.query(
    `SELECT DISTINCT loadouts.player_id
     FROM player_artifact_loadouts loadouts
     JOIN player_active_character active ON active.player_id = loadouts.player_id
     WHERE loadouts.player_id <> $1
       AND active.mushroom_id = $2`,
    [playerId, targetMushroom.id]
  );
  const candidateIds = shuffleWithRng(
    result.rows.map((row) => row.player_id),
    rng
  );

  for (const candidateId of candidateIds) {
    try {
      return getActiveSnapshot(client, candidateId);
    } catch {
    }
  }

  return createBotGhostSnapshot(seedInput, targetMushroom.id);
}

export async function getDailyUsage(client, playerId) {
  const currentDay = dayKey(new Date());
  const usageResult = await client.query(
    `SELECT battle_starts FROM daily_rate_limits WHERE player_id = $1 AND day_key = $2`,
    [playerId, currentDay]
  );
  return usageResult.rowCount ? Number(usageResult.rows[0].battle_starts) : 0;
}

export function resolveBattleRewards(initiatorResult, scope) {
  const leftOutcome = initiatorResult.winnerSide === 'left' ? 'win' : initiatorResult.winnerSide === 'right' ? 'loss' : 'draw';
  const rightOutcome = initiatorResult.winnerSide === 'right' ? 'win' : initiatorResult.winnerSide === 'left' ? 'loss' : 'draw';

  return {
    left: {
      outcome: leftOutcome,
      reward: rewardTable[leftOutcome]
    },
    right: {
      outcome: rightOutcome,
      reward: rewardTable[rightOutcome]
    },
    scope
  };
}

export async function applyBattleRewards(client, battle, leftSnapshot, rightSnapshot, simulation, rewardScope) {
  const rewards = resolveBattleRewards(simulation, rewardScope);
  const leftPlayerResult = await client.query('SELECT * FROM players WHERE id = $1', [leftSnapshot.playerId]);
  const rightPlayerResult = rightSnapshot.playerId
    ? await client.query('SELECT * FROM players WHERE id = $1', [rightSnapshot.playerId])
    : { rowCount: 0, rows: [] };

  const leftPlayer = leftPlayerResult.rows[0];
  const rightPlayer = rightPlayerResult.rowCount ? rightPlayerResult.rows[0] : null;

  const writes = [
    {
      player: leftPlayer,
      snapshot: leftSnapshot,
      result: rewards.left,
      counts: rewardScope === 'two_sided' || rewardScope === 'one_sided' ? true : false
    }
  ];

  if (rightPlayer && rewardScope === 'two_sided') {
    writes.push({
      player: rightPlayer,
      snapshot: rightSnapshot,
      result: rewards.right,
      counts: true
    });
  }

  for (const entry of writes) {
    const actualScore = entry.result.outcome === 'win' ? 1 : entry.result.outcome === 'draw' ? 0.5 : 0;
    const opponentRating = entry.player.id === leftPlayer.id ? (rightPlayer?.rating ?? leftPlayer.rating) : leftPlayer.rating;
    const ratingBefore = entry.player.rating;
    const ratingAfter = entry.counts
      ? Math.max(RATING_FLOOR, Math.round(
          ratingBefore +
            kFactor(ratingBefore, entry.player.rated_battle_count) *
              (actualScore - expectedScore(ratingBefore, opponentRating))
        ))
      : ratingBefore;

    const winsDelta = entry.result.outcome === 'win' ? 1 : 0;
    const lossesDelta = entry.result.outcome === 'loss' ? 1 : 0;
    const drawsDelta = entry.result.outcome === 'draw' ? 1 : 0;
    const sporeDelta = entry.result.reward.spore;
    const myceliumDelta = entry.result.reward.mycelium;

    await client.query(
      `UPDATE players
       SET spore = spore + $2,
           rating = $3,
           rated_battle_count = rated_battle_count + $4,
           wins = wins + $5,
           losses = losses + $6,
           draws = draws + $7,
           updated_at = $8
       WHERE id = $1`,
      [
        entry.player.id,
        sporeDelta,
        ratingAfter,
        entry.counts ? 1 : 0,
        entry.counts ? winsDelta : 0,
        entry.counts ? lossesDelta : 0,
        entry.counts ? drawsDelta : 0,
        nowIso()
      ]
    );

    await client.query(
      `UPDATE player_mushrooms
       SET mycelium = mycelium + $3,
           wins = wins + $4,
           losses = losses + $5,
           draws = draws + $6
       WHERE player_id = $1 AND mushroom_id = $2`,
      [
        entry.player.id,
        entry.snapshot.mushroomId,
        myceliumDelta,
        entry.counts ? winsDelta : 0,
        entry.counts ? lossesDelta : 0,
        entry.counts ? drawsDelta : 0
      ]
    );

    await client.query(
      `INSERT INTO battle_rewards
       (id, battle_id, player_id, mushroom_id, spore_delta, mycelium_delta, rating_before, rating_after, wins_delta, losses_delta, draws_delta, reward_scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        createId('reward'),
        battle.id,
        entry.player.id,
        entry.snapshot.mushroomId,
        sporeDelta,
        myceliumDelta,
        ratingBefore,
        ratingAfter,
        entry.counts ? winsDelta : 0,
        entry.counts ? lossesDelta : 0,
        entry.counts ? drawsDelta : 0,
        rewardScope
      ]
    );
  }
}

export async function recordBattle(client, { leftSnapshot, rightSnapshot, simulation, battleSeed, mode, opponentKind, ratedScope, challengeId, initiatorPlayerId }) {
  const battle = {
    id: createId('battle'),
    mode,
    initiatorPlayerId,
    opponentPlayerId: rightSnapshot.playerId || null,
    opponentKind,
    ratedScope,
    battleSeed,
    outcome: simulation.winnerSide === 'left' ? 'win' : simulation.winnerSide === 'right' ? 'loss' : 'draw',
    winnerSide: simulation.winnerSide,
    createdAt: nowIso()
  };

  await client.query(
    `INSERT INTO battles
     (id, mode, initiator_player_id, opponent_player_id, opponent_kind, rated_scope, battle_seed, outcome, winner_side, challenger_challenge_id, created_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
    [
      battle.id, battle.mode, battle.initiatorPlayerId, battle.opponentPlayerId,
      battle.opponentKind, battle.ratedScope, battle.battleSeed, battle.outcome,
      battle.winnerSide, challengeId || null, battle.createdAt
    ]
  );

  const snapshots = [
    { side: 'left', snapshot: leftSnapshot },
    { side: 'right', snapshot: rightSnapshot }
  ];
  for (const entry of snapshots) {
    const mushroom = getMushroomById(entry.snapshot.mushroomId);
    await client.query(
      `INSERT INTO battle_snapshots
       (id, battle_id, side, player_id, mushroom_id, mushroom_name, payload_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        createId('snapshot'), battle.id, entry.side,
        entry.snapshot.playerId || null, entry.snapshot.mushroomId,
        mushroom.name.en, JSON.stringify(entry.snapshot)
      ]
    );
  }

  for (const [index, event] of simulation.events.entries()) {
    await client.query(
      `INSERT INTO battle_events (id, battle_id, event_index, event_type, payload_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [createId('event'), battle.id, index, event.type, JSON.stringify(event)]
    );
  }

  return battle;
}

export async function createBattle(playerId, payload = {}) {
  return withTransaction(async (client) => {
    const usage = await getDailyUsage(client, playerId);
    if (usage >= DAILY_BATTLE_LIMIT) {
      throw new Error('Daily battle limit reached');
    }

    const idempotencyKey = payload.idempotencyKey || crypto.randomUUID();
    const previous = await client.query(
      `SELECT * FROM battle_requests WHERE player_id = $1 AND idempotency_key = $2`,
      [playerId, idempotencyKey]
    );
    if (previous.rowCount && previous.rows[0].battle_id) {
      return getBattle(previous.rows[0].battle_id, playerId);
    }
    if (!previous.rowCount) {
      await client.query(
        `INSERT INTO battle_requests (id, player_id, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4)`,
        [createId('breq'), playerId, idempotencyKey, nowIso()]
      );
    }

    const leftSnapshot = await getActiveSnapshot(client, playerId);
    const battleSeed = payload.seed || crypto.randomBytes(16).toString('hex');
    const isFriendAccepted = payload.mode === 'friend' && payload.friendChallengeId;
    const rightSnapshot = isFriendAccepted
      ? await getActiveSnapshot(client, payload.opponentPlayerId)
      : await getRandomGhostSnapshot(client, playerId, battleSeed);

    const simulation = simulateBattle({ left: leftSnapshot, right: rightSnapshot }, battleSeed);

    const battle = await recordBattle(client, {
      leftSnapshot, rightSnapshot, simulation, battleSeed,
      mode: isFriendAccepted ? 'friend' : 'ghost',
      opponentKind: isFriendAccepted ? 'friend_live' : rightSnapshot.playerId ? 'ghost_snapshot' : 'ghost_bot',
      ratedScope: isFriendAccepted ? 'two_sided' : 'one_sided',
      challengeId: payload.friendChallengeId,
      initiatorPlayerId: playerId
    });

    await applyBattleRewards(client, battle, leftSnapshot, rightSnapshot, simulation, battle.ratedScope);

    const currentDay = dayKey(new Date());
    await client.query(
      `INSERT INTO daily_rate_limits (player_id, day_key, battle_starts)
       VALUES ($1, $2, 1)
       ON CONFLICT (player_id, day_key)
       DO UPDATE SET battle_starts = daily_rate_limits.battle_starts + 1`,
      [playerId, currentDay]
    );

    await client.query(
      `UPDATE battle_requests
       SET battle_id = $3
       WHERE player_id = $1 AND idempotency_key = $2`,
      [playerId, idempotencyKey, battle.id]
    );

    if (payload.friendChallengeId) {
      await client.query(
        `UPDATE friend_challenges
         SET status = 'accepted', accepted_at = $2, battle_id = $3
         WHERE id = $1`,
        [payload.friendChallengeId, nowIso(), battle.id]
      );
    }

    return getBattle(battle.id, playerId, client);
  });
}

export async function getBattle(battleId, viewerPlayerId, existingClient = null) {
  const runner = existingClient || { query: (sql, params) => query(sql, params) };
  const [battleResult, snapshotResult, eventResult, rewardResult] = await Promise.all([
    runner.query(`SELECT * FROM battles WHERE id = $1`, [battleId]),
    runner.query(`SELECT * FROM battle_snapshots WHERE battle_id = $1 ORDER BY side ASC`, [battleId]),
    runner.query(`SELECT * FROM battle_events WHERE battle_id = $1 ORDER BY event_index ASC`, [battleId]),
    runner.query(`SELECT * FROM battle_rewards WHERE battle_id = $1 ORDER BY player_id ASC`, [battleId])
  ]);

  if (!battleResult.rowCount) {
    throw new Error('Battle not found');
  }

  const battle = battleResult.rows[0];
  const snapshots = Object.fromEntries(
    snapshotResult.rows.map((row) => [row.side, parseJson(row.payload_json, {})])
  );

  return {
    id: battle.id,
    mode: battle.mode,
    opponentKind: battle.opponent_kind,
    ratedScope: battle.rated_scope,
    battleSeed: battle.battle_seed,
    outcome: battle.outcome,
    winnerSide: battle.winner_side,
    createdAt: battle.created_at,
    viewerPlayerId,
    snapshots,
    events: eventResult.rows.map((row) => parseJson(row.payload_json, {})),
    rewards: rewardResult.rows.map((row) => ({
      playerId: row.player_id,
      mushroomId: row.mushroom_id,
      sporeDelta: row.spore_delta,
      myceliumDelta: row.mycelium_delta,
      ratingBefore: row.rating_before,
      ratingAfter: row.rating_after,
      rewardScope: row.reward_scope
    }))
  };
}

export async function getBattleHistory(playerId, limit = 20) {
  const result = await query(
    `SELECT * FROM battles
     WHERE initiator_player_id = $1 OR opponent_player_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [playerId, limit]
  );
  return Promise.all(result.rows.map((row) => getBattle(row.id, playerId)));
}
