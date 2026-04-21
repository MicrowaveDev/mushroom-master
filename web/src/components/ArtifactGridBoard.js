import { INVENTORY_COLUMNS, INVENTORY_ROWS } from '../constants.js';

export const ArtifactGridBoard = {
  props: {
    columns: { type: Number, default: INVENTORY_COLUMNS },
    rows: { type: Number, default: INVENTORY_ROWS },
    items: { type: Array, default: () => [] },
    variant: { type: String, default: 'inventory' },
    renderArtifactFigure: { type: Function, required: true },
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
    totalCells() {
      return this.columns * this.rows;
    },
    gridStyle() {
      return {
        gridTemplateColumns: `repeat(${this.columns}, var(--artifact-cell-size, 50px))`,
        gridTemplateRows: `repeat(${this.rows}, var(--artifact-cell-size, 50px))`
      };
    },
    rootClass() {
      return {
        'artifact-grid-board': true,
        'inventory-shell': this.variant === 'inventory',
        'artifact-grid-board--inventory': this.variant === 'inventory',
        'artifact-grid-board--catalog': this.variant === 'catalog'
      };
    }
  },
  methods: {
    cellX(index) {
      return index % this.columns;
    },
    cellY(index) {
      return Math.floor(index / this.columns);
    },
    pieceStyle(item) {
      return {
        gridColumn: `${item.x + 1} / span ${item.width}`,
        gridRow: `${item.y + 1} / span ${item.height}`
      };
    },
    backgroundClass() {
      return {
        'artifact-grid-background': true,
        inventory: this.variant === 'inventory'
      };
    },
    piecesClass() {
      return {
        'artifact-grid-pieces': true,
        'inventory-pieces': this.variant === 'inventory'
      };
    },
    bagRowForCell(index) {
      const y = this.cellY(index);
      return this.bagRows.find((br) => br.row === y);
    },
    isBagCellDisabled(index) {
      const bag = this.bagRowForCell(index);
      if (!bag) return false;
      const xInRow = this.cellX(index);
      // Tetromino-shaped bags expose `enabledCells` (the x positions in
      // this row that are actual slots). Pre-shape rectangular bags can
      // keep the legacy `slotCount` shape (= [0..slotCount-1]).
      if (bag.enabledCells) return !bag.enabledCells.includes(xInRow);
      return xInRow >= bag.slotCount;
    },
    cellClass(index) {
      return {
        'artifact-grid-cell': true,
        cell: this.variant === 'inventory',
        'artifact-grid-cell--interactive': this.interactiveCells,
        'artifact-grid-cell--drop-target': this.droppable && this.hoverCellIndex === index,
        'artifact-grid-cell--bag': !!this.bagRowForCell(index) && !this.isBagCellDisabled(index),
        'artifact-grid-cell--bag-disabled': this.isBagCellDisabled(index)
      };
    },
    cellStyle(index) {
      const bag = this.bagRowForCell(index);
      if (!bag || this.isBagCellDisabled(index)) return {};
      return {
        '--bag-color': bag.color,
        '--bag-color-light': bag.color + '33',
        '--bag-color-glow': bag.color + '40'
      };
    },
    clickCell(index) {
      if (!this.interactiveCells) {
        return;
      }
      this.$emit('cell-click', { x: this.cellX(index), y: this.cellY(index) });
    },
    clickPiece(item, event) {
      if (!this.clickablePieces) {
        return;
      }
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
      if (!this.droppable || this.isBagCellDisabled(index)) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      this.hoverCellIndex = index;
    },
    onCellDragLeave(index) {
      if (this.hoverCellIndex === index) {
        this.hoverCellIndex = -1;
      }
    },
    onCellDrop(index, event) {
      if (!this.droppable || this.isBagCellDisabled(index)) return;
      event.preventDefault();
      this.hoverCellIndex = -1;
      this.$emit('cell-drop', { x: this.cellX(index), y: this.cellY(index), event });
    },
    onCellTouchDrop(index, event) {
      // Handle touch-dispatched cell-drop from useTouch composable
      if (!this.droppable) return;
      const detail = event.detail || {};
      this.$emit('cell-drop', { x: detail.x ?? this.cellX(index), y: detail.y ?? this.cellY(index) });
    },
    onPieceDragStart(item, event) {
      if (!this.draggablePieces) return;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.artifactId);
      }
      this.$emit('piece-drag-start', { item, event });
    },
    onPieceDragEnd(item, event) {
      if (!this.draggablePieces) return;
      this.$emit('piece-drag-end', { item, event });
    },
    renderPieceFigure(item) {
      return this.renderArtifactFigure(this.getArtifact(item.artifactId), item.width, item.height);
    }
  },
  template: `
    <div :class="rootClass">
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
          :draggable="draggablePieces"
          @dragstart="onPieceDragStart(item, $event)"
          @dragend="onPieceDragEnd(item, $event)"
        >
          <component
            :is="clickablePieces ? 'button' : 'div'"
            class="artifact-piece"
            :class="{ mini: variant === 'catalog' }"
            :data-artifact-id="item.artifactId"
            :title="getArtifact(item.artifactId)?.name?.ru || item.artifactId"
            @click="clickPiece(item, $event)"
            v-html="renderPieceFigure(item)"
          ></component>
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
