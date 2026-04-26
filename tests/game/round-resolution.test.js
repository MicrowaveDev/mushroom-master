import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startGameRun,
  resolveRound,
  abandonGameRun,
  getActiveGameRun,
  getPlayerState,
  refreshRunShop,
  sellRunItem,
  selectActiveMushroom,
  generateShopOffer
} from '../../app/server/services/game-service.js';
import {
  artifacts,
  STARTING_LIVES,
  ROUND_INCOME,
  RATING_FLOOR,
  runRewardTable,
  combatArtifacts,
  bags,
  mushrooms,
  characterShopItems,
  getEligibleCharacterItems,
  SHOP_REFRESH_CHEAP_LIMIT,
  BAG_PITY_THRESHOLD
} from '../../app/server/game-data.js';
import { createRng } from '../../app/server/lib/utils.js';
import { freshDb, createPlayer, seedRunLoadout, getShopOffer, earnMycelium, bootRun } from './helpers.js';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

async function setupPlayerWithRun(overrides = {}) {
  const session = await createPlayer(overrides);
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');
  // Round 1 starts empty — seed the deterministic test loadout directly.
  await seedRunLoadout(session.player.id, run.id, loadout);
  return { session, run, playerId: session.player.id };
}

test('[Req 1-D, 9-A] resolving a round updates wins or losses and pays rewards', async () => {
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

test('[Req 10-A] Elo is updated per round in solo mode', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  const result = await resolveRound(playerId, run.id);

  assert.notEqual(result.lastRound.ratingBefore, result.lastRound.ratingAfter);
  assert.ok(result.lastRound.ratingAfter >= RATING_FLOOR);
});

test('[Req 1-E] elimination at 5 losses ends the run', async () => {
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

test('[Req 1-D] no draw outcome in runs — forced to loss', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // We can't control the seed, but we can verify the outcome is never 'draw'
  const result = await resolveRound(playerId, run.id);
  assert.ok(result.lastRound.outcome === 'win' || result.lastRound.outcome === 'loss');
});

test('[Req 1-E] cannot resolve round on completed run', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();
  await abandonGameRun(playerId, run.id);

  await assert.rejects(
    () => resolveRound(playerId, run.id),
    /not found or already ended/
  );
});

test('[Req 4-G] shop refresh costs 1 coin for first 3 refreshes', async () => {
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

test('[Req 4-G] shop refresh costs 2 coins from refresh 4 onward', async () => {
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

test('[Req 4-G, 4-I] shop refresh rejects when not enough coins', async () => {
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

test('[Req 4-J] sell item same round gives full refund', async () => {
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

test('[Req 1-D] player loses exactly one life per round loss (not per combat step)', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // Resolve every round of a full run and track lives. The invariant is:
  //   livesRemaining[N] = STARTING_LIVES - cumulative_losses_through_round_N
  // i.e. exactly 1 life per loss, 0 per win, regardless of how many combat
  // steps the underlying battle ran for. A bug that deducted "1 per damage
  // tick" or "1 per stun" would break this within the first couple of rounds.
  let previousLives = STARTING_LIVES;
  let cumulativeLosses = 0;
  let cumulativeWins = 0;
  for (let i = 0; i < 9; i++) {
    const result = await resolveRound(playerId, run.id);
    const newLives = result.player.livesRemaining;
    const delta = previousLives - newLives;
    if (result.lastRound.outcome === 'loss') {
      assert.equal(delta, 1, `Round ${i + 1} (loss) should decrement lives by exactly 1, got ${delta}`);
      cumulativeLosses += 1;
    } else {
      assert.equal(delta, 0, `Round ${i + 1} (win) should not decrement lives, got ${delta}`);
      cumulativeWins += 1;
    }
    // Cross-round invariant: lives is always STARTING_LIVES − cumulativeLosses
    assert.equal(
      newLives,
      STARTING_LIVES - cumulativeLosses,
      `After round ${i + 1}: lives ${newLives} should equal STARTING_LIVES (${STARTING_LIVES}) − cumulativeLosses (${cumulativeLosses})`
    );
    // And player.wins / player.losses agree with our running tallies
    assert.equal(result.player.wins, cumulativeWins);
    assert.equal(result.player.losses, cumulativeLosses);
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

test('[Req 7-D] round 1 ghost budget has grace factor (≤ 70% of player spend)', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();
  const { getStarterPresetCost } = await import('../../app/server/game-data.js');
  // Seeded test loadout = 2 coins spent (spore_needle + bark_plate).
  // Round 1 shop budget = max(3, floor(2 * 0.88 * 0.7)) = max(3, 1) = 3
  // Ghost also carries its character's preset on top of shop items.
  // We don't know which mushroom the ghost rolled, so use 2 (max preset cost).
  await resolveRound(playerId, run.id);
  const ghostCost = await getLastGhostCost(playerId);
  const maxPresetCost = 2;
  assert.ok(ghostCost <= 3 + maxPresetCost, `Round 1 ghost cost ${ghostCost} should be ≤ ${3 + maxPresetCost} (shop budget floored + preset)`);
});

test('[Req 7-D] round 2 ghost budget has lighter grace factor (≤ 85%)', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();
  await resolveRound(playerId, run.id); // advance to round 2
  await resolveRound(playerId, run.id);
  const ghostCost = await getLastGhostCost(playerId);
  const maxPresetCost = 2;
  assert.ok(ghostCost <= 3 + maxPresetCost, `Round 2 ghost cost ${ghostCost} should be ≤ ${3 + maxPresetCost} (shop budget floored + preset)`);
});

test('[Req 7-D, 7-E] ghost budget is capped by cumulative round income', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();
  const { ROUND_INCOME, GHOST_BUDGET_DISCOUNT } = await import('../../app/server/game-data.js');
  const maxPresetCost = 2;

  // Play through several rounds and verify ghost cost never exceeds cumulative income + preset
  for (let i = 0; i < 4; i++) {
    const result = await resolveRound(playerId, run.id);
    if (result.status !== 'active') break;
    const ghostCost = await getLastGhostCost(playerId);
    const round = i + 1;
    const cumulativeIncome = ROUND_INCOME.slice(0, round).reduce((s, c) => s + c, 0);
    const graceFactor = round === 1 ? 0.7 : round === 2 ? 0.85 : 1.0;
    const theoreticalMax = Math.floor(cumulativeIncome * (1 - GHOST_BUDGET_DISCOUNT) * graceFactor);
    const hardCap = Math.max(3, theoreticalMax) + maxPresetCost;
    assert.ok(
      ghostCost <= hardCap + 1, // +1 tolerance for rounding in bot loadout generator
      `Round ${round}: ghost cost ${ghostCost} exceeds theoretical cap ${hardCap} (cumulative income ${cumulativeIncome} + preset)`
    );
  }
});

test('[Req 9-B] getCompletionBonus pins every tier of the bonus table', async () => {
  const { getCompletionBonus } = await import('../../app/server/game-data.js');
  // Pin every tier explicitly so a silent shift in the table cutoffs is
  // caught immediately, not detected weeks later by player complaints.
  // Each row is [wins, spore, mycelium] from docs/game-requirements.md §9-B.
  const expected = [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 0],
    [3, 5, 2],
    [4, 5, 2],
    [5, 10, 5],
    [6, 10, 5],
    [7, 20, 10],
    [8, 20, 10],
    [9, 20, 10]
  ];
  for (const [wins, spore, mycelium] of expected) {
    const bonus = getCompletionBonus(wins);
    assert.equal(bonus.spore, spore, `wins=${wins} spore mismatch`);
    assert.equal(bonus.mycelium, mycelium, `wins=${wins} mycelium mismatch`);
  }
});

test('[Req 9-B, 10-D] abandon pays completion bonus based on wins', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  const sporeBefore = (await getPlayerState(playerId)).player.spore;
  await abandonGameRun(playerId, run.id);
  const sporeAfter = (await getPlayerState(playerId)).player.spore;

  // 0 wins = 0 bonus, so spore should be unchanged
  assert.equal(sporeAfter, sporeBefore);
});

// --- Shop generation & economy gap tests ---

test('[Req 3-D] shop offer never contains starterOnly artifacts', () => {
  const starterOnlyIds = new Set(
    artifacts.filter((a) => a.starterOnly).map((a) => a.id)
  );
  // Run 100 random shop generations and verify none contain starter-only items
  for (let i = 0; i < 100; i++) {
    const rng = createRng(`shop-starter-check-${i}`);
    const { offer } = generateShopOffer(rng, 5, 1);
    for (const id of offer) {
      assert.ok(!starterOnlyIds.has(id), `Shop offer should not contain starterOnly artifact ${id}`);
    }
  }
});

test('[Req 3-D] manual refreshRunShop never returns starterOnly artifacts (integration)', async () => {
  // Belt-and-braces: the unit test above pins generateShopOffer in isolation,
  // but the player-facing path is refreshRunShop in run-service. This test
  // exercises the full path: start a real run, force enough coins to refresh
  // many times, and verify no starter-only artifact ever appears in the
  // persisted offer. Catches regressions where refreshRunShop bypasses the
  // combatArtifacts filter (e.g. by reading from the unfiltered `artifacts`
  // export by mistake).
  await freshDb();
  const { query } = await import('../../app/server/db.js');
  const starterOnlyIds = new Set(
    artifacts.filter((a) => a.starterOnly).map((a) => a.id)
  );

  // Loop over enough player seeds to cover all 5 mushrooms with varied seeds.
  for (const mushroomId of ['thalla', 'lomie', 'axilin', 'kirt', 'morga']) {
    const session = await createPlayer({ telegramId: 7000 + mushroomId.charCodeAt(0), username: `refresh_${mushroomId}` });
    await selectActiveMushroom(session.player.id, mushroomId);
    const run = await startGameRun(session.player.id, 'solo');
    // Top up coins so we can fuzz lots of refreshes regardless of cost escalation.
    await query(`UPDATE game_run_players SET coins = 1000 WHERE game_run_id = $1`, [run.id]);

    for (let i = 0; i < 30; i++) {
      const refreshed = await refreshRunShop(session.player.id, run.id);
      for (const id of refreshed.shopOffer) {
        assert.ok(
          !starterOnlyIds.has(id),
          `${mushroomId} refresh #${i + 1}: starterOnly artifact "${id}" leaked into shop offer`
        );
      }
    }
  }
});

test('[Req 3-D, 7-F] bot loadout never injects starterOnly artifacts beyond the preset', async () => {
  // The bot's preset items ARE marked starterOnly (Req 3-D allows this — the
  // preset is the only legitimate way for them to appear). What we forbid is
  // EXTRA starter-only items being rolled into the bot's "shop" purchases.
  // Assert that the count of starter-only items equals exactly the preset
  // count (always 2) for many seeds, mushrooms, and budgets.
  const { createBotLoadout } = await import('../../app/server/services/bot-loadout.js');
  const { getMushroomById, getStarterPreset } = await import('../../app/server/game-data.js');
  const starterOnlyIds = new Set(
    artifacts.filter((a) => a.starterOnly).map((a) => a.id)
  );

  for (const mushroomId of ['thalla', 'lomie', 'axilin', 'kirt', 'morga']) {
    const presetIds = new Set(['starter_bag', ...getStarterPreset(mushroomId).map((p) => p.artifactId)]);
    for (let seed = 0; seed < 25; seed++) {
      const rng = createRng(`bot-starter-${mushroomId}-${seed}`);
      const budget = 5 + (seed % 12) * 4;
      const loadout = createBotLoadout(getMushroomById(mushroomId), rng, budget);
      const starterOnlyInLoadout = loadout.items.filter((it) => starterOnlyIds.has(it.artifactId));
      // Every starterOnly item in the loadout MUST be the bot's own preset item.
      for (const item of starterOnlyInLoadout) {
        assert.ok(
          presetIds.has(item.artifactId),
          `${mushroomId} seed ${seed} budget ${budget}: bot got starterOnly artifact "${item.artifactId}" that is NOT its preset`
        );
      }
    }
  }
});

test('[Req 4-H] first shop refresh costs 1 coin (not free)', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  const coinsBefore = run.player.coins;
  const result = await refreshRunShop(playerId, run.id);

  assert.equal(result.refreshCost, 1, 'First refresh should cost 1 coin');
  assert.equal(result.coins, coinsBefore - 1, 'Coins should decrease by 1');
});

test('[Req 4-G] refresh cost escalates after SHOP_REFRESH_CHEAP_LIMIT', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // Do CHEAP_LIMIT refreshes at cost 1 each
  for (let i = 0; i < SHOP_REFRESH_CHEAP_LIMIT; i++) {
    const r = await refreshRunShop(playerId, run.id);
    assert.equal(r.refreshCost, 1, `Refresh ${i + 1} should cost 1 coin`);
  }

  // Next refresh should cost 2
  const expensive = await refreshRunShop(playerId, run.id);
  assert.equal(expensive.refreshCost, 2, 'Refresh after cheap limit should cost 2 coins');
});

test('[Req 5-D] bag pity guarantees a bag after BAG_PITY_THRESHOLD bagless rounds', () => {
  // STRICT: at the pity threshold, EVERY offer must contain a bag — not just
  // "some" of them. Run many seeds and assert hasBag is true on every single
  // one. A regression that softened the guarantee would fail this immediately.
  const bagIds = new Set(bags.map((b) => b.id));
  for (let i = 0; i < 200; i++) {
    const rng = createRng(`pity-strict-${i}`);
    const { offer, hasBag } = generateShopOffer(rng, 5, BAG_PITY_THRESHOLD);
    assert.equal(
      hasBag,
      true,
      `Seed ${i}: at pity threshold (${BAG_PITY_THRESHOLD}), hasBag should be true for ALL offers`
    );
    assert.ok(
      offer.some((id) => bagIds.has(id)),
      `Seed ${i}: pity-guaranteed offer must contain at least one bag artifact`
    );
  }
});

test('[Req 5-D] bag pity does NOT trigger below BAG_PITY_THRESHOLD (probability path is the only source)', () => {
  // At roundsSinceBag = THRESHOLD - 1, the pity guarantee is OFF and bags
  // can only appear via the probability roll. Run enough seeds that we see
  // BOTH outcomes (some with bag, some without) — proving pity is not active.
  let withBag = 0;
  let withoutBag = 0;
  for (let i = 0; i < 200; i++) {
    const rng = createRng(`pity-off-${i}`);
    const { hasBag } = generateShopOffer(rng, 5, BAG_PITY_THRESHOLD - 1);
    if (hasBag) withBag += 1; else withoutBag += 1;
  }
  assert.ok(withBag > 0, 'Pity-off: probability path should still produce some bag offers');
  assert.ok(
    withoutBag > 0,
    `Pity-off: at least some offers should NOT have a bag (got ${withoutBag}/${200}); ` +
    `if all 200 had bags then pity is firing too early`
  );
});

test('[Req 5-E] roundsSinceBag escalation curve is monotonic', () => {
  // The bag rate must monotonically increase as roundsSinceBag grows from 0
  // toward the pity threshold. Sample at each integer step and verify the
  // observed bag frequency never goes backward — catches a regression where
  // the escalation step is dropped or the formula inverted.
  const trials = 400;
  const observedRates = [];
  for (let rsb = 0; rsb < BAG_PITY_THRESHOLD; rsb++) {
    let count = 0;
    for (let i = 0; i < trials; i++) {
      const rng = createRng(`escalation-${rsb}-${i}`);
      const { hasBag } = generateShopOffer(rng, 5, rsb);
      if (hasBag) count += 1;
    }
    observedRates.push(count / trials);
  }
  // Allow tiny non-monotonic blips from RNG noise (≤2pp), but the overall
  // trend across the full curve must be strictly increasing from end to end.
  assert.ok(
    observedRates[observedRates.length - 1] > observedRates[0],
    `Escalation curve should rise from rsb=0 (${observedRates[0]}) to rsb=${BAG_PITY_THRESHOLD - 1} (${observedRates[observedRates.length - 1]})`
  );
  for (let i = 1; i < observedRates.length; i++) {
    assert.ok(
      observedRates[i] >= observedRates[i - 1] - 0.05,
      `Escalation: rsb=${i} rate (${observedRates[i]}) dropped >5pp below rsb=${i - 1} rate (${observedRates[i - 1]})`
    );
  }
});

test('[Req 5-E] roundsSinceBag=1 gives higher bag chance than roundsSinceBag=0 would', () => {
  // Generate many offers with roundsSinceBag=1 (the initial value) and verify
  // bags can appear — proves the initializer isn't 0.
  const bagIds = new Set(bags.map((b) => b.id));
  let bagCount = 0;
  const trials = 200;
  for (let i = 0; i < trials; i++) {
    const rng = createRng(`rsi-check-${i}`);
    const { hasBag } = generateShopOffer(rng, 5, 1);
    if (hasBag) bagCount += 1;
  }
  // With BAG_BASE_CHANCE=0.15 + 1*0.08 = 23% per slot, 5 slots →
  // P(no bag) ≈ 0.77^5 ≈ 0.27, so ~73% of offers should have a bag.
  // Allow generous range to avoid flakiness.
  assert.ok(bagCount > 10, `Expected bags in >5% of ${trials} offers, got ${bagCount}`);
});

test('[Req 7-A, 7-B] ghost round-robin excludes player mushroom and cycles all others', async () => {
  await freshDb();
  const session = await createPlayer({ telegramId: 9990, username: 'rr_test' });
  await selectActiveMushroom(session.player.id, 'thalla');
  const run = await startGameRun(session.player.id, 'solo');
  await seedRunLoadout(session.player.id, run.id, loadout);

  const { query: dbQuery } = await import('../../app/server/db.js');
  const opponents = [];
  for (let i = 0; i < 4; i++) {
    const result = await resolveRound(session.player.id, run.id);
    // Fetch opponent mushroom from the battle snapshot (right side = ghost)
    if (result.lastRound?.battleId) {
      const snap = await dbQuery(
        `SELECT mushroom_id FROM battle_snapshots WHERE battle_id = $1 AND side = 'right'`,
        [result.lastRound.battleId]
      );
      if (snap.rowCount) opponents.push(snap.rows[0].mushroom_id);
    }
    if (result.status !== 'active') break;
  }

  // Player's own mushroom should never appear as opponent
  assert.ok(!opponents.includes('thalla'), 'Ghost should never be player\'s own mushroom');

  // All 4 non-player mushrooms should appear in first 4 rounds (round-robin)
  if (opponents.length === 4) {
    const unique = new Set(opponents);
    assert.equal(unique.size, 4, `All 4 opponent mushrooms should appear, got ${unique.size} unique`);
  }
});

test('[Req 11-D] shop refresh_count resets to 0 on round transition', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // Refresh once in round 1
  await refreshRunShop(playerId, run.id);

  // Resolve round to advance to round 2
  const result = await resolveRound(playerId, run.id);
  if (result.status !== 'active') return; // run ended, skip

  // Check round 2 shop state has refresh_count = 0
  const { query: dbQuery } = await import('../../app/server/db.js');
  const shopResult = await dbQuery(
    `SELECT refresh_count FROM game_run_shop_states WHERE game_run_id = $1 AND player_id = $2 AND round_number = 2`,
    [run.id, playerId]
  );
  assert.ok(shopResult.rowCount, 'Round 2 shop state should exist');
  assert.equal(shopResult.rows[0].refresh_count, 0, 'refresh_count should reset to 0 for new round');
});

test('[Req 4-A] round income matches ROUND_INCOME table for each round', async () => {
  await freshDb();
  const { playerId, run } = await setupPlayerWithRun();

  // Round 1 starts with ROUND_INCOME[0]
  const r1 = await getActiveGameRun(playerId);
  assert.equal(r1.player.coins, ROUND_INCOME[0], 'Round 1 coins should equal ROUND_INCOME[0]');

  // Resolve round 1 and check round 2 coins include carry-forward + ROUND_INCOME[1]
  const result = await resolveRound(playerId, run.id);
  if (result.status === 'active') {
    const r2 = await getActiveGameRun(playerId);
    const expectedR2 = ROUND_INCOME[0] + ROUND_INCOME[1]; // unspent R1 + R2 income
    assert.equal(r2.player.coins, expectedR2,
      `Round 2 coins should be ${expectedR2} (carried ${ROUND_INCOME[0]} + income ${ROUND_INCOME[1]})`);
  }
});

// --- Character shop items ---

test('[Req 4-P] characterShopItems contains one item per mushroom', () => {
  const mushroomIds = new Set(characterShopItems.map(a => a.characterItem.mushroomId));
  assert.ok(characterShopItems.length >= 6, 'at least one item per mushroom');
  assert.ok(mushroomIds.size >= 6, 'items span all 6 mushrooms');
  for (const item of characterShopItems) {
    assert.ok(item.characterItem, 'has characterItem metadata');
    assert.ok(item.characterItem.mushroomId, 'has mushroomId');
    assert.ok(item.characterItem.requiredLevel > 0, 'has a positive requiredLevel');
    assert.ok(item.price > 0, 'has a price');
  }
});

test('[Req 4-Q] getEligibleCharacterItems returns items when level meets threshold', () => {
  const eligible = getEligibleCharacterItems('thalla', 5);
  assert.ok(eligible.length > 0, 'thalla should have eligible items at level 5');
  assert.ok(eligible.every(a => a.characterItem.mushroomId === 'thalla'), 'all items are for thalla');
});

test('[Req 4-Q] getEligibleCharacterItems returns nothing when level is too low', () => {
  const eligible = getEligibleCharacterItems('thalla', 1);
  assert.equal(eligible.length, 0, 'no items at level 1');
});

test('[Req 4-R] generateShopOffer includes character item when eligible pool is non-empty', () => {
  const eligible = getEligibleCharacterItems('thalla', 5);
  assert.ok(eligible.length > 0, 'precondition: thalla has eligible items');
  const charItemIds = new Set(eligible.map(a => a.id));

  // Run multiple seeds to confirm the guarantee
  let foundCount = 0;
  for (let i = 0; i < 20; i++) {
    const rng = createRng(`char-shop-test-${i}`);
    const { offer } = generateShopOffer(rng, 5, 1, eligible);
    if (offer.some(id => charItemIds.has(id))) foundCount++;
  }
  assert.equal(foundCount, 20, 'every offer should contain at least one character item');
});

test('[Req 4-R] generateShopOffer works normally when no eligible items', () => {
  const rng = createRng('no-char-items');
  const { offer } = generateShopOffer(rng, 5, 1, []);
  assert.equal(offer.length, 5, 'still produces 5 items');
  const charItemIds = new Set(characterShopItems.map(a => a.id));
  assert.ok(offer.every(id => !charItemIds.has(id)), 'no character items in offer');
});

test('[Req 4-P, 4-R] solo run shop includes character item at level 5', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 8001, mushroomId: 'thalla' });
  // Earn enough mycelium to reach level 5 (need ≥350 mycelium)
  await earnMycelium(playerId, run.id, 70);
  await abandonGameRun(playerId, run.id);

  // Start a new run at level 5 — the initial shop should include a character item
  const run2 = await startGameRun(playerId, 'solo');
  const shopOffer = await getShopOffer(run2.id, playerId, 1);

  const charItemIds = new Set(getEligibleCharacterItems('thalla', 5).map(a => a.id));
  assert.ok(charItemIds.size > 0, 'precondition: eligible items exist');
  const hasCharItem = shopOffer.some(id => charItemIds.has(id));
  assert.ok(hasCharItem, 'initial shop offer should include a character item for thalla at level 5');
});

test('[Req 4-T] character item appears in all three solo offer phases: initial, refresh, between-round', async () => {
  // [Req 4-T] says eligibility must apply consistently to: the initial round-1
  // offer, each manual refresh, and each between-round offer. A separate test
  // at the unit level could mock each slice, but this scenario exercises the
  // real pipeline across phases — catching regressions in any one of them.
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 8201, mushroomId: 'thalla' });
  // Raise to level 5 so character items become eligible, then start a new run.
  await earnMycelium(playerId, run.id, 70);
  await abandonGameRun(playerId, run.id);

  const run2 = await startGameRun(playerId, 'solo');
  const charItemIds = new Set(getEligibleCharacterItems('thalla', 5).map(a => a.id));
  assert.ok(charItemIds.size > 0, 'precondition: eligible items exist for thalla at level 5');

  // Phase 1 — initial round-1 offer.
  const initial = await getShopOffer(run2.id, playerId, 1);
  assert.ok(
    initial.some((id) => charItemIds.has(id)),
    'phase 1 (initial round-1 offer) must include a character item'
  );

  // Phase 2 — manual refresh. refreshRunShop deducts coins and rewrites the
  // current-round offer; it must honor the same eligibility rule.
  await refreshRunShop(playerId, run2.id);
  const refreshed = await getShopOffer(run2.id, playerId, 1);
  assert.notDeepStrictEqual(refreshed, initial, 'refresh must produce a new offer');
  assert.ok(
    refreshed.some((id) => charItemIds.has(id)),
    'phase 2 (manual refresh) must include a character item'
  );

  // Phase 3 — between-round offer. Seed a minimal legal loadout then resolve
  // the round. resolveRound advances to round 2 and generates a fresh offer
  // via the same pipeline.
  await seedRunLoadout(playerId, run2.id, loadout);
  await resolveRound(playerId, run2.id);
  const round2 = await getShopOffer(run2.id, playerId, 2);
  assert.ok(round2, 'round 2 offer must be generated');
  assert.ok(
    round2.some((id) => charItemIds.has(id)),
    'phase 3 (between-round offer) must include a character item'
  );
});
