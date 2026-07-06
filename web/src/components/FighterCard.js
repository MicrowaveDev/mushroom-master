import { FighterCard as CoreFighterCard } from '@microwavedev/backpack-game-core/vue/components';
import { BAG_COLUMNS, BAG_ROWS } from '../constants.js';
import { ArtifactGridBoard } from './ArtifactGridBoard.js';

export const FighterCard = {
  ...CoreFighterCard,
  components: { ArtifactGridBoard },
  props: {
    ...CoreFighterCard.props,
    mushroom: { type: Object, default: null },
    gridBoardComponent: { type: [String, Object], default: () => ArtifactGridBoard },
    gridColumns: { type: Number, default: BAG_COLUMNS },
    gridMinRows: { type: Number, default: BAG_ROWS }
  },
  computed: {
    ...CoreFighterCard.computed,
    resolvedCombatant() {
      return this.combatant || this.mushroom;
    }
  }
};
