import test from 'node:test';
import assert from 'node:assert/strict';
import { buyRunShopItem, getActiveGameRun } from '../../app/server/services/game-service.js';
import { getArtifactById } from '../../app/server/game-data.js';
import { getBackpackLoadoutRevision } from '@microwavedev/backpack-game-core/modules/loadout';
import { freshDb, bootRun, forceShopOffer } from './helpers.js';

test('[Req 4-AA, 2-H] shop drop rejects without spending then atomically buys a bag and persists', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 961001 });
  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  const before = await getActiveGameRun(playerId);
  const input = { expectedLoadoutRevision: getBackpackLoadoutRevision(before.loadoutItems) };
  for (const placement of [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 3, y: 0, rotated: 4 }, { x: '3', y: 0 }]) {
    await assert.rejects(buyRunShopItem(playerId, run.id, 'moss_pouch', { ...input, placement }));
    const rejected = await getActiveGameRun(playerId);
    assert.equal(rejected.player.coins, before.player.coins);
    assert.deepEqual(rejected.loadoutItems, before.loadoutItems);
    assert.deepEqual(rejected.shopOffer, before.shopOffer);
  }
  await assert.rejects(buyRunShopItem(playerId, run.id, 'moss_pouch', { expectedLoadoutRevision: 'stale', placement: { x: 3, y: 0 } }));
  const bought = await buyRunShopItem(playerId, run.id, 'moss_pouch', { ...input, placement: { x: 3, y: 0, rotated: 1 } });
  assert.ok(bought.loadoutItems.find(row => row.id === bought.id)?.active);
  const after = await getActiveGameRun(playerId);
  assert.ok(after.player.coins < before.player.coins);
  assert.deepEqual(after.loadoutItems.find(row => row.id === bought.id), bought.loadoutItems.find(row => row.id === bought.id));
  assert.equal(after.loadoutItems.find(row => row.id === bought.id).x, 3);
  assert.equal(after.loadoutItems.find(row => row.id === bought.id).rotated, 1);
  await assert.rejects(buyRunShopItem(playerId, run.id, 'moss_pouch', { placement: { x: 3, y: 3 } }));
  assert.equal((await getActiveGameRun(playerId)).player.coins, after.player.coins);
  await forceShopOffer(run.id, playerId, 1, ['glass_cap']);
  const cap = await buyRunShopItem(playerId, run.id, 'glass_cap', { placement: { x: 0, y: 1, rotated: 1 } });
  const placed = (await getActiveGameRun(playerId)).loadoutItems.find(row => row.id === cap.id);
  assert.equal(placed.rotated, 1, 'regular item rotation survives insertion and reload');
  assert.equal(placed.width, getArtifactById('glass_cap').height);
  assert.equal(placed.height, getArtifactById('glass_cap').width);

});
