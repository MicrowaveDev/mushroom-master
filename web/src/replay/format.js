import { BATTLE_EFFECTS } from './effects.js';

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
  stunWord: 'оглушение',
  effects: 'Эффекты',
  more: 'ещё',
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
  stunWord: 'stuns',
  effects: 'Effects',
  more: 'more',
  iUse: 'I use',
  stunnedSkips: 'is stunned and skips the turn.',
  iAmStunned: 'I am stunned and skip the turn.',
  vs: 'vs',
  step: 'Step',
  stepCap: 'Step limit reached — {name} wins on health!',
  wins: '{name} wins!',
  draw: 'The battle ended in a draw.'
};

const MAX_NARRATED_EFFECTS = 3;

function labelFor(value, lang = 'en') {
  if (!value || typeof value !== 'object') return value || '';
  return value[lang] || value.en || '';
}

function effectLabels(event, lang = 'ru') {
  const seen = new Set();
  const labels = [];
  for (const tag of event?.effectTags || []) {
    if (seen.has(tag.id)) continue;
    const effect = BATTLE_EFFECTS[tag.id];
    if (!effect) continue;
    seen.add(tag.id);
    labels.push(labelFor(effect.label, lang));
  }
  return labels;
}

function effectSummaryFromLabels(labels, t) {
  if (!labels.length) return '';
  const visible = labels.slice(0, MAX_NARRATED_EFFECTS);
  const hidden = labels.length - visible.length;
  const moreText = hidden > 0 ? ` +${hidden} ${t.more}` : '';
  return ` ${t.effects}: ${visible.join(', ')}${moreText}.`;
}

function partsText(parts) {
  return parts.map((part) => part.text).join('');
}

function actionSpeechParts({ actionName, damage, stunned, effects, t }) {
  const parts = [
    { text: `${t.iUse} ` },
    { text: actionName, kind: 'action' },
    { text: ': ' },
    { text: `${damage} ${t.damage}`, kind: 'damage' }
  ];

  if (stunned) {
    parts.push({ text: ', ' }, { text: t.stunWord, kind: 'stun' });
  }
  parts.push({ text: '.' });

  if (effects.length) {
    parts.push({ text: ' ' }, { text: t.effects, kind: 'keyword' }, { text: ': ' });
    effects.slice(0, MAX_NARRATED_EFFECTS).forEach((effect, index) => {
      if (index > 0) parts.push({ text: ', ' });
      parts.push({ text: effect, kind: 'effect' });
    });
    const hidden = effects.length - MAX_NARRATED_EFFECTS;
    if (hidden > 0) {
      parts.push({ text: ' ' }, { text: `+${hidden} ${t.more}`, kind: 'more' });
    }
    parts.push({ text: '.' });
  }

  return parts;
}

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
      const effects = effectLabels(event, lang);
      const effectsText = effectSummaryFromLabels(effects, t);
      const logText = `${actorName} ${t.uses} ${actionName}: ${event.damage} ${t.damage}${stunSuffix}.${effectsText}`;
      const speechParts = actionSpeechParts({ actionName, damage: event.damage, stunned: event.stunned, effects, t });
      const speechText = partsText(speechParts);
      return {
        logText,
        speechText,
        speechParts,
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
