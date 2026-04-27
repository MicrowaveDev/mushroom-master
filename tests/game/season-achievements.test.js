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

  assert.equal(first.season.runPoints, 35);
  assert.deepEqual(first.season.breakdown, {
    wins: 7,
    roundsCompleted: 9,
    winsPoints: 21,
    roundsPoints: 9,
    clearBonus: 5,
    total: 35
  });
  assert.equal(first.season.totalPoints, 35);
  assert.equal(first.season.levelId, 'diamond');
  assert.equal(second.season.totalPoints, 35);
  assert.ok(first.achievements.some((achievement) => achievement.id === 'season_diamond_node'));

  const runRows = await query(
    `SELECT * FROM player_season_runs WHERE player_id = $1 AND game_run_id = $2`,
    [playerId, run.id]
  );
  assert.equal(runRows.rowCount, 1);

  const progress = await query(
    `SELECT total_points, level_id FROM player_season_progress WHERE player_id = $1 AND season_id = 'season_1'`,
    [playerId]
  );
  assert.equal(progress.rows[0].total_points, 35);
  assert.equal(progress.rows[0].level_id, 'diamond');

  const achievements = await query(
    `SELECT achievement_id FROM player_achievements WHERE player_id = $1`,
    [playerId]
  );
  assert.ok(achievements.rows.some((row) => row.achievement_id === 'season_diamond_node'));

  const state = await getPlayerState(playerId);
  assert.equal(state.season.totalPoints, 35);
  assert.equal(state.season.levelId, 'diamond');
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

  const result = await resolveRound(playerId, run.id);

  assert.equal(result.status, 'completed');
  assert.equal(result.endReason, 'max_rounds');
  assert.equal(result.season.levelId, 'diamond');
  assert.ok(result.season.totalPoints >= 35);
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
  assert.equal(result.season.runPoints, 9);
  assert.equal(result.season.breakdown.clearBonus, 0);
  assert.equal(result.season.breakdown.total, 9);
  assert.ok(result.achievements.some((achievement) => achievement.id === 'morga_first_bloom'));
});
