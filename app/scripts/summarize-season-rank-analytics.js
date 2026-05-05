import { query } from '../server/db.js';
import { getSeasonLevel } from '../shared/season-levels.js';

function pct(part, total) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

const seasonIdArg = process.argv.find((arg) => arg.startsWith('--season='));
const seasonId = seasonIdArg ? seasonIdArg.split('=')[1] : 'season_1';

const runs = await query(
  `SELECT points, level_id, wins, losses, completed_rounds, end_reason
   FROM player_season_runs
   WHERE season_id = $1`,
  [seasonId]
);

const progress = await query(
  `SELECT total_points, level_id, COALESCE(peak_points, total_points) AS peak_points,
          COALESCE(peak_level_id, level_id) AS peak_level_id
   FROM player_season_progress
   WHERE season_id = $1`,
  [seasonId]
);

const events = await query(
  `SELECT event, detail_json
   FROM client_events
   WHERE event IN ('season_rank_change', 'season_tier_up', 'achievement_unlock')`,
  []
);
const opponentKinds = await query(
  `SELECT b.opponent_kind, COUNT(*) AS rounds
   FROM game_rounds gr
   JOIN battles b ON b.id = gr.battle_id
   GROUP BY b.opponent_kind
   ORDER BY rounds DESC`,
  []
);
const repeatedOpponents = await query(
  `SELECT player_id, opponent_player_id, COUNT(*) AS rounds
   FROM game_rounds
   WHERE opponent_player_id IS NOT NULL
   GROUP BY player_id, opponent_player_id
   HAVING COUNT(*) > 1
   ORDER BY rounds DESC
   LIMIT 10`,
  []
);

const runRows = runs.rows;
const totalRuns = runRows.length;
const abandons = runRows.filter((row) => row.end_reason === 'abandoned').length;
const demotions = events.rows.filter((row) => {
  try {
    return row.event === 'season_rank_change' && JSON.parse(row.detail_json || '{}').direction === 'down';
  } catch {
    return false;
  }
}).length;
const rankUps = events.rows.filter((row) => row.event === 'season_tier_up').length;
const totalPoints = runRows.reduce((sum, row) => sum + Number(row.points || 0), 0);
const negativeRuns = runRows.filter((row) => Number(row.points || 0) < 0).length;
const byPeak = new Map();
for (const row of progress.rows) {
  const peakPoints = Math.max(Number(row.peak_points || 0), Number(row.total_points || 0));
  const key = getSeasonLevel(peakPoints).id;
  byPeak.set(key, (byPeak.get(key) || 0) + 1);
}

console.log(`Season rank analytics: ${seasonId}`);
console.log(`finished runs: ${totalRuns}`);
console.log(`avg points/run: ${totalRuns ? (totalPoints / totalRuns).toFixed(2) : '0.00'}`);
console.log(`negative runs: ${negativeRuns} (${pct(negativeRuns, totalRuns)})`);
console.log(`abandons: ${abandons} (${pct(abandons, totalRuns)})`);
console.log(`client rank-ups: ${rankUps}`);
console.log(`client demotions: ${demotions}`);
console.log('peak rank distribution:');
for (const rank of ['bronze', 'silver', 'gold', 'diamond']) {
  console.log(`  ${rank}: ${byPeak.get(rank) || 0}`);
}
console.log('opponent kind distribution:');
for (const row of opponentKinds.rows) {
  console.log(`  ${row.opponent_kind}: ${row.rounds}`);
}
if (repeatedOpponents.rowCount) {
  console.log('repeated real-opponent pairs:');
  for (const row of repeatedOpponents.rows) {
    console.log(`  ${row.player_id} vs ${row.opponent_player_id}: ${row.rounds} rounds`);
  }
}
