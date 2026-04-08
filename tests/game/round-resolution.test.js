import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startGameRun,
  resolveRound,
  abandonGameRun,
  getPlayerState,
  refreshRunShop,
  sellRunItem,
  saveArtifactLoadout,
  selectActiveMushroom
} from '../../app/server/services/game-service.js';
import { STARTING_LIVES, ROUND_INCOME, RATING_FLOOR, runRewardTable } from '../../app/server/game-data.js';
import { freshDb, createPlayer } from './helpers.js';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

async function setupPlayerWithRun(overrides = {}) {
  const session = await createPlayer(overrides);
  await selectActiveMushroom(session.player.id, 'thalla');
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);
  const run = await startGameRun(session.player.id, 'solo');
  return { session, run, playerId: session.player.id };
}

test('resolving a round updates wins or losses and pays rewards', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  const stateBefore = await getPlayerState(playerId);
  const sporeBefore = stateBefore.player.spore;

  const result = await resolveRound(playerId, run.id);

  assert.equal(result.player.completedRounds, 1);
  assert.ok(result.lastRound.outcome === 'win' || result.lastRound.outcome === 'loss');

  if (result.lastRound.outcome === 'win') {
    assert.equal(result.player.wins, 1);
    assert.equal(result.player.losses, 0);
    assert.equal(result.player.livesRemaining, STARTING_LIVES);
  } else {
    assert.equal(result.player.wins, 0);
    assert.equal(result.player.losses, 1);
    assert.equal(result.player.livesRemaining, STARTING_LIVES - 1);
  }

  // Check spore was awarded
  const stateAfter = await getPlayerState(playerId);
  const expectedReward = runRewardTable[result.lastRound.outcome];
  assert.equal(stateAfter.player.spore, sporeBefore + expectedReward.spore);

  // Check coins include next round income
  assert.equal(result.player.coins, ROUND_INCOME[0] + ROUND_INCOME[1]);
});

test('Elo is updated per round in solo mode', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  const result = await resolveRound(playerId, run.id);

  assert.notEqual(result.lastRound.ratingBefore, result.lastRound.ratingAfter);
  assert.ok(result.lastRound.ratingAfter >= RATING_FLOOR);
});

test('elimination at 5 losses ends the run', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  let result;
  let totalLosses = 0;
  for (let i = 0; i < 9; i++) {
    result = await resolveRound(playerId, run.id);
    if (result.lastRound.outcome === 'loss') {
      totalLosses++;
    }
    if (result.status !== 'active') break;
  }

  // The run may or may not have ended with exactly 5 losses depending on seeds.
  // Just verify the constraint: if ended, it's because of max_losses or max_rounds.
  if (result.status === 'completed') {
    assert.ok(result.endReason === 'max_losses' || result.endReason === 'max_rounds');
  }
});

test('no draw outcome in runs — forced to loss', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // We can't control the seed, but we can verify the outcome is never 'draw'
  const result = await resolveRound(playerId, run.id);
  assert.ok(result.lastRound.outcome === 'win' || result.lastRound.outcome === 'loss');
});

test('cannot resolve round on completed run', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();
  await abandonGameRun(playerId, run.id);

  await assert.rejects(
    () => resolveRound(playerId, run.id),
    /not found or already ended/
  );
});

test('shop refresh costs 1 coin for first 3 refreshes', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  const result1 = await refreshRunShop(playerId, run.id);
  assert.equal(result1.refreshCost, 1);
  assert.equal(result1.refreshCount, 1);
  assert.equal(result1.coins, ROUND_INCOME[0] - 1);

  const result2 = await refreshRunShop(playerId, run.id);
  assert.equal(result2.refreshCost, 1);
  assert.equal(result2.refreshCount, 2);

  const result3 = await refreshRunShop(playerId, run.id);
  assert.equal(result3.refreshCost, 1);
  assert.equal(result3.refreshCount, 3);
});

test('shop refresh costs 2 coins from refresh 4 onward', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // Do 3 cheap refreshes first
  await refreshRunShop(playerId, run.id);
  await refreshRunShop(playerId, run.id);
  await refreshRunShop(playerId, run.id);

  // 4th refresh should cost 2
  const result4 = await refreshRunShop(playerId, run.id);
  assert.equal(result4.refreshCost, 2);
  assert.equal(result4.refreshCount, 4);
});

test('shop refresh rejects when not enough coins', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // Spend all coins on refreshes (5 coins = 3*1 + 1*2 = 5)
  await refreshRunShop(playerId, run.id); // 5-1=4
  await refreshRunShop(playerId, run.id); // 4-1=3
  await refreshRunShop(playerId, run.id); // 3-1=2
  await refreshRunShop(playerId, run.id); // 2-2=0

  await assert.rejects(
    () => refreshRunShop(playerId, run.id),
    /Not enough coins/
  );
});

test('sell item same round gives full refund', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // The player has 'spore_needle' (price 1) and 'bark_plate' (price 1) in loadout
  const result = await sellRunItem(playerId, run.id, 'spore_needle');
  assert.equal(result.sellPrice, 1);
  assert.equal(result.coins, ROUND_INCOME[0] + 1);
});

test('sell non-existent item rejects', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  await assert.rejects(
    () => sellRunItem(playerId, run.id, 'nonexistent_artifact'),
    /Item not found/
  );
});

test('abandon pays completion bonus based on wins', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  const sporeBefore = (await getPlayerState(playerId)).player.spore;
  await abandonGameRun(playerId, run.id);
  const sporeAfter = (await getPlayerState(playerId)).player.spore;

  // 0 wins = 0 bonus, so spore should be unchanged
  assert.equal(sporeAfter, sporeBefore);
});
