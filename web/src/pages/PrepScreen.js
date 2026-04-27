import { BAG_COLUMNS, BAG_ROWS } from '../constants.js';
import { getEffectiveShape, normalizeRotation } from '../../../app/shared/bag-shape.js';
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
    'signal-ready', 'abandon', 'deactivate-bag', 'rotate-bag', 'bag-chip-drag-start'
  ],
  components: {
    RunHud,
    BackpackZone,
    InventoryZone,
    ShopZone,
    PrepActions
  },
  computed: {
    // Bag background metadata in unified-grid coords: ONE entry per (bag ×
    // unified row) — each bag emits its own row entries with its own colour
    // and enabledCells. Two bags whose footprints share the same row produce
    // TWO entries so ArtifactGridBoard can colour each bag's cells correctly
    // (its per-cell lookup picks the entry whose enabledCells contain the
    // cell's x).
    bagRows() {
      const rows = [];
      for (const activeBag of this.state.activeBags) {
        const bag = this.getArtifact(activeBag.artifactId);
        if (!bag) continue;
        const rotationEntry = this.state.rotatedBags.find((b) => b.id === activeBag.id);
        const shape = getEffectiveShape(bag, normalizeRotation(rotationEntry?.rotation ?? (rotationEntry ? 1 : 0)));
        const rowCount = shape.length;
        const anchorX = activeBag.anchorX ?? 0;
        const anchorY = activeBag.anchorY ?? 0;
        for (let i = 0; i < rowCount; i++) {
          const maskRow = shape[i] || [];
          const enabledCells = [];
          for (let x = 0; x < maskRow.length; x++) {
            const cellX = anchorX + x;
            if (cellX >= BAG_COLUMNS) break;
            if (maskRow[x]) enabledCells.push(cellX);
          }
          if (enabledCells.length === 0) continue;
          // Bounding-box x-range for this row. Used by ArtifactGridBoard to
          // distinguish "empty bag-area cell outside any bag" (rendered as a
          // faint drop target) from "mask gap inside a tetromino bag's bbox"
          // (rendered hidden). Without this, cells past a rectangular bag's
          // right edge in the same row would be mis-classified as gaps and
          // disappear — see bag-grid-unification bag-row-width bug.
          const bboxStart = anchorX;
          const bboxEnd = Math.min(anchorX + maskRow.length, BAG_COLUMNS);
          rows.push({
            row: anchorY + i,
            color: bag.color || '#888',
            artifactId: activeBag.artifactId,
            enabledCells,
            bboxStart,
            bboxEnd
          });
        }
      }
      return rows.sort((a, b) => a.row - b.row);
    },
    // Total rows in the unified grid: at least BAG_ROWS (= 6) so the rendered
    // grid is always 6×6, expanding further if an active bag's footprint
    // extends below row BAG_ROWS - 1. InventoryZone forwards this to
    // ArtifactGridBoard.
    totalRows() {
      let max = BAG_ROWS;
      for (const activeBag of this.state.activeBags) {
        const bag = this.getArtifact(activeBag.artifactId);
        if (!bag) continue;
        const rotationEntry = this.state.rotatedBags.find((b) => b.id === activeBag.id);
        const shape = getEffectiveShape(bag, normalizeRotation(rotationEntry?.rotation ?? (rotationEntry ? 1 : 0)));
        const bottom = (activeBag.anchorY ?? 0) + shape.length;
        if (bottom > max) max = bottom;
      }
      return max;
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
      <div class="prep-topbar">
        <h2 class="run-round-heading">{{ t.round }} {{ state.gameRun.currentRound }}</h2>
        <run-hud :state="state" :t="t" />
      </div>

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
            :total-rows="totalRows"
            :bag-rows="bagRows"
            :get-artifact="getArtifact"
            @unplace="$emit('unplace', $event)"
            @rotate="$emit('rotate', $event)"
            @cell-drop="$emit('cell-drop', $event)"
            @inventory-drag-start="$emit('inventory-drag-start', $event)"
            @drag-end="$emit('drag-end')"
            @deactivate-bag="$emit('deactivate-bag', $event)"
            @rotate-bag="$emit('rotate-bag', $event)"
            @bag-chip-drag-start="$emit('bag-chip-drag-start', $event)"
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
