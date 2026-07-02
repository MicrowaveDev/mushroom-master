import { query } from '../db.js';
import { parseJson } from '../lib/utils.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function normalizeLimit(limit = DEFAULT_LIMIT) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

function normalizeSearchTerm(value) {
  return String(value || '').trim();
}

function lowerLikeTerm(value) {
  return `%${String(value || '').toLowerCase()}%`;
}

function placeholders(values, startIndex = 1) {
  return values.map((_value, index) => `$${startIndex + index}`).join(', ');
}

function uniqueRowsById(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    result.push(row);
  }
  return result;
}

function collectPlayerIds(rows, target) {
  for (const row of rows) {
    if (row?.player_id) target.add(row.player_id);
  }
}

function rowToPlayer(row) {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    telegramUsername: row.telegram_username || null,
    name: row.name || null,
    lang: row.lang || null,
    friendCode: row.friend_code || null,
    walletMirrorBalance: Number(row.spore || 0),
    createdAt: row.created_at || null
  };
}

function rowToBalance(row) {
  return {
    playerId: row.player_id,
    currencyCode: row.currency_code,
    balance: Number(row.balance || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToPurchaseIntent(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    provider: row.provider,
    providerInvoiceId: row.provider_invoice_id || null,
    providerPaymentId: row.provider_payment_id || null,
    currencyCode: row.currency_code,
    walletAmount: Number(row.wallet_amount || 0),
    priceAmount: Number(row.price_amount || 0),
    priceCurrency: row.price_currency,
    status: row.status,
    idempotencyKey: row.idempotency_key || null,
    checkoutStatus: row.checkout_status || null,
    checkoutClaimToken: row.checkout_claim_token || null,
    checkoutClaimedAt: row.checkout_claimed_at || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: parseJson(row.metadata_json, {})
  };
}

function rowToWalletTransaction(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    currencyCode: row.currency_code,
    amount: Number(row.amount || 0),
    balanceAfter: Number(row.balance_after || 0),
    reason: row.reason,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
    idempotencyKey: row.idempotency_key || null,
    createdAt: row.created_at,
    metadata: parseJson(row.metadata_json, {})
  };
}

function rowToWebhookEvent(row) {
  return {
    id: row.id,
    provider: row.provider,
    eventKey: row.event_key,
    payloadHash: row.payload_hash,
    processingStatus: row.processing_status,
    result: parseJson(row.result_json, null),
    errorMessage: row.error_message || null,
    receivedAt: row.received_at,
    processedAt: row.processed_at || null,
    metadata: parseJson(row.metadata_json, {})
  };
}

function rowToAssetInstance(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    assetId: row.asset_id,
    acquisitionSource: row.acquisition_source,
    acquisitionSourceId: row.acquisition_source_id || null,
    status: row.status,
    acquiredAt: row.acquired_at,
    metadata: parseJson(row.metadata_json, {})
  };
}

function rowToEquippedAsset(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    slot: row.slot,
    targetType: row.target_type,
    targetId: row.target_id || null,
    assetInstanceId: row.asset_instance_id || null,
    assetId: row.asset_id,
    equippedAt: row.equipped_at
  };
}

function rowToAssetRoll(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    packId: row.pack_id,
    currencyCode: row.currency_code,
    priceAmount: Number(row.price_amount || 0),
    resultAssetIds: parseJson(row.result_asset_ids_json, []),
    selectedAssetId: row.selected_asset_id || null,
    idempotencyKey: row.idempotency_key || null,
    createdAt: row.created_at,
    metadata: parseJson(row.metadata_json, {})
  };
}

async function findPlayersByTerm(term, likeTerm, limit) {
  const result = await query(
    `SELECT id, telegram_id, telegram_username, name, lang, friend_code, spore, created_at
     FROM players
     WHERE id = $1
        OR CAST(telegram_id AS TEXT) = $1
        OR LOWER(COALESCE(telegram_username, '')) = LOWER($1)
        OR LOWER(COALESCE(name, '')) LIKE $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [term, likeTerm, limit]
  );
  return result.rows;
}

async function findPlayersByIds(playerIds) {
  const ids = [...playerIds];
  if (!ids.length) return [];
  const result = await query(
    `SELECT id, telegram_id, telegram_username, name, lang, friend_code, spore, created_at
     FROM players
     WHERE id IN (${placeholders(ids)})
     ORDER BY created_at DESC`,
    ids
  );
  return result.rows;
}

async function directPurchaseIntentSearch(term, likeTerm, limit) {
  const result = await query(
    `SELECT *
     FROM wallet_purchase_intents
     WHERE id = $1
        OR provider_invoice_id = $1
        OR provider_payment_id = $1
        OR LOWER(COALESCE(idempotency_key, '')) = LOWER($1)
        OR LOWER(COALESCE(metadata_json, '')) LIKE $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [term, likeTerm, limit]
  );
  return result.rows;
}

async function purchaseIntentsByIds(intentIds, limit) {
  const ids = [...intentIds];
  if (!ids.length) return [];
  const result = await query(
    `SELECT *
     FROM wallet_purchase_intents
     WHERE id IN (${placeholders(ids)})
     ORDER BY created_at DESC
     LIMIT $${ids.length + 1}`,
    [...ids, limit]
  );
  return result.rows;
}

async function purchaseIntentsByPlayerIds(playerIds, limit) {
  const ids = [...playerIds];
  if (!ids.length) return [];
  const result = await query(
    `SELECT *
     FROM wallet_purchase_intents
     WHERE player_id IN (${placeholders(ids)})
     ORDER BY created_at DESC
     LIMIT $${ids.length + 1}`,
    [...ids, limit]
  );
  return result.rows;
}

async function walletTransactionsByTerm(term, likeTerm, limit) {
  const result = await query(
    `SELECT *
     FROM player_wallet_transactions
     WHERE id = $1
        OR source_id = $1
        OR LOWER(COALESCE(source_type, '')) = LOWER($1)
        OR LOWER(COALESCE(reason, '')) = LOWER($1)
        OR LOWER(COALESCE(idempotency_key, '')) = LOWER($1)
        OR LOWER(COALESCE(metadata_json, '')) LIKE $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [term, likeTerm, limit]
  );
  return result.rows;
}

async function walletTransactionsByPlayerIds(playerIds, limit) {
  const ids = [...playerIds];
  if (!ids.length) return [];
  const result = await query(
    `SELECT *
     FROM player_wallet_transactions
     WHERE player_id IN (${placeholders(ids)})
     ORDER BY created_at DESC
     LIMIT $${ids.length + 1}`,
    [...ids, limit]
  );
  return result.rows;
}

async function walletBalancesByPlayerIds(playerIds) {
  const ids = [...playerIds];
  if (!ids.length) return [];
  const result = await query(
    `SELECT *
     FROM player_wallet_balances
     WHERE player_id IN (${placeholders(ids)})
     ORDER BY player_id, currency_code`,
    ids
  );
  return result.rows;
}

async function paymentWebhookEventsByTerm(term, likeTerm, limit) {
  const result = await query(
    `SELECT *
     FROM payment_webhook_events
     WHERE id = $1
        OR event_key = $1
        OR payload_hash = $1
        OR LOWER(provider) = LOWER($1)
        OR LOWER(COALESCE(metadata_json, '')) LIKE $2
     ORDER BY received_at DESC
     LIMIT $3`,
    [term, likeTerm, limit]
  );
  return result.rows;
}

async function paymentWebhookEventsByRefs(refs, limit) {
  const uniqueRefs = [...new Set(refs.filter(Boolean).map((ref) => String(ref)))];
  if (!uniqueRefs.length) return [];
  const clauses = uniqueRefs.map((_ref, index) => `LOWER(COALESCE(metadata_json, '')) LIKE $${index + 1}`);
  const result = await query(
    `SELECT *
     FROM payment_webhook_events
     WHERE ${clauses.join(' OR ')}
     ORDER BY received_at DESC
     LIMIT $${uniqueRefs.length + 1}`,
    [...uniqueRefs.map(lowerLikeTerm), limit]
  );
  return result.rows;
}

async function assetInstancesByTerm(term, likeTerm, limit) {
  const result = await query(
    `SELECT *
     FROM player_asset_instances
     WHERE id = $1
        OR asset_id = $1
        OR acquisition_source_id = $1
        OR LOWER(COALESCE(acquisition_source, '')) = LOWER($1)
        OR LOWER(COALESCE(metadata_json, '')) LIKE $2
     ORDER BY acquired_at DESC
     LIMIT $3`,
    [term, likeTerm, limit]
  );
  return result.rows;
}

async function assetInstancesByPlayerIds(playerIds, limit) {
  const ids = [...playerIds];
  if (!ids.length) return [];
  const result = await query(
    `SELECT *
     FROM player_asset_instances
     WHERE player_id IN (${placeholders(ids)})
     ORDER BY acquired_at DESC
     LIMIT $${ids.length + 1}`,
    [...ids, limit]
  );
  return result.rows;
}

async function equippedAssetsByTerm(term, limit) {
  const result = await query(
    `SELECT *
     FROM player_equipped_assets
     WHERE id = $1
        OR asset_instance_id = $1
        OR asset_id = $1
        OR target_id = $1
     ORDER BY equipped_at DESC
     LIMIT $2`,
    [term, limit]
  );
  return result.rows;
}

async function equippedAssetsByPlayerIds(playerIds, limit) {
  const ids = [...playerIds];
  if (!ids.length) return [];
  const result = await query(
    `SELECT *
     FROM player_equipped_assets
     WHERE player_id IN (${placeholders(ids)})
     ORDER BY equipped_at DESC
     LIMIT $${ids.length + 1}`,
    [...ids, limit]
  );
  return result.rows;
}

async function assetRollsByTerm(term, likeTerm, limit) {
  const result = await query(
    `SELECT *
     FROM asset_rolls
     WHERE id = $1
        OR pack_id = $1
        OR selected_asset_id = $1
        OR LOWER(COALESCE(idempotency_key, '')) = LOWER($1)
        OR LOWER(COALESCE(result_asset_ids_json, '')) LIKE $2
        OR LOWER(COALESCE(metadata_json, '')) LIKE $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [term, likeTerm, limit]
  );
  return result.rows;
}

async function assetRollsByPlayerIds(playerIds, limit) {
  const ids = [...playerIds];
  if (!ids.length) return [];
  const result = await query(
    `SELECT *
     FROM asset_rolls
     WHERE player_id IN (${placeholders(ids)})
     ORDER BY created_at DESC
     LIMIT $${ids.length + 1}`,
    [...ids, limit]
  );
  return result.rows;
}

export async function lookupMoneySupportRecords({ query: searchQuery, limit = DEFAULT_LIMIT } = {}) {
  const term = normalizeSearchTerm(searchQuery);
  if (!term) {
    throw new Error('Support lookup query is required');
  }

  const normalizedLimit = normalizeLimit(limit);
  const likeTerm = lowerLikeTerm(term);
  const playerIds = new Set();
  const intentIds = new Set();

  let players = await findPlayersByTerm(term, likeTerm, normalizedLimit);
  collectPlayerIds(players, playerIds);

  let webhookEvents = await paymentWebhookEventsByTerm(term, likeTerm, normalizedLimit);
  for (const row of webhookEvents) {
    const metadata = parseJson(row.metadata_json, {});
    if (metadata?.intentId) intentIds.add(metadata.intentId);
  }

  let purchaseIntents = [
    ...await directPurchaseIntentSearch(term, likeTerm, normalizedLimit),
    ...await purchaseIntentsByIds(intentIds, normalizedLimit)
  ];
  collectPlayerIds(purchaseIntents, playerIds);

  purchaseIntents = uniqueRowsById([
    ...purchaseIntents,
    ...await purchaseIntentsByPlayerIds(playerIds, normalizedLimit)
  ]);
  collectPlayerIds(purchaseIntents, playerIds);

  let walletTransactions = uniqueRowsById([
    ...await walletTransactionsByTerm(term, likeTerm, normalizedLimit),
    ...await walletTransactionsByPlayerIds(playerIds, normalizedLimit)
  ]);
  collectPlayerIds(walletTransactions, playerIds);

  let assetInstances = uniqueRowsById([
    ...await assetInstancesByTerm(term, likeTerm, normalizedLimit),
    ...await assetInstancesByPlayerIds(playerIds, normalizedLimit)
  ]);
  collectPlayerIds(assetInstances, playerIds);

  let equippedAssets = uniqueRowsById([
    ...await equippedAssetsByTerm(term, normalizedLimit),
    ...await equippedAssetsByPlayerIds(playerIds, normalizedLimit)
  ]);
  collectPlayerIds(equippedAssets, playerIds);

  let assetRolls = uniqueRowsById([
    ...await assetRollsByTerm(term, likeTerm, normalizedLimit),
    ...await assetRollsByPlayerIds(playerIds, normalizedLimit)
  ]);
  collectPlayerIds(assetRolls, playerIds);

  purchaseIntents = uniqueRowsById([
    ...purchaseIntents,
    ...await purchaseIntentsByPlayerIds(playerIds, normalizedLimit)
  ]);
  walletTransactions = uniqueRowsById([
    ...walletTransactions,
    ...await walletTransactionsByPlayerIds(playerIds, normalizedLimit)
  ]);
  assetInstances = uniqueRowsById([
    ...assetInstances,
    ...await assetInstancesByPlayerIds(playerIds, normalizedLimit)
  ]);
  equippedAssets = uniqueRowsById([
    ...equippedAssets,
    ...await equippedAssetsByPlayerIds(playerIds, normalizedLimit)
  ]);
  assetRolls = uniqueRowsById([
    ...assetRolls,
    ...await assetRollsByPlayerIds(playerIds, normalizedLimit)
  ]);

  const webhookRefs = [];
  for (const row of purchaseIntents) {
    webhookRefs.push(row.id, row.provider_invoice_id, row.provider_payment_id);
  }
  webhookEvents = uniqueRowsById([
    ...webhookEvents,
    ...await paymentWebhookEventsByRefs(webhookRefs, normalizedLimit)
  ]);

  players = uniqueRowsById([...players, ...await findPlayersByIds(playerIds)]);
  const walletBalances = await walletBalancesByPlayerIds(playerIds);

  return {
    query: term,
    limit: normalizedLimit,
    counts: {
      players: players.length,
      walletBalances: walletBalances.length,
      purchaseIntents: purchaseIntents.length,
      walletTransactions: walletTransactions.length,
      paymentWebhookEvents: webhookEvents.length,
      assetInstances: assetInstances.length,
      equippedAssets: equippedAssets.length,
      assetRolls: assetRolls.length
    },
    players: players.map(rowToPlayer),
    walletBalances: walletBalances.map(rowToBalance),
    purchaseIntents: purchaseIntents.map(rowToPurchaseIntent),
    walletTransactions: walletTransactions.map(rowToWalletTransaction),
    paymentWebhookEvents: webhookEvents.map(rowToWebhookEvent),
    assetInstances: assetInstances.map(rowToAssetInstance),
    equippedAssets: equippedAssets.map(rowToEquippedAsset),
    assetRolls: assetRolls.map(rowToAssetRoll)
  };
}
