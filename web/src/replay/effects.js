export const STATUS_EFFECTS = {
  stun: {
    label: { en: 'STUN', ru: 'ОГЛУШ' },
    className: 'stun'
  }
};

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function labelFor(value, lang = 'en') {
  if (!value || typeof value !== 'object') return value || '';
  return value[lang] || value.en || '';
}

function activeStatusesFor(side, replayState = {}, lang = 'en') {
  const sideState = replayState?.[side] || {};
  const statuses = [];
  if (sideState.stunned) {
    statuses.push({ ...STATUS_EFFECTS.stun, label: labelFor(STATUS_EFFECTS.stun.label, lang) });
  }
  return statuses;
}

function targetLabelsFor(event, side, lang = 'en') {
  if (!event || event.type !== 'action' || event.targetSide !== side) {
    return [];
  }

  const labels = [];
  const damage = numberOrZero(event.damage);
  if (damage > 0) {
    labels.push({ id: 'damage', text: `-${damage}`, className: 'damage' });
  }
  if (numberOrZero(event.blockedDamage) > 0) {
    labels.push({ id: 'blocked', text: lang === 'ru' ? 'БЛОК' : 'BLOCK', className: 'blocked' });
  }
  if (event.stunned) {
    labels.push({ id: 'stun', text: labelFor(STATUS_EFFECTS.stun.label, lang), className: STATUS_EFFECTS.stun.className });
  }
  return labels;
}

export function replayFighterEffects({ event, side, replayState = {}, replayIndex = 0, lang = 'en' } = {}) {
  const classes = [];
  if (event?.type === 'action' && event.actorSide === side) {
    classes.push('fighter--acting-now');
  }
  if (event?.type === 'action' && event.targetSide === side) {
    classes.push('fighter--hit');
    if (numberOrZero(event.blockedDamage) > 0) {
      classes.push('fighter--blocked');
    }
    if (event.stunned) {
      classes.push('fighter--stunned');
    }
  }
  if (event?.type === 'skip' && event.actorSide === side) {
    classes.push('fighter--skip');
  }

  return {
    side,
    key: `${replayIndex}:${event?.type || 'none'}:${event?.actorSide || ''}:${event?.targetSide || ''}:${side}`,
    classes,
    floatingLabels: targetLabelsFor(event, side, lang),
    statusBadges: activeStatusesFor(side, replayState, lang)
  };
}
