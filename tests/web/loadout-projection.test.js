// Pin the routing rules of the client-side loadout projection.
// See web/src/composables/loadout-projection.js and
// docs/bag-item-placement-persistence.md.
//
// This is the single bottleneck where the server's loadoutItems array
// turns into the four client state buckets. Getting it wrong silently
// corrupts every downstream op (place, sell, drag, rotate, activate),
// so every routing rule should have a pinned test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { projectLoadoutItems } from '../../web/src/composables/loadout-projection.js';

const BAG_IDS = new Set(['moss_pouch', 'amber_satchel']);

// Minimal artifact stubs so the projection can reconstruct bag layouts.
// moss_pouch: 1×2, 2 slots. amber_satchel: 2×2, 4 slots. Non-bag items
// never hit the layout lookup; a blank stub is fine.
const ARTIFACTS = {
  moss_pouch: { id: 'moss_pouch', family: 'bag', width: 1, height: 2, slotCount: 2 },
  amber_satchel: { id: 'amber_satchel', family: 'bag', width: 2, height: 2, slotCount: 4 },
  spore_needle: { id: 'spore_needle', family: 'damage', width: 1, height: 1 },
  bark_plate: { id: 'bark_plate', family: 'armor', width: 1, height: 1 },
  spore_lash: { id: 'spore_lash', family: 'damage', width: 1, height: 1 }
};
const getArtifact = (id) => ARTIFACTS[id] || null;

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
  ], BAG_IDS, getArtifact);
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
  ], BAG_IDS, getArtifact);
  assert.equal(result.containerItems.length, 2);
  assert.equal(result.containerItems[0].id, 'c');
  assert.equal(result.containerItems[0].artifactId, 'bark_plate');
  assert.equal(result.builderItems.length, 0);
});

test('[projection] bag with active=true lands in activeBags', () => {
  const result = projectLoadoutItems([
    row({ id: 'e', artifactId: 'moss_pouch', active: true })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 1);
  assert.equal(result.activeBags[0].id, 'e');
  assert.equal(result.activeBags[0].artifactId, 'moss_pouch');
  assert.equal(result.containerItems.length, 0);
});

test('[projection] bag with active=false lands in containerItems', () => {
  const result = projectLoadoutItems([
    row({ id: 'f', artifactId: 'moss_pouch', active: false })
  ], BAG_IDS, getArtifact);
  assert.equal(result.containerItems.length, 1);
  assert.equal(result.containerItems[0].id, 'f');
  assert.equal(result.containerItems[0].artifactId, 'moss_pouch');
  assert.equal(result.activeBags.length, 0);
});

test('[projection] bagged items with slot coords land in builderItems at reconstructed virtual y', () => {
  // Storage: bagged item lives at slot (0, 0) inside the moss_pouch row
  // "g". The projection must add the bag's startRow (= INVENTORY_ROWS = 3
  // for the first active bag) to reconstruct a virtual render y = 3.
  const result = projectLoadoutItems([
    row({ id: 'g', artifactId: 'moss_pouch', active: true }),
    row({
      id: 'h',
      artifactId: 'spore_needle',
      bagId: 'g',
      x: 0,
      y: 0
    })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 1);
  assert.equal(result.builderItems.length, 1);
  assert.equal(result.builderItems[0].id, 'h');
  assert.equal(result.builderItems[0].bagId, 'g', 'builderItem.bagId carries the bag row id, not artifactId');
  assert.equal(result.builderItems[0].x, 0);
  assert.equal(result.builderItems[0].y, 3, 'virtual y = startRow (INVENTORY_ROWS=3) + slotY (0)');
});

test('[projection] second-slot bagged item reconstructs to virtual y = startRow + slotY', () => {
  // amber_satchel is 2×2 (effective cols=2, rows=2) → second slot row is
  // slotY=1 inside the bag, reconstructed at virtual y=4.
  const result = projectLoadoutItems([
    row({ id: 'bag1', artifactId: 'amber_satchel', active: true }),
    row({ id: 'slot2', artifactId: 'bark_plate', bagId: 'bag1', x: 0, y: 1 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.builderItems.length, 1);
  assert.equal(result.builderItems[0].y, 4, 'virtual y = 3 (INVENTORY_ROWS) + 1 (slotY)');
});

test('[projection] items in the second active bag land past the first bag\u2019s rows', () => {
  // Bag 1 (moss_pouch, 1×2 → effective 2×1) occupies virtual row 3; bag 2
  // (amber_satchel, 2×2) starts at row 4. An item at slot (1, 0) inside
  // bag 2 renders at virtual (1, 4).
  const result = projectLoadoutItems([
    row({ id: 'b1', artifactId: 'moss_pouch', active: true }),
    row({ id: 'b2', artifactId: 'amber_satchel', active: true }),
    row({ id: 'inside_b2', artifactId: 'spore_needle', bagId: 'b2', x: 1, y: 0 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 2);
  assert.equal(result.builderItems.length, 1);
  assert.equal(result.builderItems[0].x, 1);
  assert.equal(result.builderItems[0].y, 4);
});

test('[regression] legacy bagId = artifactId falls back to containerItems', () => {
  // Pre-refactor rows carry bagId = "moss_pouch" (artifact id) instead of
  // the bag's loadout row id. The projection's row-id lookup misses, so
  // the item goes to the container. Next save re-persists with a proper
  // bag row id.
  const result = projectLoadoutItems([
    row({ id: 'g', artifactId: 'moss_pouch', active: true }),
    row({
      id: 'legacy',
      artifactId: 'spore_needle',
      bagId: 'moss_pouch',
      x: 0,
      y: 0
    })
  ], BAG_IDS, getArtifact);
  assert.equal(result.builderItems.length, 0, 'legacy row must not pollute the grid');
  assert.equal(result.containerItems.length, 1);
  assert.equal(result.containerItems[0].id, 'legacy');
});

test('[regression] legacy bagged items at (-1,-1) fall back to containerItems', () => {
  const result = projectLoadoutItems([
    row({ id: 'g', artifactId: 'moss_pouch', active: true }),
    row({
      id: 'legacy',
      artifactId: 'spore_needle',
      bagId: 'g',
      x: -1,
      y: -1
    })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 1);
  assert.equal(result.builderItems.length, 0);
  assert.equal(result.containerItems.length, 1);
  assert.equal(result.containerItems[0].id, 'legacy');
});

test('[regression] bagged item referencing an inactive bag falls back to containerItems', () => {
  // Bag was deactivated but its bagged item still references it. The
  // projection should not render the item on the grid.
  const result = projectLoadoutItems([
    row({ id: 'g', artifactId: 'moss_pouch', active: false }),
    row({ id: 'inside', artifactId: 'spore_needle', bagId: 'g', x: 0, y: 0 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 0);
  assert.equal(result.containerItems.length, 2, 'both the bag row and the orphaned item land in container');
  assert.equal(result.builderItems.length, 0);
});

test('[regression] bagged item with slot coords outside bag footprint falls back to containerItems', () => {
  // moss_pouch is 1×2, so slot (0, 2) is out of bounds. The projection's
  // bounds check catches this before auto-placement can scatter it.
  const result = projectLoadoutItems([
    row({ id: 'g', artifactId: 'moss_pouch', active: true }),
    row({ id: 'oob', artifactId: 'spore_needle', bagId: 'g', x: 0, y: 2 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.builderItems.length, 0);
  assert.equal(result.containerItems.length, 1);
  assert.equal(result.containerItems[0].id, 'oob');
});

test('[projection] freshPurchase items get their artifactId in freshPurchases', () => {
  const result = projectLoadoutItems([
    row({ id: 'i', artifactId: 'bark_plate', freshPurchase: true }),
    row({ id: 'j', artifactId: 'spore_lash', x: 0, y: 0, freshPurchase: true }),
    row({ id: 'k', artifactId: 'moss_pouch', active: true, freshPurchase: true })
  ], BAG_IDS, getArtifact);
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
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 1);
  assert.equal(result.activeBags[0].id, 'active_one');
  assert.equal(result.containerItems.length, 1);
  assert.equal(result.containerItems[0].id, 'container_one');
});

test('[projection] duplicate active bags route their bagged items to the right instance', () => {
  // Both bags have the same artifact id. bag_id on the bagged items
  // disambiguates which physical bag they belong to. moss_pouch effective
  // orientation is 2×1 (cols=2, rows=1), so each instance occupies one
  // virtual row: bag_A at row 3, bag_B at row 4.
  const result = projectLoadoutItems([
    row({ id: 'bag_A', artifactId: 'moss_pouch', active: true }),
    row({ id: 'bag_B', artifactId: 'moss_pouch', active: true }),
    row({ id: 'item_in_A', artifactId: 'spore_needle', bagId: 'bag_A', x: 0, y: 0 }),
    row({ id: 'item_in_B', artifactId: 'bark_plate', bagId: 'bag_B', x: 1, y: 0 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 2);
  assert.equal(result.builderItems.length, 2);
  const inA = result.builderItems.find((i) => i.id === 'item_in_A');
  const inB = result.builderItems.find((i) => i.id === 'item_in_B');
  assert.equal(inA.y, 3, 'item in bag A lives at bag A\u2019s startRow (3) + slotY (0)');
  assert.equal(inB.y, 4, 'item in bag B lives at bag B\u2019s startRow (4) + slotY (0)');
  assert.equal(inA.x, 0);
  assert.equal(inB.x, 1);
  assert.equal(inA.bagId, 'bag_A');
  assert.equal(inB.bagId, 'bag_B');
});

test('[projection] accepts either a Set or an array for bagArtifactIds', () => {
  const fromSet = projectLoadoutItems(
    [row({ id: 'l', artifactId: 'moss_pouch', active: true })],
    new Set(['moss_pouch']),
    getArtifact
  );
  const fromArray = projectLoadoutItems(
    [row({ id: 'l', artifactId: 'moss_pouch', active: true })],
    ['moss_pouch'],
    getArtifact
  );
  assert.deepEqual(fromSet, fromArray);
});

// Rotation routing — see docs/bag-rotated-persistence.md.

test('[projection] bag with rotated=true lands in rotatedBags', () => {
  const result = projectLoadoutItems([
    row({ id: 'r1', artifactId: 'moss_pouch', active: true, rotated: true })
  ], BAG_IDS, getArtifact);
  assert.equal(result.rotatedBags.length, 1);
  assert.equal(result.rotatedBags[0].id, 'r1');
  assert.equal(result.rotatedBags[0].artifactId, 'moss_pouch');
});

test('[projection] bag with rotated=false stays out of rotatedBags', () => {
  const result = projectLoadoutItems([
    row({ id: 'r2', artifactId: 'moss_pouch', active: true, rotated: false })
  ], BAG_IDS, getArtifact);
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
  ], BAG_IDS, getArtifact);
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
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 2);
  assert.equal(result.rotatedBags.length, 1);
  assert.equal(result.rotatedBags[0].id, 'rot_one');
});
