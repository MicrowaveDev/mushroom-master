import { ArtifactGridBoard } from '../ArtifactGridBoard.js';

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
        <span class="artifact-inventory-stats">+{{ builderTotals.damage }} DMG / +{{ builderTotals.armor }} ARM / +{{ builderTotals.speed }} SPD / +{{ builderTotals.stunChance }}% STUN</span>
      </div>
    </div>
  `
};
