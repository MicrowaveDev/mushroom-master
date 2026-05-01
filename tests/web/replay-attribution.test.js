import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplayDuel } from '../../web/src/components/ReplayDuel.js';
import { getArtifactById } from '../../app/server/game-data.js';

test('[Req 6-K] replay attribution chips are absent for legacy action events', () => {
  const groups = ReplayDuel.computed.activeAttributionGroups.call({
    activeEvent: { type: 'action', damage: 5, stunned: false },
    getArtifact: getArtifactById
  });

  assert.deepEqual(groups, []);
});

test('[Req 6-K] replay attribution groups resolve artifact names and values', () => {
  const groups = ReplayDuel.computed.activeAttributionGroups.call({
    activeEvent: {
      type: 'action',
      artifactAttribution: {
        damage: [{ artifactId: 'spore_needle', itemId: 'row-a', value: 2 }],
        stunChance: [{ artifactId: 'shock_puff', itemId: 'row-b', value: 8 }],
        armor: [{ artifactId: 'bark_plate', itemId: 'row-c', value: 2 }]
      }
    },
    getArtifact: getArtifactById
  });

  assert.deepEqual(
    groups.map((group) => [group.key, group.items.map((item) => [item.artifactId, item.name, item.value])]),
    [
      ['damage', [['spore_needle', 'Spore Needle', 2]]],
      ['stunChance', [['shock_puff', 'Shock Puff', 8]]],
      ['armor', [['bark_plate', 'Bark Plate', 2]]]
    ]
  );
  assert.equal(
    ReplayDuel.methods.attributionValueText.call({}, groups[1], groups[1].items[0]),
    '+8%'
  );
});
