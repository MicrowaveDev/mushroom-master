import { artifactFusionRecipes } from '../../../app/shared/artifact-fusions.js';
import { getBagShape } from '../../../app/shared/bag-shape.js';
import { ArtifactGridBoard } from '../components/ArtifactGridBoard.js';
import { ArtifactStatSummary } from '../components/ArtifactStatSummary.js';

export const RecipesScreen = {
  name: 'RecipesScreen',
  components: { ArtifactGridBoard, ArtifactStatSummary },
  props: ['state', 't', 'getArtifact', 'formatArtifactBonus'],
  computed: {
    recipes() {
      return artifactFusionRecipes
        .map((recipe) => {
          const ingredients = recipe.ingredientArtifactIds
            .map((artifactId) => this.getArtifact(artifactId))
            .filter(Boolean);
          const result = this.getArtifact(recipe.resultArtifactId);
          return result && ingredients.length === recipe.ingredientArtifactIds.length
            ? { ...recipe, ingredients, result }
            : null;
        })
        .filter(Boolean);
    }
  },
  methods: {
    artifactName(artifact) {
      return artifact?.name?.[this.state.lang] || artifact?.name?.en || artifact?.id || '';
    },
    artifactDescription(artifact) {
      return artifact?.description?.[this.state.lang] || artifact?.description?.en || '';
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
    }
  },
  template: `
    <section class="recipes-screen" data-testid="recipes-screen">
      <header class="recipes-cover panel">
        <p class="eyebrow">{{ t.recipes }}</p>
        <h2>{{ t.recipesTitle }}</h2>
        <p class="recipes-cover-copy">{{ t.recipesIntro }}</p>
      </header>

      <div class="recipe-list">
        <article
          v-for="recipe in recipes"
          :key="recipe.id"
          class="recipe-card"
          data-testid="recipe-card"
          :data-result-artifact-id="recipe.resultArtifactId"
        >
          <div class="recipe-card-flow" aria-hidden="true">
            <div class="recipe-ingredient-row">
              <div
                v-for="artifact in recipe.ingredients"
                :key="recipe.id + ':' + artifact.id"
                class="recipe-artifact-tile recipe-artifact-tile--ingredient"
                :data-artifact-id="artifact.id"
              >
                <artifact-grid-board
                  variant="catalog"
                  :columns="previewOrientation(artifact).width"
                  :rows="previewOrientation(artifact).height"
                  :items="previewItem(artifact)"
                  :get-artifact="getArtifact"
                />
              </div>
            </div>
            <span class="recipe-magnet-mark">+</span>
            <div class="recipe-artifact-tile recipe-artifact-tile--result" :data-artifact-id="recipe.resultArtifactId">
              <artifact-grid-board
                variant="catalog"
                :columns="previewOrientation(recipe.result).width"
                :rows="previewOrientation(recipe.result).height"
                :items="previewItem(recipe.result)"
                :get-artifact="getArtifact"
              />
            </div>
          </div>

          <div class="recipe-card-copy">
            <span class="recipe-card-kicker">{{ t.recipeFusionOnly }}</span>
            <h3>{{ artifactName(recipe.result) }}</h3>
            <p>{{ artifactDescription(recipe.result) }}</p>
            <artifact-stat-summary
              class="recipe-card-stats"
              :artifact="recipe.result"
              :lang="state.lang"
              :include-zeroes="false"
              variant="compact"
              :aria-label="artifactName(recipe.result) + ' stats'"
            />
            <div class="recipe-ingredient-names" :aria-label="t.recipeIngredients">
              <span v-for="artifact in recipe.ingredients" :key="artifact.id">{{ artifactName(artifact) }}</span>
            </div>
          </div>
        </article>
      </div>

      <p v-if="recipes.length === 0" class="wiki-empty">{{ t.noRecipesYet }}</p>
    </section>
  `
};
