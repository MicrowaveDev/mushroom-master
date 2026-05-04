import assert from 'node:assert/strict';
import test from 'node:test';
import { query, withTransaction } from '../../app/server/db.js';
import { abandonGameRun, resolveRound } from '../../app/server/services/run-service.js';
import { awardRunSeasonProgress } from '../../app/server/services/season-service.js';
import { getPlayerState } from '../../app/server/services/player-service.js';
import { freshDb, bootRun } from './helpers.js';

test('season award persistence is idempotent per player and run', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 91001, username: 'season_idempotent', mushroomId: 'thalla' });
  await query(
    `INSERT INTO player_season_progress (player_id, season_id, total_points, level_id, updated_at)
     VALUES ($1, 'season_1', 125, 'gold', '2026-04-26T21:00:00.000Z')`,
    [playerId]
  );

  const first = await withTransaction((client) => awardRunSeasonProgress(client, {
    playerId,
    gameRunId: run.id,
    mushroomId: 'thalla',
    endReason: 'max_rounds',
    lastOutcome: 'win',
    wins: 7,
    losses: 2,
    completedRounds: 9,
    livesRemaining: 3
  }));
  const second = await withTransaction((client) => awardRunSeasonProgress(client, {
    playerId,
    gameRunId: run.id,
    mushroomId: 'thalla',
    endReason: 'max_rounds',
    lastOutcome: 'win',
    wins: 7,
    losses: 2,
    completedRounds: 9,
    livesRemaining: 3
  }));

  assert.equal(first.season.runPoints, 15);
  assert.deepEqual(first.season.breakdown, {
    wins: 7,
    scoringWins: 7,
    cappedWins: 0,
    losses: 2,
    roundsCompleted: 9,
    winsPoints: 14,
    lossesPenalty: -2,
    clearBonus: 3,
    abandonPenalty: 0,
    protectionAdjustment: 0,
    total: 15
  });
  assert.equal(first.season.totalPoints, 140);
  assert.equal(first.season.levelId, 'diamond');
  assert.equal(second.season.totalPoints, 140);
  assert.ok(first.achievements.some((achievement) => achievement.id === 'season_diamond_node'));

  const runRows = await query(
    `SELECT * FROM player_season_runs WHERE player_id = $1 AND game_run_id = $2`,
    [playerId, run.id]
  );
  assert.equal(runRows.rowCount, 1);

  const progress = await query(
    `SELECT total_points, level_id, peak_points, peak_level_id FROM player_season_progress WHERE player_id = $1 AND season_id = 'season_1'`,
    [playerId]
  );
  assert.equal(progress.rows[0].total_points, 140);
  assert.equal(progress.rows[0].level_id, 'diamond');
  assert.equal(progress.rows[0].peak_points, 140);
  assert.equal(progress.rows[0].peak_level_id, 'diamond');

  const achievements = await query(
    `SELECT achievement_id FROM player_achievements WHERE player_id = $1`,
    [playerId]
  );
  assert.ok(achievements.rows.some((row) => row.achievement_id === 'season_diamond_node'));

  const state = await getPlayerState(playerId);
  assert.equal(state.season.totalPoints, 140);
  assert.equal(state.season.levelId, 'diamond');
  assert.equal(state.season.peakPoints, 140);
  assert.equal(state.season.peakLevelId, 'diamond');
  assert.ok(state.season.recentAchievements.some((achievement) => achievement.id === 'season_diamond_node'));
  assert.ok(state.season.achievements.some((achievement) => achievement.id === 'season_diamond_node'));
});

test('season achievements already earned in older runs are returned as earned, not new', async () => {
  await freshDb();
  const first = await bootRun({ telegramId: 91003, username: 'season_repeat', mushroomId: 'thalla' });

  await withTransaction((client) => awardRunSeasonProgress(client, {
    playerId: first.playerId,
    gameRunId: first.run.id,
    mushroomId: 'thalla',
    endReason: 'max_losses',
    lastOutcome: 'win',
    wins: 1,
    losses: 1,
    completedRounds: 2,
    livesRemaining: 4
  }));
  await query(
    `UPDATE game_runs SET status = 'completed', ended_at = '2026-04-26T22:00:00.000Z', end_reason = 'max_losses' WHERE id = $1`,
    [first.run.id]
  );
  await query(
    `UPDATE game_run_players SET is_active = 0 WHERE game_run_id = $1 AND player_id = $2`,
    [first.run.id, first.playerId]
  );
  const second = await bootRun({ telegramId: 91003, username: 'season_repeat', mushroomId: 'thalla' });

  const repeat = await withTransaction((client) => awardRunSeasonProgress(client, {
    playerId: second.playerId,
    gameRunId: second.run.id,
    mushroomId: 'thalla',
    endReason: 'max_losses',
    lastOutcome: 'win',
    wins: 1,
    losses: 1,
    completedRounds: 2,
    livesRemaining: 4
  }));

  const repeatedAchievement = repeat.achievements.find((achievement) => achievement.id === 'thalla_spore_echo');
  assert.equal(repeatedAchievement?.isNew, false);
});

test('resolved run completion returns persisted season and newly earned achievements', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 91002, username: 'season_complete', mushroomId: 'thalla' });

  await query(
    `UPDATE game_run_players SET completed_rounds = 8, wins = 7, losses = 1, lives_remaining = 4 WHERE game_run_id = $1 AND player_id = $2`,
    [run.id, playerId]
  );
  await query(
    `INSERT INTO player_season_progress (player_id, season_id, total_points, level_id, updated_at)
     VALUES ($1, 'season_1', 125, 'gold', '2026-04-26T21:00:00.000Z')`,
    [playerId]
  );

  const result = await resolveRound(playerId, run.id);

  assert.equal(result.status, 'completed');
  assert.equal(result.endReason, 'max_rounds');
  assert.equal(result.season.levelId, 'diamond');
  assert.ok(result.season.totalPoints >= 140);
  assert.ok(result.achievements.some((achievement) => achievement.id === 'season_diamond_node'));

  const progress = await query(
    `SELECT total_points, level_id FROM player_season_progress WHERE player_id = $1 AND season_id = 'season_1'`,
    [playerId]
  );
  assert.equal(progress.rowCount, 1);
  assert.equal(progress.rows[0].level_id, 'diamond');
});

test('abandoned runs still persist season recap without clear bonus', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 91004, username: 'season_abandon', mushroomId: 'morga' });

  await query(
    `UPDATE game_run_players SET completed_rounds = 3, wins = 2, losses = 1, lives_remaining = 4 WHERE game_run_id = $1 AND player_id = $2`,
    [run.id, playerId]
  );

  const result = await abandonGameRun(playerId, run.id);

  assert.equal(result.status, 'abandoned');
  assert.equal(result.season.runPoints, -2);
  assert.equal(result.season.breakdown.clearBonus, 0);
  assert.equal(result.season.breakdown.lossesPenalty, -1);
  assert.equal(result.season.breakdown.abandonPenalty, -5);
  assert.equal(result.season.breakdown.total, -2);
  assert.equal(result.season.totalPoints, 0);
  assert.ok(result.achievements.some((achievement) => achievement.id === 'morga_first_bloom'));
});

test('losses and exits can reduce persisted season score', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 91005, username: 'season_penalty', mushroomId: 'kirt' });
  await query(
    `INSERT INTO player_season_progress (player_id, season_id, total_points, level_id, updated_at)
     VALUES ($1, 'season_1', 72, 'gold', '2026-04-26T21:00:00.000Z')`,
    [playerId]
  );
  await query(
    `UPDATE game_run_players SET completed_rounds = 4, wins = 1, losses = 3, lives_remaining = 2 WHERE game_run_id = $1 AND player_id = $2`,
    [run.id, playerId]
  );

  const result = await abandonGameRun(playerId, run.id);

  assert.equal(result.season.runPoints, -6);
  assert.equal(result.season.totalPoints, 66);
  assert.equal(result.season.levelId, 'silver');
  assert.equal(result.season.previousLevelId, 'gold');
  assert.equal(result.season.peakPoints, 72);
  assert.equal(result.season.peakLevelId, 'gold');
  assert.equal(result.season.leveledUp, false);
  assert.equal(result.season.leveledDown, true);
  assert.equal(result.season.levelChanged, true);
});

test('season rank drops exactly at threshold while preserving peak rank', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 91007, username: 'season_threshold', mushroomId: 'kirt' });
  await query(
    `INSERT INTO player_season_progress (player_id, season_id, total_points, level_id, peak_points, peak_level_id, updated_at)
     VALUES ($1, 'season_1', 70, 'gold', 70, 'gold', '2026-04-26T21:00:00.000Z')`,
    [playerId]
  );
  await query(
    `UPDATE game_run_players SET completed_rounds = 1, wins = 0, losses = 1, lives_remaining = 4 WHERE game_run_id = $1 AND player_id = $2`,
    [run.id, playerId]
  );

  const result = await abandonGameRun(playerId, run.id);

  assert.equal(result.season.runPoints, -6);
  assert.equal(result.season.totalPoints, 64);
  assert.equal(result.season.previousLevelId, 'gold');
  assert.equal(result.season.levelId, 'silver');
  assert.equal(result.season.peakPoints, 70);
  assert.equal(result.season.peakLevelId, 'gold');
  assert.equal(result.season.leveledDown, true);
});

test('season scoring caps win farming within a single run', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 91008, username: 'season_cap', mushroomId: 'thalla' });

  const result = await withTransaction((client) => awardRunSeasonProgress(client, {
    playerId,
    gameRunId: run.id,
    mushroomId: 'thalla',
    endReason: 'max_rounds',
    lastOutcome: 'win',
    wins: 9,
    losses: 0,
    completedRounds: 9,
    livesRemaining: 5
  }));

  assert.equal(result.season.runPoints, 17);
  assert.equal(result.season.breakdown.scoringWins, 7);
  assert.equal(result.season.breakdown.cappedWins, 2);
  assert.equal(result.season.breakdown.winsPoints, 14);
  assert.equal(result.season.breakdown.clearBonus, 3);
});

test('abandon before any completed round uses the smaller exit penalty', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 91006, username: 'season_early_exit', mushroomId: 'lomie' });
  await query(
    `INSERT INTO player_season_progress (player_id, season_id, total_points, level_id, updated_at)
     VALUES ($1, 'season_1', 10, 'bronze', '2026-04-26T21:00:00.000Z')`,
    [playerId]
  );

  const result = await abandonGameRun(playerId, run.id);

  assert.equal(result.season.runPoints, -2);
  assert.equal(result.season.breakdown.abandonPenalty, -2);
  assert.equal(result.season.totalPoints, 8);
});
