import { ArtifactGridBoard } from '../ArtifactGridBoard.js';
import { ARTIFACT_ROLE_CLASSES } from '../../../../app/shared/artifact-visual-classification.js';

export const InventoryZone = {
  name: 'InventoryZone',
  components: { ArtifactGridBoard },
  props: ['state', 't', 'builderTotals', 'totalRows', 'bagRows', 'getArtifact', 'placementPreviewAt'],
  emits: [
    'unplace', 'rotate', 'cell-drop', 'inventory-drag-start', 'drag-end',
    'deactivate-bag', 'rotate-bag', 'bag-chip-drag-start'
  ],
  methods: {
    visibleActiveBags() {
      return this.state.activeBags.filter((bag) => bag.artifactId !== 'starter_bag');
    },
    bagChipHasItems(bagId) {
      return false;
    },
    bagChipDraggable(bagId) {
      return true;
    },
    bagChipTitle(bag) {
      const dragHint = this.t?.bagDragHint || 'Drag to move';
      return dragHint;
    },
    onChipDragStart(bag, event) {
      this.$emit('bag-chip-drag-start', { bagId: bag.id, event });
    },
    onChipDragEnd() {
      this.$emit('drag-end');
    },
    statSummaryItems() {
      const labels = {
        ru: {
          damage: 'Урон',
          armor: 'Броня',
          speed: 'Скорость',
          stunChance: 'Оглушение'
        },
        en: {
          damage: 'Damage',
          armor: 'Armor',
          speed: 'Speed',
          stunChance: 'Stun'
        }
      };
      const lang = this.state.lang === 'en' ? 'en' : 'ru';
      return [
        { id: 'damage', roleId: 'damage', value: this.builderTotals.damage || 0 },
        { id: 'armor', roleId: 'armor', value: this.builderTotals.armor || 0 },
        { id: 'speed', roleId: null, value: this.builderTotals.speed || 0 },
        { id: 'stunChance', roleId: 'stun', value: this.builderTotals.stunChance || 0, suffix: '%' }
      ].map((item) => ({
        ...item,
        role: item.roleId ? ARTIFACT_ROLE_CLASSES[item.roleId] : null,
        label: labels[lang][item.id],
        text: this.formatStatValue(item.value, item.suffix)
      }));
    },
    formatStatValue(value, suffix = '') {
      const n = Number(value) || 0;
      return `${n > 0 ? '+' : ''}${n}${suffix}`;
    }
  },
  template: `
    <div class="artifact-inventory-section panel">
      <artifact-grid-board
        variant="inventory"
        class="inventory-shell artifact-inventory-grid"
        :total-rows="totalRows"
        :items="state.builderItems"
        :bag-rows="bagRows"
        :get-artifact="getArtifact"
        :clickable-pieces="true"
        :rotatable-pieces="true"
        :droppable="true"
        :draggable-pieces="true"
        :placement-preview-for-cell="placementPreviewAt"
        @piece-click="$emit('unplace', $event)"
        @piece-rotate="$emit('rotate', $event)"
        @cell-drop="$emit('cell-drop', $event)"
        @piece-drag-start="$emit('inventory-drag-start', $event)"
        @piece-drag-end="$emit('drag-end')"
      />
      <div v-if="visibleActiveBags().length" class="active-bags-bar">
        <span
          v-for="bag in visibleActiveBags()"
          :key="bag.id || bag.artifactId"
          class="active-bag-chip"
          :class="{ 'active-bag-chip--locked': bagChipHasItems(bag.id), 'active-bag-chip--draggable': bagChipDraggable(bag.id) }"
          :style="{ borderColor: getArtifact(bag.artifactId)?.color || '#888' }"
          :draggable="bagChipDraggable(bag.id)"
          :title="bagChipTitle(bag)"
          :data-bag-row-id="bag.id"
          :data-bag-locked="bagChipHasItems(bag.id) ? 'true' : 'false'"
          @dragstart="onChipDragStart(bag, $event)"
          @dragend="onChipDragEnd"
        >
          {{ getArtifact(bag.artifactId)?.name?.[state.lang] || bag.artifactId }}
          <button
            v-if="getArtifact(bag.artifactId)?.width !== getArtifact(bag.artifactId)?.height"
            class="active-bag-action"
            @click="$emit('rotate-bag', { id: bag.id, artifactId: bag.artifactId })"
          >↻</button>
          <button class="active-bag-action" @click="$emit('deactivate-bag', { id: bag.id, artifactId: bag.artifactId })">✕</button>
        </span>
      </div>
      <div v-if="state.builderItems.length" class="artifact-inventory-footer">
        <span class="artifact-inventory-stats" aria-label="Artifact stat summary">
          <span
            v-for="item in statSummaryItems()"
            :key="item.id"
            class="artifact-inventory-stat-chip"
            :class="{ 'artifact-inventory-stat-chip--plain': !item.role }"
            :style="item.role ? { '--artifact-role-color': item.role.color } : null"
          >
            <span
              v-if="item.role"
              class="artifact-role-glyph artifact-role-legend-glyph"
              :class="'artifact-role-glyph--' + item.roleId"
              aria-hidden="true"
            ><span></span></span>
            <span class="artifact-inventory-stat-label">{{ item.label }}</span>
            <b>{{ item.text }}</b>
          </span>
        </span>
      </div>
    </div>
  `
};
