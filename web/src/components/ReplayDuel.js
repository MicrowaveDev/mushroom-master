import { FighterCard } from './FighterCard.js';
import { ArtifactGridBoard } from './ArtifactGridBoard.js';

export const ReplayDuel = {
  components: { FighterCard, ArtifactGridBoard },
  props: {
    leftFighter: { type: Object, default: () => ({}) },
    rightFighter: { type: Object, default: () => ({}) },
    renderArtifactFigure: { type: Function, default: null },
    getArtifact: { type: Function, default: null },
    actingSide: { type: String, default: '' },
    statusText: { type: String, default: '' }
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
            v-if="leftFighter.loadout && renderArtifactFigure && getArtifact"
            variant="inventory"
            class="fighter-inline-inventory"
            :items="leftFighter.loadout.items"
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
        </div>
        <div class="duel-loadout-side duel-loadout-side--right">
          <span class="duel-loadout-name">{{ rightFighter.nameText }}</span>
          <artifact-grid-board
            v-if="rightFighter.loadout && renderArtifactFigure && getArtifact"
            variant="inventory"
            class="fighter-inline-inventory"
            :items="rightFighter.loadout.items"
            :render-artifact-figure="renderArtifactFigure"
            :get-artifact="getArtifact"
          />
        </div>
      </div>
    </div>
  `
};
