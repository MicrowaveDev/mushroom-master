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
      selectedMushroomId: null,
      socialPanel: '',
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
    focusMushroom(mushroom) {
      this.selectedMushroomId = mushroom.id;
      if (mushroom.isActive) return;
      this.$emit('select-mushroom', mushroom.id);
    },
    playSelectedMushroom() {
      if (this.selectedMushroom?.activeRun) {
        this.state.gameRun = this.selectedMushroom.activeRun;
        this.$emit('resume-run');
        return;
      }
      this.$emit('start-run', 'solo');
    },
    toggleSelectedSkinPanel() {
      if (!this.selectedMushroom) return;
      this.expandedMushroomId = this.expandedMushroomId === this.selectedMushroom.id ? null : this.selectedMushroom.id;
    },
    openSocialPanel(panel) {
      this.socialPanel = panel;
    },
    setMobileActionMode(mode) {
      this.state.mobileHomeActionsMode = mode;
    },
    onScroll() {
      this.homeAtTop = window.scrollY <= 24;
    },
    activityDayLabel(date) {
      const value = date ? new Date(date) : new Date();
      if (Number.isNaN(value.getTime())) return this.t.today;
      const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const diff = Math.round((startOf(new Date()) - startOf(value)) / 86400000);
      if (diff <= 0) return this.t.today;
      if (diff === 1) return this.t.yesterday;
      return value.toLocaleDateString(this.state.lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' });
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
      const activeRunsByMushroom = new Map((this.state.bootstrap?.activeGameRuns || [])
        .map((run) => [run.mushroomId, run]));
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
          activeRun: activeRunsByMushroom.get(m.id) || null,
          activePortrait: prog.activePortrait || 'default',
          portraitUrl: prog.activePortraitUrl || m.imagePath,
          portraits: prog.portraits || [],
          activePreset: prog.activePreset || 'default',
          presets: prog.presets || []
        };
      });
    },
    selectedMushroom() {
      return this.roster.find((m) => m.id === this.selectedMushroomId) ||
        this.roster.find((m) => m.isActive) ||
        null;
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
    activityGroups() {
      const achievements = getRunAchievementsByIds(this.state.bootstrap?.season?.recentAchievements || [], this.state.lang || 'en')
        .slice(0, 4)
        .map((achievement) => ({
          id: `achievement-${achievement.id}`,
          title: achievement.name,
          meta: this.state.lang === 'ru' ? 'Достижение получено' : 'Achievement unlocked',
          type: 'achievement',
          achievement,
          at: new Date().toISOString()
        }));
      const runs = (this.state.bootstrap?.gameRunHistory || [])
        .slice(0, 4)
        .map((run) => {
          const described = this.describeRun(run);
          const completedRounds = described?.completedRounds || 0;
          const title = this.t.runActivityTitle
            .replace('{mode}', described?.modeLabel || this.t.gameRuns)
            .replace('{outcome}', described?.outcomeLabel || this.t.gameRuns)
            .replace('{rounds}', completedRounds);
          const meta = [
            described?.ourName || '',
            this.t.runStatsRecord.replace('{wins}', described?.wins || 0).replace('{losses}', described?.losses || 0).replace('{rounds}', completedRounds),
            described?.dateLabel || ''
          ].filter(Boolean).join(' · ');
          return {
            id: `run-${run.id}`,
            title,
            meta,
            type: described?.outcomeKey || 'run',
            at: run.endedAt || run.startedAt || run.createdAt || new Date().toISOString()
          };
        });
      const groups = new Map();
      [...achievements, ...runs]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 8)
        .forEach((item) => {
          const label = this.activityDayLabel(item.at);
          if (!groups.has(label)) groups.set(label, []);
          groups.get(label).push(item);
        });
      return Array.from(groups, ([label, items]) => ({ label, items }));
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
        <button class="home-action-btn home-action-btn--settings" :aria-label="t.settings" @click="openSocialPanel('settings')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
        </button>
      </div>

      <home-social-sidebar
        :open="!!socialPanel"
        :panel="socialPanel"
        :state="state"
        :t="t"
        :activity-groups="activityGroups"
        :mobile-action-mode="mobileActionMode"
        @close="socialPanel = ''"
        @add-friend="$emit('add-friend', $event)"
        @challenge-friend="$emit('challenge-friend', $event)"
        @accept-challenge="$emit('accept-challenge')"
        @decline-challenge="$emit('decline-challenge')"
        @set-mobile-action-mode="setMobileActionMode($event)"
        @switch-panel="socialPanel = $event"
      />

      <div v-if="mobileActionMode === 'menu' && state.menuOpen" class="home-menu-actions">
        <button class="home-action-btn home-action-btn--notifications" :aria-label="t.notifications" @click="openSocialPanel('notifications')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--friends" :aria-label="t.friends" @click="openSocialPanel('friends')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
        </button>
        <button class="home-action-btn home-action-btn--settings" :aria-label="t.settings" @click="openSocialPanel('settings')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
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
              :class="{ 'home-mushroom-row--active': m.isActive, 'home-mushroom-row--selected': selectedMushroom?.id === m.id }"
              @click="focusMushroom(m)"
              @keydown.enter.prevent="focusMushroom(m)"
              @keydown.space.prevent="focusMushroom(m)"
              role="button"
              tabindex="0"
            >
              <img :src="m.portraitUrl" :alt="m.name[state.lang]" class="home-mushroom-portrait" :style="{ objectPosition: portraitPosition(m.id) }"/>
              <div class="home-mushroom-info">
                <div class="home-mushroom-name-row">
                  <strong>{{ m.name[state.lang] }}</strong>
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
            </div>
          </div>
        </div>
        <div v-if="selectedMushroom" class="home-roster-action-panel">
          <div>
            <span>{{ selectedMushroom.name[state.lang] }}</span>
            <strong>{{ selectedMushroom.activeRun ? t.resumeRun : selectedMushroom.isActive ? t.active : t.pick }}</strong>
          </div>
          <div class="home-roster-action-buttons">
            <button
              class="primary"
              :disabled="!selectedMushroom.isActive || (!selectedMushroom.activeRun && state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit)"
              :title="!selectedMushroom.activeRun && state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit ? t.dailyLimitReached : ''"
              @click="playSelectedMushroom"
            >{{ selectedMushroom.activeRun ? t.resumeRun : t.startRun }}</button>
            <button
              v-if="selectedMushroom.portraits.length > 1 || selectedMushroom.presets.length > 1"
              class="secondary home-roster-change-skin"
              :class="{ active: expandedMushroomId === selectedMushroom.id }"
              @click="toggleSelectedSkinPanel"
            >{{ t.changeSkin }}</button>
          </div>
        </div>
        <div v-if="selectedMushroom && expandedMushroomId === selectedMushroom.id" class="home-mushroom-picker">
          <div v-if="selectedMushroom.portraits.length > 1" class="home-picker-section">
            <span class="home-picker-label">{{ t.portraits }}</span>
            <div class="home-portrait-swatches">
              <button
                v-for="p in selectedMushroom.portraits" :key="p.id"
                class="home-portrait-swatch"
                :class="{ 'home-portrait-swatch--active': selectedMushroom.activePortrait === p.id, 'home-portrait-swatch--locked': !p.unlocked }"
                :title="p.unlocked ? p.name[state.lang] : t.portraitLocked.replace('{n}', p.cost)"
                @click.stop="p.unlocked && $emit('switch-portrait', { mushroomId: selectedMushroom.id, portraitId: p.id })"
              >
                <img :src="p.path" :alt="p.name[state.lang]" />
                <span v-if="!p.unlocked" class="home-swatch-price" aria-hidden="true">
                  <span class="home-swatch-price-icon">🍄</span>
                  <span class="home-swatch-price-value">{{ p.cost }}</span>
                </span>
              </button>
            </div>
          </div>
          <div v-if="selectedMushroom.presets.length > 1" class="home-picker-section">
            <span class="home-picker-label">{{ t.starterPreset }}</span>
            <div class="home-preset-pills">
              <button
                v-for="p in selectedMushroom.presets" :key="p.id"
                class="home-preset-pill"
                :class="{ 'home-preset-pill--active': selectedMushroom.activePreset === p.id, 'home-preset-pill--locked': !p.unlocked }"
                :title="p.unlocked ? '' : t.presetLocked.replace('{n}', p.requiredLevel)"
                @click.stop="p.unlocked && $emit('switch-preset', { mushroomId: selectedMushroom.id, presetId: p.id })"
              >{{ p.name[state.lang] }}{{ !p.unlocked ? ' 🔒' : '' }}</button>
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
        <button class="home-action-btn home-action-btn--settings" :aria-label="t.settings" @click="openSocialPanel('settings')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
        </button>
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
