import assert from 'node:assert/strict';
import test from 'node:test';
import { useSocial } from '../../web/src/composables/useSocial.js';

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      }
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

test('useSocial routes social and wiki calls through the shared route client', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const routes = {
    '/api/friends/add-by-code': [{ id: 'friend_1' }],
    '/api/friends/challenges': { id: 'challenge_1', status: 'pending' },
    '/api/friends/challenges/challenge_1': { id: 'challenge_1', status: 'pending' },
    '/api/friends/challenges/challenge_1/accept': { id: 'battle_1' },
    '/api/friends/challenges/challenge_1/decline': { id: 'challenge_1', status: 'declined' },
    '/api/wiki/characters/slug%20one': { section: 'characters', slug: 'slug one' }
  };
  const state = {
    sessionKey: 'session_social',
    friends: [],
    challenge: null,
    currentBattle: null,
    selectedWiki: null,
    error: ''
  };
  const navigation = [];
  let resetCount = 0;
  let replayCount = 0;

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({ success: true, data: routes[url] });
  };

  try {
    const social = useSocial(state, (screen, extra, routeOptions) => {
      navigation.push({ screen, extra, routeOptions });
    });

    await social.addFriend({
      target: {
        friendCode: { value: ' friend-code ' },
        reset() {
          resetCount += 1;
        }
      }
    });
    await social.challengeFriend('friend_1');
    await social.openChallenge('challenge_1', { routeOptions: { replaceHistory: true } });
    await social.acceptChallenge(() => {
      replayCount += 1;
    });
    state.challenge = { id: 'challenge_1' };
    await social.declineChallenge();
    await social.openWiki('characters', 'slug one');
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.deepEqual(state.friends, [{ id: 'friend_1' }]);
  assert.deepEqual(state.challenge, { id: 'challenge_1', status: 'declined' });
  assert.deepEqual(state.currentBattle, { id: 'battle_1' });
  assert.deepEqual(state.selectedWiki, { section: 'characters', slug: 'slug one' });
  assert.equal(resetCount, 1);
  assert.equal(replayCount, 1);
  assert.deepEqual(navigation, [
    { screen: 'friends', extra: { challenge: 'challenge_1' }, routeOptions: undefined },
    { screen: 'friends', extra: { challenge: 'challenge_1' }, routeOptions: { replaceHistory: true } },
    { screen: 'replay', extra: { replay: 'battle_1' }, routeOptions: undefined },
    { screen: 'wiki-detail', extra: undefined, routeOptions: undefined }
  ]);
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/friends/add-by-code',
    '/api/friends/challenges',
    '/api/friends/challenges/challenge_1',
    '/api/friends/challenges/challenge_1/accept',
    '/api/friends/challenges/challenge_1/decline',
    '/api/wiki/characters/slug%20one'
  ]);
  assert.ok(calls.every((call) => call.init.headers['X-Session-Key'] === 'session_social'));
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, JSON.stringify({ friendCode: 'friend-code' }));
  assert.equal(calls[1].init.body, JSON.stringify({ friendPlayerId: 'friend_1' }));
  assert.equal(calls[2].init.method, 'GET');
  assert.equal(calls[3].init.body, JSON.stringify({}));
});
