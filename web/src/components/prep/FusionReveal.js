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
    },
    ingredientStyle(index) {
      const count = Math.max(1, this.ingredientArtifacts.length);
      const radius = 122;
      const angle = count === 2
        ? (index === 0 ? Math.PI : 0)
        : (-Math.PI / 2) + ((Math.PI * 2 * index) / count);
      const startX = Math.round(Math.cos(angle) * radius);
      const startY = Math.round(Math.sin(angle) * radius);
      return {
        '--fusion-start-x': `${startX}px`,
        '--fusion-start-y': `${startY}px`,
        '--fusion-near-x': `${Math.round(startX * 0.08)}px`,
        '--fusion-near-y': `${Math.round(startY * 0.08)}px`
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
          :style="ingredientStyle(index)"
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
