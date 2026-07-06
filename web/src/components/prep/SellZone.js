import { SellZone as CoreSellZone } from '@microwavedev/backpack-game-core/vue/components';

export const SellZone = {
  name: 'SellZone',
  components: { CoreSellZone },
  props: ['state', 't', 'runSellPriceLabel'],
  emits: ['sell-dragover', 'sell-dragleave', 'sell-drop'],
  computed: {
    pricePrefix() {
      return '\uD83E\uDE99';
    },
    inactivePrefix() {
      return '\uD83D\uDCB0';
    }
  },
  template: `
    <CoreSellZone
      :active="!!state.sellDragOver"
      :dragging-item-id="state.draggingArtifactId || ''"
      :price-label="runSellPriceLabel"
      :price-prefix="pricePrefix"
      :inactive-prefix="inactivePrefix"
      :inactive-text="t.sellArea"
      @dragover="$emit('sell-dragover', $event)"
      @dragleave="$emit('sell-dragleave')"
      @drop="$emit('sell-drop', $event)"
    />
  `
};
