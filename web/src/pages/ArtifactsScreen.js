import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';

export const ArtifactsScreen = {
  name: 'ArtifactsScreen',
  props: [
    'state', 't', 'remainingCoins', 'builderTotals',
    'shopArtifacts', 'containerArtifacts',
    'renderArtifactFigure', 'getArtifact', 'getArtifactPrice',
    'formatArtifactBonus', 'preferredOrientation'
  ],
  emits: [
    'buy', 'return-to-shop', 'auto-place', 'unplace', 'rotate',
    'save-loadout', 'reroll',
    'container-dragover', 'container-drop', 'container-drag-start',
    'shop-dragover', 'shop-drop', 'shop-drag-start',
    'cell-drop', 'inventory-drag-start', 'drag-end'
  ],
  components: {
    ArtifactGridBoard: defineAsyncComponent(() => import('../components/ArtifactGridBoard.js').then(m => m.ArtifactGridBoard))
  },
  template: `
    <section class="artifact-screen">
      <div class="artifact-header-row">
        <h2>{{ t.artifacts }}</h2>
        <div class="coin-hud"><span class="coin-hud-label">{{ remainingCoins }}</span></div>
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
            <button class="container-item-sell" type="button"
              @click.stop="$emit('return-to-shop', artifact.id)"
            >{{ state.lang === 'ru' ? 'Вернуть' : 'Return' }}</button>
            <artifact-grid-board
              class="container-item-visual" variant="catalog"
              :columns="preferredOrientation(artifact).width"
              :rows="preferredOrientation(artifact).height"
              :items="[{ artifactId: artifact.id, x: 0, y: 0, width: preferredOrientation(artifact).width, height: preferredOrientation(artifact).height }]"
              :render-artifact-figure="renderArtifactFigure"
              :get-artifact="getArtifact"
            />
            <div class="container-item-copy">
              <strong>{{ artifact.name[state.lang] }}</strong>
              <span class="artifact-stat-chips">
                <span v-for="stat in formatArtifactBonus(artifact)" :key="stat.key"
                  class="artifact-stat-chip" :class="stat.positive ? 'artifact-stat-chip--pos' : 'artifact-stat-chip--neg'"
                >{{ stat.label }} {{ stat.value }}</span>
              </span>
            </div>
          </div>
        </div>
        <p v-else class="artifact-container-empty">{{ t.containerHint }}</p>
      </div>

      <div class="artifact-inventory-section panel">
        <div class="artifact-inventory-header">
          <strong>{{ t.inventory }}</strong>
          <span v-if="state.builderItems.length" class="artifact-inventory-badge">{{ state.builderItems.length }}</span>
        </div>
        <artifact-grid-board
          variant="inventory" class="inventory-shell artifact-inventory-grid"
          :items="state.builderItems"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          :clickable-pieces="true" :rotatable-pieces="true" :droppable="true" :draggable-pieces="true"
          @piece-click="$emit('unplace', $event.artifactId)"
          @piece-rotate="$emit('rotate', $event)"
          @cell-drop="$emit('cell-drop', $event)"
          @piece-drag-start="$emit('inventory-drag-start', $event)"
          @piece-drag-end="$emit('drag-end')"
        />
        <div v-if="state.builderItems.length" class="artifact-inventory-footer">
          <span class="artifact-inventory-stats">+{{ builderTotals.damage }} DMG / +{{ builderTotals.armor }} ARM / +{{ builderTotals.speed }} SPD / +{{ builderTotals.stunChance }}% STUN</span>
          <button class="primary" @click="$emit('save-loadout')">{{ t.save }}</button>
        </div>
        <p v-else class="artifact-inventory-hint">{{ t.selectCell }}</p>
      </div>

      <div class="artifact-shop"
        @dragover="$emit('shop-dragover', $event)"
        @drop="$emit('shop-drop', $event)"
        @dragend="$emit('drag-end')"
      >
        <div class="artifact-shop-header">
          <strong>{{ t.shop }}</strong>
          <button type="button" class="link" :disabled="remainingCoins < 1" @click="$emit('reroll', false)">{{ t.reroll }} (1)</button>
        </div>
        <div class="artifact-shop-items">
          <div
            v-for="artifact in shopArtifacts" :key="artifact.id"
            class="shop-item"
            :class="{ 'shop-item--expensive': getArtifactPrice(artifact) > remainingCoins }"
            :draggable="getArtifactPrice(artifact) <= remainingCoins"
            @click="$emit('buy', artifact.id)"
            @dragstart="$emit('shop-drag-start', artifact.id, $event)"
            @dragend="$emit('drag-end')"
            :data-artifact-id="artifact.id"
          >
            <artifact-grid-board
              class="shop-item-visual" variant="catalog"
              :columns="preferredOrientation(artifact).width"
              :rows="preferredOrientation(artifact).height"
              :items="[{ artifactId: artifact.id, x: 0, y: 0, width: preferredOrientation(artifact).width, height: preferredOrientation(artifact).height }]"
              :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
            />
            <div class="shop-item-copy">
              <strong>{{ artifact.name[state.lang] }}</strong>
              <span class="shop-item-price">{{ getArtifactPrice(artifact) }}</span>
              <span class="artifact-stat-chips">
                <span v-for="stat in formatArtifactBonus(artifact)" :key="stat.key"
                  class="artifact-stat-chip" :class="stat.positive ? 'artifact-stat-chip--pos' : 'artifact-stat-chip--neg'"
                >{{ stat.label }} {{ stat.value }}</span>
              </span>
            </div>
          </div>
          <div v-if="!shopArtifacts.length" class="shop-empty">{{ t.shop }}</div>
        </div>
      </div>
    </section>
  `
};
