import { test, expect } from '@playwright/test';
import { resetDevDb, createSession, api, DESKTOP_VIEWPORT } from './e2e-helpers.js';

const supportHeaders = {
  authorization: 'Bearer e2e-support',
  'x-support-actor-id': 'e2e-wallet-ui'
};

async function installSession(page, sessionKey) {
  await page.addInitScript((key) => {
    localStorage.setItem('sessionKey', key);
    localStorage.setItem('mushroomPreferredLang', 'en');
  }, sessionKey);
}

async function grantWallet(request, playerId, amount) {
  const response = await request.post('/api/admin/support/actions/wallet-grant', {
    headers: supportHeaders,
    data: {
      playerId,
      amount,
      reason: 'e2e_wallet_ui',
      note: 'Playwright wallet/skin flow setup'
    }
  });
  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(json.success).toBe(true);
}

async function installTelegramMiniApp(page) {
  await page.addInitScript(() => {
    window.__telegramInvoiceCalls = [];
    window.__telegramInvoiceCallback = null;
    window.Telegram = {
      WebApp: {
        version: '8.0',
        initData: '',
        viewportHeight: window.innerHeight,
        viewportStableHeight: window.innerHeight,
        themeParams: {},
        safeAreaInset: {},
        contentSafeAreaInset: {},
        ready() {},
        expand() {},
        onEvent() {},
        offEvent() {},
        openInvoice(invoiceLink, callback) {
          window.__telegramInvoiceCalls.push({ invoiceLink });
          window.__telegramInvoiceCallback = callback;
        }
      }
    };
  });
}

async function setupHome(request, page, {
  telegramId,
  username
}) {
  await resetDevDb(request);
  const player = await createSession(request, {
    telegramId,
    username,
    name: username,
    lang: 'en'
  });
  await api(request, player.sessionKey, '/api/active-character', 'PUT', { mushroomId: 'thalla' });
  await installSession(page, player.sessionKey);
  return player;
}

test('[Req 4-Z] wallet shop lists bundles, opens external checkout, and shows failure/support states', async ({ page, request, baseURL }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await setupHome(request, page, {
    telegramId: 9101,
    username: 'wallet_checkout_ui'
  });
  await page.addInitScript(() => {
    window.__walletOpenCalls = [];
    window.open = (url, target, features) => {
      window.__walletOpenCalls.push({ url, target, features });
      return null;
    };
  });
  await page.route('**/api/wallet/purchase-intents', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const isExpiredTelegram = body.provider === 'telegram_stars';
    const checkout = isExpiredTelegram
      ? {
          type: 'telegram_invoice',
          provider: body.provider,
          invoiceLink: null,
          invoiceReady: false
        }
      : body.provider === 'btcpay'
        ? {
            type: 'crypto_invoice',
            provider: body.provider,
            checkoutUrl: 'https://checkout.example/invoice-ui',
            paymentUri: null
          }
        : {
            type: 'crypto_invoice',
            provider: body.provider,
            checkoutUrl: null,
            paymentUri: null,
            setupRequired: true
          };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: `intent-${body.provider}`,
          provider: body.provider,
          providerInvoiceId: `invoice-${body.provider}`,
          status: isExpiredTelegram ? 'expired' : 'pending',
          checkoutStatus: isExpiredTelegram ? 'expired' : checkout.setupRequired ? 'setup_required' : 'ready',
          walletAmount: 100,
          priceAmount: isExpiredTelegram ? 1 : 100,
          priceCurrency: isExpiredTelegram ? 'XTR' : 'USD',
          metadata: {
            bundleId: body.bundleId,
            paymentSurface: body.surface
          },
          checkout
        }
      })
    });
  });

  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  await page.locator('.home-wallet-buy').click();
  await expect(page.locator('.home-wallet-shop')).toBeVisible();
  await expect(page.locator('.home-wallet-bundle')).toHaveCount(9);
  await expect(page.locator('.home-wallet-links a[href="https://support.example/pay"]')).toBeVisible();
  await expect(page.locator('.home-wallet-links a[href="https://terms.example/pay"]')).toBeVisible();

  await page.locator('.home-wallet-bundle', { hasText: 'Telegram Stars' }).first().click();
  await expect(page.locator('.home-wallet-shop-status')).toHaveText(/Payment expired/i);

  await page.locator('.home-wallet-bundle', { hasText: 'BTCPay' }).first().click();
  await expect(page.locator('.home-wallet-shop-status')).toHaveText(/Checkout opened/i);
  await expect.poll(() => page.evaluate(() => window.__walletOpenCalls?.[0]?.url)).toBe('https://checkout.example/invoice-ui');
  await expect.poll(() => page.evaluate(() => window.__walletOpenCalls?.[0]?.target)).toBe('_blank');

  await page.locator('.home-wallet-bundle', { hasText: 'NOWPayments' }).first().click();
  await expect(page.locator('.home-wallet-shop-status')).toHaveText(/Payment was not completed/i);
});

test('[Req 4-Z] Telegram invoice completion refreshes the wallet balance', async ({ page, request, baseURL }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  const player = await setupHome(request, page, {
    telegramId: 9104,
    username: 'telegram_invoice_ui'
  });
  await installTelegramMiniApp(page);
  const before = await api(request, player.sessionKey, '/api/bootstrap');
  let telegramIntent = null;
  await page.route('**/api/wallet/purchase-intents', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    telegramIntent = json.data;
    json.data.checkoutStatus = 'ready';
    json.data.checkout = {
      ...json.data.checkout,
      invoiceLink: 'https://t.me/invoice/e2e-telegram-wallet',
      invoiceReady: true,
      setupRequired: false
    };
    await route.fulfill({
      status: response.status(),
      contentType: 'application/json',
      body: JSON.stringify(json)
    });
  });

  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  await page.locator('.home-wallet-buy').click();
  await expect(page.locator('.home-wallet-bundle')).toHaveCount(3);
  await page.locator('.home-wallet-bundle', { hasText: 'Telegram Stars' }).first().click();
  await expect(page.locator('.home-wallet-shop-status')).toHaveText(/Checkout opened/i);
  await expect.poll(() => page.evaluate(() => window.__telegramInvoiceCalls?.[0]?.invoiceLink))
    .toBe('https://t.me/invoice/e2e-telegram-wallet');

  await page.evaluate(() => window.__telegramInvoiceCallback?.('pending'));
  await expect(page.locator('.home-wallet-shop-status')).toHaveText(/waiting for confirmation/i);
  expect(telegramIntent).toBeTruthy();

  const webhookResponse = await request.post('/api/bot/webhook', {
    data: {
      update_id: 910400,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        successful_payment: {
          currency: telegramIntent.priceCurrency,
          total_amount: telegramIntent.priceAmount,
          invoice_payload: telegramIntent.id,
          telegram_payment_charge_id: 'tg-e2e-wallet-ui'
        }
      }
    }
  });
  expect(webhookResponse.status()).toBe(200);
  const webhookJson = await webhookResponse.json();
  expect(webhookJson.success).toBe(true);
  expect(webhookJson.data.kind).toBe('wallet_payment');

  const refreshPromise = page.waitForResponse((response) =>
    response.url().includes('/api/bootstrap') && response.status() === 200
  );
  await page.evaluate(() => window.__telegramInvoiceCallback?.('paid'));
  await refreshPromise;
  await expect(page.locator('.home-wallet-shop-status')).toHaveText(/Payment confirmed/i);
  await expect(page.locator('.home-wallet-footer > span').first().locator('strong'))
    .toHaveText(String((before.wallet?.balances?.soft_coin || 0) + telegramIntent.walletAmount));

  const after = await api(request, player.sessionKey, '/api/bootstrap');
  expect(after.wallet.balances.soft_coin).toBe((before.wallet?.balances?.soft_coin || 0) + telegramIntent.walletAmount);
});

test('[Req 4-Y, 14-F] buying an active mushroom skin equips it without changing character XP', async ({ page, request, baseURL }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  const player = await setupHome(request, page, {
    telegramId: 9102,
    username: 'skin_purchase_ui'
  });
  await grantWallet(request, player.player.id, 5000);
  const before = await api(request, player.sessionKey, '/api/bootstrap');
  const targetPortrait = before.progression.thalla.portraits.find((portrait) =>
    portrait.id !== 'default' && portrait.purchaseAvailable
  );
  expect(targetPortrait).toBeTruthy();

  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  await page.locator('.home-roster-change-skin').click();
  const swatch = page.locator(`.home-portrait-swatch[data-portrait-id="${targetPortrait.id}"]`);
  await expect(swatch).toBeVisible();
  await expect(swatch).toHaveClass(/home-portrait-swatch--buyable/);
  const purchaseResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/assets/${encodeURIComponent(targetPortrait.assetId)}/purchase`)
  );
  await swatch.click();
  const purchaseResponse = await purchaseResponsePromise;
  expect(purchaseResponse.status()).toBe(200);
  const purchaseJson = await purchaseResponse.json();
  expect(purchaseJson.success).toBe(true);
  await expect(swatch).toHaveClass(/home-portrait-swatch--active/);
  await expect(swatch).not.toHaveClass(/home-portrait-swatch--locked/);

  const after = await api(request, player.sessionKey, '/api/bootstrap');
  expect(after.progression.thalla.activePortrait).toBe(targetPortrait.id);
  expect(after.progression.thalla.mycelium).toBe(before.progression.thalla.mycelium);
  expect(after.progression.thalla.portraits.find((portrait) => portrait.id === targetPortrait.id).owned).toBe(true);
});

test('[Req 14-F] skin picker presents roll-only packs separately from direct-buy skins', async ({ page, request, baseURL }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  const player = await setupHome(request, page, {
    telegramId: 9103,
    username: 'gacha_picker_ui'
  });
  const bootstrap = await api(request, player.sessionKey, '/api/bootstrap');
  const paidPortraits = bootstrap.progression.thalla.portraits.filter((portrait) => portrait.id !== 'default');
  expect(paidPortraits.length).toBeGreaterThan(1);
  const rollPortrait = paidPortraits[0];
  const directPortrait = paidPortraits[1];

  await page.route('**/api/bootstrap', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const portraits = json.data.progression.thalla.portraits;
    json.data.progression.thalla.portraits = portraits.map((portrait) => {
      if (portrait.id === rollPortrait.id) {
        return {
          ...portrait,
          owned: false,
          unlocked: false,
          purchaseAvailable: false,
          rollAvailable: true,
          packId: 'season_1_portraits',
          price: 10,
          cost: 10
        };
      }
      if (portrait.id === directPortrait.id) {
        return {
          ...portrait,
          owned: false,
          unlocked: false,
          purchaseAvailable: true,
          rollAvailable: false,
          packId: null,
          price: 25,
          cost: 25
        };
      }
      return portrait;
    });
    json.data.assetPacks = [
      {
        id: 'season_1_portraits',
        name: { en: 'Season 1 Portrait Pack', ru: 'Портреты сезона 1' },
        status: 'active',
        rollPriceAmount: 10,
        rollPriceCurrencyCode: 'soft_coin',
        rollSize: 2,
        nextRollItemCount: 2,
        duplicatePolicy: { enabled: true, mode: 'allow_duplicates' },
        duplicateCopies: 5,
        rollableCount: 2,
        uniqueComplete: false,
        complete: false,
        burn: {
          rules: [
            { id: 'five_common_to_rare', sourceRarity: 'common', sourceCount: 5, ready: true }
          ]
        },
        guarantees: {
          rules: [
            { id: 'one_rare_plus', minRarity: 'rare', count: 1 }
          ]
        },
        pity: {
          rules: [
            { id: 'epic_pity', minRarity: 'epic', threshold: 5, remaining: 1, active: true }
          ]
        },
        items: [
          { assetId: rollPortrait.assetId, rarity: 'rare', dropWeight: 30 },
          { assetId: directPortrait.assetId, rarity: 'common', dropWeight: 70 }
        ]
      }
    ];
    await route.fulfill({
      status: response.status(),
      headers: {
        ...response.headers(),
        'content-type': 'application/json'
      },
      body: JSON.stringify(json)
    });
  });
  await page.route('**/api/assets/packs/season_1_portraits/roll', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          roll: {
            id: 'roll-ui-1',
            packId: 'season_1_portraits',
            resultAssetIds: [rollPortrait.assetId],
            selectedAssetId: rollPortrait.assetId,
            resultInstanceId: 'asset-ui-1'
          },
          rollResult: {
            rollId: 'roll-ui-1',
            packId: 'season_1_portraits',
            packName: 'Season 1 Portrait Pack',
            assetId: rollPortrait.assetId,
            assetName: rollPortrait.name,
            assetPath: rollPortrait.path,
            rarity: 'rare',
            resultInstanceId: 'asset-ui-1',
            count: 2,
            items: [
              {
                assetId: rollPortrait.assetId,
                assetName: rollPortrait.name,
                assetPath: rollPortrait.path,
                rarity: 'rare',
                resultInstanceId: 'asset-ui-1'
              },
              {
                assetId: directPortrait.assetId,
                assetName: directPortrait.name,
                assetPath: directPortrait.path,
                rarity: 'common',
                resultInstanceId: 'asset-ui-2'
              }
            ]
          },
          alreadyProcessed: false
        }
      })
    });
  });

  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  await page.locator('.home-roster-change-skin').click();
  const rollableSwatch = page.locator(`.home-portrait-swatch--rollable[data-portrait-id="${rollPortrait.id}"]`);
  await expect(rollableSwatch).toBeVisible();
  await expect(page.locator(`.home-portrait-swatch--buyable[data-portrait-id="${directPortrait.id}"]`)).toBeVisible();
  await expect(page.locator('.home-pack-detail')).toContainText('Season 1 Portrait Pack');
  await expect(page.locator('.home-pack-detail')).toContainText('2 skins');
  await expect(page.locator('.home-pack-detail')).toContainText('opens 2');
  await expect(page.locator('.home-pack-detail')).toContainText('Duplicates: 5');
  await expect(page.locator('.home-pack-detail')).toContainText('Burn 5 Common');
  await expect(page.locator('.home-pack-detail')).toContainText(/Odds:.*Common 70%.*Rare 30%/);
  await expect(page.locator('.home-pack-detail')).toContainText('Guarantee: 1 Rare+');
  await expect(page.locator('.home-pack-detail')).toContainText('Epic+ guaranteed next open');
  const rollResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/assets/packs/season_1_portraits/roll')
  );
  await rollableSwatch.click();
  const rollResponse = await rollResponsePromise;
  expect(rollResponse.status()).toBe(200);
  await expect(page.getByTestId('home-pack-roll-result')).toContainText('2 skins unlocked');
  await expect(page.getByTestId('home-pack-roll-result')).toContainText('Rare');
  await expect(page.getByTestId('home-pack-roll-result')).toContainText('Common');
});

test('[Req 14-F] skin picker shows complete, future, and expired pack states', async ({ page, request, baseURL }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  const player = await setupHome(request, page, {
    telegramId: 9105,
    username: 'gacha_pack_states_ui'
  });
  const bootstrap = await api(request, player.sessionKey, '/api/bootstrap');
  const paidPortraits = bootstrap.progression.thalla.portraits.filter((portrait) => portrait.id !== 'default');
  expect(paidPortraits.length).toBeGreaterThan(1);
  const [firstPortrait, secondPortrait] = paidPortraits;

  await page.route('**/api/bootstrap', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const portraits = json.data.progression.thalla.portraits;
    json.data.progression.thalla.portraits = portraits.map((portrait) => {
      if (portrait.id === firstPortrait.id || portrait.id === secondPortrait.id) {
        return {
          ...portrait,
          owned: true,
          unlocked: true,
          purchaseAvailable: false,
          rollAvailable: false,
          packId: 'complete_pack'
        };
      }
      return portrait;
    });
    json.data.assetPacks = [
      {
        id: 'complete_pack',
        name: { en: 'Complete Pack', ru: 'Полный пак' },
        status: 'active',
        rollPriceAmount: 10,
        rollPriceCurrencyCode: 'soft_coin',
        items: [
          { assetId: firstPortrait.assetId, rarity: 'common', dropWeight: 50 },
          { assetId: secondPortrait.assetId, rarity: 'rare', dropWeight: 50 }
        ]
      },
      {
        id: 'capped_pack',
        name: { en: 'Capped Copy Pack', ru: 'Пак с лимитом копий' },
        status: 'active',
        rollPriceAmount: 10,
        rollPriceCurrencyCode: 'soft_coin',
        duplicatePolicy: { enabled: true, mode: 'allow_duplicates', maxCopiesPerAsset: 2 },
        duplicateCopies: 1,
        rollableCount: 0,
        complete: true,
        uniqueComplete: true,
        copyComplete: true,
        items: [
          { assetId: firstPortrait.assetId, rarity: 'common', dropWeight: 100, ownedCopies: 2, copyLimit: 2, copyCapped: true }
        ]
      },
      {
        id: 'future_pack',
        name: { en: 'Future Pack', ru: 'Будущий пак' },
        status: 'active',
        startsAt: '2999-01-01T00:00:00.000Z',
        rollPriceAmount: 10,
        rollPriceCurrencyCode: 'soft_coin',
        items: [
          { assetId: firstPortrait.assetId, rarity: 'common', dropWeight: 100 }
        ]
      },
      {
        id: 'expired_pack',
        name: { en: 'Expired Pack', ru: 'Завершённый пак' },
        status: 'active',
        endsAt: '2000-01-01T00:00:00.000Z',
        rollPriceAmount: 10,
        rollPriceCurrencyCode: 'soft_coin',
        items: [
          { assetId: secondPortrait.assetId, rarity: 'rare', dropWeight: 100 }
        ]
      }
    ];
    await route.fulfill({
      status: response.status(),
      headers: {
        ...response.headers(),
        'content-type': 'application/json'
      },
      body: JSON.stringify(json)
    });
  });

  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  await page.locator('.home-roster-change-skin').click();
  await expect(page.locator('.home-pack-detail', { hasText: 'Complete Pack' })).toContainText('All 2 skins owned.');
  await expect(page.locator('.home-pack-detail', { hasText: 'Capped Copy Pack' })).toContainText('Copy limit reached for 1 skins.');
  await expect(page.locator('.home-pack-detail', { hasText: 'Capped Copy Pack' })).toContainText('Duplicates: 1');
  await expect(page.locator('.home-pack-detail', { hasText: 'Future Pack' })).toContainText('Pack opens later.');
  await expect(page.locator('.home-pack-detail', { hasText: 'Expired Pack' })).toContainText('Pack ended.');
});
