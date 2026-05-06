import { getAllRunAchievements, getNextRunAchievementHint } from '../../../app/shared/run-achievements.js';
import { getSeasonProgressSummary } from '../../../app/shared/season-levels.js';
import { AchievementBadge } from '../components/AchievementBadge.js';
import { SeasonRankEmblem } from '../components/SeasonRankEmblem.js';

export const ProfileScreen = {
  name: 'ProfileScreen',
  components: { AchievementBadge, SeasonRankEmblem },
  props: ['state', 't', 'getMushroom', 'portraitPosition'],
  data() {
    return { shareState: null };
  },
  beforeUnmount() {
    if (this._shareResetTimer) clearTimeout(this._shareResetTimer);
  },
  computed: {
    seasonSummary() {
      const season = this.state.bootstrap?.season || {};
      return getSeasonProgressSummary(season.totalPoints || 0, this.state.lang || 'en', 0, season.peakPoints || season.totalPoints || 0);
    },
    earnedAchievementMap() {
      const entries = this.state.bootstrap?.season?.achievements || [];
      return new Map(entries.map((entry) => [entry.id, entry]));
    },
    nextAchievement() {
      return getNextRunAchievementHint(this.state.bootstrap?.season?.achievements || [], this.state.lang || 'en');
    },
    playerName() {
      const player = this.state.bootstrap?.player || {};
      return player.displayName || player.name || player.username || this.t.profile;
    },
    playerHandle() {
      const player = this.state.bootstrap?.player || {};
      return player.username || player.friendCode || player.id || '';
    },
    playedCharacters() {
      const progression = this.state.bootstrap?.progression || {};
      const lang = this.state.lang || 'en';
      const entries = Object.values(progression)
        .map((entry) => {
          const mushroom = this.getMushroom?.(entry.mushroomId) || null;
          if (!mushroom) return null;
          const wins = entry.wins || 0;
          const losses = entry.losses || 0;
          const draws = entry.draws || 0;
          const totalRounds = wins + losses + draws;
          const winRate = totalRounds ? Math.round((wins / totalRounds) * 100) : 0;
          const levelCurrent = Number(entry.currentLevelMycelium || 0);
          const levelNext = entry.nextLevelMycelium == null ? null : Number(entry.nextLevelMycelium);
          const isMaxLevel = levelNext == null || levelNext <= 0;
          const levelProgress = isMaxLevel
            ? 100
            : Math.max(0, Math.min(100, Math.round((levelCurrent / levelNext) * 100)));
          const passive = mushroom.passive || null;
          const passiveName = passive?.name?.[lang] || passive?.name?.en || '';
          const passiveDescription = passive?.description?.[lang] || passive?.description?.en || '';
          return {
            id: entry.mushroomId,
            name: mushroom.name?.[lang] || mushroom.name?.en || entry.mushroomId,
            styleTag: mushroom.styleTag || '',
            passiveName,
            passiveDescription,
            portraitUrl: entry.activePortraitUrl || mushroom.imagePath,
            level: entry.level || 1,
            levelCurrent,
            levelNext,
            levelProgress,
            isMaxLevel,
            wins,
            losses,
            draws,
            totalRounds,
            winRate,
            mycelium: entry.mycelium || 0
          };
        })
        .filter(Boolean)
        .filter((entry) => entry.totalRounds > 0 || entry.mycelium > 0)
        .sort((a, b) => b.totalRounds - a.totalRounds || b.wins - a.wins);
      return entries;
    },
    achievementGroups() {
      const all = getAllRunAchievements(this.state.lang || 'en');
      const decorate = (achievement) => ({
        ...achievement,
        earned: this.earnedAchievementMap.has(achievement.id),
        earnedAt: this.earnedAchievementMap.get(achievement.id)?.earnedAt || null
      });

      return [
        {
          id: 'season',
          title: this.seasonSummary.seasonName,
          subtitle: this.seasonSummary.seasonTheme,
          achievements: all.filter((achievement) => achievement.type === 'season').map(decorate)
        },
        {
          id: 'general',
          title: this.t.achievementsEarned,
          subtitle: this.t.achievementJournalHint,
          achievements: all.filter((achievement) => achievement.type === 'general').map(decorate)
        },
        ...this.characterGroups(all, decorate)
      ];
    }
  },
  methods: {
    characterGroups(all, decorate) {
      const byCharacter = new Map();
      for (const achievement of all.filter((entry) => entry.type === 'character')) {
        const list = byCharacter.get(achievement.characterId) || [];
        list.push(decorate(achievement));
        byCharacter.set(achievement.characterId, list);
      }
      const lang = this.state.lang || 'en';
      return [...byCharacter.entries()].map(([mushroomId, achievements]) => {
        const mushroom = this.getMushroom?.(mushroomId) || null;
        const progression = this.state.bootstrap?.progression?.[mushroomId] || null;
        return {
          id: mushroomId,
          title: mushroom?.name?.[lang] || mushroom?.name?.en || mushroomId,
          portraitUrl: progression?.activePortraitUrl || mushroom?.imagePath || null,
          achievements
        };
      });
    },
    groupCountState(group) {
      const total = group.achievements.length;
      const earned = group.achievements.filter((a) => a.earned).length;
      return { total, earned, complete: total > 0 && earned === total };
    },
    achievementClass(achievement) {
      return [
        'journal-achievement--' + achievement.type,
        'journal-achievement--accent-' + (achievement.accent || achievement.type),
        achievement.earned ? 'journal-achievement--earned' : 'journal-achievement--locked'
      ];
    },
    profileShareUrl() {
      if (typeof window === 'undefined') return '';
      const id = this.playerHandle;
      return id ? `${window.location.origin}/profile/${encodeURIComponent(id)}` : window.location.href;
    },
    async shareProfile() {
      const url = this.profileShareUrl();
      if (!url) return;
      try {
        if (navigator.share) {
          await navigator.share({ url, title: this.playerName });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        }
        this.shareState = 'shared';
        if (this._shareResetTimer) clearTimeout(this._shareResetTimer);
        this._shareResetTimer = setTimeout(() => { this.shareState = null; }, 1600);
      } catch {}
    }
  },
  template: `
    <section class="profile-screen stack">
      <div class="profile-actions">
        <button
          type="button"
          class="profile-share-btn"
          :class="{ 'profile-share-btn--shared': shareState === 'shared' }"
          :aria-label="t.shareProfile"
          :title="t.shareProfile"
          @click="shareProfile"
        >
          <svg v-if="shareState !== 'shared'" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>
          <span>{{ shareState === 'shared' ? t.shareProfileCopied : t.shareProfile }}</span>
        </button>
      </div>

      <header class="profile-header">
        <div class="profile-header-meta">
          <p class="profile-header-kicker">{{ t.profile }}</p>
          <h2 class="profile-header-name">{{ playerName }}</h2>
          <p v-if="playerHandle" class="profile-header-handle">#{{ playerHandle }}</p>
        </div>
      </header>

      <section v-if="playedCharacters.length" class="profile-characters" :aria-label="t.profileCharacters">
        <h3 class="profile-section-title">{{ t.profileCharacters }}</h3>
        <div class="profile-character-rows">
          <article
            v-for="(character, index) in playedCharacters"
            :key="character.id"
            class="profile-character-row"
            :class="{ 'profile-character-row--reversed': index % 2 === 1 }"
          >
            <div class="profile-character-portrait">
              <img
                :src="character.portraitUrl"
                :alt="character.name"
                class="portrait"
                :style="{ objectPosition: portraitPosition ? portraitPosition(character.id) : '50% 25%' }"
              />
            </div>
            <div class="profile-character-meta">
              <div class="profile-character-headline">
                <span v-if="character.styleTag" class="fighter-style-tag">{{ character.styleTag }}</span>
                <span class="profile-character-level">{{ t.level }} {{ character.level }}</span>
              </div>
              <h4 class="profile-character-name">{{ character.name }}</h4>
              <div v-if="character.passiveDescription" class="profile-character-passive">
                <span v-if="character.passiveName" class="profile-character-passive-name">{{ character.passiveName }}</span>
                <p class="profile-character-passive-desc">{{ character.passiveDescription }}</p>
              </div>
              <div class="profile-character-progress" :class="{ 'profile-character-progress--max': character.isMaxLevel }">
                <div class="profile-character-progress-track" aria-hidden="true">
                  <span :style="{ width: character.levelProgress + '%' }"></span>
                </div>
                <p class="profile-character-progress-caption">
                  <span v-if="character.isMaxLevel">{{ t.level }} {{ character.level }} · MAX</span>
                  <span v-else>{{ character.levelCurrent }} / {{ character.levelNext }} → {{ t.level }} {{ character.level + 1 }}</span>
                </p>
              </div>
              <dl class="profile-character-stats">
                <div class="profile-character-stat profile-character-stat--win">
                  <dt>{{ t.wins }}</dt>
                  <dd>{{ character.wins }}</dd>
                </div>
                <div class="profile-character-stat profile-character-stat--loss">
                  <dt>{{ t.losses }}</dt>
                  <dd>{{ character.losses }}</dd>
                </div>
                <div class="profile-character-stat">
                  <dt>{{ t.runWinRate }}</dt>
                  <dd>{{ character.totalRounds ? character.winRate + '%' : '—' }}</dd>
                </div>
              </dl>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="profile-characters profile-characters--empty">
        <h3 class="profile-section-title">{{ t.profileCharacters }}</h3>
        <p class="profile-characters-empty-copy">{{ t.profileCharactersEmpty }}</p>
      </section>

      <article class="panel profile-season-card" :class="'profile-season-card--' + seasonSummary.id">
        <season-rank-emblem class="profile-season-emblem" :rank-id="seasonSummary.id" :size="84" />
        <div class="profile-season-copy">
          <p class="home-season-kicker">{{ seasonSummary.seasonName }}</p>
          <h3>{{ seasonSummary.name }}</h3>
          <p>{{ seasonSummary.seasonTheme }}</p>
        </div>
        <div class="profile-season-meter">
          <strong class="profile-season-points">{{ seasonSummary.totalPoints }} {{ t.seasonPoints }}</strong>
          <div class="home-season-progress" aria-hidden="true">
            <span :style="{ width: seasonSummary.progress + '%' }"></span>
          </div>
          <small>{{ seasonSummary.isMax ? t.seasonMaxLevel : seasonSummary.pointsToNext + ' ' + t.seasonPointsToNext + ' ' + seasonSummary.nextName }}</small>
        </div>
      </article>

      <section class="achievement-journal">
        <div class="achievement-journal-heading">
          <h3>{{ t.achievementJournal }}</h3>
          <p>{{ t.achievementJournalHint }}</p>
        </div>
        <article v-for="group in achievementGroups" :key="group.id" class="panel journal-group">
          <div class="journal-group-heading">
            <img
              v-if="group.portraitUrl"
              class="journal-group-portrait"
              :src="group.portraitUrl"
              :alt="group.title"
            />
            <h3>{{ group.title }}</h3>
            <span
              class="journal-group-count"
              :class="{ 'journal-group-count--complete': groupCountState(group).complete }"
            >
              <svg v-if="groupCountState(group).complete" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>
              <span>{{ groupCountState(group).earned }}<span v-if="!groupCountState(group).complete"> / {{ groupCountState(group).total }}</span></span>
            </span>
          </div>
          <p v-if="group.subtitle" class="journal-group-subtitle">{{ group.subtitle }}</p>
          <div class="journal-achievement-grid">
            <article
              v-for="achievement in group.achievements"
              :key="achievement.id"
              class="journal-achievement"
              :class="achievementClass(achievement)"
            >
              <achievement-badge :achievement="achievement" size="large" />
              <div>
                <h4>{{ achievement.name }}</h4>
                <p v-if="achievement.earned">{{ achievement.lore }}</p>
              </div>
            </article>
          </div>
        </article>
      </section>
    </section>
  `
};
