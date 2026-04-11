import { query, withTransaction } from '../db.js';
import {
  getArtifactById,
  getMushroomById,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  mushrooms
} from '../game-data.js';
import {
  computeLevel,
  createId,
  nowIso
} from '../lib/utils.js';
import { createBattle } from './battle-service.js';
import { createBotGhostSnapshot, createBotLoadout } from './bot-loadout.js';
import { createRng } from '../lib/utils.js';
import { validateLoadoutItems } from './loadout-utils.js';

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
  const [playerResult, settingsResult, activeResult, loadoutResult, loadoutItemsResult, playerMushroomsResult] =
    await Promise.all([
      query('SELECT * FROM players WHERE id = $1', [playerId]),
      query('SELECT * FROM player_settings WHERE player_id = $1', [playerId]),
      query('SELECT * FROM player_active_character WHERE player_id = $1', [playerId]),
      query('SELECT * FROM player_artifact_loadouts WHERE player_id = $1', [playerId]),
      query(
        `SELECT items.*, loadouts.player_id
         FROM player_artifact_loadout_items items
         JOIN player_artifact_loadouts loadouts ON loadouts.id = items.loadout_id
         WHERE loadouts.player_id = $1
         ORDER BY items.sort_order ASC`,
        [playerId]
      ),
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
  const loadout = loadoutResult.rowCount
    ? {
        id: loadoutResult.rows[0].id,
        mushroomId: loadoutResult.rows[0].mushroom_id,
        gridWidth: loadoutResult.rows[0].grid_width,
        gridHeight: loadoutResult.rows[0].grid_height,
        items: loadoutItemsResult.rows.map((row) => ({
          artifactId: row.artifact_id,
          x: row.x,
          y: row.y,
          width: row.width,
          height: row.height,
          sortOrder: row.sort_order
        }))
      }
    : null;

  const progression = Object.fromEntries(
    playerMushroomsResult.rows.map((row) => {
      const level = computeLevel(row.mycelium);
      return [
        row.mushroom_id,
        {
          mushroomId: row.mushroom_id,
          mycelium: row.mycelium,
          level: level.level,
          currentLevelMycelium: level.current,
          nextLevelMycelium: level.next,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws
        }
      ];
    })
  );

  return {
    player,
    settings,
    activeMushroomId,
    loadout,
    progression
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

  // First-time character pick → seed a full-budget starter loadout so the player
  // enters round 1 at max coin efficiency, not with an empty inventory. Uses the
  // bot loadout generator which respects the mushroom's affinity (damage/armor/stun).
  const existingLoadout = await query(
    `SELECT id FROM player_artifact_loadouts WHERE player_id = $1`,
    [playerId]
  );
  if (!existingLoadout.rowCount) {
    const rng = createRng(`${playerId}:starter:${mushroomId}`);
    const loadout = createBotLoadout(mushroom, rng, MAX_ARTIFACT_COINS);
    await saveArtifactLoadout(playerId, mushroomId, loadout.items, MAX_ARTIFACT_COINS);
  }

  return getPlayerState(playerId);
}

export async function saveArtifactLoadout(playerId, mushroomId, items, coinBudget = MAX_ARTIFACT_COINS) {
  if (!getMushroomById(mushroomId)) {
    throw new Error('Unknown mushroom');
  }
  const normalizedItems = items.map((item, index) => {
    const artifact = getArtifactById(item.artifactId);
    const isBag = artifact?.family === 'bag';
    // Bags and bagged items have no grid position — use 0,0 as a sentinel.
    const hasPosition = !item.bagId && !isBag && item.x !== undefined && item.y !== undefined;
    return {
      artifactId: item.artifactId,
      x: hasPosition ? Number(item.x) : 0,
      y: hasPosition ? Number(item.y) : 0,
      width: Number(item.width),
      height: Number(item.height),
      sortOrder: index,
      bagId: item.bagId || null
    };
  });
  validateLoadoutItems(normalizedItems, coinBudget);

  return withTransaction(async (client) => {
    const existing = await client.query(`SELECT * FROM player_artifact_loadouts WHERE player_id = $1`, [playerId]);
    const timestamp = nowIso();
    let loadoutId = existing.rowCount ? existing.rows[0].id : createId('loadout');

    if (existing.rowCount) {
      await client.query(
        `UPDATE player_artifact_loadouts
         SET mushroom_id = $2, updated_at = $3
         WHERE player_id = $1`,
        [playerId, mushroomId, timestamp]
      );
      await client.query(`DELETE FROM player_artifact_loadout_items WHERE loadout_id = $1`, [loadoutId]);
    } else {
      await client.query(
        `INSERT INTO player_artifact_loadouts
         (id, player_id, mushroom_id, grid_width, grid_height, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 1, $6, $6)`,
        [loadoutId, playerId, mushroomId, INVENTORY_COLUMNS, INVENTORY_ROWS, timestamp]
      );
    }

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO player_artifact_loadout_items
         (id, loadout_id, artifact_id, x, y, width, height, sort_order, bag_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [createId('loadoutitem'), loadoutId, item.artifactId, item.x, item.y, item.width, item.height, item.sortOrder, item.bagId || null]
      );
    }

    await client.query(
      `INSERT INTO player_active_character (player_id, mushroom_id)
       VALUES ($1, $2)
       ON CONFLICT (player_id) DO UPDATE SET mushroom_id = excluded.mushroom_id`,
      [playerId, mushroomId]
    );

    return getPlayerState(playerId);
  });
}

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

export async function createFriendChallenge(playerId, inviteePlayerId) {
  return withTransaction(async (client) => {
    const challenge = {
      id: createId('challenge'),
      challengeToken: createId('challink'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    await client.query(
      `INSERT INTO friend_challenges
       (id, challenge_token, challenger_player_id, invitee_player_id, status, created_at, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
      [
        challenge.id,
        challenge.challengeToken,
        playerId,
        inviteePlayerId,
        challenge.createdAt.toISOString(),
        challenge.expiresAt.toISOString()
      ]
    );
    return {
      id: challenge.id,
      challengeToken: challenge.challengeToken,
      challengerPlayerId: playerId,
      inviteePlayerId,
      status: 'pending',
      createdAt: challenge.createdAt.toISOString(),
      expiresAt: challenge.expiresAt.toISOString(),
      acceptedAt: null,
      battleId: null
    };
  });
}

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
    challengeType: challenge.challenge_type || 'battle',
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

  if (challenge.challengeType === 'run') {
    // Lazy import to avoid circular dependency
    const { createChallengeRun } = await import('./run-service.js');
    return createChallengeRun(challenge.challengerPlayerId, challenge.inviteePlayerId, challenge.id);
  }

  return createBattle(challenge.challengerPlayerId, {
    mode: 'friend',
    friendChallengeId: challenge.id,
    opponentPlayerId: challenge.inviteePlayerId,
    idempotencyKey: `challenge:${challenge.id}`
  });
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
