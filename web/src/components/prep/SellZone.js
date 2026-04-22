export const SellZone = {
  name: 'SellZone',
  props: ['state', 't', 'runSellPriceLabel'],
  emits: ['sell-dragover', 'sell-dragleave', 'sell-drop'],
  template: `
    <div
      class="sell-zone"
      :class="{ 'sell-zone--active': state.sellDragOver }"
      @dragover="$emit('sell-dragover', $event)"
      @dragleave="$emit('sell-dragleave')"
      @drop="$emit('sell-drop', $event)"
    >
      <span v-if="state.sellDragOver && state.draggingArtifactId" class="sell-zone-price">\uD83E\uDE99 +{{ runSellPriceLabel }}</span>
      <span v-else>\uD83D\uDCB0 {{ t.sellArea }}</span>
    </div>
  `
};
