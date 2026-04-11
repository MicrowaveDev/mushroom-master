import {
  getMushroomById,
  MAX_STUN_CHANCE,
  STEP_CAP
} from '../game-data.js';
import { createRng } from '../lib/utils.js';
import { buildArtifactSummary } from './loadout-utils.js';

export function randomInt(rng, max) {
  return Math.floor(rng() * max);
}

export function shuffleWithRng(items, rng) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
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

export function simulateBattle(snapshot, seed) {
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
  let finalStep = STEP_CAP;
  let endReason = 'step_cap';

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
      finalStep = step;
      endReason = 'death';
      break;
    }
    resolveAction(second, first, step, rng, events);
    if (first.currentHealth <= 0) {
      winnerSide = second.side;
      finalStep = step;
      endReason = 'death';
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

  const winnerName = winnerSide === 'left' ? left.name.en : right.name.en;
  const narration = winnerSide
    ? endReason === 'step_cap'
      ? `Step limit reached — ${winnerName} wins on health.`
      : `${winnerName} wins.`
    : 'The battle ends in a draw.';

  events.push({
    type: 'battle_end',
    step: finalStep,
    winnerSide,
    outcome,
    endReason,
    narration,
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
