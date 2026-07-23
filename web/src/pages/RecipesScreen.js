import { RecipesScreen as CoreRecipesScreen } from '@microwavedev/backpack-game-core/vue/pages';
import { ArtifactCatalogBrowser } from '../components/ArtifactCatalogBrowser.js';

export const RecipesScreen = {
  name: 'RecipesScreen',
  components: { ArtifactCatalogBrowser, CoreRecipesScreen },
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
    <core-recipes-screen :labels="labels">
      <template #catalog>
        <artifact-catalog-browser
          :state="state"
          :t="t"
          :get-artifact="getArtifact"
        />
      </template>
    </core-recipes-screen>
  `
};
