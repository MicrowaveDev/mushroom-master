import { artifactPreviewOrientation } from '@microwavedev/backpack-game-core/client-view-model';
import { RecipeCard, RecipeList } from '@microwavedev/backpack-game-core/vue/components';
import { artifactFusionRecipes } from '../../../app/shared/artifact-fusions.js';
import { ArtifactGridBoard } from '../components/ArtifactGridBoard.js';
import { ArtifactStatSummary } from '../components/ArtifactStatSummary.js';
import { FusionReveal } from '../components/prep/FusionReveal.js';

export const FusionAnimationLabScreen = {
  name: 'FusionAnimationLabScreen',
  components: { ArtifactGridBoard, ArtifactStatSummary, FusionReveal, RecipeCard, RecipeList },
  props: ['state', 't', 'getArtifact'],
  data() {
    return {
      activeIndex: 0,
      playKey: 0,
      playing: false,
      playAllActive: false,
      nextTimer: null
    };
  },
  computed: {
    recipes() {
      return artifactFusionRecipes
        .map((recipe) => {
          const ingredients = recipe.ingredientArtifactIds
            .map((artifactId) => this.getArtifact(artifactId))
            .filter(Boolean);
          const result = this.getArtifact(recipe.resultArtifactId);
          return result && ingredients.length === recipe.ingredientArtifactIds.length
            ? {
                ...recipe,
                ingredients,
                result,
                resultName: this.artifactName(result),
                resultDescription: this.artifactDescription(result),
                resultStatsAriaLabel: `${this.artifactName(result)} stats`
              }
            : null;
        })
        .filter(Boolean);
    },
    activeRecipe() {
      return this.recipes[this.activeIndex] || this.recipes[0] || null;
    },
    activeReveal() {
      if (!this.playing || !this.activeRecipe) return null;
      return {
        id: `${this.activeRecipe.id}:${this.playKey}`,
        resultArtifactId: this.activeRecipe.resultArtifactId,
        ingredientArtifactIds: this.activeRecipe.ingredientArtifactIds
      };
    }
  },
  beforeUnmount() {
    this.clearNextTimer();
  },
  methods: {
    artifactName(artifact) {
      return artifact?.name?.[this.state.lang] || artifact?.name?.en || artifact?.id || '';
    },
    artifactDescription(artifact) {
      return artifact?.description?.[this.state.lang] || artifact?.description?.en || '';
    },
    previewOrientation(artifact) {
      return artifactPreviewOrientation(artifact);
    },
    previewItem(artifact) {
      const orientation = this.previewOrientation(artifact);
      return [{ artifactId: artifact.id, x: 0, y: 0, width: orientation.width, height: orientation.height }];
    },
    clearNextTimer() {
      if (!this.nextTimer) return;
      window.clearTimeout(this.nextTimer);
      this.nextTimer = null;
    },
    playRecipe(index, playAll = false) {
      if (!this.recipes[index]) return;
      this.clearNextTimer();
      this.activeIndex = index;
      this.playAllActive = playAll;
      this.playing = false;
      this.$nextTick(() => {
        this.playKey += 1;
        this.playing = true;
      });
    },
    playAll() {
      if (!this.recipes.length) return;
      this.playRecipe(0, true);
    },
    replayActive() {
      if (!this.activeRecipe) return;
      this.playRecipe(this.activeIndex, false);
    },
    playAdjacent(direction) {
      if (!this.recipes.length) return;
      const nextIndex = (this.activeIndex + direction + this.recipes.length) % this.recipes.length;
      this.playRecipe(nextIndex, false);
    },
    completeReveal() {
      this.playing = false;
      if (!this.playAllActive) return;
      const nextIndex = this.activeIndex + 1;
      if (nextIndex >= this.recipes.length) {
        this.playAllActive = false;
        return;
      }
      this.nextTimer = window.setTimeout(() => {
        this.playRecipe(nextIndex, true);
      }, 340);
    }
  },
  template: `
    <section class="fusion-lab-screen" data-testid="fusion-lab-screen">
      <header class="fusion-lab-cover panel">
        <div>
          <p class="eyebrow">{{ t.localOnly }}</p>
          <h2>{{ t.fusionLab }}</h2>
        </div>
        <div class="fusion-lab-actions">
          <button class="ghost" type="button" data-testid="fusion-lab-prev" @click="playAdjacent(-1)">{{ t.fusionPrevious }}</button>
          <button class="primary" type="button" data-testid="fusion-lab-play-all" @click="playAll">{{ t.fusionPlayAll }}</button>
          <button class="ghost" type="button" data-testid="fusion-lab-replay" @click="replayActive">{{ t.fusionReplay }}</button>
          <button class="ghost" type="button" data-testid="fusion-lab-next" @click="playAdjacent(1)">{{ t.fusionNext }}</button>
        </div>
      </header>

      <recipe-card
        v-if="activeRecipe"
        as="article"
        :recipe="activeRecipe"
        :index="activeIndex"
        card-class="fusion-lab-stage-card panel"
        flow-class="fusion-lab-stage-flow"
        ingredient-row-class="recipe-ingredient-row"
        artifact-class="recipe-artifact-tile recipe-artifact-tile--ingredient"
        result-artifact-class="recipe-artifact-tile recipe-artifact-tile--result"
        copy-class="fusion-lab-stage-copy"
        kicker-class="recipe-card-kicker"
        stats-class="recipe-card-stats"
        :kicker-text="t.fusionNowPlaying + ' ' + (activeIndex + 1) + ' / ' + recipes.length"
      >
        <template #artifact="{ artifact }">
          <artifact-grid-board
            variant="catalog"
            :columns="previewOrientation(artifact).width"
            :rows="previewOrientation(artifact).height"
            :items="previewItem(artifact)"
            :get-artifact="getArtifact"
          />
        </template>
        <template #stats="{ recipe, statsClass }">
          <artifact-stat-summary
            :class="statsClass"
            :artifact="recipe.result"
            :lang="state.lang"
            :include-zeroes="false"
            variant="compact"
            :aria-label="recipe.resultStatsAriaLabel"
          />
        </template>
      </recipe-card>

      <recipe-list
        :recipes="recipes"
        list-class="recipe-list fusion-lab-list"
        card-class="recipe-card fusion-lab-card"
        active-class="fusion-lab-card--active"
        card-test-id="fusion-lab-recipe-card"
        flow-class="recipe-card-flow"
        ingredient-row-class="recipe-ingredient-row"
        artifact-class="recipe-artifact-tile recipe-artifact-tile--ingredient"
        result-artifact-class="recipe-artifact-tile recipe-artifact-tile--result"
        copy-class="recipe-card-copy"
        kicker-class="recipe-card-kicker"
        stats-class="recipe-card-stats"
        :labels="{ kicker: t.recipeFusionOnly }"
        :active-index="activeIndex"
        :interactive="true"
        @select="playRecipe($event.index, false)"
      >
        <template #artifact="{ artifact }">
          <artifact-grid-board
            variant="catalog"
            :columns="previewOrientation(artifact).width"
            :rows="previewOrientation(artifact).height"
            :items="previewItem(artifact)"
            :get-artifact="getArtifact"
          />
        </template>
        <template #stats="{ recipe, statsClass }">
          <artifact-stat-summary
            :class="statsClass"
            :artifact="recipe.result"
            :lang="state.lang"
            :include-zeroes="false"
            variant="compact"
            :aria-label="recipe.resultStatsAriaLabel"
          />
        </template>
      </recipe-list>

      <p v-if="recipes.length === 0" class="wiki-empty">{{ t.noRecipesYet }}</p>

      <fusion-reveal
        v-if="activeReveal"
        :key="activeReveal.id"
        :reveal="activeReveal"
        :get-artifact="getArtifact"
        :state="state"
        @done="completeReveal"
      />
    </section>
  `
};
