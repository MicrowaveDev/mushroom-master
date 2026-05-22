const tilePattern = [
  'edge', 'forest', 'pathTop', 'pathTop', 'pathTop', 'forest', 'edge',
  'grassB', 'mushroomPatch', 'path', 'path', 'path', 'lanternPatch', 'grassB',
  'grassA', 'grassB', 'grassA', 'path', 'grassA', 'grassB', 'grassA',
  'edge', 'grassA', 'grassB', 'spawn', 'grassB', 'grassA', 'edge'
];

export const HomeFieldPreviewScreen = {
  name: 'HomeFieldPreviewScreen',
  computed: {
    tiles() {
      return tilePattern.map((type, index) => ({
        id: `tile-${index + 1}`,
        type,
        row: Math.floor(index / 7) + 1,
        col: (index % 7) + 1
      }));
    },
    objects() {
      return [
        { id: 'journey-gate', label: 'Journey', className: 'home-field-preview-object--journey', style: 'left: 13%; top: 22%;' },
        { id: 'arena-arch', label: 'Arena', className: 'home-field-preview-object--arena', style: 'right: 11%; top: 22%;' },
        { id: 'chibi-spawn', label: 'Chibi', className: 'home-field-preview-object--chibi', style: 'left: 49%; bottom: 14%;' },
        { id: 'signpost', label: 'Sign', className: 'home-field-preview-object--sign', style: 'left: 42%; top: 38%;' },
        { id: 'mushroom-cluster-a', label: 'Cluster', className: 'home-field-preview-object--cluster-a', style: 'left: 21%; top: 42%;' },
        { id: 'mushroom-cluster-b', label: 'Cluster', className: 'home-field-preview-object--cluster-b', style: 'right: 20%; bottom: 28%;' },
        { id: 'field-lantern', label: 'Lantern', className: 'home-field-preview-object--lantern', style: 'left: 63%; top: 43%;' }
      ];
    }
  },
  template: `
    <section class="home-field-preview-screen" data-testid="home-field-preview">
      <header class="home-field-preview-header">
        <div>
          <p class="eyebrow">Home Field Layout Lab</p>
          <h1>Tile Placement Preview</h1>
        </div>
        <span class="home-field-preview-size">7 x 4 / 256px tiles</span>
      </header>

      <div class="home-field-preview-stage" data-testid="home-field-preview-stage">
        <div class="home-field-preview-safe-frame" data-testid="home-field-preview-mobile-safe-frame"></div>
        <div class="home-field-preview-grid" data-testid="home-field-preview-tile-grid">
          <div
            v-for="tile in tiles"
            :key="tile.id"
            class="home-field-preview-tile"
            :class="'home-field-preview-tile--' + tile.type"
            :data-tile-type="tile.type"
            :data-row="tile.row"
            :data-col="tile.col"
          ></div>
        </div>
        <div class="home-field-preview-path-glow" aria-hidden="true"></div>
        <button
          v-for="object in objects"
          :key="object.id"
          class="home-field-preview-object"
          :class="object.className"
          :style="object.style"
          :data-testid="'home-field-preview-' + object.id"
          type="button"
          :aria-label="object.label"
        >
          <span>{{ object.label }}</span>
        </button>
      </div>
    </section>
  `
};
