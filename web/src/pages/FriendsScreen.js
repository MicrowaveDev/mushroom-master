import { FriendsScreen as CoreFriendsScreen } from '@microwavedev/backpack-game-core/vue/pages';
import { buildFriendInviteLink, shareTelegramText } from '../helpers/telegram-links.js';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

export const FriendsScreen = {
  name: 'FriendsScreen',
  components: { CoreFriendsScreen },
  props: ['state', 't'],
  emits: ['add-friend', 'challenge-friend', 'accept-challenge', 'decline-challenge'],
  computed: {
    profile() {
      return this.state.bootstrap?.player || {};
    },
    friends() {
      return this.state.friends || [];
    },
    challenge() {
      return this.state.challenge || null;
    },
    labels() {
      return {
        friends: this.t.friends,
        friendCode: this.t.friendCode,
        friendCodeCopied: this.t.friendCodeCopied,
        copyFriendCode: this.t.copyFriendCode,
        shareFriendInvite: this.t.shareFriendInvite,
        friendInviteText: this.t.friendInviteText,
        addFriend: this.t.addFriend,
        roster: this.t.roster,
        createChallenge: this.t.createChallenge,
        noFriendsYet: this.t.noFriendsYet,
        challengeSection: this.t.challengeSection,
        acceptChallenge: this.t.acceptChallenge,
        declineChallenge: this.t.declineChallenge,
        challengeStatuses: {
          pending: this.t.challengeStatus_pending,
          accepted: this.t.challengeStatus_accepted,
          declined: this.t.challengeStatus_declined,
          completed: this.t.challengeStatus_completed
        }
      };
    }
  },
  methods: {
    buildInviteLink(profile) {
      return buildFriendInviteLink({
        friendCode: profile.friendCode,
        botUsername: this.state.appConfig?.botUsername
      });
    },
    copyText,
    shareInvite(payload) {
      return shareTelegramText(payload);
    }
  },
  template: `
    <core-friends-screen
      :profile="profile"
      :friends="friends"
      :challenge="challenge"
      :labels="labels"
      :build-invite-link="buildInviteLink"
      :copy-text="copyText"
      :share-invite="shareInvite"
      @add-friend="$emit('add-friend', $event)"
      @challenge-friend="$emit('challenge-friend', $event)"
      @accept-challenge="$emit('accept-challenge')"
      @decline-challenge="$emit('decline-challenge')"
    />
  `
};
