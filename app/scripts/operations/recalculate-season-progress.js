import { query } from '../../server/db.js';
import { calculateSeasonPoints, getSeasonLevel } from '../../shared/season-levels.js';

const write = process.argv.includes('--write');

const runs = await query(
  `SELECT id, player_id, game_run_id, season_id, wins, losses, completed_rounds, end_reason, created_at
   FROM player_season_runs
   ORDER BY player_id ASC, season_id ASC, created_at ASC, id ASC`
);

const totals = new Map();
const peaks = new Map();
const updates = [];

for (const row of runs.rows) {
  const key = `${row.player_id}:${row.season_id}`;
  const previous = totals.get(key) || 0;
  const points = calculateSeasonPoints({
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    roundsCompleted: Number(row.completed_rounds || 0),
    endReason: row.end_reason
  });
  const total = Math.max(0, previous + points);
  const peak = Math.max(peaks.get(key) || 0, total);
  totals.set(key, total);
  peaks.set(key, peak);
  updates.push({ ...row, points, cumulativeTotal: total, peak });
}

if (write) {
  for (const row of updates) {
    await query(
      `UPDATE player_season_runs SET points = $2, level_id = $3 WHERE id = $1`,
      [row.id, row.points, getSeasonLevel(row.points).id]
    );
  }

  for (const [key, total] of totals.entries()) {
    const [playerId, seasonId] = key.split(':');
    const peak = peaks.get(key) || total;
    await query(
      `UPDATE player_season_progress
       SET total_points = $3, level_id = $4, peak_points = $5, peak_level_id = $6, updated_at = CURRENT_TIMESTAMP
       WHERE player_id = $1 AND season_id = $2`,
      [playerId, seasonId, total, getSeasonLevel(total).id, peak, getSeasonLevel(peak).id]
    );
  }
}

console.log(`${write ? 'Updated' : 'Dry run'} ${updates.length} season run rows for ${totals.size} player-season totals.`);
for (const [key, total] of totals.entries()) {
  const [playerId, seasonId] = key.split(':');
  const peak = peaks.get(key) || total;
  console.log(`${playerId} ${seasonId}: ${total} points (${getSeasonLevel(total).id}), peak ${peak} (${getSeasonLevel(peak).id})`);
}

if (!write) {
  console.log('Run again with --write to persist recalculated run points and season totals.');
}
