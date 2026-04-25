import { ArtifactGridBoard } from './ArtifactGridBoard.js';
import { prepareGridProps } from '../composables/loadout-projection.js';

export const FighterCard = {
  components: { ArtifactGridBoard },
  props: {
    mushroom: { type: Object, default: null },
    nameText: { type: String, default: '' },
    healthText: { type: String, default: '' },
    statsText: { type: String, default: '' },
    speechText: { type: String, default: '' },
    loadout: { type: Object, default: null },
    bagArtifactIds: { type: [Array, Set], default: null },
    renderArtifactFigure: { type: Function, default: null },
    getArtifact: { type: Function, default: null },
    acting: { type: Boolean, default: false },
    bubbleStyle: { type: Object, default: () => ({}) },
    extraClass: { type: String, default: '' },
    hideLoadout: { type: Boolean, default: false }
  },
  computed: {
    rootClass() {
      return ['fighter', this.extraClass, { acting: this.acting }];
    },
    // Run snapshot loadout items through the same projection the prep
    // screen uses so the battle/replay grid renders bag rows, bagged-item
    // virtual coords, and bag colour masks identically. Without this, raw
    // DB rows render with bag rows at (-1, -1) and bagged items at slot
    // coords overlapping base-grid items.
    gridProps() {
      if (!this.loadout || !this.getArtifact) return null;
      const items = this.loadout.items || [];
      const bagIds = this.bagArtifactIds
        || new Set(items.filter((i) => this.getArtifact(i.artifactId)?.family === 'bag').map((i) => i.artifactId));
      return prepareGridProps(items, bagIds, this.getArtifact);
    }
  },
  template: `
    <article :class="rootClass">
      <div class="fighter-portrait-wrap" :style="bubbleStyle">
        <div v-if="speechText" class="fighter-speech-bubble">{{ speechText }}</div>
        <div class="fighter-portrait-inner">
          <img
            v-if="mushroom"
            :src="mushroom.imagePath"
            :alt="mushroom.name?.ru || mushroom.name?.en || mushroom.id"
            class="fighter-portrait"
          />
          <div class="fighter-name-overlay">
            <h3 class="fighter-name">{{ nameText || mushroom?.name?.ru || mushroom?.name?.en || mushroom?.id }}</h3>
            <span v-if="healthText" class="fighter-hp">{{ healthText }}</span>
          </div>
        </div>
      </div>
      <div v-if="statsText || (!hideLoadout && loadout)" class="fighter-meta-row">
        <p v-if="statsText" class="fighter-stats">{{ statsText }}</p>
        <artifact-grid-board
          v-if="!hideLoadout && gridProps && renderArtifactFigure"
          variant="inventory"
          class="fighter-inline-inventory"
          :items="gridProps.items"
          :bag-rows="gridProps.bagRows"
          :total-rows="gridProps.totalRows"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
        />
      </div>
    </article>
  `
};
