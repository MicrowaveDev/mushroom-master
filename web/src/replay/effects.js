export const STATUS_EFFECTS = {
  stun: {
    label: { en: 'STUN', ru: 'ОГЛУШ' },
    className: 'stun'
  }
};

export const BATTLE_EFFECTS = {
  biostasis: { label: { en: 'BIND', ru: 'УЗЫ' }, className: 'biostasis' },
  poison: { label: { en: 'POISON', ru: 'ЯД' }, className: 'poison' },
  freeze: { label: { en: 'FROST', ru: 'ИНЕЙ' }, className: 'freeze' },
  ferment: { label: { en: 'FERMENT', ru: 'БРОЖ' }, className: 'ferment' },
  flash: { label: { en: 'FLASH', ru: 'ВСПЫШ' }, className: 'flash' },
  decay: { label: { en: 'ASH', ru: 'ПЕПЕЛ' }, className: 'decay' },
  burn: { label: { en: 'BURN', ru: 'ЖАР' }, className: 'burn' }
};

const MAX_FLOATING_LABELS = 4;

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

function compactLabels(labels) {
  return labels.slice(0, MAX_FLOATING_LABELS);
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
  return compactLabels(labels);
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
