export function getReplayCombatantName(currentBattle, side, resolveName) {
  if (!currentBattle || !side) {
    return '';
  }
  const mushroomId = currentBattle.snapshots?.[side]?.mushroomId;
  return resolveName(mushroomId) || mushroomId || '';
}

const RU = {
  uses: 'использует',
  damage: 'урона',
  stun: ', оглушение',
  iUse: 'Использую',
  stunnedSkips: 'оглушён и пропускает ход.',
  iAmStunned: 'Я оглушён и пропускаю ход.',
  vs: 'против',
  step: 'Ход',
  stepCap: 'Лимит ходов исчерпан — {name} побеждает по здоровью!',
  wins: '{name} побеждает!',
  draw: 'Бой закончился ничьей.'
};

const EN = {
  uses: 'uses',
  damage: 'damage',
  stun: ', stuns',
  iUse: 'I use',
  stunnedSkips: 'is stunned and skips the turn.',
  iAmStunned: 'I am stunned and skip the turn.',
  vs: 'vs',
  step: 'Step',
  stepCap: 'Step limit reached — {name} wins on health!',
  wins: '{name} wins!',
  draw: 'The battle ended in a draw.'
};

export function formatReplayEvent(event, currentBattle, resolveName, resolveActionName, lang = 'ru') {
  if (!event) {
    return { logText: '', speechText: '', statusText: '', speechSide: null };
  }

  const t = lang === 'en' ? EN : RU;
  const actorName = getReplayCombatantName(currentBattle, event.actorSide, resolveName);
  const targetName = getReplayCombatantName(currentBattle, event.targetSide, resolveName);
  const leftName = getReplayCombatantName(currentBattle, 'left', resolveName);
  const rightName = getReplayCombatantName(currentBattle, 'right', resolveName);

  switch (event.type) {
    case 'action': {
      const actorMushroomId = currentBattle?.snapshots?.[event.actorSide]?.mushroomId;
      const actionName = (resolveActionName && actorMushroomId ? resolveActionName(actorMushroomId) : null) || event.actionName;
      const stunSuffix = event.stunned ? t.stun : '';
      const logText = `${actorName} ${t.uses} ${actionName}: ${event.damage} ${t.damage}${stunSuffix}.`;
      const speechText = `${t.iUse} ${actionName}: ${event.damage} ${t.damage}${stunSuffix}.`;
      return {
        logText,
        speechText,
        statusText: '',
        speechSide: event.actorSide || null
      };
    }
    case 'skip':
      return {
        logText: `${actorName} ${t.stunnedSkips}`,
        speechText: t.iAmStunned,
        statusText: '',
        speechSide: event.actorSide || null
      };
    case 'battle_start':
      return {
        logText: `${leftName} ${t.vs} ${rightName}.`,
        speechText: '',
        statusText: `${leftName} ${t.vs} ${rightName}.`,
        speechSide: null
      };
    case 'step_start':
      return {
        logText: `${t.step} ${event.step}.`,
        speechText: '',
        statusText: `${t.step} ${event.step}.`,
        speechSide: null
      };
    case 'battle_end':
      if (event.winnerSide) {
        const winnerName = getReplayCombatantName(currentBattle, event.winnerSide, resolveName);
        const bothAlive = event.state?.left?.currentHealth > 0 && event.state?.right?.currentHealth > 0;
        const isStepCap = event.endReason === 'step_cap' || bothAlive;
        const text = (isStepCap ? t.stepCap : t.wins).replace('{name}', winnerName);
        return {
          logText: text,
          speechText: '',
          statusText: text,
          speechSide: null
        };
      }
      return {
        logText: t.draw,
        speechText: '',
        statusText: t.draw,
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
