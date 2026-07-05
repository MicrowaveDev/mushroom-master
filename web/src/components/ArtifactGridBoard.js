import { BAG_COLUMNS, BAG_ROWS, INVENTORY_COLUMNS, INVENTORY_ROWS } from '../constants.js';
import {
  shapeGridBoardCells,
  shapeGridBoardPieces
} from '@microwavedev/backpack-game-core/client-view-model';
import { BackpackGrid } from '@microwavedev/backpack-game-core/vue/components';
import { ArtifactFigure } from './ArtifactFigure.js';

function bagWatermarkOffset(artifactId, rotation) {
  if (artifactId !== 'birchbark_hook') return { x: '0px', y: '0px' };
  switch (rotation) {
    case 1:
      return { x: '4px', y: '-10px' };
    case 2:
      return { x: '8px', y: '3px' };
    case 3:
      return { x: '-3px', y: '10px' };
    default:
      return { x: '-8px', y: '-3px' };
  }
}

export const ArtifactGridBoard = {
  components: { ArtifactFigure, BackpackGrid },
  props: {
    // For non-inventory variants (catalog, fighter card) the legacy
    // `columns` / `rows` props still describe a uniform grid.
    columns: { type: Number, default: INVENTORY_COLUMNS },
    rows: { type: Number, default: INVENTORY_ROWS },
    // For inventory variant: the full unified grid is rendered as ONE grid
    // BAG_COLUMNS wide, totalRows tall. Bags provide all usable cells.
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
    bagRows: { type: Array, default: () => [] },
    placementPreviewForCell: { type: Function, default: null },
    highlightedRowIds: { type: [Array, Object], default: () => new Set() },
    highlightedTitle: { type: String, default: '' }
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
    placementPreview() {
      if (!this.placementPreviewForCell || this.hoverCellIndex < 0) return null;
      const preview = this.placementPreviewForCell({
        x: this.cellX(this.hoverCellIndex),
        y: this.cellY(this.hoverCellIndex)
      });
      if (!preview?.cells?.length) return null;
      return {
        ...preview,
        cellSet: new Set(preview.cells)
      };
    },
    gridCells() {
      return shapeGridBoardCells({
        columns: this.gridColumns,
        rows: this.gridRows,
        bagRows: this.bagRows,
        items: this.items,
        baseRect: { cols: 3, rows: 3 },
        inventoryVariant: this.isInventoryVariant,
        placementPreview: this.placementPreview,
        hoverCellIndex: this.hoverCellIndex,
        interactiveCells: this.interactiveCells,
        droppable: this.droppable
      });
    },
    gridPieces() {
      return shapeGridBoardPieces(this.items, {
        highlightedRowIds: this.highlightedRowIds
      });
    },
    renderedCells() {
      return this.gridCells.map((cell) => ({
        ...cell,
        as: this.interactiveCells ? 'button' : 'span',
        classNames: this.cellClass(cell),
        style: this.cellStyle(cell),
        attrs: {
          'data-cell-x': cell.x,
          'data-cell-y': cell.y
        }
      }));
    },
    renderedPieces() {
      return this.gridPieces.map((item) => {
        const artifact = this.getArtifact(item.artifactId);
        return {
          ...item,
          classNames: {
            'artifact-piece-wrap': true,
            'artifact-piece-wrap--fusion-pending': this.isHighlighted(item)
          },
          style: this.pieceStyle(item),
          title: this.isHighlighted(item) ? this.highlightedTitle : null,
          attrs: this.pieceDataset(item),
          actionClass: {
            'artifact-piece': true,
            mini: this.variant === 'catalog'
          },
          ariaLabel: this.clickablePieces ? (artifact?.name?.ru || item.artifactId) : null,
          canRotate: this.canRotate(item)
        };
      });
    },
    renderedBagOverlays() {
      return this.bagOverlays.map((overlay) => ({
        ...overlay,
        className: 'artifact-grid-bag-watermark',
        style: this.bagOverlayStyle(overlay)
      }));
    },
    bagOverlays() {
      const groups = new Map();
      for (const row of this.bagRows || []) {
        if (!row?.artifactId || row.artifactId === 'starter_bag') continue;
        const key = row.bagId || `${row.artifactId}:${row.bboxStart}:${row.bboxEnd}`;
        const group = groups.get(key) || {
          key,
          artifactId: row.artifactId,
          // Quarter-turns CW (0..3) for this bag instance. All row entries
          // for a single bag carry the same rotation, so the first one wins.
          rotation: ((row.rotation % 4) + 4) % 4 || 0,
          minRow: row.row,
          maxRow: row.row,
          minCol: row.bboxStart ?? Math.min(...(row.enabledCells || [0])),
          maxCol: row.bboxEnd ?? (Math.max(...(row.enabledCells || [0])) + 1)
        };
        group.minRow = Math.min(group.minRow, row.row);
        group.maxRow = Math.max(group.maxRow, row.row);
        group.minCol = Math.min(group.minCol, row.bboxStart ?? group.minCol);
        group.maxCol = Math.max(group.maxCol, row.bboxEnd ?? group.maxCol);
        groups.set(key, group);
      }
      return Array.from(groups.values());
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
        gridRow: `${item.y + 1} / span ${item.height}`,
        width: `calc(${item.width} * var(--artifact-cell-size, 50px) + ${Math.max(0, item.width - 1)} * var(--board-gap, 8px))`,
        height: `calc(${item.height} * var(--artifact-cell-size, 50px) + ${Math.max(0, item.height - 1)} * var(--board-gap, 8px))`
      };
    },
    bagOverlayStyle(overlay) {
      const colSpan = overlay.maxCol - overlay.minCol;
      const rowSpan = overlay.maxRow - overlay.minRow + 1;
      const rotation = overlay.rotation || 0;
      // For 90°/270° rotations, the canonical PNG's aspect is SWAPPED
      // relative to the rotated bbox. We size the element to its CANONICAL
      // (pre-rotation) dims, anchor it at the bbox top-left with
      // transform-origin: 0 0, then rotate about that corner and translate
      // so the rotated visual lands exactly inside the rotated bbox
      // without distorting the PNG.
      const isQuarter = rotation === 1 || rotation === 3;
      const elemCols = isQuarter ? rowSpan : colSpan;
      const elemRows = isQuarter ? colSpan : rowSpan;
      const cellGap = '(var(--artifact-cell-size, 50px) + var(--board-gap, 8px))';
      const elemWidth = `calc(${elemCols} * var(--artifact-cell-size, 50px) + ${Math.max(0, elemCols - 1)} * var(--board-gap, 8px))`;
      const elemHeight = `calc(${elemRows} * var(--artifact-cell-size, 50px) + ${Math.max(0, elemRows - 1)} * var(--board-gap, 8px))`;
      const bboxWidth = `calc(${colSpan} * var(--artifact-cell-size, 50px) + ${Math.max(0, colSpan - 1)} * var(--board-gap, 8px))`;
      const bboxHeight = `calc(${rowSpan} * var(--artifact-cell-size, 50px) + ${Math.max(0, rowSpan - 1)} * var(--board-gap, 8px))`;
      // CSS transform list applies right-to-left: rotate first, then
      // translate. So `translate(X, Y) rotate(deg)` rotates the element
      // about its top-left, then shifts the rotated result by (X, Y).
      let transform = 'none';
      if (rotation === 1) transform = `translate(${bboxWidth}, 0) rotate(90deg)`;
      else if (rotation === 2) transform = `translate(${bboxWidth}, ${bboxHeight}) rotate(180deg)`;
      else if (rotation === 3) transform = `translate(0, ${bboxHeight}) rotate(-90deg)`;
      const watermarkOffset = bagWatermarkOffset(overlay.artifactId, rotation);
      return {
        left: `calc(${overlay.minCol} * ${cellGap} + ${watermarkOffset.x})`,
        top: `calc(${overlay.minRow} * ${cellGap} + ${watermarkOffset.y})`,
        width: elemWidth,
        height: elemHeight,
        backgroundImage: `url('/artifacts/${overlay.artifactId}.png')`,
        transform,
        transformOrigin: '0 0'
      };
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
    cellClass(cell) {
      return {
        'artifact-grid-cell': true,
        cell: this.isInventoryVariant,
        'artifact-grid-cell--interactive': cell.interactive,
        'artifact-grid-cell--drop-target': cell.dropTarget,
        'artifact-grid-cell--base-inv': cell.baseInventory,
        'artifact-grid-cell--bag': cell.bagSlot,
        'artifact-grid-cell--occupied': cell.occupied,
        'artifact-grid-cell--bag-disabled': cell.bagBox,
        'artifact-grid-cell--bag-empty': cell.bagEmpty,
        'artifact-grid-cell--preview': cell.preview,
        'artifact-grid-cell--preview-valid': cell.previewValid,
        'artifact-grid-cell--preview-invalid': cell.previewInvalid,
        [`artifact-grid-cell--preview-${cell.previewFamily || 'none'}`]: cell.preview
      };
    },
    cellStyle(cell) {
      if (cell.baseInventory || !cell.bagSlot || !cell.bagColor) return {};
      return {
        '--bag-color': cell.bagColor,
        '--bag-color-light': cell.bagColor + '33',
        '--bag-color-glow': cell.bagColor + '40'
      };
    },
    clickCell(cell) {
      if (!this.interactiveCells) return;
      this.$emit('cell-click', { x: cell.x, y: cell.y });
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
    onCellDragOver(cell, event) {
      if (!this.droppable) return;
      if (cell.bagBox && !this.placementPreviewForCell) return; // tetromino mask gap — not droppable
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.hoverCellIndex = cell.index;
    },
    onCellDragLeave(cell) {
      if (this.hoverCellIndex === cell.index) this.hoverCellIndex = -1;
    },
    onCellDrop(cell, event) {
      if (!this.droppable) return;
      if (cell.bagBox) return;
      event.preventDefault();
      this.hoverCellIndex = -1;
      this.$emit('cell-drop', { x: cell.x, y: cell.y, event });
    },
    onCellTouchDrop(cell, event) {
      if (!this.droppable) return;
      const detail = event.detail || {};
      this.$emit('cell-drop', { x: detail.x ?? cell.x, y: detail.y ?? cell.y });
    },
    handleCellDragOver({ cell, event }) {
      this.onCellDragOver(cell, event);
    },
    handleCellDrop({ cell, event }) {
      this.onCellDrop(cell, event);
    },
    handleCellTouchDrop({ cell, event }) {
      this.onCellTouchDrop(cell, event);
    },
    handlePieceClick({ piece, event }) {
      this.clickPiece(piece, event);
    },
    handlePieceRotate({ piece, event }) {
      this.rotatePiece(piece, event);
    },
    pieceDataset(item) {
      const dataset = item.dataset || {};
      return {
        'data-artifact-id': dataset.artifactId ?? item.artifactId,
        'data-artifact-row-id': dataset.rowId ?? item.id ?? item.rowId ?? '',
        'data-artifact-x': dataset.x ?? item.x,
        'data-artifact-y': dataset.y ?? item.y,
        'data-artifact-width': dataset.width ?? item.width,
        'data-artifact-height': dataset.height ?? item.height
      };
    },
    isHighlighted(item) {
      if (item.highlighted != null) return item.highlighted;
      const rowId = item?.id || item?.rowId || '';
      if (!rowId || !this.highlightedRowIds) return false;
      if (typeof this.highlightedRowIds.has === 'function') return this.highlightedRowIds.has(rowId);
      if (Array.isArray(this.highlightedRowIds)) return this.highlightedRowIds.includes(rowId);
      return false;
    }
  },
  template: `
    <backpack-grid
      :cells="renderedCells"
      :pieces="renderedPieces"
      :overlays="renderedBagOverlays"
      :grid-style="gridStyle"
      :root-class="rootClass"
      :background-class="backgroundClass()"
      :pieces-class="piecesClass()"
      :test-id="isInventoryVariant ? 'unified-grid' : ''"
      :interactive-cells="interactiveCells"
      :clickable-pieces="clickablePieces"
      :rotatable-pieces="rotatablePieces"
      :droppable="droppable"
      rotate-text="↻"
      @cell-click="clickCell"
      @cell-dragover="handleCellDragOver"
      @cell-dragleave="onCellDragLeave"
      @cell-drop="handleCellDrop"
      @cell-touch-drop="handleCellTouchDrop"
      @piece-click="handlePieceClick"
      @piece-rotate="handlePieceRotate"
    >
      <template #piece-content="{ piece }">
        <artifact-figure
          :artifact="getArtifact(piece.artifactId)"
          :display-width="piece.width"
          :display-height="piece.height"
        />
      </template>
    </backpack-grid>
  `
};
