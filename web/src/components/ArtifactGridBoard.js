import { BAG_COLUMNS, BAG_ROWS, INVENTORY_COLUMNS, INVENTORY_ROWS } from '../constants.js';
import { bagRowEntryFor as bagRowEntryForLookup } from '../helpers/grid-cell-classification.js';
import { ArtifactFigure } from './ArtifactFigure.js';

export const ArtifactGridBoard = {
  components: { ArtifactFigure },
  props: {
    // For non-inventory variants (catalog, fighter card) the legacy
    // `columns` / `rows` props still describe a uniform grid.
    columns: { type: Number, default: INVENTORY_COLUMNS },
    rows: { type: Number, default: INVENTORY_ROWS },
    // For inventory variant: the full unified grid is rendered as ONE grid
    // BAG_COLUMNS wide, totalRows tall. Cells inside (0..INVENTORY_COLUMNS-1,
    // 0..INVENTORY_ROWS-1) are base-inventory cells; everything else is
    // either a bag's slot (when bagRows covers it) or empty bag area.
    totalRows: { type: Number, default: 0 },
    items: { type: Array, default: () => [] },
    variant: { type: String, default: 'inventory' },
    renderArtifactFigure: { type: Function, default: null },
    getArtifact: { type: Function, required: true },
    interactiveCells: { type: Boolean, default: false },
    clickablePieces: { type: Boolean, default: false },
    rotatablePieces: { type: Boolean, default: false },
    droppable: { type: Boolean, default: false },
    draggablePieces: { type: Boolean, default: false },
    bagRows: { type: Array, default: () => [] }
  },
  emits: ['cell-click', 'piece-click', 'piece-rotate', 'cell-drop', 'piece-drag-start', 'piece-drag-end'],
  data() {
    return { hoverCellIndex: -1 };
  },
  computed: {
    isInventoryVariant() {
      return this.variant === 'inventory';
    },
    gridColumns() {
      // Inventory variant uses the unified BAG_COLUMNS-wide grid; other
      // variants (catalog, fighter card) keep their per-instance `columns`.
      return this.isInventoryVariant ? BAG_COLUMNS : this.columns;
    },
    gridRows() {
      if (!this.isInventoryVariant) return this.rows;
      // Unified prep grid is always at least BAG_ROWS tall (6×6) so bag
      // drops have visible landing cells even before any bag is active.
      // Expands further when totalRows reports a bag extending below row
      // BAG_ROWS - 1.
      return Math.max(BAG_ROWS, this.totalRows);
    },
    totalCells() {
      return this.gridColumns * this.gridRows;
    },
    gridStyle() {
      return {
        gridTemplateColumns: `repeat(${this.gridColumns}, var(--artifact-cell-size, 50px))`,
        gridTemplateRows: `repeat(${this.gridRows}, var(--artifact-cell-size, 50px))`
      };
    },
    rootClass() {
      return {
        'artifact-grid-board': true,
        'inventory-shell': this.isInventoryVariant,
        'artifact-grid-board--inventory': this.isInventoryVariant,
        'artifact-grid-board--catalog': this.variant === 'catalog'
      };
    }
  },
  methods: {
    cellX(index) {
      return index % this.gridColumns;
    },
    cellY(index) {
      return Math.floor(index / this.gridColumns);
    },
    pieceStyle(item) {
      return {
        gridColumn: `${item.x + 1} / span ${item.width}`,
        gridRow: `${item.y + 1} / span ${item.height}`
      };
    },
    isBaseInventoryCell(cx, cy) {
      // The base inventory occupies a fixed (0..INVENTORY_COLUMNS-1,
      // 0..INVENTORY_ROWS-1) sub-rectangle within the unified grid. In
      // Phase 3 of the bag-grid-unification this becomes a starter-bag
      // artifact and this helper goes away — see game-requirements.md §2-K.
      return this.isInventoryVariant
        && cx >= 0 && cx < INVENTORY_COLUMNS
        && cy >= 0 && cy < INVENTORY_ROWS;
    },
    bagRowEntryFor(cx, cy) {
      // Delegates to helpers/grid-cell-classification.bagRowEntryFor so the
      // lookup rules (slot-first, bbox-second, null for empty bag area) are
      // covered by unit tests without mounting the component.
      return bagRowEntryForLookup(this.bagRows, cx, cy);
    },
    isBagSlotCell(cx, cy) {
      const bag = this.bagRowEntryFor(cx, cy);
      return !!bag && bag.enabledCells?.includes(cx);
    },
    isBagBoxCell(cx, cy) {
      // Inside a bag's bounding box but NOT a real slot (= a tetromino mask
      // gap). Renders as visually hidden so the bag's footprint reads as a
      // shape, not a rectangle.
      const bag = this.bagRowEntryFor(cx, cy);
      return !!bag && !bag.enabledCells?.includes(cx);
    },
    backgroundClass() {
      return {
        'artifact-grid-background': true,
        inventory: this.isInventoryVariant
      };
    },
    piecesClass() {
      return {
        'artifact-grid-pieces': true,
        'inventory-pieces': this.isInventoryVariant
      };
    },
    cellClass(index) {
      const cx = this.cellX(index);
      const cy = this.cellY(index);
      const baseInv = this.isBaseInventoryCell(cx, cy);
      const bagSlot = this.isBagSlotCell(cx, cy);
      const bagBox = !bagSlot && this.isBagBoxCell(cx, cy);
      // "Empty" only applies in the inventory variant — a cell outside the
      // base inventory and outside every bag's footprint is a bag-area drop
      // target (visually de-emphasised; only chip drag can re-anchor onto it).
      const empty = this.isInventoryVariant && !baseInv && !bagSlot && !bagBox;
      return {
        'artifact-grid-cell': true,
        cell: this.isInventoryVariant,
        'artifact-grid-cell--interactive': this.interactiveCells,
        'artifact-grid-cell--drop-target': this.droppable && this.hoverCellIndex === index,
        'artifact-grid-cell--base-inv': baseInv,
        'artifact-grid-cell--bag': bagSlot,
        'artifact-grid-cell--bag-disabled': bagBox,
        'artifact-grid-cell--bag-empty': empty
      };
    },
    cellStyle(index) {
      const cx = this.cellX(index);
      const cy = this.cellY(index);
      if (!this.isBagSlotCell(cx, cy)) return {};
      const bag = this.bagRowEntryFor(cx, cy);
      return {
        '--bag-color': bag.color,
        '--bag-color-light': bag.color + '33',
        '--bag-color-glow': bag.color + '40'
      };
    },
    clickCell(index) {
      if (!this.interactiveCells) return;
      this.$emit('cell-click', { x: this.cellX(index), y: this.cellY(index) });
    },
    clickPiece(item, event) {
      if (!this.clickablePieces) return;
      event.stopPropagation();
      this.$emit('piece-click', item);
    },
    rotatePiece(item, event) {
      event.stopPropagation();
      this.$emit('piece-rotate', item);
    },
    canRotate(item) {
      const artifact = this.getArtifact(item.artifactId);
      return !!artifact && artifact.width !== artifact.height;
    },
    onCellDragOver(index, event) {
      if (!this.droppable) return;
      const cx = this.cellX(index);
      const cy = this.cellY(index);
      if (this.isBagBoxCell(cx, cy)) return; // tetromino mask gap — not droppable
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.hoverCellIndex = index;
    },
    onCellDragLeave(index) {
      if (this.hoverCellIndex === index) this.hoverCellIndex = -1;
    },
    onCellDrop(index, event) {
      if (!this.droppable) return;
      const cx = this.cellX(index);
      const cy = this.cellY(index);
      if (this.isBagBoxCell(cx, cy)) return;
      event.preventDefault();
      this.hoverCellIndex = -1;
      this.$emit('cell-drop', { x: cx, y: cy, event });
    },
    onCellTouchDrop(index, event) {
      if (!this.droppable) return;
      const detail = event.detail || {};
      this.$emit('cell-drop', { x: detail.x ?? this.cellX(index), y: detail.y ?? this.cellY(index) });
    },
    pieceDataset(item) {
      return {
        'data-artifact-id': item.artifactId,
        'data-artifact-row-id': item.id || item.rowId || '',
        'data-artifact-x': item.x,
        'data-artifact-y': item.y,
        'data-artifact-width': item.width,
        'data-artifact-height': item.height,
        'data-artifact-bag-id': item.bagId || ''
      };
    }
  },
  template: `
    <div :class="rootClass" :data-testid="isInventoryVariant ? 'unified-grid' : null">
      <div :class="backgroundClass()" :style="gridStyle">
        <component
          :is="interactiveCells ? 'button' : 'span'"
          v-for="cell in totalCells"
          :key="cell"
          :class="cellClass(cell - 1)"
          :style="cellStyle(cell - 1)"
          :data-cell-x="cellX(cell - 1)"
          :data-cell-y="cellY(cell - 1)"
          @click="clickCell(cell - 1)"
          @dragover="onCellDragOver(cell - 1, $event)"
          @dragleave="onCellDragLeave(cell - 1)"
          @drop="onCellDrop(cell - 1, $event)"
          @cell-drop-touch.native="onCellTouchDrop(cell - 1, $event)"
        ></component>
      </div>
      <div :class="piecesClass()" :style="gridStyle">
        <div
          v-for="item in items"
          :key="item.artifactId + ':' + item.x + ':' + item.y"
          class="artifact-piece-wrap"
          :style="pieceStyle(item)"
          v-bind="pieceDataset(item)"
        >
          <component
            :is="clickablePieces ? 'button' : 'div'"
            class="artifact-piece"
            :class="{ mini: variant === 'catalog' }"
            :data-artifact-id="item.artifactId"
            :title="getArtifact(item.artifactId)?.name?.ru || item.artifactId"
            @click="clickPiece(item, $event)"
          >
            <artifact-figure
              :artifact="getArtifact(item.artifactId)"
              :display-width="item.width"
              :display-height="item.height"
            />
          </component>
          <button
            v-if="rotatablePieces && canRotate(item)"
            class="artifact-piece-rotate"
            type="button"
            aria-label="Rotate"
            @click="rotatePiece(item, $event)"
          >↻</button>
        </div>
      </div>
    </div>
  `
};
