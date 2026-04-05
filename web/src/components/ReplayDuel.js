import { FighterCard } from './FighterCard.js';

export const ReplayDuel = {
  components: { FighterCard },
  props: {
    leftFighter: { type: Object, default: () => ({}) },
    rightFighter: { type: Object, default: () => ({}) },
    renderArtifactFigure: { type: Function, default: null },
    getArtifact: { type: Function, default: null },
    actingSide: { type: String, default: '' },
    statusText: { type: String, default: '' },
    showResultButton: { type: Boolean, default: false },
    resultLabel: { type: String, default: '' }
  },
  emits: ['result-click'],
  template: `
    <div class="duel">
      <fighter-card
        :mushroom="leftFighter.mushroom"
        :name-text="leftFighter.nameText"
        :health-text="leftFighter.healthText"
        :stats-text="leftFighter.statsText"
        :speech-text="leftFighter.speechText"
        :loadout="leftFighter.loadout"
        :render-artifact-figure="renderArtifactFigure"
        :get-artifact="getArtifact"
        :acting="actingSide === 'left'"
        :bubble-style="leftFighter.bubbleStyle"
      />
      <div class="battle-status">
        <svg class="battle-status-icon" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M20 14 L30 24 L24 30 L14 20 Z" fill="#8a6135" />
          <path d="M34 40 L44 50 L50 44 L40 34 Z" fill="#8a6135" />
          <path d="M44 14 L50 20 L20 50 L14 44 Z" fill="#b07d47" />
          <path d="M14 14 L20 20 L50 50 L44 44 Z" fill="#7f9872" />
        </svg>
        <p v-if="statusText">{{ statusText }}</p>
        <button
          v-if="showResultButton"
          class="ghost replay-result-button"
          @click="$emit('result-click')"
        >
          {{ resultLabel }}
        </button>
      </div>
      <fighter-card
        :mushroom="rightFighter.mushroom"
        :name-text="rightFighter.nameText"
        :health-text="rightFighter.healthText"
        :stats-text="rightFighter.statsText"
        :speech-text="rightFighter.speechText"
        :loadout="rightFighter.loadout"
        :render-artifact-figure="renderArtifactFigure"
        :get-artifact="getArtifact"
        :acting="actingSide === 'right'"
        :bubble-style="rightFighter.bubbleStyle"
      />
    </div>
  `
};
