import assert from 'node:assert/strict';
import test from 'node:test';
import { FriendsScreen } from '../../web/src/pages/FriendsScreen.js';

function viewModel(extra = {}) {
  const vm = { ...extra };
  for (const [key, getter] of Object.entries(FriendsScreen.computed)) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  return vm;
}

test('friends screen delegates neutral page structure and provider actions to core', () => {
  assert.equal(FriendsScreen.components.CoreFriendsScreen.name, 'FriendsScreen');
  assert.match(FriendsScreen.template, /core-friends-screen/);
  assert.match(FriendsScreen.template, /:build-invite-link="buildInviteLink"/);
  assert.match(FriendsScreen.template, /:copy-text="copyText"/);
  assert.match(FriendsScreen.template, /:share-invite="shareInvite"/);

  const player = { id: 'player_1', friendCode: 'ALLY42' };
  const friends = [{ id: 'player_2', name: 'Ally' }];
  const challenge = { id: 'challenge_1', status: 'pending' };
  const vm = viewModel({
    state: {
      bootstrap: { player },
      friends,
      challenge
    },
    t: {
      friends: 'Friends',
      friendCode: 'Friend code',
      friendCodeCopied: 'Copied',
      copyFriendCode: 'Copy code',
      shareFriendInvite: 'Share',
      friendInviteText: 'Use {code} at {link}',
      addFriend: 'Add',
      roster: 'Roster',
      createChallenge: 'Challenge',
      noFriendsYet: 'No friends',
      challengeSection: 'Challenge',
      acceptChallenge: 'Accept',
      declineChallenge: 'Decline',
      challengeStatus_pending: 'Waiting',
      challengeStatus_accepted: 'Accepted',
      challengeStatus_declined: 'Declined',
      challengeStatus_completed: 'Completed'
    }
  });

  assert.equal(vm.profile, player);
  assert.equal(vm.friends, friends);
  assert.equal(vm.challenge, challenge);
  assert.equal(vm.labels.challengeStatuses.pending, 'Waiting');
});
