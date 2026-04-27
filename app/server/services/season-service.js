import { getEarnedRunAchievements } from '../../shared/run-achievements.js';
import { calculateSeasonPoints, getSeasonLevel, getSeasonPointsBreakdown } from '../../shared/season-levels.js';
import { createId, nowIso } from '../lib/utils.js';

export const CURRENT_SEASON_ID = 'season_1';

async function readSeasonProgress(client, playerId, seasonId = CURRENT_SEASON_ID) {
  const result = await client.query(
    `SELECT * FROM player_season_progress WHERE player_id = $1 AND season_id = $2`,
    [playerId, seasonId]
  );
  return result.rowCount ? result.rows[0] : null;
}

async function readSourceAchievements(client, playerId, gameRunId) {
  const result = await client.query(
    `SELECT achievement_id FROM player_achievements WHERE player_id = $1 AND source_id = $2 ORDER BY earned_at ASC`,
    [playerId, gameRunId]
  );
  return result.rows.map((row) => ({ id: row.achievement_id, isNew: true }));
}

async function persistSeasonProgress(client, {
  playerId,
  gameRunId,
  seasonId,
  runPoints,
  levelId,
  wins,
  losses,
  completedRounds,
  endReason,
  now
}) {
  const existingRun = await client.query(
    `SELECT * FROM player_season_runs WHERE player_id = $1 AND game_run_id = $2`,
    [playerId, gameRunId]
  );
  if (existingRun.rowCount) {
    const progress = await readSeasonProgress(client, playerId, seasonId);
    return {
      alreadyProcessed: true,
      runRow: existingRun.rows[0],
      totalPoints: progress?.total_points ?? existingRun.rows[0].points,
      levelId: progress?.level_id ?? existingRun.rows[0].level_id
    };
  }

  const progress = await readSeasonProgress(client, playerId, seasonId);
  const previousPoints = progress?.total_points ?? 0;
  const previousLevelId = progress?.level_id ?? getSeasonLevel(previousPoints).id;
  const totalPoints = previousPoints + runPoints;
  const totalLevelId = getSeasonLevel(totalPoints).id;

  await client.query(
    `INSERT INTO player_season_runs (id, player_id, game_run_id, season_id, points, level_id, wins, losses, completed_rounds, end_reason, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      createId('seasonrun'),
      playerId,
      gameRunId,
      seasonId,
      runPoints,
      levelId,
      wins,
      losses,
      completedRounds,
      endReason,
      now
    ]
  );

  if (progress) {
    await client.query(
      `UPDATE player_season_progress SET total_points = $3, level_id = $4, updated_at = $5 WHERE player_id = $1 AND season_id = $2`,
      [playerId, seasonId, totalPoints, totalLevelId, now]
    );
  } else {
    await client.query(
      `INSERT INTO player_season_progress (player_id, season_id, total_points, level_id, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [playerId, seasonId, totalPoints, totalLevelId, now]
    );
  }

  return {
    alreadyProcessed: false,
    runRow: null,
    totalPoints,
    previousLevelId,
    levelId: totalLevelId,
    leveledUp: previousLevelId !== totalLevelId
  };
}

async function persistAchievements(client, {
  playerId,
  gameRunId,
  seasonId,
  achievements,
  now
}) {
  const unlocked = [];
  for (const achievement of achievements) {
    const existing = await client.query(
      `SELECT source_id FROM player_achievements WHERE player_id = $1 AND achievement_id = $2`,
      [playerId, achievement.id]
    );
    if (existing.rowCount) {
      if (existing.rows[0].source_id === gameRunId) {
        unlocked.push({ id: achievement.id, isNew: true });
      } else {
        unlocked.push({ id: achievement.id, isNew: false });
      }
      continue;
    }

    await client.query(
      `INSERT INTO player_achievements (id, player_id, achievement_id, source_type, source_id, season_id, earned_at)
       VALUES ($1, $2, $3, 'run', $4, $5, $6)`,
      [createId('ach'), playerId, achievement.id, gameRunId, seasonId, now]
    );
    unlocked.push({ id: achievement.id, isNew: true });
  }
  return unlocked;
}

export async function awardRunSeasonProgress(client, {
  playerId,
  gameRunId,
  mushroomId = null,
  endReason = null,
  lastOutcome = null,
  wins = 0,
  losses = 0,
  completedRounds = 0,
  livesRemaining = 0
}) {
  const seasonId = CURRENT_SEASON_ID;
  const now = nowIso();
  const runPoints = calculateSeasonPoints({ wins, roundsCompleted: completedRounds, endReason });
  const breakdown = getSeasonPointsBreakdown({ wins, roundsCompleted: completedRounds, endReason });
  const runLevelId = getSeasonLevel(runPoints).id;

  const persisted = await persistSeasonProgress(client, {
    playerId,
    gameRunId,
    seasonId,
    runPoints,
    levelId: runLevelId,
    wins,
    losses,
    completedRounds,
    endReason,
    now
  });

  if (persisted.alreadyProcessed) {
    return {
      season: {
        seasonId,
        runPoints: persisted.runRow.points,
        totalPoints: persisted.totalPoints,
        previousLevelId: persisted.levelId,
        levelId: persisted.levelId,
        leveledUp: false,
        breakdown
      },
      achievements: await readSourceAchievements(client, playerId, gameRunId)
    };
  }

  const totalLevelId = persisted.levelId;
  const totalPoints = persisted.totalPoints;
  const winRate = completedRounds ? Math.round((wins / completedRounds) * 100) : 0;
  const earned = getEarnedRunAchievements({
    mushroomId,
    endReason,
    lastOutcome,
    wins,
    losses,
    roundsCompleted: completedRounds,
    livesRemaining,
    winRate,
    seasonLevel: totalLevelId,
    seasonPoints: totalPoints
  }, 'en', Number.POSITIVE_INFINITY);

  return {
    season: {
      seasonId,
      runPoints,
      totalPoints,
      previousLevelId: persisted.previousLevelId,
      levelId: totalLevelId,
      leveledUp: persisted.leveledUp,
      breakdown
    },
    achievements: await persistAchievements(client, {
      playerId,
      gameRunId,
      seasonId,
      achievements: earned,
      now
    })
  };
}
