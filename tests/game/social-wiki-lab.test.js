import test from 'node:test';
import assert from 'node:assert/strict';
import { addFriendByCode, acceptFriendChallenge, createRunChallenge, getFriends, getLeaderboard, getPlayerState, saveLocalTestRun } from '../../app/server/services/game-service.js';
import { getWikiEntry, getWikiHome } from '../../app/server/wiki.js';
import { createPlayer, freshDb, saveSetup } from './helpers.js';

test('friend codes + challenge accept creates a shared game run', async () => {
  // The legacy single-battle "challenge_type=battle" path was deleted
  // 2026-04-13. All friend challenges are now run challenges that produce
  // a shared game_run with both players as participants.
  await freshDb();
  const challenger = await createPlayer({ telegramId: 401, username: 'challenger' });
  const invitee = await createPlayer({ telegramId: 402, username: 'invitee' });

  await saveSetup(challenger.player.id, 'morga');
  await saveSetup(invitee.player.id, 'lomie');

  const inviteeProfile = await getPlayerState(invitee.player.id);
  const challengerProfile = await getPlayerState(challenger.player.id);
  await addFriendByCode(challenger.player.id, inviteeProfile.player.friendCode);
  await addFriendByCode(invitee.player.id, challengerProfile.player.friendCode);
  const friends = await getFriends(challenger.player.id);
  assert.equal(friends.length, 1);

  const challenge = await createRunChallenge(challenger.player.id, invitee.player.id);
  assert.ok(challenge.id);
  assert.equal(challenge.challengeType, 'run');

  const acceptedRun = await acceptFriendChallenge(challenge.id, invitee.player.id);
  assert.equal(acceptedRun.mode, 'challenge');
  assert.equal(acceptedRun.status, 'active');
  assert.ok(acceptedRun.players[challenger.player.id]);
  assert.ok(acceptedRun.players[invitee.player.id]);

  const leaderboard = await getLeaderboard();
  // Both players exist on the leaderboard at default rating (1000) since
  // no rounds have been resolved yet.
  assert.ok(leaderboard.find((entry) => entry.id === challenger.player.id));
  assert.ok(leaderboard.find((entry) => entry.id === invitee.player.id));
});

test('wiki pages and local ai lab route are available in non-production', async () => {
  await freshDb();
  const wikiHome = await getWikiHome();
  assert.ok(wikiHome.characters.length >= 5);

  const wikiEntry = await getWikiEntry('characters', 'thalla');
  assert.match(wikiEntry.markdown, /Тхалла/);
  assert.equal(typeof wikiEntry.html, 'string');
  assert.ok(Array.isArray(wikiEntry.sections), 'sections array present');
  assert.ok(wikiEntry.sections.length > 0);

  const run = await saveLocalTestRun({
    fixtureNarration: 'Thalla stuns Kirt on round one.',
    variants: [{ name: 'ru', model: 'gpt-4.1-mini', prompt: 'Опиши бой.' }],
    results: [{ output: '[mock] ok', latencyMs: 0 }]
  });
  assert.ok(run.id);
});
