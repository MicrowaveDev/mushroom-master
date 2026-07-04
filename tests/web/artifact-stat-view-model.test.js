import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTotals } from '../../web/src/artifacts/grid.js';
import { ArtifactStatSummary } from '../../web/src/components/ArtifactStatSummary.js';

test('[artifact-stats] derives loadout totals through the shared core helper', () => {
  const artifacts = [
    { id: 'needle', bonus: { damage: 2, speed: -1 } },
    { id: 'plate', bonus: { armor: 3, stunChance: 5 } }
  ];

  assert.deepEqual(deriveTotals([
    { artifactId: 'needle' },
    { artifactId: 'plate' },
    { artifactId: 'missing' }
  ], artifacts), {
    damage: 2,
    armor: 3,
    speed: -1,
    stunChance: 5
  });
});

test('[artifact-stats] formats stat summary chips through the shared entry DTO', () => {
  const items = ArtifactStatSummary.computed.statSummaryItems.call({
    totals: { damage: 2, armor: 0, speed: -1, stunChance: 5 },
    artifact: null,
    lang: 'en',
    includeZeroes: false
  });

  assert.deepEqual(items.map((item) => ({
    id: item.id,
    label: item.label,
    text: item.text,
    sign: item.sign,
    hasRole: Boolean(item.role)
  })), [
    { id: 'damage', label: 'Damage', text: '+2', sign: 'positive', hasRole: true },
    { id: 'speed', label: 'Speed', text: '-1', sign: 'negative', hasRole: false },
    { id: 'stunChance', label: 'Stun', text: '+5%', sign: 'positive', hasRole: true }
  ]);
});
