import { ArtifactGridBoard } from '../ArtifactGridBoard.js';
import { SellZone } from './SellZone.js';

export const ShopZone = {
  name: 'ShopZone',
  components: { ArtifactGridBoard, SellZone },
  props: [
    'state', 't', 'runRefreshCost', 'runSellPriceLabel', 'getArtifact',
    'getArtifactPrice', 'preferredOrientation', 'formatArtifactBonus'
  ],
  emits: ['buy-run-item', 'refresh-shop', 'sell-dragover', 'sell-dragleave', 'sell-drop'],
  methods: {
    canAfford(artifactId) {
      return this.getArtifactPrice(this.getArtifact(artifactId)) <= (this.state.gameRun.player?.coins || 0);
    },
    offerClass(artifactId) {
      const artifact = this.getArtifact(artifactId);
      const price = this.getArtifactPrice(artifact);
      return {
        'shop-item--expensive': price > (this.state.gameRun.player?.coins || 0),
        'shop-item--bag': artifact?.family === 'bag',
        'shop-item--tier2': price === 2 && artifact?.family !== 'bag',
        'shop-item--tier3': price >= 3
      };
    },
    previewItem(artifactId) {
      const orientation = this.preferredOrientation(this.getArtifact(artifactId));
      return [{ artifactId, x: 0, y: 0, width: orientation.width, height: orientation.height }];
    },
    itemDataset(artifactId) {
      const orientation = this.preferredOrientation(this.getArtifact(artifactId));
      return {
        'data-artifact-id': artifactId,
        'data-artifact-width': orientation.width,
        'data-artifact-height': orientation.height,
        'aria-disabled': this.canAfford(artifactId) ? null : 'true'
      };
    }
  },
  template: `
    <div class="artifact-shop">
      <div class="artifact-shop-header">
        <strong>{{ t.shop }}</strong>
        <button type="button" class="link" :disabled="(state.gameRun.player?.coins || 0) < runRefreshCost" @click="$emit('refresh-shop')">{{ t.refreshShop }} (🪙{{ runRefreshCost }})</button>
      </div>
      <div class="artifact-shop-items">
        <div
          v-for="artifactId in state.gameRunShopOffer"
          :key="artifactId"
          class="shop-item"
          :data-artifact-draggable="canAfford(artifactId) ? 'true' : 'false'"
          v-bind="itemDataset(artifactId)"
          :class="offerClass(artifactId)"
          @click="$emit('buy-run-item', artifactId)"
        >
          <div class="shop-item-header">
            <strong class="shop-item-name">{{ getArtifact(artifactId)?.name?.[state.lang] }}</strong>
            <span class="shop-item-price">🪙 {{ getArtifactPrice(getArtifact(artifactId)) }}</span>
          </div>
          <artifact-grid-board
            class="shop-item-visual"
            variant="catalog"
            :columns="preferredOrientation(getArtifact(artifactId)).width"
            :rows="preferredOrientation(getArtifact(artifactId)).height"
            :items="previewItem(artifactId)"
            :get-artifact="getArtifact"
          />
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
      <sell-zone
        :state="state"
        :t="t"
        :run-sell-price-label="runSellPriceLabel"
        @sell-dragover="$emit('sell-dragover', $event)"
        @sell-dragleave="$emit('sell-dragleave')"
        @sell-drop="$emit('sell-drop', $event)"
      />
    </div>
  `
};
