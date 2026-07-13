import crypto from 'crypto';
import { createMushroomAuthServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/platform';
import { query, withTransaction } from './db.js';
import {
  createId,
  createSessionKey,
  createShortCode,
  normalizeLanguage,
  nowIso
} from './lib/utils.js';
import { mushrooms, SESSION_TTL_HOURS } from './game-data.js';

const authServicePort = createMushroomAuthServicePort({
  crypto,
  query,
  withTransaction,
  createId,
  createSessionKey,
  createShortCode,
  normalizeLanguage,
  nowIso,
  characters: mushrooms,
  sessionTtlHours: SESSION_TTL_HOURS
});

export const {
  verifyTelegramInitData,
  upsertTelegramPlayer,
  loginWithDevSession,
  loginWithWebSession,
  loginWithTelegram,
  logoutSession,
  pruneExpiredAuthRecords,
  createTelegramAuthCode,
  confirmTelegramAuthCode,
  verifyTelegramAuthCode,
  authenticateRequest,
  requireAuth
} = authServicePort;
