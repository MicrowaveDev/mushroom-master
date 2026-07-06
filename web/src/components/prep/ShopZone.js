import {
  artifactPreviewOrientation,
  shapeShopItemRows
} from '@microwavedev/backpack-game-core/client-view-model';
import { ShopZone as CoreShopZone } from '@microwavedev/backpack-game-core/vue/components';
import { ArtifactGridBoard } from '../ArtifactGridBoard.js';
import { artifactVisualClassification } from '../../../../app/shared/artifact-visual-classification.js';

export const ShopZone = {
  name: 'ShopZone',
  components: { ArtifactGridBoard, CoreShopZone },
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
    },
    labels() {
      return {
        title: this.t?.shop,
        refresh: this.t?.refreshShop,
        refreshPricePrefix: '\uD83E\uDE99',
        pricePrefix: '\uD83E\uDE99 ',
        characterItem: this.t?.characterItem,
        bagSlots: this.t?.bagSlots
      };
    },
    refreshDisabled() {
      return (this.state.gameRun.player?.coins || 0) < this.runRefreshCost;
    },
    sellZone() {
      return {
        active: !!this.state.sellDragOver,
        draggingItemId: this.state.draggingArtifactId || '',
        priceLabel: this.runSellPriceLabel,
        pricePrefix: '\uD83E\uDE99',
        inactivePrefix: '\uD83D\uDCB0',
        inactiveText: this.t?.sellArea
      };
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
    <CoreShopZone
      :rows="shopItemRows"
      :labels="labels"
      :refresh-cost="runRefreshCost"
      :refresh-disabled="refreshDisabled"
      :row-class="offerClass"
      :item-attrs="itemDataset"
      :sell-zone="sellZone"
      @refresh="$emit('refresh-shop')"
      @buy="$emit('buy-run-item', $event.artifactId)"
      @sell-dragover="$emit('sell-dragover', $event)"
      @sell-dragleave="$emit('sell-dragleave')"
      @sell-drop="$emit('sell-drop', $event)"
    >
      <template #visual="{ row }">
        <artifact-grid-board
          class="shop-item-visual"
          variant="catalog"
          :columns="row.previewOrientation.width"
          :rows="row.previewOrientation.height"
          :items="row.previewItem"
          :get-artifact="getArtifact"
        />
      </template>
    </CoreShopZone>
  `
};
