import { artifactPreviewOrientation } from '@microwavedev/backpack-game-core/client-view-model';
import { RecipeList } from '@microwavedev/backpack-game-core/vue/components';
import { AchievementBadge } from './AchievementBadge.js';
import { ArtifactGridBoard } from './ArtifactGridBoard.js';
import { ArtifactStatSummary } from './ArtifactStatSummary.js';
import { buildFriendInviteLink, shareTelegramText } from '../helpers/telegram-links.js';
import { artifactFusionRecipes } from '../../../app/shared/artifact-fusions.js';

export const HomeSocialSidebar = {
  name: 'HomeSocialSidebar',
  props: ['open', 'panel', 'state', 't', 'activityGroups', 'mobileActionMode', 'getArtifact', 'formatArtifactBonus', 'hasFusionCandidates'],
  emits: [
    'close',
    'add-friend', 'challenge-friend',
    'accept-challenge', 'decline-challenge',
    'set-mobile-action-mode', 'switch-panel'
  ],
  components: { AchievementBadge, ArtifactGridBoard, ArtifactStatSummary, RecipeList },
  methods: {
    inviteText() {
      return this.t.friendInviteText
        .replace('{code}', this.state.bootstrap.player.friendCode)
        .replace('{link}', this.inviteLink());
    },
    inviteLink() {
      return buildFriendInviteLink({
        friendCode: this.state.bootstrap.player.friendCode,
        botUsername: this.state.appConfig?.botUsername
      });
    },
    async shareInvite() {
      const text = this.inviteText();
      const url = this.inviteLink();
      try {
        await shareTelegramText({ text, url });
      } catch {}
    },
    switcherClass() {
      if (this.mobileActionMode === 'menu') return 'home-sidebar-switcher--top';
      if (this.mobileActionMode === 'side') return 'home-sidebar-switcher--side';
      return 'home-sidebar-switcher--bottom';
    },
    artifactName(artifact) {
      return artifact?.name?.[this.state.lang] || artifact?.name?.en || artifact?.id || '';
    },
    artifactDescription(artifact) {
      return artifact?.description?.[this.state.lang] || artifact?.description?.en || '';
    },
    previewOrientation(artifact) {
      return artifactPreviewOrientation(artifact);
    },
    previewItem(artifact) {
      const orientation = this.previewOrientation(artifact);
      return [{ artifactId: artifact.id, x: 0, y: 0, width: orientation.width, height: orientation.height }];
    }
  },
  computed: {
    isFriends() {
      return this.panel === 'friends';
    },
    isSettings() {
      return this.panel === 'settings';
    },
    isRecipes() {
      return this.panel === 'recipes';
    },
    recipes() {
      if (!this.getArtifact) return [];
      return artifactFusionRecipes
        .map((recipe) => {
          const ingredients = recipe.ingredientArtifactIds
            .map((artifactId) => this.getArtifact(artifactId))
            .filter(Boolean);
          const result = this.getArtifact(recipe.resultArtifactId);
          return result && ingredients.length === recipe.ingredientArtifactIds.length
            ? {
                ...recipe,
                ingredients,
                result,
                resultName: this.artifactName(result),
                resultDescription: this.artifactDescription(result),
                resultStatsAriaLabel: `${this.artifactName(result)} stats`
              }
            : null;
        })
        .filter(Boolean);
    },
    title() {
      if (this.isSettings) return this.t.settings;
      if (this.isFriends) return this.t.friends;
      if (this.isRecipes) return this.t.recipes;
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

        <nav v-if="switcherClass() === 'home-sidebar-switcher--top'" class="home-sidebar-switcher" :class="switcherClass()" :aria-label="t.settings">
          <button class="home-action-btn home-action-btn--notifications" :class="{ active: panel === 'notifications' }" :aria-label="t.notifications" @click="$emit('switch-panel', 'notifications')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--friends" :class="{ active: panel === 'friends' }" :aria-label="t.friends" @click="$emit('switch-panel', 'friends')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--recipes" :class="{ active: panel === 'recipes', 'home-action-btn--fusion-candidate': hasFusionCandidates }" :aria-label="t.recipes" @click="$emit('switch-panel', 'recipes')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M8 7h8M8 11h6"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--settings" :class="{ active: panel === 'settings' }" :aria-label="t.settings" @click="$emit('switch-panel', 'settings')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
          </button>
        </nav>

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
          <div v-else class="home-friends-empty">
            <span aria-hidden="true">:(</span>
            <p>{{ t.noFriendsYet }}</p>
          </div>
          <form class="home-add-friend-row" @submit.prevent="$emit('add-friend', $event)">
            <input name="friendCode" :placeholder="t.friendCode" class="home-friend-input" />
            <button class="primary" type="submit">{{ t.addFriend }}</button>
          </form>
          <span class="home-friend-code">{{ t.yourCode }}: <strong>{{ state.bootstrap.player.friendCode }}</strong></span>
          <button class="secondary home-share-friend-link" type="button" @click="shareInvite">{{ t.shareFriendInvite }}</button>
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

        <recipe-list
          v-if="isRecipes"
          as="section"
          :recipes="recipes"
          :labels="{ kicker: t.recipeFusionOnly }"
          list-class="home-sidebar-recipes"
          test-id="sidebar-recipes-panel"
          card-class="home-sidebar-recipe"
          card-test-id="sidebar-recipe-card"
          flow-class="home-sidebar-recipe-flow"
          ingredient-row-class="home-sidebar-recipe-ingredients"
          artifact-class="home-sidebar-recipe-artifact"
          result-artifact-class="home-sidebar-recipe-artifact home-sidebar-recipe-artifact--result"
          operator-class="home-sidebar-recipe-plus"
          copy-class="home-sidebar-recipe-copy"
          kicker-class="home-sidebar-recipe-kicker"
          title-tag="strong"
          :empty-text="t.noRecipesYet"
          empty-class="home-empty-hint"
        >
          <template #artifact="{ artifact }">
            <artifact-grid-board
              class="home-sidebar-recipe-artifact-board"
              variant="catalog"
              :columns="previewOrientation(artifact).width"
              :rows="previewOrientation(artifact).height"
              :items="previewItem(artifact)"
              :get-artifact="getArtifact"
            />
          </template>
          <template #stats="{ recipe }">
            <artifact-stat-summary
              :artifact="recipe.result"
              :lang="state.lang"
              :include-zeroes="false"
              variant="compact"
              :aria-label="recipe.resultStatsAriaLabel"
            />
          </template>
        </recipe-list>

        <section v-if="!isSettings && !isFriends && !isRecipes" class="home-activity-feed">
          <template v-if="activityGroups?.length">
            <section v-for="group in activityGroups" :key="group.label" class="home-activity-group">
              <h3>{{ group.label }}</h3>
              <article v-for="item in group.items" :key="item.id" class="home-activity-item" :class="'home-activity-item--' + item.type">
                <achievement-badge v-if="item.achievement" :achievement="item.achievement" size="small" />
                <span v-else class="home-activity-dot"></span>
                <div>
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.meta }}</p>
                </div>
              </article>
            </section>
          </template>
          <p v-else class="home-empty-hint">{{ t.noNotificationsYet }}</p>
        </section>
      </aside>
      <nav v-if="switcherClass() !== 'home-sidebar-switcher--top'" class="home-sidebar-switcher" :class="switcherClass()" :aria-label="t.settings">
        <button class="home-action-btn home-action-btn--notifications" :class="{ active: panel === 'notifications' }" :aria-label="t.notifications" @click="$emit('switch-panel', 'notifications')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--friends" :class="{ active: panel === 'friends' }" :aria-label="t.friends" @click="$emit('switch-panel', 'friends')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--recipes" :class="{ active: panel === 'recipes', 'home-action-btn--fusion-candidate': hasFusionCandidates }" :aria-label="t.recipes" @click="$emit('switch-panel', 'recipes')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M8 7h8M8 11h6"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--settings" :class="{ active: panel === 'settings' }" :aria-label="t.settings" @click="$emit('switch-panel', 'settings')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
        </button>
      </nav>
    </template>
  `
};
