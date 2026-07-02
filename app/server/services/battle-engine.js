import { simulateBattle as simulateCoreBattle } from '@microwavedev/backpack-game-core';
import {
  getArtifactById,
  getMushroomById,
  MAX_STUN_CHANCE,
  STEP_CAP
} from '../game-data.js';
import { createRng } from '../lib/utils.js';
import { buildArtifactSummary } from './loadout-utils.js';

export { randomInt, shuffleWithRng } from '@microwavedev/backpack-game-core';

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

function placedCombatArtifacts(loadout) {
  return (loadout?.items || [])
    .map((item) => ({ item, artifact: getArtifactById(item.artifactId || item.artifact_id) }))
    .filter(({ item, artifact }) =>
      artifact
      && artifact.family !== 'bag'
      && Number(item.x) >= 0
      && Number(item.y) >= 0
    );
}

function artifactContributions(loadout, statKey) {
  return placedCombatArtifacts(loadout)
    .map(({ item, artifact }) => ({
      artifactId: artifact.id,
      itemId: item.id || null,
      value: Number(artifact.bonus?.[statKey]) || 0
    }))
    .filter((entry) => entry.value > 0);
}

function artifactBattleEffects({ attacker, defender, blockedDamage }) {
  const tags = [];
  for (const { item, artifact } of placedCombatArtifacts(attacker.loadout)) {
    const effect = artifact.battleEffect;
    if (!effect || effect.trigger !== 'hit') continue;
    if (effect.statKey && !(Number(artifact.bonus?.[effect.statKey]) > 0)) continue;
    tags.push({
      id: effect.id,
      trigger: effect.trigger,
      sourceArtifactId: artifact.id,
      itemId: item.id || null,
      actorSide: attacker.side,
      targetSide: effect.target === 'actor' ? attacker.side : defender.side
    });
  }

  if (blockedDamage > 0) {
    for (const { item, artifact } of placedCombatArtifacts(defender.loadout)) {
      const effect = artifact.battleEffect;
      if (!effect || effect.trigger !== 'block') continue;
      if (effect.statKey && !(Number(artifact.bonus?.[effect.statKey]) > 0)) continue;
      tags.push({
        id: effect.id,
        trigger: effect.trigger,
        sourceArtifactId: artifact.id,
        itemId: item.id || null,
        actorSide: attacker.side,
        targetSide: effect.target === 'actor' ? attacker.side : defender.side
      });
    }
  }

  return tags;
}

function actionArtifactAttribution(attacker, defender) {
  return {
    actorSide: attacker.side,
    targetSide: defender.side,
    damage: artifactContributions(attacker.loadout, 'damage'),
    stunChance: artifactContributions(attacker.loadout, 'stunChance'),
    armor: artifactContributions(defender.loadout, 'armor')
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

function combatantLabel(combatant) {
  return combatant.name.en;
}

function actionSpeed(combatant) {
  return combatant.speed + (combatant.mushroomId === 'kirt' && combatant.state.kirtRoundBoostReady ? 1 : 0);
}

function breakEqualBaseSpeedTie({ left, right }) {
  if (left.mushroomId === 'morga' && right.mushroomId !== 'morga') {
    return left;
  }
  if (right.mushroomId === 'morga' && left.mushroomId !== 'morga') {
    return right;
  }
  return null;
}

function prepareMushroomAction({ attacker, action }) {
  action.attackDamage += attacker.state.pendingDamageBuff;

  switch (attacker.mushroomId) {
    case 'thalla':
      action.stunChance += 5;
      action.actionName = 'Spore Lash';
      break;
    case 'lomie':
      attacker.state.pendingArmorBonus += 2;
      action.actionName = 'Settling Guard';
      break;
    case 'axilin':
      action.attackDamage += 2;
      attacker.defense -= 1;
      attacker.state.defensePenalty += 1;
      action.actionName = 'Ferment Burst';
      break;
    case 'kirt':
      action.armorIgnore = 2;
      action.actionName = 'Clean Strike';
      break;
    case 'morga':
      action.stunChance += 10;
      action.actionName = 'Flash Cap';
      break;
    case 'dalamar':
      action.stunChance += 15;
      action.actionName = 'Bone of Entropy';
      break;
    default:
      action.actionName = 'Attack';
      break;
  }

  if (attacker.mushroomId === 'morga' && !attacker.state.firstActionDone) {
    action.attackDamage += 4;
  }
  if (attacker.mushroomId === 'axilin') {
    attacker.state.successfulHitCount += 1;
    if (attacker.state.successfulHitCount % 3 === 0) {
      action.attackDamage += 3;
    }
  }
}

function afterMushroomDamageCalculated({ defender, damage }) {
  if (defender.mushroomId === 'lomie' && !defender.state.receivedFirstHit) {
    damage.resolvedDamage = Math.max(1, damage.resolvedDamage - 3);
  }
}

function afterMushroomDamageApplied({ attacker, defender }) {
  defender.state.receivedFirstHit = true;
  defender.state.pendingArmorBonus = 0;
  attacker.state.firstActionDone = true;
  attacker.state.pendingDamageBuff = 0;
}

function afterMushroomStunResolved({ attacker, defender, stun }) {
  if (stun.applied) {
    defender.state.wasStunnedByPreviousEnemyTurn = true;
    if (attacker.mushroomId === 'thalla') {
      attacker.state.pendingDamageBuff = 2;
    }
  } else {
    defender.state.wasStunnedByPreviousEnemyTurn = false;
  }
}

function afterMushroomActionResolved({ attacker, defender }) {
  if (attacker.mushroomId === 'dalamar') {
    defender.defense = Math.max(0, defender.defense - 1);
  }

  if (attacker.mushroomId === 'kirt') {
    attacker.state.kirtRoundBoostReady = false;
  }
  if (defender.mushroomId === 'kirt' && !defender.state.wasStunnedByPreviousEnemyTurn) {
    defender.state.kirtRoundBoostReady = true;
  }
}

function afterMushroomSkip({ opponent }) {
  opponent.state.wasStunnedByPreviousEnemyTurn = false;
}

function battleEndNarration({ left, right, winnerSide, endReason }) {
  const winnerName = winnerSide === 'left' ? left.name.en : right.name.en;
  return winnerSide
    ? endReason === 'step_cap'
      ? `Step limit reached — ${winnerName} wins on health.`
      : `${winnerName} wins.`
    : 'The battle ends in a draw.';
}

export function simulateBattle(snapshot, seed) {
  const left = deriveCombatant(snapshot.left, 'left');
  const right = deriveCombatant(snapshot.right, 'right');
  return simulateCoreBattle({
    left,
    right,
    rng: createRng(seed),
    stepCap: STEP_CAP,
    maxStunChance: MAX_STUN_CHANCE,
    summarizeCombatant,
    getCombatantLabel: combatantLabel,
    getActionSpeed: actionSpeed,
    breakEqualBaseSpeedTie,
    prepareAction: prepareMushroomAction,
    afterDamageCalculated: afterMushroomDamageCalculated,
    afterDamageApplied: afterMushroomDamageApplied,
    afterStunResolved: afterMushroomStunResolved,
    afterActionResolved: afterMushroomActionResolved,
    afterSkip: afterMushroomSkip,
    getArtifactAttribution: ({ attacker, defender }) => actionArtifactAttribution(attacker, defender),
    getEffectTags: ({ attacker, defender, damage }) =>
      artifactBattleEffects({ attacker, defender, blockedDamage: damage.blockedDamage }),
    getEndNarration: battleEndNarration
  });
}
