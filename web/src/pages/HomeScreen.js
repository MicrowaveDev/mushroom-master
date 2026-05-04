import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';
import { getNextRunAchievementHint, getRunAchievementsByIds } from '../../../app/shared/run-achievements.js';
import { getSeasonProgressSummary } from '../../../app/shared/season-levels.js';
import { SeasonRankEmblem } from '../components/SeasonRankEmblem.js';
import { AchievementBadge } from '../components/AchievementBadge.js';
import { HomeSocialSidebar } from '../components/HomeSocialSidebar.js';

export const HomeScreen = {
  name: 'HomeScreen',
  props: [
    'state', 't', 'activeMushroom', 'builderTotals',
    'renderArtifactFigure', 'getArtifact', 'getMushroom',
    'describeRun', 'formatDelta', 'portraitPosition'
  ],
  emits: [
    'resume-run', 'start-run', 'abandon-run',
    'load-run-summary', 'go',
    'add-friend', 'challenge-friend',
    'accept-challenge', 'decline-challenge',
    'select-mushroom',
    'switch-portrait', 'switch-preset'
  ],
  data() {
    return {
      expandedMushroomId: null,
      socialPanel: '',
      quickSettingsOpen: false,
      homeAtTop: true
    };
  },
  components: {
    ArtifactGridBoard: defineAsyncComponent(() => import('../components/ArtifactGridBoard.js').then(m => m.ArtifactGridBoard)),
    SeasonRankEmblem,
    AchievementBadge,
    HomeSocialSidebar
  },
  methods: {
    selectMushroom(mushroom) {
      if (mushroom.isActive) return;
      this.$emit('select-mushroom', mushroom.id);
    },
    openSocialPanel(panel) {
      this.quickSettingsOpen = false;
      this.socialPanel = panel;
    },
    setMobileActionMode(mode) {
      this.state.mobileHomeActionsMode = mode;
      this.quickSettingsOpen = false;
    },
    onScroll() {
      this.homeAtTop = window.scrollY <= 24;
    }
  },
  mounted() {
    this.onScroll();
    window.addEventListener('scroll', this.onScroll, { passive: true });
  },
  beforeUnmount() {
    window.removeEventListener('scroll', this.onScroll);
  },
  computed: {
    mobileActionMode() {
      return this.state.mobileHomeActionsMode || 'auto';
    },
    showMobileBottomActions() {
      if (this.mobileActionMode === 'always') return true;
      if (this.mobileActionMode === 'auto') return this.homeAtTop;
      return false;
    },
    playerRank() {
      const id = this.state.bootstrap?.player?.id;
      if (!id || !this.state.leaderboard?.length) return null;
      const entry = this.state.leaderboard.find(e => e.id === id);
      return entry?.rank || null;
    },
    roster() {
      const mushrooms = this.state.bootstrap?.mushrooms || [];
      const progression = this.state.bootstrap?.progression || {};
      return mushrooms.map(m => {
        const prog = progression[m.id] || {};
        return {
          ...m,
          level: prog.level || 1,
          tier: prog.tier || 'spore',
          currentLevelMycelium: prog.currentLevelMycelium || 0,
          nextLevelMycelium: prog.nextLevelMycelium ?? null,
          wins: prog.wins || 0,
          losses: prog.losses || 0,
          draws: prog.draws || 0,
          isActive: m.id === this.state.bootstrap?.activeMushroomId,
          activePortrait: prog.activePortrait || 'default',
          portraitUrl: prog.activePortraitUrl || m.imagePath,
          portraits: prog.portraits || [],
          activePreset: prog.activePreset || 'default',
          presets: prog.presets || []
        };
      });
    },
    topLeaderboard() {
      return (this.state.leaderboard || []).slice(0, 5);
    },
    seasonSummary() {
      const season = this.state.bootstrap?.season || {};
      return getSeasonProgressSummary(season.totalPoints || 0, this.state.lang || 'en', 0);
    },
    seasonAchievements() {
      return getRunAchievementsByIds(this.state.bootstrap?.season?.recentAchievements || [], this.state.lang || 'en').slice(0, 3);
    },
    nextAchievement() {
      return getNextRunAchievementHint(this.state.bootstrap?.season?.achievements || [], this.state.lang || 'en');
    },
    activityFeed() {
      const achievements = getRunAchievementsByIds(this.state.bootstrap?.season?.recentAchievements || [], this.state.lang || 'en')
        .slice(0, 4)
        .map((achievement) => ({
          id: `achievement-${achievement.id}`,
          title: achievement.name,
          meta: this.state.lang === 'ru' ? 'Достижение получено' : 'Achievement unlocked',
          type: 'achievement',
          achievement
        }));
      const runs = (this.state.bootstrap?.gameRunHistory || [])
        .slice(0, 4)
        .map((run) => {
          const described = this.describeRun(run);
          return {
            id: `run-${run.id}`,
            title: described?.outcomeLabel || this.t.gameRuns,
            meta: `${described?.ourName || ''} · ${this.t.runStatsRecord.replace('{wins}', described?.wins || 0).replace('{losses}', described?.losses || 0).replace('{rounds}', described?.completedRounds || 0)}`,
            type: described?.outcomeKey || 'run'
          };
        });
      return [...achievements, ...runs].slice(0, 6);
    }
  },
  template: `
    <section class="home">
      <div class="home-action-rail" :class="{ 'home-action-rail--mobile': mobileActionMode === 'side' }">
        <button class="home-action-btn home-action-btn--notifications" :aria-label="t.notifications" @click="openSocialPanel('notifications')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--friends" :aria-label="t.friends" @click="openSocialPanel('friends')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
        </button>
      </div>

      <home-social-sidebar
        :open="!!socialPanel"
        :panel="socialPanel"
        :state="state"
        :t="t"
        :activity-feed="activityFeed"
        @close="socialPanel = ''"
        @add-friend="$emit('add-friend', $event)"
        @challenge-friend="$emit('challenge-friend', $event)"
        @accept-challenge="$emit('accept-challenge')"
        @decline-challenge="$emit('decline-challenge')"
      />

      <div v-if="mobileActionMode === 'menu' && state.menuOpen" class="home-menu-actions">
        <button class="home-action-btn home-action-btn--notifications" :aria-label="t.notifications" @click="openSocialPanel('notifications')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--friends" :aria-label="t.friends" @click="openSocialPanel('friends')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
        </button>
      </div>

      <article class="panel home-roster-panel">
        <div class="home-section-header">
          <h3>{{ t.characters }}</h3>
        </div>
        <div class="home-mushroom-list">
          <div v-for="m in roster" :key="m.id" class="home-mushroom-card">
            <div
              class="home-mushroom-row"
              :class="{ 'home-mushroom-row--active': m.isActive }"
              @click="selectMushroom(m)"
              @keydown.enter.prevent="selectMushroom(m)"
              @keydown.space.prevent="selectMushroom(m)"
              :role="m.isActive ? 'group' : 'button'"
              :tabindex="m.isActive ? -1 : 0"
            >
              <img :src="m.portraitUrl" :alt="m.name[state.lang]" class="home-mushroom-portrait" :style="{ objectPosition: portraitPosition(m.id) }"/>
              <div class="home-mushroom-info">
                <div class="home-mushroom-name-row">
                  <strong>{{ m.name[state.lang] }}</strong>
                  <span v-if="m.isActive" class="home-mushroom-active-tag">{{ t.active }}</span>
                  <span :class="'home-mushroom-tier tier--' + m.tier">{{ t['tier_' + m.tier] }}</span>
                </div>
                <span class="home-mushroom-style">{{ m.styleTag }}</span>
                <span class="home-mushroom-stats">
                  <span class="home-mushroom-level">{{ t.level }} {{ m.level }}</span>
                  <span v-if="m.wins || m.losses || m.draws" class="home-mushroom-record">{{ m.wins }}<small>{{ t.winsShort }}</small> {{ m.losses }}<small>{{ t.lossesShort }}</small> {{ m.draws }}<small>{{ t.drawsShort }}</small></span>
                </span>
                <div v-if="m.nextLevelMycelium !== null" class="home-mushroom-progress" :title="m.currentLevelMycelium + ' / ' + m.nextLevelMycelium">
                  <div class="home-mushroom-progress-fill" :style="{ width: Math.min(100, Math.round(m.currentLevelMycelium / m.nextLevelMycelium * 100)) + '%' }"></div>
                </div>
              </div>
              <div class="home-mushroom-actions">
                <button v-if="!m.isActive" class="ghost home-mushroom-select" @click.stop="$emit('select-mushroom', m.id)">{{ t.pick }}</button>
                <button
                  v-if="m.portraits.length > 1 || m.presets.length > 1"
                  class="ghost home-mushroom-customize"
                  :class="{ 'home-mushroom-customize--open': expandedMushroomId === m.id }"
                  @click.stop="expandedMushroomId = expandedMushroomId === m.id ? null : m.id"
                  :title="t.customize"
                  :aria-label="t.customize"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5 4.5 4.5M4 20l4.8-1 10-10a3.2 3.2 0 0 0-4.5-4.5l-10 10L4 20Z"/><path d="m8.8 19-3.7-3.7"/></svg>
                </button>
              </div>
            </div>
            <div v-if="expandedMushroomId === m.id" class="home-mushroom-picker">
              <div v-if="m.portraits.length > 1" class="home-picker-section">
                <span class="home-picker-label">{{ t.portraits }}</span>
                <div class="home-portrait-swatches">
                  <button
                    v-for="p in m.portraits" :key="p.id"
                    class="home-portrait-swatch"
                    :class="{ 'home-portrait-swatch--active': m.activePortrait === p.id, 'home-portrait-swatch--locked': !p.unlocked }"
                    :title="p.unlocked ? p.name[state.lang] : t.portraitLocked.replace('{n}', p.cost)"
                    @click.stop="p.unlocked && $emit('switch-portrait', { mushroomId: m.id, portraitId: p.id })"
                  >
                    <img :src="p.path" :alt="p.name[state.lang]" />
                    <span v-if="!p.unlocked" class="home-swatch-price" aria-hidden="true">
                      <span class="home-swatch-price-icon">🍄</span>
                      <span class="home-swatch-price-value">{{ p.cost }}</span>
                    </span>
                  </button>
                </div>
              </div>
              <div v-if="m.presets.length > 1" class="home-picker-section">
                <span class="home-picker-label">{{ t.starterPreset }}</span>
                <div class="home-preset-pills">
                  <button
                    v-for="p in m.presets" :key="p.id"
                    class="home-preset-pill"
                    :class="{ 'home-preset-pill--active': m.activePreset === p.id, 'home-preset-pill--locked': !p.unlocked }"
                    :title="p.unlocked ? '' : t.presetLocked.replace('{n}', p.requiredLevel)"
                    @click.stop="p.unlocked && $emit('switch-preset', { mushroomId: m.id, presetId: p.id })"
                  >{{ p.name[state.lang] }}{{ !p.unlocked ? ' 🔒' : '' }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <nav
        v-if="mobileActionMode !== 'menu'"
        class="home-bottom-actions"
        :class="{
          'home-bottom-actions--visible': showMobileBottomActions
        }"
        :aria-hidden="!showMobileBottomActions"
      >
        <button class="home-action-btn home-action-btn--notifications" :aria-label="t.notifications" @click="openSocialPanel('notifications')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--friends" :aria-label="t.friends" @click="openSocialPanel('friends')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--settings" :aria-label="t.settings" @click="quickSettingsOpen = !quickSettingsOpen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
        </button>
        <div v-if="quickSettingsOpen" class="home-quick-settings">
          <strong>{{ t.mobileActionsMode }}</strong>
          <button :class="{ active: mobileActionMode === 'auto' }" @click="setMobileActionMode('auto')">{{ t.mobileActionsAuto }}</button>
          <button :class="{ active: mobileActionMode === 'always' }" @click="setMobileActionMode('always')">{{ t.mobileActionsAlways }}</button>
          <button :class="{ active: mobileActionMode === 'side' }" @click="setMobileActionMode('side')">{{ t.mobileActionsSide }}</button>
          <button :class="{ active: mobileActionMode === 'menu' }" @click="setMobileActionMode('menu')">{{ t.mobileActionsMenu }}</button>
        </div>
      </nav>

      <article class="panel home-season-panel" :class="'home-season-panel--' + seasonSummary.id">
        <div class="home-season-main">
          <season-rank-emblem class="home-season-emblem" :rank-id="seasonSummary.id" :size="84" />
          <div class="home-season-copy">
            <p class="home-season-kicker">{{ seasonSummary.seasonName }}</p>
            <h3>{{ seasonSummary.name }}</h3>
            <p>{{ seasonSummary.seasonTheme }}</p>
          </div>
          <div class="home-season-points">
            <strong>{{ seasonSummary.totalPoints }} {{ t.seasonPoints }}</strong>
            <span>{{ seasonSummary.isMax ? t.seasonMaxLevel : seasonSummary.pointsToNext + ' ' + t.seasonPointsToNext + ' ' + seasonSummary.nextName }}</span>
            <button class="link home-season-journal-link" @click="$emit('go', 'profile')">{{ t.achievementJournal }}</button>
          </div>
        </div>
        <div class="home-season-progress" aria-hidden="true">
          <span :style="{ width: seasonSummary.progress + '%' }"></span>
        </div>
        <div v-if="seasonAchievements.length" class="home-season-achievements">
          <article
            v-for="(achievement, index) in seasonAchievements"
            :key="achievement.id"
            class="home-season-achievement"
            :class="['home-season-achievement--' + achievement.type, 'home-season-achievement--accent-' + achievement.accent]"
            :style="{ animationDelay: (index * 70) + 'ms' }"
          >
            <achievement-badge :achievement="achievement" size="small" />
            <div>
              <strong>{{ achievement.name }}</strong>
              <p>{{ achievement.lore }}</p>
            </div>
          </article>
        </div>
        <div v-else-if="nextAchievement" class="home-season-next-badge">
          <achievement-badge :achievement="nextAchievement" size="small" />
          <div>
            <strong>{{ t.nextAchievement }}</strong>
            <p>{{ nextAchievement.name }}</p>
          </div>
        </div>
      </article>

      <div class="home-columns home-main-columns">
        <article class="panel home-section">
          <div class="home-section-header">
            <h3>{{ t.gameRuns }}</h3>
            <button v-if="!state.gameRun && activeMushroom" class="primary home-start-btn" :disabled="state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit" :title="state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit ? t.dailyLimitReached : ''" @click="$emit('start-run', 'solo')">{{ t.startRun }}</button>
            <button v-if="state.bootstrap.gameRunHistory?.length" class="link" @click="$emit('go', 'history')">{{ t.viewAll }}</button>
          </div>

          <p v-if="!state.gameRun && state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit" class="home-limit-hint">{{ t.dailyLimitReached }}</p>

          <!-- Active run as first item -->
          <div v-if="state.gameRun && activeMushroom" class="home-run-item home-run-item--active" @click="$emit('resume-run')">
            <img :src="activeMushroom.imagePath" :alt="activeMushroom.name[state.lang]" class="home-run-item-portrait" :style="{ objectPosition: portraitPosition(activeMushroom.id) }"/>
            <div class="home-run-item-info">
              <strong>{{ t.round }} {{ state.gameRun.currentRound }}</strong>
              <span class="home-run-item-stats">{{ t.wins }} {{ state.gameRun.player?.wins || 0 }} · {{ t.lives }} {{ state.gameRun.player?.livesRemaining || 0 }}</span>
            </div>
            <button class="primary home-run-item-action" @click.stop="$emit('resume-run')">{{ t.continueRound }}</button>
          </div>

          <!-- Recent runs (1 row per game run, not per battle — per Req 1-A) -->
          <div v-if="state.bootstrap.gameRunHistory?.length" class="home-run-list">
            <div
              v-for="run in state.bootstrap.gameRunHistory.slice(0, 5)"
              :key="run.id"
              class="home-run-item"
              :class="'home-run-item--' + (describeRun(run)?.outcomeKey || 'abandoned')"
              @click="$emit('load-run-summary', run.id)"
            >
              <img v-if="describeRun(run)?.ourImage" :src="describeRun(run).ourImage" :alt="describeRun(run)?.ourName" class="home-run-item-portrait" :style="{ objectPosition: portraitPosition(describeRun(run)?.mushroomId) }" />
              <div class="home-run-item-info">
                <strong>{{ describeRun(run)?.outcomeLabel }}</strong>
                <span class="home-run-item-stats">{{ describeRun(run)?.ourName }} · {{ t.runStatsRecord.replace('{wins}', describeRun(run)?.wins).replace('{losses}', describeRun(run)?.losses).replace('{rounds}', describeRun(run)?.completedRounds) }}</span>
              </div>
              <span class="home-run-item-date">{{ describeRun(run)?.dateLabel }}</span>
            </div>
          </div>

          <!-- Empty state -->
          <p v-if="!state.gameRun && !state.bootstrap.gameRunHistory?.length" class="home-empty-hint home-empty-hint--center">{{ t.noGameRunsYetCta }}</p>

          <!-- Footer stats -->
          <div class="home-run-footer">
            <span>{{ t.spore }}: {{ state.bootstrap.player.spore }}</span>
            <span>{{ t.battleLimit }}: {{ state.bootstrap.battleLimit.used }} / {{ state.bootstrap.battleLimit.limit }}</span>
          </div>
        </article>

        <article class="panel home-section leaderboard-panel" v-if="topLeaderboard.length">
          <div class="home-section-header">
            <h3>{{ t.leaderboard }}</h3>
            <button class="link" @click="$emit('go', 'leaderboard')">{{ t.viewAll }}</button>
          </div>
          <div class="home-leaderboard">
            <div
              v-for="entry in topLeaderboard" :key="entry.id"
              class="home-leaderboard-row"
              :class="{ 'home-leaderboard-row--self': entry.id === state.bootstrap.player.id }"
            >
              <span class="home-leaderboard-rank">#{{ entry.rank }}</span>
              <strong class="home-leaderboard-name">{{ entry.name }}</strong>
              <span class="home-leaderboard-rating">{{ entry.rating }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  `
};
