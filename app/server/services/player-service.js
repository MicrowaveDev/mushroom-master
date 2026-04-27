import { query, withTransaction } from '../db.js';
import {
  getMushroomById,
  getTier,
  mushrooms,
  PORTRAIT_VARIANTS,
  portraitVariantsForResponse,
  STARTER_PRESET_VARIANTS
} from '../game-data.js';
import {
  computeLevel,
  createId,
  nowIso
} from '../lib/utils.js';
import { createBotGhostSnapshot } from './bot-loadout.js';

function rowToPlayerProfile(row) {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    telegramUsername: row.telegram_username,
    name: row.name,
    lang: row.lang,
    spore: row.spore,
    rating: row.rating,
    ratedBattleCount: row.rated_battle_count,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    friendCode: row.friend_code
  };
}

export async function getPlayerState(playerId) {
  const [playerResult, settingsResult, activeResult, playerMushroomsResult] =
    await Promise.all([
      query('SELECT * FROM players WHERE id = $1', [playerId]),
      query('SELECT * FROM player_settings WHERE player_id = $1', [playerId]),
      query('SELECT * FROM player_active_character WHERE player_id = $1', [playerId]),
      query('SELECT * FROM player_mushrooms WHERE player_id = $1 ORDER BY mushroom_id ASC', [playerId])
    ]);

  if (!playerResult.rowCount) {
    throw new Error('Unknown player');
  }

  const player = rowToPlayerProfile(playerResult.rows[0]);
  const settings = settingsResult.rowCount
    ? {
        lang: settingsResult.rows[0].lang,
        reducedMotion: Boolean(settingsResult.rows[0].reduced_motion),
        battleSpeed: settingsResult.rows[0].battle_speed
      }
    : { lang: player.lang, reducedMotion: false, battleSpeed: '1x' };

  const activeMushroomId = activeResult.rowCount ? activeResult.rows[0].mushroom_id : null;
  // Legacy `loadout` field (read from player_artifact_loadouts) deleted
  // 2026-04-13. The active loadout now lives in game_run_loadout_items
  // and is exposed via getActiveGameRun.
  const loadout = null;

  // Pull portrait variants with mtime-stamped URLs once per request — any
  // portrait file replaced on disk between requests shows up on the next
  // /api/bootstrap without a server restart.
  const freshPortraitVariants = portraitVariantsForResponse();

  const progression = Object.fromEntries(
    playerMushroomsResult.rows.map((row) => {
      const levelInfo = computeLevel(row.mycelium);
      const level = levelInfo.level;

      const portraitVariants = freshPortraitVariants[row.mushroom_id] || [];
      const activePortraitId = row.active_portrait || 'default';
      const activePortraitDef = portraitVariants.find(v => v.id === activePortraitId) || portraitVariants[0];

      const presetVariants = STARTER_PRESET_VARIANTS[row.mushroom_id] || [];
      const activePresetId = row.active_preset || 'default';

      return [
        row.mushroom_id,
        {
          mushroomId: row.mushroom_id,
          mycelium: row.mycelium,
          level,
          tier: getTier(level),
          currentLevelMycelium: levelInfo.current,
          nextLevelMycelium: levelInfo.next,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          activePortrait: activePortraitId,
          activePortraitUrl: activePortraitDef?.path || '',
          portraits: portraitVariants.map(v => ({ ...v, unlocked: row.mycelium >= v.cost })),
          activePreset: activePresetId,
          presets: presetVariants.map(v => ({ ...v, unlocked: level >= v.requiredLevel }))
        }
      ];
    })
  );

  const seasonResult = await query(
    `SELECT * FROM player_season_progress WHERE player_id = $1 AND season_id = 'season_1'`,
    [playerId]
  );
  const recentAchievementsResult = await query(
    `SELECT achievement_id, earned_at
     FROM player_achievements
     WHERE player_id = $1
     ORDER BY earned_at DESC
     LIMIT 6`,
    [playerId]
  );
  const achievementsResult = await query(
    `SELECT achievement_id, season_id, earned_at
     FROM player_achievements
     WHERE player_id = $1
     ORDER BY earned_at DESC`,
    [playerId]
  );
  const achievements = achievementsResult.rows.map((row) => ({
    id: row.achievement_id,
    seasonId: row.season_id,
    earnedAt: row.earned_at
  }));
  const season = seasonResult.rowCount
    ? {
        seasonId: seasonResult.rows[0].season_id,
        totalPoints: seasonResult.rows[0].total_points,
        levelId: seasonResult.rows[0].level_id,
        updatedAt: seasonResult.rows[0].updated_at,
        achievements,
        recentAchievements: recentAchievementsResult.rows.map((row) => ({
          id: row.achievement_id,
          earnedAt: row.earned_at
        }))
      }
    : {
        seasonId: 'season_1',
        totalPoints: 0,
        levelId: 'bronze',
        updatedAt: null,
        achievements,
        recentAchievements: []
      };

  return {
    player,
    settings,
    activeMushroomId,
    loadout,
    progression,
    season
  };
}

export async function updateSettings(playerId, payload) {
  const lang = payload.lang === 'en' ? 'en' : 'ru';
  const reducedMotion = payload.reducedMotion ? 1 : 0;
  const battleSpeed = ['1x', '2x'].includes(payload.battleSpeed) ? payload.battleSpeed : '1x';
  await query(
    `UPDATE player_settings
     SET lang = $2, reduced_motion = $3, battle_speed = $4
     WHERE player_id = $1`,
    [playerId, lang, reducedMotion, battleSpeed]
  );
  await query(`UPDATE players SET lang = $2, updated_at = $3 WHERE id = $1`, [playerId, lang, nowIso()]);
  return getPlayerState(playerId);
}

export async function selectActiveMushroom(playerId, mushroomId) {
  const mushroom = getMushroomById(mushroomId);
  if (!mushroom) {
    throw new Error('Unknown mushroom');
  }
  await query(
    `INSERT INTO player_active_character (player_id, mushroom_id)
     VALUES ($1, $2)
     ON CONFLICT (player_id) DO UPDATE SET mushroom_id = excluded.mushroom_id`,
    [playerId, mushroomId]
  );

  // The legacy starter-preset seeding into player_artifact_loadouts was
  // deleted in 2026-04-13. The character's preset is now seeded by
  // startGameRun / createChallengeRun directly into game_run_loadout_items
  // when the player begins their first run.

  return getPlayerState(playerId);
}

// saveArtifactLoadout (legacy single-battle loadout writer) deleted
// 2026-04-13. Run-scoped placements flow through applyRunLoadoutPlacements
// in run-service.js.

export async function addFriendByCode(playerId, friendCode) {
  return withTransaction(async (client) => {
    const playerResult = await client.query(`SELECT * FROM players WHERE friend_code = $1`, [friendCode]);
    if (!playerResult.rowCount) {
      throw new Error('Friend code not found');
    }
    const target = playerResult.rows[0];
    if (target.id === playerId) {
      throw new Error('You cannot add yourself');
    }
    const [low, high] = [playerId, target.id].sort();
    await client.query(
      `INSERT INTO friendships (id, player_low_id, player_high_id, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_low_id, player_high_id) DO NOTHING`,
      [createId('friendship'), low, high, nowIso()]
    );
    return getFriends(playerId);
  });
}

export async function getFriends(playerId) {
  const result = await query(
    `SELECT players.*
     FROM friendships
     JOIN players ON players.id = CASE
       WHEN friendships.player_low_id = $1 THEN friendships.player_high_id
       ELSE friendships.player_low_id
     END
     WHERE friendships.player_low_id = $1 OR friendships.player_high_id = $1
     ORDER BY players.name ASC`,
    [playerId]
  );
  return result.rows.map(rowToPlayerProfile);
}

// createFriendChallenge (legacy single-battle invite) deleted 2026-04-13.
// All challenges now go through createRunChallenge below; the
// POST /api/friends/challenges endpoint routes to it directly.

export async function getFriendChallenge(challengeId) {
  const result = await query(`SELECT * FROM friend_challenges WHERE id = $1`, [challengeId]);
  if (!result.rowCount) {
    throw new Error('Challenge not found');
  }
  const challenge = result.rows[0];
  return {
    id: challenge.id,
    challengeToken: challenge.challenge_token,
    challengerPlayerId: challenge.challenger_player_id,
    inviteePlayerId: challenge.invitee_player_id,
    status: challenge.status,
    createdAt: challenge.created_at,
    expiresAt: challenge.expires_at,
    acceptedAt: challenge.accepted_at,
    battleId: challenge.battle_id,
    challengeType: challenge.challenge_type || 'run',
    gameRunId: challenge.game_run_id || null
  };
}

export async function acceptFriendChallenge(challengeId, playerId) {
  const challenge = await getFriendChallenge(challengeId);
  if (challenge.inviteePlayerId !== playerId) {
    throw new Error('Only the invited player can accept this challenge');
  }
  if (challenge.status !== 'pending') {
    throw new Error('Challenge is no longer pending');
  }
  if (challenge.expiresAt && new Date(challenge.expiresAt) < new Date()) {
    throw new Error('Challenge has expired');
  }

  // All challenges are run challenges now (the legacy single-battle
  // 'battle' type was deleted 2026-04-13). Lazy import to avoid the
  // player-service ↔ run-service circular dependency.
  const { createChallengeRun } = await import('./run-service.js');
  return createChallengeRun(challenge.challengerPlayerId, challenge.inviteePlayerId, challenge.id);
}

export async function declineFriendChallenge(challengeId, playerId) {
  const challenge = await getFriendChallenge(challengeId);
  if (challenge.inviteePlayerId !== playerId) {
    throw new Error('Only the invited player can decline this challenge');
  }
  if (challenge.status !== 'pending') {
    throw new Error('Challenge is no longer pending');
  }
  await query(`UPDATE friend_challenges SET status = 'declined' WHERE id = $1`, [challengeId]);
  return getFriendChallenge(challengeId);
}

export async function createRunChallenge(playerId, inviteePlayerId) {
  return withTransaction(async (client) => {
    const [low, high] = [playerId, inviteePlayerId].sort();
    const friendResult = await client.query(
      `SELECT id FROM friendships WHERE player_low_id = $1 AND player_high_id = $2`,
      [low, high]
    );
    if (!friendResult.rowCount) {
      throw new Error('You can only challenge friends');
    }

    const activeA = await client.query(
      `SELECT id FROM game_run_players WHERE player_id = $1 AND is_active = 1`, [playerId]
    );
    if (activeA.rowCount) {
      throw new Error('You already have an active game run');
    }
    const activeB = await client.query(
      `SELECT id FROM game_run_players WHERE player_id = $1 AND is_active = 1`, [inviteePlayerId]
    );
    if (activeB.rowCount) {
      throw new Error('The invited player already has an active game run');
    }

    const challenge = {
      id: createId('challenge'),
      challengeToken: createId('challink'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    };

    await client.query(
      `INSERT INTO friend_challenges
       (id, challenge_token, challenger_player_id, invitee_player_id, status, challenge_type, created_at, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', 'run', $5, $6)`,
      [
        challenge.id, challenge.challengeToken, playerId, inviteePlayerId,
        challenge.createdAt.toISOString(), challenge.expiresAt.toISOString()
      ]
    );

    return {
      id: challenge.id,
      challengeToken: challenge.challengeToken,
      challengerPlayerId: playerId,
      inviteePlayerId,
      status: 'pending',
      challengeType: 'run',
      createdAt: challenge.createdAt.toISOString(),
      expiresAt: challenge.expiresAt.toISOString()
    };
  });
}

export async function getLeaderboard() {
  const result = await query(
    `SELECT *
     FROM players
     ORDER BY rating DESC, wins DESC, losses ASC, created_at ASC
     LIMIT 100`
  );
  return result.rows.map((row, index) => ({
    rank: index + 1,
    ...rowToPlayerProfile(row)
  }));
}

export async function saveLocalTestRun(payload) {
  const row = {
    id: createId('testrun'),
    createdAt: nowIso(),
    payloadJson: JSON.stringify(payload)
  };
  await query(
    `INSERT INTO local_test_runs (id, created_at, payload_json)
     VALUES ($1, $2, $3)`,
    [row.id, row.createdAt, row.payloadJson]
  );
  return row;
}

export async function getInventoryReviewSamples() {
  return mushrooms.flatMap((mushroom) =>
    [0, 1].map((variantIndex) => {
      const snapshot = createBotGhostSnapshot(`inventory-review:${mushroom.id}:${variantIndex}`, mushroom.id);
      return {
        id: `${mushroom.id}:${variantIndex}`,
        seed: `inventory-review:${mushroom.id}:${variantIndex}`,
        mushroomId: snapshot.mushroomId,
        loadout: snapshot.loadout
      };
    })
  );
}

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export async function switchPortrait(playerId, mushroomId, portraitId) {
  const variants = PORTRAIT_VARIANTS[mushroomId];
  if (!variants) throw httpError('Unknown mushroom', 404);
  const variant = variants.find(v => v.id === portraitId);
  if (!variant) throw httpError('Unknown portrait', 400);
  const row = await query(
    `SELECT mycelium FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
    [playerId, mushroomId]
  );
  const mycelium = row.rowCount ? row.rows[0].mycelium : 0;
  if (mycelium < variant.cost) throw httpError('Not enough mycelium', 403);
  await query(
    `UPDATE player_mushrooms SET active_portrait = $1 WHERE player_id = $2 AND mushroom_id = $3`,
    [portraitId, playerId, mushroomId]
  );
  return { portraitId, path: variant.path };
}

export async function switchPreset(playerId, mushroomId, presetId) {
  const variants = STARTER_PRESET_VARIANTS[mushroomId];
  if (!variants) throw httpError('Unknown mushroom', 404);
  const variant = variants.find(v => v.id === presetId);
  if (!variant) throw httpError('Unknown preset', 400);
  const row = await query(
    `SELECT mycelium FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
    [playerId, mushroomId]
  );
  const mycelium = row.rowCount ? row.rows[0].mycelium : 0;
  if (computeLevel(mycelium).level < variant.requiredLevel) throw httpError('Level too low', 403);
  await query(
    `UPDATE player_mushrooms SET active_preset = $1 WHERE player_id = $2 AND mushroom_id = $3`,
    [presetId, playerId, mushroomId]
  );
  return { presetId };
}
