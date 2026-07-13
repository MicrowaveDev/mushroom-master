import { artifactPreviewOrientation } from '@microwavedev/backpack-game-core/client-view-model';
import { ArtifactCatalogBrowser as CoreArtifactCatalogBrowser } from '@microwavedev/backpack-game-core/vue/components';
import { artifactFusionRecipes } from '../../../app/shared/artifact-fusions.js';
import { ArtifactGridBoard } from './ArtifactGridBoard.js';
import { ArtifactStatSummary } from './ArtifactStatSummary.js';

function artifactDisplayName(artifact, lang) {
  return artifact?.name?.[lang] || artifact?.name?.en || artifact?.id || '';
}

function canPlace(cells, x, y, width, height, columns) {
  if (x + width > columns) return false;
  for (let cy = y; cy < y + height; cy += 1) {
    for (let cx = x; cx < x + width; cx += 1) {
      if (cells.has(`${cx}:${cy}`)) return false;
    }
  }
  return true;
}

function markPlaced(cells, x, y, width, height) {
  for (let cy = y; cy < y + height; cy += 1) {
    for (let cx = x; cx < x + width; cx += 1) {
      cells.add(`${cx}:${cy}`);
    }
  }
}

const MIN_GROUP_COLUMNS = 6;
const MAX_GROUP_COLUMNS = 18;

export const ArtifactCatalogBrowser = {
  name: 'ArtifactCatalogBrowser',
  components: { ArtifactGridBoard, ArtifactStatSummary, CoreArtifactCatalogBrowser },
  props: {
    state: { type: Object, required: true },
    t: { type: Object, required: true },
    getArtifact: { type: Function, required: true }
  },
  data() {
    return {
      selectedArtifactId: '',
      groupBoardColumns: MIN_GROUP_COLUMNS
    };
  },
  computed: {
    recipes() {
      return artifactFusionRecipes
        .map((recipe) => this.recipeView(recipe))
        .filter(Boolean);
    },
    recipeByResultId() {
      const map = new Map();
      for (const recipe of this.recipes) {
        map.set(recipe.resultArtifactId, recipe);
      }
      return map;
    },
    artifacts() {
      const source = Array.isArray(this.state.bootstrap?.artifacts)
        ? this.state.bootstrap.artifacts
        : [];
      return [...source].sort((a, b) => {
        const familyOrder = this.familyOrder(a) - this.familyOrder(b);
        if (familyOrder !== 0) return familyOrder;
        return artifactDisplayName(a, this.state.lang).localeCompare(
          artifactDisplayName(b, this.state.lang),
          this.state.lang === 'ru' ? 'ru' : 'en'
        );
      });
    },
    activeArtifactId() {
      if (this.artifacts.some((artifact) => artifact.id === this.selectedArtifactId)) {
        return this.selectedArtifactId;
      }
      return '';
    },
    selectedArtifact() {
      return this.artifacts.find((artifact) => artifact.id === this.activeArtifactId) || null;
    },
    selectedRecipe() {
      return this.selectedArtifact ? this.recipeByResultId.get(this.selectedArtifact.id) || null : null;
    },
    selectedRecipeIngredients() {
      return this.selectedRecipe?.ingredients || [];
    },
    selectedPreviewItem() {
      return this.selectedArtifact ? this.previewItem(this.selectedArtifact) : [];
    },
    selectedOrientation() {
      return this.previewOrientation(this.selectedArtifact);
    },
    selectedDescription() {
      return this.artifactDescription(this.selectedArtifact);
    },
    artifactGroups() {
      const definitions = [
        {
          id: 'fusion',
          label: this.t.artifactGroupFusion,
          matches: (artifact) => this.recipeByResultId.has(artifact.id)
        },
        {
          id: 'damage',
          label: this.t.artifactFamily_damage,
          matches: (artifact) => artifact.family === 'damage' && !this.recipeByResultId.has(artifact.id) && !artifact.characterItem && !artifact.starterOnly
        },
        {
          id: 'armor',
          label: this.t.artifactFamily_armor,
          matches: (artifact) => artifact.family === 'armor' && !this.recipeByResultId.has(artifact.id) && !artifact.characterItem && !artifact.starterOnly
        },
        {
          id: 'stun',
          label: this.t.artifactFamily_stun,
          matches: (artifact) => artifact.family === 'stun' && !this.recipeByResultId.has(artifact.id) && !artifact.characterItem && !artifact.starterOnly
        },
        {
          id: 'character',
          label: this.t.artifactGroupCharacter,
          matches: (artifact) => !!artifact.characterItem
        },
        {
          id: 'starter',
          label: this.t.artifactGroupStarter,
          matches: (artifact) => !!artifact.starterOnly && artifact.family !== 'bag'
        },
        {
          id: 'bag',
          label: this.t.artifactFamily_bag,
          matches: (artifact) => artifact.family === 'bag'
        }
      ];

      return definitions
        .map((definition) => this.buildGroup(
          definition.id,
          definition.label,
          this.artifacts.filter(definition.matches),
          this.groupBoardColumns
        ))
        .filter((group) => group.artifacts.length);
    },
    selectedRowIds() {
      return this.selectedArtifactId ? new Set([this.selectedArtifactId]) : new Set();
    },
    catalogLabels() {
      return {
        all: this.t.artifactCatalogAll,
        gridTitle: this.t.artifactCatalogGridTitle,
        closeDetails: this.t.artifactCatalogCloseDetails,
        ingredients: this.t.recipeIngredients
      };
    },
    selectedCatalogItem() {
      if (!this.selectedArtifact) return null;
      return {
        id: this.selectedArtifact.id,
        title: this.artifactName(this.selectedArtifact),
        description: this.selectedDescription,
        kicker: this.selectedRecipe ? this.t.recipeFusionOnly : this.familyLabel(this.selectedArtifact),
        orientation: this.selectedOrientation,
        previewItem: this.selectedPreviewItem,
        statsAriaLabel: `${this.artifactName(this.selectedArtifact)} stats`,
        facts: [
          {
            key: 'footprint',
            label: this.t.artifactCatalogFootprint,
            value: this.footprintLabel(this.selectedArtifact)
          },
          {
            key: 'price',
            label: this.t.artifactCatalogPrice,
            value: this.priceLabel(this.selectedArtifact)
          },
          {
            key: 'family',
            label: this.t.artifactCatalogFamily,
            value: this.familyLabel(this.selectedArtifact)
          },
          {
            key: 'slots',
            label: this.t.artifactCatalogSlots,
            value: this.selectedArtifact.slotCount || 0,
            visible: this.selectedArtifact.family === 'bag'
          }
        ]
      };
    }
  },
  methods: {
    updateGroupBoardColumns(metrics = {}) {
      const panelWidth = metrics.panelWidth || 0;
      const viewportWidth = metrics.viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : panelWidth);
      const compact = viewportWidth <= 560 || panelWidth <= 520;
      const cellSize = compact ? 42 : 50;
      const gap = compact ? 5 : 7;
      const panelPadding = compact ? 32 : 44;
      const maxColumns = compact ? 7 : MAX_GROUP_COLUMNS;
      const minimumWidth = (MIN_GROUP_COLUMNS * cellSize) + ((MIN_GROUP_COLUMNS - 1) * gap);
      const availableWidth = Math.max(minimumWidth, panelWidth - panelPadding);
      const columns = Math.min(
        maxColumns,
        Math.max(MIN_GROUP_COLUMNS, Math.floor((availableWidth + gap) / (cellSize + gap)))
      );
      if (columns !== this.groupBoardColumns) {
        this.groupBoardColumns = columns;
      }
    },
    familyOrder(artifact) {
      if (artifact?.family === 'damage') return 0;
      if (artifact?.family === 'armor') return 1;
      if (artifact?.family === 'stun') return 2;
      if (artifact?.family === 'bag') return 3;
      return 4;
    },
    familyLabel(artifact) {
      const family = artifact?.family || 'other';
      return this.t[`artifactFamily_${family}`] || family;
    },
    artifactName(artifact) {
      return artifactDisplayName(artifact, this.state.lang);
    },
    artifactDescription(artifact) {
      return artifact?.description?.[this.state.lang] || artifact?.description?.en || '';
    },
    recipeView(recipe) {
      const ingredients = recipe.ingredientArtifactIds
        .map((artifactId) => this.getArtifact(artifactId))
        .filter(Boolean);
      const result = this.getArtifact(recipe.resultArtifactId);
      return result && ingredients.length === recipe.ingredientArtifactIds.length
        ? { ...recipe, ingredients, result }
        : null;
    },
    previewOrientation(artifact) {
      return artifactPreviewOrientation(artifact);
    },
    previewItem(artifact) {
      const orientation = this.previewOrientation(artifact);
      return [{ artifactId: artifact.id, x: 0, y: 0, width: orientation.width, height: orientation.height }];
    },
    selectArtifact(artifactId) {
      this.selectedArtifactId = artifactId;
    },
    clearSelection() {
      this.selectedArtifactId = '';
    },
    isSelected(artifact) {
      return artifact?.id === this.activeArtifactId;
    },
    badgeLabel(artifact) {
      if (!artifact) return '';
      if (this.recipeByResultId.has(artifact.id)) return this.t.recipeFusionOnly;
      if (artifact.characterItem) return this.t.characterItem;
      if (artifact.starterOnly) return this.t.artifactCatalogStarter;
      if (artifact.family === 'bag') return this.t.artifactCatalogBag;
      return this.familyLabel(artifact);
    },
    footprintLabel(artifact) {
      const orientation = this.previewOrientation(artifact);
      return `${orientation.width}x${orientation.height}`;
    },
    priceLabel(artifact) {
      return Number.isFinite(artifact?.price) ? artifact.price : 1;
    },
    buildGroup(id, label, artifacts, columns = MIN_GROUP_COLUMNS) {
      const occupied = new Set();
      const items = [];
      let rows = 1;

      for (const artifact of artifacts) {
        const orientation = this.previewOrientation(artifact);
        const width = Math.min(columns, Math.max(1, orientation.width));
        const height = Math.max(1, orientation.height);
        let placed = false;

        for (let y = 0; !placed; y += 1) {
          for (let x = 0; x <= columns - width; x += 1) {
            if (!canPlace(occupied, x, y, width, height, columns)) continue;
            markPlaced(occupied, x, y, width, height);
            items.push({
              id: artifact.id,
              rowId: artifact.id,
              artifactId: artifact.id,
              x,
              y,
              width,
              height
            });
            rows = Math.max(rows, y + height);
            placed = true;
            break;
          }
        }
      }

      return { id, label, artifacts, columns, rows, items };
    }
  },
  template: `
    <core-artifact-catalog-browser
      :groups="artifactGroups"
      :count="artifacts.length"
      :selected-item="selectedCatalogItem"
      :selected-recipe="selectedRecipe"
      :labels="catalogLabels"
      :selected-row-ids="selectedRowIds"
      :highlighted-title="artifactName(selectedArtifact)"
      @select-item="selectArtifact($event.artifactId)"
      @close-details="clearSelection"
      @grid-panel-resize="updateGroupBoardColumns"
    >
      <template #group-board="{ group, selectedRowIds, highlightedTitle, selectItem }">
        <artifact-grid-board
          class="artifact-catalog-group-board"
          variant="catalog"
          :columns="group.columns"
          :rows="group.rows"
          :items="group.items"
          :get-artifact="getArtifact"
          :clickable-pieces="true"
          :highlighted-row-ids="selectedRowIds"
          :highlighted-title="highlightedTitle"
          @piece-click="selectItem($event.artifactId, $event)"
        />
      </template>
      <template #detail-visual="{ item }">
        <artifact-grid-board
          variant="catalog"
          :columns="item.orientation.width"
          :rows="item.orientation.height"
          :items="item.previewItem"
          :get-artifact="getArtifact"
        />
      </template>
      <template #detail-stats="{ item, className }">
        <artifact-stat-summary
          :class="className"
          :artifact="selectedArtifact"
          :lang="state.lang"
          :include-zeroes="false"
          variant="compact"
          :aria-label="item.statsAriaLabel"
        />
      </template>
      <template #recipe-artifact="{ artifact }">
        <artifact-grid-board
          variant="catalog"
          :columns="previewOrientation(artifact).width"
          :rows="previewOrientation(artifact).height"
          :items="previewItem(artifact)"
          :get-artifact="getArtifact"
        />
      </template>
    </core-artifact-catalog-browser>
  `
};
