import { formatArtifactBonusEntries } from '@microwavedev/backpack-game-core/client-view-model';
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

export const ArtifactStatSummary = {
  name: 'ArtifactStatSummary',
  props: {
    artifact: { type: Object, default: null },
    totals: { type: Object, default: null },
    lang: { type: String, default: 'ru' },
    includeZeroes: { type: Boolean, default: true },
    variant: { type: String, default: '' },
    ariaLabel: { type: String, default: 'Artifact stat summary' }
  },
  computed: {
    statSummaryItems() {
      const source = this.totals || this.artifact?.bonus;
      if (!source) return [];
      const lang = this.lang === 'en' ? 'en' : 'ru';
      const definitionsByKey = new Map(STAT_DEFINITIONS.map((item) => [item.sourceKey, item]));
      return formatArtifactBonusEntries(source, {
        labels: STAT_LABELS[lang],
        statKeys: STAT_DEFINITIONS.map((item) => item.sourceKey),
        includeZeroes: this.includeZeroes
      })
        .map((entry) => {
          const item = definitionsByKey.get(entry.key);
          const value = entry.numericValue;
          return {
            ...item,
            value,
            role: item.roleId ? ARTIFACT_ROLE_CLASSES[item.roleId] : null,
            label: entry.label,
            text: entry.value,
            sign: value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero'
          };
        });
    },
    summaryClass() {
      return this.variant ? `artifact-stat-summary--${this.variant}` : '';
    }
  },
  template: `
    <span
      v-if="statSummaryItems.length"
      class="artifact-stat-summary artifact-inventory-stats"
      :class="summaryClass"
      :aria-label="ariaLabel"
    >
      <span
        v-for="item in statSummaryItems"
        :key="item.id"
        class="artifact-inventory-stat-chip"
        :class="[
          'artifact-inventory-stat-chip--' + item.sign,
          { 'artifact-inventory-stat-chip--plain': !item.role }
        ]"
        :style="item.role ? { '--artifact-role-color': item.role.color } : null"
      >
        <span
          v-if="item.role"
          class="artifact-role-glyph artifact-role-legend-glyph"
          :class="'artifact-role-glyph--' + item.roleId"
          aria-hidden="true"
        ><span></span></span>
        <span class="artifact-inventory-stat-label">{{ item.label }}</span>
        <b>{{ item.text }}</b>
      </span>
    </span>
  `
};
