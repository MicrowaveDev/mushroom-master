import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';

export const PrepScreen = {
  name: 'PrepScreen',
  props: [
    'state', 't', 'containerArtifacts', 'builderTotals',
    'renderArtifactFigure', 'getArtifact', 'formatArtifactBonus',
    'preferredOrientation', 'getArtifactPrice'
  ],
  emits: [
    'auto-place', 'container-drag-start', 'drag-end',
    'container-dragover', 'container-drop',
    'unplace', 'rotate', 'cell-drop', 'inventory-drag-start',
    'buy-run-item', 'refresh-shop',
    'sell-dragover', 'sell-dragleave', 'sell-drop',
    'signal-ready', 'abandon'
  ],
  components: {
    ArtifactGridBoard: defineAsyncComponent(() => import('../components/ArtifactGridBoard.js').then(m => m.ArtifactGridBoard))
  },
  computed: {
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
    <section class="prep-screen">
      <div class="run-hud">
        <span class="run-hud-item">{{ t.round }} {{ state.gameRun.currentRound }}</span>
        <span class="run-hud-item">{{ t.wins }}: {{ state.gameRun.player?.wins || 0 }}</span>
        <span class="run-hud-item">{{ t.lives }}: {{ state.gameRun.player?.livesRemaining || 0 }}</span>
        <span class="run-hud-item run-hud-coins">\uD83E\uDE99 {{ state.gameRun.player?.coins || 0 }}</span>
      </div>

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
            :key="artifact.id"
            class="container-item"
            draggable="true"
            @click="$emit('auto-place', artifact.id)"
            @dragstart="$emit('container-drag-start', artifact.id, $event)"
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
          :items="state.builderItems"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
          :clickable-pieces="true"
          :rotatable-pieces="true"
          :droppable="true"
          :draggable-pieces="true"
          @piece-click="$emit('unplace', $event.artifactId)"
          @piece-rotate="$emit('rotate', $event)"
          @cell-drop="$emit('cell-drop', $event)"
          @piece-drag-start="$emit('inventory-drag-start', $event)"
          @piece-drag-end="$emit('drag-end')"
        />
        <div v-if="state.builderItems.length" class="artifact-inventory-footer">
          <span class="artifact-inventory-stats">+{{ builderTotals.damage }} DMG / +{{ builderTotals.armor }} ARM / +{{ builderTotals.speed }} SPD / +{{ builderTotals.stunChance }}% STUN</span>
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
            :class="{
              'shop-item--expensive': getArtifactPrice(getArtifact(artifactId)) > (state.gameRun.player?.coins || 0),
              'shop-item--bag': getArtifact(artifactId)?.family === 'bag'
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
          <span v-if="state.sellDragOver && state.draggingArtifactId" class="sell-zone-price">{{ runSellPriceLabel }}</span>
          <span v-else>{{ t.sellArea }}</span>
        </div>
      </div>

      <div class="prep-actions">
        <div v-if="state.gameRun.mode === 'challenge'" class="prep-opponent-status">
          <span v-if="state.opponentReady" class="prep-opponent-ready">{{ t.opponentReady }}</span>
          <span v-else class="prep-opponent-waiting">{{ t.waitingForOpponent }}</span>
        </div>
        <button class="primary prep-ready-btn" :disabled="state.actionInFlight" @click="$emit('signal-ready')">{{ t.ready }}</button>
        <button class="ghost" @click="$emit('abandon')">{{ t.abandonRun }}</button>
      </div>
    </section>
  `
};
