import { apiJson } from '../api.js';

export function useSocial(state, goTo) {
  async function addFriend(event) {
    try {
      const friendCode = event.target.friendCode.value.trim();
      state.friends = await apiJson('/api/friends/add-by-code', { method: 'POST', body: JSON.stringify({ friendCode }) }, state.sessionKey);
      event.target.reset();
    } catch (error) {
      state.error = error.message || 'Could not add friend';
    }
  }

  async function challengeFriend(friendPlayerId) {
    try {
      state.challenge = await apiJson('/api/friends/challenges', { method: 'POST', body: JSON.stringify({ friendPlayerId }) }, state.sessionKey);
      goTo('friends', { challenge: state.challenge.id });
    } catch (error) {
      state.error = error.message || 'Could not send challenge';
    }
  }

  async function openChallenge(challengeId) {
    try {
      state.challenge = await apiJson(`/api/friends/challenges/${challengeId}`, {}, state.sessionKey);
      goTo('friends', { challenge: challengeId });
    } catch (error) {
      state.error = error.message || 'Could not load challenge';
    }
  }

  async function acceptChallenge(autoplayReplay) {
    if (!state.challenge) return;
    try {
      state.currentBattle = await apiJson(`/api/friends/challenges/${state.challenge.id}/accept`, { method: 'POST', body: JSON.stringify({}) }, state.sessionKey);
      goTo('replay', { replay: state.currentBattle.id });
      autoplayReplay();
    } catch (error) {
      state.error = error.message || 'Could not accept challenge';
    }
  }

  async function declineChallenge() {
    if (!state.challenge) return;
    try {
      state.challenge = await apiJson(`/api/friends/challenges/${state.challenge.id}/decline`, { method: 'POST', body: JSON.stringify({}) }, state.sessionKey);
    } catch (error) {
      state.error = error.message || 'Could not decline challenge';
    }
  }

  async function openWiki(section, slug) {
    try {
      state.selectedWiki = await apiJson(`/api/wiki/${section}/${slug}`, {}, state.sessionKey);
      goTo('wiki-detail');
    } catch (error) {
      state.error = error.message || 'Could not load wiki entry';
    }
  }

  return { addFriend, challengeFriend, openChallenge, acceptChallenge, declineChallenge, openWiki };
}
