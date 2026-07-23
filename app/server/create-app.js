import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import OpenAI from 'openai';
import {
  shapeAuthLogoutResult
} from '@microwavedev/backpack-game-core/modules/auth';
import {
  bindBackpackRouteDescriptors,
  createAuthRouteGroup,
  createAssetRouteGroup,
  createBotRouteGroup,
  createGachaAdminRouteGroup,
  createProfileRouteGroup,
  createRunRouteGroup,
  createSocialRouteGroup,
  createSupportAdminRouteGroup,
  createWalletRouteGroup,
  createWikiRouteGroup
} from '@microwavedev/backpack-game-core/server';
import { runChildProcessSync } from '@microwavedev/backpack-game-core/tooling/runners';
import {
  authenticateRequest,
  createTelegramAuthCode,
  logoutSession,
  requireAuth,
  verifyTelegramAuthCode
} from './auth.js';
import {
  createMentionReply,
  createBrowserFallbackPayload,
  gameShortName,
  handleBotStartParam,
  handleTelegramWebhook,
  reportTelegramGameScore
} from './bot-gateway.js';
import { getDb, resetDb, query as dbQuery } from './db.js';
import { CHALLENGE_IDLE_TIMEOUT_MS, ROUND_INCOME, PORTRAIT_VARIANTS, STARTER_PRESET_VARIANTS } from './game-data.js';
import { computeLevel, createId, nowIso } from './lib/utils.js';
import {
  acceptFriendChallenge,
  addFriendByCode,
  declineFriendChallenge,
  getBattle,
  getBattleHistory,
  getInventoryReviewSamples,
  getFriendChallenge,
  getFriends,
  getLeaderboard,
  applyRunLoadoutPlacements,
  saveLocalTestRun,
  getActiveGameRun,
  forceRunShopForTest,
  createRunChallenge,
  switchPortrait,
  switchPreset,
  createPurchaseIntent,
  equipAsset,
  getRuntimeAssetCatalog,
  getPackOddsForRuntime,
  getPaymentSupportLinks,
  getWalletBundles,
  getWalletState,
  processProviderWebhookEvent,
  purchaseAsset,
  burnAssetPackDuplicates,
  rollAssetPack
} from './services/game-service.js';
import { lookupMoneySupportRecords } from './services/support-money-service.js';
import { profileRuntimeService } from './services/profile-runtime-service.js';
import { runRuntimeService } from './services/run-runtime-service.js';
import {
  listSupportActions,
  supportAdjustWallet,
  supportFreezeAsset,
  supportGrantAsset,
  supportMarkPurchaseRefunded,
  supportRevokeAsset,
  supportUnfreezeAsset
} from './services/support-ops-service.js';
import {
  createGachaCollection,
  createGachaPack,
  createGachaPackItem,
  createGachaPlanItem,
  createGachaSeason,
  deleteGachaPlanItem,
  deleteGachaPackItem,
  exportGachaAdminFixture,
  importGachaAdminFixture,
  listGachaAdminCatalog,
  previewGachaAdminPack,
  promoteGachaPlanItemsToPack,
  replaceGachaPackItems,
  transitionGachaPack,
  updateGachaCollection,
  updateGachaPack,
  updateGachaPackItem,
  updateGachaPlanItem,
  updateGachaSeason,
  validateGachaAdminPack
} from './services/gacha-admin-service.js';
import * as readyManager from './services/ready-manager.js';
import * as sseManager from './services/sse-manager.js';
import { log, requestLogger } from './lib/obs.js';
import { idempotency } from './lib/idempotency.js';
import { rateLimit, clearRateLimitBuckets } from './lib/rate-limit.js';
import { getWikiEntry, getWikiHome } from './wiki.js';
import { ensureSocialPreviewCache } from './social-preview-cache.js';
import { repoRoot } from '../shared/repo-root.js';

const webDist = path.join(repoRoot, 'web/dist');
const webPublic = path.join(repoRoot, 'web/public');

function gachaPlanPublicRoot() {
  return process.env.GACHA_PLAN_PUBLIC_ROOT
    ? path.resolve(process.env.GACHA_PLAN_PUBLIC_ROOT)
    : path.join(webPublic, 'gacha-plan');
}

// Walk a directory tree returning the most-recent mtime any file under it
// carries. Used by the dist staleness check below.
function newestMtimeUnder(dir) {
  if (!fs.existsSync(dir)) return 0;
  let max = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = newestMtimeUnder(full);
      if (sub > max) max = sub;
    } else if (entry.isFile()) {
      const m = fs.statSync(full).mtimeMs;
      if (m > max) max = m;
    }
  }
  return max;
}

// Detect the case where someone edited a source file under web/src but the
// dist bundle hasn't been regenerated. Express serves dist/, so without
// this guard the browser silently keeps loading the old CSS/JS — exactly
// the staleness that hid the .stat-grid CSS fix from review for a full
// session. In non-prod we auto-rebuild via `vite build`; in prod we throw
// loudly so a deploy script can fail fast instead of shipping the wrong
// bundle.
function ensureDistFreshOrRebuild() {
  const distIndex = path.join(webDist, 'index.html');
  const srcRoot = path.join(repoRoot, 'web', 'src');
  if (!fs.existsSync(distIndex) || !fs.existsSync(srcRoot)) return;
  const distMtime = fs.statSync(distIndex).mtimeMs;
  const srcMtime = newestMtimeUnder(srcRoot);
  if (srcMtime <= distMtime) return;
  const msg =
    `[create-app] web/src is newer than web/dist (src=${new Date(srcMtime).toISOString()}, ` +
    `dist=${new Date(distMtime).toISOString()}). Express serves dist, so the running app would ` +
    'load the OLD CSS/JS bundle.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${msg} Run \`npm run game:build\` and redeploy.`);
  }
  // eslint-disable-next-line no-console
  console.warn(`${msg} Auto-rebuilding now...`);
  const result = runChildProcessSync('npm', ['run', 'game:build'], {
    cwd: repoRoot,
    stdio: 'inherit',
    allowFailure: true
  });
  if (result.status !== 0) {
    throw new Error('[create-app] auto-rebuild failed; refusing to serve stale dist');
  }
}

// Sync authored assets (web/public) into the built tree (web/dist) at boot.
// Express serves /dist as the root, and vite only copies /public → /dist on
// `vite build`. Without this step, dropping a new portrait into /public has
// no effect in dev until the next full build — which is exactly the "new
// default.png isn't the new default" trap. Walk /public/portraits and copy
// every file whose bytes or mtime differ from its /dist counterpart so the
// authored tree is always authoritative in dev.
function syncPublicPortraitsToDist() {
  const srcRoot = path.join(webPublic, 'portraits');
  const dstRoot = path.join(webDist, 'portraits');
  if (!fs.existsSync(srcRoot)) return;
  fs.mkdirSync(dstRoot, { recursive: true });
  for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const srcDir = path.join(srcRoot, entry.name);
    const dstDir = path.join(dstRoot, entry.name);
    fs.mkdirSync(dstDir, { recursive: true });
    for (const file of fs.readdirSync(srcDir)) {
      const srcFile = path.join(srcDir, file);
      const dstFile = path.join(dstDir, file);
      const srcStat = fs.statSync(srcFile);
      let shouldCopy = true;
      if (fs.existsSync(dstFile)) {
        const dstStat = fs.statSync(dstFile);
        shouldCopy = srcStat.size !== dstStat.size || srcStat.mtimeMs > dstStat.mtimeMs;
      }
      if (shouldCopy) {
        fs.copyFileSync(srcFile, dstFile);
        fs.utimesSync(dstFile, srcStat.atime, srcStat.mtime);
      }
    }
  }
}

function isLocalAiLabEnabled() {
  return process.env.NODE_ENV !== 'production';
}

function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || 'mushroom_game_bot';
}

function verifyTelegramWebhookSecret(req, res) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!configuredSecret) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ success: false, error: 'TELEGRAM_WEBHOOK_SECRET is required in production' });
      return false;
    }
    return true;
  }
  if (req.header('x-telegram-bot-api-secret-token') !== configuredSecret) {
    res.status(403).json({ success: false, error: 'Invalid Telegram webhook secret' });
    return false;
  }
  return true;
}

function clientIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
}

function scopedPlayerRateLimit(scope, options = {}) {
  return rateLimit({
    ...options,
    keyFn: (req) => req.user?.id ? `${scope}:${req.user.id}` : null
  });
}

function supportAdminToken() {
  return process.env.SUPPORT_ADMIN_API_TOKEN || process.env.ADMIN_API_TOKEN || '';
}

function bearerToken(req) {
  const authorization = String(req.header('authorization') || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function requestSupportAdminToken(req) {
  return String(req.header('x-support-admin-token') || bearerToken(req) || '').trim();
}

function requestSupportActorId(req) {
  return String(
    req.header('x-support-actor-id') ||
    req.body?.actorId ||
    req.query?.actorId ||
    ''
  ).trim();
}

function normalizeSupportRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  const aliases = {
    view: 'support_viewer',
    viewer: 'support_viewer',
    read: 'support_viewer',
    approval: 'support_approver',
    approver: 'support_approver',
    wallet: 'wallet_operator',
    asset: 'asset_operator',
    refund: 'refund_operator',
    gacha: 'gacha_operator'
  };
  return aliases[normalized] || normalized;
}

function supportAdminOperatorConfig() {
  const json = String(process.env.SUPPORT_ADMIN_OPERATORS_JSON || '').trim();
  if (json) return JSON.parse(json);
  const compact = String(process.env.SUPPORT_ADMIN_OPERATORS || '').trim();
  if (!compact) return null;
  return Object.fromEntries(compact.split(';').map((entry) => {
    const [actorId, rolesText = ''] = entry.split(':');
    return [
      String(actorId || '').trim(),
      rolesText.split(/[|,]/).map((role) => role.trim()).filter(Boolean)
    ];
  }).filter(([actorId]) => actorId));
}

function configuredSupportAdminRoles(actorId) {
  const config = supportAdminOperatorConfig();
  if (!config || !Object.keys(config).length) return null;
  const entry = config[actorId];
  if (!entry) return new Set();
  const roles = Array.isArray(entry) ? entry : entry?.roles;
  return new Set((roles || []).map(normalizeSupportRole).filter(Boolean));
}

function supportApprovalRequired() {
  return process.env.SUPPORT_ADMIN_APPROVAL_REQUIRED === 'true';
}

function requestSupportApprovalActorId(req) {
  return String(
    req.header('x-support-approval-actor-id') ||
    req.body?.approvalActorId ||
    req.query?.approvalActorId ||
    ''
  ).trim();
}

function requireSupportAdminRole(requiredRole) {
  const normalizedRequiredRole = normalizeSupportRole(requiredRole);
  return (req, res, next) => {
    const configuredRoles = configuredSupportAdminRoles(req.supportActorId);
    if (
      !configuredRoles ||
      configuredRoles.has('admin') ||
      configuredRoles.has(normalizedRequiredRole)
    ) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      error: 'Support actor is not allowed to perform this action',
      requiredRole: normalizedRequiredRole
    });
  };
}

function requireSupportApproval(req, res, next) {
  if (!supportApprovalRequired()) {
    next();
    return;
  }
  const config = supportAdminOperatorConfig();
  if (!config || !Object.keys(config).length) {
    res.status(503).json({
      success: false,
      error: 'SUPPORT_ADMIN_OPERATORS_JSON or SUPPORT_ADMIN_OPERATORS is required for support approval policy'
    });
    return;
  }
  const approvalActorId = requestSupportApprovalActorId(req).slice(0, 120);
  if (!approvalActorId) {
    res.status(400).json({ success: false, error: 'Support approval actor is required' });
    return;
  }
  if (approvalActorId === req.supportActorId) {
    res.status(400).json({ success: false, error: 'Support approval actor must be different from action actor' });
    return;
  }
  const approverRoles = configuredSupportAdminRoles(approvalActorId);
  if (!approverRoles?.has('admin') && !approverRoles?.has('support_approver')) {
    res.status(403).json({
      success: false,
      error: 'Support approval actor is not allowed to approve this action',
      requiredRole: 'support_approver'
    });
    return;
  }
  req.supportApproval = {
    actorId: approvalActorId,
    required: true,
    recordedAt: nowIso()
  };
  next();
}

function supportEvidence(req) {
  const evidence = req.body?.evidence && typeof req.body.evidence === 'object' && !Array.isArray(req.body.evidence)
    ? req.body.evidence
    : {};
  if (!req.supportApproval) return evidence;
  return {
    ...evidence,
    approval: req.supportApproval
  };
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hmacDigest(secret, payload, algorithm) {
  return crypto.createHmac(algorithm, secret).update(payload || '').digest('hex');
}

function parseWebhookSecrets(...values) {
  const secrets = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    let entries = null;
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) entries = parsed;
      } catch {
        entries = null;
      }
    }
    entries ||= text.split(/[,\n]/);
    for (const entry of entries) {
      const secret = String(entry || '').trim();
      if (secret && !secrets.includes(secret)) secrets.push(secret);
    }
  }
  return secrets;
}

function timingSafeAnyHmac(header, payload, algorithm, secrets) {
  let matched = false;
  for (const secret of secrets) {
    matched = timingSafeEqualText(header, hmacDigest(secret, payload, algorithm)) || matched;
  }
  return matched;
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = sortJsonValue(value[key]);
    return acc;
  }, {});
}

export function nowPaymentsSignaturePayload(body) {
  return JSON.stringify(sortJsonValue(body || {}));
}

function allowUnsignedPaymentWebhookForDev() {
  return process.env.NODE_ENV === 'test' || process.env.PAYMENT_WEBHOOK_ALLOW_UNSIGNED_DEV === 'true';
}

function paymentWebhookTimestampToleranceMs() {
  const value = Number(process.env.PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_MS || 5 * 60 * 1000);
  return Number.isFinite(value) && value > 0 ? value : 5 * 60 * 1000;
}

function paymentWebhookTimestampRequired(provider) {
  const normalizedProvider = String(provider || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return process.env.PAYMENT_WEBHOOK_REQUIRE_TIMESTAMP === 'true' ||
    process.env[`${normalizedProvider}_WEBHOOK_REQUIRE_TIMESTAMP`] === 'true';
}

function firstWebhookTimestampValue(req) {
  const headerNames = [
    'x-webhook-timestamp',
    'x-event-timestamp',
    'x-timestamp',
    'btcpay-timestamp',
    'x-nowpayments-timestamp'
  ];
  for (const name of headerNames) {
    const value = req.header(name);
    if (value) return value;
  }
  const body = req.body || {};
  return body.webhook?.timestamp ||
    body.webhook?.createdAt ||
    body.webhook?.created_at ||
    body.event?.timestamp ||
    body.event?.createdAt ||
    body.event?.created_at ||
    body.deliveryTimestamp ||
    body.delivery_timestamp ||
    body.eventTimestamp ||
    body.event_timestamp ||
    body.eventTime ||
    body.event_time ||
    body.timestamp ||
    null;
}

function parseWebhookTimestampMs(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return NaN;
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? NaN : parsed;
}

export function verifyPaymentWebhookTimestamp(req, provider, {
  now = new Date()
} = {}) {
  const required = paymentWebhookTimestampRequired(provider);
  const rawTimestamp = firstWebhookTimestampValue(req);
  if (!rawTimestamp) {
    return required
      ? { ok: false, reason: 'missing_timestamp', required }
      : { ok: true, reason: 'timestamp_not_provided', required };
  }
  const timestampMs = parseWebhookTimestampMs(rawTimestamp);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, reason: 'invalid_timestamp', required, rawTimestamp };
  }
  const observedAt = now instanceof Date ? now : new Date(now);
  const observedMs = observedAt.getTime();
  if (!Number.isFinite(observedMs)) {
    return { ok: false, reason: 'invalid_now', required, rawTimestamp };
  }
  const toleranceMs = paymentWebhookTimestampToleranceMs();
  const ageMs = observedMs - timestampMs;
  if (Math.abs(ageMs) > toleranceMs) {
    return {
      ok: false,
      reason: ageMs > 0 ? 'stale_timestamp' : 'future_timestamp',
      required,
      rawTimestamp,
      timestamp: new Date(timestampMs).toISOString(),
      observedAt: observedAt.toISOString(),
      ageMs,
      toleranceMs
    };
  }
  return {
    ok: true,
    reason: 'timestamp_fresh',
    required,
    rawTimestamp,
    timestamp: new Date(timestampMs).toISOString(),
    observedAt: observedAt.toISOString(),
    ageMs,
    toleranceMs
  };
}

export function verifyPaymentWebhookSignature(req, provider) {
  if (provider === 'btcpay') {
    const secrets = parseWebhookSecrets(process.env.BTCPAY_WEBHOOK_SECRET, process.env.BTCPAY_WEBHOOK_SECRETS);
    if (!secrets.length) return allowUnsignedPaymentWebhookForDev();
    const header = String(req.header('btcpay-sig') || '').replace(/^sha256=/i, '');
    return timingSafeAnyHmac(header, req.rawBody || '', 'sha256', secrets);
  }
  if (provider === 'nowpayments') {
    const secrets = parseWebhookSecrets(process.env.NOWPAYMENTS_IPN_SECRET, process.env.NOWPAYMENTS_IPN_SECRETS);
    if (!secrets.length) return allowUnsignedPaymentWebhookForDev();
    const header = String(req.header('x-nowpayments-sig') || '');
    return timingSafeAnyHmac(header, nowPaymentsSignaturePayload(req.body || {}), 'sha512', secrets);
  }
  return false;
}

function walletPurchaseIntentLogFields(intent = {}) {
  const metadata = intent.metadata && typeof intent.metadata === 'object' ? intent.metadata : {};
  const checkout = intent.checkout && typeof intent.checkout === 'object' ? intent.checkout : {};
  return {
    kind: 'wallet_purchase_intent',
    playerId: intent.playerId || null,
    intentId: intent.id || null,
    provider: intent.provider || null,
    status: intent.status || null,
    checkoutStatus: intent.checkoutStatus || null,
    paymentSurface: metadata.paymentSurface || null,
    bundleId: metadata.bundleId || null,
    providerInvoiceId: intent.providerInvoiceId || null,
    walletAmount: intent.walletAmount ?? null,
    priceAmount: intent.priceAmount ?? null,
    priceCurrency: intent.priceCurrency || null,
    checkoutType: checkout.type || null,
    hasCheckoutUrl: Boolean(checkout.checkoutUrl),
    hasPaymentUri: Boolean(checkout.paymentUri)
  };
}

function paymentWebhookResultLogFields(provider, result = {}, timestampCheck = {}) {
  const intent = result.intent && typeof result.intent === 'object' ? result.intent : {};
  const transaction = result.transaction && typeof result.transaction === 'object' ? result.transaction : {};
  const webhookEvent = result.webhookEvent && typeof result.webhookEvent === 'object' ? result.webhookEvent : {};
  return {
    kind: 'payment_webhook_processed',
    provider,
    playerId: intent.playerId || null,
    intentId: intent.id || null,
    intentStatus: intent.status || null,
    providerInvoiceId: intent.providerInvoiceId || null,
    providerPaymentId: intent.providerPaymentId || null,
    webhookEventId: webhookEvent.id || null,
    eventKey: webhookEvent.eventKey || null,
    duplicate: Boolean(webhookEvent.duplicate),
    replayed: Boolean(webhookEvent.replayed),
    processing: Boolean(webhookEvent.processing),
    ignored: Boolean(result.ignored),
    reason: result.reason || null,
    supportRequired: Boolean(result.supportRequired),
    transactionId: transaction.id || null,
    transactionReason: transaction.reason || null,
    timestampReason: timestampCheck.reason || null
  };
}

function securityHeaders() {
  return function securityHeadersMiddleware(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
  };
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

async function requireRunMembership(req, _res, next) {
  try {
    const gameRunId = req.params.id;
    const playerId = req.user.id;
    const result = await dbQuery(
      `SELECT id FROM game_run_players WHERE game_run_id = $1 AND player_id = $2`,
      [gameRunId, playerId]
    );
    if (!result.rowCount) {
      return next(new Error('You are not part of this game run'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireSupportAdmin(req, res, next) {
  const configuredToken = supportAdminToken();
  if (!configuredToken) {
    res.status(503).json({ success: false, error: 'SUPPORT_ADMIN_API_TOKEN is required for support admin API' });
    return;
  }
  if (!timingSafeEqualText(requestSupportAdminToken(req), configuredToken)) {
    res.status(403).json({ success: false, error: 'Invalid support admin token' });
    return;
  }
  const actorId = requestSupportActorId(req);
  if (!actorId) {
    res.status(400).json({ success: false, error: 'Support actor is required' });
    return;
  }
  req.supportActorId = actorId.slice(0, 120);
  req.supportActorRoles = [...(configuredSupportAdminRoles(req.supportActorId) || [])];
  next();
}

// Map an application-layer Error message to an HTTP status code. Exported so
// the test suite can pin the contract for each class of thrown error without
// spinning up a full HTTP server. Keep this list in sync with the thrown
// messages in app/server/services — if a validation error ends up as 500 in
// production, it's almost always a missing entry here and should be added
// alongside a case in tests/game/error-status.test.js.
const ERROR_STATUS_MAP = [
  ['not found', 404],
  ['not part of', 403],
  ['only the invited', 403],
  ['cannot', 400],
  ['already', 409],
  ['limit reached', 429],
  ['not enough', 400],
  ['gacha pack validation failed', 400],
  ['gacha pack release checklist failed', 400],
  ['required', 400],
  ['requires', 400],
  ['must be', 400],
  ['must use', 400],
  ['unavailable', 403],
  ['disabled', 403],
  ['expired', 410],
  ['no longer pending', 409],
  ['invalid', 400],
  ['unknown', 400],
  // Loadout validator errors (validateGridItems / validateItemCoverage / etc.)
  // These are user-caused payload errors — the UI should show the message,
  // not "Internal server error".
  ['out of bounds', 400],
  ['must match', 400],
  ['cannot overlap', 400],
  ['coordinates', 400],
  ['is full', 400],
  ['exceeds', 400]
];

export function mapErrorToStatus(message) {
  const msg = (message || '').toLowerCase();
  for (const [keyword, code] of ERROR_STATUS_MAP) {
    if (msg.includes(keyword)) return code;
  }
  return 500;
}

export async function createApp() {
  await getDb();
  ensureDistFreshOrRebuild();
  syncPublicPortraitsToDist();
  await ensureSocialPreviewCache();
  const app = express();
  app.use(express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  }));
  app.use(securityHeaders());
  app.use(requestLogger());
  app.use(authenticateRequest);

  const runMutationGuards = [scopedPlayerRateLimit('run-mutation'), idempotency()];
  const profileMutationGuards = [scopedPlayerRateLimit('profile-mutation'), idempotency()];
  const checkoutCreationGuards = [
    scopedPlayerRateLimit('wallet-purchase-intents', { capacity: 4, refillPerSec: 1 / 30 }),
    idempotency()
  ];
  const assetPurchaseGuards = [
    scopedPlayerRateLimit('asset-purchase', { capacity: 8, refillPerSec: 1 / 20 }),
    idempotency()
  ];
  const assetRollGuards = [
    scopedPlayerRateLimit('asset-pack-roll', { capacity: 6, refillPerSec: 1 / 20 }),
    idempotency()
  ];
  const assetCatalogRateLimit = scopedPlayerRateLimit('asset-catalog', {
    capacity: 30,
    refillPerSec: 1 / 5
  });
  const assetOddsRateLimit = scopedPlayerRateLimit('asset-pack-odds', {
    capacity: 20,
    refillPerSec: 1 / 5
  });
  const supportAdminRateLimit = rateLimit({
    capacity: 40,
    refillPerSec: 1 / 5,
    keyFn: (req) => req.supportActorId ? `support-admin:${req.supportActorId}` : null
  });
  const publicAuthRateLimit = rateLimit({
    capacity: 8,
    refillPerSec: 1 / 30,
    keyFn: (req) => `ip:${clientIp(req)}`
  });
  const publicAuthPollingRateLimit = rateLimit({
    capacity: 12,
    refillPerSec: 1,
    keyFn: (req) => {
      const privateCode = String(req.body?.privateCode || '').trim();
      const codeHash = crypto.createHash('sha256').update(privateCode).digest('hex');
      return `auth-code-poll:${clientIp(req)}:${codeHash}`;
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { ok: true } });
  });

  app.get('/api/app-config', (_req, res) => {
    res.json({
      success: true,
      data: {
        localAiLabEnabled: isLocalAiLabEnabled(),
        localDevAuthEnabled: process.env.NODE_ENV !== 'production',
        botUsername: botUsername(),
        telegramGameShortName: gameShortName(),
        paymentSupport: getPaymentSupportLinks()
      }
    });
  });

  bindBackpackRouteDescriptors(app, [
    createAuthRouteGroup({
      prefix: '/api',
      routes: {
        providerLogin: { path: '/auth/telegram' },
        logout: { path: '/auth/logout' },
        providerCode: { path: '/auth/telegram/code' },
        providerVerifyCode: { path: '/auth/telegram/verify-code' },
        webLogin: { path: '/auth/web' },
        bootstrap: { path: '/bootstrap' }
      },
      handlers: {
        providerLogin: asyncRoute(async (req, res) => {
          const result = await profileRuntimeService.login('telegram', {
            initData: req.body.initData,
            botToken: process.env.TELEGRAM_BOT_TOKEN || ''
          });
          res.json({
            success: true,
            data: result
          });
        }),
        logout: asyncRoute(async (req, res) => {
          await logoutSession(req.session.session_key);
          res.json({ success: true, data: shapeAuthLogoutResult() });
        }),
        providerCode: asyncRoute(async (_req, res) => {
          const payload = await createBrowserFallbackPayload(botUsername());
          res.json({ success: true, data: payload });
        }),
        providerVerifyCode: asyncRoute(async (req, res) => {
          const result = await verifyTelegramAuthCode(req.body.privateCode);
          if (!result.success) {
            res.status(result.needsBotAuth ? 200 : 400).json(result);
            return;
          }

          res.json({
            success: true,
            data: await profileRuntimeService.completeLogin(result)
          });
        }),
        webLogin: asyncRoute(async (req, res) => {
          const result = await profileRuntimeService.login('web', req.body || {});
          res.json({
            success: true,
            data: result
          });
        }),
        bootstrap: asyncRoute(async (req, res) => {
          const data = await profileRuntimeService.getBootstrap(req.user.id);
          res.json({ success: true, data });
        })
      },
      middleware: {
        auth: requireAuth,
        providerLogin: publicAuthRateLimit,
        providerCode: publicAuthRateLimit,
        providerVerifyCode: publicAuthPollingRateLimit,
        webLogin: publicAuthRateLimit
      }
    })
  ]);

  app.post(
    '/api/client-events',
    requireAuth,
    asyncRoute(async (req, res) => {
      const event = typeof req.body?.event === 'string' ? req.body.event.slice(0, 80) : 'unknown';
      log.info({
        kind: 'client_event',
        event,
        playerId: req.user.id,
        gameRunId: req.body?.gameRunId || null,
        detail: req.body?.detail && typeof req.body.detail === 'object' ? req.body.detail : {}
      });
      await dbQuery(
        `INSERT INTO client_events (id, player_id, event, game_run_id, detail_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createId('cevt'),
          req.user.id,
          event,
          req.body?.gameRunId || null,
          JSON.stringify(req.body?.detail && typeof req.body.detail === 'object' ? req.body.detail : {}),
          nowIso()
        ]
      );
      res.json({ success: true, data: { ok: true } });
    })
  );

  bindBackpackRouteDescriptors(app, [
    createProfileRouteGroup({
      handlers: {
        profile: asyncRoute(async (req, res) => {
          res.json({ success: true, data: await profileRuntimeService.getProfile(req.user.id) });
        }),
        activeCharacter: asyncRoute(async (req, res) => {
          res.json({
            success: true,
            data: await profileRuntimeService.setActiveCharacter(req.user.id, req.body.mushroomId)
          });
        }),
        settings: asyncRoute(async (req, res) => {
          res.json({ success: true, data: await profileRuntimeService.updateSettings(req.user.id, req.body) });
        })
      },
      middleware: { auth: requireAuth }
    }),
    createWalletRouteGroup({
      handlers: {
        state: asyncRoute(async (req, res) => {
          res.json({ success: true, data: await getWalletState(req.user.id) });
        }),
        bundles: asyncRoute(async (req, res) => {
          res.json({
            success: true,
            data: getWalletBundles(req.query.provider || null, {
              surface: req.query.surface || 'web'
            })
          });
        }),
        purchaseIntent: asyncRoute(async (req, res) => {
          const data = await createPurchaseIntent(req.user.id, {
            bundleId: req.body.bundleId,
            provider: req.body.provider || 'telegram_stars',
            idempotencyKey: req.header('idempotency-key') || null,
            surface: req.body.surface || req.query.surface || 'web',
            fetchImpl: globalThis.fetch
          });
          log.info({
            requestId: req.requestId || null,
            ...walletPurchaseIntentLogFields(data)
          });
          res.json({ success: true, data });
        })
      },
      middleware: {
        auth: requireAuth,
        purchaseIntent: checkoutCreationGuards
      }
    })
  ]);

  app.post(
    '/api/wallet/purchase-webhook/:provider',
    asyncRoute(async (req, res) => {
      const provider = req.params.provider;
      if (!verifyPaymentWebhookSignature(req, provider)) {
        log.warn({
          kind: 'payment_webhook_rejected',
          requestId: req.requestId || null,
          provider,
          reason: 'invalid_signature'
        });
        res.status(403).json({ success: false, error: 'Invalid payment webhook signature' });
        return;
      }
      const timestampCheck = verifyPaymentWebhookTimestamp(req, provider);
      if (!timestampCheck.ok) {
        log.warn({
          kind: 'payment_webhook_rejected',
          requestId: req.requestId || null,
          provider,
          reason: timestampCheck.reason,
          timestampRequired: Boolean(timestampCheck.required),
          ageMs: timestampCheck.ageMs ?? null,
          toleranceMs: timestampCheck.toleranceMs ?? null
        });
        res.status(403).json({
          success: false,
          error: 'Invalid payment webhook timestamp',
          reason: timestampCheck.reason
        });
        return;
      }
      let data;
      try {
        data = await processProviderWebhookEvent(provider, req.body || {}, {
          rawBody: req.rawBody || '',
          fetchImpl: globalThis.fetch
        });
      } catch (error) {
        log.error({
          kind: 'payment_webhook_failed',
          requestId: req.requestId || null,
          provider,
          message: error.message
        });
        throw error;
      }
      log.info({
        requestId: req.requestId || null,
        ...paymentWebhookResultLogFields(provider, data, timestampCheck)
      });
      res.json({ success: true, data });
    })
  );

  bindBackpackRouteDescriptors(app, [createSupportAdminRouteGroup({
    handlers: {
      moneyLookup: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await lookupMoneySupportRecords({
          query: req.query.query,
          limit: req.query.limit
        })
      });
      }),
      actions: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await listSupportActions({
          playerId: req.query.playerId || null,
          targetType: req.query.targetType || null,
          targetId: req.query.targetId || null,
          limit: req.query.limit || 25
        })
      });
      }),
      walletGrant: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await supportAdjustWallet({
          actorId: req.supportActorId,
          playerId: req.body.playerId,
          amount: req.body.amount,
          direction: 'grant',
          reason: req.body.reason,
          note: req.body.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      walletRevoke: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await supportAdjustWallet({
          actorId: req.supportActorId,
          playerId: req.body.playerId,
          amount: req.body.amount,
          direction: 'revoke',
          reason: req.body.reason,
          note: req.body.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      assetGrant: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await supportGrantAsset({
          actorId: req.supportActorId,
          playerId: req.body.playerId,
          assetId: req.body.assetId,
          reason: req.body.reason,
          note: req.body.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      assetRevoke: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await supportRevokeAsset({
          actorId: req.supportActorId,
          playerId: req.body.playerId,
          assetId: req.body.assetId,
          assetInstanceId: req.body.assetInstanceId,
          reason: req.body.reason,
          note: req.body.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      assetFreeze: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await supportFreezeAsset({
          actorId: req.supportActorId,
          playerId: req.body.playerId,
          assetId: req.body.assetId,
          assetInstanceId: req.body.assetInstanceId,
          reason: req.body.reason,
          note: req.body.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      assetUnfreeze: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await supportUnfreezeAsset({
          actorId: req.supportActorId,
          playerId: req.body.playerId,
          assetId: req.body.assetId,
          assetInstanceId: req.body.assetInstanceId,
          reason: req.body.reason,
          note: req.body.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      purchaseRefund: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await supportMarkPurchaseRefunded({
          actorId: req.supportActorId,
          intentId: req.body.intentId,
          clawback: req.body.clawback !== false,
          reason: req.body.reason,
          note: req.body.note,
          evidence: supportEvidence(req)
        })
      });
      })
    },
    middleware: {
      viewer: [requireSupportAdmin, requireSupportAdminRole('support_viewer'), supportAdminRateLimit],
      wallet: [requireSupportAdmin, requireSupportAdminRole('wallet_operator'), requireSupportApproval, supportAdminRateLimit],
      asset: [requireSupportAdmin, requireSupportAdminRole('asset_operator'), requireSupportApproval, supportAdminRateLimit],
      refund: [requireSupportAdmin, requireSupportAdminRole('refund_operator'), requireSupportApproval, supportAdminRateLimit]
    }
  })]);

  const gachaAdminReadMiddleware = [
    requireSupportAdmin,
    requireSupportAdminRole('gacha_operator'),
    supportAdminRateLimit
  ];
  const gachaAdminWriteMiddleware = [
    requireSupportAdmin,
    requireSupportAdminRole('gacha_operator'),
    requireSupportApproval,
    supportAdminRateLimit
  ];
  const gachaAdminMiddleware = {
    read: gachaAdminReadMiddleware,
    write: gachaAdminWriteMiddleware
  };

  bindBackpackRouteDescriptors(app, [createGachaAdminRouteGroup({
    handlers: {
      catalog: asyncRoute(async (_req, res) => {
      res.json({ success: true, data: await listGachaAdminCatalog() });
      }),
      exportFixture: asyncRoute(async (_req, res) => {
      res.json({ success: true, data: await exportGachaAdminFixture() });
      }),
      importFixture: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await importGachaAdminFixture({
          actorId: req.supportActorId,
          fixture: req.body?.fixture ?? req.body,
          dryRun: req.body?.dryRun !== false,
          allowApproved: req.body?.allowApproved === true,
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      createPlanItem: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await createGachaPlanItem({
          actorId: req.supportActorId,
          payload: req.body,
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      updatePlanItem: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await updateGachaPlanItem({
          actorId: req.supportActorId,
          itemId: req.params.itemId,
          payload: req.body,
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      deletePlanItem: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await deleteGachaPlanItem({
          actorId: req.supportActorId,
          itemId: req.params.itemId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      })
    },
    middleware: gachaAdminMiddleware
  })]);

  bindBackpackRouteDescriptors(app, [createGachaAdminRouteGroup({
    handlers: {
      createSeason: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await createGachaSeason({
          actorId: req.supportActorId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      updateSeason: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await updateGachaSeason({
          actorId: req.supportActorId,
          seasonId: req.params.seasonId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      createCollection: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await createGachaCollection({
          actorId: req.supportActorId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      updateCollection: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await updateGachaCollection({
          actorId: req.supportActorId,
          collectionId: req.params.collectionId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      createPack: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await createGachaPack({
          actorId: req.supportActorId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      updatePack: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await updateGachaPack({
          actorId: req.supportActorId,
          packId: req.params.packId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      })
    },
    middleware: gachaAdminMiddleware
  })]);

  bindBackpackRouteDescriptors(app, [createGachaAdminRouteGroup({
    handlers: {
      validatePack: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await validateGachaAdminPack({ packId: req.params.packId })
      });
      }),
      previewPack: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await previewGachaAdminPack({
          packId: req.params.packId,
          trials: req.query.trials,
          seed: req.query.seed
        })
      });
      }),
      transitionPack: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await transitionGachaPack({
          actorId: req.supportActorId,
          packId: req.params.packId,
          action: req.body?.action,
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      replacePackItems: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await replaceGachaPackItems({
          actorId: req.supportActorId,
          packId: req.params.packId,
          items: req.body?.items,
          cloneDraft: req.body?.cloneDraft,
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      promotePlanItems: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await promoteGachaPlanItemsToPack({
          actorId: req.supportActorId,
          packId: req.params.packId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      })
    },
    middleware: gachaAdminMiddleware
  })]);

  bindBackpackRouteDescriptors(app, [createGachaAdminRouteGroup({
    handlers: {
      createPackItem: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await createGachaPackItem({
          actorId: req.supportActorId,
          packId: req.params.packId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      updatePackItem: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await updateGachaPackItem({
          actorId: req.supportActorId,
          packId: req.params.packId,
          itemId: req.params.itemId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      }),
      deletePackItem: asyncRoute(async (req, res) => {
      res.json({
        success: true,
        data: await deleteGachaPackItem({
          actorId: req.supportActorId,
          packId: req.params.packId,
          itemId: req.params.itemId,
          payload: req.body || {},
          reason: req.body?.reason,
          note: req.body?.note,
          evidence: supportEvidence(req)
        })
      });
      })
    },
    middleware: gachaAdminMiddleware
  })]);

  bindBackpackRouteDescriptors(app, [createAssetRouteGroup({
    handlers: {
      catalog: asyncRoute(async (_req, res) => {
        res.json({ success: true, data: await getRuntimeAssetCatalog() });
      }),
      odds: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await getPackOddsForRuntime(req.params.packId) });
      }),
      roll: asyncRoute(async (req, res) => {
        const data = await rollAssetPack(req.user.id, req.params.packId, {
          idempotencyKey: req.header('idempotency-key') || null
        });
        res.json({ success: true, data });
      }),
      burn: asyncRoute(async (req, res) => {
        const data = await burnAssetPackDuplicates(req.user.id, req.params.packId, {
          ruleId: req.body?.ruleId || null,
          idempotencyKey: req.header('idempotency-key') || null
        });
        res.json({ success: true, data });
      }),
      purchase: asyncRoute(async (req, res) => {
        const purchase = await purchaseAsset(req.user.id, req.params.assetId, {
          idempotencyKey: req.header('idempotency-key') || null
        });
        const equip = req.body?.equip ? await equipAsset(req.user.id, req.params.assetId) : null;
        res.json({ success: true, data: { purchase, equip } });
      }),
      equip: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await equipAsset(req.user.id, req.params.assetId) });
      })
    },
    middleware: {
      auth: requireAuth,
      mutation: [requireAuth, ...assetRollGuards],
      purchase: [requireAuth, ...assetPurchaseGuards],
      profileMutation: [requireAuth, ...profileMutationGuards],
      catalog: assetCatalogRateLimit,
      odds: assetOddsRateLimit
    }
  })]);

  app.get(
    '/api/characters',
    asyncRoute(async (_req, res) => {
      const { mushroomsForResponse } = await import('./game-data.js');
      res.json({ success: true, data: { mushrooms: mushroomsForResponse() } });
    })
  );

  app.get(
    '/api/artifacts',
    asyncRoute(async (_req, res) => {
      const { artifacts } = await import('./game-data.js');
      res.json({ success: true, data: { artifacts } });
    })
  );

  app.put(
    '/api/artifact-loadout',
    requireAuth,
    ...runMutationGuards,
    asyncRoute(async (req, res) => {
      // Loadout placements are always run-scoped now. The legacy
      // single-battle branch (saveArtifactLoadout against
      // player_artifact_loadouts) was deleted in 2026-04-13.
      const activeRun = await getActiveGameRun(req.user.id);
      if (!activeRun) {
        throw new Error('No active game run');
      }
      await applyRunLoadoutPlacements(req.user.id, activeRun.id, req.body.items || []);
      res.json({ success: true, data: await getActiveGameRun(req.user.id) });
    })
  );

  app.get(
    '/api/battles/history',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getBattleHistory(req.user.id) });
    })
  );

  app.get(
    '/api/battles/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ success: true, data: await getBattle(req.params.id, req.user.id) });
    })
  );

  bindBackpackRouteDescriptors(app, [createSocialRouteGroup({
    handlers: {
      friends: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await getFriends(req.user.id) });
      }),
      addFriendByCode: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await addFriendByCode(req.user.id, req.body.friendCode) });
      }),
      createChallenge: asyncRoute(async (req, res) => {
        // This compatibility endpoint always creates a multi-round run challenge.
        res.json({
          success: true,
          data: await createRunChallenge(req.user.id, req.body.friendPlayerId)
        });
      }),
      getChallenge: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await getFriendChallenge(req.params.id) });
      }),
      acceptChallenge: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await acceptFriendChallenge(req.params.id, req.user.id) });
      }),
      declineChallenge: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await declineFriendChallenge(req.params.id, req.user.id) });
      }),
      leaderboard: asyncRoute(async (_req, res) => {
        res.json({ success: true, data: await getLeaderboard() });
      })
    },
    middleware: { auth: requireAuth }
  })]);

  bindBackpackRouteDescriptors(app, [createRunRouteGroup({
    handlers: {
      start: asyncRoute(async (req, res) => {
      const data = await runRuntimeService.startRun(req.user.id, {
        mode: req.body.mode || 'solo'
      });
      res.json({ success: true, data });
      }),
      history: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await runRuntimeService.listRunHistory(req.user.id) });
      }),
      get: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await runRuntimeService.getRun(req.user.id, req.params.id) });
      }),
      challenge: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await createRunChallenge(req.user.id, req.body.friendPlayerId) });
      }),
      abandon: asyncRoute(async (req, res) => {
        const data = await runRuntimeService.abandonRun(req.user.id, req.params.id);
        if (data.mode === 'challenge') {
          sseManager.sendToOpponent(req.params.id, req.user.id, 'opponent_abandoned', { playerId: req.user.id });
          sseManager.removeRun(req.params.id);
          readyManager.clearRun(req.params.id);
        }
        res.json({ success: true, data });
      }),
      ready: asyncRoute(async (req, res) => {
        const gameRunId = req.params.id;
        const playerId = req.user.id;
        const runResult = await dbQuery('SELECT mode FROM game_runs WHERE id = $1 AND status = \'active\'', [gameRunId]);
        if (!runResult.rowCount) throw new Error('Game run not found or already ended');
        const mode = runResult.rows[0].mode;
        if (mode === 'solo') {
          const data = await readyManager.withRunLock(gameRunId, () => (
            runRuntimeService.resolveRound(playerId, gameRunId)
          ));
          return res.json({ success: true, data });
        }
        const data = await readyManager.withRunLock(gameRunId, async () => {
          readyManager.setReady(gameRunId, playerId);
          sseManager.sendToOpponent(gameRunId, playerId, 'ready', { playerId, ready: true });
          if (!readyManager.areBothReady(gameRunId).ready) return { waiting: true };
          readyManager.clearRound(gameRunId);
          const result = await runRuntimeService.resolveRound(playerId, gameRunId);
          for (const pid of Object.keys(result.playerResults)) {
            sseManager.sendToPlayer(gameRunId, pid, 'round_result', result.playerResults[pid]);
          }
          if (result.runEnded) {
            sseManager.broadcast(gameRunId, 'run_ended', { endReason: result.endReason });
            sseManager.removeRun(gameRunId);
            readyManager.clearRun(gameRunId);
          }
          return result.playerResults[playerId]
            ? { ...result.playerResults[playerId], battle: result.battle || null }
            : result;
        });
        res.json({ success: true, data });
      }),
      unready: asyncRoute(async (req, res) => {
        const gameRunId = req.params.id;
        const playerId = req.user.id;
        const runResult = await dbQuery('SELECT mode FROM game_runs WHERE id = $1 AND status = \'active\'', [gameRunId]);
        if (!runResult.rowCount) throw new Error('Game run not found');
        if (runResult.rows[0].mode === 'solo') throw new Error('Cannot unready in solo mode');
        const data = await readyManager.withRunLock(gameRunId, async () => {
          readyManager.setUnready(gameRunId, playerId);
          sseManager.sendToOpponent(gameRunId, playerId, 'ready', { playerId, ready: false });
          return { ready: false };
        });
        res.json({ success: true, data });
      }),
      events: (req, res) => {
        const gameRunId = req.params.id;
        const playerId = req.user.id;
        sseManager.addConnection(gameRunId, playerId, res);
        readyManager.touchActivity(gameRunId);
        req.on('close', () => sseManager.removeConnection(gameRunId, playerId));
      },
      refreshShop: asyncRoute(async (req, res) => {
        res.json({ success: true, data: await runRuntimeService.refreshShop(req.user.id, req.params.id) });
      }),
      sell: asyncRoute(async (req, res) => {
        const target = req.body.id
          ? { id: req.body.id, artifactId: req.body.artifactId || null }
          : req.body.artifactId;
        res.json({ success: true, data: await runRuntimeService.sellItem(req.user.id, req.params.id, target) });
      }),
      buy: asyncRoute(async (req, res) => {
        const data = await runRuntimeService.buyItem(req.user.id, req.params.id, req.body.artifactId);
        res.json({ success: true, data });
      })
    },
    middleware: {
      auth: requireAuth,
      member: [requireAuth, requireRunMembership],
      mutation: [requireAuth, requireRunMembership, ...runMutationGuards]
    }
  })]);

  // Challenge timeout sweep — runs on every SSE heartbeat tick (~30 s).
  // Detects challenge runs where no player has signalled ready/unready for
  // CHALLENGE_IDLE_TIMEOUT_MS and auto-abandons them so neither player is stuck.
  sseManager.onHeartbeat(async () => {
    const idleRunIds = readyManager.getIdleRunIds(CHALLENGE_IDLE_TIMEOUT_MS);
    for (const gameRunId of idleRunIds) {
      try {
        // Verify the run is still an active challenge before abandoning
        const runResult = await dbQuery(
          `SELECT mode FROM game_runs WHERE id = $1 AND status = 'active'`,
          [gameRunId]
        );
        if (!runResult.rowCount || runResult.rows[0].mode !== 'challenge') {
          readyManager.clearRun(gameRunId);
          continue;
        }

        // Pick the first registered player to be the "abandoner"
        const grpResult = await dbQuery(
          `SELECT player_id FROM game_run_players WHERE game_run_id = $1 AND is_active = 1 LIMIT 1`,
          [gameRunId]
        );
        if (!grpResult.rowCount) {
          readyManager.clearRun(gameRunId);
          continue;
        }

        const abandonerId = grpResult.rows[0].player_id;
        await runRuntimeService.abandonRun(abandonerId, gameRunId);
        sseManager.broadcast(gameRunId, 'run_ended', { endReason: 'timeout' });
        sseManager.removeRun(gameRunId);
        readyManager.clearRun(gameRunId);
        log.info(`Challenge run ${gameRunId} auto-abandoned after idle timeout`);
      } catch (err) {
        log.error(`Failed to auto-abandon idle challenge run ${gameRunId}: ${err.message}`);
      }
    }
  });

  bindBackpackRouteDescriptors(app, [createWikiRouteGroup({
    home: asyncRoute(async (_req, res) => {
      res.json({ success: true, data: await getWikiHome() });
    }),
    entries: [
      {
        section: 'characters',
        handler: asyncRoute(async (req, res) => {
          let characterXp = 0;
          if (req.user) {
            const row = await dbQuery(
              `SELECT mycelium FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = $2`,
              [req.user.id, req.params.slug]
            );
            characterXp = row.rowCount ? row.rows[0].mycelium : 0;
          }
          res.json({
            success: true,
            data: await getWikiEntry('characters', req.params.slug, characterXp)
          });
        })
      },
      ...['locations', 'factions', 'glossary'].map((section) => ({
        section,
        handler: asyncRoute(async (req, res) => {
          res.json({ success: true, data: await getWikiEntry(section, req.params.slug) });
        })
      }))
    ]
  })]);

  // Equip an owned portrait for a mushroom. Kept as a compatibility route
  // while the client migrates to asset-specific purchase/equip endpoints.
  app.put(
    '/api/mushroom/:id/portrait',
    requireAuth,
    asyncRoute(async (req, res) => {
      try {
        const data = await switchPortrait(req.user.id, req.params.id, req.body.portraitId);
        res.json({ success: true, data });
      } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, error: err.message });
      }
    })
  );

  // Switch active starter preset for a mushroom (unlocked by level).
  app.put(
    '/api/mushroom/:id/preset',
    requireAuth,
    asyncRoute(async (req, res) => {
      try {
        const data = await switchPreset(req.user.id, req.params.id, req.body.presetId);
        res.json({ success: true, data });
      } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, error: err.message });
      }
    })
  );

  bindBackpackRouteDescriptors(app, [createBotRouteGroup({
    handlers: {
      discovery: (req, res) => {
        res.json({
          success: true,
          data: createMentionReply({
            botUsername: botUsername(),
            chatType: req.query.chatType || 'group'
          })
        });
      },
      start: asyncRoute(async (req, res) => {
        const data = await handleBotStartParam(req.body.startParam, req.body.telegramUser);
        res.json({ success: true, data });
      }),
      webhook: asyncRoute(async (req, res) => {
        if (!verifyTelegramWebhookSecret(req, res)) return;
        const data = await handleTelegramWebhook(req.body, { botUsername: botUsername() });
        res.json({ success: true, data });
      }),
      gameScore: asyncRoute(async (req, res) => {
        const telegramUserId = req.user.telegramId;
        if (!telegramUserId) {
          res.status(400).json({ success: false, error: 'Telegram user id is required for game scores' });
          return;
        }
        const result = await reportTelegramGameScore({
          telegramUserId,
          score: req.body.score,
          chatId: req.body.chatId,
          messageId: req.body.messageId,
          inlineMessageId: req.body.inlineMessageId,
          force: false,
          disableEditMessage: Boolean(req.body.disableEditMessage)
        });
        res.json({ success: true, data: result });
      })
    },
    middleware: { auth: requireAuth }
  })]);

  app.post(
    '/api/local-tests/battle-narration',
    requireAuth,
    asyncRoute(async (req, res) => {
      if (!isLocalAiLabEnabled()) {
        res.status(404).json({ success: false, error: 'Local AI Test Lab is disabled in production' });
        return;
      }

      const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
      const results = [];
      const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

      for (const variant of variants) {
        if (!client) {
          results.push({
            variant,
            output: `[mock] ${variant.name}: ${req.body.fixtureNarration || 'No OpenAI key configured.'}`,
            latencyMs: 0,
            usedMock: true
          });
          continue;
        }

        const startedAt = Date.now();
        const response = await client.responses.create({
          model: variant.model || 'gpt-4.1-mini',
          input: `${variant.prompt}\n\nBattle fixture:\n${req.body.fixtureNarration}`
        });
        results.push({
          variant,
          output: response.output_text,
          latencyMs: Date.now() - startedAt,
          usedMock: false
        });
      }

      await saveLocalTestRun({
        fixtureNarration: req.body.fixtureNarration,
        variants,
        results
      });

      res.json({ success: true, data: { results } });
    })
  );

  if (process.env.NODE_ENV !== 'production') {
    // Test-only: deterministically overwrite the current round's shop offer.
    // Playwright tests use this to bypass RNG/pity/refresh polling loops that
    // otherwise race cold Vite compilation. See docs/flaky-tests.md.
    app.post(
      '/api/dev/game-run/:id/force-shop',
      requireAuth,
      requireRunMembership,
      asyncRoute(async (req, res) => {
        const data = await forceRunShopForTest(req.user.id, req.params.id, req.body.artifactIds);
        res.json({ success: true, data });
      })
    );

    app.post(
      '/api/dev/reset',
      asyncRoute(async (_req, res) => {
        await resetDb();
        clearRateLimitBuckets();
        res.json({
          success: true,
          data: { reset: true }
        });
      })
    );

    bindBackpackRouteDescriptors(app, [
      createAuthRouteGroup({
        prefix: '/api',
        routes: {
          devLogin: { path: '/dev/session' }
        },
        handlers: {
          devLogin: asyncRoute(async (req, res) => {
            const verified = await profileRuntimeService.login('dev', {
              telegramId: req.body.telegramId || 999001,
              username: req.body.username || 'local_player',
              name: req.body.name || 'Local',
              lastName: req.body.lastName || 'Player',
              lang: req.body.lang || 'ru'
            }, {
              presentPlayer: (player) => player,
              userField: 'player'
            });
            res.json({
              success: true,
              data: verified
            });
          })
        }
      })
    ]);

    app.get(
      '/api/dev/inventory-review',
      requireAuth,
      asyncRoute(async (_req, res) => {
        res.json({
          success: true,
          data: await getInventoryReviewSamples()
        });
      })
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    app.use('/data', express.static(path.join(repoRoot, 'data')));
  }
  // Portrait files are authored in web/public/portraits and bundled into
  // web/dist/portraits by vite build. Serve the authored tree directly so
  // dropping a new default.png into /public/ is live immediately — no
  // vite build, no restart. The no-cache headers mean the browser will
  // refetch on every page load, so even if portraitUrl's ?v=<mtime>
  // cache-buster ever went stale, the user still sees fresh bytes.
  app.use(
    '/portraits',
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      next();
    },
    express.static(path.join(webPublic, 'portraits'))
  );
  app.use(
    '/gacha-plan',
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      next();
    },
    express.static(gachaPlanPublicRoot())
  );
  app.get('/marketing/social-preview.png', (_req, res) => {
    res.redirect(301, '/marketing/social-preview.jpg');
  });
  app.use(express.static(webDist, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
        return;
      }
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
    }
  }));
  app.get(/.*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.sendFile(path.join(webDist, 'index.html'));
  });

  app.use((error, _req, res, _next) => {
    const status = error.statusCode || mapErrorToStatus(error.message);
    // Only expose message for known application errors; hide internals for 500s
    const isAppError = status !== 500;
    if (!isAppError) {
      log.error({
        kind: 'unhandled',
        requestId: _req.requestId || null,
        playerId: _req.user?.id || null,
        gameRunId: _req.params?.id || null,
        message: error.message,
        stack: error.stack
      });
    } else if (status >= 400 && status !== 401 && status !== 403) {
      // 4xx app errors are surfaced to the user but otherwise invisible: the
      // request logger only records status, not the message body. Log a
      // warn-level breadcrumb so production-style diagnosis ("which validator
      // tripped on which artifact?") doesn't require devtools. 401/403 are
      // expected auth churn and would be noise. Validator messages are
      // structured (e.g. "Artifact placement is out of bounds: thunder_gill
      // at (2,2) 2x1 exceeds grid 3x3") — keep them precise so this log
      // line is enough to act on.
      log.warn({
        kind: 'app_error',
        requestId: _req.requestId || null,
        method: _req.method,
        route: _req.route?.path || _req.path,
        status,
        playerId: _req.user?.id || null,
        gameRunId: _req.params?.id || null,
        message: error.message
      });
    }
    res.status(status).json({
      success: false,
      error: isAppError ? error.message : 'Internal server error'
    });
  });

  return app;
}
