import { AchievementBadge } from './AchievementBadge.js';

export const HomeSocialSidebar = {
  name: 'HomeSocialSidebar',
  props: ['open', 'panel', 'state', 't', 'activityFeed', 'mobileActionMode'],
  emits: [
    'close',
    'add-friend', 'challenge-friend',
    'accept-challenge', 'decline-challenge',
    'set-mobile-action-mode'
  ],
  components: { AchievementBadge },
  computed: {
    isFriends() {
      return this.panel === 'friends';
    },
    isSettings() {
      return this.panel === 'settings';
    },
    title() {
      if (this.isSettings) return this.t.settings;
      if (this.isFriends) return this.t.friends;
      return this.t.notifications;
    }
  },
  template: `
    <template v-if="open">
      <div class="home-social-backdrop" @click="$emit('close')"></div>
      <aside class="home-social-sidebar home-social-sidebar--open" :aria-label="title">
        <div class="home-section-header">
          <h3>{{ title }}</h3>
          <button class="ghost home-social-close" @click="$emit('close')" aria-label="Close">×</button>
        </div>

        <template v-if="isFriends">
          <div v-if="state.challenge" class="home-challenge-banner">
            <span>{{ state.challenge.status === 'pending' ? t.pendingChallenge : state.challenge.status }}</span>
            <div class="home-challenge-actions">
              <button class="primary" @click="$emit('accept-challenge')">{{ t.acceptChallenge }}</button>
              <button class="ghost" @click="$emit('decline-challenge')">{{ t.declineChallenge }}</button>
            </div>
          </div>
          <div class="home-friends-list" v-if="state.friends?.length">
            <div v-for="friend in state.friends" :key="friend.id" class="home-friend-row">
              <div class="home-friend-info">
                <strong>{{ friend.name }}</strong>
                <span class="home-friend-rating">{{ friend.rating }}</span>
              </div>
              <button class="secondary home-friend-challenge" @click="$emit('challenge-friend', friend.id)">{{ t.createChallenge }}</button>
            </div>
          </div>
          <div v-else class="home-empty-hint">
            <p>{{ t.noFriendsYet }}</p>
          </div>
          <form class="home-add-friend-row" @submit.prevent="$emit('add-friend', $event)">
            <input name="friendCode" :placeholder="t.friendCode" class="home-friend-input" />
            <button class="primary" type="submit">{{ t.addFriend }}</button>
          </form>
          <span class="home-friend-code">{{ t.yourCode }}: <strong>{{ state.bootstrap.player.friendCode }}</strong></span>
        </template>

        <section v-if="isSettings" class="home-sidebar-settings">
          <h3>{{ t.mobileActionsMode }}</h3>
          <div class="home-sidebar-option-list">
            <button :class="{ active: mobileActionMode === 'auto' }" @click="$emit('set-mobile-action-mode', 'auto')">{{ t.mobileActionsAuto }}</button>
            <button :class="{ active: mobileActionMode === 'always' }" @click="$emit('set-mobile-action-mode', 'always')">{{ t.mobileActionsAlways }}</button>
            <button :class="{ active: mobileActionMode === 'side' }" @click="$emit('set-mobile-action-mode', 'side')">{{ t.mobileActionsSide }}</button>
            <button :class="{ active: mobileActionMode === 'menu' }" @click="$emit('set-mobile-action-mode', 'menu')">{{ t.mobileActionsMenu }}</button>
          </div>
        </section>

        <section v-if="!isSettings" class="home-activity-feed">
          <h3>{{ t.activity }}</h3>
          <article v-for="item in activityFeed" :key="item.id" class="home-activity-item" :class="'home-activity-item--' + item.type">
            <achievement-badge v-if="item.achievement" :achievement="item.achievement" size="small" />
            <span v-else class="home-activity-dot"></span>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.meta }}</p>
            </div>
          </article>
          <p v-if="!activityFeed?.length" class="home-empty-hint">{{ t.noNotificationsYet }}</p>
        </section>
      </aside>
    </template>
  `
};
