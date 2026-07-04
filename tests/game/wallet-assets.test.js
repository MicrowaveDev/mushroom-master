import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import request from 'supertest';
import {
  createPlayer,
  freshDb,
  bootRun,
  earnMycelium
} from './helpers.js';
import { query } from '../../app/server/db.js';
import {
  getBootstrap,
  getPlayerState,
  switchPortrait
} from '../../app/server/services/game-service.js';
import {
  auditWalletMirror,
  backfillMissingWalletBalancesFromPlayers,
  completePurchaseIntent,
  completeProviderWebhook,
  createPurchaseIntent,
  getWalletState,
  getPaymentSupportLinks,
  grantCurrencyForPlayer,
  processProviderWebhookEvent,
  spendCurrencyForPlayer,
  validateTelegramPreCheckout
} from '../../app/server/services/wallet-service.js';
import {
  getAssetCatalog,
  getAssetPacksForPlayer,
  getPackOdds,
  getPackOddsForRuntime,
  portraitAssetId,
  burnAssetPackDuplicates,
  equipAsset,
  purchaseAsset,
  rollAssetPack,
  validateAssetPack
} from '../../app/server/services/asset-service.js';
import { createPaymentSupportReply, handleTelegramWebhook } from '../../app/server/bot-gateway.js';
import {
  createApp,
  nowPaymentsSignaturePayload,
  verifyPaymentWebhookSignature,
  verifyPaymentWebhookTimestamp
} from '../../app/server/create-app.js';
import { supportGrantAsset } from '../../app/server/services/support-ops-service.js';

async function withEnv(overrides, work) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  try {
    return await work();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

async function insertPendingWalletIntent({
  playerId,
  provider = 'btcpay',
  idempotencyKey,
  checkoutStatus = null,
  checkoutClaimToken = null,
  checkoutClaimedAt = null,
  metadata = {}
}) {
  const id = `wpintent_test_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const baseMetadata = {
    bundleId: 'coins_small',
    checkoutProvider: provider,
    paymentSurface: 'web',
    ...metadata
  };
  await query(
    `INSERT INTO wallet_purchase_intents
     (id, player_id, provider, provider_invoice_id, currency_code, wallet_amount,
      price_amount, price_currency, status, checkout_status, checkout_claim_token,
      checkout_claimed_at, idempotency_key, metadata_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'soft_coin', 100, 100, 'USD', 'pending',
      $5, $6, $7, $8, $9, $10, $10)`,
    [
      id,
      playerId,
      provider,
      `invoice_${provider}_seed`,
      checkoutStatus,
      checkoutClaimToken,
      checkoutClaimedAt,
      idempotencyKey,
      JSON.stringify(baseMetadata),
      now
    ]
  );
  return id;
}

async function insertMutationClaim({
  scope,
  claimKey,
  claimToken = `claim_test_${crypto.randomUUID()}`,
  claimedAt = new Date().toISOString()
}) {
  await query(
    `INSERT INTO mutation_claims (scope, claim_key, claim_token, claimed_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)`,
    [scope, claimKey, claimToken, claimedAt]
  );
  return claimToken;
}

test('[Req 14-F] asset catalog acquisition policy respects defaults and overrides', async () => {
  await withEnv({
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha',
    ASSET_CATALOG_POLICY_JSON: JSON.stringify({
      [portraitAssetId('axilin', '1')]: { acquisitionMode: 'direct', packId: null }
    })
  }, async () => {
    const catalog = getAssetCatalog();
    const gachaDefault = catalog.find((asset) => asset.assetId === portraitAssetId('thalla', '1'));
    const directOverride = catalog.find((asset) => asset.assetId === portraitAssetId('axilin', '1'));

    assert.equal(gachaDefault.acquisitionMode, 'gacha');
    assert.equal(gachaDefault.packId, 'season_1_portraits');
    assert.equal(directOverride.acquisitionMode, 'direct');
    assert.equal(directOverride.packId, null);
  });
});

async function insertDbGachaPack({
  packId,
  seasonId = 'db_season_1',
  collectionId = 'db_collection_1',
  seasonStatus = 'active',
  collectionStatus = 'active',
  packStatus = 'active',
  reviewStatus = 'approved',
  rollPriceAmount = 13,
  rollSize = 1,
  rarityTableVersion = `${packId}:db:v1`,
  name = { en: 'Database Pack', ru: 'Пак из базы' },
  rarityWeights = null,
  slots = null,
  guarantees = null,
  pityRules = null,
  duplicatePolicy = null,
  burnRules = null,
  items
}) {
  const now = new Date().toISOString();
  await query(
    `INSERT INTO asset_gacha_seasons
     (id, name_json, status, starts_at, ends_at, metadata_json, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, NULL, NULL, '{}', 'test', $4, $4)`,
    [seasonId, JSON.stringify({ en: 'DB Season' }), seasonStatus, now]
  );
  await query(
    `INSERT INTO asset_gacha_collections
     (id, season_id, name_json, status, starts_at, ends_at, metadata_json, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NULL, NULL, '{}', 'test', $5, $5)`,
    [collectionId, seasonId, JSON.stringify({ en: 'DB Collection' }), collectionStatus, now]
  );
  await query(
    `INSERT INTO asset_gacha_packs
     (id, season_id, collection_id, name_json, status, review_status, starts_at, ends_at,
      roll_price_currency_code, roll_price_amount, roll_size, rarity_table_version,
      rarity_weights_json, slots_json, guarantees_json, pity_rules_json, duplicate_policy_json,
      burn_rules_json, metadata_json, created_by, reviewed_by, reviewed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, 'soft_coin', $7, $8, $9,
      $10, $11, $12, $13, $14, $15, '{}', 'test', $16, $17, $18, $18)`,
    [
      packId,
      seasonId,
      collectionId,
      JSON.stringify(name),
      packStatus,
      reviewStatus,
      rollPriceAmount,
      rollSize,
      rarityTableVersion,
      rarityWeights ? JSON.stringify(rarityWeights) : null,
      slots ? JSON.stringify(slots) : null,
      guarantees ? JSON.stringify(guarantees) : null,
      pityRules ? JSON.stringify(pityRules) : null,
      duplicatePolicy ? JSON.stringify(duplicatePolicy) : null,
      burnRules ? JSON.stringify(burnRules) : null,
      reviewStatus === 'approved' ? 'reviewer' : null,
      reviewStatus === 'approved' ? now : null,
      now
    ]
  );
  for (const [index, item] of items.entries()) {
    await query(
      `INSERT INTO asset_gacha_pack_items
       (id, pack_id, asset_id, rarity, drop_weight, copy_limit, item_order, metadata_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', $8, $8)`,
      [
        `dbitem_${packId}_${index}`,
        packId,
        item.assetId,
        item.rarity,
        item.dropWeight,
        item.copyLimit ?? null,
        index,
        now
      ]
    );
  }
}

test('[Req 4-Y, 9-A] run rewards grant profile wallet currency and keep players.spore mirrored', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 4001, mushroomId: 'thalla' });
  const before = await getPlayerState(playerId);
  await earnMycelium(playerId, run.id, 1);
  const after = await getPlayerState(playerId);

  assert.ok(after.wallet.balance > before.wallet.balance, 'round reward should increase wallet balance');
  assert.equal(after.player.spore, after.wallet.balance, 'players.spore compatibility mirror must match wallet balance');

  const tx = await query(
    `SELECT reason FROM player_wallet_transactions WHERE player_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [playerId]
  );
  assert.equal(tx.rows[0].reason, 'run_round_reward');
});

test('[Req 4-Z] crypto purchase intent completion grants wallet currency exactly once', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4002 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    idempotencyKey: 'intent-small'
  });

  assert.equal(intent.provider, 'btcpay');
  assert.equal(intent.walletAmount, 100);
  assert.equal(intent.checkout.type, 'crypto_invoice');

  await completePurchaseIntent({
    provider: 'btcpay',
    providerInvoiceId: intent.providerInvoiceId,
    providerPaymentId: 'btcpay-payment-1'
  });
  await completePurchaseIntent({
    provider: 'btcpay',
    providerInvoiceId: intent.providerInvoiceId,
    providerPaymentId: 'btcpay-payment-1'
  });

  const wallet = await getWalletState(player.id);
  assert.equal(wallet.balance, 100, 'duplicate provider completion must not grant twice');
});

test('[Req 4-Z] purchase providers create real checkout data when configured and respect payment surface policy', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4012 });

  await withEnv({ TELEGRAM_BOT_TOKEN: 'bot:test-token' }, async () => {
    const calls = [];
    const intent = await createPurchaseIntent(player.id, {
      bundleId: 'coins_small',
      provider: 'telegram_stars',
      surface: 'telegram_mini_app',
      idempotencyKey: 'stars-link',
      fetchImpl: async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        return {
          ok: true,
          async json() { return { ok: true, result: 'https://t.me/invoice/test-stars' }; }
        };
      }
    });

    assert.match(calls[0].url, /createInvoiceLink$/);
    assert.equal(calls[0].body.currency, 'XTR');
    assert.equal(calls[0].body.payload, intent.id);
    assert.equal(intent.checkout.invoiceLink, 'https://t.me/invoice/test-stars');
    assert.equal(intent.checkout.invoiceReady, true);
  });

  await assert.rejects(
    () => createPurchaseIntent(player.id, {
      bundleId: 'coins_small',
      provider: 'btcpay',
      surface: 'telegram_mini_app',
      idempotencyKey: 'bad-surface'
    }),
    (err) => err.statusCode === 403
  );

  await withEnv({
    BTCPAY_SERVER_URL: 'https://btcpay.example',
    BTCPAY_STORE_ID: 'store-1',
    BTCPAY_API_KEY: 'api-key'
  }, async () => {
    const calls = [];
    const intent = await createPurchaseIntent(player.id, {
      bundleId: 'coins_medium',
      provider: 'btcpay',
      surface: 'web',
      idempotencyKey: 'btcpay-link',
      fetchImpl: async (url, options) => {
        calls.push({ url, headers: options.headers, body: JSON.parse(options.body) });
        return {
          ok: true,
          async json() {
            return { id: 'btcpay-invoice-1', checkoutLink: 'https://btcpay.example/i/btcpay-invoice-1' };
          }
        };
      }
    });

    assert.match(calls[0].url, /\/api\/v1\/stores\/store-1\/invoices$/);
    assert.equal(calls[0].headers.Authorization, 'token api-key');
    assert.equal(calls[0].body.metadata.walletPurchaseIntentId, intent.id);
    assert.equal(intent.providerInvoiceId, 'btcpay-invoice-1');
    assert.equal(intent.checkout.checkoutUrl, 'https://btcpay.example/i/btcpay-invoice-1');
  });
});

test('[Req 4-Z] idempotent checkout retries reuse one provider invoice', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4016 });

  await withEnv({
    BTCPAY_SERVER_URL: 'https://btcpay.example',
    BTCPAY_STORE_ID: 'store-1',
    BTCPAY_API_KEY: 'api-key'
  }, async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        ok: true,
        async json() {
          return { id: 'btcpay-retry-invoice', checkoutLink: 'https://btcpay.example/i/retry' };
        }
      };
    };

    const [first, second] = await Promise.all([
      createPurchaseIntent(player.id, {
        bundleId: 'coins_small',
        provider: 'btcpay',
        surface: 'web',
        idempotencyKey: 'btcpay-retry',
        fetchImpl
      }),
      createPurchaseIntent(player.id, {
        bundleId: 'coins_small',
        provider: 'btcpay',
        surface: 'web',
        idempotencyKey: 'btcpay-retry',
        fetchImpl
      })
    ]);

    assert.equal(calls, 1, 'same idempotency key must not create duplicate provider invoices');
    assert.equal(first.id, second.id);
    assert.equal(first.providerInvoiceId, 'btcpay-retry-invoice');
    assert.equal(second.providerInvoiceId, 'btcpay-retry-invoice');
    assert.equal(second.checkout.checkoutUrl, 'https://btcpay.example/i/retry');
  });
});

test('[Req 4-Z] checkout retries wait for an in-progress database checkout claim', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4021 });
  const intentId = await insertPendingWalletIntent({
    playerId: player.id,
    provider: 'btcpay',
    idempotencyKey: 'btcpay-db-claim',
    checkoutStatus: 'creating',
    checkoutClaimToken: 'other-process',
    checkoutClaimedAt: new Date().toISOString()
  });

  await withEnv({
    WALLET_CHECKOUT_WAIT_TIMEOUT_MS: '500',
    WALLET_CHECKOUT_WAIT_INTERVAL_MS: '10'
  }, async () => {
    let calls = 0;
    let finishClaimError = null;
    const finishClaim = setTimeout(() => {
      query(
        `UPDATE wallet_purchase_intents
         SET provider_invoice_id = 'btcpay-db-ready',
             checkout_status = 'ready',
             checkout_claim_token = NULL,
             checkout_claimed_at = NULL,
             metadata_json = $2,
             updated_at = $3
         WHERE id = $1`,
        [
          intentId,
          JSON.stringify({
            bundleId: 'coins_small',
            checkoutProvider: 'btcpay',
            paymentSurface: 'web',
            checkout: {
              type: 'crypto_invoice',
              provider: 'btcpay',
              providerInvoiceId: 'btcpay-db-ready',
              checkoutUrl: 'https://btcpay.example/i/db-ready',
              invoiceReady: true
            }
          }),
          new Date().toISOString()
        ]
      ).catch((err) => {
        finishClaimError = err;
      });
    }, 30);

    try {
      const intent = await createPurchaseIntent(player.id, {
        bundleId: 'coins_small',
        provider: 'btcpay',
        surface: 'web',
        idempotencyKey: 'btcpay-db-claim',
        fetchImpl: async () => {
          calls += 1;
          throw new Error('provider should not be called while another checkout claim is active');
        }
      });

      assert.equal(calls, 0);
      assert.equal(intent.id, intentId);
      assert.equal(intent.checkoutStatus, 'ready');
      assert.equal(intent.providerInvoiceId, 'btcpay-db-ready');
      assert.equal(intent.checkout.checkoutUrl, 'https://btcpay.example/i/db-ready');
      assert.equal(finishClaimError, null);
    } finally {
      clearTimeout(finishClaim);
    }
  });
});

test('[Req 4-Z] stale checkout claims can be reclaimed without a new intent', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4022 });
  const intentId = await insertPendingWalletIntent({
    playerId: player.id,
    provider: 'btcpay',
    idempotencyKey: 'btcpay-stale-claim',
    checkoutStatus: 'creating',
    checkoutClaimToken: 'stale-process',
    checkoutClaimedAt: '2000-01-01T00:00:00.000Z'
  });

  await withEnv({
    BTCPAY_SERVER_URL: 'https://btcpay.example',
    BTCPAY_STORE_ID: 'store-1',
    BTCPAY_API_KEY: 'api-key'
  }, async () => {
    let calls = 0;
    const intent = await createPurchaseIntent(player.id, {
      bundleId: 'coins_small',
      provider: 'btcpay',
      surface: 'web',
      idempotencyKey: 'btcpay-stale-claim',
      fetchImpl: async () => {
        calls += 1;
        return {
          ok: true,
          async json() {
            return { id: 'btcpay-reclaimed', checkoutLink: 'https://btcpay.example/i/reclaimed' };
          }
        };
      }
    });

    assert.equal(calls, 1);
    assert.equal(intent.id, intentId);
    assert.equal(intent.checkoutStatus, 'ready');
    assert.equal(intent.providerInvoiceId, 'btcpay-reclaimed');
    assert.equal(intent.checkout.checkoutUrl, 'https://btcpay.example/i/reclaimed');

    const stored = await query(
      `SELECT checkout_status, checkout_claim_token, checkout_claimed_at
       FROM wallet_purchase_intents
       WHERE id = $1`,
      [intentId]
    );
    assert.equal(stored.rows[0].checkout_status, 'ready');
    assert.equal(stored.rows[0].checkout_claim_token, null);
    assert.equal(stored.rows[0].checkout_claimed_at, null);
  });
});

test('[Req 4-Z] payment webhook signatures are provider-specific', async () => {
  const btcpayBody = '{"invoiceId":"invoice-1","type":"InvoiceSettled"}';
  const btcpaySig = crypto.createHmac('sha256', 'btcpay-secret').update(btcpayBody).digest('hex');
  await withEnv({ BTCPAY_WEBHOOK_SECRET: 'btcpay-secret', BTCPAY_WEBHOOK_SECRETS: '' }, async () => {
    const req = {
      rawBody: btcpayBody,
      body: JSON.parse(btcpayBody),
      header(name) {
        return name.toLowerCase() === 'btcpay-sig' ? `sha256=${btcpaySig}` : '';
      }
    };
    assert.equal(verifyPaymentWebhookSignature(req, 'btcpay'), true);
    assert.equal(verifyPaymentWebhookSignature({ ...req, header: () => 'sha256=bad' }, 'btcpay'), false);
  });

  const btcpayOldSig = crypto.createHmac('sha256', 'btcpay-old-secret').update(btcpayBody).digest('hex');
  await withEnv({
    BTCPAY_WEBHOOK_SECRET: 'btcpay-new-secret',
    BTCPAY_WEBHOOK_SECRETS: 'btcpay-old-secret,btcpay-older-secret'
  }, async () => {
    const req = {
      rawBody: btcpayBody,
      body: JSON.parse(btcpayBody),
      header(name) {
        return name.toLowerCase() === 'btcpay-sig' ? `sha256=${btcpayOldSig}` : '';
      }
    };
    assert.equal(verifyPaymentWebhookSignature(req, 'btcpay'), true);
  });

  const nowBody = { payment_status: 'finished', order_id: 'intent-1', nested: { z: 1, a: 2 } };
  assert.equal(
    nowPaymentsSignaturePayload(nowBody),
    '{"nested":{"a":2,"z":1},"order_id":"intent-1","payment_status":"finished"}'
  );
  const nowSig = crypto.createHmac('sha512', 'now-secret').update(nowPaymentsSignaturePayload(nowBody)).digest('hex');
  await withEnv({ NOWPAYMENTS_IPN_SECRET: 'now-secret', NOWPAYMENTS_IPN_SECRETS: '' }, async () => {
    const req = {
      rawBody: JSON.stringify({ payment_status: 'finished', nested: { z: 1, a: 2 }, order_id: 'intent-1' }),
      body: nowBody,
      header(name) {
        return name.toLowerCase() === 'x-nowpayments-sig' ? nowSig : '';
      }
    };
    assert.equal(verifyPaymentWebhookSignature(req, 'nowpayments'), true);
    assert.equal(verifyPaymentWebhookSignature({ ...req, header: () => 'bad' }, 'nowpayments'), false);
  });

  const nowOldSig = crypto.createHmac('sha512', 'now-old-secret').update(nowPaymentsSignaturePayload(nowBody)).digest('hex');
  await withEnv({
    NOWPAYMENTS_IPN_SECRET: 'now-new-secret',
    NOWPAYMENTS_IPN_SECRETS: JSON.stringify(['now-old-secret', 'now-older-secret'])
  }, async () => {
    const req = {
      rawBody: JSON.stringify(nowBody),
      body: nowBody,
      header(name) {
        return name.toLowerCase() === 'x-nowpayments-sig' ? nowOldSig : '';
      }
    };
    assert.equal(verifyPaymentWebhookSignature(req, 'nowpayments'), true);
  });

  await withEnv({
    NODE_ENV: 'development',
    BTCPAY_WEBHOOK_SECRET: '',
    BTCPAY_WEBHOOK_SECRETS: '',
    PAYMENT_WEBHOOK_ALLOW_UNSIGNED_DEV: ''
  }, async () => {
    const req = {
      rawBody: btcpayBody,
      body: JSON.parse(btcpayBody),
      header() { return ''; }
    };
    assert.equal(verifyPaymentWebhookSignature(req, 'btcpay'), false);
  });

  await withEnv({
    NODE_ENV: 'development',
    BTCPAY_WEBHOOK_SECRET: '',
    BTCPAY_WEBHOOK_SECRETS: '',
    PAYMENT_WEBHOOK_ALLOW_UNSIGNED_DEV: 'true'
  }, async () => {
    const req = {
      rawBody: btcpayBody,
      body: JSON.parse(btcpayBody),
      header() { return ''; }
    };
    assert.equal(verifyPaymentWebhookSignature(req, 'btcpay'), true);
  });
});

test('[Req 4-Z] payment webhook timestamp freshness is enforced when present or required', async () => {
  const now = new Date('2026-07-02T12:00:00.000Z');
  const reqWithHeader = (headerValue, body = {}) => ({
    body,
    header(name) {
      return name.toLowerCase() === 'x-webhook-timestamp' ? headerValue : '';
    }
  });
  const freshHeader = verifyPaymentWebhookTimestamp(
    reqWithHeader('2026-07-02T11:59:30.000Z'),
    'btcpay',
    { now }
  );
  assert.equal(freshHeader.ok, true);
  assert.equal(freshHeader.reason, 'timestamp_fresh');

  const staleHeader = verifyPaymentWebhookTimestamp(
    reqWithHeader('2026-07-02T11:40:00.000Z'),
    'btcpay',
    { now }
  );
  assert.equal(staleHeader.ok, false);
  assert.equal(staleHeader.reason, 'stale_timestamp');

  const futureHeader = verifyPaymentWebhookTimestamp(
    reqWithHeader('2026-07-02T12:30:00.000Z'),
    'btcpay',
    { now }
  );
  assert.equal(futureHeader.ok, false);
  assert.equal(futureHeader.reason, 'future_timestamp');

  const payloadTimestamp = verifyPaymentWebhookTimestamp(
    reqWithHeader('', { webhook: { timestamp: Math.floor(now.getTime() / 1000) } }),
    'nowpayments',
    { now }
  );
  assert.equal(payloadTimestamp.ok, true);

  const missingAllowed = verifyPaymentWebhookTimestamp(reqWithHeader(''), 'btcpay', { now });
  assert.equal(missingAllowed.ok, true);
  assert.equal(missingAllowed.reason, 'timestamp_not_provided');

  await withEnv({ PAYMENT_WEBHOOK_REQUIRE_TIMESTAMP: 'true' }, async () => {
    const missingRequired = verifyPaymentWebhookTimestamp(reqWithHeader(''), 'btcpay', { now });
    assert.equal(missingRequired.ok, false);
    assert.equal(missingRequired.reason, 'missing_timestamp');
  });

  await withEnv({ BTCPAY_WEBHOOK_REQUIRE_TIMESTAMP: 'true' }, async () => {
    const invalidRequired = verifyPaymentWebhookTimestamp(reqWithHeader('not-a-date'), 'btcpay', { now });
    assert.equal(invalidRequired.ok, false);
    assert.equal(invalidRequired.reason, 'invalid_timestamp');
  });
});

test('[Req 4-Z] payment webhook route rejects stale timestamped deliveries before processing', async () => {
  await freshDb();
  const app = await createApp();
  const response = await request(app)
    .post('/api/wallet/purchase-webhook/btcpay')
    .set('x-webhook-timestamp', '2026-07-02T11:40:00.000Z')
    .send({
      deliveryId: 'stale-webhook-route',
      type: 'InvoiceSettled',
      invoiceId: 'unknown-invoice'
    });
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Invalid payment webhook timestamp');
  assert.equal(response.body.reason, 'stale_timestamp');

  const stored = await query(`SELECT * FROM payment_webhook_events WHERE event_key = $1`, [
    'event:stale-webhook-route'
  ]);
  assert.equal(stored.rowCount, 0);
});

test('[Req 4-Z] provider webhooks ignore incomplete statuses and complete settled payments once', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4015 });
  const intent = await withEnv({
    BTCPAY_SERVER_URL: 'https://btcpay.example',
    BTCPAY_STORE_ID: 'store-1',
    BTCPAY_API_KEY: 'api-key'
  }, () => createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'btcpay-webhook-status',
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { id: 'btcpay-invoice-status', checkoutLink: 'https://btcpay.example/i/status' };
      }
    })
  }));

  const ignored = await completeProviderWebhook('btcpay', {
    type: 'InvoiceProcessing',
    invoiceId: intent.providerInvoiceId
  });
  assert.equal(ignored.ignored, true);
  assert.equal((await getWalletState(player.id)).balance, 0);

  const completed = await completeProviderWebhook('btcpay', {
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-payment-status'
  });
  assert.equal(completed.alreadyCompleted, false);
  assert.equal((await getWalletState(player.id)).balance, 100);

  const replay = await completeProviderWebhook('btcpay', {
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-payment-status'
  });
  assert.equal(replay.alreadyCompleted, true);
  assert.equal((await getWalletState(player.id)).balance, 100);
});

test('[Req 4-Z] payment webhook event replay returns stored result without reprocessing', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4025 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'btcpay-webhook-event'
  });
  const payload = {
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-payment-event'
  };
  const rawBody = JSON.stringify(payload);

  const first = await processProviderWebhookEvent('btcpay', payload, { rawBody });
  const replay = await processProviderWebhookEvent('btcpay', payload, { rawBody });

  assert.equal(first.webhookEvent.duplicate, false);
  assert.equal(replay.webhookEvent.duplicate, true);
  assert.equal(replay.webhookEvent.replayed, true);
  assert.equal((await getWalletState(player.id)).balance, 100);

  const events = await query(
    `SELECT processing_status, result_json
     FROM payment_webhook_events
     WHERE provider = 'btcpay'`
  );
  assert.equal(events.rowCount, 1);
  assert.equal(events.rows[0].processing_status, 'processed');
  assert.equal(JSON.parse(events.rows[0].result_json).alreadyCompleted, false);
});

test('[Req 4-Z] payment webhook replay with changed payload is rejected', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4026 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'btcpay-webhook-mismatch'
  });
  const firstPayload = {
    deliveryId: 'delivery-replay-1',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-payment-mismatch-a'
  };
  await processProviderWebhookEvent('btcpay', firstPayload, { rawBody: JSON.stringify(firstPayload) });

  const changedPayload = {
    ...firstPayload,
    paymentId: 'btcpay-payment-mismatch-b'
  };
  await assert.rejects(
    () => processProviderWebhookEvent('btcpay', changedPayload, { rawBody: JSON.stringify(changedPayload) }),
    (err) => err.statusCode === 409 && /payload mismatch/.test(err.message)
  );

  assert.equal((await getWalletState(player.id)).balance, 100);
  const events = await query(
    `SELECT event_key, processing_status
     FROM payment_webhook_events
     WHERE provider = 'btcpay'`
  );
  assert.equal(events.rowCount, 1);
  assert.equal(events.rows[0].event_key, 'event:delivery-replay-1');
  assert.equal(events.rows[0].processing_status, 'processed');
});

test('[Req 4-Z] provider webhooks validate fiat amount and currency before granting', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4017 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'nowpayments',
    surface: 'web',
    idempotencyKey: 'nowpayments-price-check'
  });

  await assert.rejects(
    () => completeProviderWebhook('nowpayments', {
      payment_status: 'finished',
      payment_id: intent.providerInvoiceId,
      order_id: intent.id,
      price_amount: '2.00',
      price_currency: 'usd'
    }),
    (err) => err.statusCode === 400
  );
  assert.equal((await getWalletState(player.id)).balance, 0);

  await completeProviderWebhook('nowpayments', {
    payment_status: 'finished',
    payment_id: intent.providerInvoiceId,
    order_id: intent.id,
    price_amount: '1.00',
    price_currency: 'usd'
  });
  assert.equal((await getWalletState(player.id)).balance, 100);
});

test('[Req 4-Z] BTCPay settlement can verify invoice amount through provider lookup', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4018 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_medium',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'btcpay-lookup-check'
  });

  await withEnv({
    BTCPAY_SERVER_URL: 'https://btcpay.example',
    BTCPAY_STORE_ID: 'store-1',
    BTCPAY_API_KEY: 'api-key'
  }, async () => {
    const calls = [];
    await completeProviderWebhook('btcpay', {
      type: 'InvoiceSettled',
      invoiceId: intent.providerInvoiceId,
      paymentId: 'btcpay-payment-lookup'
    }, {
      fetchImpl: async (url, options) => {
        calls.push({ url, headers: options.headers });
        return {
          ok: true,
          async json() { return { amount: '5.00', currency: 'USD' }; }
        };
      }
    });

    assert.match(calls[0].url, /\/api\/v1\/stores\/store-1\/invoices\//);
    assert.equal(calls[0].headers.Authorization, 'token api-key');
    assert.equal((await getWalletState(player.id)).balance, 550);
  });
});

test('[Req 4-Z] terminal provider payment statuses are recorded without granting coins', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4019 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'nowpayments',
    surface: 'web',
    idempotencyKey: 'nowpayments-expired'
  });

  const recorded = await completeProviderWebhook('nowpayments', {
    payment_status: 'expired',
    payment_id: intent.providerInvoiceId,
    order_id: intent.id
  });

  assert.equal(recorded.statusRecorded, true);
  assert.equal(recorded.intent.status, 'expired');
  assert.equal((await getWalletState(player.id)).balance, 0);

  const stored = await query(`SELECT status FROM wallet_purchase_intents WHERE id = $1`, [intent.id]);
  assert.equal(stored.rows[0].status, 'expired');
});

test('[Req 4-Z] post-completion provider refund claws back wallet currency once', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4027 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'btcpay-refund-clawback'
  });
  const settledPayload = {
    deliveryId: 'btcpay-refund-clawback-settled',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-refund-clawback-payment'
  };
  await processProviderWebhookEvent('btcpay', settledPayload, { rawBody: JSON.stringify(settledPayload) });
  assert.equal((await getWalletState(player.id)).balance, 100);

  const refundPayload = {
    deliveryId: 'btcpay-refund-clawback-refunded',
    type: 'InvoicePaymentRefunded',
    status: 'refunded',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-refund-clawback-payment'
  };
  const refund = await processProviderWebhookEvent('btcpay', refundPayload, {
    rawBody: JSON.stringify(refundPayload)
  });
  const replay = await processProviderWebhookEvent('btcpay', refundPayload, {
    rawBody: JSON.stringify(refundPayload)
  });

  assert.equal(refund.intent.status, 'refunded');
  assert.equal(refund.reversalRecorded, true);
  assert.equal(refund.clawbackStatus, 'completed');
  assert.equal(refund.supportRequired, false);
  assert.equal(refund.transaction.delta, -100);
  assert.equal(replay.webhookEvent.duplicate, true);
  assert.equal((await getWalletState(player.id)).balance, 0);

  const stored = await query(`SELECT status, metadata_json FROM wallet_purchase_intents WHERE id = $1`, [intent.id]);
  assert.equal(stored.rows[0].status, 'refunded');
  assert.equal(JSON.parse(stored.rows[0].metadata_json).clawback.status, 'completed');
  const tx = await query(
    `SELECT reason, delta FROM player_wallet_transactions
     WHERE source_id = $1
     ORDER BY created_at ASC`,
    [intent.id]
  );
  assert.deepEqual(tx.rows.map((row) => [row.reason, Number(row.delta)]), [
    ['wallet_purchase', 100],
    ['wallet_purchase_reversal', -100]
  ]);
});

test('[Req 4-Z] post-completion provider refund records support follow-up when balance is spent', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4028 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'btcpay-refund-insufficient'
  });
  const settledPayload = {
    deliveryId: 'btcpay-refund-insufficient-settled',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-refund-insufficient-payment'
  };
  await processProviderWebhookEvent('btcpay', settledPayload, { rawBody: JSON.stringify(settledPayload) });
  await spendCurrencyForPlayer({
    playerId: player.id,
    amount: 100,
    reason: 'test_wallet_spend',
    sourceType: 'test',
    sourceId: 'spent-before-refund',
    idempotencyKey: 'spent-before-refund'
  });

  const refundPayload = {
    deliveryId: 'btcpay-refund-insufficient-refunded',
    status: 'refunded',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-refund-insufficient-payment'
  };
  const refund = await processProviderWebhookEvent('btcpay', refundPayload, {
    rawBody: JSON.stringify(refundPayload)
  });

  assert.equal(refund.intent.status, 'refunded');
  assert.equal(refund.clawbackStatus, 'insufficient_balance');
  assert.equal(refund.supportRequired, true);
  assert.equal(refund.transaction, null);
  assert.equal((await getWalletState(player.id)).balance, 0);
  const stored = await query(`SELECT status, metadata_json FROM wallet_purchase_intents WHERE id = $1`, [intent.id]);
  assert.equal(stored.rows[0].status, 'refunded');
  assert.equal(JSON.parse(stored.rows[0].metadata_json).clawback.status, 'insufficient_balance');
});

test('[Req 4-Z] post-completion provider dispute is recorded for support review without clawback', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4029 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'btcpay',
    surface: 'web',
    idempotencyKey: 'btcpay-dispute-review'
  });
  const settledPayload = {
    deliveryId: 'btcpay-dispute-review-settled',
    type: 'InvoiceSettled',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-dispute-review-payment'
  };
  await processProviderWebhookEvent('btcpay', settledPayload, { rawBody: JSON.stringify(settledPayload) });

  const disputePayload = {
    deliveryId: 'btcpay-dispute-review-disputed',
    status: 'disputed',
    invoiceId: intent.providerInvoiceId,
    paymentId: 'btcpay-dispute-review-payment'
  };
  const dispute = await processProviderWebhookEvent('btcpay', disputePayload, {
    rawBody: JSON.stringify(disputePayload)
  });

  assert.equal(dispute.intent.status, 'disputed');
  assert.equal(dispute.supportRequired, true);
  assert.equal(dispute.transaction, null);
  assert.equal((await getWalletState(player.id)).balance, 100);
  const stored = await query(`SELECT status, metadata_json FROM wallet_purchase_intents WHERE id = $1`, [intent.id]);
  assert.equal(stored.rows[0].status, 'disputed');
  assert.equal(JSON.parse(stored.rows[0].metadata_json).supportReview.reason, 'disputed');
});

test('[Req 4-Y] concurrent wallet spends cannot overdraw the profile balance', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4013 });
  await grantCurrencyForPlayer({
    playerId: player.id,
    amount: 500,
    reason: 'test_wallet_grant',
    sourceType: 'test',
    sourceId: 'concurrency'
  });

  const results = await Promise.allSettled([
    spendCurrencyForPlayer({
      playerId: player.id,
      amount: 400,
      reason: 'test_concurrent_spend',
      sourceType: 'test',
      sourceId: 'a',
      idempotencyKey: 'concurrent-a'
    }),
    spendCurrencyForPlayer({
      playerId: player.id,
      amount: 400,
      reason: 'test_concurrent_spend',
      sourceType: 'test',
      sourceId: 'b',
      idempotencyKey: 'concurrent-b'
    })
  ]);

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  assert.equal(fulfilled.length, 1, 'only one spend can win against a 500 balance');
  const wallet = await getWalletState(player.id);
  assert.equal(wallet.balance, 100);
});

test('[Req 4-Y] wallet audit reports missing rows and mirror drift', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4020 });
  await query(`UPDATE players SET spore = 77 WHERE id = $1`, [player.id]);
  await query(`DELETE FROM player_wallet_balances WHERE player_id = $1`, [player.id]);

  const missing = await auditWalletMirror();
  assert.equal(missing.total, 1);
  assert.equal(missing.items[0].issue, 'missing_wallet_balance');

  const backfill = await backfillMissingWalletBalancesFromPlayers();
  assert.equal(backfill.inserted, 1);
  assert.deepEqual(backfill.playerIds, [player.id]);
  assert.equal((await auditWalletMirror()).total, 0);

  await query(
    `UPDATE player_wallet_balances SET balance = 12 WHERE player_id = $1 AND currency_code = 'soft_coin'`,
    [player.id]
  );
  const drift = await auditWalletMirror();
  assert.equal(drift.total, 1);
  assert.equal(drift.items[0].issue, 'mirror_mismatch');
  assert.equal(drift.items[0].legacyBalance, 77);
  assert.equal(drift.items[0].walletBalance, 12);
});

test('[Req 4-Z] Telegram Stars pre-checkout validates pending intents and successful payment completes once', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4003 });
  const intent = await createPurchaseIntent(player.id, {
    bundleId: 'coins_small',
    provider: 'telegram_stars',
    idempotencyKey: 'stars-small'
  });

  const valid = await validateTelegramPreCheckout({
    id: 'pcq-ok',
    invoice_payload: intent.id,
    currency: 'XTR',
    total_amount: intent.priceAmount
  });
  assert.equal(valid.ok, true);

  const mismatched = await validateTelegramPreCheckout({
    id: 'pcq-bad',
    invoice_payload: intent.id,
    currency: 'XTR',
    total_amount: intent.priceAmount + 1
  });
  assert.equal(mismatched.ok, false);

  const calls = [];
  const preCheckoutResult = await handleTelegramWebhook({
    pre_checkout_query: {
      id: 'pcq-ok',
      invoice_payload: intent.id,
      currency: 'XTR',
      total_amount: intent.priceAmount
    }
  }, {
    token: 'bot:test',
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { async json() { return { ok: true, result: true }; } };
    }
  });
  assert.equal(preCheckoutResult.kind, 'wallet_pre_checkout');
  assert.equal(calls[0].body.ok, true);

  await handleTelegramWebhook({
    message: {
      successful_payment: {
        invoice_payload: intent.id,
        currency: 'XTR',
        total_amount: intent.priceAmount,
        telegram_payment_charge_id: 'tg-charge-1'
      }
    }
  });
  await handleTelegramWebhook({
    message: {
      successful_payment: {
        invoice_payload: intent.id,
        currency: 'XTR',
        total_amount: intent.priceAmount,
        telegram_payment_charge_id: 'tg-charge-1'
      }
    }
  });

  const wallet = await getWalletState(player.id);
  assert.equal(wallet.balance, 100, 'duplicate successful_payment updates must not grant twice');
});

test('[Req 4-Y, 14-F] wallet currency earned on Thalla can buy and equip an Axilin portrait', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 4004, mushroomId: 'thalla' });
  await earnMycelium(playerId, run.id, 500);

  await purchaseAsset(playerId, portraitAssetId('axilin', '1'));
  await switchPortrait(playerId, 'axilin', '1');

  const state = await getPlayerState(playerId);
  assert.equal(state.progression.axilin.activePortrait, '1');
  assert.equal(state.progression.axilin.portraits.find((portrait) => portrait.id === '1').owned, true);
  assert.ok(state.progression.thalla.mycelium > 0, 'Thalla earned character XP');
  assert.equal(state.progression.axilin.mycelium, 0, 'Axilin did not need character XP to use the purchased skin');
});

test('[Req 4-Y, 14-F] direct asset purchase waits for an active database mutation claim', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 4023 });
  const assetId = portraitAssetId('axilin', '1');
  await grantCurrencyForPlayer({
    playerId: player.id,
    amount: 500,
    reason: 'test_wallet_grant',
    sourceType: 'test',
    sourceId: 'asset-claim'
  });
  await insertMutationClaim({
    scope: 'asset_purchase',
    claimKey: `${player.id}:${assetId}`
  });

  await withEnv({
    MUTATION_CLAIM_WAIT_TIMEOUT_MS: '500',
    MUTATION_CLAIM_WAIT_INTERVAL_MS: '10'
  }, async () => {
    let releaseError = null;
    const releaseClaim = setTimeout(() => {
      query(
        `DELETE FROM mutation_claims WHERE scope = $1 AND claim_key = $2`,
        ['asset_purchase', `${player.id}:${assetId}`]
      ).catch((err) => {
        releaseError = err;
      });
    }, 30);

    try {
      const purchase = await purchaseAsset(player.id, assetId, { idempotencyKey: 'direct-claim-wait' });
      assert.equal(releaseError, null);
      assert.equal(purchase.asset.assetId, assetId);
      assert.equal(purchase.alreadyOwned, false);
      assert.equal((await getWalletState(player.id)).balance, 0);
    } finally {
      clearTimeout(releaseClaim);
    }
  });

  const remainingClaim = await query(
    `SELECT 1 FROM mutation_claims WHERE scope = $1 AND claim_key = $2`,
    ['asset_purchase', `${player.id}:${assetId}`]
  );
  assert.equal(remainingClaim.rowCount, 0, 'asset purchase claim should be released');
});

test('[Req 14-F] gacha mode blocks configured direct buys and rolls unowned pack assets without duplicate spend', async () => {
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'direct',
    ASSET_CATALOG_POLICY_JSON: JSON.stringify({
      [portraitAssetId('thalla', '1')]: { acquisitionMode: 'gacha' },
      [portraitAssetId('axilin', '1')]: { acquisitionMode: 'direct', packId: null }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4005 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 1000,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'gacha'
    });

    await assert.rejects(
      () => purchaseAsset(player.id, portraitAssetId('thalla', '1')),
      (err) => err.statusCode === 403
    );
    const directOnly = await purchaseAsset(player.id, portraitAssetId('axilin', '1'));
    assert.equal(directOnly.asset.acquisitionMode, 'direct');

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.active, true);
    assert.equal(odds.availability, 'active');
    assert.equal(odds.validation.ok, true);
    assert.equal(odds.totalItems, 1);
    assert.equal(odds.remainingCount, 1);
    assert.deepEqual(odds.raritySummary.map((entry) => ({
      rarity: entry.rarity,
      count: entry.count,
      probability: entry.probability
    })), [{ rarity: 'rare', count: 1, probability: 1 }]);
    assert.deepEqual(odds.items.map((item) => item.assetId), [portraitAssetId('thalla', '1')]);

    const first = await rollAssetPack(player.id, odds.id, { idempotencyKey: 'roll-1', rng: () => 0 });
    assert.equal(first.rollResult.assetId, portraitAssetId('thalla', '1'));
    assert.equal(first.rollResult.packId, odds.id);
    assert.equal(first.rollResult.rarity, 'rare');
    const equipped = await equipAsset(player.id, first.rollResult.assetId);
    assert.equal(equipped.targetId, 'thalla');
    const equippedRow = await query(
      `SELECT asset_id, asset_instance_id
       FROM player_equipped_assets
       WHERE player_id = $1 AND slot = 'portrait' AND target_type = 'character' AND target_id = 'thalla'`,
      [player.id]
    );
    assert.equal(equippedRow.rowCount, 1);
    assert.equal(equippedRow.rows[0].asset_id, first.rollResult.assetId);
    assert.equal(equippedRow.rows[0].asset_instance_id, first.rollResult.resultInstanceId);
    const shapedPacks = await getAssetPacksForPlayer(player.id);
    const shapedPack = shapedPacks.find((pack) => pack.id === odds.id);
    assert.equal(shapedPack.ownedCount, 1);
    assert.equal(shapedPack.remainingCount, 0);
    assert.equal(shapedPack.complete, true);
    const replay = await rollAssetPack(player.id, odds.id, { idempotencyKey: 'roll-1', rng: () => 0.99 });
    assert.equal(replay.alreadyProcessed, true, 'same roll idempotency key should replay the first roll');
    assert.deepEqual(replay.roll.resultAssetIds, first.roll.resultAssetIds);
    assert.equal(replay.rollResult.assetId, first.rollResult.assetId);

    for (let i = 2; i <= odds.items.length; i += 1) {
      await rollAssetPack(player.id, odds.id, { idempotencyKey: `roll-${i}`, rng: () => 0 });
    }
    const beforeRejected = await getWalletState(player.id);
    await assert.rejects(
      () => rollAssetPack(player.id, odds.id, { idempotencyKey: 'roll-empty', rng: () => 0 }),
      (err) => err.statusCode === 409
    );
    const afterRejected = await getWalletState(player.id);
    assert.equal(afterRejected.balance, beforeRejected.balance, 'empty pack rejection must not spend wallet currency');
  });
});

test('[Req 14-F] approved database gacha packs override static packs and hide drafts', async () => {
  const commonA = portraitAssetId('thalla', '1');
  const rareA = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DB_PACKS_ENABLED: 'true',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha'
  }, async () => {
    await freshDb();
    await insertDbGachaPack({
      packId: 'season_1_portraits',
      rollPriceAmount: 17,
      rollSize: 2,
      slots: [
        { rarityWeights: { common: 1 } },
        { rarityWeights: { rare: 1 } }
      ],
      duplicatePolicy: { mode: 'allow_duplicates', maxCopiesPerAsset: 3 },
      items: [
        { assetId: commonA, rarity: 'common', dropWeight: 100, copyLimit: 3 },
        { assetId: rareA, rarity: 'rare', dropWeight: 1 }
      ]
    });
    await insertDbGachaPack({
      packId: 'db_draft_pack',
      seasonId: 'db_season_draft',
      collectionId: 'db_collection_draft',
      reviewStatus: 'draft',
      items: [
        { assetId: commonA, rarity: 'common', dropWeight: 1 }
      ]
    });
    const { player } = await createPlayer({ telegramId: 4033 });

    const odds = await getPackOddsForRuntime('season_1_portraits');
    assert.equal(odds.source, 'database');
    assert.equal(odds.reviewStatus, 'approved');
    assert.equal(odds.rollPriceAmount, 17);
    assert.equal(odds.rollSize, 2);
    assert.equal(odds.items.length, 2);
    assert.equal(odds.items[0].copyLimit, 3);
    assert.equal(odds.duplicatePolicy.maxCopiesPerAsset, 3);
    assert.equal(odds.validation.ok, true);

    await assert.rejects(
      () => getPackOddsForRuntime('db_draft_pack'),
      (err) => err.statusCode === 404 && /unknown asset pack/i.test(err.message)
    );
    const packs = await getAssetPacksForPlayer(player.id);
    assert.ok(packs.some((pack) => pack.id === 'season_1_portraits' && pack.source === 'database'));
    assert.equal(packs.some((pack) => pack.id === 'db_draft_pack'), false);
    const bootstrap = await getBootstrap(player.id);
    assert.deepEqual(bootstrap.assetAcquisition.activePackIds, ['season_1_portraits']);
  });
});

test('[Req 14-F] approved database gacha pack can roll and spend from runtime config', async () => {
  const commonA = portraitAssetId('thalla', '1');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DB_PACKS_ENABLED: 'true',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha'
  }, async () => {
    await freshDb();
    await insertDbGachaPack({
      packId: 'db_runtime_pack',
      seasonId: 'db_season_runtime',
      collectionId: 'db_collection_runtime',
      rollPriceAmount: 11,
      items: [
        { assetId: commonA, rarity: 'common', dropWeight: 1 }
      ]
    });
    const { player } = await createPlayer({ telegramId: 4034 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 50,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'db-gacha-pack'
    });

    const before = await getWalletState(player.id);
    const result = await rollAssetPack(player.id, 'db_runtime_pack', {
      idempotencyKey: 'db-runtime-roll',
      rng: () => 0
    });
    const after = await getWalletState(player.id);

    assert.equal(result.roll.packId, 'db_runtime_pack');
    assert.equal(result.roll.priceAmount, 11);
    assert.equal(result.rollResult.assetId, commonA);
    assert.equal(result.transaction.delta, -11);
    assert.equal(after.balance, before.balance - 11);
    const shapedPacks = await getAssetPacksForPlayer(player.id);
    const shapedPack = shapedPacks.find((pack) => pack.id === 'db_runtime_pack');
    assert.equal(shapedPack.source, 'database');
    assert.equal(shapedPack.ownedCount, 1);
    assert.equal(shapedPack.complete, true);
  });
});

test('[Req 14-F] multi-item gacha pack spends once and grants slot-weighted unowned assets', async () => {
  const commonA = portraitAssetId('thalla', '1');
  const commonB = portraitAssetId('lomie', '1');
  const rareA = portraitAssetId('thalla', '2');
  const rareB = portraitAssetId('axilin', '2');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha',
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        rollSize: 3,
        rarityTableVersion: 'test-slots:v2',
        slots: [
          { rarityWeights: { common: 1 } },
          { rarityWeights: { rare: 1 } },
          { rarityWeights: { common: 1, rare: 1 } }
        ],
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 1 },
          { assetId: commonB, rarity: 'common', dropWeight: 1 },
          { assetId: rareA, rarity: 'rare', dropWeight: 1 },
          { assetId: rareB, rarity: 'rare', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4026 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'multi-gacha'
    });

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.validation.ok, true);
    assert.equal(odds.rollSize, 3);
    assert.equal(odds.nextRollItemCount, 3);
    assert.equal(odds.rarityTableVersion, 'test-slots:v2');
    assert.deepEqual(odds.raritySummary.map((entry) => ({
      rarity: entry.rarity,
      count: entry.count,
      expectedPerOpen: entry.expectedPerOpen
    })), [
      { rarity: 'common', count: 2, expectedPerOpen: 1.5 },
      { rarity: 'rare', count: 2, expectedPerOpen: 1.5 }
    ]);

    const rngValues = [0, 0, 0, 0, 0.75, 0];
    let rngIndex = 0;
    const first = await rollAssetPack(player.id, odds.id, {
      idempotencyKey: 'multi-roll-1',
      rng: () => rngValues[rngIndex++ % rngValues.length]
    });
    assert.deepEqual(first.roll.resultAssetIds, [commonA, rareA, rareB]);
    assert.equal(first.roll.priceAmount, 10);
    assert.equal(first.roll.guaranteeState.rollSize, 3);
    assert.equal(first.roll.guaranteeState.effectiveRollSize, 3);
    assert.equal(first.roll.guaranteeState.rarityTableVersion, 'test-slots:v2');
    assert.equal(first.roll.selectedAssetId, commonA);
    assert.equal(first.rollResult.assetId, commonA, 'legacy first-result field remains populated');
    assert.equal(first.rollResult.count, 3);
    assert.deepEqual(first.rollResult.items.map((item) => item.assetId), [commonA, rareA, rareB]);
    assert.deepEqual(first.roll.metadata.results.map((item) => item.slotIndex), [0, 1, 2]);
    assert.deepEqual(first.roll.metadata.results.map((item) => item.selectedRarity), ['common', 'rare', 'rare']);
    assert.equal((await getWalletState(player.id)).balance, 90, 'multi-opening spends the pack price once');

    const ownedRows = await query(
      `SELECT asset_id, acquisition_source, acquisition_source_id, metadata_json
       FROM player_asset_instances
       WHERE player_id = $1 AND asset_id IN ($2, $3, $4)
       ORDER BY asset_id ASC`,
      [player.id, commonA, rareA, rareB]
    );
    assert.equal(ownedRows.rowCount, 3);
    assert.ok(ownedRows.rows.every((row) => row.acquisition_source === 'gacha'));
    assert.ok(ownedRows.rows.every((row) => row.acquisition_source_id === first.roll.id));
    assert.ok(ownedRows.rows.every((row) => JSON.parse(row.metadata_json).rarityTableVersion === 'test-slots:v2'));

    const replay = await rollAssetPack(player.id, odds.id, {
      idempotencyKey: 'multi-roll-1',
      rng: () => 0.99
    });
    assert.equal(replay.alreadyProcessed, true);
    assert.deepEqual(replay.roll.resultAssetIds, first.roll.resultAssetIds);
    assert.deepEqual(replay.rollResult.items.map((item) => item.assetId), first.rollResult.items.map((item) => item.assetId));
    assert.deepEqual(replay.rollResult.items.map((item) => item.resultInstanceId), first.rollResult.items.map((item) => item.resultInstanceId));
    assert.equal((await getWalletState(player.id)).balance, 90, 'idempotent replay does not spend twice');

    const shapedPacks = await getAssetPacksForPlayer(player.id);
    const shapedPack = shapedPacks.find((pack) => pack.id === odds.id);
    assert.equal(shapedPack.ownedCount, 3);
    assert.equal(shapedPack.remainingCount, 1);
    assert.equal(shapedPack.nextRollItemCount, 1, 'near-complete pack opens only remaining unowned assets until duplicate rules exist');
  });
});

test('[Req 14-F] duplicate-enabled gacha packs can roll owned skins as active copies', async () => {
  const commonA = portraitAssetId('thalla', '1');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha',
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        duplicatePolicy: 'allow_duplicates',
        rollSize: 1,
        slots: [
          { rarityWeights: { common: 1 } }
        ],
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4029 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'duplicate-gacha'
    });

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.validation.ok, true);
    assert.equal(odds.duplicatePolicy.enabled, true);
    assert.equal(odds.complete, false);

    const first = await rollAssetPack(player.id, odds.id, { idempotencyKey: 'duplicate-roll-1', rng: () => 0 });
    const second = await rollAssetPack(player.id, odds.id, { idempotencyKey: 'duplicate-roll-2', rng: () => 0 });
    assert.equal(first.rollResult.assetId, commonA);
    assert.equal(first.rollResult.items[0].duplicateCopy, false);
    assert.equal(second.rollResult.assetId, commonA);
    assert.equal(second.rollResult.items[0].duplicateCopy, true);
    assert.notEqual(first.rollResult.resultInstanceId, second.rollResult.resultInstanceId);

    const rows = await query(
      `SELECT id, asset_id, status, metadata_json
       FROM player_asset_instances
       WHERE player_id = $1 AND asset_id = $2
       ORDER BY acquired_at ASC, id ASC`,
      [player.id, commonA]
    );
    assert.equal(rows.rowCount, 2);
    assert.ok(rows.rows.every((row) => row.status === 'active'));
    assert.deepEqual(rows.rows.map((row) => JSON.parse(row.metadata_json).duplicateCopy), [false, true]);

    const shapedPacks = await getAssetPacksForPlayer(player.id);
    const shapedPack = shapedPacks.find((pack) => pack.id === odds.id);
    assert.equal(shapedPack.ownedCount, 1);
    assert.equal(shapedPack.remainingCount, 0);
    assert.equal(shapedPack.uniqueComplete, true);
    assert.equal(shapedPack.complete, false);
    assert.equal(shapedPack.duplicateCopies, 1);
    assert.equal(shapedPack.rollableCount, 1);
    assert.equal(shapedPack.nextRollItemCount, 1);
    assert.equal((await getWalletState(player.id)).balance, 80);
  });
});

test('[Req 14-F] duplicate-enabled gacha packs can cap active copies per asset', async () => {
  const commonA = portraitAssetId('thalla', '1');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha',
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        duplicatePolicy: { mode: 'allow_duplicates', maxCopiesPerAsset: 2 },
        rollSize: 1,
        slots: [
          { rarityWeights: { common: 1 } }
        ],
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4031 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'duplicate-cap-gacha'
    });

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.validation.ok, true);
    assert.equal(odds.duplicatePolicy.maxCopiesPerAsset, 2);
    assert.equal(odds.items[0].copyLimit, 2);

    const first = await rollAssetPack(player.id, odds.id, { idempotencyKey: 'copy-cap-roll-1', rng: () => 0 });
    const second = await rollAssetPack(player.id, odds.id, { idempotencyKey: 'copy-cap-roll-2', rng: () => 0 });
    assert.equal(first.rollResult.items[0].duplicateCopy, false);
    assert.equal(second.rollResult.items[0].duplicateCopy, true);

    const beforeRejected = await getWalletState(player.id);
    await assert.rejects(
      () => rollAssetPack(player.id, odds.id, { idempotencyKey: 'copy-cap-roll-3', rng: () => 0 }),
      (err) => err.statusCode === 409 && /no rollable assets/i.test(err.message)
    );
    const afterRejected = await getWalletState(player.id);
    assert.equal(afterRejected.balance, beforeRejected.balance, 'copy-cap rejection must not spend wallet currency');

    const shapedPacks = await getAssetPacksForPlayer(player.id);
    const shapedPack = shapedPacks.find((pack) => pack.id === odds.id);
    assert.equal(shapedPack.complete, true);
    assert.equal(shapedPack.copyComplete, true);
    assert.equal(shapedPack.rollableCount, 0);
    assert.equal(shapedPack.duplicateCopies, 1);
    assert.equal(shapedPack.items[0].ownedCopies, 2);
    assert.equal(shapedPack.items[0].copyLimit, 2);
    assert.equal(shapedPack.items[0].copyCapped, true);
  });
});

test('[Req 14-F] duplicate burn exchanges spare copies for a random rare pack item', async () => {
  const commonA = portraitAssetId('thalla', '1');
  const rareA = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha',
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        duplicatePolicy: 'allow_duplicates',
        rollSize: 1,
        slots: [
          { rarityWeights: { common: 1 } }
        ],
        burnRules: [
          { id: 'two_common_to_rare', sourceRarity: 'common', sourceCount: 2, targetMinRarity: 'rare', targetCount: 1 }
        ],
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 1 },
          { assetId: rareA, rarity: 'rare', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4030 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'burn-gacha'
    });

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.validation.ok, true);

    for (let index = 1; index <= 3; index += 1) {
      const roll = await rollAssetPack(player.id, odds.id, {
        idempotencyKey: `burn-roll-${index}`,
        rng: () => 0
      });
      assert.equal(roll.rollResult.assetId, commonA);
    }

    const readyPacks = await getAssetPacksForPlayer(player.id);
    const readyPack = readyPacks.find((pack) => pack.id === odds.id);
    assert.equal(readyPack.duplicateCopies, 2);
    assert.equal(readyPack.burn.rules[0].ready, true);
    assert.equal(readyPack.burn.rules[0].burnableCount, 2);

    const burn = await burnAssetPackDuplicates(player.id, odds.id, {
      ruleId: 'two_common_to_rare',
      idempotencyKey: 'burn-1',
      rng: () => 0
    });
    assert.equal(burn.alreadyProcessed, false);
    assert.equal(burn.exchange.sourceAssetInstanceIds.length, 2);
    assert.deepEqual(burn.exchange.resultAssetIds, [rareA]);
    assert.equal(burn.burnResult.assetId, rareA);
    assert.equal(burn.burnResult.items[0].rarity, 'rare');

    const replay = await burnAssetPackDuplicates(player.id, odds.id, {
      ruleId: 'two_common_to_rare',
      idempotencyKey: 'burn-1',
      rng: () => 0.99
    });
    assert.equal(replay.alreadyProcessed, true);
    assert.equal(replay.exchange.id, burn.exchange.id);
    assert.deepEqual(replay.exchange.resultAssetIds, [rareA]);
    assert.equal(replay.burnResult.resultInstanceId, burn.burnResult.resultInstanceId);
    assert.deepEqual(replay.burnResult.sourceAssetInstanceIds, burn.burnResult.sourceAssetInstanceIds);

    const rows = await query(
      `SELECT asset_id, status, COUNT(*) AS count
       FROM player_asset_instances
       WHERE player_id = $1 AND asset_id IN ($2, $3)
       GROUP BY asset_id, status
       ORDER BY asset_id ASC, status ASC`,
      [player.id, commonA, rareA]
    );
    assert.deepEqual(rows.rows.map((row) => ({
      assetId: row.asset_id,
      status: row.status,
      count: Number(row.count)
    })), [
      { assetId: commonA, status: 'active', count: 1 },
      { assetId: commonA, status: 'burned', count: 2 },
      { assetId: rareA, status: 'active', count: 1 }
    ]);

    const afterPacks = await getAssetPacksForPlayer(player.id);
    const afterPack = afterPacks.find((pack) => pack.id === odds.id);
    assert.equal(afterPack.duplicateCopies, 0);
    assert.equal(afterPack.burn.rules[0].ready, false);
    assert.equal(afterPack.burn.rules[0].burnableCount, 0);
    assert.equal((await getWalletState(player.id)).balance, 70, 'burn exchange should not spend wallet currency');
  });
});

test('[Req 14-F] duplicate burn target policy can prefer or require unowned targets', async () => {
  const commonA = portraitAssetId('thalla', '1');
  const rareA = portraitAssetId('thalla', '2');
  const rareB = portraitAssetId('axilin', '2');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha',
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        duplicatePolicy: 'allow_duplicates',
        rollSize: 1,
        slots: [
          { rarityWeights: { common: 1 } }
        ],
        burnRules: [
          { id: 'two_common_to_unowned_first_rare', sourceRarity: 'common', sourceCount: 2, targetMinRarity: 'rare', targetCount: 1, targetDuplicatePolicy: 'unowned_first' },
          { id: 'two_common_to_unowned_only_rare', sourceRarity: 'common', sourceCount: 2, targetMinRarity: 'rare', targetCount: 1, targetDuplicatePolicy: 'unowned_only' }
        ],
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 1 },
          { assetId: rareA, rarity: 'rare', dropWeight: 99 },
          { assetId: rareB, rarity: 'rare', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4032 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'burn-target-policy'
    });
    await supportGrantAsset({
      actorId: 'test-support',
      playerId: player.id,
      assetId: rareA,
      reason: 'test_setup'
    });

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.validation.ok, true);
    assert.deepEqual(odds.burn.rules.map((rule) => rule.targetDuplicatePolicy), ['unowned_first', 'unowned_only']);

    for (let index = 1; index <= 3; index += 1) {
      await rollAssetPack(player.id, odds.id, {
        idempotencyKey: `target-policy-roll-${index}`,
        rng: () => 0
      });
    }

    const burn = await burnAssetPackDuplicates(player.id, odds.id, {
      ruleId: 'two_common_to_unowned_first_rare',
      idempotencyKey: 'target-policy-burn-1',
      rng: () => 0
    });
    assert.equal(burn.burnResult.assetId, rareB, 'unowned_first should choose the unowned rare before weighted owned duplicates');
    assert.equal(burn.burnResult.items[0].duplicateCopy, false);

    for (let index = 4; index <= 5; index += 1) {
      await rollAssetPack(player.id, odds.id, {
        idempotencyKey: `target-policy-roll-${index}`,
        rng: () => 0
      });
    }

    const beforeRejected = await query(
      `SELECT status, COUNT(*) AS count
       FROM player_asset_instances
       WHERE player_id = $1 AND asset_id = $2
       GROUP BY status
       ORDER BY status ASC`,
      [player.id, commonA]
    );
    await assert.rejects(
      () => burnAssetPackDuplicates(player.id, odds.id, {
        ruleId: 'two_common_to_unowned_only_rare',
        idempotencyKey: 'target-policy-burn-2',
        rng: () => 0
      }),
      (err) => err.statusCode === 400 && /target pool/i.test(err.message)
    );
    const afterRejected = await query(
      `SELECT status, COUNT(*) AS count
       FROM player_asset_instances
       WHERE player_id = $1 AND asset_id = $2
       GROUP BY status
       ORDER BY status ASC`,
      [player.id, commonA]
    );
    assert.deepEqual(afterRejected.rows, beforeRejected.rows, 'failed unowned_only exchange must roll back source burns');
  });
});

test('[Req 14-F] static gacha guarantees upgrade multi-item openings', async () => {
  const commonA = portraitAssetId('thalla', '1');
  const commonB = portraitAssetId('lomie', '1');
  const commonC = portraitAssetId('axilin', '1');
  const rareA = portraitAssetId('thalla', '2');
  const rareB = portraitAssetId('axilin', '2');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha',
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        rollSize: 3,
        rarityTableVersion: 'test-guarantee:v1',
        slots: [
          { rarityWeights: { common: 1 } },
          { rarityWeights: { common: 1 } },
          { rarityWeights: { common: 1 } }
        ],
        guarantees: [
          { id: 'two_rare_plus', minRarity: 'rare', count: 2 }
        ],
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 1 },
          { assetId: commonB, rarity: 'common', dropWeight: 1 },
          { assetId: commonC, rarity: 'common', dropWeight: 1 },
          { assetId: rareA, rarity: 'rare', dropWeight: 1 },
          { assetId: rareB, rarity: 'rare', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4027 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'guarantee-gacha'
    });

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.validation.ok, true);
    assert.deepEqual(odds.guarantees.rules, [{
      id: 'two_rare_plus',
      type: 'min_rarity_count',
      source: 'guarantee',
      minRarity: 'rare',
      count: 2,
      label: null
    }]);

    const roll = await rollAssetPack(player.id, odds.id, {
      idempotencyKey: 'guaranteed-roll',
      rng: () => 0
    });

    assert.deepEqual(roll.roll.resultAssetIds, [rareA, rareB, commonC]);
    assert.equal(roll.roll.guaranteeState.guaranteesApplied.length, 2);
    assert.deepEqual(roll.roll.guaranteeState.guaranteesApplied.map((entry) => entry.source), ['guarantee', 'guarantee']);
    assert.deepEqual(roll.roll.metadata.results.map((item) => item.guaranteeSource), ['guarantee', 'guarantee', null]);
    assert.deepEqual(roll.roll.metadata.results.map((item) => item.guaranteeReplacedAssetId), [commonA, commonB, null]);
    assert.deepEqual(roll.rollResult.guaranteesApplied.map((entry) => entry.selectedAssetId), [rareA, rareB]);
    assert.equal((await getWalletState(player.id)).balance, 90);

    const instanceRows = await query(
      `SELECT asset_id, metadata_json
       FROM player_asset_instances
       WHERE player_id = $1 AND asset_id IN ($2, $3)
       ORDER BY asset_id ASC`,
      [player.id, rareA, rareB]
    );
    assert.equal(instanceRows.rowCount, 2);
    assert.ok(instanceRows.rows.every((row) => JSON.parse(row.metadata_json).guaranteeSource === 'guarantee'));
  });
});

test('[Req 14-F] pack-scoped pity guarantees the next eligible gacha opening', async () => {
  const commonA = portraitAssetId('thalla', '1');
  const commonB = portraitAssetId('lomie', '1');
  const rareA = portraitAssetId('thalla', '2');
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'gacha',
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        rollSize: 1,
        rarityTableVersion: 'test-pity:v1',
        slots: [
          { rarityWeights: { common: 1 } }
        ],
        pityRules: [
          { id: 'rare_after_two_misses', minRarity: 'rare', threshold: 2, count: 1, resetScope: 'pack' }
        ],
        items: [
          { assetId: commonA, rarity: 'common', dropWeight: 1 },
          { assetId: commonB, rarity: 'common', dropWeight: 1 },
          { assetId: rareA, rarity: 'rare', dropWeight: 1 }
        ]
      }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4028 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'pity-gacha'
    });

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.validation.ok, true);
    assert.equal(odds.pity.rules[0].remaining, 2);
    assert.equal(odds.pity.rules[0].active, false);

    const first = await rollAssetPack(player.id, odds.id, {
      idempotencyKey: 'pity-roll-1',
      rng: () => 0
    });
    assert.deepEqual(first.roll.resultAssetIds, [commonA]);
    assert.equal(first.roll.guaranteeState.pityBefore[0].active, false);
    assert.equal(first.roll.guaranteeState.pityAfter[0].remaining, 1);
    assert.equal(first.roll.guaranteeState.pityAfter[0].active, true);

    const afterMissPacks = await getAssetPacksForPlayer(player.id);
    const afterMissPack = afterMissPacks.find((pack) => pack.id === odds.id);
    assert.equal(afterMissPack.pity.rules[0].remaining, 1);
    assert.equal(afterMissPack.pity.rules[0].active, true);

    const second = await rollAssetPack(player.id, odds.id, {
      idempotencyKey: 'pity-roll-2',
      rng: () => 0
    });
    assert.deepEqual(second.roll.resultAssetIds, [rareA]);
    assert.equal(second.roll.guaranteeState.guaranteesApplied[0].source, 'pity');
    assert.equal(second.roll.guaranteeState.guaranteesApplied[0].replacedAssetId, commonB);
    assert.equal(second.roll.guaranteeState.pityBefore[0].active, true);
    assert.equal(second.roll.guaranteeState.pityAfter[0].currentMisses, 0);
    assert.equal(second.rollResult.pityBefore[0].active, true);
    assert.equal(second.rollResult.pityAfter[0].remaining, 2);
    assert.equal((await getWalletState(player.id)).balance, 80);
  });
});

test('[Req 14-F] invalid gacha pack authoring is visible and blocks rolls without spending', async () => {
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'direct',
    ASSET_CATALOG_POLICY_JSON: JSON.stringify({
      [portraitAssetId('thalla', '1')]: { acquisitionMode: 'gacha' }
    }),
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: {
        rollSize: 11,
        duplicatePolicy: { mode: 'bad_mode', maxCopiesPerAsset: 0 },
        burnRules: [
          { id: 'bad_burn', sourceRarity: 'common', sourceCount: 0, targetMinRarity: 'mythic', targetCount: 99, targetDuplicatePolicy: 'owned_only' }
        ],
        guarantees: [
          { id: 'impossible_rare', minRarity: 'rare', count: 3 }
        ],
        pityRules: [
          { id: 'invalid_pity', minRarity: 'rare', threshold: 0, count: 3, resetScope: 'season' }
        ],
        items: [
          { assetId: portraitAssetId('thalla', '1'), rarity: 'common', dropWeight: 0, copyLimit: 0 },
          { assetId: portraitAssetId('thalla', '1'), rarity: 'secretish', dropWeight: 1 },
          { assetId: 'portrait.missing.ghost', rarity: 'secret', dropWeight: 10 }
        ]
      }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4025 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'invalid-gacha-pack'
    });

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.active, false);
    assert.equal(odds.availability, 'invalid');
    assert.equal(odds.validation.ok, false);
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'roll_size_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'item_asset_duplicate'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'item_rarity_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'item_weight_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'item_asset_unknown'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'guarantee_impossible'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'pity_threshold_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'pity_scope_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'pity_impossible'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'duplicate_policy_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'duplicate_copy_cap_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'item_copy_cap_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'burn_requires_duplicates'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'burn_source_count_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'burn_target_rarity_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'burn_target_count_invalid'));
    assert.ok(odds.validation.errors.find((entry) => entry.code === 'burn_target_policy_invalid'));
    assert.equal(validateAssetPack(odds).ok, false);

    const before = await getWalletState(player.id);
    await assert.rejects(
      () => rollAssetPack(player.id, 'season_1_portraits', { idempotencyKey: 'invalid-roll', rng: () => 0 }),
      (err) => err.statusCode === 400 && /configuration is invalid/i.test(err.message)
    );
    const after = await getWalletState(player.id);
    assert.equal(after.balance, before.balance);
  });
});

test('[Req 14-F] gacha roll reclaims a stale database mutation claim', async () => {
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_DIRECT_BUY_POLICY: 'block_gacha_assets',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'direct',
    ASSET_CATALOG_POLICY_JSON: JSON.stringify({
      [portraitAssetId('thalla', '1')]: { acquisitionMode: 'gacha' }
    }),
    MUTATION_CLAIM_TTL_MS: '1',
    MUTATION_CLAIM_WAIT_TIMEOUT_MS: '100',
    MUTATION_CLAIM_WAIT_INTERVAL_MS: '5'
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4024 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'gacha-claim'
    });
    await insertMutationClaim({
      scope: 'asset_roll',
      claimKey: `${player.id}:season_1_portraits`,
      claimToken: 'stale-gacha-claim',
      claimedAt: '2000-01-01T00:00:00.000Z'
    });

    const roll = await rollAssetPack(player.id, 'season_1_portraits', {
      idempotencyKey: 'stale-claim-roll',
      rng: () => 0
    });
    assert.equal(roll.roll.resultAssetIds[0], portraitAssetId('thalla', '1'));
    assert.equal(roll.alreadyProcessed, false);
    assert.equal((await getWalletState(player.id)).balance, 90);

    const remainingClaim = await query(
      `SELECT 1 FROM mutation_claims WHERE scope = $1 AND claim_key = $2`,
      ['asset_roll', `${player.id}:season_1_portraits`]
    );
    assert.equal(remainingClaim.rowCount, 0, 'gacha roll claim should be released after reclaim');
  });
});

test('[Req 14-F] inactive or expired gacha pack rejects rolls without spending', async () => {
  await withEnv({
    ASSET_GACHA_ENABLED: 'true',
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10',
    ASSET_CATALOG_DEFAULT_PAID_MODE: 'direct',
    ASSET_CATALOG_POLICY_JSON: JSON.stringify({
      [portraitAssetId('thalla', '1')]: { acquisitionMode: 'gacha' }
    }),
    ASSET_GACHA_PACK_OVERRIDES_JSON: JSON.stringify({
      season_1_portraits: { endsAt: '2020-01-01T00:00:00.000Z' }
    })
  }, async () => {
    await freshDb();
    const { player } = await createPlayer({ telegramId: 4014 });
    await grantCurrencyForPlayer({
      playerId: player.id,
      amount: 100,
      reason: 'test_wallet_grant',
      sourceType: 'test',
      sourceId: 'expired-pack'
    });

    assert.equal(getPackOdds('season_1_portraits').active, false);
    const before = await getWalletState(player.id);
    await assert.rejects(
      () => rollAssetPack(player.id, 'season_1_portraits', { idempotencyKey: 'expired-roll', rng: () => 0 }),
      (err) => err.statusCode === 403
    );
    const after = await getWalletState(player.id);
    assert.equal(after.balance, before.balance);
  });
});

test('[Req 4-Z] bot answers payment support commands', async () => {
  const calls = [];
  const result = await handleTelegramWebhook({
    message: {
      text: '/paysupport',
      chat: { id: 123, type: 'private' },
      from: { id: 42, username: 'payer' }
    }
  }, {
    token: 'bot:test',
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { ok: true, async json() { return { ok: true, result: true }; } };
    }
  });

  assert.equal(result.kind, 'payment_support');
  assert.match(calls[0].url, /sendMessage$/);
  assert.match(calls[0].body.text, /Payment support/);
});

test('[Req 4-Z] payment support links are sourced from public payment env', async () => {
  await withEnv({
    PAYMENT_SUPPORT_URL: 'https://support.example/pay',
    PAYMENT_TERMS_URL: 'https://terms.example/pay'
  }, async () => {
    assert.deepEqual(getPaymentSupportLinks(), {
      supportUrl: 'https://support.example/pay',
      termsUrl: 'https://terms.example/pay'
    });

    const reply = createPaymentSupportReply();
    assert.deepEqual(reply.ctas, [
      { label: 'Support', url: 'https://support.example/pay' },
      { label: 'Terms', url: 'https://terms.example/pay' }
    ]);
  });
});
