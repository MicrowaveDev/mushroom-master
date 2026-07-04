import { createMushroomGameApiClient } from '../api.js';

export function useSocial(state, goTo) {
  function gameApi() {
    return createMushroomGameApiClient(state.sessionKey);
  }

  async function addFriend(event) {
    try {
      const friendCode = event.target.friendCode.value.trim();
      state.friends = await gameApi().postRoute('friendsAddByCode', {}, { friendCode });
      event.target.reset();
    } catch (error) {
      state.error = error.message || 'Could not add friend';
    }
  }

  async function challengeFriend(friendPlayerId) {
    try {
      state.challenge = await gameApi().postRoute('friendChallenges', {}, { friendPlayerId });
      goTo('friends', { challenge: state.challenge.id });
    } catch (error) {
      state.error = error.message || 'Could not send challenge';
    }
  }

  async function openChallenge(challengeId, options = {}) {
    try {
      state.challenge = await gameApi().getRoute('friendChallenge', { challengeId });
      goTo('friends', { challenge: challengeId }, options.routeOptions || {});
    } catch (error) {
      state.error = error.message || 'Could not load challenge';
    }
  }

  async function acceptChallenge(autoplayReplay) {
    if (!state.challenge) return;
    try {
      state.currentBattle = await gameApi().postRoute('friendChallengeAccept', { challengeId: state.challenge.id }, {});
      goTo('replay', { replay: state.currentBattle.id });
      autoplayReplay();
    } catch (error) {
      state.error = error.message || 'Could not accept challenge';
    }
  }

  async function declineChallenge() {
    if (!state.challenge) return;
    try {
      state.challenge = await gameApi().postRoute('friendChallengeDecline', { challengeId: state.challenge.id }, {});
    } catch (error) {
      state.error = error.message || 'Could not decline challenge';
    }
  }

  async function openWiki(section, slug) {
    try {
      state.selectedWiki = await gameApi().getRoute('wikiEntry', { section, slug });
      goTo('wiki-detail');
    } catch (error) {
      state.error = error.message || 'Could not load wiki entry';
    }
  }

  return { addFriend, challengeFriend, openChallenge, acceptChallenge, declineChallenge, openWiki };
}
