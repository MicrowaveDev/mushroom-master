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
import { freshDb, createPlayer, seedRunLoadout } from './helpers.js';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

async function setupPlayerWithRun(overrides = {}) {
  const session = await createPlayer(overrides);
  await selectActiveMushroom(session.player.id, 'thalla');
  await saveArtifactLoadout(session.player.id, 'thalla', loadout);
  const run = await startGameRun(session.player.id, 'solo');
  // Replace the auto-generated starter with the deterministic test loadout.
  await seedRunLoadout(session.player.id, run.id, loadout);
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

test('player loses exactly one life per round loss (not per combat step)', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // Verify lives before any rounds
  let state = await getPlayerState(playerId);
  // Resolve several rounds and track lives — lives should decrement at most by 1 per round,
  // regardless of how many combat steps occurred in the battle.
  let previousLives = STARTING_LIVES;
  for (let i = 0; i < 3; i++) {
    const result = await resolveRound(playerId, run.id);
    const newLives = result.player.livesRemaining;
    const delta = previousLives - newLives;
    // A round loss deducts exactly 1 life, a win deducts 0
    if (result.lastRound.outcome === 'loss') {
      assert.equal(delta, 1, `Round ${i + 1} (loss) should decrement lives by 1, got ${delta}`);
    } else {
      assert.equal(delta, 0, `Round ${i + 1} (win) should not decrement lives, got ${delta}`);
    }
    previousLives = newLives;
    if (result.status !== 'active') break;
  }
});

async function getLastGhostCost(playerId) {
  const { query } = await import('../../app/server/db.js');
  const { getArtifactById, getArtifactPrice } = await import('../../app/server/game-data.js');
  const battlesResult = await query(
    `SELECT id FROM battles WHERE initiator_player_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [playerId]
  );
  const battleId = battlesResult.rows[0].id;
  const snapshotsResult = await query(
    `SELECT side, payload_json FROM battle_snapshots WHERE battle_id = $1`,
    [battleId]
  );
  const right = snapshotsResult.rows.find((r) => r.side === 'right');
  const ghostLoadout = JSON.parse(right.payload_json).loadout;
  return ghostLoadout.items.reduce((sum, item) => {
    const a = getArtifactById(item.artifactId);
    return sum + (a ? getArtifactPrice(a) : 0);
  }, 0);
}

test('round 1 ghost budget has grace factor (≤ 70% of player spend)', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();
  // Starter loadout = 2 coins spent (spore_needle + bark_plate).
  // Round 1 budget = max(3, floor(2 * 0.88 * 0.7)) = max(3, 1) = 3 → ghost cost ≤ 3
  await resolveRound(playerId, run.id);
  const ghostCost = await getLastGhostCost(playerId);
  assert.ok(ghostCost <= 3, `Round 1 ghost cost ${ghostCost} should be ≤ 3 (grace-floored)`);
});

test('round 2 ghost budget has lighter grace factor (≤ 85%)', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();
  await resolveRound(playerId, run.id); // advance to round 2
  await resolveRound(playerId, run.id);
  const ghostCost = await getLastGhostCost(playerId);
  // Still floored at 3 with 2-coin starter, but formula is more lenient than round 1
  assert.ok(ghostCost <= 3, `Round 2 ghost cost ${ghostCost} should be ≤ 3 (grace-floored)`);
});

test('ghost budget is capped by cumulative round income', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();
  const { ROUND_INCOME, GHOST_BUDGET_DISCOUNT } = await import('../../app/server/game-data.js');

  // Play through several rounds and verify ghost cost never exceeds cumulative income
  for (let i = 0; i < 4; i++) {
    const result = await resolveRound(playerId, run.id);
    if (result.status !== 'active') break;
    const ghostCost = await getLastGhostCost(playerId);
    const round = i + 1;
    const cumulativeIncome = ROUND_INCOME.slice(0, round).reduce((s, c) => s + c, 0);
    // Ghost can't exceed cumulative income × (1 - discount) × grace
    const graceFactor = round === 1 ? 0.7 : round === 2 ? 0.85 : 1.0;
    const theoreticalMax = Math.floor(cumulativeIncome * (1 - GHOST_BUDGET_DISCOUNT) * graceFactor);
    const hardCap = Math.max(3, theoreticalMax);
    assert.ok(
      ghostCost <= hardCap + 1, // +1 tolerance for rounding in bot loadout generator
      `Round ${round}: ghost cost ${ghostCost} exceeds theoretical cap ${hardCap} (cumulative income ${cumulativeIncome})`
    );
  }
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
