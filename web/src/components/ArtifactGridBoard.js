import { ArtifactGridBoard as CoreArtifactGridBoard } from '@microwavedev/backpack-game-core/vue/components';
import { BAG_COLUMNS, BAG_ROWS, INVENTORY_COLUMNS, INVENTORY_ROWS } from '../constants.js';
import { artifactBitmapPath } from '../artifacts/render.js';
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
  ...CoreArtifactGridBoard,
  name: 'ArtifactGridBoard',
  props: {
    ...CoreArtifactGridBoard.props,
    columns: { type: Number, default: INVENTORY_COLUMNS },
    rows: { type: Number, default: INVENTORY_ROWS },
    inventoryColumns: { type: Number, default: BAG_COLUMNS },
    inventoryRows: { type: Number, default: BAG_ROWS },
    artifactFigureComponent: { type: [Object, Function], default: ArtifactFigure },
    artifactImageFor: { type: Function, default: artifactBitmapPath },
    containerWatermarkOffsetFor: { type: Function, default: bagWatermarkOffset }
  }
};
