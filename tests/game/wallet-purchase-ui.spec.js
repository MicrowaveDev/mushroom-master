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
    const checkout = body.provider === 'btcpay'
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
          status: 'pending',
          checkoutStatus: checkout.setupRequired ? 'setup_required' : 'ready',
          walletAmount: 100,
          priceAmount: 100,
          priceCurrency: 'USD',
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

  await page.locator('.home-wallet-bundle', { hasText: 'BTCPay' }).first().click();
  await expect(page.locator('.home-wallet-shop-status')).toHaveText(/Checkout opened/i);
  await expect.poll(() => page.evaluate(() => window.__walletOpenCalls?.[0]?.url)).toBe('https://checkout.example/invoice-ui');
  await expect.poll(() => page.evaluate(() => window.__walletOpenCalls?.[0]?.target)).toBe('_blank');

  await page.locator('.home-wallet-bundle', { hasText: 'NOWPayments' }).first().click();
  await expect(page.locator('.home-wallet-shop-status')).toHaveText(/Payment was not completed/i);
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

  await page.goto(`${baseURL}/home`);
  await page.waitForSelector('.home');
  await page.locator('.home-roster-change-skin').click();
  await expect(page.locator(`.home-portrait-swatch--rollable[data-portrait-id="${rollPortrait.id}"]`)).toBeVisible();
  await expect(page.locator(`.home-portrait-swatch--buyable[data-portrait-id="${directPortrait.id}"]`)).toBeVisible();
  await expect(page.locator('.home-pack-detail')).toContainText('Season 1 Portrait Pack');
  await expect(page.locator('.home-pack-detail')).toContainText('2 skins');
  await expect(page.locator('.home-pack-detail')).toContainText(/Odds:.*Common 70%.*Rare 30%/);
});
