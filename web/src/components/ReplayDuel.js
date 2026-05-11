import { FighterCard } from './FighterCard.js';
import { ArtifactGridBoard } from './ArtifactGridBoard.js';
import { prepareGridProps } from '../composables/loadout-projection.js';
import { replayFighterEffects } from '../replay/effects.js';
import { ARTIFACT_ROLE_CLASSES, artifactVisualClassification } from '../../../app/shared/artifact-visual-classification.js';

export const ReplayDuel = {
  components: { FighterCard, ArtifactGridBoard },
  props: {
    leftFighter: { type: Object, default: () => ({}) },
    rightFighter: { type: Object, default: () => ({}) },
    renderArtifactFigure: { type: Function, default: null },
    getArtifact: { type: Function, default: null },
    actingSide: { type: String, default: '' },
    activeEvent: { type: Object, default: null },
    activeReplayState: { type: Object, default: null },
    replayIndex: { type: Number, default: 0 },
    statusText: { type: String, default: '' },
    replaySpeed: { type: Number, default: 1 },
    speedBoost: { type: Number, default: 1 },
    lang: { type: String, default: 'en' }
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
    },
    leftRoleSummary() {
      return this.roleSummaryFor(this.leftFighter);
    },
    rightRoleSummary() {
      return this.roleSummaryFor(this.rightFighter);
    },
    leftVisualEffects() {
      return this.visualEffectsFor('left');
    },
    rightVisualEffects() {
      return this.visualEffectsFor('right');
    },
    activeAttributionGroups() {
      const event = this.activeEvent;
      const attribution = event?.artifactAttribution;
      if (!attribution || event.type !== 'action' || !this.getArtifact) return [];
      const labels = this.lang === 'ru'
        ? { damage: 'Урон', stunChance: 'Оглушение', armor: 'Броня' }
        : { damage: 'Damage', stunChance: 'Stun', armor: 'Armor' };
      return [
        { key: 'damage', label: labels.damage, role: 'damage', items: attribution.damage || [] },
        { key: 'stunChance', label: labels.stunChance, role: 'stun', items: attribution.stunChance || [] },
        { key: 'armor', label: labels.armor, role: 'armor', items: attribution.armor || [] }
      ]
        .map((group) => ({
          ...group,
          roleClass: ARTIFACT_ROLE_CLASSES[group.role],
          total: group.items.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
          items: group.items
            .map((entry) => {
              const artifact = this.getArtifact(entry.artifactId);
              if (!artifact) return null;
              return {
                ...entry,
                name: artifact.name?.en || entry.artifactId
              };
            })
            .filter(Boolean)
        }))
        .filter((group) => group.items.length && group.total);
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
    },
    roleSummaryFor(fighter) {
      if (!fighter?.loadout || !this.getArtifact) return [];
      const counts = new Map();
      const items = fighter.loadout.items || [];
      for (const item of items) {
        if (item.x < 0 || item.y < 0) continue;
        const artifact = this.getArtifact(item.artifactId);
        if (!artifact) continue;
        const visual = artifactVisualClassification(artifact);
        counts.set(visual.role.id, {
          role: visual.role,
          count: (counts.get(visual.role.id)?.count || 0) + 1
        });
      }
      return ['damage', 'armor', 'stun', 'bag']
        .map((roleId) => counts.get(roleId))
        .filter(Boolean);
    },
    visualEffectsFor(side) {
      return replayFighterEffects({
        event: this.activeEvent,
        side,
        replayState: this.activeReplayState,
        replayIndex: this.replayIndex,
        lang: this.lang
      });
    },
    attributionValueText(group) {
      const suffix = group.key === 'stunChance' ? '%' : '';
      return `+${group.total}${suffix}`;
    }
  },
  template: `
    <div class="duel">
      <div class="duel-fighters">
        <fighter-card
          :mushroom="leftFighter.mushroom"
          :image-path="leftFighter.imagePath"
          :name-text="leftFighter.nameText"
          :health-text="leftFighter.healthText"
          :speech-text="leftFighter.speechText"
          :speech-parts="leftFighter.speechParts"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
          :acting="actingSide === 'left'"
          side="left"
          :bubble-style="leftFighter.bubbleStyle"
          :visual-effects="leftVisualEffects"
          :hide-loadout="true"
        />
        <fighter-card
          :mushroom="rightFighter.mushroom"
          :image-path="rightFighter.imagePath"
          :name-text="rightFighter.nameText"
          :health-text="rightFighter.healthText"
          :speech-text="rightFighter.speechText"
          :speech-parts="rightFighter.speechParts"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
          :acting="actingSide === 'right'"
          side="right"
          :bubble-style="rightFighter.bubbleStyle"
          :visual-effects="rightVisualEffects"
          :hide-loadout="true"
        />
      </div>
      <div class="duel-loadouts">
        <div class="duel-loadout-side">
          <span class="duel-loadout-name">{{ leftFighter.nameText }}</span>
          <div v-if="leftRoleSummary.length" class="duel-role-summary" aria-label="Left loadout roles">
            <span
              v-for="item in leftRoleSummary"
              :key="item.role.id"
              class="duel-role-chip"
              :class="'duel-role-chip--' + item.role.id"
              :style="{ '--artifact-role-color': item.role.color }"
            >
              <span class="duel-role-chip-mark" aria-hidden="true"></span>
              <span class="duel-role-chip-label">{{ item.role.label }}</span>
              <b>{{ item.count }}</b>
            </span>
          </div>
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
          <div v-if="activeAttributionGroups.length" class="duel-attribution" aria-label="Artifact attribution">
            <span
              v-for="group in activeAttributionGroups"
              :key="group.key"
              class="duel-attribution-chip"
              :class="'duel-attribution-chip--' + group.role"
              :style="{ '--artifact-role-color': group.roleClass.color }"
            >
              <span
                class="artifact-role-glyph artifact-role-legend-glyph"
                :class="'artifact-role-glyph--' + group.role"
                aria-hidden="true"
              ><span></span></span>
              <span class="duel-attribution-label">{{ group.label }}</span>
              <b>{{ attributionValueText(group) }}</b>
            </span>
          </div>
          <p v-if="statusText" class="duel-loadout-status">{{ statusText }}</p>
          <svg v-else class="duel-loadout-icon" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M20 14 L30 24 L24 30 L14 20 Z" fill="#8a6135" />
            <path d="M34 40 L44 50 L50 44 L40 34 Z" fill="#8a6135" />
            <path d="M44 14 L50 20 L20 50 L14 44 Z" fill="#b07d47" />
            <path d="M14 14 L20 20 L50 50 L44 44 Z" fill="#7f9872" />
          </svg>
          <div class="replay-speed-controls">
            <button
              v-for="item in [{ speed: 2, count: 1 }, { speed: 4, count: 2 }, { speed: 8, count: 3 }]" :key="item.speed"
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
            <span v-if="speedBoost > 1" class="replay-speed-boost" aria-label="Long battle speed boost">
              {{ speedBoost }}x
            </span>
          </div>
        </div>
        <div class="duel-loadout-side duel-loadout-side--right">
          <span class="duel-loadout-name">{{ rightFighter.nameText }}</span>
          <div v-if="rightRoleSummary.length" class="duel-role-summary" aria-label="Right loadout roles">
            <span
              v-for="item in rightRoleSummary"
              :key="item.role.id"
              class="duel-role-chip"
              :class="'duel-role-chip--' + item.role.id"
              :style="{ '--artifact-role-color': item.role.color }"
            >
              <span class="duel-role-chip-mark" aria-hidden="true"></span>
              <span class="duel-role-chip-label">{{ item.role.label }}</span>
              <b>{{ item.count }}</b>
            </span>
          </div>
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
