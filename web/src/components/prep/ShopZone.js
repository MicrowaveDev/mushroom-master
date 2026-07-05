import {
  artifactPreviewOrientation,
  shapeShopItemRows
} from '@microwavedev/backpack-game-core/client-view-model';
import { ArtifactGridBoard } from '../ArtifactGridBoard.js';
import { SellZone } from './SellZone.js';
import { artifactVisualClassification } from '../../../../app/shared/artifact-visual-classification.js';

export const ShopZone = {
  name: 'ShopZone',
  components: { ArtifactGridBoard, SellZone },
  props: [
    'state', 't', 'runRefreshCost', 'runSellPriceLabel', 'getArtifact',
    'getArtifactPrice', 'preferredOrientation', 'formatArtifactBonus',
    'fusionCandidateShopArtifactIds'
  ],
  emits: ['buy-run-item', 'refresh-shop', 'sell-dragover', 'sell-dragleave', 'sell-drop'],
  computed: {
    shopItemRows() {
      return shapeShopItemRows({
        offer: this.state.gameRunShopOffer,
        getArtifact: this.getArtifact,
        getArtifactPrice: this.getArtifactPrice,
        availableBudget: this.state.gameRun.player?.coins || 0,
        formatArtifactBonus: this.formatArtifactBonus
      }).map((row) => ({
        ...row,
        name: this.artifactName(row.artifact),
        description: this.artifactDescription(row.artifact)
      }));
    }
  },
  methods: {
    artifactName(artifact) {
      const name = artifact?.name;
      if (!name) return '';
      if (typeof name === 'string') return name;
      return name[this.state.lang] || name.en || name.ru || '';
    },
    canAfford(rowOrArtifactId) {
      if (rowOrArtifactId && typeof rowOrArtifactId === 'object') return rowOrArtifactId.canAfford;
      return this.getArtifactPrice(this.getArtifact(rowOrArtifactId)) <= (this.state.gameRun.player?.coins || 0);
    },
    offerClass(row) {
      const artifact = row?.artifact || this.getArtifact(row);
      const artifactId = row?.artifactId || row;
      const price = row?.price ?? this.getArtifactPrice(artifact);
      const visual = artifactVisualClassification(artifact);
      return {
        'shop-item--expensive': row?.unavailable ?? price > (this.state.gameRun.player?.coins || 0),
        'shop-item--bag': artifact?.family === 'bag',
        'shop-item--tier2': price === 2 && artifact?.family !== 'bag',
        'shop-item--tier3': price >= 3,
        'shop-item--fusion-candidate': this.isFusionCandidate(artifactId),
        [`shop-item--role-${visual.role.id}`]: true,
        [`shop-item--shine-${visual.shine.id}`]: true
      };
    },
    isFusionCandidate(artifactId) {
      return !!artifactId && this.fusionCandidateShopArtifactIds?.has?.(artifactId);
    },
    previewOrientation(rowOrArtifactId) {
      if (rowOrArtifactId && typeof rowOrArtifactId === 'object') return rowOrArtifactId.previewOrientation;
      const artifact = this.getArtifact(rowOrArtifactId);
      return artifactPreviewOrientation(artifact);
    },
    previewItem(rowOrArtifactId) {
      if (rowOrArtifactId && typeof rowOrArtifactId === 'object') return rowOrArtifactId.previewItem;
      const orientation = this.previewOrientation(rowOrArtifactId);
      return [{ artifactId: rowOrArtifactId, x: 0, y: 0, width: orientation.width, height: orientation.height }];
    },
    artifactDescription(rowOrArtifactId) {
      const artifact = rowOrArtifactId && typeof rowOrArtifactId === 'object'
        ? (rowOrArtifactId.artifact || rowOrArtifactId)
        : this.getArtifact(rowOrArtifactId);
      const description = artifact?.description;
      if (!description) return '';
      return description[this.state.lang] || description.en || description.ru || '';
    },
    itemDataset(row) {
      const artifactId = row?.artifactId || row;
      const orientation = this.previewOrientation(row);
      return {
        'data-artifact-id': artifactId,
        'data-fusion-candidate': this.isFusionCandidate(artifactId) ? 'true' : null,
        'data-artifact-width': orientation.width,
        'data-artifact-height': orientation.height,
        'aria-disabled': this.canAfford(row) ? null : 'true',
        title: this.isFusionCandidate(artifactId) ? (this.t?.fusionCandidateHint || this.t?.recipes) : null
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
          v-for="row in shopItemRows"
          :key="row.id"
          class="shop-item"
          :data-artifact-draggable="row.canAfford ? 'true' : 'false'"
          v-bind="itemDataset(row)"
          :class="offerClass(row)"
          @click="$emit('buy-run-item', row.artifactId)"
        >
          <div class="shop-item-header">
            <strong class="shop-item-name">{{ row.name }}</strong>
            <span class="shop-item-price">🪙 {{ row.price }}</span>
          </div>
          <artifact-grid-board
            class="shop-item-visual"
            variant="catalog"
            :columns="row.previewOrientation.width"
            :rows="row.previewOrientation.height"
            :items="row.previewItem"
            :get-artifact="getArtifact"
          />
          <p v-if="row.description" class="shop-item-description">{{ row.description }}</p>
          <div class="shop-item-tags">
            <span v-if="row.characterItem" class="artifact-stat-chip artifact-stat-chip--character">{{ t.characterItem }}</span>
            <span v-if="row.isBag" class="artifact-stat-chip artifact-stat-chip--bag">{{ row.slotCount }} {{ t.bagSlots }}</span>
            <span
              v-for="stat in row.statRows"
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
