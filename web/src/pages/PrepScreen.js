import { INVENTORY_ROWS, INVENTORY_COLUMNS } from '../constants.js';
import { getEffectiveShape } from '../../../app/shared/bag-shape.js';
import { RunHud } from '../components/prep/RunHud.js';
import { BackpackZone } from '../components/prep/BackpackZone.js';
import { InventoryZone } from '../components/prep/InventoryZone.js';
import { ShopZone } from '../components/prep/ShopZone.js';
import { PrepActions } from '../components/prep/PrepActions.js';

export const PrepScreen = {
  name: 'PrepScreen',
  props: [
    'state', 't', 'containerArtifacts', 'builderTotals',
    'renderArtifactFigure', 'getArtifact', 'formatArtifactBonus',
    'preferredOrientation', 'getArtifactPrice', 'effectiveRows'
  ],
  emits: [
    'auto-place', 'container-drag-start', 'drag-end',
    'container-dragover', 'container-drop',
    'unplace', 'rotate', 'cell-drop', 'inventory-drag-start',
    'buy-run-item', 'refresh-shop',
    'sell-dragover', 'sell-dragleave', 'sell-drop',
    'signal-ready', 'abandon', 'deactivate-bag', 'rotate-bag'
  ],
  components: {
    RunHud,
    BackpackZone,
    InventoryZone,
    ShopZone,
    PrepActions
  },
  computed: {
    bagRows() {
      const rows = [];
      let r = INVENTORY_ROWS;
      for (const activeBag of this.state.activeBags) {
        const bag = this.getArtifact(activeBag.artifactId);
        if (!bag) continue;
        const rotated = this.state.rotatedBags.some((b) => b.id === activeBag.id);
        const shape = getEffectiveShape(bag, rotated);
        const rowCount = shape.length;
        for (let i = 0; i < rowCount; i++) {
          const maskRow = shape[i] || [];
          // enabledCells = the x positions inside this bag row that are
          // part of the bag's shape mask. For rectangular bags this is
          // [0, 1, ..., cols-1]; for tetrominoes it skips the empty
          // cells of the bounding box.
          const enabledCells = [];
          for (let x = 0; x < maskRow.length && x < INVENTORY_COLUMNS; x++) {
            if (maskRow[x]) enabledCells.push(x);
          }
          rows.push({
            row: r + i,
            color: bag.color || '#888',
            artifactId: activeBag.artifactId,
            enabledCells
          });
        }
        r += rowCount;
      }
      return rows;
    },
    runRefreshCost() {
      return this.state.gameRunRefreshCount < 3 ? 1 : 2;
    },
    runSellPriceLabel() {
      if (!this.state.sellDragOver || !this.state.draggingArtifactId) return '';
      const artifact = this.getArtifact(this.state.draggingArtifactId);
      if (!artifact) return '';
      const price = this.getArtifactPrice(artifact);
      const isFresh = this.state.freshPurchases.includes(this.state.draggingArtifactId);
      return String(isFresh ? price : Math.floor(price / 2));
    }
  },
  template: `
    <section class="prep-screen" :data-testid="state.bootstrapReady ? 'prep-ready' : null">
      <h2 class="run-round-heading">{{ t.round }} {{ state.gameRun.currentRound }}</h2>
      <run-hud :state="state" :t="t" />

      <div class="prep-workspace">
        <div class="prep-loadout-column">
          <backpack-zone
            :state="state"
            :t="t"
            :container-artifacts="containerArtifacts"
            :get-artifact="getArtifact"
            :format-artifact-bonus="formatArtifactBonus"
            :preferred-orientation="preferredOrientation"
            @auto-place="$emit('auto-place', $event)"
            @container-dragover="$emit('container-dragover', $event)"
            @container-drop="$emit('container-drop', $event)"
          />

          <inventory-zone
            :state="state"
            :t="t"
            :builder-totals="builderTotals"
            :effective-rows="effectiveRows"
            :bag-rows="bagRows"
            :get-artifact="getArtifact"
            @unplace="$emit('unplace', $event)"
            @rotate="$emit('rotate', $event)"
            @cell-drop="$emit('cell-drop', $event)"
            @inventory-drag-start="$emit('inventory-drag-start', $event)"
            @drag-end="$emit('drag-end')"
            @deactivate-bag="$emit('deactivate-bag', $event)"
            @rotate-bag="$emit('rotate-bag', $event)"
          />
        </div>

        <shop-zone
          :state="state"
          :t="t"
          :run-refresh-cost="runRefreshCost"
          :run-sell-price-label="runSellPriceLabel"
          :get-artifact="getArtifact"
          :get-artifact-price="getArtifactPrice"
          :preferred-orientation="preferredOrientation"
          :format-artifact-bonus="formatArtifactBonus"
          @buy-run-item="$emit('buy-run-item', $event)"
          @refresh-shop="$emit('refresh-shop')"
          @sell-dragover="$emit('sell-dragover', $event)"
          @sell-dragleave="$emit('sell-dragleave')"
          @sell-drop="$emit('sell-drop', $event)"
        />
      </div>

      <div v-if="state.gameRun.mode === 'challenge' && state.sseConnected === false" class="prep-reconnecting" data-testid="sse-reconnecting">
        {{ t.reconnecting }}
      </div>

      <prep-actions
        :state="state"
        :t="t"
        @signal-ready="$emit('signal-ready')"
        @abandon="$emit('abandon')"
      />
    </section>
  `
};
