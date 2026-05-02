import { ArtifactGridBoard } from '../ArtifactGridBoard.js';

export const BackpackZone = {
  name: 'BackpackZone',
  components: { ArtifactGridBoard },
  props: ['state', 't', 'containerArtifacts', 'getArtifact', 'formatArtifactBonus', 'preferredOrientation'],
  emits: ['auto-place', 'container-dragover', 'container-drop'],
  methods: {
    previewOrientation(artifact) {
      if (!artifact) return { width: 1, height: 1 };
      // Match shop previews: artifact bitmaps are authored in canonical
      // footprint space, so non-shaped artifacts should not be rotated or
      // squashed while waiting in the backpack.
      if (!artifact.shape) return { width: artifact.width, height: artifact.height };
      return this.preferredOrientation(artifact);
    },
    previewItem(artifact) {
      const orientation = this.previewOrientation(artifact);
      return [{ artifactId: artifact.id, rowId: artifact.rowId, x: 0, y: 0, width: orientation.width, height: orientation.height }];
    },
    itemDataset(artifact) {
      const orientation = this.previewOrientation(artifact);
      return {
        'data-artifact-id': artifact.id,
        'data-artifact-row-id': artifact.rowId || '',
        'data-artifact-width': orientation.width,
        'data-artifact-height': orientation.height
      };
    }
  },
  template: `
    <div class="artifact-container-zone"
      @dragover="$emit('container-dragover', $event)"
      @drop="$emit('container-drop', $event)"
    >
      <div class="artifact-container-header">
        <strong>{{ t.container }}</strong>
        <span v-if="containerArtifacts.length" class="artifact-container-count">{{ containerArtifacts.length }}</span>
      </div>
      <div v-if="containerArtifacts.length" class="artifact-container-items">
        <div
          v-for="artifact in containerArtifacts"
          :key="artifact.instanceKey"
          class="container-item"
          v-bind="itemDataset(artifact)"
          @click="$emit('auto-place', { artifactId: artifact.id, id: artifact.rowId })"
        >
          <artifact-grid-board
            class="container-item-visual"
            variant="catalog"
            :columns="previewOrientation(artifact).width"
            :rows="previewOrientation(artifact).height"
            :items="previewItem(artifact)"
            :get-artifact="getArtifact"
          />
          <div class="container-item-copy">
            <strong>{{ artifact.name[state.lang] }}</strong>
            <span v-if="artifact.family === 'bag'" class="artifact-stat-chip artifact-stat-chip--bag">{{ artifact.slotCount }} {{ t.bagSlots }}</span>
            <span class="artifact-stat-chips">
              <span
                v-for="stat in formatArtifactBonus(artifact)"
                :key="stat.key"
                class="artifact-stat-chip"
                :class="stat.positive ? 'artifact-stat-chip--pos' : 'artifact-stat-chip--neg'"
              >{{ stat.label }} {{ stat.value }}</span>
            </span>
          </div>
        </div>
      </div>
      <p v-else class="artifact-container-empty">{{ t.containerHint }}</p>
    </div>
  `
};
