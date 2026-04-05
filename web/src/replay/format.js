export function getReplayCombatantName(currentBattle, side, resolveName) {
  if (!currentBattle || !side) {
    return '';
  }
  const mushroomId = currentBattle.snapshots?.[side]?.mushroomId;
  return resolveName(mushroomId) || mushroomId || '';
}

export function formatReplayEvent(event, currentBattle, resolveName, resolveActionName) {
  if (!event) {
    return { logText: '', speechText: '', statusText: '', speechSide: null };
  }

  const actorName = getReplayCombatantName(currentBattle, event.actorSide, resolveName);
  const targetName = getReplayCombatantName(currentBattle, event.targetSide, resolveName);
  const leftName = getReplayCombatantName(currentBattle, 'left', resolveName);
  const rightName = getReplayCombatantName(currentBattle, 'right', resolveName);

  switch (event.type) {
    case 'action': {
      const actorMushroomId = currentBattle?.snapshots?.[event.actorSide]?.mushroomId;
      const actionName = (resolveActionName && actorMushroomId ? resolveActionName(actorMushroomId) : null) || event.actionName;
      const logText = `${actorName} использует ${actionName}: ${event.damage} урона${event.stunned ? ', оглушение' : ''}.`;
      const speechText = `Использую ${actionName}: ${event.damage} урона${event.stunned ? ', оглушение' : ''}.`;
      return {
        logText,
        speechText,
        statusText: '',
        speechSide: event.actorSide || null
      };
    }
    case 'skip':
      return {
        logText: `${actorName} оглушён и пропускает ход.`,
        speechText: 'Я оглушён и пропускаю ход.',
        statusText: '',
        speechSide: event.actorSide || null
      };
    case 'battle_start':
      return {
        logText: `${leftName} против ${rightName}.`,
        speechText: '',
        statusText: `${leftName} против ${rightName}.`,
        speechSide: null
      };
    case 'round_start':
      return {
        logText: `Раунд ${event.round}.`,
        speechText: '',
        statusText: `Раунд ${event.round}.`,
        speechSide: null
      };
    case 'battle_end':
      if (event.winnerSide) {
        const winnerName = getReplayCombatantName(currentBattle, event.winnerSide, resolveName);
        return {
          logText: `${winnerName} побеждает!`,
          speechText: '',
          statusText: `${winnerName} побеждает!`,
          speechSide: null
        };
      }
      return {
        logText: 'Бой закончился ничьей.',
        speechText: '',
        statusText: 'Бой закончился ничьей.',
        speechSide: null
      };
    default:
      return {
        logText: event.narration || `${actorName} ${targetName}`.trim(),
        speechText: '',
        statusText: event.narration || '',
        speechSide: null
      };
  }
}
