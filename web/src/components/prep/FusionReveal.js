import { FusionReveal as CoreFusionReveal } from '@microwavedev/backpack-game-core/vue/components';
import { ArtifactFigure } from '../ArtifactFigure.js';

export const FusionReveal = {
  name: 'FusionReveal',
  components: { CoreFusionReveal, ArtifactFigure },
  props: ['reveal', 'getArtifact', 'state'],
  emits: ['done'],
  computed: {
    ingredientArtifacts() {
      return (this.reveal?.ingredientArtifactIds || [])
        .map((id) => this.getArtifact(id))
        .filter(Boolean);
    },
    resultArtifact() {
      return this.getArtifact(this.reveal?.resultArtifactId);
    },
    label() {
      const resultName = this.resultArtifact?.name?.[this.state.lang]
        || this.resultArtifact?.name?.en
        || this.reveal?.resultArtifactId
        || '';
      return this.state.lang === 'ru'
        ? `Слияние артефактов: ${resultName}`
        : `Artifact fusion: ${resultName}`;
    }
  },
  template: `
    <CoreFusionReveal
      :ingredient-artifacts="ingredientArtifacts"
      :result-artifact="resultArtifact"
      :label="label"
      @done="$emit('done')"
    >
      <template #artifact="{ artifact, width, height }">
        <artifact-figure
          :artifact="artifact"
          :display-width="width"
          :display-height="height"
        />
      </template>
    </CoreFusionReveal>
  `
};
