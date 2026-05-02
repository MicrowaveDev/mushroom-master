// Season rank emblem. Prefers the production PNG at /season-ranks/{id}.png;
// falls back to the inline SVG below until every rank has been generated +
// approved through the bitmap pipeline. See docs/season-image-todolist.md
// and docs/season-image-style-prompt.md.

const RANK_PALETTES = {
  bronze:  { highlight: '#f5d8a3', mid: '#c98a4a', deep: '#7d4a1f', ring: '#5d3712', glyph: '#fdeac6' },
  silver:  { highlight: '#f4f8fa', mid: '#aab9c1', deep: '#65737a', ring: '#3a464d', glyph: '#ffffff' },
  gold:    { highlight: '#fff1be', mid: '#e0b545', deep: '#8b631a', ring: '#5e4310', glyph: '#fff7d6' },
  diamond: { highlight: '#e9fbff', mid: '#86c8d9', deep: '#3a6b81', ring: '#1f3e51', glyph: '#dff6ff' }
};

export const SeasonRankEmblem = {
  name: 'SeasonRankEmblem',
  props: {
    rankId: { type: String, default: 'bronze' },
    size: { type: Number, default: 96 }
  },
  data() {
    return { pngFailed: false };
  },
  computed: {
    palette() {
      return RANK_PALETTES[this.rankId] || RANK_PALETTES.bronze;
    },
    gradientId() {
      return `rankGradient-${this.rankId}-${this.size}`;
    },
    pngSrc() {
      return `/season-ranks/${this.rankId}.png`;
    }
  },
  watch: {
    rankId() { this.pngFailed = false; }
  },
  methods: {
    handlePngError() {
      if (!this.pngFailed) {
        this.pngFailed = true;
        if (typeof console !== 'undefined') {
          console.warn(`[SeasonRankEmblem] PNG missing for rank ${this.rankId}, falling back to SVG.`);
        }
      }
    }
  },
  template: `
    <span class="season-rank-emblem" :class="'season-rank-emblem--' + rankId" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true">
      <img
        v-if="!pngFailed"
        :src="pngSrc"
        class="season-rank-emblem-img"
        :width="size"
        :height="size"
        alt=""
        @error="handlePngError"
      />
      <svg v-else viewBox="0 0 96 96" class="season-rank-emblem-svg">
        <defs>
          <radialGradient :id="gradientId" cx="50%" cy="38%" r="62%">
            <stop offset="0%" :stop-color="palette.highlight" />
            <stop offset="58%" :stop-color="palette.mid" />
            <stop offset="100%" :stop-color="palette.deep" />
          </radialGradient>
        </defs>
        <circle cx="48" cy="48" r="42" :fill="'url(#' + gradientId + ')'" :stroke="palette.ring" stroke-width="3" />
        <circle cx="48" cy="48" r="32" fill="none" :stroke="palette.ring" stroke-opacity="0.42" stroke-width="1.5" />
        <g v-if="rankId === 'bronze'" :fill="palette.glyph">
          <circle cx="48" cy="48" r="6" />
        </g>
        <g v-else-if="rankId === 'silver'" :fill="palette.glyph">
          <circle cx="40" cy="48" r="5" />
          <circle cx="56" cy="48" r="5" />
        </g>
        <g v-else-if="rankId === 'gold'" :fill="palette.glyph">
          <polygon points="48,28 51,42 65,44 54,53 58,67 48,59 38,67 42,53 31,44 45,42" />
        </g>
        <g v-else-if="rankId === 'diamond'" :fill="palette.glyph" :stroke="palette.ring" stroke-width="1.4" stroke-linejoin="round">
          <polygon points="48,26 66,46 48,70 30,46" />
          <polyline points="36,46 60,46" :stroke="palette.ring" stroke-width="1.2" fill="none" stroke-opacity="0.55" />
          <polyline points="48,26 48,70" :stroke="palette.ring" stroke-width="1.2" fill="none" stroke-opacity="0.55" />
        </g>
      </svg>
    </span>
  `
};
