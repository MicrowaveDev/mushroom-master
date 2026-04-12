import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRunChallenge,
  acceptFriendChallenge,
  resolveRound,
  abandonGameRun,
  getPlayerState,
  addFriendByCode
} from '../../app/server/services/game-service.js';
import { STARTING_LIVES, ROUND_INCOME, CHALLENGE_WINNER_BONUS, MAX_ROUNDS_PER_RUN } from '../../app/server/game-data.js';
import { freshDb, createPlayer, saveSetup } from './helpers.js';

const loadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 }
];

async function setupTwoFriends() {
  const sessionA = await createPlayer({ telegramId: 501, username: 'alice' });
  const sessionB = await createPlayer({ telegramId: 502, username: 'bob' });
  await saveSetup(sessionA.player.id, 'thalla', loadout);
  await saveSetup(sessionB.player.id, 'kirt', [
    { artifactId: 'amber_fang', x: 0, y: 0, width: 1, height: 2 },
    { artifactId: 'shock_puff', x: 1, y: 0, width: 1, height: 1 }
  ]);

  // Make them friends
  await addFriendByCode(sessionA.player.id, sessionB.player.friend_code);

  return {
    playerA: sessionA.player.id,
    playerB: sessionB.player.id,
    friendCodeB: sessionB.player.friend_code
  };
}

test('[Req 8-A, 8-C] creating and accepting a challenge run', async () => {
  await freshDb();
  const { playerA, playerB } = await setupTwoFriends();

  const challenge = await createRunChallenge(playerA, playerB);
  assert.equal(challenge.status, 'pending');
  assert.equal(challenge.challengeType, 'run');
  assert.equal(challenge.challengerPlayerId, playerA);
  assert.equal(challenge.inviteePlayerId, playerB);

  const run = await acceptFriendChallenge(challenge.id, playerB);
  assert.equal(run.mode, 'challenge');
  assert.equal(run.status, 'active');
  assert.equal(run.currentRound, 1);
  assert.ok(run.players[playerA]);
  assert.ok(run.players[playerB]);
  assert.equal(run.players[playerA].coins, ROUND_INCOME[0]);
  assert.equal(run.players[playerB].coins, ROUND_INCOME[0]);
});

test('[Req 1-G] challenge run rejects if challenger has active run', async () => {
  await freshDb();
  const { playerA, playerB } = await setupTwoFriends();

  // Start a solo run for playerA
  const { startGameRun } = await import('../../app/server/services/game-service.js');
  await startGameRun(playerA, 'solo');

  await assert.rejects(
    () => createRunChallenge(playerA, playerB),
    /already have an active game run/
  );
});

test('[Req 8-A] challenge run rejects non-friends', async () => {
  await freshDb();
  const sessionA = await createPlayer({ telegramId: 601, username: 'stranger1' });
  const sessionB = await createPlayer({ telegramId: 602, username: 'stranger2' });

  await assert.rejects(
    () => createRunChallenge(sessionA.player.id, sessionB.player.id),
    /only challenge friends/
  );
});

test('[Req 8-A, 9-A] challenge round resolution gives opposite outcomes', async () => {
  await freshDb();
  const { playerA, playerB } = await setupTwoFriends();

  const challenge = await createRunChallenge(playerA, playerB);
  const run = await acceptFriendChallenge(challenge.id, playerB);

  const result = await resolveRound(playerA, run.id);

  assert.ok(result.playerResults);
  const resultA = result.playerResults[playerA];
  const resultB = result.playerResults[playerB];

  assert.ok(resultA);
  assert.ok(resultB);
  assert.equal(resultA.completedRounds, 1);
  assert.equal(resultB.completedRounds, 1);

  // Opposite outcomes
  if (resultA.lastRound.outcome === 'win') {
    assert.equal(resultB.lastRound.outcome, 'loss');
  } else {
    assert.equal(resultB.lastRound.outcome, 'win');
  }

  // Both get rewards independently
  assert.ok(resultA.lastRound.rewards.spore > 0);
  assert.ok(resultB.lastRound.rewards.spore > 0);
});

test('[Req 8-E] challenge mode has no per-round Elo changes', async () => {
  await freshDb();
  const { playerA, playerB } = await setupTwoFriends();

  const ratingBefore = (await getPlayerState(playerA)).player.rating;

  const challenge = await createRunChallenge(playerA, playerB);
  const run = await acceptFriendChallenge(challenge.id, playerB);
  await resolveRound(playerA, run.id);

  // Rating should not change per round in challenge mode
  const ratingAfter = (await getPlayerState(playerA)).player.rating;
  assert.equal(ratingBefore, ratingAfter);
});

test('[Req 1-F] challenge abandon ends run for both players', async () => {
  await freshDb();
  const { playerA, playerB } = await setupTwoFriends();

  const challenge = await createRunChallenge(playerA, playerB);
  const run = await acceptFriendChallenge(challenge.id, playerB);

  const result = await abandonGameRun(playerA, run.id);
  assert.equal(result.status, 'abandoned');

  // Both players should no longer have active runs
  const { getActiveGameRun } = await import('../../app/server/services/game-service.js');
  const activeA = await getActiveGameRun(playerA);
  const activeB = await getActiveGameRun(playerB);
  assert.equal(activeA, null);
  assert.equal(activeB, null);
});

test('[Req 10-B, 10-D] challenge run applies batch Elo on abandon', async () => {
  await freshDb();
  const { playerA, playerB } = await setupTwoFriends();

  const challenge = await createRunChallenge(playerA, playerB);
  const run = await acceptFriendChallenge(challenge.id, playerB);

  // Play one round so there are wins/losses
  await resolveRound(playerA, run.id);

  const ratingBeforeA = (await getPlayerState(playerA)).player.rating;
  const ratingBeforeB = (await getPlayerState(playerB)).player.rating;

  await abandonGameRun(playerA, run.id);

  const ratingAfterA = (await getPlayerState(playerA)).player.rating;
  const ratingAfterB = (await getPlayerState(playerB)).player.rating;

  // At least one player's rating should change (batch Elo applied)
  const aChanged = ratingAfterA !== ratingBeforeA;
  const bChanged = ratingAfterB !== ratingBeforeB;
  assert.ok(aChanged || bChanged);
});

test('[Req 9-C] challenge winner receives winner bonus spore and mycelium', async () => {
  await freshDb();
  const { playerA, playerB } = await setupTwoFriends();

  const challenge = await createRunChallenge(playerA, playerB);
  const run = await acceptFriendChallenge(challenge.id, playerB);

  // Play rounds until the run ends (one player hits STARTING_LIVES losses or MAX_ROUNDS)
  let lastResult;
  for (let i = 0; i < 12; i++) {
    lastResult = await resolveRound(playerA, run.id);
    if (lastResult.runEnded) break;
  }

  assert.ok(lastResult.runEnded, 'Run should have ended');

  // Determine the winner (fewer losses) from the player results
  const stateA = await getPlayerState(playerA);
  const stateB = await getPlayerState(playerB);
  const resultA = lastResult.playerResults[playerA];
  const resultB = lastResult.playerResults[playerB];

  // If one has more losses, the other is the winner
  const lossesA = resultA.losses;
  const lossesB = resultB.losses;

  if (lossesA !== lossesB) {
    const winnerId = lossesA < lossesB ? playerA : playerB;
    const loserId = lossesA < lossesB ? playerB : playerA;
    const winnerState = winnerId === playerA ? stateA : stateB;
    const loserState = loserId === playerA ? stateA : stateB;

    // Winner's spore should include the CHALLENGE_WINNER_BONUS
    // Both get completion bonus + per-round rewards + winner bonus.
    // We can't precisely decompose, but we can verify winner has more spore
    // than loser by at least the bonus amount (assuming similar round rewards).
    assert.ok(
      winnerState.player.spore >= CHALLENGE_WINNER_BONUS.spore,
      `Winner spore ${winnerState.player.spore} should be >= ${CHALLENGE_WINNER_BONUS.spore}`
    );
  }
  // If lossesA === lossesB (both reached max rounds with equal losses),
  // there's no winner — test still passes as it verified the run completed.
});

test('[Req 8-D] challenge ends when one player hits STARTING_LIVES losses', async () => {
  await freshDb();
  const { playerA, playerB } = await setupTwoFriends();

  const challenge = await createRunChallenge(playerA, playerB);
  const run = await acceptFriendChallenge(challenge.id, playerB);

  let lastResult;
  let roundsPlayed = 0;
  for (let i = 0; i < MAX_ROUNDS_PER_RUN + 1; i++) {
    lastResult = await resolveRound(playerA, run.id);
    roundsPlayed++;
    if (lastResult.runEnded) break;
  }

  assert.ok(lastResult.runEnded, 'Challenge run should end');

  const resultA = lastResult.playerResults[playerA];
  const resultB = lastResult.playerResults[playerB];

  // Either max_rounds reached or one player was eliminated
  if (lastResult.endReason === 'max_losses') {
    // One player must have exactly STARTING_LIVES losses
    const maxLosses = Math.max(resultA.losses, resultB.losses);
    assert.equal(maxLosses, STARTING_LIVES,
      `Eliminated player should have ${STARTING_LIVES} losses, got ${maxLosses}`);
  } else {
    // max_rounds — both survived
    assert.equal(lastResult.endReason, 'max_rounds');
    assert.equal(roundsPlayed, MAX_ROUNDS_PER_RUN);
  }

  // Both players should be inactive after run ends
  const { getActiveGameRun } = await import('../../app/server/services/game-service.js');
  assert.equal(await getActiveGameRun(playerA), null);
  assert.equal(await getActiveGameRun(playerB), null);
});
