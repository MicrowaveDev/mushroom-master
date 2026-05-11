import { artifactFusionRecipes } from '../../../app/shared/artifact-fusions.js';
import { getBagShape } from '../../../app/shared/bag-shape.js';
import { ArtifactGridBoard } from './ArtifactGridBoard.js';
import { ArtifactStatSummary } from './ArtifactStatSummary.js';
import './ArtifactCatalogBrowser.css';

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

export const ArtifactCatalogBrowser = {
  name: 'ArtifactCatalogBrowser',
  components: { ArtifactGridBoard, ArtifactStatSummary },
  props: {
    state: { type: Object, required: true },
    t: { type: Object, required: true },
    getArtifact: { type: Function, required: true }
  },
  data() {
    return {
      selectedArtifactId: ''
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
      const firstFusion = this.artifacts.find((artifact) => this.recipeByResultId.has(artifact.id));
      return firstFusion?.id || this.artifacts[0]?.id || '';
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
      return this.artifactDescription(this.selectedArtifact) || this.t.artifactCatalogNoDescription;
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
          this.artifacts.filter(definition.matches)
        ))
        .filter((group) => group.artifacts.length);
    },
    selectedGroupId() {
      const group = this.artifactGroups.find((item) => item.artifacts.some((artifact) => artifact.id === this.activeArtifactId));
      return group?.id || '';
    },
    selectedRowIds() {
      return this.activeArtifactId ? new Set([this.activeArtifactId]) : new Set();
    }
  },
  methods: {
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
      if (!artifact) return { width: 1, height: 1 };
      if (artifact.family === 'bag') {
        const shape = getBagShape(artifact);
        return { width: shape[0]?.length || 1, height: shape.length || 1 };
      }
      if (artifact.shape) {
        const shape = artifact.shape;
        return { width: shape[0]?.length || artifact.width || 1, height: shape.length || artifact.height || 1 };
      }
      return { width: artifact.width || 1, height: artifact.height || 1 };
    },
    previewItem(artifact) {
      const orientation = this.previewOrientation(artifact);
      return [{ artifactId: artifact.id, x: 0, y: 0, width: orientation.width, height: orientation.height }];
    },
    selectArtifact(artifactId) {
      this.selectedArtifactId = artifactId;
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
    buildGroup(id, label, artifacts) {
      const columns = 6;
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
    <section class="artifact-catalog-browser" data-testid="artifact-catalog-browser">
      <div class="artifact-catalog-grid-panel panel">
        <div class="artifact-catalog-grid-header">
          <div>
            <p class="eyebrow">{{ t.artifactCatalogAll }}</p>
            <h3>{{ t.artifactCatalogGridTitle }}</h3>
          </div>
          <span class="artifact-catalog-count">{{ artifacts.length }}</span>
        </div>

        <div class="artifact-catalog-groups">
          <section
            v-for="group in artifactGroups"
            :key="group.id"
            class="artifact-catalog-group"
            data-testid="artifact-catalog-group"
            :data-artifact-group="group.id"
          >
            <div class="artifact-catalog-group-header">
              <h4>{{ group.label }}</h4>
              <span>{{ group.artifacts.length }}</span>
            </div>
            <artifact-grid-board
              class="artifact-catalog-group-board"
              variant="catalog"
              :columns="group.columns"
              :rows="group.rows"
              :items="group.items"
              :get-artifact="getArtifact"
              :clickable-pieces="true"
              :highlighted-row-ids="selectedRowIds"
              :highlighted-title="artifactName(selectedArtifact)"
              @piece-click="selectArtifact($event.artifactId)"
            />
            <aside
              v-if="selectedGroupId === group.id && selectedArtifact"
              class="artifact-catalog-detail"
              data-testid="artifact-catalog-detail"
              :data-artifact-id="selectedArtifact.id"
            >
              <div class="artifact-catalog-detail-top">
                <div class="artifact-catalog-detail-art" aria-hidden="true">
                  <artifact-grid-board
                    variant="catalog"
                    :columns="selectedOrientation.width"
                    :rows="selectedOrientation.height"
                    :items="selectedPreviewItem"
                    :get-artifact="getArtifact"
                  />
                </div>
                <div class="artifact-catalog-detail-copy">
                  <span class="artifact-catalog-detail-kicker">
                    {{ selectedRecipe ? t.recipeFusionOnly : familyLabel(selectedArtifact) }}
                  </span>
                  <h3>{{ artifactName(selectedArtifact) }}</h3>
                  <p>{{ selectedDescription }}</p>
                </div>
              </div>

              <artifact-stat-summary
                class="artifact-catalog-detail-stats"
                :artifact="selectedArtifact"
                :lang="state.lang"
                :include-zeroes="false"
                variant="compact"
                :aria-label="artifactName(selectedArtifact) + ' stats'"
              />

              <dl class="artifact-catalog-facts">
                <div>
                  <dt>{{ t.artifactCatalogFootprint }}</dt>
                  <dd>{{ footprintLabel(selectedArtifact) }}</dd>
                </div>
                <div>
                  <dt>{{ t.artifactCatalogPrice }}</dt>
                  <dd>{{ priceLabel(selectedArtifact) }}</dd>
                </div>
                <div>
                  <dt>{{ t.artifactCatalogFamily }}</dt>
                  <dd>{{ familyLabel(selectedArtifact) }}</dd>
                </div>
                <div v-if="selectedArtifact.family === 'bag'">
                  <dt>{{ t.artifactCatalogSlots }}</dt>
                  <dd>{{ selectedArtifact.slotCount || 0 }}</dd>
                </div>
              </dl>

              <section
                v-if="selectedRecipe"
                class="artifact-catalog-selected-recipe"
                data-testid="artifact-catalog-selected-recipe"
                :data-selected-result-artifact-id="selectedRecipe.resultArtifactId"
              >
                <h4>{{ t.recipeIngredients }}</h4>
                <div class="artifact-catalog-recipe-flow" aria-hidden="true">
                  <div class="artifact-catalog-recipe-ingredients">
                    <button
                      v-for="ingredient in selectedRecipeIngredients"
                      :key="selectedRecipe.id + ':' + ingredient.id"
                      type="button"
                      class="artifact-catalog-recipe-artifact"
                      :data-artifact-id="ingredient.id"
                      @click="selectArtifact(ingredient.id)"
                    >
                      <artifact-grid-board
                        variant="catalog"
                        :columns="previewOrientation(ingredient).width"
                        :rows="previewOrientation(ingredient).height"
                        :items="previewItem(ingredient)"
                        :get-artifact="getArtifact"
                      />
                    </button>
                  </div>
                  <span class="recipe-magnet-mark">+</span>
                  <button
                    type="button"
                    class="artifact-catalog-recipe-artifact artifact-catalog-recipe-artifact--result"
                    :data-artifact-id="selectedRecipe.resultArtifactId"
                    @click="selectArtifact(selectedRecipe.resultArtifactId)"
                  >
                    <artifact-grid-board
                      variant="catalog"
                      :columns="previewOrientation(selectedRecipe.result).width"
                      :rows="previewOrientation(selectedRecipe.result).height"
                      :items="previewItem(selectedRecipe.result)"
                      :get-artifact="getArtifact"
                    />
                  </button>
                </div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    </section>
  `
};
