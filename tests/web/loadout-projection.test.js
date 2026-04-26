import test from 'node:test';
import assert from 'node:assert/strict';
import { projectLoadoutItems, prepareGridProps } from '../../web/src/composables/loadout-projection.js';

const BAG_IDS = new Set(['starter_bag', 'moss_pouch', 'amber_satchel']);

const ARTIFACTS = {
  starter_bag: { id: 'starter_bag', family: 'bag', width: 3, height: 3, slotCount: 9, color: '#d4c9a8' },
  moss_pouch: { id: 'moss_pouch', family: 'bag', width: 1, height: 2, slotCount: 2, color: '#6b8f5e' },
  amber_satchel: { id: 'amber_satchel', family: 'bag', width: 2, height: 2, slotCount: 4, color: '#d4a54a' },
  spore_needle: { id: 'spore_needle', family: 'damage', width: 1, height: 1 },
  bark_plate: { id: 'bark_plate', family: 'armor', width: 1, height: 1 },
  glass_cap: { id: 'glass_cap', family: 'damage', width: 2, height: 1 }
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
    active: false,
    rotated: false,
    freshPurchase: false,
    ...overrides
  };
}

test('[projection] placed non-bag items land in builderItems with absolute coords', () => {
  const result = projectLoadoutItems([
    row({ id: 'a', artifactId: 'spore_needle', x: 0, y: 0 }),
    row({ id: 'b', artifactId: 'bark_plate', x: 1, y: 0 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.builderItems.length, 2);
  assert.deepEqual(result.builderItems.map((i) => [i.id, i.x, i.y]), [['a', 0, 0], ['b', 1, 0]]);
  assert.equal(result.containerItems.length, 0);
});

test('[projection] container non-bag items land in containerItems', () => {
  const result = projectLoadoutItems([
    row({ id: 'c', artifactId: 'bark_plate' })
  ], BAG_IDS, getArtifact);
  assert.deepEqual(result.containerItems, [{ id: 'c', artifactId: 'bark_plate' }]);
  assert.equal(result.builderItems.length, 0);
});

test('[projection] active bags preserve server anchors', () => {
  const result = projectLoadoutItems([
    row({ id: 'starter', artifactId: 'starter_bag', x: 0, y: 0, width: 3, height: 3, active: true }),
    row({ id: 'moss', artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: true })
  ], BAG_IDS, getArtifact);
  assert.deepEqual(result.activeBags, [
    { id: 'starter', artifactId: 'starter_bag', anchorX: 0, anchorY: 0 },
    { id: 'moss', artifactId: 'moss_pouch', anchorX: 3, anchorY: 0 }
  ]);
  assert.equal(result.containerItems.length, 0);
});

test('[projection] inactive bags land in containerItems', () => {
  const result = projectLoadoutItems([
    row({ id: 'bag', artifactId: 'moss_pouch', active: false })
  ], BAG_IDS, getArtifact);
  assert.deepEqual(result.containerItems, [{ id: 'bag', artifactId: 'moss_pouch' }]);
  assert.equal(result.activeBags.length, 0);
});

test('[projection] flat spanning item stays one absolute builder item', () => {
  const result = projectLoadoutItems([
    row({ id: 'starter', artifactId: 'starter_bag', x: 0, y: 0, width: 3, height: 3, active: true }),
    row({ id: 'moss', artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: true }),
    row({ id: 'span', artifactId: 'glass_cap', x: 2, y: 0, width: 2, height: 1 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.builderItems.length, 1);
  assert.deepEqual(result.builderItems[0], {
    id: 'span',
    artifactId: 'glass_cap',
    x: 2,
    y: 0,
    width: 2,
    height: 1
  });
});

test('[projection] freshPurchase items get their artifactId in freshPurchases', () => {
  const result = projectLoadoutItems([
    row({ id: 'i', artifactId: 'bark_plate', freshPurchase: true }),
    row({ id: 'j', artifactId: 'spore_needle', x: 0, y: 0, freshPurchase: true }),
    row({ id: 'k', artifactId: 'moss_pouch', x: 3, y: 0, active: true, freshPurchase: true })
  ], BAG_IDS, getArtifact);
  assert.deepEqual(result.freshPurchases.sort(), ['bark_plate', 'moss_pouch', 'spore_needle']);
});

test('[projection] duplicate bags preserve row identity and rotation state', () => {
  const result = projectLoadoutItems([
    row({ id: 'rot_one', artifactId: 'moss_pouch', x: 3, y: 0, active: true, rotated: true }),
    row({ id: 'plain_one', artifactId: 'moss_pouch', x: 3, y: 1, active: true, rotated: false })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 2);
  assert.deepEqual(result.rotatedBags, [{ id: 'rot_one', artifactId: 'moss_pouch' }]);
});

test('[grid-props] returns items + bagRows + totalRows for flat loadout', () => {
  const result = prepareGridProps([
    row({ id: 'starter', artifactId: 'starter_bag', x: 0, y: 0, width: 3, height: 3, active: true }),
    row({ id: 'moss', artifactId: 'moss_pouch', x: 3, y: 0, width: 1, height: 2, active: true }),
    row({ id: 'span', artifactId: 'glass_cap', x: 2, y: 0, width: 2, height: 1 })
  ], BAG_IDS, getArtifact);

  assert.deepEqual(result.items.map((i) => i.id), ['span']);
  assert.ok(result.bagRows.some((r) => r.artifactId === 'starter_bag' && r.row === 0));
  assert.ok(result.bagRows.some((r) => r.artifactId === 'moss_pouch' && r.row === 0));
  assert.ok(result.totalRows >= 6);
});

test('[grid-props] empty loadout returns no items, no bagRows, BAG_ROWS floor', () => {
  const result = prepareGridProps([], BAG_IDS, getArtifact);
  assert.equal(result.items.length, 0);
  assert.equal(result.bagRows.length, 0);
  assert.equal(result.totalRows, 6);
});

test('[grid-props] bag rows themselves are layout, not pieces', () => {
  const result = prepareGridProps([
    row({ id: 'starter', artifactId: 'starter_bag', x: 0, y: 0, width: 3, height: 3, active: true })
  ], BAG_IDS, getArtifact);
  assert.equal(result.items.length, 0);
  assert.ok(result.bagRows.length > 0);
});
