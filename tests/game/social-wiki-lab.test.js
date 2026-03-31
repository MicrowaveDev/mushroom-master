import test from 'node:test';
import assert from 'node:assert/strict';
import { addFriendByCode, acceptFriendChallenge, createFriendChallenge, getFriends, getLeaderboard, getPlayerState, saveLocalTestRun } from '../../app/server/services/game-service.js';
import { getWikiEntry, getWikiHome } from '../../app/server/wiki.js';
import { createPlayer, freshDb, saveSetup } from './helpers.js';

const baseLoadout = [
  { artifactId: 'spore_needle', x: 0, y: 0, width: 1, height: 1 },
  { artifactId: 'bark_plate', x: 1, y: 0, width: 1, height: 1 },
  { artifactId: 'shock_puff', x: 2, y: 0, width: 1, height: 1 }
];

test('friend codes, challenge accept flow, and two-sided scoring work', async () => {
  await freshDb();
  const challenger = await createPlayer({ telegramId: 401, username: 'challenger' });
  const invitee = await createPlayer({ telegramId: 402, username: 'invitee' });

  await saveSetup(challenger.player.id, 'morga', baseLoadout);
  await saveSetup(invitee.player.id, 'lomie', [
    { artifactId: 'root_shell', x: 0, y: 0, width: 2, height: 2 },
    { artifactId: 'bark_plate', x: 2, y: 0, width: 1, height: 1 },
    { artifactId: 'shock_puff', x: 3, y: 0, width: 1, height: 1 }
  ]);

  const inviteeProfile = await getPlayerState(invitee.player.id);
  const challengerProfile = await getPlayerState(challenger.player.id);
  await addFriendByCode(challenger.player.id, inviteeProfile.player.friendCode);
  await addFriendByCode(invitee.player.id, challengerProfile.player.friendCode);
  const friends = await getFriends(challenger.player.id);
  assert.equal(friends.length, 1);

  const challenge = await createFriendChallenge(challenger.player.id, invitee.player.id);
  assert.ok(challenge.id);

  const accepted = await acceptFriendChallenge(challenge.id, invitee.player.id);
  assert.equal(accepted.ratedScope, 'two_sided');

  const leaderboard = await getLeaderboard();
  const challengerEntry = leaderboard.find((entry) => entry.id === challenger.player.id);
  const inviteeEntry = leaderboard.find((entry) => entry.id === invitee.player.id);
  assert.notEqual(challengerEntry.rating, 1000);
  assert.notEqual(inviteeEntry.rating, 1000);
});

test('wiki pages and local ai lab route are available in non-production', async () => {
  await freshDb();
  const wikiHome = await getWikiHome();
  assert.ok(wikiHome.characters.length >= 5);

  const wikiEntry = await getWikiEntry('characters', 'thalla');
  assert.match(wikiEntry.markdown, /Тхалла/);
  assert.equal(typeof wikiEntry.html, 'string');

  const run = await saveLocalTestRun({
    fixtureNarration: 'Thalla stuns Kirt on round one.',
    variants: [{ name: 'ru', model: 'gpt-4.1-mini', prompt: 'Опиши бой.' }],
    results: [{ output: '[mock] ok', latencyMs: 0 }]
  });
  assert.ok(run.id);
});
