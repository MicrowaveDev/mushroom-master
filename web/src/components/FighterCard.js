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
    extraClass: { type: String, default: '' },
    hideLoadout: { type: Boolean, default: false }
  },
  computed: {
    rootClass() {
      return ['fighter', this.extraClass, { acting: this.acting }];
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
          v-if="!hideLoadout && loadout && renderArtifactFigure && getArtifact"
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
