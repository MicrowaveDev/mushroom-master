import { artifactFusionRecipes } from '../../../app/shared/artifact-fusions.js';
import { ArtifactFigure } from '../components/ArtifactFigure.js';

export const RecipesScreen = {
  name: 'RecipesScreen',
  components: { ArtifactFigure },
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
    artifactStats(artifact) {
      return (this.formatArtifactBonus?.(artifact) || [])
        .map((part) => `${part.label} ${part.value}`)
        .join(' · ');
    },
    figureSize(artifact) {
      return {
        width: artifact?.width || 1,
        height: artifact?.height || 1
      };
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
                <artifact-figure
                  :artifact="artifact"
                  :display-width="figureSize(artifact).width"
                  :display-height="figureSize(artifact).height"
                />
              </div>
            </div>
            <span class="recipe-magnet-mark">+</span>
            <div class="recipe-artifact-tile recipe-artifact-tile--result" :data-artifact-id="recipe.resultArtifactId">
              <artifact-figure
                :artifact="recipe.result"
                :display-width="figureSize(recipe.result).width"
                :display-height="figureSize(recipe.result).height"
              />
            </div>
          </div>

          <div class="recipe-card-copy">
            <span class="recipe-card-kicker">{{ t.recipeFusionOnly }}</span>
            <h3>{{ artifactName(recipe.result) }}</h3>
            <p>{{ artifactDescription(recipe.result) }}</p>
            <strong v-if="artifactStats(recipe.result)" class="recipe-card-stats">{{ artifactStats(recipe.result) }}</strong>
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
