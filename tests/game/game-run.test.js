import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startGameRun,
  getActiveGameRun,
  abandonGameRun,
  getGameRun,
  getBootstrap
} from '../../app/server/services/game-service.js';
import { STARTING_LIVES, ROUND_INCOME } from '../../app/server/game-data.js';
import { freshDb, createPlayer, saveSetup } from './helpers.js';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

test('starting a solo run creates an active game run', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');

  assert.equal(run.mode, 'solo');
  assert.equal(run.status, 'active');
  assert.equal(run.currentRound, 1);
  assert.equal(run.player.livesRemaining, STARTING_LIVES);
  assert.equal(run.player.wins, 0);
  assert.equal(run.player.losses, 0);
  assert.equal(run.player.coins, ROUND_INCOME[0]);
  assert.ok(run.shopOffer.length > 0);
  assert.equal(run.player.completedRounds, 0);
  assert.ok(run.id);
  assert.ok(run.startedAt);
});

test('only one active run per player is allowed', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  await startGameRun(session.player.id, 'solo');

  await assert.rejects(
    () => startGameRun(session.player.id, 'solo'),
    /Unique|Validation error|CONSTRAINT/i
  );
});

test('getActiveGameRun returns null when no active run exists', async () => {
  await freshDb();
  const session = await createPlayer();

  const result = await getActiveGameRun(session.player.id);
  assert.equal(result, null);
});

test('getActiveGameRun returns the active run', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');
  const active = await getActiveGameRun(session.player.id);

  assert.equal(active.id, run.id);
  assert.equal(active.mode, 'solo');
  assert.equal(active.status, 'active');
  assert.deepEqual(active.rounds, []);
});

test('abandoning a run sets status to abandoned and clears active flag', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');
  const abandoned = await abandonGameRun(session.player.id, run.id);

  assert.equal(abandoned.status, 'abandoned');
  assert.equal(abandoned.endReason, 'abandoned');
  assert.ok(abandoned.endedAt);

  const active = await getActiveGameRun(session.player.id);
  assert.equal(active, null);
});

test('a new run can be started after abandoning', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const first = await startGameRun(session.player.id, 'solo');
  await abandonGameRun(session.player.id, first.id);

  const second = await startGameRun(session.player.id, 'solo');
  assert.notEqual(second.id, first.id);
  assert.equal(second.status, 'active');
});

test('getGameRun returns run summary for participant', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');
  const details = await getGameRun(run.id, session.player.id);

  assert.equal(details.id, run.id);
  assert.equal(details.players.length, 1);
  assert.equal(details.players[0].playerId, session.player.id);
  assert.deepEqual(details.rounds, []);
});

test('getGameRun rejects non-participant', async () => {
  await freshDb();
  const playerA = await createPlayer({ telegramId: 401, username: 'a' });
  const playerB = await createPlayer({ telegramId: 402, username: 'b' });
  await saveSetup(playerA.player.id, 'thalla', loadout);

  const run = await startGameRun(playerA.player.id, 'solo');

  await assert.rejects(
    () => getGameRun(run.id, playerB.player.id),
    /not part of this game run/
  );
});

test('bootstrap includes activeGameRun when a run is active', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');
  const bootstrap = await getBootstrap(session.player.id);

  assert.ok(bootstrap.activeGameRun);
  assert.equal(bootstrap.activeGameRun.id, run.id);
});

test('bootstrap has null activeGameRun when no run is active', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const bootstrap = await getBootstrap(session.player.id);
  assert.equal(bootstrap.activeGameRun, null);
});

test('daily limit counts game runs started', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  for (let i = 0; i < 10; i++) {
    const run = await startGameRun(session.player.id, 'solo');
    await abandonGameRun(session.player.id, run.id);
  }

  await assert.rejects(
    () => startGameRun(session.player.id, 'solo'),
    /Daily battle limit reached/
  );
});
