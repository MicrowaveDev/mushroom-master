import { BAG_COLUMNS, BAG_ROWS } from '../constants.js';
import { shapePrepScreenViewState } from '@microwavedev/backpack-game-core/client-view-model';
import { PrepScreen as CorePrepScreen } from '@microwavedev/backpack-game-core/vue/components';
import { RunHud } from '../components/prep/RunHud.js';
import { StorageZone } from '../components/prep/StorageZone.js';
import { BackpackZone } from '../components/prep/BackpackZone.js';
import { ShopZone } from '../components/prep/ShopZone.js';
import { PrepActions } from '../components/prep/PrepActions.js';
import { FusionReveal } from '../components/prep/FusionReveal.js';

export const PrepScreen = {
  name: 'PrepScreen',
  props: [
    'state', 't', 'storageItems', 'builderTotals',
    'renderArtifactFigure', 'getArtifact', 'formatArtifactBonus',
    'preferredOrientation', 'getArtifactPrice', 'effectiveRows', 'placementPreviewAt',
    'fusionIngredientRowIds', 'fusionCandidateRowIds', 'fusionCandidateShopArtifactIds'
  ],
  emits: [
    'auto-place', 'container-drag-start', 'drag-end',
    'container-dragover', 'container-drop',
    'unplace', 'rotate', 'cell-drop', 'inventory-drag-start',
    'buy-run-item', 'refresh-shop',
    'sell-dragover', 'sell-dragleave', 'sell-drop',
    'signal-ready', 'abandon', 'deactivate-bag', 'rotate-bag', 'bag-chip-drag-start',
    'fusion-reveal-complete'
  ],
  components: {
    CorePrepScreen,
    RunHud,
    StorageZone,
    BackpackZone,
    ShopZone,
    PrepActions,
    FusionReveal
  },
  computed: {
    prepViewState() {
      return shapePrepScreenViewState({
        state: this.state,
        getArtifact: this.getArtifact,
        getArtifactPrice: this.getArtifactPrice,
        columns: BAG_COLUMNS,
        minRows: BAG_ROWS
      });
    },
    bagRows() {
      return this.prepViewState.bagRows;
    },
    totalRows() {
      return this.prepViewState.totalRows;
    },
    runRefreshCost() {
      return this.prepViewState.runRefreshCost;
    },
    runSellPriceLabel() {
      return this.prepViewState.runSellPriceLabel;
    }
  },
  template: `
    <core-prep-screen
      :ready="!!state.bootstrapReady"
      :round-label="t.round"
      :round-number="state.gameRun.currentRound"
      :show-reconnecting="state.gameRun.mode === 'challenge' && state.sseConnected === false"
      :reconnecting-text="t.reconnecting"
    >
      <template #hud>
        <run-hud :state="state" :t="t" />
      </template>

      <template #loadout>
        <storage-zone
          :state="state"
          :t="t"
          :storage-items="storageItems"
          :get-artifact="getArtifact"
          :format-artifact-bonus="formatArtifactBonus"
          :preferred-orientation="preferredOrientation"
          :fusion-ingredient-row-ids="fusionIngredientRowIds"
          :fusion-candidate-row-ids="fusionCandidateRowIds"
          @auto-place="$emit('auto-place', $event)"
          @container-dragover="$emit('container-dragover', $event)"
          @container-drop="$emit('container-drop', $event)"
        />

        <backpack-zone
          :state="state"
          :t="t"
          :builder-totals="builderTotals"
          :total-rows="totalRows"
          :bag-rows="bagRows"
          :get-artifact="getArtifact"
          :placement-preview-at="placementPreviewAt"
          :fusion-ingredient-row-ids="fusionIngredientRowIds"
          :fusion-candidate-row-ids="fusionCandidateRowIds"
          @unplace="$emit('unplace', $event)"
          @rotate="$emit('rotate', $event)"
          @cell-drop="$emit('cell-drop', $event)"
          @inventory-drag-start="$emit('inventory-drag-start', $event)"
          @drag-end="$emit('drag-end')"
          @deactivate-bag="$emit('deactivate-bag', $event)"
          @rotate-bag="$emit('rotate-bag', $event)"
          @bag-chip-drag-start="$emit('bag-chip-drag-start', $event)"
        />
      </template>

      <template #shop>
        <shop-zone
          :state="state"
          :t="t"
          :run-refresh-cost="runRefreshCost"
          :run-sell-price-label="runSellPriceLabel"
          :get-artifact="getArtifact"
          :get-artifact-price="getArtifactPrice"
          :preferred-orientation="preferredOrientation"
          :format-artifact-bonus="formatArtifactBonus"
          :fusion-candidate-shop-artifact-ids="fusionCandidateShopArtifactIds"
          @buy-run-item="$emit('buy-run-item', $event)"
          @refresh-shop="$emit('refresh-shop')"
          @sell-dragover="$emit('sell-dragover', $event)"
          @sell-dragleave="$emit('sell-dragleave')"
          @sell-drop="$emit('sell-drop', $event)"
        />
      </template>

      <template #actions>
        <prep-actions
          :state="state"
          :t="t"
          @signal-ready="$emit('signal-ready')"
          @abandon="$emit('abandon')"
        />
      </template>

      <template #overlay>
        <fusion-reveal
          v-if="state.fusionRevealQueue?.length"
          :key="state.fusionRevealQueue[0]?.id || state.fusionRevealQueue[0]?.recipeId || state.fusionRevealQueue.length"
          :reveal="state.fusionRevealQueue[0]"
          :state="state"
          :get-artifact="getArtifact"
          @done="$emit('fusion-reveal-complete')"
        />
      </template>
    </core-prep-screen>
  `
};
