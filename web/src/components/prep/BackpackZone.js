import { artifactPreviewOrientation } from '@microwavedev/backpack-game-core/client-view-model';
import { BackpackZone as CoreBackpackZone } from '@microwavedev/backpack-game-core/vue/components';
import { ArtifactGridBoard } from '../ArtifactGridBoard.js';

export const BackpackZone = {
  name: 'BackpackZone',
  components: { ArtifactGridBoard, CoreBackpackZone },
  props: [
    'state', 't', 'containerArtifacts', 'getArtifact', 'formatArtifactBonus',
    'preferredOrientation', 'fusionIngredientRowIds', 'fusionCandidateRowIds'
  ],
  emits: ['auto-place', 'container-dragover', 'container-drop'],
  computed: {
    labels() {
      return {
        title: this.t?.container,
        bagSlots: this.t?.bagSlots,
        empty: this.t?.containerHint,
        pendingTitle: this.t?.fusionPendingHint || 'Will fuse after this round',
        highlightedTitle: this.t?.fusionCandidateHint || this.t?.recipes || 'Can fuse by recipe'
      };
    }
  },
  methods: {
    previewOrientation(artifact) {
      return artifactPreviewOrientation(artifact);
    },
    artifactName(artifact) {
      return artifact?.name?.[this.state.lang] || artifact?.name?.en || artifact?.id || '';
    },
    onSelectItem(event) {
      this.$emit('auto-place', { artifactId: event.artifactId, id: event.id });
    }
  },
  template: `
    <CoreBackpackZone
      :items="containerArtifacts"
      :labels="labels"
      :lang="state.lang"
      :name-for-item="artifactName"
      :format-item-stats="formatArtifactBonus"
      :preview-orientation-for-item="previewOrientation"
      :pending-item-ids="fusionIngredientRowIds"
      :highlighted-item-ids="fusionCandidateRowIds"
      @select-item="onSelectItem"
      @container-dragover="$emit('container-dragover', $event)"
      @container-drop="$emit('container-drop', $event)"
    >
      <template #visual="{ item, orientation, previewItem }">
        <artifact-grid-board
          class="container-item-visual"
          variant="catalog"
          :columns="orientation.width"
          :rows="orientation.height"
          :items="previewItem"
          :get-artifact="getArtifact"
        />
      </template>
    </CoreBackpackZone>
  `
};
