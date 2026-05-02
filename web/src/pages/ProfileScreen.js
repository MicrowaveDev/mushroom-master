import { getAllRunAchievements, getNextRunAchievementHint } from '../../../app/shared/run-achievements.js';
import { getSeasonProgressSummary } from '../../../app/shared/season-levels.js';
import { AchievementBadge } from '../components/AchievementBadge.js';

export const ProfileScreen = {
  name: 'ProfileScreen',
  components: { AchievementBadge },
  props: ['state', 't', 'getMushroom'],
  computed: {
    seasonSummary() {
      const season = this.state.bootstrap?.season || {};
      return getSeasonProgressSummary(season.totalPoints || 0, this.state.lang || 'en', 0);
    },
    earnedAchievementMap() {
      const entries = this.state.bootstrap?.season?.achievements || [];
      return new Map(entries.map((entry) => [entry.id, entry]));
    },
    nextAchievement() {
      return getNextRunAchievementHint(this.state.bootstrap?.season?.achievements || [], this.state.lang || 'en');
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
      return [...byCharacter.entries()].map(([mushroomId, achievements]) => ({
        id: mushroomId,
        title: this.getMushroom?.(mushroomId)?.name?.[this.state.lang] || mushroomId,
        subtitle: this.getMushroom?.(mushroomId)?.styleTag || '',
        achievements
      }));
    },
    achievementClass(achievement) {
      return [
        'journal-achievement--' + achievement.type,
        'journal-achievement--accent-' + (achievement.accent || achievement.type),
        achievement.earned ? 'journal-achievement--earned' : 'journal-achievement--locked'
      ];
    }
  },
  template: `
    <section class="profile-screen stack">
      <article class="panel profile-season-card" :class="'profile-season-card--' + seasonSummary.id">
        <div>
          <p class="home-season-kicker">{{ seasonSummary.seasonName }}</p>
          <h2>{{ t.profile }}</h2>
          <p>{{ seasonSummary.seasonTheme }}</p>
        </div>
        <div class="profile-season-meter">
          <strong>{{ seasonSummary.name }}</strong>
          <span>{{ seasonSummary.totalPoints }} {{ t.seasonPoints }}</span>
          <div class="home-season-progress" aria-hidden="true">
            <span :style="{ width: seasonSummary.progress + '%' }"></span>
          </div>
          <small>{{ seasonSummary.isMax ? t.seasonMaxLevel : seasonSummary.pointsToNext + ' ' + t.seasonPointsToNext + ' ' + seasonSummary.nextName }}</small>
          <small class="profile-season-policy">{{ t.seasonChapterNoReset }}</small>
          <div v-if="nextAchievement" class="profile-next-badge" :class="['profile-next-badge--' + nextAchievement.type, 'profile-next-badge--accent-' + nextAchievement.accent]">
            <achievement-badge :achievement="nextAchievement" size="small" />
            <div>
              <strong>{{ t.nextAchievement }}</strong>
              <p>{{ nextAchievement.name }}</p>
            </div>
          </div>
        </div>
      </article>

      <section class="achievement-journal">
        <div class="achievement-journal-heading">
          <h3>{{ t.achievementJournal }}</h3>
          <p>{{ t.achievementJournalHint }}</p>
        </div>
        <article v-for="group in achievementGroups" :key="group.id" class="panel journal-group">
          <div class="journal-group-heading">
            <h3>{{ group.title }}</h3>
            <span>{{ group.achievements.filter(a => a.earned).length }} / {{ group.achievements.length }}</span>
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
                <h4>{{ achievement.earned ? achievement.name : t.achievementLocked }}</h4>
                <p>{{ achievement.earned ? achievement.lore : achievement.name }}</p>
              </div>
            </article>
          </div>
        </article>
      </section>
    </section>
  `
};
