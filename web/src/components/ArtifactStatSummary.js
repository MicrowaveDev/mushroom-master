import { ArtifactStatSummary as CoreArtifactStatSummary } from '@microwavedev/backpack-game-core/vue/components';
import { ARTIFACT_ROLE_CLASSES } from '../../../app/shared/artifact-visual-classification.js';

const STAT_DEFINITIONS = [
  { id: 'damage', sourceKey: 'damage', roleId: 'damage' },
  { id: 'armor', sourceKey: 'armor', roleId: 'armor' },
  { id: 'speed', sourceKey: 'speed', roleId: null },
  { id: 'stunChance', sourceKey: 'stunChance', roleId: 'stun', suffix: '%' }
];

const STAT_LABELS = {
  ru: {
    damage: 'Урон',
    armor: 'Броня',
    speed: 'Скорость',
    stunChance: 'Оглушение'
  },
  en: {
    damage: 'Damage',
    armor: 'Armor',
    speed: 'Speed',
    stunChance: 'Stun'
  }
};

function hasEntries(value) {
  return value && typeof value === 'object' && Object.keys(value).length > 0;
}

export const ArtifactStatSummary = {
  ...CoreArtifactStatSummary,
  props: {
    ...CoreArtifactStatSummary.props,
    lang: { type: String, default: 'ru' }
  },
  computed: {
    ...CoreArtifactStatSummary.computed,
    statSummaryItems() {
      const lang = this.lang === 'en' ? 'en' : 'ru';
      return CoreArtifactStatSummary.computed.statSummaryItems.call({
        rows: this.rows,
        source: this.source,
        totals: this.totals,
        artifact: this.artifact,
        statSource: this.source || this.totals || this.artifact?.bonus || null,
        definitions: this.definitions?.length ? this.definitions : STAT_DEFINITIONS,
        labels: hasEntries(this.labels) ? this.labels : STAT_LABELS[lang],
        roleMap: hasEntries(this.roleMap) ? this.roleMap : ARTIFACT_ROLE_CLASSES,
        includeZeroes: this.includeZeroes
      });
    }
  }
};
