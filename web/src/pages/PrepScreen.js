import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';
import { INVENTORY_ROWS, INVENTORY_COLUMNS } from '../constants.js';
import { getEffectiveShape } from '../../../app/shared/bag-shape.js';

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
    ArtifactGridBoard: defineAsyncComponent(() => import('../components/ArtifactGridBoard.js').then(m => m.ArtifactGridBoard))
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
      <div class="run-hud">
        <span class="run-hud-item">{{ t.wins }}: {{ state.gameRun.player?.wins || 0 }}</span>
        <span class="run-hud-item">{{ t.lives }}: {{ state.gameRun.player?.livesRemaining || 0 }}</span>
        <span class="run-hud-item run-hud-coins">\uD83E\uDE99 {{ state.gameRun.player?.coins || 0 }}</span>
      </div>

      <div class="prep-workspace">
        <div class="prep-loadout-column">
          <div class="artifact-container-zone"
            @dragover="$emit('container-dragover', $event)"
            @drop="$emit('container-drop', $event)"
          >
            <div class="artifact-container-header">
              <strong>{{ t.container }}</strong>
              <span v-if="containerArtifacts.length" class="artifact-container-count">{{ containerArtifacts.length }}</span>
            </div>
            <div v-if="containerArtifacts.length" class="artifact-container-items">
              <div
                v-for="artifact in containerArtifacts"
                :key="artifact.instanceKey"
                class="container-item"
                draggable="true"
                @click="$emit('auto-place', artifact.id)"
                @dragstart="$emit('container-drag-start', { artifactId: artifact.id, rowId: artifact.rowId }, $event)"
                @dragend="$emit('drag-end')"
                :data-artifact-id="artifact.id"
              >
                <artifact-grid-board
                  class="container-item-visual"
                  variant="catalog"
                  :columns="preferredOrientation(artifact).width"
                  :rows="preferredOrientation(artifact).height"
                  :items="[{ artifactId: artifact.id, x: 0, y: 0, width: preferredOrientation(artifact).width, height: preferredOrientation(artifact).height }]"
                  :render-artifact-figure="renderArtifactFigure"
                  :get-artifact="getArtifact"
                />
                <div class="container-item-copy">
                  <strong>{{ artifact.name[state.lang] }}</strong>
                  <span v-if="artifact.family === 'bag'" class="artifact-stat-chip artifact-stat-chip--bag">{{ artifact.slotCount }} {{ t.bagSlots }}</span>
                  <span class="artifact-stat-chips">
                    <span
                      v-for="stat in formatArtifactBonus(artifact)"
                      :key="stat.key"
                      class="artifact-stat-chip"
                      :class="stat.positive ? 'artifact-stat-chip--pos' : 'artifact-stat-chip--neg'"
                    >{{ stat.label }} {{ stat.value }}</span>
                  </span>
                </div>
              </div>
            </div>
            <p v-else class="artifact-container-empty">{{ t.containerHint }}</p>
          </div>

          <div class="artifact-inventory-section panel">
            <artifact-grid-board
              variant="inventory"
              class="inventory-shell artifact-inventory-grid"
              :rows="effectiveRows"
              :items="state.builderItems"
              :bag-rows="bagRows"
              :render-artifact-figure="renderArtifactFigure"
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
        </div>

        <div class="artifact-shop">
          <div class="artifact-shop-header">
            <strong>{{ t.shop }}</strong>
            <button type="button" class="link" :disabled="(state.gameRun.player?.coins || 0) < runRefreshCost" @click="$emit('refresh-shop')">{{ t.refreshShop }} (\uD83E\uDE99{{ runRefreshCost }})</button>
          </div>
          <div class="artifact-shop-items">
            <div
              v-for="artifactId in state.gameRunShopOffer"
              :key="artifactId"
              class="shop-item"
              :data-artifact-id="artifactId"
              :class="{
                'shop-item--expensive': getArtifactPrice(getArtifact(artifactId)) > (state.gameRun.player?.coins || 0),
                'shop-item--bag': getArtifact(artifactId)?.family === 'bag',
                'shop-item--tier2': getArtifactPrice(getArtifact(artifactId)) === 2 && getArtifact(artifactId)?.family !== 'bag',
                'shop-item--tier3': getArtifactPrice(getArtifact(artifactId)) >= 3
              }"
              :draggable="getArtifactPrice(getArtifact(artifactId)) <= (state.gameRun.player?.coins || 0)"
              @click="$emit('buy-run-item', artifactId)"
            >
              <artifact-grid-board
                class="shop-item-visual"
                variant="catalog"
                :columns="preferredOrientation(getArtifact(artifactId)).width"
                :rows="preferredOrientation(getArtifact(artifactId)).height"
                :items="[{ artifactId, x: 0, y: 0, width: preferredOrientation(getArtifact(artifactId)).width, height: preferredOrientation(getArtifact(artifactId)).height }]"
                :render-artifact-figure="renderArtifactFigure"
                :get-artifact="getArtifact"
              />
              <div class="shop-item-copy">
                <div class="shop-item-header">
                  <strong class="shop-item-name">{{ getArtifact(artifactId)?.name?.[state.lang] }}</strong>
                  <span class="shop-item-price">\uD83E\uDE99 {{ getArtifactPrice(getArtifact(artifactId)) }}</span>
                </div>
                <div class="shop-item-tags">
                  <span v-if="getArtifact(artifactId)?.characterItem" class="artifact-stat-chip artifact-stat-chip--character">{{ t.characterItem }}</span>
                  <span v-if="getArtifact(artifactId)?.family === 'bag'" class="artifact-stat-chip artifact-stat-chip--bag">{{ getArtifact(artifactId)?.slotCount }} {{ t.bagSlots }}</span>
                  <span
                    v-for="stat in formatArtifactBonus(getArtifact(artifactId))"
                    :key="stat.key"
                    class="artifact-stat-chip"
                    :class="stat.positive ? 'artifact-stat-chip--pos' : 'artifact-stat-chip--neg'"
                  >{{ stat.label }} {{ stat.value }}</span>
                </div>
              </div>
            </div>
          </div>
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
        </div>
      </div>

      <div v-if="state.gameRun.mode === 'challenge' && state.sseConnected === false" class="prep-reconnecting" data-testid="sse-reconnecting">
        {{ t.reconnecting }}
      </div>

      <div class="prep-actions">
        <div v-if="state.gameRun.mode === 'challenge'" class="prep-opponent-status">
          <span v-if="state.opponentReady" class="prep-opponent-ready">{{ t.opponentReady }}</span>
          <span v-else class="prep-opponent-waiting">{{ t.waitingForOpponent }}</span>
        </div>
        <button class="primary prep-ready-btn" :disabled="state.actionInFlight" @click="$emit('signal-ready')">{{ state.actionInFlight ? t.readying : t.ready }}</button>
        <button class="ghost" @click="$emit('abandon')">{{ t.abandonRun }}</button>
      </div>
    </section>
  `
};
