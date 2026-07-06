import { CatalogPageScreen } from '@microwavedev/backpack-game-core/vue/components';
import { ArtifactCatalogBrowser } from '../components/ArtifactCatalogBrowser.js';

export const RecipesScreen = {
  name: 'RecipesScreen',
  components: { ArtifactCatalogBrowser, CatalogPageScreen },
  props: ['state', 't', 'getArtifact'],
  computed: {
    labels() {
      return {
        eyebrow: this.t.recipes,
        title: this.t.recipesTitle,
        intro: this.t.recipesIntro
      };
    }
  },
  template: `
    <catalog-page-screen
      :labels="labels"
      root-class="recipes-screen"
      header-class="recipes-cover panel"
      test-id="recipes-screen"
    >
      <artifact-catalog-browser
        :state="state"
        :t="t"
        :get-artifact="getArtifact"
      />
    </catalog-page-screen>
  `
};
