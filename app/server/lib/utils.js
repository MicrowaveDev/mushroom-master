import crypto from 'crypto';

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function createShortCode(length = 8) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

export function createSessionKey() {
  return `sess_${crypto.randomBytes(24).toString('hex')}`;
}

export function normalizeLanguage(value, fallback = 'ru') {
  if (!value) {
    return fallback;
  }
  return String(value).toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function startOfUtcDay(input = new Date()) {
  const day = new Date(input);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

export function nextUtcReset(input = new Date()) {
  const next = startOfUtcDay(input);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function dayKey(input = new Date()) {
  return startOfUtcDay(input).toISOString().slice(0, 10);
}

export function parseJson(text, fallback = null) {
  if (!text) {
    return fallback;
  }
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function hashToSeed(input) {
  const digest = crypto.createHash('sha256').update(String(input)).digest();
  return digest.readUInt32LE(0);
}

export function createRng(seedInput) {
  let state = hashToSeed(seedInput) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function expectedScore(playerRating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function kFactor(rating, ratedBattles) {
  if (rating > 1600) {
    return 16;
  }
  if (ratedBattles < 30) {
    return 40;
  }
  return 24;
}

export function computeLevel(mycelium) {
  let level = 1;
  let threshold = 100;
  let spent = 0;

  while (mycelium >= spent + threshold) {
    spent += threshold;
    level += 1;
    threshold += 50;
  }

  return {
    level,
    current: mycelium - spent,
    next: threshold
  };
}
