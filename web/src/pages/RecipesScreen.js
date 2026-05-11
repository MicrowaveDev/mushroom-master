import { ArtifactCatalogBrowser } from '../components/ArtifactCatalogBrowser.js';

export const RecipesScreen = {
  name: 'RecipesScreen',
  components: { ArtifactCatalogBrowser },
  props: ['state', 't', 'getArtifact'],
  template: `
    <section class="recipes-screen" data-testid="recipes-screen">
      <header class="recipes-cover panel">
        <p class="eyebrow">{{ t.recipes }}</p>
        <h2>{{ t.recipesTitle }}</h2>
        <p class="recipes-cover-copy">{{ t.recipesIntro }}</p>
      </header>

      <artifact-catalog-browser
        :state="state"
        :t="t"
        :get-artifact="getArtifact"
      />
    </section>
  `
};
