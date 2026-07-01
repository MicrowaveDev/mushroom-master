import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startGameRun,
  getActiveGameRun,
  getActiveGameRuns,
  abandonGameRun,
  getGameRun,
  getBootstrap
} from '../../app/server/services/game-service.js';
import { STARTING_LIVES, ROUND_INCOME } from '../../app/server/game-data.js';
import { query } from '../../app/server/db.js';
import { freshDb, createPlayer, saveSetup } from './helpers.js';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

function assertRunCurrencyAliases(subject, expected) {
  assert.equal(subject.coins, expected);
  assert.equal(subject.runCurrency, expected);
  assert.equal(subject.runCoins, expected);
}

test('[Req 1-A, 1-C, 4-A] starting a solo run creates an active game run', async () => {
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
  assertRunCurrencyAliases(run.player, ROUND_INCOME[0]);
  assert.ok(run.shopOffer.length > 0);
  assert.ok(Array.isArray(run.loadoutItems), 'start response should include current-round loadout rows');
  assert.equal(run.loadoutItems.length, 3);
  assert.ok(run.loadoutItems.every((item) => item.id), 'start loadout rows should include stable row ids');
  assert.equal(run.player.completedRounds, 0);
  assert.ok(run.id);
  assert.ok(run.startedAt);
});

test('[Req 1-G] only one active solo run per mushroom is allowed', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  await startGameRun(session.player.id, 'solo');

  await assert.rejects(
    () => startGameRun(session.player.id, 'solo'),
    /already have an active game run for this mushroom|Unique|Validation error|CONSTRAINT/i
  );
});

test('[Req 1-G] active solo runs can coexist for different mushrooms', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);
  const thallaRun = await startGameRun(session.player.id, 'solo');

  await saveSetup(session.player.id, 'lomie', loadout);
  const lomieRun = await startGameRun(session.player.id, 'solo');

  assert.notEqual(lomieRun.id, thallaRun.id);
  assert.equal(thallaRun.mushroomId, 'thalla');
  assert.equal(lomieRun.mushroomId, 'lomie');

  const allActive = await getActiveGameRuns(session.player.id);
  assert.deepEqual(
    allActive.map((run) => run.mushroomId).sort(),
    ['lomie', 'thalla']
  );
  assert.equal((await getActiveGameRun(session.player.id, 'thalla')).id, thallaRun.id);
  assert.equal((await getActiveGameRun(session.player.id, 'lomie')).id, lomieRun.id);
  assert.equal((await getActiveGameRun(session.player.id)).id, lomieRun.id);

  await saveSetup(session.player.id, 'thalla', loadout);
  assert.equal((await getActiveGameRun(session.player.id)).id, thallaRun.id);
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
  assertRunCurrencyAliases(active.player, ROUND_INCOME[0]);
  assert.deepEqual(active.rounds, []);
});

test('[Req 1-F] abandoning a run sets status to abandoned and clears active flag', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');
  const abandoned = await abandonGameRun(session.player.id, run.id);

  assert.equal(abandoned.status, 'abandoned');
  assert.equal(abandoned.endReason, 'abandoned');
  assert.ok(abandoned.endedAt);
  assertRunCurrencyAliases(abandoned.player, ROUND_INCOME[0]);

  const active = await getActiveGameRun(session.player.id);
  assert.equal(active, null);
});

test('[Req 1-F, 1-G] a new run can be started after abandoning', async () => {
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
  assertRunCurrencyAliases(details.player, ROUND_INCOME[0]);
  assertRunCurrencyAliases(details.players[0], ROUND_INCOME[0]);
  assert.deepEqual(details.rounds, []);
});

test('getGameRun returns persisted completed-run recap for refreshable runComplete route', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');
  await query(
    `UPDATE game_runs SET status = 'completed', ended_at = $2, end_reason = 'max_losses' WHERE id = $1`,
    [run.id, '2026-05-04T10:00:00.000Z']
  );
  await query(
    `UPDATE game_run_players
     SET is_active = 0, completed_rounds = 1, wins = 0, losses = 1, lives_remaining = 4, coins = 2
     WHERE game_run_id = $1 AND player_id = $2`,
    [run.id, session.player.id]
  );
  await query(
    `INSERT INTO game_rounds
      (id, game_run_id, round_number, battle_id, player_id, outcome, spore_awarded, mycelium_awarded, created_at)
     VALUES ('round_refresh_receipt', $1, 1, NULL, $2, 'loss', 1, 5, '2026-05-04T09:59:00.000Z')`,
    [run.id, session.player.id]
  );
  await query(
    `INSERT INTO player_season_runs
      (id, player_id, game_run_id, season_id, points, level_id, wins, losses, completed_rounds, end_reason, created_at)
     VALUES ('season_refresh_receipt', $1, $2, 'season_1', 1, 'bronze', 0, 1, 1, 'max_losses', '2026-05-04T10:00:00.000Z')`,
    [session.player.id, run.id]
  );
  await query(
    `INSERT INTO player_achievements (id, player_id, achievement_id, source_type, source_id, season_id, earned_at)
     VALUES
      ('ach_refresh_old', $1, 'first_ring_crossed', 'run', 'older_run', 'season_1', '2026-05-04T09:00:00.000Z'),
      ('ach_refresh_new', $1, 'season_bronze_spore', 'run', $2, 'season_1', '2026-05-04T10:00:00.000Z')`,
    [session.player.id, run.id]
  );

  const details = await getGameRun(run.id, session.player.id);

  assert.equal(details.status, 'completed');
  assert.equal(details.player.completedRounds, 1);
  assertRunCurrencyAliases(details.player, 2);
  assertRunCurrencyAliases(details.players[0], 2);
  assert.equal(details.lastRound.roundNumber, 1);
  assert.deepEqual(details.lastRound.rewards, { spore: 1, mycelium: 5 });
  assert.equal(details.season.runPoints, 1);
  assert.equal(details.season.totalPoints, 1);
  assert.deepEqual(details.achievements, [
    { id: 'season_bronze_spore', isNew: true },
    { id: 'first_ring_crossed', isNew: false }
  ]);
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

test('[Req 12-D] bootstrap includes activeGameRun when a run is active', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const run = await startGameRun(session.player.id, 'solo');
  const bootstrap = await getBootstrap(session.player.id);

  assert.ok(bootstrap.activeGameRun);
  assert.equal(bootstrap.activeGameRun.id, run.id);
  assert.equal(bootstrap.activeGameRun.mushroomId, 'thalla');
  assert.equal(bootstrap.activeGameRuns.length, 1);
});

test('[Req 1-G, 12-D] bootstrap activeGameRun follows selected mushroom', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);
  const thallaRun = await startGameRun(session.player.id, 'solo');

  await saveSetup(session.player.id, 'lomie', loadout);
  const lomieRun = await startGameRun(session.player.id, 'solo');

  let bootstrap = await getBootstrap(session.player.id);
  assert.equal(bootstrap.activeMushroomId, 'lomie');
  assert.equal(bootstrap.activeGameRun.id, lomieRun.id);
  assert.equal(bootstrap.activeGameRuns.length, 2);

  await saveSetup(session.player.id, 'thalla', loadout);
  bootstrap = await getBootstrap(session.player.id);
  assert.equal(bootstrap.activeMushroomId, 'thalla');
  assert.equal(bootstrap.activeGameRun.id, thallaRun.id);
  assert.equal(bootstrap.activeGameRuns.length, 2);
});

test('[Req 1-G, 12-D] bootstrap maps legacy active runs to selected mushroom', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);
  const run = await startGameRun(session.player.id, 'solo');
  await query(
    `UPDATE game_run_players SET mushroom_id = NULL WHERE game_run_id = $1 AND player_id = $2`,
    [run.id, session.player.id]
  );

  const bootstrap = await getBootstrap(session.player.id);

  assert.equal(bootstrap.activeMushroomId, 'thalla');
  assert.equal(bootstrap.activeGameRun.id, run.id);
  assert.equal(bootstrap.activeGameRun.mushroomId, 'thalla');
  assert.deepEqual(bootstrap.activeGameRuns.map((activeRun) => activeRun.mushroomId), ['thalla']);
});

test('bootstrap has null activeGameRun when no run is active', async () => {
  await freshDb();
  const session = await createPlayer();
  await saveSetup(session.player.id, 'thalla', loadout);

  const bootstrap = await getBootstrap(session.player.id);
  assert.equal(bootstrap.activeGameRun, null);
});

test('[Req 1-H] daily limit counts game runs started', async () => {
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
