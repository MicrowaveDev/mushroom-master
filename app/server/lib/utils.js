import {
  CHARACTER_XP_LEVEL_CURVE,
  clamp,
  computeCharacterLevel,
  createId,
  createRng,
  createSessionKey,
  createShortCode,
  dayKey,
  expectedScore,
  hashToSeed,
  kFactor,
  nextUtcReset,
  normalizeLanguage as normalizeCoreLanguage,
  nowIso,
  parseJson,
  runCurrencyFields,
  startOfUtcDay
} from '@microwavedev/backpack-game-core/server';

export {
  CHARACTER_XP_LEVEL_CURVE,
  clamp,
  computeCharacterLevel,
  createId,
  createRng,
  createSessionKey,
  createShortCode,
  dayKey,
  expectedScore,
  hashToSeed,
  kFactor,
  nextUtcReset,
  nowIso,
  parseJson,
  runCurrencyFields,
  startOfUtcDay
};

export const MYCELIUM_LEVEL_CURVE = CHARACTER_XP_LEVEL_CURVE;

export function normalizeLanguage(value, fallback = 'ru') {
  return normalizeCoreLanguage(value, { fallback, supportedLanguages: ['ru', 'en'] });
}

export function computeLevel(mycelium) {
  return computeCharacterLevel(mycelium);
}
