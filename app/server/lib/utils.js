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

export function kFactor(rating, ratedBattles, mode = 'standard') {
  if (mode === 'solo_run') {
    if (ratedBattles < 30) return 16;
    if (rating > 1600) return 8;
    return 10;
  }
  if (rating > 1600) return 16;
  if (ratedBattles < 30) return 40;
  return 24;
}

// Cumulative mycelium required to reach each level.
// MYCELIUM_LEVEL_CURVE[i] = total mycelium to reach level i+2, so:
//   index 0 → level 2 (100 mycelium)   … index 18 → level 20 (4 000 mycelium)
// Tier bands (approx): Spore 1–4 | Mycel 5–9 | Root 10–14 | Cap 15–19 | Eternal 20
export const MYCELIUM_LEVEL_CURVE = [
  100, 200, 300,                          // levels 2–4  (Spore)
  350, 520, 690, 860, 1030,               // levels 5–9  (Mycel)
  1200, 1460, 1720, 1980, 2240,           // levels 10–14 (Root)
  2500, 2800, 3100, 3400, 3700,           // levels 15–19 (Cap)
  4000                                    // level 20    (Eternal)
];

export function computeLevel(mycelium) {
  let level = 1;
  for (let i = 0; i < MYCELIUM_LEVEL_CURVE.length; i++) {
    if (mycelium >= MYCELIUM_LEVEL_CURVE[i]) {
      level = i + 2;
    } else {
      break;
    }
  }
  if (level >= 20) {
    return { level: 20, current: mycelium - 4000, next: null };
  }
  const currentThreshold = level >= 2 ? MYCELIUM_LEVEL_CURVE[level - 2] : 0;
  const nextThreshold = MYCELIUM_LEVEL_CURVE[level - 1];
  return {
    level,
    current: mycelium - currentThreshold,
    next: nextThreshold - currentThreshold
  };
}
