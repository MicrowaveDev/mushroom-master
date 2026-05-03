// Achievement badge backed by approved production PNGs.

export const AchievementBadge = {
  name: 'AchievementBadge',
  props: {
    achievement: { type: Object, required: true },
    size: { type: String, default: 'small' } // 'small' | 'medium' | 'large'
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
  template: `
    <span :class="badgeClass" aria-hidden="true">
      <img v-if="pngSrc" :src="pngSrc" class="achievement-badge-img" alt="" />
    </span>
  `
};
