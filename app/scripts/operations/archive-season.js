import { query } from '../../server/db.js';
import { createId, nowIso } from '../../server/lib/utils.js';
import { grantCurrencyForPlayer } from '../../server/services/wallet-service.js';
import { getSeasonEndReward, getSeasonLevel } from '../../shared/season-levels.js';

const write = process.argv.includes('--write');
const seasonIdArg = process.argv.find((arg) => arg.startsWith('--season='));
const seasonId = seasonIdArg ? seasonIdArg.split('=')[1] : 'season_1';

const progress = await query(
  `SELECT player_id, season_id, total_points, level_id,
          COALESCE(peak_points, total_points) AS peak_points,
          COALESCE(peak_level_id, level_id) AS peak_level_id
   FROM player_season_progress
   WHERE season_id = $1
   ORDER BY COALESCE(peak_points, total_points) DESC, total_points DESC`,
  [seasonId]
);

const rows = progress.rows.map((row) => {
  const finalPoints = Number(row.total_points || 0);
  const peakPoints = Math.max(Number(row.peak_points || 0), finalPoints);
  const finalLevelId = getSeasonLevel(finalPoints).id;
  const peakLevelId = getSeasonLevel(peakPoints).id;
  const reward = getSeasonEndReward(peakLevelId);
  return {
    playerId: row.player_id,
    seasonId: row.season_id,
    finalPoints,
    finalLevelId,
    peakPoints,
    peakLevelId,
    reward
  };
});

if (write) {
  const archivedAt = nowIso();
  for (const row of rows) {
    const existing = await query(
      `SELECT id FROM player_season_archives WHERE player_id = $1 AND season_id = $2`,
      [row.playerId, row.seasonId]
    );
    if (existing.rowCount) continue;
    await query(
      `INSERT INTO player_season_archives
       (id, player_id, season_id, final_points, final_level_id, peak_points, peak_level_id,
        reward_spore, reward_mycelium, archived_at, reward_claimed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [
        createId('seasonarchive'),
        row.playerId,
        row.seasonId,
        row.finalPoints,
        row.finalLevelId,
        row.peakPoints,
        row.peakLevelId,
        row.reward.spore,
        row.reward.mycelium,
        archivedAt
      ]
    );
    if (row.reward.spore) {
      await grantCurrencyForPlayer({
        playerId: row.playerId,
        amount: row.reward.spore,
        reason: 'season_archive_reward',
        sourceType: 'player_season_archive',
        sourceId: `${row.playerId}:${row.seasonId}`,
        idempotencyKey: `season_archive:${row.playerId}:${row.seasonId}:spore`,
        metadata: { seasonId: row.seasonId, peakLevelId: row.peakLevelId }
      });
    }
    if (row.reward.mycelium) {
      const active = await query(
        `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
        [row.playerId]
      );
      const mushroomId = active.rows[0]?.mushroom_id || null;
      if (mushroomId) {
        await query(
          `UPDATE player_mushrooms
           SET mycelium = mycelium + $3, updated_at = $4
           WHERE player_id = $1 AND mushroom_id = $2`,
          [row.playerId, mushroomId, row.reward.mycelium, archivedAt]
        );
      }
    }
  }
}

console.log(`${write ? 'Archived' : 'Dry run'} ${rows.length} player season rows for ${seasonId}.`);
for (const row of rows) {
  console.log(`${row.playerId}: final ${row.finalPoints} ${row.finalLevelId}, peak ${row.peakPoints} ${row.peakLevelId}, reward ${row.reward.spore} spore / ${row.reward.mycelium} mycelium`);
}
if (!write) {
  console.log('Run again with --write to archive and grant peak-rank rewards once.');
}
