import { query } from '../db.js';
import { createId, nowIso } from '../lib/utils.js';

const DEFAULT_CLAIM_TTL_MS = 2 * 60 * 1000;
const DEFAULT_WAIT_TIMEOUT_MS = 2500;
const DEFAULT_WAIT_INTERVAL_MS = 25;

function httpError(message, statusCode = 409) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function positiveEnvNumber(name, fallback, { allowZero = false } = {}) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) return fallback;
  if (allowZero && value >= 0) return value;
  return value > 0 ? value : fallback;
}

function claimTtlMs() {
  return positiveEnvNumber('MUTATION_CLAIM_TTL_MS', DEFAULT_CLAIM_TTL_MS);
}

function waitTimeoutMs() {
  return positiveEnvNumber('MUTATION_CLAIM_WAIT_TIMEOUT_MS', DEFAULT_WAIT_TIMEOUT_MS, { allowZero: true });
}

function waitIntervalMs() {
  return positiveEnvNumber('MUTATION_CLAIM_WAIT_INTERVAL_MS', DEFAULT_WAIT_INTERVAL_MS);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeScope(scope) {
  const normalized = String(scope || '').trim();
  if (!normalized) throw httpError('Mutation claim scope is required', 500);
  return normalized;
}

function normalizeClaimKey(claimKey) {
  const normalized = String(claimKey || '').trim();
  if (!normalized) throw httpError('Mutation claim key is required', 500);
  return normalized;
}

async function tryAcquireMutationClaim(scope, claimKey) {
  const claimToken = createId('mutation_claim');
  const now = nowIso();
  const inserted = await query(
    `INSERT INTO mutation_claims (scope, claim_key, claim_token, claimed_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT DO NOTHING`,
    [scope, claimKey, claimToken, now]
  );
  if (inserted.rowCount) return { scope, claimKey, claimToken, acquiredAt: now, reclaimed: false };

  const staleBefore = new Date(Date.now() - claimTtlMs()).toISOString();
  const reclaimed = await query(
    `UPDATE mutation_claims
     SET claim_token = $3,
         claimed_at = $4,
         updated_at = $4
     WHERE scope = $1
       AND claim_key = $2
       AND claimed_at < $5
     RETURNING *`,
    [scope, claimKey, claimToken, now, staleBefore]
  );
  if (!reclaimed.rowCount) return null;
  return { scope, claimKey, claimToken, acquiredAt: now, reclaimed: true };
}

export async function acquireMutationClaim(scope, claimKey) {
  const normalizedScope = normalizeScope(scope);
  const normalizedClaimKey = normalizeClaimKey(claimKey);
  const deadline = Date.now() + waitTimeoutMs();

  while (true) {
    const claim = await tryAcquireMutationClaim(normalizedScope, normalizedClaimKey);
    if (claim) return claim;
    if (Date.now() >= deadline) {
      throw httpError('Another mutation is already in progress; retry shortly', 409);
    }
    await sleep(Math.min(waitIntervalMs(), Math.max(0, deadline - Date.now())));
  }
}

export async function releaseMutationClaim(claim) {
  if (!claim?.scope || !claim?.claimKey || !claim?.claimToken) return;
  await query(
    `DELETE FROM mutation_claims
     WHERE scope = $1 AND claim_key = $2 AND claim_token = $3`,
    [claim.scope, claim.claimKey, claim.claimToken]
  );
}

export async function withMutationClaim(scope, claimKey, work) {
  const claim = await acquireMutationClaim(scope, claimKey);
  try {
    return await work(claim);
  } finally {
    await releaseMutationClaim(claim);
  }
}
