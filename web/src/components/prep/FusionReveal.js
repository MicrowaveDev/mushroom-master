import { ArtifactFigure } from '../ArtifactFigure.js';

export const FusionReveal = {
  name: 'FusionReveal',
  components: { ArtifactFigure },
  props: ['reveal', 'getArtifact', 'state'],
  emits: ['done'],
  data() {
    return { timer: null, finished: false };
  },
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
  mounted() {
    this.timer = window.setTimeout(() => this.finish(), 2100);
  },
  beforeUnmount() {
    if (this.timer) window.clearTimeout(this.timer);
  },
  methods: {
    finish() {
      if (this.finished) return;
      this.finished = true;
      this.$emit('done');
    },
    figureSize(artifact) {
      return {
        width: artifact?.width || 1,
        height: artifact?.height || 1
      };
    }
  },
  template: `
    <div class="fusion-reveal" role="status" :aria-label="label" @animationend.self="finish">
      <div class="fusion-reveal-stage" aria-hidden="true">
        <div
          v-for="(artifact, index) in ingredientArtifacts"
          :key="artifact.id + ':' + index"
          class="fusion-reveal-ingredient"
          :class="'fusion-reveal-ingredient--' + index"
        >
          <artifact-figure
            :artifact="artifact"
            :display-width="figureSize(artifact).width"
            :display-height="figureSize(artifact).height"
          />
        </div>
        <div class="fusion-reveal-burst"></div>
        <div v-if="resultArtifact" class="fusion-reveal-result">
          <artifact-figure
            :artifact="resultArtifact"
            :display-width="figureSize(resultArtifact).width"
            :display-height="figureSize(resultArtifact).height"
          />
        </div>
      </div>
    </div>
  `
};
