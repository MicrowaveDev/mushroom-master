import { query } from '../../server/db.js';
import { getSeasonEndReward, getSeasonLevel } from '../../shared/season-levels.js';

const seasonIdArg = process.argv.find((arg) => arg.startsWith('--season='));
const seasonId = seasonIdArg ? seasonIdArg.split('=')[1] : 'season_1';
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Math.max(1, Math.min(200, Number(limitArg?.split('=')[1] || 25)));

const rows = await query(
  `SELECT p.id AS player_id, p.name, p.telegram_username,
          COALESCE(psp.total_points, 0) AS total_points,
          COALESCE(psp.level_id, 'bronze') AS level_id,
          COALESCE(psp.peak_points, psp.total_points, 0) AS peak_points,
          COALESCE(psp.peak_level_id, psp.level_id, 'bronze') AS peak_level_id,
          COUNT(psr.id) AS finished_runs,
          COALESCE(SUM(CASE WHEN psr.points > 0 THEN psr.points ELSE 0 END), 0) AS positive_points,
          COALESCE(SUM(CASE WHEN psr.points < 0 THEN psr.points ELSE 0 END), 0) AS negative_points
   FROM players p
   LEFT JOIN player_season_progress psp
     ON psp.player_id = p.id AND psp.season_id = $1
   LEFT JOIN player_season_runs psr
     ON psr.player_id = p.id AND psr.season_id = $1
   GROUP BY p.id, p.name, p.telegram_username, p.created_at, psp.total_points, psp.level_id, psp.peak_points, psp.peak_level_id
   ORDER BY COALESCE(psp.peak_points, psp.total_points, 0) DESC,
            COALESCE(psp.total_points, 0) DESC,
            p.created_at ASC
   LIMIT $2`,
  [seasonId, limit]
);

console.log(`Season rank debug: ${seasonId}`);
console.log('rank | player | current | peak | runs | +/- | peak reward');
rows.rows.forEach((row, index) => {
  const currentLevel = getSeasonLevel(Number(row.total_points || 0)).id;
  const peakPoints = Math.max(Number(row.peak_points || 0), Number(row.total_points || 0));
  const peakLevel = getSeasonLevel(peakPoints).id;
  const reward = getSeasonEndReward(peakLevel);
  const name = row.telegram_username ? `@${row.telegram_username}` : row.name;
  console.log(
    `${String(index + 1).padStart(4)} | ${name} | ${row.total_points} ${currentLevel} | ${peakPoints} ${peakLevel} | ${row.finished_runs} | +${row.positive_points}/${row.negative_points} | ${reward.spore} spore, ${reward.mycelium} mycelium`
  );
});
