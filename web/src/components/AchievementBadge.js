// Achievement badge. Prefers the production PNG at /achievements/{id}.png;
// falls back to the existing emoji glyph until every achievement has been
// generated + approved through the bitmap pipeline. See
// docs/season-image-todolist.md.

export const AchievementBadge = {
  name: 'AchievementBadge',
  props: {
    achievement: { type: Object, required: true },
    size: { type: String, default: 'small' } // 'small' | 'medium' | 'large'
  },
  data() {
    return { pngFailed: false };
  },
  computed: {
    pngSrc() {
      return this.achievement?.id ? `/achievements/${this.achievement.id}.png` : null;
    },
    badgeClass() {
      const sizeClass = `achievement-badge--${this.size}`;
      return ['achievement-badge', sizeClass];
    }
  },
  watch: {
    'achievement.id'() { this.pngFailed = false; }
  },
  methods: {
    handlePngError() {
      if (!this.pngFailed) {
        this.pngFailed = true;
        if (typeof console !== 'undefined') {
          console.warn(`[AchievementBadge] PNG missing for ${this.achievement?.id}, falling back to glyph.`);
        }
      }
    }
  },
  template: `
    <span :class="badgeClass" aria-hidden="true">
      <template v-if="pngSrc && !pngFailed">
        <img :src="pngSrc" class="achievement-badge-img" alt="" @error="handlePngError" />
      </template>
      <template v-else>
        <span class="achievement-badge-core"></span>
        <span class="achievement-badge-glyph">{{ achievement.badgeSymbol }}</span>
      </template>
    </span>
  `
};
