import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, getPlayerState } from '../../app/server/services/game-service.js';
import { mushrooms } from '../../app/server/game-data.js';
import { freshDb, createPlayer, saveSetup } from './helpers.js';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'amber_fang', x: 1, y: 0, width: 1, height: 2 },
  { artifactId: 'shock_puff', x: 2, y: 0, width: 1, height: 1 }
];

test('loadouts are saved as placements and invalid duplicate layouts are rejected', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const state = await getPlayerState(session.player.id);
  assert.equal(state.loadout.items.length, 3);
  assert.deepEqual(
    state.loadout.items.map((item) => item.artifactId),
    ['spore_needle', 'amber_fang', 'shock_puff']
  );

  await assert.rejects(
    () =>
      saveSetup(session.player.id, 'thalla', [
        { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
        { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 },
        { artifactId: 'shock_puff', x: 2, y: 0, width: 1, height: 1 }
      ]),
    /Duplicate artifacts/
  );
});

test('ghost battles are deterministic with a fixed seed and only reward the initiator', async () => {
  await freshDb();
  const playerOne = await createPlayer({ telegramId: 301, username: 'one' });
  const playerTwo = await createPlayer({ telegramId: 302, username: 'two' });

  await saveSetup(playerOne.player.id, 'thalla', loadout);
  await saveSetup(playerTwo.player.id, 'kirt', [
    { artifactId: 'amber_fang', x: 0, y: 0, width: 1, height: 2 },
    { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 },
    { artifactId: 'shock_puff', x: 1, y: 1, width: 1, height: 1 }
  ]);

  const battleOne = await createBattle(playerOne.player.id, { mode: 'ghost', seed: 'fixed-seed', idempotencyKey: 'one' });
  const battleTwo = await createBattle(playerOne.player.id, { mode: 'ghost', seed: 'fixed-seed', idempotencyKey: 'two' });

  assert.equal(battleOne.snapshots.right.playerId, playerTwo.player.id);
  assert.equal(battleOne.snapshots.right.mushroomId, 'kirt');
  assert.deepEqual(
    battleOne.snapshots.right.loadout.items.map((item) => item.artifactId),
    ['amber_fang', 'bark_plate', 'shock_puff']
  );

  assert.deepEqual(
    battleOne.events.map((event) => event.narration),
    battleTwo.events.map((event) => event.narration)
  );

  const profileOne = await getPlayerState(playerOne.player.id);
  const profileTwo = await getPlayerState(playerTwo.player.id);

  assert.notEqual(profileOne.player.spore, 0);
  assert.equal(profileTwo.player.spore, 0);
});

test('ghost battles fall back to a generated bot with a valid random loadout when no real opponent exists', async () => {
  await freshDb();
  const player = await createPlayer({ telegramId: 303, username: 'solo' });

  await saveSetup(player.player.id, 'thalla', loadout);

  const battle = await createBattle(player.player.id, { mode: 'ghost', seed: 'bot-seed', idempotencyKey: 'bot' });

  assert.equal(battle.opponentKind, 'ghost_bot');
  assert.equal(battle.snapshots.right.playerId, null);
  assert.ok(mushrooms.some((mushroom) => mushroom.id === battle.snapshots.right.mushroomId));
  const botItems = battle.snapshots.right.loadout.items;
  assert.ok(botItems.length >= 1 && botItems.length <= 6);
  assert.equal(new Set(botItems.map((item) => item.artifactId)).size, botItems.length);
  for (const item of battle.snapshots.right.loadout.items) {
    assert.ok(item.x + item.width <= 3);
    assert.ok(item.y + item.height <= 2);
  }
});
