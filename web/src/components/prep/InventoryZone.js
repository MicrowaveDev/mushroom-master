import { ArtifactGridBoard } from '../ArtifactGridBoard.js';

export const InventoryZone = {
  name: 'InventoryZone',
  components: { ArtifactGridBoard },
  props: ['state', 't', 'builderTotals', 'effectiveRows', 'bagRows', 'getArtifact'],
  emits: ['unplace', 'rotate', 'cell-drop', 'inventory-drag-start', 'drag-end', 'deactivate-bag', 'rotate-bag'],
  template: `
    <div class="artifact-inventory-section panel">
      <artifact-grid-board
        variant="inventory"
        class="inventory-shell artifact-inventory-grid"
        :rows="effectiveRows"
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
          :style="{ borderColor: getArtifact(bag.artifactId)?.color || '#888' }"
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
