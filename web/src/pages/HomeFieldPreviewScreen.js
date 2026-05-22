import homeFieldAssets from '../../../app/shared/home-field/home-field-assets.json';
import homeFieldMap from '../../../app/shared/home-field/home-field-map.json';

const fallbackTileTypes = {
  grass_base_01: 'grassA',
  grass_base_02: 'grassB',
  grass_flowers_01: 'mushroomPatch',
  path_dirt_straight: 'path',
  path_spore_glow: 'spawn',
  path_destination_row: 'pathTop',
  edge_roots_01: 'forest',
  edge_moss_rocks_01: 'edge'
};

const fallbackObjectClass = {
  arena: 'home-field-preview-object--arena',
  journey: 'home-field-preview-object--journey',
  arena_signpost: 'home-field-preview-object--sign',
  journey_signpost: 'home-field-preview-object--sign',
  lantern_left: 'home-field-preview-object--lantern',
  lantern_right: 'home-field-preview-object--lantern',
  mushroom_cluster_amber_1: 'home-field-preview-object--cluster-a',
  mushroom_cluster_violet_1: 'home-field-preview-object--cluster-b',
  mushroom_cluster_tall_1: 'home-field-preview-object--cluster-a',
  mushroom_cluster_tall_2: 'home-field-preview-object--cluster-b',
  mushroom_cap_red_1: 'home-field-preview-object--cluster-a',
  fallen_branch: 'home-field-preview-object--cluster-b',
  chibi_spawn: 'home-field-preview-object--chibi'
};

const fallbackObjectLabel = {
  arena: 'Arena',
  journey: 'Journey',
  arena_signpost: 'Sign',
  journey_signpost: 'Sign',
  lantern_left: 'Lantern',
  lantern_right: 'Lantern',
  mushroom_cluster_amber_1: 'Cluster',
  mushroom_cluster_violet_1: 'Cluster',
  mushroom_cluster_tall_1: 'Cluster',
  mushroom_cluster_tall_2: 'Cluster',
  mushroom_cap_red_1: 'Cluster',
  fallen_branch: 'Branch',
  chibi_spawn: 'Chibi'
};

function percent(value, total) {
  return `${((value / total) * 100).toFixed(3)}%`;
}

export const HomeFieldPreviewScreen = {
  name: 'HomeFieldPreviewScreen',
  computed: {
    assetById() {
      return Object.fromEntries(homeFieldAssets.assets.map((asset) => [asset.id, asset]));
    },
    terrainLayer() {
      return homeFieldMap.layers.find((layer) => layer.id === 'terrain');
    },
    objectLayer() {
      return homeFieldMap.layers.find((layer) => layer.id === 'objects');
    },
    tiles() {
      const tileSize = homeFieldMap.world.tileSize;
      const cols = homeFieldMap.world.width / tileSize;
      return (this.terrainLayer?.tiles || []).map((tile, index) => {
        const asset = this.assetById[tile.assetId] || null;
        return {
          id: `tile-${index + 1}`,
          assetId: tile.assetId,
          type: fallbackTileTypes[tile.assetId] || 'grassA',
          src: asset && asset.status !== 'missing' ? asset.publicPath : '',
          row: Math.floor(tile.y / tileSize) + 1,
          col: Math.floor(tile.x / tileSize) + 1,
          style: `grid-column: ${Math.floor(tile.x / tileSize) + 1}; grid-row: ${Math.floor(tile.y / tileSize) + 1};`,
          index,
          cols
        };
      });
    },
    objects() {
      const world = homeFieldMap.world;
      const mapObjects = (this.objectLayer?.objects || []).map((object) => {
        const asset = this.assetById[object.assetId] || null;
        return {
          id: object.id,
          label: fallbackObjectLabel[object.id] || object.id,
          className: fallbackObjectClass[object.id] || 'home-field-preview-object--cluster-a',
          src: asset && asset.status !== 'missing' ? asset.publicPath : '',
          style: `left: ${percent(object.x, world.width)}; top: ${percent(object.y, world.height)};`
        };
      });
      return [
        ...mapObjects,
        {
          id: 'chibi-spawn',
          label: 'Chibi',
          className: fallbackObjectClass.chibi_spawn,
          src: '',
          style: `left: ${percent(homeFieldMap.spawn.x, world.width)}; top: ${percent(homeFieldMap.spawn.y, world.height)};`
        }
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
            :style="tile.style"
            :data-tile-type="tile.type"
            :data-asset-id="tile.assetId"
            :data-row="tile.row"
            :data-col="tile.col"
          >
            <img
              v-if="tile.src"
              class="home-field-preview-tile-img"
              :src="tile.src"
              :alt="tile.assetId"
              loading="eager"
            />
          </div>
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
          <img
            v-if="object.src"
            class="home-field-preview-object-img"
            :src="object.src"
            :alt="object.label"
            loading="eager"
          />
          <span>{{ object.label }}</span>
        </button>
      </div>
    </section>
  `
};
