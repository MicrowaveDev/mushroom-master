import { RunHud as CoreRunHud, BackpackSaleAction } from '@microwavedev/backpack-game-core/vue/components';

export const RunHud = {
  name: 'RunHud',
  components: { CoreRunHud, BackpackSaleAction },
  props: ['state', 't', 'interaction'],
  computed: {
    player() {
      return this.state.gameRun?.player || {};
    },
    labels() {
      return {
        wins: this.t?.wins,
        lives: this.t?.lives
      };
    },
    runCurrency() {
      return {
        amount: this.player.coins || 0,
        icon: '\uD83E\uDE99'
      };
    }
  },
  template: `
    <CoreRunHud
      :player="player"
      :labels="labels"
      :run-currency="runCurrency"
      currency-class="run-hud-item run-hud-coins"
    >
      <template #currency-action><BackpackSaleAction v-if="interaction" :interaction="interaction" :labels="t.backpackInteraction" /></template>
    </CoreRunHud>
  `
};
