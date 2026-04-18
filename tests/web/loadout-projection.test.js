// Pin the routing rules of the client-side loadout projection.
// See web/src/composables/loadout-projection.js and
// docs/bag-active-persistence.md.
//
// This is the single bottleneck where the server's loadoutItems array
// turns into the four client state buckets. Getting it wrong silently
// corrupts every downstream op (place, sell, drag, rotate, activate),
// so every routing rule should have a pinned test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { projectLoadoutItems } from '../../web/src/composables/loadout-projection.js';

const BAG_IDS = new Set(['moss_pouch', 'amber_satchel']);

function row(overrides) {
  return {
    id: 'grlitem_default',
    artifactId: 'spore_needle',
    x: -1,
    y: -1,
    width: 1,
    height: 1,
    bagId: null,
    active: false,
    rotated: false,
    freshPurchase: false,
    ...overrides
  };
}

test('[projection] grid-placed non-bag items land in builderItems', () => {
  const result = projectLoadoutItems([
    row({ id: 'a', artifactId: 'spore_lash', x: 0, y: 0 }),
    row({ id: 'b', artifactId: 'spore_needle', x: 1, y: 0 })
  ], BAG_IDS);
  assert.equal(result.builderItems.length, 2);
  assert.equal(result.builderItems[0].id, 'a');
  assert.equal(result.builderItems[0].x, 0);
  assert.equal(result.containerItems.length, 0);
  assert.equal(result.activeBags.length, 0);
});

test('[projection] container non-bag items (-1,-1) land in containerItems', () => {
  const result = projectLoadoutItems([
    row({ id: 'c', artifactId: 'bark_plate' }),
    row({ id: 'd', artifactId: 'bark_plate' })
  ], BAG_IDS);
  assert.equal(result.containerItems.length, 2);
  assert.equal(result.containerItems[0].id, 'c');
  assert.equal(result.containerItems[0].artifactId, 'bark_plate');
  assert.equal(result.builderItems.length, 0);
});

test('[projection] bag with active=true lands in activeBags', () => {
  const result = projectLoadoutItems([
    row({ id: 'e', artifactId: 'moss_pouch', active: true })
  ], BAG_IDS);
  assert.equal(result.activeBags.length, 1);
  assert.equal(result.activeBags[0].id, 'e');
  assert.equal(result.activeBags[0].artifactId, 'moss_pouch');
  assert.equal(result.containerItems.length, 0);
});

test('[projection] bag with active=false lands in containerItems', () => {
  const result = projectLoadoutItems([
    row({ id: 'f', artifactId: 'moss_pouch', active: false })
  ], BAG_IDS);
  assert.equal(result.containerItems.length, 1);
  assert.equal(result.containerItems[0].id, 'f');
  assert.equal(result.containerItems[0].artifactId, 'moss_pouch');
  assert.equal(result.activeBags.length, 0);
});

test('[projection] bagged items (bagId set) land in builderItems with bagId', () => {
  const result = projectLoadoutItems([
    row({ id: 'g', artifactId: 'moss_pouch', active: true }),
    row({
      id: 'h',
      artifactId: 'spore_needle',
      bagId: 'moss_pouch',
      x: -1,
      y: -1
    })
  ], BAG_IDS);
  assert.equal(result.activeBags.length, 1);
  // Bagged item lives in builderItems so the grid renderer groups it
  // under the bag's virtual rows.
  assert.equal(result.builderItems.length, 1);
  assert.equal(result.builderItems[0].id, 'h');
  assert.equal(result.builderItems[0].bagId, 'moss_pouch');
});

test('[projection] freshPurchase items get their artifactId in freshPurchases', () => {
  const result = projectLoadoutItems([
    row({ id: 'i', artifactId: 'bark_plate', freshPurchase: true }),
    row({ id: 'j', artifactId: 'spore_lash', x: 0, y: 0, freshPurchase: true }),
    row({ id: 'k', artifactId: 'moss_pouch', active: true, freshPurchase: true })
  ], BAG_IDS);
  assert.deepEqual(result.freshPurchases.sort(), [
    'bark_plate',
    'moss_pouch',
    'spore_lash'
  ]);
});

test('[projection] duplicates hydrate as separate slots keyed by row id', () => {
  // Regression: the row id refactor (docs/client-row-id-refactor.md) pins
  // duplicate-aware identity. Two moss_pouches, one active and one not,
  // must land in different buckets and not collapse together.
  const result = projectLoadoutItems([
    row({ id: 'active_one', artifactId: 'moss_pouch', active: true }),
    row({ id: 'container_one', artifactId: 'moss_pouch', active: false })
  ], BAG_IDS);
  assert.equal(result.activeBags.length, 1);
  assert.equal(result.activeBags[0].id, 'active_one');
  assert.equal(result.containerItems.length, 1);
  assert.equal(result.containerItems[0].id, 'container_one');
});

test('[projection] accepts either a Set or an array for bagArtifactIds', () => {
  const fromSet = projectLoadoutItems(
    [row({ id: 'l', artifactId: 'moss_pouch', active: true })],
    new Set(['moss_pouch'])
  );
  const fromArray = projectLoadoutItems(
    [row({ id: 'l', artifactId: 'moss_pouch', active: true })],
    ['moss_pouch']
  );
  assert.deepEqual(fromSet, fromArray);
});

// Rotation routing — see docs/bag-rotated-persistence.md.

test('[projection] bag with rotated=true lands in rotatedBags', () => {
  const result = projectLoadoutItems([
    row({ id: 'r1', artifactId: 'moss_pouch', active: true, rotated: true })
  ], BAG_IDS);
  assert.equal(result.rotatedBags.length, 1);
  assert.equal(result.rotatedBags[0].id, 'r1');
  assert.equal(result.rotatedBags[0].artifactId, 'moss_pouch');
});

test('[projection] bag with rotated=false stays out of rotatedBags', () => {
  const result = projectLoadoutItems([
    row({ id: 'r2', artifactId: 'moss_pouch', active: true, rotated: false })
  ], BAG_IDS);
  assert.equal(result.rotatedBags.length, 0);
  assert.equal(result.activeBags.length, 1);
});

test('[projection] rotation state survives across active+container bags', () => {
  // A rotated bag can be either active or in the container — the
  // rotation bit is orthogonal to activation. Pin that the projection
  // routes each independently.
  const result = projectLoadoutItems([
    row({ id: 'a1', artifactId: 'moss_pouch', active: true, rotated: true }),
    row({ id: 'c1', artifactId: 'amber_satchel', active: false, rotated: true })
  ], BAG_IDS);
  assert.equal(result.activeBags.length, 1);
  assert.equal(result.activeBags[0].id, 'a1');
  assert.equal(result.containerItems.length, 1);
  assert.equal(result.containerItems[0].id, 'c1');
  assert.equal(result.rotatedBags.length, 2);
  assert.deepEqual(
    result.rotatedBags.map((b) => b.id).sort(),
    ['a1', 'c1']
  );
});

test('[projection] duplicate bags with different rotation states hydrate separately', () => {
  // Regression: rotatedBags used to be a string[] of artifactIds, which
  // couldn't represent "moss_pouch #A rotated, moss_pouch #B not". Now
  // it's Array<{id, artifactId}>, so the row id disambiguates.
  const result = projectLoadoutItems([
    row({ id: 'rot_one', artifactId: 'moss_pouch', active: true, rotated: true }),
    row({ id: 'plain_one', artifactId: 'moss_pouch', active: true, rotated: false })
  ], BAG_IDS);
  assert.equal(result.activeBags.length, 2);
  assert.equal(result.rotatedBags.length, 1);
  assert.equal(result.rotatedBags[0].id, 'rot_one');
});
