import { FighterCard } from './FighterCard.js';
import { ArtifactGridBoard } from './ArtifactGridBoard.js';
import { prepareGridProps } from '../composables/loadout-projection.js';

export const ReplayDuel = {
  components: { FighterCard, ArtifactGridBoard },
  props: {
    leftFighter: { type: Object, default: () => ({}) },
    rightFighter: { type: Object, default: () => ({}) },
    renderArtifactFigure: { type: Function, default: null },
    getArtifact: { type: Function, default: null },
    actingSide: { type: String, default: '' },
    statusText: { type: String, default: '' },
    replaySpeed: { type: Number, default: 1 }
  },
  emits: ['set-speed'],
  computed: {
    // Project both sides' loadouts through the unified renderer so the
    // battle grid matches the prep grid exactly — same bag colours, same
    // mask gaps, same alongside packing. Skipping this step renders raw
    // DB rows where bagged items collide with base-grid items at (0, 0)
    // and bag rows render off-grid at (-1, -1).
    leftGridProps() {
      return this.gridPropsFor(this.leftFighter);
    },
    rightGridProps() {
      return this.gridPropsFor(this.rightFighter);
    }
  },
  methods: {
    gridPropsFor(fighter) {
      if (!fighter?.loadout || !this.getArtifact) return null;
      const items = fighter.loadout.items || [];
      const bagIds = new Set(
        items.filter((i) => this.getArtifact(i.artifactId)?.family === 'bag').map((i) => i.artifactId)
      );
      return prepareGridProps(items, bagIds, this.getArtifact);
    }
  },
  template: `
    <div class="duel">
      <div class="duel-fighters">
        <fighter-card
          :mushroom="leftFighter.mushroom"
          :name-text="leftFighter.nameText"
          :health-text="leftFighter.healthText"
          :speech-text="leftFighter.speechText"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
          :acting="actingSide === 'left'"
          :bubble-style="leftFighter.bubbleStyle"
          :hide-loadout="true"
        />
        <fighter-card
          :mushroom="rightFighter.mushroom"
          :name-text="rightFighter.nameText"
          :health-text="rightFighter.healthText"
          :speech-text="rightFighter.speechText"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
          :acting="actingSide === 'right'"
          :bubble-style="rightFighter.bubbleStyle"
          :hide-loadout="true"
        />
      </div>
      <div class="duel-loadouts">
        <div class="duel-loadout-side">
          <span class="duel-loadout-name">{{ leftFighter.nameText }}</span>
          <artifact-grid-board
            v-if="leftGridProps && renderArtifactFigure"
            variant="inventory"
            class="fighter-inline-inventory"
            :items="leftGridProps.items"
            :bag-rows="leftGridProps.bagRows"
            :total-rows="leftGridProps.totalRows"
            :render-artifact-figure="renderArtifactFigure"
            :get-artifact="getArtifact"
          />
        </div>
        <div class="duel-loadout-center">
          <p v-if="statusText" class="duel-loadout-status">{{ statusText }}</p>
          <svg v-else class="duel-loadout-icon" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M20 14 L30 24 L24 30 L14 20 Z" fill="#8a6135" />
            <path d="M34 40 L44 50 L50 44 L40 34 Z" fill="#8a6135" />
            <path d="M44 14 L50 20 L20 50 L14 44 Z" fill="#b07d47" />
            <path d="M14 14 L20 20 L50 50 L44 44 Z" fill="#7f9872" />
          </svg>
          <div class="replay-speed-controls">
            <button
              v-for="item in [{ speed: 1, count: 1 }, { speed: 2, count: 2 }, { speed: 4, count: 3 }]" :key="item.speed"
              type="button"
              class="replay-speed-btn"
              :class="{ 'replay-speed-btn--active': replaySpeed === item.speed }"
              :aria-label="item.speed + 'x'"
              @click="$emit('set-speed', item.speed)"
            >
              <svg :viewBox="'0 0 ' + (item.count * 8 + 2) + ' 10'" aria-hidden="true">
                <polygon v-for="n in item.count" :key="n" :points="((n - 1) * 8) + ',1 ' + ((n - 1) * 8 + 7) + ',5 ' + ((n - 1) * 8) + ',9'" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
        <div class="duel-loadout-side duel-loadout-side--right">
          <span class="duel-loadout-name">{{ rightFighter.nameText }}</span>
          <artifact-grid-board
            v-if="rightGridProps && renderArtifactFigure"
            variant="inventory"
            class="fighter-inline-inventory"
            :items="rightGridProps.items"
            :bag-rows="rightGridProps.bagRows"
            :total-rows="rightGridProps.totalRows"
            :render-artifact-figure="renderArtifactFigure"
            :get-artifact="getArtifact"
          />
        </div>
      </div>
    </div>
  `
};
