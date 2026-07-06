import { InventoryZone as CoreInventoryZone } from '@microwavedev/backpack-game-core/vue/components';
import { ArtifactGridBoard } from '../ArtifactGridBoard.js';
import { ArtifactStatSummary } from '../ArtifactStatSummary.js';

export const InventoryZone = {
  name: 'InventoryZone',
  components: { ArtifactGridBoard, ArtifactStatSummary, CoreInventoryZone },
  props: [
    'state', 't', 'builderTotals', 'totalRows', 'bagRows', 'getArtifact',
    'placementPreviewAt', 'fusionIngredientRowIds', 'fusionCandidateRowIds'
  ],
  emits: [
    'unplace', 'rotate', 'cell-drop', 'inventory-drag-start', 'drag-end',
    'deactivate-bag', 'rotate-bag', 'bag-chip-drag-start'
  ],
  computed: {
    activeContainerChips() {
      return (this.state.activeBags || [])
        .filter((bag) => bag.artifactId !== 'starter_bag')
        .map((bag) => {
          const artifact = this.getArtifact(bag.artifactId) || {};
          return {
            id: bag.id,
            artifactId: bag.artifactId,
            name: artifact?.name?.[this.state.lang] || artifact?.name?.en || bag.artifactId,
            color: artifact?.color || '#888',
            draggable: true,
            locked: false,
            title: this.t?.bagDragHint || 'Drag to move',
            rotatable: artifact?.width !== artifact?.height
          };
        });
    },
    labels() {
      return {
        rotateAction: '\u21BB',
        removeAction: '\u2715',
        statSummaryAriaLabel: 'Artifact stat summary'
      };
    }
  },
  methods: {
    onContainerDragStart(payload) {
      this.$emit('bag-chip-drag-start', {
        bagId: payload.id,
        event: payload.event
      });
    },
    onRotateContainer(payload) {
      this.$emit('rotate-bag', {
        id: payload.id,
        artifactId: payload.artifactId
      });
    },
    onDeactivateContainer(payload) {
      this.$emit('deactivate-bag', {
        id: payload.id,
        artifactId: payload.artifactId
      });
    }
  },
  template: `
    <CoreInventoryZone
      :items="state.builderItems"
      :active-containers="activeContainerChips"
      :totals="builderTotals"
      :total-rows="totalRows"
      :bag-rows="bagRows"
      :placement-preview-at="placementPreviewAt"
      :highlighted-row-ids="fusionCandidateRowIds"
      :highlighted-title="t.fusionCandidateHint"
      :labels="labels"
      @remove-item="$emit('unplace', $event)"
      @rotate-item="$emit('rotate', $event)"
      @cell-drop="$emit('cell-drop', $event)"
      @item-drag-start="$emit('inventory-drag-start', $event)"
      @item-drag-end="$emit('drag-end')"
      @container-chip-drag-start="onContainerDragStart"
      @rotate-container="onRotateContainer"
      @deactivate-container="onDeactivateContainer"
    >
      <template
        #grid="{
          gridClass,
          totalRows,
          items,
          bagRows,
          placementPreviewAt,
          highlightedRowIds,
          highlightedTitle,
          onRemoveItem,
          onRotateItem,
          onCellDrop,
          onItemDragStart,
          onItemDragEnd
        }"
      >
        <artifact-grid-board
          variant="inventory"
          :class="gridClass"
          :total-rows="totalRows"
          :items="items"
          :bag-rows="bagRows"
          :get-artifact="getArtifact"
          :clickable-pieces="true"
          :rotatable-pieces="true"
          :droppable="true"
          :draggable-pieces="true"
          :placement-preview-for-cell="placementPreviewAt"
          :highlighted-row-ids="highlightedRowIds"
          :highlighted-title="highlightedTitle"
          @piece-click="onRemoveItem"
          @piece-rotate="onRotateItem"
          @cell-drop="onCellDrop"
          @piece-drag-start="onItemDragStart"
          @piece-drag-end="onItemDragEnd"
        />
      </template>
      <template #footer="{ totals, ariaLabel }">
        <artifact-stat-summary
          :totals="totals"
          :lang="state.lang"
          :aria-label="ariaLabel"
        />
      </template>
    </CoreInventoryZone>
  `
};
