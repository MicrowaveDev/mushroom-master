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
  getPackOdds,
  portraitAssetId,
  purchaseAsset,
  rollAssetPack
} from '../../app/server/services/asset-service.js';
import { createPaymentSupportReply, handleTelegramWebhook } from '../../app/server/bot-gateway.js';
import {
  createApp,
  nowPaymentsSignaturePayload,
  verifyPaymentWebhookSignature,
  verifyPaymentWebhookTimestamp
} from '../../app/server/create-app.js';

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
    assert.deepEqual(odds.items.map((item) => item.assetId), [portraitAssetId('thalla', '1')]);

    const first = await rollAssetPack(player.id, odds.id, { idempotencyKey: 'roll-1', rng: () => 0 });
    const replay = await rollAssetPack(player.id, odds.id, { idempotencyKey: 'roll-1', rng: () => 0.99 });
    assert.equal(replay.alreadyProcessed, true, 'same roll idempotency key should replay the first roll');
    assert.deepEqual(replay.roll.resultAssetIds, first.roll.resultAssetIds);

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
