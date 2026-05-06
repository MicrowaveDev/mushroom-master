import { buildFriendInviteLink } from '../helpers/telegram-links.js';

export const FriendsScreen = {
  name: 'FriendsScreen',
  props: ['state', 't'],
  emits: ['add-friend', 'challenge-friend', 'accept-challenge', 'decline-challenge'],
  data() {
    return { copyState: null };
  },
  beforeUnmount() {
    if (this._copyResetTimer) clearTimeout(this._copyResetTimer);
  },
  methods: {
    challengeStatusLabel(status) {
      return this.t[`challengeStatus_${status}`] || status;
    },
    inviteLink() {
      return buildFriendInviteLink({
        friendCode: this.state.bootstrap.player.friendCode,
        botUsername: this.state.appConfig?.botUsername
      });
    },
    inviteText() {
      return this.t.friendInviteText
        .replace('{code}', this.state.bootstrap.player.friendCode)
        .replace('{link}', this.inviteLink());
    },
    async copyFriendCode() {
      const code = this.state.bootstrap.player.friendCode;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const el = document.createElement('textarea');
          el.value = code;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        }
        this.copyState = 'copied';
        if (this._copyResetTimer) clearTimeout(this._copyResetTimer);
        this._copyResetTimer = setTimeout(() => { this.copyState = null; }, 1600);
      } catch {}
    },
    async shareInvite() {
      const text = this.inviteText();
      const url = this.inviteLink();
      try {
        if (navigator.share) {
          await navigator.share({ text, url });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
      } catch {}
    }
  },
  template: `
    <section class="grid cards">
      <article class="panel friends-panel">
        <h2>{{ t.friends }}</h2>

        <p class="friends-code-label">{{ t.friendCode }}</p>
        <div class="friends-code-row">
          <button
            type="button"
            class="friends-code-pill"
            :class="{ 'friends-code-pill--copied': copyState === 'copied' }"
            :aria-label="copyState === 'copied' ? t.friendCodeCopied : t.copyFriendCode"
            @click="copyFriendCode"
          >
            <span class="friends-code-value">{{ state.bootstrap.player.friendCode }}</span>
            <span class="friends-code-pill-icon" aria-hidden="true">
              <svg v-if="copyState !== 'copied'" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" ry="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
              <svg v-else viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>
            </span>
          </button>
          <button
            type="button"
            class="friends-icon-btn"
            :aria-label="t.shareFriendInvite"
            :title="t.shareFriendInvite"
            @click="shareInvite"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>
          </button>
        </div>

        <form class="friends-add-form" @submit.prevent="$emit('add-friend', $event)">
          <input name="friendCode" class="friends-add-input" :placeholder="t.friendCode" />
          <button class="primary friends-add-submit" type="submit">{{ t.addFriend }}</button>
        </form>
      </article>
      <article class="panel">
        <h3>{{ t.roster }}</h3>
        <template v-if="state.friends?.length">
          <button v-for="friend in state.friends" :key="friend.id" class="friend-roster-entry" @click="$emit('challenge-friend', friend.id)">
            <strong>{{ friend.name }}</strong>
            <span>{{ t.createChallenge }}</span>
          </button>
        </template>
        <div v-else class="home-friends-empty">
          <span aria-hidden="true">:(</span>
          <p>{{ t.noFriendsYet }}</p>
        </div>
      </article>
      <article class="panel" v-if="state.challenge">
        <h3>{{ t.challengeSection }}</h3>
        <p>{{ challengeStatusLabel(state.challenge.status) }}</p>
        <button class="primary" @click="$emit('accept-challenge')">{{ t.acceptChallenge }}</button>
        <button class="secondary" @click="$emit('decline-challenge')">{{ t.declineChallenge }}</button>
      </article>
    </section>
  `
};
