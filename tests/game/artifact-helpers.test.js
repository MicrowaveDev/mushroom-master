import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAMILY_CAPS,
  familyCaps,
  isBag,
  isCombatArtifact,
  isContainerItem,
  contributesStats
} from '../../app/server/services/artifact-helpers.js';
import { getArtifactById } from '../../app/server/game-data.js';

test('FAMILY_CAPS has exactly the expected families', () => {
  assert.deepEqual(
    Object.keys(FAMILY_CAPS).sort(),
    ['armor', 'bag', 'damage', 'stun']
  );
});

test('familyCaps defaults to damage for unknown families', () => {
  assert.deepEqual(familyCaps('unknown'), FAMILY_CAPS.damage);
});

test('[Req 5-A] isBag: true for bag family, false for combat families', () => {
  assert.equal(isBag(getArtifactById('moss_pouch')), true);
  assert.equal(isBag(getArtifactById('amber_satchel')), true);
  assert.equal(isBag(getArtifactById('spore_needle')), false);
  assert.equal(isBag(getArtifactById('bark_plate')), false);
  assert.equal(isBag(null), false);
  assert.equal(isBag(undefined), false);
});

test('isCombatArtifact: true for damage/armor/stun, false for bag', () => {
  assert.equal(isCombatArtifact(getArtifactById('spore_needle')), true);
  assert.equal(isCombatArtifact(getArtifactById('bark_plate')), true);
  assert.equal(isCombatArtifact(getArtifactById('shock_puff')), true);
  assert.equal(isCombatArtifact(getArtifactById('moss_pouch')), false);
  assert.equal(isCombatArtifact(null), false);
});

test('[Req 2-C] isContainerItem: true for x<0 or y<0 without bagId', () => {
  assert.equal(isContainerItem({ x: -1, y: -1 }), true);
  assert.equal(isContainerItem({ x: 0, y: -1 }), true);
  assert.equal(isContainerItem({ x: -1, y: 0 }), true);
  assert.equal(isContainerItem({ x: 0, y: 0 }), false);
  // bagged items are not container items even if x<0
  assert.equal(isContainerItem({ x: -1, y: -1, bagId: 'moss_pouch' }), false);
});

test('[Req 2-C, 2-D, 5-F] contributesStats: placed combat items contribute, container and bags do not', () => {
  const combat = getArtifactById('spore_needle');
  const bag = getArtifactById('moss_pouch');

  // Grid-placed combat item → contributes
  assert.equal(contributesStats(combat, { x: 0, y: 0 }), true);
  // Container combat item → does not contribute
  assert.equal(contributesStats(combat, { x: -1, y: -1 }), false);
  // Bagged combat item → contributes (bagId set, no grid position needed)
  assert.equal(contributesStats(combat, { x: 0, y: 0, bagId: 'moss_pouch' }), true);
  // Bag itself → never contributes
  assert.equal(contributesStats(bag, { x: 0, y: 0 }), false);
});
