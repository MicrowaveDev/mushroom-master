import { createMutationClaimService } from '@microwavedev/backpack-game-core/server';
import { query } from '../db.js';
import { createId, nowIso } from '../lib/utils.js';

const DEFAULT_CLAIM_TTL_MS = 2 * 60 * 1000;
const DEFAULT_WAIT_TIMEOUT_MS = 2500;
const DEFAULT_WAIT_INTERVAL_MS = 25;

function positiveEnvNumber(name, fallback, { allowZero = false } = {}) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) return fallback;
  if (allowZero && value >= 0) return value;
  return value > 0 ? value : fallback;
}

const mutationClaimService = createMutationClaimService({
  query,
  createId,
  nowIso,
  claimTtlMs: () => positiveEnvNumber('MUTATION_CLAIM_TTL_MS', DEFAULT_CLAIM_TTL_MS),
  waitTimeoutMs: () => positiveEnvNumber('MUTATION_CLAIM_WAIT_TIMEOUT_MS', DEFAULT_WAIT_TIMEOUT_MS, { allowZero: true }),
  waitIntervalMs: () => positiveEnvNumber('MUTATION_CLAIM_WAIT_INTERVAL_MS', DEFAULT_WAIT_INTERVAL_MS)
});

export const {
  acquireMutationClaim,
  releaseMutationClaim,
  withMutationClaim
} = mutationClaimService;
