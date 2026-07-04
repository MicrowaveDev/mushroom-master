import { artifactPreviewOrientation } from '@microwavedev/backpack-game-core/client-view-model';
import { artifactFusionRecipes } from '../../../app/shared/artifact-fusions.js';
import { ArtifactGridBoard } from '../components/ArtifactGridBoard.js';
import { ArtifactStatSummary } from '../components/ArtifactStatSummary.js';
import { FusionReveal } from '../components/prep/FusionReveal.js';

export const FusionAnimationLabScreen = {
  name: 'FusionAnimationLabScreen',
  components: { ArtifactGridBoard, ArtifactStatSummary, FusionReveal },
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
            ? { ...recipe, ingredients, result }
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

      <article v-if="activeRecipe" class="fusion-lab-stage-card panel" :data-result-artifact-id="activeRecipe.resultArtifactId">
        <div class="fusion-lab-stage-flow" aria-hidden="true">
          <div class="recipe-ingredient-row">
            <div
              v-for="artifact in activeRecipe.ingredients"
              :key="'active:' + activeRecipe.id + ':' + artifact.id"
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
          <div class="recipe-artifact-tile recipe-artifact-tile--result" :data-artifact-id="activeRecipe.resultArtifactId">
            <artifact-grid-board
              variant="catalog"
              :columns="previewOrientation(activeRecipe.result).width"
              :rows="previewOrientation(activeRecipe.result).height"
              :items="previewItem(activeRecipe.result)"
              :get-artifact="getArtifact"
            />
          </div>
        </div>
        <div class="fusion-lab-stage-copy">
          <span class="recipe-card-kicker">{{ t.fusionNowPlaying }} {{ activeIndex + 1 }} / {{ recipes.length }}</span>
          <h3>{{ artifactName(activeRecipe.result) }}</h3>
          <p>{{ artifactDescription(activeRecipe.result) }}</p>
          <artifact-stat-summary
            class="recipe-card-stats"
            :artifact="activeRecipe.result"
            :lang="state.lang"
            :include-zeroes="false"
            variant="compact"
            :aria-label="artifactName(activeRecipe.result) + ' stats'"
          />
        </div>
      </article>

      <div class="recipe-list fusion-lab-list">
        <article
          v-for="(recipe, index) in recipes"
          :key="recipe.id"
          class="recipe-card fusion-lab-card"
          :class="{ 'fusion-lab-card--active': index === activeIndex }"
          data-testid="fusion-lab-recipe-card"
          :data-result-artifact-id="recipe.resultArtifactId"
          @click="playRecipe(index, false)"
          role="button"
          tabindex="0"
          @keydown.enter.prevent="playRecipe(index, false)"
          @keydown.space.prevent="playRecipe(index, false)"
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
          </div>
        </article>
      </div>

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
