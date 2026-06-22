import test from 'node:test';
import assert from 'node:assert/strict';
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
  createPurchaseIntent,
  getWalletState,
  grantCurrencyForPlayer,
  validateTelegramPreCheckout
} from '../../app/server/services/wallet-service.js';
import {
  getPackOdds,
  portraitAssetId,
  purchaseAsset,
  rollAssetPack
} from '../../app/server/services/asset-service.js';
import { handleTelegramWebhook } from '../../app/server/bot-gateway.js';

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
    ASSET_GACHA_ROLL_PRICE_AMOUNT: '10'
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

    const odds = getPackOdds('season_1_portraits');
    assert.equal(odds.active, true);
    assert.ok(odds.items.length > 1, 'portrait pack should contain multiple paid variants');

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
