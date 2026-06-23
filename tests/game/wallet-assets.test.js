import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
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
  completePurchaseIntent,
  completeProviderWebhook,
  createPurchaseIntent,
  getWalletState,
  grantCurrencyForPlayer,
  spendCurrencyForPlayer,
  validateTelegramPreCheckout
} from '../../app/server/services/wallet-service.js';
import {
  getPackOdds,
  portraitAssetId,
  purchaseAsset,
  rollAssetPack
} from '../../app/server/services/asset-service.js';
import { handleTelegramWebhook } from '../../app/server/bot-gateway.js';
import {
  nowPaymentsSignaturePayload,
  verifyPaymentWebhookSignature
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

test('[Req 4-Z] payment webhook signatures are provider-specific', async () => {
  const btcpayBody = '{"invoiceId":"invoice-1","type":"InvoiceSettled"}';
  const btcpaySig = crypto.createHmac('sha256', 'btcpay-secret').update(btcpayBody).digest('hex');
  await withEnv({ BTCPAY_WEBHOOK_SECRET: 'btcpay-secret' }, async () => {
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

  const nowBody = { payment_status: 'finished', order_id: 'intent-1', nested: { z: 1, a: 2 } };
  assert.equal(
    nowPaymentsSignaturePayload(nowBody),
    '{"nested":{"a":2,"z":1},"order_id":"intent-1","payment_status":"finished"}'
  );
  const nowSig = crypto.createHmac('sha512', 'now-secret').update(nowPaymentsSignaturePayload(nowBody)).digest('hex');
  await withEnv({ NOWPAYMENTS_IPN_SECRET: 'now-secret' }, async () => {
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
