// Concurrency serialization for run-state mutations.
//
// Before the lock landed, two parallel buyRunShopItem calls from the same
// player could both pass coin validation in separate transactions, producing
// a negative-coin state or an over-budget loadout. These tests pin the new
// behavior: the second mutation observes the first's committed state.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buyRunShopItem,
  refreshRunShop
} from '../../app/server/services/game-service.js';
import {
  freshDb,
  bootRun,
  getCoins,
  getShopOffer,
  getArtifactById,
  getArtifactPrice
} from './helpers.js';

const starter = [{ artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 }];

test('concurrent buyRunShopItem calls never over-spend the player', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({
    telegramId: 9101,
    username: 'lock_9101',
    withLegacyLoadout: starter
  });

  const offer = await getShopOffer(run.id, playerId, 1);
  assert.ok(offer && offer.length >= 2, 'shop must offer at least two items');

  const startingCoins = await getCoins(run.id, playerId);
  const prices = offer.map((id) => getArtifactPrice(getArtifactById(id)));
  const totalPrice = prices[0] + prices[1];

  // Fire both mutations in parallel. Under the lock they serialize: first
  // wins, second sees the decremented coin state. Without the lock, both
  // could pass the coin check and leave coins = starting - totalPrice
  // even if that exceeds the budget; the lock guarantees at most one
  // transaction debits before the other re-reads.
  const results = await Promise.allSettled([
    buyRunShopItem(playerId, run.id, offer[0]),
    buyRunShopItem(playerId, run.id, offer[1])
  ]);

  const finalCoins = await getCoins(run.id, playerId);
  assert.ok(finalCoins >= 0, `coins must never go negative, got ${finalCoins}`);

  if (totalPrice <= startingCoins) {
    // Both should succeed.
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
    assert.equal(finalCoins, startingCoins - totalPrice);
  } else {
    // At most one succeeds; the other rejects with NOT_ENOUGH_COINS or
    // ITEM_NOT_IN_OFFER (since the first consumed it).
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    assert.ok(fulfilled <= 1, 'at most one concurrent buy may succeed when budget is tight');
    assert.ok(finalCoins <= startingCoins, 'coins must not exceed starting balance');
  }
});

test('concurrent refreshRunShop + buyRunShopItem serialize cleanly', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({
    telegramId: 9102,
    username: 'lock_9102',
    withLegacyLoadout: starter
  });

  const firstOffer = await getShopOffer(run.id, playerId, 1);
  const target = firstOffer[0];

  const results = await Promise.allSettled([
    buyRunShopItem(playerId, run.id, target),
    refreshRunShop(playerId, run.id)
  ]);

  // Both operations must complete without throwing unrelated errors — any
  // failure must be a business-logic rejection (NOT_ENOUGH_COINS,
  // item-not-in-offer), not a race crash.
  for (const r of results) {
    if (r.status === 'rejected') {
      const msg = String(r.reason?.message || r.reason);
      assert.match(
        msg,
        /not enough|not in the current shop offer|already/i,
        `unexpected error under concurrency: ${msg}`
      );
    }
  }

  const finalCoins = await getCoins(run.id, playerId);
  assert.ok(finalCoins >= 0, `coins must never go negative, got ${finalCoins}`);
});
