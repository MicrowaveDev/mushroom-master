import { ArtifactGridBoard } from './ArtifactGridBoard.js';
import { prepareGridProps } from '../composables/loadout-projection.js';

export const FighterCard = {
  components: { ArtifactGridBoard },
  props: {
    mushroom: { type: Object, default: null },
    imagePath: { type: String, default: '' },
    nameText: { type: String, default: '' },
    healthText: { type: String, default: '' },
    statsText: { type: String, default: '' },
    speechText: { type: String, default: '' },
    speechParts: { type: Array, default: () => [] },
    loadout: { type: Object, default: null },
    bagArtifactIds: { type: [Array, Set], default: null },
    renderArtifactFigure: { type: Function, default: null },
    getArtifact: { type: Function, default: null },
    acting: { type: Boolean, default: false },
    side: { type: String, default: '' },
    bubbleStyle: { type: Object, default: () => ({}) },
    extraClass: { type: String, default: '' },
    visualEffects: { type: Object, default: () => ({}) },
    hideLoadout: { type: Boolean, default: false }
  },
  computed: {
    rootClass() {
      return [
        'fighter',
        this.side ? `fighter--${this.side}` : '',
        this.extraClass,
        ...(this.visualEffects?.classes || []),
        { acting: this.acting, 'fighter--speaking': this.hasSpeech }
      ];
    },
    hasSpeech() {
      return !!this.speechText || this.speechParts.length > 0;
    },
    hpPercent() {
      const match = String(this.healthText || '').match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      if (!match) return null;
      const current = Math.max(0, Number(match[1]));
      const max = Math.max(1, Number(match[2]));
      return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
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
    },
    floatingLabels() {
      return this.visualEffects?.floatingLabels || [];
    },
    statusBadges() {
      return [];
    },
    effectKey() {
      return this.visualEffects?.key || 'idle';
    }
  },
  template: `
    <article :class="rootClass" :style="bubbleStyle">
      <div class="fighter-portrait-wrap">
        <div v-if="hasSpeech" class="fighter-speech-bubble">
          <template v-if="speechParts.length">
            <span
              v-for="(part, index) in speechParts"
              :key="index"
              :class="part.kind ? ['fighter-speech-part', 'fighter-speech-part--' + part.kind] : ''"
            >{{ part.text }}</span>
          </template>
          <template v-else>{{ speechText }}</template>
        </div>
        <div class="fighter-portrait-inner">
          <img
            v-if="mushroom"
            :src="imagePath || mushroom.imagePath"
            :alt="mushroom.name?.ru || mushroom.name?.en || mushroom.id"
            class="fighter-portrait"
          />
          <div v-if="statusBadges.length" class="fighter-status-badges" aria-label="Status effects">
            <span
              v-for="badge in statusBadges"
              :key="badge.className"
              class="fighter-status-badge"
              :class="'fighter-status-badge--' + badge.className"
            >{{ badge.label }}</span>
          </div>
          <div
            v-if="floatingLabels.length"
            :key="effectKey"
            class="fighter-effect-stack"
            aria-live="polite"
          >
            <span
              v-for="label in floatingLabels"
              :key="label.id"
              class="fighter-effect-pop"
              :class="'fighter-effect-pop--' + label.className"
            >{{ label.text }}</span>
          </div>
          <div class="fighter-name-overlay">
            <h3 class="fighter-name">{{ nameText || mushroom?.name?.ru || mushroom?.name?.en || mushroom?.id }}</h3>
            <div v-if="healthText" class="fighter-hp-wrap">
              <span class="fighter-hp">{{ healthText }}</span>
              <span v-if="hpPercent !== null" class="fighter-hp-meter" aria-hidden="true"><span :style="{ width: hpPercent + '%' }"></span></span>
            </div>
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
