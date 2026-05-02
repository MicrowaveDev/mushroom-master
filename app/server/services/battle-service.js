import { query } from '../db.js';
import {
  getMushroomById,
  getStarterPresetCost,
  BAG_COLUMNS,
  BAG_ROWS,
  ROUND_INCOME
} from '../game-data.js';
import {
  createId,
  dayKey,
  nowIso,
  parseJson
} from '../lib/utils.js';
import { validateLoadoutItems } from './loadout-utils.js';
import { normalizeRotation } from '../../shared/bag-shape.js';

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

  // The player MUST be in an active game run for this call to succeed.
  // Legacy single-battle fallback (player_artifact_loadouts) was deleted in
  // 2026-04-13. Callers (run-service.resolveRound, .resolveChallengeRound,
  // .getRunGhostSnapshot) only invoke this for participants of active runs.
  const activeRunResult = await client.query(
    `SELECT grp.game_run_id, gr.current_round
     FROM game_run_players grp
     JOIN game_runs gr ON gr.id = grp.game_run_id
     WHERE grp.player_id = $1 AND grp.is_active = 1`,
    [playerId]
  );
  if (!activeRunResult.rowCount) {
    throw new Error('Player is not in an active game run');
  }

  const { game_run_id: gameRunId, current_round: currentRound } = activeRunResult.rows[0];
  const rows = await client.query(
    `SELECT id, artifact_id, x, y, width, height, sort_order, active, rotated
     FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = $3
     ORDER BY sort_order ASC`,
    [gameRunId, playerId, currentRound]
  );
  const items = rows.rows.map((row) => ({
    id: row.id,
    artifactId: row.artifact_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    active: !!row.active,
    rotated: normalizeRotation(row.rotated)
  }));
  // Budget ceiling = all coin income the player has seen so far + the free
  // starter preset gift. Preset items live in the loadout and are summed by
  // validateCoinBudget, so the ceiling must include their value or round-1
  // buys trip the validator (2-coin preset + full 5-coin spend = 7 > 5).
  const cumulativeIncome = ROUND_INCOME.slice(0, currentRound).reduce((sum, c) => sum + c, 0);
  const runBudget = cumulativeIncome + getStarterPresetCost(mushroomId);

  validateLoadoutItems(items, runBudget);

  return {
    playerId,
    mushroomId,
    loadout: {
      gridWidth: BAG_COLUMNS,
      gridHeight: BAG_ROWS,
      items
    }
  };
}

export async function getDailyUsage(client, playerId) {
  const currentDay = dayKey(new Date());
  const usageResult = await client.query(
    `SELECT battle_starts FROM daily_rate_limits WHERE player_id = $1 AND day_key = $2`,
    [playerId, currentDay]
  );
  return usageResult.rowCount ? Number(usageResult.rows[0].battle_starts) : 0;
}

// resolveBattleRewards / applyBattleRewards (legacy single-battle reward
// pipeline) deleted 2026-04-13. Game runs apply rewards through
// run-service (per-round + completion bonus) — see runRewardTable and
// payCompletionBonus.

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

// createBattle (legacy single-battle entry point: POST /api/battles +
// friend-challenge battle path) deleted 2026-04-13. All combat now flows
// through run-service.resolveRound / run-service.resolveChallengeRound.

export async function getBattle(battleId, viewerPlayerId, existingClient = null) {
  const runner = existingClient || { query: (sql, params) => query(sql, params) };
  const [battleResult, snapshotResult, eventResult, rewardResult, roundResult] = await Promise.all([
    runner.query(`SELECT * FROM battles WHERE id = $1`, [battleId]),
    runner.query(`SELECT * FROM battle_snapshots WHERE battle_id = $1 ORDER BY side ASC`, [battleId]),
    runner.query(`SELECT * FROM battle_events WHERE battle_id = $1 ORDER BY event_index ASC`, [battleId]),
    runner.query(`SELECT * FROM battle_rewards WHERE battle_id = $1 ORDER BY player_id ASC`, [battleId]),
    runner.query(
      `SELECT * FROM game_rounds WHERE battle_id = $1 AND player_id = $2 ORDER BY round_number DESC LIMIT 1`,
      [battleId, viewerPlayerId]
    )
  ]);

  if (!battleResult.rowCount) {
    throw new Error('Battle not found');
  }

  const battle = battleResult.rows[0];
  const snapshots = Object.fromEntries(
    snapshotResult.rows.map((row) => [row.side, parseJson(row.payload_json, {})])
  );

  const viewerRound = roundResult.rows[0] || null;

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
    roundResult: viewerRound ? {
      roundNumber: viewerRound.round_number,
      battleId: viewerRound.battle_id,
      outcome: viewerRound.outcome,
      rewards: {
        spore: viewerRound.spore_awarded || 0,
        mycelium: viewerRound.mycelium_awarded || 0
      },
      ratingBefore: viewerRound.rating_before,
      ratingAfter: viewerRound.rating_after,
      coinsIncome: viewerRound.coins_income || 0
    } : null,
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
