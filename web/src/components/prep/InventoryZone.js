import { ArtifactGridBoard } from '../ArtifactGridBoard.js';

export const InventoryZone = {
  name: 'InventoryZone',
  components: { ArtifactGridBoard },
  props: ['state', 't', 'builderTotals', 'totalRows', 'bagRows', 'getArtifact'],
  emits: [
    'unplace', 'rotate', 'cell-drop', 'inventory-drag-start', 'drag-end',
    'deactivate-bag', 'rotate-bag', 'bag-chip-drag-start'
  ],
  methods: {
    bagChipHasItems(bagId) {
      return this.state.builderItems.some((it) => it.bagId === bagId);
    },
    bagChipDraggable(bagId) {
      return !this.bagChipHasItems(bagId);
    },
    bagChipTitle(bag) {
      const isLocked = this.bagChipHasItems(bag.id);
      const lockedHint = this.t?.bagDragBlocked || 'Empty the bag to move it';
      const dragHint = this.t?.bagDragHint || 'Drag to move';
      return isLocked ? lockedHint : dragHint;
    },
    onChipDragStart(bag, event) {
      // Empty-bag invariant — non-draggable chips don't fire dragstart at the
      // browser level (draggable=false), but a paranoid early-return here
      // protects against future re-enabling without rechecking the gate.
      if (this.bagChipHasItems(bag.id)) {
        event?.preventDefault?.();
        return;
      }
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
        @piece-click="$emit('unplace', $event)"
        @piece-rotate="$emit('rotate', $event)"
        @cell-drop="$emit('cell-drop', $event)"
        @piece-drag-start="$emit('inventory-drag-start', $event)"
        @piece-drag-end="$emit('drag-end')"
      />
      <div v-if="state.activeBags.length" class="active-bags-bar">
        <span
          v-for="bag in state.activeBags"
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
            @click="$emit('rotate-bag', bag.artifactId)"
          >↻</button>
          <button class="active-bag-action" @click="$emit('deactivate-bag', bag.artifactId)">✕</button>
        </span>
      </div>
      <div v-if="state.builderItems.length" class="artifact-inventory-footer">
        <span class="artifact-inventory-stats">+{{ builderTotals.damage }} DMG / +{{ builderTotals.armor }} ARM / +{{ builderTotals.speed }} SPD / +{{ builderTotals.stunChance }}% STUN</span>
      </div>
    </div>
  `
};
