// Season rank emblem backed by approved production PNGs.

export const SeasonRankEmblem = {
  name: 'SeasonRankEmblem',
  props: {
    rankId: { type: String, default: 'bronze' },
    size: { type: Number, default: 96 }
  },
  computed: {
    pngSrc() {
      return `/season-ranks/${this.rankId}.png`;
    }
  },
  template: `
    <span class="season-rank-emblem" :class="'season-rank-emblem--' + rankId" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true">
      <img
        :src="pngSrc"
        class="season-rank-emblem-img"
        :width="size"
        :height="size"
        alt=""
      />
    </span>
  `
};
