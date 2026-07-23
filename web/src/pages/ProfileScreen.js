import { ProfileScreen as CoreProfileScreen } from '@microwavedev/backpack-game-core/vue/pages';
import { getAllRunAchievements } from '../../../app/shared/run-achievements.js';
import { getSeasonProgressSummary } from '../../../app/shared/season-levels.js';

export const ProfileScreen = {
  name: 'ProfileScreen',
  components: { CoreProfileScreen },
  props: ['state', 't', 'getMushroom', 'portraitPosition'],
  computed: {
    seasonSummary() {
      const season = this.state.bootstrap?.season || {};
      return getSeasonProgressSummary(
        season.totalPoints || 0,
        this.state.lang || 'en',
        0,
        season.peakPoints || season.totalPoints || 0
      );
    },
    achievementCatalog() {
      return getAllRunAchievements(this.state.lang || 'en');
    }
  },
  methods: {
    getCharacter(characterId) {
      return this.getMushroom?.(characterId);
    },
    normalizeProgressionEntry(entry, fallbackId) {
      return {
        ...entry,
        characterId: entry?.mushroomId || entry?.characterId || fallbackId,
        levelProgressValue: entry?.currentLevelMycelium || 0,
        nextLevelProgressValue: entry?.nextLevelMycelium,
        progressionValue: entry?.mycelium || 0
      };
    }
  },
  template: `
    <CoreProfileScreen
      :state="state"
      :t="t"
      :get-character="getCharacter"
      :portrait-position="portraitPosition"
      :season-summary="seasonSummary"
      :achievement-catalog="achievementCatalog"
      :normalize-progression-entry="normalizeProgressionEntry"
    />
  `
};
