import { ArtifactGridBoard } from './ArtifactGridBoard.js';

export const FighterCard = {
  components: { ArtifactGridBoard },
  props: {
    mushroom: { type: Object, default: null },
    nameText: { type: String, default: '' },
    healthText: { type: String, default: '' },
    statsText: { type: String, default: '' },
    speechText: { type: String, default: '' },
    loadout: { type: Object, default: null },
    renderArtifactFigure: { type: Function, default: null },
    getArtifact: { type: Function, default: null },
    acting: { type: Boolean, default: false },
    bubbleStyle: { type: Object, default: () => ({}) },
    extraClass: { type: String, default: '' }
  },
  computed: {
    rootClass() {
      return ['fighter', this.extraClass, { acting: this.acting }];
    }
  },
  template: `
    <article :class="rootClass">
      <h3 class="fighter-name">{{ nameText || mushroom?.name?.ru || mushroom?.name?.en || mushroom?.id }}</h3>
      <div class="fighter-portrait-wrap" :style="bubbleStyle">
        <div v-if="speechText" class="fighter-speech-bubble">{{ speechText }}</div>
        <img
          v-if="mushroom"
          :src="mushroom.imagePath"
          :alt="mushroom.name?.ru || mushroom.name?.en || mushroom.id"
          class="fighter-portrait"
        />
      </div>
      <div class="fighter-meta-row">
        <div class="fighter-copy">
          <p v-if="healthText">{{ healthText }}</p>
          <p v-else-if="mushroom">{{ mushroom.styleTag }}</p>
          <p v-if="statsText" class="fighter-stats">{{ statsText }}</p>
        </div>
        <artifact-grid-board
          v-if="loadout && renderArtifactFigure && getArtifact"
          variant="inventory"
          class="fighter-inline-inventory"
          :items="loadout.items"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
        />
      </div>
    </article>
  `
};
