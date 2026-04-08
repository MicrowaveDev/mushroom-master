import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import {
  artifacts,
  STEP_CAP,
  DAILY_BATTLE_LIMIT,
  getArtifactById,
  getArtifactPrice,
  getMushroomById,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_ROUNDS_PER_RUN,
  MAX_STUN_CHANCE,
  STARTING_LIVES,
  GHOST_BUDGET_DISCOUNT,
  RATING_FLOOR,
  ROUND_INCOME,
  SHOP_OFFER_SIZE,
  BAG_BASE_CHANCE,
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  bags,
  CHALLENGE_WINNER_BONUS,
  combatArtifacts,
  getCompletionBonus,
  getShopRefreshCost,
  mushrooms,
  rewardTable,
  runRewardTable
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
    if (!artifact || artifact.family === 'bag') {
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

export function validateLoadoutItems(items, coinBudget = MAX_ARTIFACT_COINS) {
  if (!Array.isArray(items)) {
    throw new Error('Loadout items must be an array');
  }
  const occupied = new Set();
  const artifactIds = new Set();
  let totalCoins = 0;

  // Separate grid items from bag-contained items
  const gridItems = items.filter((item) => !item.bagId);
  const baggedItems = items.filter((item) => item.bagId);

  // Track bag slot usage
  const bagSlotUsage = new Map();

  for (const item of gridItems) {
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

    if (artifact.family === 'bag') {
      bagSlotUsage.set(item.artifactId, 0);
    }
  }

  // Validate bag-contained items
  for (const item of baggedItems) {
    const artifact = getArtifactById(item.artifactId);
    if (!artifact) {
      throw new Error(`Unknown artifact: ${item.artifactId}`);
    }
    if (artifact.family === 'bag') {
      throw new Error('Bags cannot contain other bags');
    }
    if (artifactIds.has(item.artifactId)) {
      throw new Error('Duplicate artifacts are not allowed');
    }
    artifactIds.add(item.artifactId);
    totalCoins += getArtifactPrice(artifact);

    // Verify the bag exists in the loadout
    const bagArtifact = getArtifactById(item.bagId);
    if (!bagArtifact || bagArtifact.family !== 'bag') {
      throw new Error(`Invalid bag reference: ${item.bagId}`);
    }
    if (!bagSlotUsage.has(item.bagId)) {
      throw new Error(`Bag ${item.bagId} is not placed on the grid`);
    }

    // Only 1x1 items can go in bags (v1 rule)
    if (artifact.width !== 1 || artifact.height !== 1) {
      throw new Error('Only 1x1 artifacts can be placed inside bags');
    }

    const used = bagSlotUsage.get(item.bagId) + 1;
    if (used > bagArtifact.slotCount) {
      throw new Error(`Bag ${item.bagId} is full (${bagArtifact.slotCount} slots)`);
    }
    bagSlotUsage.set(item.bagId, used);
  }

  if (totalCoins > coinBudget) {
    throw new Error(`Loadout exceeds ${coinBudget}-coin budget (cost ${totalCoins})`);
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

export async function saveArtifactLoadout(playerId, mushroomId, items, coinBudget = MAX_ARTIFACT_COINS) {
  if (!getMushroomById(mushroomId)) {
    throw new Error('Unknown mushroom');
  }
  const normalizedItems = items.map((item, index) => ({
    artifactId: item.artifactId,
    x: item.bagId ? 0 : Number(item.x),
    y: item.bagId ? 0 : Number(item.y),
    width: Number(item.width),
    height: Number(item.height),
    sortOrder: index,
    bagId: item.bagId || null
  }));
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

function pickUniqueArtifactsForBot(mushroom, rng, budget = MAX_ARTIFACT_COINS) {
  const pool = [...artifacts];
  const selected = [];
  let remainingCoins = budget;
  while (selected.length < INVENTORY_COLUMNS * INVENTORY_ROWS && pool.length && remainingCoins > 0) {
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

function createBotLoadout(mushroom, rng, budget = MAX_ARTIFACT_COINS) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const chosenArtifacts = pickUniqueArtifactsForBot(mushroom, rng, budget);
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
      validateLoadoutItems(placements, budget);
      return {
        gridWidth: INVENTORY_COLUMNS,
        gridHeight: INVENTORY_ROWS,
        items: placements
      };
    }
  }

  throw new Error('Could not generate bot loadout');
}

function createBotGhostSnapshot(seedInput, mushroomId = null, budget = MAX_ARTIFACT_COINS) {
  const rng = createRng(`${seedInput}:bot`);
  const mushroom = mushroomId ? getMushroomById(mushroomId) : mushrooms[randomInt(rng, mushrooms.length)];
  return {
    playerId: null,
    mushroomId: mushroom.id,
    loadout: createBotLoadout(mushroom, rng, budget)
  };
}

function computeStepOrder(left, right, rng) {
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

function resolveAction(attacker, defender, step, rng, events) {
  if (attacker.currentHealth <= 0 || defender.currentHealth <= 0) {
    return;
  }

  if (attacker.state.stunned) {
    attacker.state.stunned = false;
    events.push({
      type: 'skip',
      step,
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
    step,
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
      step: 0,
      narration: `${left.name.en} faces ${right.name.en}.`,
      state: combatState(left, right)
    }
  ];
  let winnerSide = null;

  for (let step = 1; step <= STEP_CAP; step += 1) {
    events.push({
      type: 'step_start',
      step,
      narration: `Step ${step} begins.`,
      state: combatState(left, right)
    });

    const [first, second] = computeStepOrder(left, right, rng);
    resolveAction(first, second, step, rng, events);
    if (second.currentHealth <= 0) {
      winnerSide = first.side;
      break;
    }
    resolveAction(second, first, step, rng, events);
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
    step: STEP_CAP,
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

async function recordBattle(client, { leftSnapshot, rightSnapshot, simulation, battleSeed, mode, opponentKind, ratedScope, challengeId, initiatorPlayerId }) {
  const battle = {
    id: createId('battle'),
    mode,
    initiatorPlayerId,
    opponentPlayerId: rightSnapshot.playerId || null,
    opponentKind,
    ratedScope,
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
      battle.id, battle.mode, battle.initiatorPlayerId, battle.opponentPlayerId,
      battle.opponentKind, battle.ratedScope, battle.battleSeed, battle.outcome,
      battle.winnerSide, challengeId || null, battle.createdAt
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
        createId('snapshot'), battle.id, entry.side,
        entry.snapshot.playerId || null, entry.snapshot.mushroomId,
        mushroom.name.en, JSON.stringify(entry.snapshot)
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

  return battle;
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

    const battle = await recordBattle(client, {
      leftSnapshot, rightSnapshot, simulation, battleSeed,
      mode: isFriendAccepted ? 'friend' : 'ghost',
      opponentKind: isFriendAccepted ? 'friend_live' : rightSnapshot.playerId ? 'ghost_snapshot' : 'ghost_bot',
      ratedScope: isFriendAccepted ? 'two_sided' : 'one_sided',
      challengeId: payload.friendChallengeId,
      initiatorPlayerId: playerId
    });

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

export async function getShopState(playerId) {
  const result = await query(
    `SELECT payload_json FROM player_shop_state WHERE player_id = $1`,
    [playerId]
  );
  if (!result.rowCount) return null;
  return parseJson(result.rows[0].payload_json);
}

export async function saveShopState(playerId, payload) {
  const json = JSON.stringify(payload);
  await query(
    `INSERT INTO player_shop_state (player_id, payload_json, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id) DO UPDATE
     SET payload_json = $2, updated_at = $3`,
    [playerId, json, nowIso()]
  );
}

export async function getBootstrap(playerId) {
  const state = await getPlayerState(playerId);
  const history = await getBattleHistory(playerId);
  const [dailyUsage, shopState, activeGameRun] = await Promise.all([
    query(
      `SELECT battle_starts FROM daily_rate_limits WHERE player_id = $1 AND day_key = $2`,
      [playerId, dayKey(new Date())]
    ),
    getShopState(playerId),
    getActiveGameRun(playerId)
  ]);
  return {
    ...state,
    mushrooms,
    artifacts,
    shopState,
    activeGameRun,
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

  if (challenge.challengeType === 'run') {
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
  await query(`UPDATE friend_challenges SET status = 'declined' WHERE id = $1`, [challengeId]);
  return getFriendChallenge(challengeId);
}

export async function createRunChallenge(playerId, inviteePlayerId) {
  return withTransaction(async (client) => {
    // Verify friendship
    const [low, high] = [playerId, inviteePlayerId].sort();
    const friendResult = await client.query(
      `SELECT id FROM friendships WHERE player_low_id = $1 AND player_high_id = $2`,
      [low, high]
    );
    if (!friendResult.rowCount) {
      throw new Error('You can only challenge friends');
    }

    // Verify neither has an active run
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
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
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

async function createChallengeRun(challengerPlayerId, inviteePlayerId, challengeId) {
  return withTransaction(async (client) => {
    const runId = createId('run');
    const now = nowIso();
    const initialCoins = ROUND_INCOME[0];

    await client.query(
      `INSERT INTO game_runs (id, mode, status, current_round, started_at)
       VALUES ($1, 'challenge', 'active', 1, $2)`,
      [runId, now]
    );

    const players = [challengerPlayerId, inviteePlayerId];
    const playerResults = {};

    for (const pid of players) {
      const grpId = createId('grp');
      await client.query(
        `INSERT INTO game_run_players (id, game_run_id, player_id, is_active, completed_rounds, wins, losses, lives_remaining, coins)
         VALUES ($1, $2, $3, 1, 0, 0, 0, $4, $5)`,
        [grpId, runId, pid, STARTING_LIVES, initialCoins]
      );

      const rng = createRng(`${runId}:shop:1:${pid}`);
      const { offer: shopOffer, hasBag } = generateShopOffer(rng, SHOP_OFFER_SIZE, 1);
      await client.query(
        `INSERT INTO game_run_shop_states (id, game_run_id, player_id, round_number, refresh_count, rounds_since_bag, offer_json, updated_at)
         VALUES ($1, $2, $3, 1, 0, $4, $5, $6)`,
        [createId('shopstate'), runId, pid, hasBag ? 0 : 1, JSON.stringify(shopOffer), now]
      );

      const currentDay = dayKey(new Date());
      await client.query(
        `INSERT INTO daily_rate_limits (player_id, day_key, battle_starts)
         VALUES ($1, $2, 1)
         ON CONFLICT (player_id, day_key)
         DO UPDATE SET battle_starts = daily_rate_limits.battle_starts + 1`,
        [pid, currentDay]
      );

      playerResults[pid] = { id: grpId, playerId: pid, coins: initialCoins, shopOffer };
    }

    await client.query(
      `UPDATE friend_challenges SET status = 'accepted', accepted_at = $2, game_run_id = $3 WHERE id = $1`,
      [challengeId, now, runId]
    );

    return {
      id: runId,
      mode: 'challenge',
      status: 'active',
      currentRound: 1,
      startedAt: now,
      players: playerResults
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

function generateShopOffer(rng, count = SHOP_OFFER_SIZE, roundsSinceBag = 1) {
  const combatPool = [...combatArtifacts];
  const bagPool = [...bags];
  const offer = [];
  let hasBag = false;
  const perSlotChance = BAG_BASE_CHANCE + roundsSinceBag * BAG_ESCALATION_STEP;

  for (let i = 0; i < count; i++) {
    const forceBag = !hasBag && roundsSinceBag >= BAG_PITY_THRESHOLD && i === count - 1;
    const isBagSlot = forceBag || (bagPool.length > 0 && rng() < perSlotChance);

    if (isBagSlot && bagPool.length > 0) {
      const idx = Math.floor(rng() * bagPool.length);
      offer.push(bagPool[idx].id);
      bagPool.splice(idx, 1);
      hasBag = true;
    } else if (combatPool.length > 0) {
      const idx = Math.floor(rng() * combatPool.length);
      offer.push(combatPool[idx].id);
      combatPool.splice(idx, 1);
    }
  }

  return { offer, hasBag };
}

export async function startGameRun(playerId, mode = 'solo') {
  return withTransaction(async (client) => {
    const usage = await getDailyUsage(client, playerId);
    if (usage >= DAILY_BATTLE_LIMIT) {
      throw new Error('Daily battle limit reached');
    }

    const runId = createId('run');
    const now = nowIso();
    const initialCoins = ROUND_INCOME[0];

    await client.query(
      `INSERT INTO game_runs (id, mode, status, current_round, started_at)
       VALUES ($1, $2, 'active', 1, $3)`,
      [runId, mode, now]
    );

    const runPlayerId = createId('grp');
    await client.query(
      `INSERT INTO game_run_players (id, game_run_id, player_id, is_active, completed_rounds, wins, losses, lives_remaining, coins)
       VALUES ($1, $2, $3, 1, 0, 0, 0, $4, $5)`,
      [runPlayerId, runId, playerId, STARTING_LIVES, initialCoins]
    );

    const rng = createRng(`${runId}:shop:1`);
    const initialRoundsSinceBag = 1;
    const { offer: shopOffer, hasBag } = generateShopOffer(rng, SHOP_OFFER_SIZE, initialRoundsSinceBag);
    await client.query(
      `INSERT INTO game_run_shop_states (id, game_run_id, player_id, round_number, refresh_count, rounds_since_bag, offer_json, updated_at)
       VALUES ($1, $2, $3, 1, 0, $4, $5, $6)`,
      [createId('shopstate'), runId, playerId, hasBag ? 0 : initialRoundsSinceBag, JSON.stringify(shopOffer), now]
    );

    const currentDay = dayKey(new Date());
    await client.query(
      `INSERT INTO daily_rate_limits (player_id, day_key, battle_starts)
       VALUES ($1, $2, 1)
       ON CONFLICT (player_id, day_key)
       DO UPDATE SET battle_starts = daily_rate_limits.battle_starts + 1`,
      [playerId, currentDay]
    );

    return {
      id: runId,
      mode,
      status: 'active',
      currentRound: 1,
      startedAt: now,
      endedAt: null,
      endReason: null,
      shopOffer,
      player: {
        id: runPlayerId,
        playerId,
        completedRounds: 0,
        wins: 0,
        losses: 0,
        livesRemaining: STARTING_LIVES,
        coins: initialCoins
      }
    };
  });
}

export async function getActiveGameRun(playerId) {
  const result = await query(
    `SELECT gr.id, gr.mode, gr.status, gr.current_round, gr.started_at, gr.ended_at, gr.end_reason,
            grp.id AS grp_id, grp.completed_rounds, grp.wins, grp.losses, grp.lives_remaining, grp.coins
     FROM game_run_players grp
     JOIN game_runs gr ON gr.id = grp.game_run_id
     WHERE grp.player_id = $1 AND grp.is_active = 1`,
    [playerId]
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0];
  const roundsResult = await query(
    `SELECT id, round_number, battle_id, created_at FROM game_rounds WHERE game_run_id = $1 ORDER BY round_number ASC`,
    [row.id]
  );

  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    currentRound: row.current_round,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    player: {
      id: row.grp_id,
      playerId,
      completedRounds: row.completed_rounds,
      wins: row.wins,
      losses: row.losses,
      livesRemaining: row.lives_remaining,
      coins: row.coins
    },
    rounds: roundsResult.rows.map((r) => ({
      id: r.id,
      roundNumber: r.round_number,
      battleId: r.battle_id,
      createdAt: r.created_at
    }))
  };
}

async function payCompletionBonus(client, playerId, mushroomId, wins) {
  const bonus = getCompletionBonus(wins);
  if (bonus.spore > 0) {
    await client.query(
      `UPDATE players SET spore = spore + $2, updated_at = $3 WHERE id = $1`,
      [playerId, bonus.spore, nowIso()]
    );
  }
  if (bonus.mycelium > 0 && mushroomId) {
    await client.query(
      `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
      [playerId, mushroomId, bonus.mycelium]
    );
  }
  return bonus;
}

async function applyBatchElo(client, playerId, opponentRating, wins, losses) {
  if (wins + losses === 0) return null;
  const playerResult = await client.query('SELECT rating, rated_battle_count FROM players WHERE id = $1', [playerId]);
  if (!playerResult.rowCount) return null;
  const player = playerResult.rows[0];
  const actualScore = wins / (wins + losses);
  const k = kFactor(player.rating, player.rated_battle_count);
  const ratingAfter = Math.max(RATING_FLOOR, Math.round(
    player.rating + k * (actualScore - expectedScore(player.rating, opponentRating))
  ));
  await client.query(
    `UPDATE players SET rating = $2, rated_battle_count = rated_battle_count + 1, updated_at = $3 WHERE id = $1`,
    [playerId, ratingAfter, nowIso()]
  );
  return { ratingBefore: player.rating, ratingAfter };
}

export async function abandonGameRun(playerId, gameRunId) {
  return withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT * FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const run = runResult.rows[0];

    const allPlayersResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1`,
      [gameRunId]
    );
    const callerRow = allPlayersResult.rows.find((r) => r.player_id === playerId);
    if (!callerRow || !callerRow.is_active) {
      throw new Error('Player is not part of this game run');
    }

    // Pay completion bonus and batch Elo for all players in the run
    for (const grp of allPlayersResult.rows) {
      if (!grp.is_active) continue;

      const activeChar = await client.query(
        `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`,
        [grp.player_id]
      );
      const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : null;
      await payCompletionBonus(client, grp.player_id, mushroomId, grp.wins);

      // Batch Elo for challenge mode
      if (run.mode === 'challenge' && grp.wins + grp.losses > 0) {
        const opponent = allPlayersResult.rows.find((r) => r.player_id !== grp.player_id);
        const opponentRating = opponent
          ? ((await client.query('SELECT rating FROM players WHERE id = $1', [opponent.player_id])).rows[0]?.rating ?? 1000)
          : 1000;
        await applyBatchElo(client, grp.player_id, opponentRating, grp.wins, grp.losses);
      }
    }

    const now = nowIso();
    await client.query(
      `UPDATE game_runs SET status = 'abandoned', ended_at = $2, end_reason = 'abandoned' WHERE id = $1`,
      [gameRunId, now]
    );

    await client.query(
      `UPDATE game_run_players SET is_active = 0 WHERE game_run_id = $1`,
      [gameRunId]
    );

    return {
      id: gameRunId,
      mode: run.mode,
      status: 'abandoned',
      currentRound: run.current_round,
      startedAt: run.started_at,
      endedAt: now,
      endReason: 'abandoned',
      player: {
        id: callerRow.id,
        playerId,
        completedRounds: callerRow.completed_rounds,
        wins: callerRow.wins,
        losses: callerRow.losses,
        livesRemaining: callerRow.lives_remaining,
        coins: callerRow.coins
      }
    };
  });
}

export async function getGameRun(gameRunId, viewerPlayerId) {
  const runResult = await query(`SELECT * FROM game_runs WHERE id = $1`, [gameRunId]);
  if (!runResult.rowCount) {
    throw new Error('Game run not found');
  }
  const run = runResult.rows[0];

  const playersResult = await query(
    `SELECT * FROM game_run_players WHERE game_run_id = $1`,
    [gameRunId]
  );

  const viewerPlayer = playersResult.rows.find((r) => r.player_id === viewerPlayerId);
  if (!viewerPlayer) {
    throw new Error('You are not part of this game run');
  }

  const roundsResult = await query(
    `SELECT id, round_number, battle_id, created_at FROM game_rounds WHERE game_run_id = $1 ORDER BY round_number ASC`,
    [gameRunId]
  );

  return {
    id: run.id,
    mode: run.mode,
    status: run.status,
    currentRound: run.current_round,
    startedAt: run.started_at,
    endedAt: run.ended_at,
    endReason: run.end_reason,
    players: playersResult.rows.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      completedRounds: r.completed_rounds,
      wins: r.wins,
      losses: r.losses,
      livesRemaining: r.lives_remaining,
      coins: r.coins
    })),
    rounds: roundsResult.rows.map((r) => ({
      id: r.id,
      roundNumber: r.round_number,
      battleId: r.battle_id,
      createdAt: r.created_at
    }))
  };
}

async function getRunGhostSnapshot(client, playerId, gameRunId, roundNumber, ghostBudget) {
  const facedResult = await client.query(
    `SELECT DISTINCT opponent_player_id FROM game_rounds WHERE game_run_id = $1 AND opponent_player_id IS NOT NULL`,
    [gameRunId]
  );
  const facedIds = [...new Set(facedResult.rows.map((r) => r.opponent_player_id))];
  facedIds.push(playerId);

  const excludePlaceholders = facedIds.map((_, i) => `$${i + 2}`).join(', ');
  const snapshotResult = await client.query(
    `SELECT * FROM game_run_ghost_snapshots
     WHERE player_id NOT IN (${excludePlaceholders})
       AND total_coins <= $1
     ORDER BY RANDOM() LIMIT 1`,
    [ghostBudget, ...facedIds]
  );

  if (snapshotResult.rowCount) {
    const row = snapshotResult.rows[0];
    const payload = parseJson(row.payload_json);
    return {
      playerId: row.player_id,
      mushroomId: row.mushroom_id,
      loadout: payload.loadout
    };
  }

  // Try multiple seeds if bot generation fails for a specific RNG sequence
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const seed = `${gameRunId}:ghost:${roundNumber}:${attempt}`;
      return createBotGhostSnapshot(seed, null, Math.max(MAX_ARTIFACT_COINS, ghostBudget));
    } catch {
      continue;
    }
  }
  // Final fallback with default budget
  return createBotGhostSnapshot(`${gameRunId}:ghost:${roundNumber}:fallback`, null, MAX_ARTIFACT_COINS);
}

async function resolveChallengeRound(client, run, gameRunId) {
  const roundNumber = run.current_round;

  // Fetch both players
  const grpResult = await client.query(
    `SELECT * FROM game_run_players WHERE game_run_id = $1 AND is_active = 1 ORDER BY id ASC`,
    [gameRunId]
  );
  if (grpResult.rowCount !== 2) {
    throw new Error('Challenge run requires exactly 2 active players');
  }
  const [grpA, grpB] = grpResult.rows;

  // Get snapshots for both players
  const snapshotA = await getActiveSnapshot(client, grpA.player_id);
  const snapshotB = await getActiveSnapshot(client, grpB.player_id);

  // Run one duel: player A = left, player B = right
  const battleSeed = crypto.randomBytes(16).toString('hex');
  const simulation = simulateBattle({ left: snapshotA, right: snapshotB }, battleSeed);

  if (!simulation.winnerSide) {
    simulation.winnerSide = 'right';
    simulation.outcome = 'loss';
  }

  const battle = await recordBattle(client, {
    leftSnapshot: snapshotA, rightSnapshot: snapshotB, simulation, battleSeed,
    mode: 'run_challenge',
    opponentKind: 'player',
    ratedScope: 'none',
    challengeId: null,
    initiatorPlayerId: grpA.player_id
  });

  const outcomeA = simulation.winnerSide === 'left' ? 'win' : 'loss';
  const outcomeB = simulation.winnerSide === 'right' ? 'win' : 'loss';

  const playerResults = {};

  for (const [grp, snapshot, outcome, opponentId] of [
    [grpA, snapshotA, outcomeA, grpB.player_id],
    [grpB, snapshotB, outcomeB, grpA.player_id]
  ]) {
    const rewards = runRewardTable[outcome];
    const roundIncome = roundNumber < MAX_ROUNDS_PER_RUN ? ROUND_INCOME[roundNumber] : 0;

    await client.query(
      `INSERT INTO game_rounds (id, game_run_id, round_number, battle_id, player_id, outcome, opponent_player_id, spore_awarded, mycelium_awarded, rating_before, rating_after, coins_income, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL, $10, $11)`,
      [
        createId('ground'), gameRunId, roundNumber, battle.id, grp.player_id,
        outcome, opponentId, rewards.spore, rewards.mycelium, roundIncome, nowIso()
      ]
    );

    const newLives = outcome === 'loss' ? grp.lives_remaining - 1 : grp.lives_remaining;
    const newWins = outcome === 'win' ? grp.wins + 1 : grp.wins;
    const newLosses = outcome === 'loss' ? grp.losses + 1 : grp.losses;
    const completedRounds = grp.completed_rounds + 1;
    const newCoins = grp.coins + roundIncome;

    await client.query(
      `UPDATE game_run_players SET completed_rounds = $2, wins = $3, losses = $4, lives_remaining = $5, coins = $6 WHERE id = $1`,
      [grp.id, completedRounds, newWins, newLosses, newLives, newCoins]
    );

    // Pay per-round rewards (no Elo per round in challenge mode)
    await client.query(
      `UPDATE players SET spore = spore + $2, updated_at = $3 WHERE id = $1`,
      [grp.player_id, rewards.spore, nowIso()]
    );

    const activeChar = await client.query(
      `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`, [grp.player_id]
    );
    const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : snapshot.mushroomId;

    await client.query(
      `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
      [grp.player_id, mushroomId, rewards.mycelium]
    );

    playerResults[grp.player_id] = {
      completedRounds,
      wins: newWins,
      losses: newLosses,
      livesRemaining: newLives,
      coins: newCoins,
      mushroomId,
      lastRound: {
        roundNumber,
        battleId: battle.id,
        outcome,
        rewards
      }
    };
  }

  // Check end conditions: either player eliminated or max rounds
  const anyEliminated = Object.values(playerResults).some((p) => p.livesRemaining <= 0);
  const maxRounds = Object.values(playerResults).every((p) => p.completedRounds >= MAX_ROUNDS_PER_RUN);
  const runEnded = anyEliminated || maxRounds;
  let endReason = null;

  if (runEnded) {
    endReason = anyEliminated ? 'max_losses' : 'max_rounds';

    // Determine winner for challenge bonus
    const pA = playerResults[grpA.player_id];
    const pB = playerResults[grpB.player_id];
    const winnerPlayerId = pA.losses < pB.losses ? grpA.player_id : pB.losses < pA.losses ? grpB.player_id : null;

    for (const [grp, pr] of [[grpA, pA], [grpB, pB]]) {
      await payCompletionBonus(client, grp.player_id, pr.mushroomId, pr.wins);

      // Batch Elo
      const opponentGrp = grp === grpA ? grpB : grpA;
      const opponentRating = (await client.query('SELECT rating FROM players WHERE id = $1', [opponentGrp.player_id])).rows[0]?.rating ?? 1000;
      await applyBatchElo(client, grp.player_id, opponentRating, pr.wins, pr.losses);

      // Winner bonus
      if (winnerPlayerId === grp.player_id) {
        await client.query(
          `UPDATE players SET spore = spore + $2, updated_at = $3 WHERE id = $1`,
          [grp.player_id, CHALLENGE_WINNER_BONUS.spore, nowIso()]
        );
        await client.query(
          `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
          [grp.player_id, pr.mushroomId, CHALLENGE_WINNER_BONUS.mycelium]
        );
      }
    }

    await client.query(
      `UPDATE game_runs SET status = 'completed', ended_at = $2, end_reason = $3 WHERE id = $1`,
      [gameRunId, nowIso(), endReason]
    );
    await client.query(
      `UPDATE game_run_players SET is_active = 0 WHERE game_run_id = $1`,
      [gameRunId]
    );
  } else {
    await client.query(
      `UPDATE game_runs SET current_round = current_round + 1 WHERE id = $1`,
      [gameRunId]
    );
    const nextRound = roundNumber + 1;
    for (const grp of [grpA, grpB]) {
      const shopState = await client.query(
        `SELECT rounds_since_bag FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
        [gameRunId, grp.player_id]
      );
      const prevRoundsSinceBag = shopState.rowCount ? shopState.rows[0].rounds_since_bag : 1;
      const newRoundsSinceBag = prevRoundsSinceBag + 1;
      const shopRng = createRng(`${gameRunId}:shop:${nextRound}:${grp.player_id}`);
      const { offer: newOffer, hasBag } = generateShopOffer(shopRng, SHOP_OFFER_SIZE, newRoundsSinceBag);
      await client.query(
        `UPDATE game_run_shop_states SET round_number = $2, refresh_count = 0, rounds_since_bag = $3, offer_json = $4, updated_at = $5
         WHERE game_run_id = $1 AND player_id = $6`,
        [gameRunId, nextRound, hasBag ? 0 : newRoundsSinceBag, JSON.stringify(newOffer), nowIso(), grp.player_id]
      );
    }
  }

  return {
    id: gameRunId,
    mode: 'challenge',
    status: runEnded ? 'completed' : 'active',
    currentRound: runEnded ? roundNumber : roundNumber + 1,
    endedAt: runEnded ? nowIso() : null,
    endReason,
    runEnded,
    playerResults
  };
}

export async function resolveRound(playerId, gameRunId) {
  return withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT * FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const run = runResult.rows[0];

    if (run.mode === 'challenge') {
      return resolveChallengeRound(client, run, gameRunId);
    }

    const grpResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this game run');
    }
    const grp = grpResult.rows[0];

    if (grp.completed_rounds >= MAX_ROUNDS_PER_RUN) {
      throw new Error('All rounds completed');
    }
    if (grp.lives_remaining <= 0) {
      throw new Error('No lives remaining');
    }

    const roundNumber = run.current_round;

    const leftSnapshot = await getActiveSnapshot(client, playerId);
    const ghostBudget = Math.max(MAX_ARTIFACT_COINS, Math.floor(grp.coins * (1 - GHOST_BUDGET_DISCOUNT)));
    const rightSnapshot = await getRunGhostSnapshot(client, playerId, gameRunId, roundNumber, ghostBudget);

    const battleSeed = crypto.randomBytes(16).toString('hex');
    const simulation = simulateBattle({ left: leftSnapshot, right: rightSnapshot }, battleSeed);

    if (!simulation.winnerSide) {
      simulation.winnerSide = 'right';
      simulation.outcome = 'loss';
    }

    const outcome = simulation.winnerSide === 'left' ? 'win' : 'loss';

    const battle = await recordBattle(client, {
      leftSnapshot, rightSnapshot, simulation, battleSeed,
      mode: 'run_solo',
      opponentKind: rightSnapshot.playerId ? 'ghost_snapshot' : 'ghost_bot',
      ratedScope: 'one_sided',
      challengeId: null,
      initiatorPlayerId: playerId
    });

    const rewards = runRewardTable[outcome];
    const playerResult = await client.query('SELECT rating, rated_battle_count FROM players WHERE id = $1', [playerId]);
    const player = playerResult.rows[0];
    const opponentRating = rightSnapshot.playerId
      ? ((await client.query('SELECT rating FROM players WHERE id = $1', [rightSnapshot.playerId])).rows[0]?.rating ?? player.rating)
      : player.rating;

    const actualScore = outcome === 'win' ? 1 : 0;
    const k = kFactor(player.rating, player.rated_battle_count, 'solo_run');
    const ratingAfter = Math.max(RATING_FLOOR, Math.round(
      player.rating + k * (actualScore - expectedScore(player.rating, opponentRating))
    ));

    const roundIncome = roundNumber < MAX_ROUNDS_PER_RUN ? ROUND_INCOME[roundNumber] : 0;
    await client.query(
      `INSERT INTO game_rounds (id, game_run_id, round_number, battle_id, player_id, outcome, opponent_player_id, spore_awarded, mycelium_awarded, rating_before, rating_after, coins_income, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        createId('ground'), gameRunId, roundNumber, battle.id, playerId,
        outcome, rightSnapshot.playerId || null,
        rewards.spore, rewards.mycelium,
        player.rating, ratingAfter, roundIncome, nowIso()
      ]
    );

    const newLives = outcome === 'loss' ? grp.lives_remaining - 1 : grp.lives_remaining;
    const newWins = outcome === 'win' ? grp.wins + 1 : grp.wins;
    const newLosses = outcome === 'loss' ? grp.losses + 1 : grp.losses;
    const completedRounds = grp.completed_rounds + 1;
    const newCoins = grp.coins + roundIncome;

    await client.query(
      `UPDATE game_run_players SET completed_rounds = $2, wins = $3, losses = $4, lives_remaining = $5, coins = $6 WHERE id = $1`,
      [grp.id, completedRounds, newWins, newLosses, newLives, newCoins]
    );

    await client.query(
      `UPDATE players SET spore = spore + $2, rating = $3, rated_battle_count = rated_battle_count + 1, updated_at = $4 WHERE id = $1`,
      [playerId, rewards.spore, ratingAfter, nowIso()]
    );

    const activeChar = await client.query(
      `SELECT mushroom_id FROM player_active_character WHERE player_id = $1`, [playerId]
    );
    const mushroomId = activeChar.rowCount ? activeChar.rows[0].mushroom_id : leftSnapshot.mushroomId;

    await client.query(
      `UPDATE player_mushrooms SET mycelium = mycelium + $3 WHERE player_id = $1 AND mushroom_id = $2`,
      [playerId, mushroomId, rewards.mycelium]
    );

    await client.query(
      `INSERT INTO game_run_ghost_snapshots (id, game_run_id, player_id, round_number, mushroom_id, payload_json, total_coins, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [createId('ghost'), gameRunId, playerId, roundNumber, leftSnapshot.mushroomId,
       JSON.stringify({ mushroomId: leftSnapshot.mushroomId, loadout: leftSnapshot.loadout }),
       grp.coins, nowIso()]
    );

    let runEnded = false;
    let endReason = null;

    if (newLives <= 0) {
      runEnded = true;
      endReason = 'max_losses';
    } else if (completedRounds >= MAX_ROUNDS_PER_RUN) {
      runEnded = true;
      endReason = 'max_rounds';
    }

    if (runEnded) {
      await payCompletionBonus(client, playerId, mushroomId, newWins);
      await client.query(
        `UPDATE game_runs SET status = 'completed', ended_at = $2, end_reason = $3 WHERE id = $1`,
        [gameRunId, nowIso(), endReason]
      );
      await client.query(
        `UPDATE game_run_players SET is_active = 0 WHERE game_run_id = $1`,
        [gameRunId]
      );
    } else {
      await client.query(
        `UPDATE game_runs SET current_round = current_round + 1 WHERE id = $1`,
        [gameRunId]
      );
      const nextRound = roundNumber + 1;
      const shopState = await client.query(
        `SELECT rounds_since_bag FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
        [gameRunId, playerId]
      );
      const prevRoundsSinceBag = shopState.rowCount ? shopState.rows[0].rounds_since_bag : 1;
      const newRoundsSinceBag = prevRoundsSinceBag + 1;
      const shopRng = createRng(`${gameRunId}:shop:${nextRound}`);
      const { offer: newOffer, hasBag } = generateShopOffer(shopRng, SHOP_OFFER_SIZE, newRoundsSinceBag);
      await client.query(
        `UPDATE game_run_shop_states SET round_number = $2, refresh_count = 0, rounds_since_bag = $3, offer_json = $4, updated_at = $5
         WHERE game_run_id = $1 AND player_id = $6`,
        [gameRunId, nextRound, hasBag ? 0 : newRoundsSinceBag, JSON.stringify(newOffer), nowIso(), playerId]
      );
    }

    return {
      id: gameRunId,
      mode: run.mode,
      status: runEnded ? 'completed' : 'active',
      currentRound: runEnded ? roundNumber : roundNumber + 1,
      endedAt: runEnded ? nowIso() : null,
      endReason,
      player: {
        completedRounds,
        wins: newWins,
        losses: newLosses,
        livesRemaining: newLives,
        coins: newCoins
      },
      lastRound: {
        roundNumber,
        battleId: battle.id,
        outcome,
        rewards,
        ratingBefore: player.rating,
        ratingAfter
      }
    };
  });
}

export async function refreshRunShop(playerId, gameRunId) {
  return withTransaction(async (client) => {
    const grpResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this active game run');
    }
    const grp = grpResult.rows[0];

    const shopResult = await client.query(
      `SELECT * FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2`,
      [gameRunId, playerId]
    );
    if (!shopResult.rowCount) {
      throw new Error('Shop state not found');
    }
    const shop = shopResult.rows[0];

    const cost = getShopRefreshCost(shop.refresh_count);
    if (grp.coins < cost) {
      throw new Error('Not enough coins to refresh shop');
    }

    const newCoins = grp.coins - cost;
    const currentRoundsSinceBag = shop.rounds_since_bag || 1;
    const rng = createRng(`${gameRunId}:refresh:${shop.round_number}:${shop.refresh_count + 1}`);
    const { offer: newOffer, hasBag } = generateShopOffer(rng, SHOP_OFFER_SIZE, currentRoundsSinceBag);

    await client.query(
      `UPDATE game_run_players SET coins = $2 WHERE id = $1`,
      [grp.id, newCoins]
    );
    await client.query(
      `UPDATE game_run_shop_states SET refresh_count = refresh_count + 1, rounds_since_bag = $2, offer_json = $3, updated_at = $4
       WHERE game_run_id = $1 AND player_id = $5`,
      [gameRunId, hasBag ? 0 : currentRoundsSinceBag, JSON.stringify(newOffer), nowIso(), playerId]
    );

    return {
      coins: newCoins,
      shopOffer: newOffer,
      refreshCount: shop.refresh_count + 1,
      refreshCost: cost
    };
  });
}

export async function sellRunItem(playerId, gameRunId, artifactId) {
  return withTransaction(async (client) => {
    const runResult = await client.query(
      `SELECT current_round FROM game_runs WHERE id = $1 AND status = 'active'`,
      [gameRunId]
    );
    if (!runResult.rowCount) {
      throw new Error('Game run not found or already ended');
    }
    const currentRound = runResult.rows[0].current_round;

    const grpResult = await client.query(
      `SELECT * FROM game_run_players WHERE game_run_id = $1 AND player_id = $2 AND is_active = 1`,
      [gameRunId, playerId]
    );
    if (!grpResult.rowCount) {
      throw new Error('Player is not part of this active game run');
    }
    const grp = grpResult.rows[0];

    const loadoutResult = await client.query(
      `SELECT id FROM player_artifact_loadouts WHERE player_id = $1`,
      [playerId]
    );
    if (!loadoutResult.rowCount) {
      throw new Error('No loadout found');
    }
    const loadoutId = loadoutResult.rows[0].id;

    const itemResult = await client.query(
      `SELECT * FROM player_artifact_loadout_items WHERE loadout_id = $1 AND artifact_id = $2 LIMIT 1`,
      [loadoutId, artifactId]
    );
    if (!itemResult.rowCount) {
      throw new Error('Item not found in loadout');
    }
    const item = itemResult.rows[0];

    const artifact = getArtifactById(item.artifact_id);

    // Block selling non-empty bags
    if (artifact && artifact.family === 'bag') {
      const contentsResult = await client.query(
        `SELECT COUNT(*) AS count FROM player_artifact_loadout_items WHERE loadout_id = $1 AND bag_id = $2`,
        [loadoutId, artifact.id]
      );
      if (Number(contentsResult.rows[0].count) > 0) {
        throw new Error('Cannot sell a bag that contains items — empty it first');
      }
    }

    const price = getArtifactPrice(artifact);
    const purchasedRound = item.purchased_round || 1;
    const sellPrice = purchasedRound === currentRound ? price : Math.floor(price / 2);

    await client.query(
      `DELETE FROM player_artifact_loadout_items WHERE id = $1`,
      [item.id]
    );
    const newCoins = grp.coins + sellPrice;
    await client.query(
      `UPDATE game_run_players SET coins = $2 WHERE id = $1`,
      [grp.id, newCoins]
    );

    return { coins: newCoins, sellPrice, artifactId: item.artifact_id };
  });
}

export async function pruneOldGhostSnapshots(maxAge = 14, maxCount = 10000) {
  const countResult = await query('SELECT COUNT(*) AS total FROM game_run_ghost_snapshots');
  const total = Number(countResult.rows[0].total);
  if (total <= maxCount) return { pruned: 0 };

  const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000).toISOString();
  const result = await query(
    `DELETE FROM game_run_ghost_snapshots WHERE created_at < $1`,
    [cutoff]
  );
  return { pruned: result.rowCount };
}

export async function getGameRunHistory(playerId, limit = 20) {
  const result = await query(
    `SELECT gr.id, gr.mode, gr.status, gr.current_round, gr.started_at, gr.ended_at, gr.end_reason,
            grp.completed_rounds, grp.wins, grp.losses, grp.lives_remaining
     FROM game_run_players grp
     JOIN game_runs gr ON gr.id = grp.game_run_id
     WHERE grp.player_id = $1 AND gr.status != 'active'
     ORDER BY gr.ended_at DESC
     LIMIT $2`,
    [playerId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    status: row.status,
    currentRound: row.current_round,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    completedRounds: row.completed_rounds,
    wins: row.wins,
    losses: row.losses,
    livesRemaining: row.lives_remaining
  }));
}
