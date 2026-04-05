import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import {
  artifacts,
  BATTLE_ROUND_CAP,
  DAILY_BATTLE_LIMIT,
  getArtifactById,
  getArtifactPrice,
  getMushroomById,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_ARTIFACT_PIECES,
  MAX_STUN_CHANCE,
  mushrooms,
  rewardTable
} from '../game-data.js';
import {
  clamp,
  computeLevel,
  createId,
  createRng,
  dayKey,
  expectedScore,
  kFactor,
  nextUtcReset,
  nowIso,
  parseJson
} from '../lib/utils.js';

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

function buildArtifactSummary(items) {
  const totals = {
    damage: 0,
    armor: 0,
    speed: 0,
    stunChance: 0
  };

  for (const item of items) {
    const artifact = getArtifactById(item.artifactId || item.artifact_id);
    if (!artifact) {
      continue;
    }
    totals.damage += artifact.bonus.damage || 0;
    totals.armor += artifact.bonus.armor || 0;
    totals.speed += artifact.bonus.speed || 0;
    totals.stunChance += artifact.bonus.stunChance || 0;
  }

  totals.stunChance = clamp(totals.stunChance, 0, MAX_STUN_CHANCE);
  return totals;
}

export function validateLoadoutItems(items) {
  if (!Array.isArray(items)) {
    throw new Error('Loadout items must be an array');
  }
  if (items.length > MAX_ARTIFACT_PIECES) {
    throw new Error(`Loadout cannot contain more than ${MAX_ARTIFACT_PIECES} artifacts`);
  }

  const occupied = new Set();
  const artifactIds = new Set();
  let totalCoins = 0;

  for (const item of items) {
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (artifactIds.has(item.artifactId)) {
      throw new Error('Duplicate artifacts are not allowed');
    }
    artifactIds.add(item.artifactId);
    totalCoins += getArtifactPrice(artifact);
    const matchesCanonical = item.width === artifact.width && item.height === artifact.height;
    const matchesRotated = item.width === artifact.height && item.height === artifact.width;
    if (!matchesCanonical && !matchesRotated) {
      throw new Error('Stored artifact dimensions must match canonical definitions');
    }
    if (item.x < 0 || item.y < 0 || item.x + item.width > INVENTORY_COLUMNS || item.y + item.height > INVENTORY_ROWS) {
      throw new Error('Artifact placement is out of bounds');
    }

    for (let dx = 0; dx < item.width; dx += 1) {
      for (let dy = 0; dy < item.height; dy += 1) {
        const key = `${item.x + dx}:${item.y + dy}`;
        if (occupied.has(key)) {
          throw new Error('Artifact placements cannot overlap');
        }
        occupied.add(key);
      }
    }
  }

  if (totalCoins > MAX_ARTIFACT_COINS) {
    throw new Error(`Loadout exceeds ${MAX_ARTIFACT_COINS}-coin budget (cost ${totalCoins})`);
  }

  return {
    items,
    totals: buildArtifactSummary(items),
    totalCoins
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
  if (!getMushroomById(mushroomId)) {
    throw new Error('Unknown mushroom');
  }
  await query(
    `INSERT INTO player_active_character (player_id, mushroom_id)
     VALUES ($1, $2)
     ON CONFLICT (player_id) DO UPDATE SET mushroom_id = excluded.mushroom_id`,
    [playerId, mushroomId]
  );
  return getPlayerState(playerId);
}

export async function saveArtifactLoadout(playerId, mushroomId, items) {
  if (!getMushroomById(mushroomId)) {
    throw new Error('Unknown mushroom');
  }
  const normalizedItems = items.map((item, index) => ({
    artifactId: item.artifactId,
    x: Number(item.x),
    y: Number(item.y),
    width: Number(item.width),
    height: Number(item.height),
    sortOrder: index
  }));
  validateLoadoutItems(normalizedItems);

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
         (id, loadout_id, artifact_id, x, y, width, height, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [createId('loadoutitem'), loadoutId, item.artifactId, item.x, item.y, item.width, item.height, item.sortOrder]
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

function deriveCombatant(snapshot, side) {
  const mushroom = getMushroomById(snapshot.mushroomId);
  const artifactTotals = buildArtifactSummary(snapshot.loadout.items);
  const base = mushroom.baseStats;
  return {
    side,
    playerId: snapshot.playerId,
    name: mushroom.name,
    mushroomId: mushroom.id,
    styleTag: mushroom.styleTag,
    passive: mushroom.passive,
    active: mushroom.active,
    maxHealth: base.health,
    currentHealth: base.health,
    baseAttack: base.attack,
    baseSpeed: base.speed,
    baseDefense: base.defense,
    attack: base.attack + artifactTotals.damage,
    speed: base.speed + artifactTotals.speed,
    defense: base.defense + artifactTotals.armor,
    stunChance: artifactTotals.stunChance,
    artifactTotals,
    loadout: snapshot.loadout,
    state: {
      pendingDamageBuff: 0,
      receivedFirstHit: false,
      pendingArmorBonus: 0,
      successfulHitCount: 0,
      defensePenalty: 0,
      firstActionDone: false,
      stunned: false,
      wasStunnedByPreviousEnemyTurn: false,
      kirtRoundBoostReady: false
    }
  };
}

function combatState(left, right) {
  return {
    left: summarizeCombatant(left),
    right: summarizeCombatant(right)
  };
}

function summarizeCombatant(combatant) {
  return {
    side: combatant.side,
    playerId: combatant.playerId,
    mushroomId: combatant.mushroomId,
    name: combatant.name,
    currentHealth: combatant.currentHealth,
    maxHealth: combatant.maxHealth,
    attack: combatant.attack,
    speed: combatant.speed,
    defense: combatant.defense,
    stunChance: combatant.stunChance,
    stunned: combatant.state.stunned,
    loadout: combatant.loadout
  };
}

function randomInt(rng, max) {
  return Math.floor(rng() * max);
}

function shuffleWithRng(items, rng) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function artifactWeightForBot(mushroom, artifact) {
  if (mushroom.affinity.strong.includes(artifact.family)) {
    return 5;
  }
  if (mushroom.affinity.medium.includes(artifact.family)) {
    return 3;
  }
  if (mushroom.affinity.weak.includes(artifact.family)) {
    return 1;
  }
  return 2;
}

function pickUniqueArtifactsForBot(mushroom, rng) {
  const pool = [...artifacts];
  const selected = [];
  let remainingCoins = MAX_ARTIFACT_COINS;
  while (selected.length < MAX_ARTIFACT_PIECES && pool.length && remainingCoins > 0) {
    const affordable = pool.filter((artifact) => getArtifactPrice(artifact) <= remainingCoins);
    if (!affordable.length) {
      break;
    }
    const totalWeight = affordable.reduce(
      (sum, artifact) => sum + artifactWeightForBot(mushroom, artifact),
      0
    );
    let cursor = rng() * totalWeight;
    let chosen = affordable[0];
    for (const artifact of affordable) {
      cursor -= artifactWeightForBot(mushroom, artifact);
      if (cursor <= 0) {
        chosen = artifact;
        break;
      }
    }
    remainingCoins -= getArtifactPrice(chosen);
    pool.splice(pool.indexOf(chosen), 1);
    selected.push(chosen);
  }
  return selected;
}

function canPlaceArtifact(candidate, occupied) {
  for (let dx = 0; dx < candidate.width; dx += 1) {
    for (let dy = 0; dy < candidate.height; dy += 1) {
      if (occupied.has(`${candidate.x + dx}:${candidate.y + dy}`)) {
        return false;
      }
    }
  }
  return true;
}

function markOccupied(candidate, occupied) {
  for (let dx = 0; dx < candidate.width; dx += 1) {
    for (let dy = 0; dy < candidate.height; dy += 1) {
      occupied.add(`${candidate.x + dx}:${candidate.y + dy}`);
    }
  }
}

function createBotLoadout(mushroom, rng) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const chosenArtifacts = pickUniqueArtifactsForBot(mushroom, rng);
    const placementOrder = shuffleWithRng(
      [...chosenArtifacts].sort((left, right) => right.width * right.height - left.width * left.height),
      rng
    );
    const occupied = new Set();
    const placements = [];

    let success = true;
    for (const artifact of placementOrder) {
      const positions = [];
      for (let y = 0; y <= INVENTORY_ROWS - artifact.height; y += 1) {
        for (let x = 0; x <= INVENTORY_COLUMNS - artifact.width; x += 1) {
          positions.push({ x, y });
        }
      }
      const shuffledPositions = shuffleWithRng(positions, rng);
      const found = shuffledPositions.find((position) =>
        canPlaceArtifact({ ...position, width: artifact.width, height: artifact.height }, occupied)
      );
      if (!found) {
        success = false;
        break;
      }

      const placement = {
        artifactId: artifact.id,
        x: found.x,
        y: found.y,
        width: artifact.width,
        height: artifact.height,
        sortOrder: placements.length
      };
      markOccupied(placement, occupied);
      placements.push(placement);
    }

    if (success && placements.length === chosenArtifacts.length && placements.length > 0) {
      placements.sort((left, right) => left.sortOrder - right.sortOrder);
      validateLoadoutItems(placements);
      return {
        gridWidth: INVENTORY_COLUMNS,
        gridHeight: INVENTORY_ROWS,
        items: placements
      };
    }
  }

  throw new Error('Could not generate bot loadout');
}

function createBotGhostSnapshot(seedInput, mushroomId = null) {
  const rng = createRng(`${seedInput}:bot`);
  const mushroom = mushroomId ? getMushroomById(mushroomId) : mushrooms[randomInt(rng, mushrooms.length)];
  return {
    playerId: null,
    mushroomId: mushroom.id,
    loadout: createBotLoadout(mushroom, rng)
  };
}

function computeRoundOrder(left, right, rng) {
  const leftSpeed = left.speed + (left.mushroomId === 'kirt' && left.state.kirtRoundBoostReady ? 1 : 0);
  const rightSpeed = right.speed + (right.mushroomId === 'kirt' && right.state.kirtRoundBoostReady ? 1 : 0);

  if (leftSpeed === rightSpeed) {
    if (left.baseSpeed === right.baseSpeed) {
      if (left.mushroomId === 'morga' && right.mushroomId !== 'morga') {
        return [left, right];
      }
      if (right.mushroomId === 'morga' && left.mushroomId !== 'morga') {
        return [right, left];
      }
      return rng() >= 0.5 ? [left, right] : [right, left];
    }
    return left.baseSpeed > right.baseSpeed ? [left, right] : [right, left];
  }

  return leftSpeed > rightSpeed ? [left, right] : [right, left];
}

function resolveAction(attacker, defender, round, rng, events) {
  if (attacker.currentHealth <= 0 || defender.currentHealth <= 0) {
    return;
  }

  if (attacker.state.stunned) {
    attacker.state.stunned = false;
    events.push({
      type: 'skip',
      round,
      actorSide: attacker.side,
      targetSide: defender.side,
      narration: `${attacker.name.en} is stunned and loses the turn.`,
      state: combatState(attacker.side === 'left' ? attacker : defender, attacker.side === 'right' ? attacker : defender)
    });
    defender.state.wasStunnedByPreviousEnemyTurn = false;
    return;
  }

  let attackDamage = attacker.attack + attacker.state.pendingDamageBuff;
  let armorIgnore = 0;
  let attackStunChance = attacker.stunChance;
  let narration = '';

  switch (attacker.mushroomId) {
    case 'thalla':
      attackStunChance += 5;
      narration = 'Spore Lash';
      break;
    case 'lomie':
      attacker.state.pendingArmorBonus += 2;
      narration = 'Settling Guard';
      break;
    case 'axilin':
      attackDamage += 2;
      attacker.defense -= 1;
      attacker.state.defensePenalty += 1;
      narration = 'Ferment Burst';
      break;
    case 'kirt':
      armorIgnore = 2;
      narration = 'Clean Strike';
      break;
    case 'morga':
      attackStunChance += 10;
      narration = 'Flash Cap';
      break;
    default:
      narration = 'Attack';
      break;
  }

  if (attacker.mushroomId === 'morga' && !attacker.state.firstActionDone) {
    attackDamage += 4;
  }
  if (attacker.mushroomId === 'axilin') {
    attacker.state.successfulHitCount += 1;
    if (attacker.state.successfulHitCount % 3 === 0) {
      attackDamage += 3;
    }
  }

  const defenseValue = Math.max(0, defender.defense + defender.state.pendingArmorBonus - armorIgnore);
  let resolvedDamage = Math.max(1, attackDamage - defenseValue);
  if (defender.mushroomId === 'lomie' && !defender.state.receivedFirstHit) {
    resolvedDamage = Math.max(1, resolvedDamage - 3);
  }

  defender.currentHealth = Math.max(0, defender.currentHealth - resolvedDamage);
  defender.state.receivedFirstHit = true;
  defender.state.pendingArmorBonus = 0;
  attacker.state.firstActionDone = true;
  attacker.state.pendingDamageBuff = 0;

  const roll = rng() * 100;
  const stunned = roll < Math.min(MAX_STUN_CHANCE, Math.max(0, attackStunChance));
  if (stunned && defender.currentHealth > 0) {
    defender.state.stunned = true;
    defender.state.wasStunnedByPreviousEnemyTurn = true;
    if (attacker.mushroomId === 'thalla') {
      attacker.state.pendingDamageBuff = 2;
    }
  } else {
    defender.state.wasStunnedByPreviousEnemyTurn = false;
  }

  if (attacker.mushroomId === 'kirt') {
    attacker.state.kirtRoundBoostReady = false;
  }
  if (defender.mushroomId === 'kirt' && !defender.state.wasStunnedByPreviousEnemyTurn) {
    defender.state.kirtRoundBoostReady = true;
  }

  const left = attacker.side === 'left' ? attacker : defender;
  const right = attacker.side === 'right' ? attacker : defender;

  events.push({
    type: 'action',
    round,
    actorSide: attacker.side,
    targetSide: defender.side,
    actionName: narration,
    damage: resolvedDamage,
    stunned,
    narration: `${attacker.name.en} uses ${narration} for ${resolvedDamage} damage${stunned ? ' and stuns the target' : ''}.`,
    state: combatState(left, right)
  });
}

function simulateBattle(snapshot, seed) {
  const left = deriveCombatant(snapshot.left, 'left');
  const right = deriveCombatant(snapshot.right, 'right');
  const rng = createRng(seed);
  const events = [
    {
      type: 'battle_start',
      round: 0,
      narration: `${left.name.en} faces ${right.name.en}.`,
      state: combatState(left, right)
    }
  ];
  let winnerSide = null;

  for (let round = 1; round <= BATTLE_ROUND_CAP; round += 1) {
    events.push({
      type: 'round_start',
      round,
      narration: `Round ${round} begins.`,
      state: combatState(left, right)
    });

    const [first, second] = computeRoundOrder(left, right, rng);
    resolveAction(first, second, round, rng, events);
    if (second.currentHealth <= 0) {
      winnerSide = first.side;
      break;
    }
    resolveAction(second, first, round, rng, events);
    if (first.currentHealth <= 0) {
      winnerSide = second.side;
      break;
    }
  }

  let outcome = 'draw';
  if (!winnerSide) {
    const leftPct = left.currentHealth / left.maxHealth;
    const rightPct = right.currentHealth / right.maxHealth;
    if (leftPct > rightPct) {
      winnerSide = 'left';
    } else if (rightPct > leftPct) {
      winnerSide = 'right';
    } else {
      const leftDamageDealt = right.maxHealth - right.currentHealth;
      const rightDamageDealt = left.maxHealth - left.currentHealth;
      if (leftDamageDealt > rightDamageDealt) {
        winnerSide = 'left';
      } else if (rightDamageDealt > leftDamageDealt) {
        winnerSide = 'right';
      }
    }
  }

  if (winnerSide) {
    outcome = winnerSide === 'left' ? 'win' : 'loss';
  }

  events.push({
    type: 'battle_end',
    round: BATTLE_ROUND_CAP,
    winnerSide,
    outcome,
    narration: winnerSide ? `${winnerSide === 'left' ? left.name.en : right.name.en} wins.` : 'The battle ends in a draw.',
    state: combatState(left, right)
  });

  return {
    winnerSide,
    outcome,
    leftState: summarizeCombatant(left),
    rightState: summarizeCombatant(right),
    events
  };
}

async function getActiveSnapshot(client, playerId) {
  const [activeResult, loadoutResult, loadoutItemsResult] = await Promise.all([
    client.query(`SELECT * FROM player_active_character WHERE player_id = $1`, [playerId]),
    client.query(`SELECT * FROM player_artifact_loadouts WHERE player_id = $1`, [playerId]),
    client.query(
      `SELECT items.*
       FROM player_artifact_loadout_items items
       JOIN player_artifact_loadouts loadouts ON loadouts.id = items.loadout_id
       WHERE loadouts.player_id = $1
       ORDER BY items.sort_order ASC`,
      [playerId]
    )
  ]);

  if (!activeResult.rowCount) {
    throw new Error('Active mushroom not selected');
  }
  if (!loadoutResult.rowCount) {
    throw new Error('Artifact loadout not saved');
  }

  const items = loadoutItemsResult.rows.map((row) => ({
    artifactId: row.artifact_id,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order
  }));
  validateLoadoutItems(items);
  const mushroomId = activeResult.rows[0].mushroom_id;

  return {
    playerId,
    mushroomId,
    loadout: {
      gridWidth: INVENTORY_COLUMNS,
      gridHeight: INVENTORY_ROWS,
      items
    }
  };
}

async function getRandomGhostSnapshot(client, playerId, seedInput) {
  const rng = createRng(`${seedInput}:ghost`);
  const targetMushroom = mushrooms[randomInt(rng, mushrooms.length)];
  const result = await client.query(
    `SELECT DISTINCT loadouts.player_id
     FROM player_artifact_loadouts loadouts
     JOIN player_active_character active ON active.player_id = loadouts.player_id
     WHERE loadouts.player_id <> $1
       AND active.mushroom_id = $2`,
    [playerId, targetMushroom.id]
  );
  const candidateIds = shuffleWithRng(
    result.rows.map((row) => row.player_id),
    rng
  );

  for (const candidateId of candidateIds) {
    try {
      return getActiveSnapshot(client, candidateId);
    } catch {
    }
  }

  return createBotGhostSnapshot(seedInput, targetMushroom.id);
}

async function getDailyUsage(client, playerId) {
  const currentDay = dayKey(new Date());
  const usageResult = await client.query(
    `SELECT battle_starts FROM daily_rate_limits WHERE player_id = $1 AND day_key = $2`,
    [playerId, currentDay]
  );
  return usageResult.rowCount ? Number(usageResult.rows[0].battle_starts) : 0;
}

function resolveBattleRewards(initiatorResult, scope) {
  const leftOutcome = initiatorResult.winnerSide === 'left' ? 'win' : initiatorResult.winnerSide === 'right' ? 'loss' : 'draw';
  const rightOutcome = initiatorResult.winnerSide === 'right' ? 'win' : initiatorResult.winnerSide === 'left' ? 'loss' : 'draw';

  return {
    left: {
      outcome: leftOutcome,
      reward: rewardTable[leftOutcome]
    },
    right: {
      outcome: rightOutcome,
      reward: rewardTable[rightOutcome]
    },
    scope
  };
}

async function applyBattleRewards(client, battle, leftSnapshot, rightSnapshot, simulation, rewardScope) {
  const rewards = resolveBattleRewards(simulation, rewardScope);
  const leftPlayerResult = await client.query('SELECT * FROM players WHERE id = $1', [leftSnapshot.playerId]);
  const rightPlayerResult = rightSnapshot.playerId
    ? await client.query('SELECT * FROM players WHERE id = $1', [rightSnapshot.playerId])
    : { rowCount: 0, rows: [] };

  const leftPlayer = leftPlayerResult.rows[0];
  const rightPlayer = rightPlayerResult.rowCount ? rightPlayerResult.rows[0] : null;

  const writes = [
    {
      player: leftPlayer,
      snapshot: leftSnapshot,
      result: rewards.left,
      counts: rewardScope === 'two_sided' || rewardScope === 'one_sided' ? true : false
    }
  ];

  if (rightPlayer && rewardScope === 'two_sided') {
    writes.push({
      player: rightPlayer,
      snapshot: rightSnapshot,
      result: rewards.right,
      counts: true
    });
  }

  for (const entry of writes) {
    const actualScore = entry.result.outcome === 'win' ? 1 : entry.result.outcome === 'draw' ? 0.5 : 0;
    const opponentRating = entry.player.id === leftPlayer.id ? (rightPlayer?.rating ?? leftPlayer.rating) : leftPlayer.rating;
    const ratingBefore = entry.player.rating;
    const ratingAfter = entry.counts
      ? Math.round(
          ratingBefore +
            kFactor(ratingBefore, entry.player.rated_battle_count) *
              (actualScore - expectedScore(ratingBefore, opponentRating))
        )
      : ratingBefore;

    const winsDelta = entry.result.outcome === 'win' ? 1 : 0;
    const lossesDelta = entry.result.outcome === 'loss' ? 1 : 0;
    const drawsDelta = entry.result.outcome === 'draw' ? 1 : 0;
    const sporeDelta = entry.result.reward.spore;
    const myceliumDelta = entry.result.reward.mycelium;

    await client.query(
      `UPDATE players
       SET spore = spore + $2,
           rating = $3,
           rated_battle_count = rated_battle_count + $4,
           wins = wins + $5,
           losses = losses + $6,
           draws = draws + $7,
           updated_at = $8
       WHERE id = $1`,
      [
        entry.player.id,
        sporeDelta,
        ratingAfter,
        entry.counts ? 1 : 0,
        entry.counts ? winsDelta : 0,
        entry.counts ? lossesDelta : 0,
        entry.counts ? drawsDelta : 0,
        nowIso()
      ]
    );

    await client.query(
      `UPDATE player_mushrooms
       SET mycelium = mycelium + $3,
           wins = wins + $4,
           losses = losses + $5,
           draws = draws + $6
       WHERE player_id = $1 AND mushroom_id = $2`,
      [
        entry.player.id,
        entry.snapshot.mushroomId,
        myceliumDelta,
        entry.counts ? winsDelta : 0,
        entry.counts ? lossesDelta : 0,
        entry.counts ? drawsDelta : 0
      ]
    );

    await client.query(
      `INSERT INTO battle_rewards
       (id, battle_id, player_id, mushroom_id, spore_delta, mycelium_delta, rating_before, rating_after, wins_delta, losses_delta, draws_delta, reward_scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        createId('reward'),
        battle.id,
        entry.player.id,
        entry.snapshot.mushroomId,
        sporeDelta,
        myceliumDelta,
        ratingBefore,
        ratingAfter,
        entry.counts ? winsDelta : 0,
        entry.counts ? lossesDelta : 0,
        entry.counts ? drawsDelta : 0,
        rewardScope
      ]
    );
  }
}

export async function createBattle(playerId, payload = {}) {
  return withTransaction(async (client) => {
    const usage = await getDailyUsage(client, playerId);
    if (usage >= DAILY_BATTLE_LIMIT) {
      throw new Error('Daily battle limit reached');
    }

    const idempotencyKey = payload.idempotencyKey || crypto.randomUUID();
    const previous = await client.query(
      `SELECT * FROM battle_requests WHERE player_id = $1 AND idempotency_key = $2`,
      [playerId, idempotencyKey]
    );
    if (previous.rowCount && previous.rows[0].battle_id) {
      return getBattle(previous.rows[0].battle_id, playerId);
    }
    if (!previous.rowCount) {
      await client.query(
        `INSERT INTO battle_requests (id, player_id, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4)`,
        [createId('breq'), playerId, idempotencyKey, nowIso()]
      );
    }

    const leftSnapshot = await getActiveSnapshot(client, playerId);
    const battleSeed = payload.seed || crypto.randomBytes(16).toString('hex');
    const isFriendAccepted = payload.mode === 'friend' && payload.friendChallengeId;
    const rightSnapshot = isFriendAccepted
      ? await getActiveSnapshot(client, payload.opponentPlayerId)
      : await getRandomGhostSnapshot(client, playerId, battleSeed);

    const simulation = simulateBattle({ left: leftSnapshot, right: rightSnapshot }, battleSeed);
    const battle = {
      id: createId('battle'),
      mode: isFriendAccepted ? 'friend' : 'ghost',
      initiatorPlayerId: playerId,
      opponentPlayerId: rightSnapshot.playerId || null,
      opponentKind: isFriendAccepted ? 'friend_live' : rightSnapshot.playerId ? 'ghost_snapshot' : 'ghost_bot',
      ratedScope: isFriendAccepted ? 'two_sided' : 'one_sided',
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
        battle.id,
        battle.mode,
        battle.initiatorPlayerId,
        battle.opponentPlayerId,
        battle.opponentKind,
        battle.ratedScope,
        battle.battleSeed,
        battle.outcome,
        battle.winnerSide,
        payload.friendChallengeId || null,
        battle.createdAt
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
          createId('snapshot'),
          battle.id,
          entry.side,
          entry.snapshot.playerId || null,
          entry.snapshot.mushroomId,
          mushroom.name.en,
          JSON.stringify(entry.snapshot)
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

    await applyBattleRewards(client, battle, leftSnapshot, rightSnapshot, simulation, battle.ratedScope);

    const currentDay = dayKey(new Date());
    await client.query(
      `INSERT INTO daily_rate_limits (player_id, day_key, battle_starts)
       VALUES ($1, $2, 1)
       ON CONFLICT (player_id, day_key)
       DO UPDATE SET battle_starts = daily_rate_limits.battle_starts + 1`,
      [playerId, currentDay]
    );

    await client.query(
      `UPDATE battle_requests
       SET battle_id = $3
       WHERE player_id = $1 AND idempotency_key = $2`,
      [playerId, idempotencyKey, battle.id]
    );

    if (payload.friendChallengeId) {
      await client.query(
        `UPDATE friend_challenges
         SET status = 'accepted', accepted_at = $2, battle_id = $3
         WHERE id = $1`,
        [payload.friendChallengeId, nowIso(), battle.id]
      );
    }

    return getBattle(battle.id, playerId, client);
  });
}

export async function getBattle(battleId, viewerPlayerId, existingClient = null) {
  const runner = existingClient || { query: (sql, params) => query(sql, params) };
  const [battleResult, snapshotResult, eventResult, rewardResult] = await Promise.all([
    runner.query(`SELECT * FROM battles WHERE id = $1`, [battleId]),
    runner.query(`SELECT * FROM battle_snapshots WHERE battle_id = $1 ORDER BY side ASC`, [battleId]),
    runner.query(`SELECT * FROM battle_events WHERE battle_id = $1 ORDER BY event_index ASC`, [battleId]),
    runner.query(`SELECT * FROM battle_rewards WHERE battle_id = $1 ORDER BY player_id ASC`, [battleId])
  ]);

  if (!battleResult.rowCount) {
    throw new Error('Battle not found');
  }

  const battle = battleResult.rows[0];
  const snapshots = Object.fromEntries(
    snapshotResult.rows.map((row) => [row.side, parseJson(row.payload_json, {})])
  );

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

export async function getBattleHistory(playerId) {
  const result = await query(
    `SELECT * FROM battles
     WHERE initiator_player_id = $1 OR opponent_player_id = $1
     ORDER BY created_at DESC`,
    [playerId]
  );
  return Promise.all(result.rows.map((row) => getBattle(row.id, playerId)));
}

export async function getBootstrap(playerId) {
  const state = await getPlayerState(playerId);
  const history = await getBattleHistory(playerId);
  const dailyUsage = await query(
    `SELECT battle_starts FROM daily_rate_limits WHERE player_id = $1 AND day_key = $2`,
    [playerId, dayKey(new Date())]
  );
  return {
    ...state,
    mushrooms,
    artifacts,
    battleLimit: {
      used: dailyUsage.rowCount ? Number(dailyUsage.rows[0].battle_starts) : 0,
      limit: DAILY_BATTLE_LIMIT,
      nextResetAt: nextUtcReset(new Date()).toISOString()
    },
    battleHistory: history.slice(0, 10)
  };
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
    battleId: challenge.battle_id
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
  await query(`UPDATE friend_challenges SET status = 'declined' WHERE id = $1`, [challengeId]);
  return getFriendChallenge(challengeId);
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
