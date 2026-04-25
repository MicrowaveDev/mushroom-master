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
import { projectLoadoutItems, prepareGridProps } from '../../web/src/composables/loadout-projection.js';

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

test('[projection] bagged items with slot coords land in builderItems at reconstructed unified virtual coords', () => {
  // Unified-grid packer: moss_pouch (effective 2x1) anchors at (3, 0) —
  // alongside the base inventory in row 0. Slot (0, 0) inside moss → virtual
  // (anchorX=3, anchorY=0). The packer treats the base inventory at
  // (0..2, 0..2) as a virtual obstacle so bags land alongside it.
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
  assert.equal(result.activeBags[0].anchorX, 3, 'moss anchors alongside the base inv (col 3)');
  assert.equal(result.activeBags[0].anchorY, 0);
  assert.equal(result.builderItems.length, 1);
  assert.equal(result.builderItems[0].id, 'h');
  assert.equal(result.builderItems[0].bagId, 'g', 'builderItem.bagId carries the bag row id, not artifactId');
  assert.equal(result.builderItems[0].x, 3, 'virtual x = anchorX (3) + slotX (0)');
  assert.equal(result.builderItems[0].y, 0, 'virtual y = anchorY (0) + slotY (0)');
});

test('[projection] second-slot bagged item reconstructs to virtual y = anchorY + slotY', () => {
  // amber_satchel (2x2) packs at unified (3, 0) — fits alongside the base
  // inventory in cols 3..4, rows 0..1. Slot (0, 1) → virtual (3, 1).
  const result = projectLoadoutItems([
    row({ id: 'bag1', artifactId: 'amber_satchel', active: true }),
    row({ id: 'slot2', artifactId: 'bark_plate', bagId: 'bag1', x: 0, y: 1 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags[0].anchorX, 3);
  assert.equal(result.activeBags[0].anchorY, 0);
  assert.equal(result.builderItems.length, 1);
  assert.equal(result.builderItems[0].x, 3, 'virtual x = anchorX (3) + slotX (0)');
  assert.equal(result.builderItems[0].y, 1, 'virtual y = anchorY (0) + slotY (1)');
});

test('[projection] [Req 2-F] active bags pack alongside the base inventory in unified-grid coords', () => {
  // Unified-grid packer treats base inventory at (0..2, 0..2) as virtual
  // obstacle. moss_pouch (effective 2x1) anchors at (3, 0); amber_satchel
  // (2x2) cannot share row 0 with moss (cols 3..4 occupied), so the packer
  // moves to row 1 and anchors at (3, 1) — covering rows 1..2, cols 3..4
  // (still alongside the base inventory). Item at slot (1, 0) in amber
  // renders at virtual (anchorX+slotX, anchorY+slotY) = (4, 1).
  const result = projectLoadoutItems([
    row({ id: 'b1', artifactId: 'moss_pouch', active: true }),
    row({ id: 'b2', artifactId: 'amber_satchel', active: true }),
    row({ id: 'inside_b2', artifactId: 'spore_needle', bagId: 'b2', x: 1, y: 0 })
  ], BAG_IDS, getArtifact);
  assert.equal(result.activeBags.length, 2);
  assert.equal(result.activeBags[0].anchorX, 3, 'moss anchors alongside the base inv (col 3)');
  assert.equal(result.activeBags[0].anchorY, 0);
  assert.equal(result.activeBags[1].anchorX, 3, 'amber anchors at col 3 (no room in row 0)');
  assert.equal(result.activeBags[1].anchorY, 1, 'amber drops to row 1 below moss');
  assert.equal(result.builderItems.length, 1);
  assert.equal(result.builderItems[0].x, 4, 'virtual x = anchorX (3) + slotX (1)');
  assert.equal(result.builderItems[0].y, 1, 'virtual y = anchorY (1) + slotY (0)');
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
  // Both bags have the same artifact id. bagId on the bagged items
  // disambiguates which physical bag they belong to. moss_pouch effective
  // orientation is 2x1; the unified packer puts bag_A at (3, 0) (alongside
  // base inv) and bag_B at (3, 1) (next free row that fits, since row 0
  // cols 3..4 are taken).
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
  assert.equal(inA.x, 3, 'bag_A virtual x = anchorX (3) + slotX (0)');
  assert.equal(inA.y, 0, 'bag_A virtual y = anchorY (0) + slotY (0)');
  assert.equal(inB.x, 4, 'bag_B virtual x = anchorX (3) + slotX (1)');
  assert.equal(inB.y, 1, 'bag_B virtual y = anchorY (1) + slotY (0)');
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

// ----------------------------------------------------------------------
// prepareGridProps — single-call adapter for FighterCard / ReplayDuel.
// Battle replay used to pass raw DB rows straight to ArtifactGridBoard:
// bag rows at (-1, -1) rendered off-grid, bagged items at slot coords
// collided with base-grid items at (0, 0). prepareGridProps runs the
// same projection the prep screen uses so the visual contract is unified
// across surfaces.
// ----------------------------------------------------------------------

test('[grid-props] returns items + bagRows + totalRows shaped for ArtifactGridBoard', () => {
  // Snapshot loadout: starter preset at (0, 0) and (1, 0), an active
  // moss_pouch sitting in the container (no anchor), and a bagged item
  // inside it at slot (0, 0). prepareGridProps must:
  //   - drop the bag row from items (it's not a placeable piece)
  //   - reconstruct the bagged item's virtual coords using the bag's
  //     packed anchor (3, 0 by the fallback packer)
  //   - emit bagRows with the bag's row entry + bbox metadata
  const result = prepareGridProps([
    row({ id: 'a', artifactId: 'spore_lash', x: 0, y: 0 }),
    row({ id: 'b', artifactId: 'spore_needle', x: 1, y: 0 }),
    row({ id: 'm', artifactId: 'moss_pouch', active: true }),
    row({ id: 'inside', artifactId: 'bark_plate', bagId: 'm', x: 0, y: 0 })
  ], BAG_IDS, getArtifact);

  // items: starter preset + bagged item at virtual (anchorX + slotX, anchorY + slotY)
  assert.equal(result.items.length, 3);
  const inside = result.items.find((i) => i.id === 'inside');
  assert.equal(inside.x, 3, 'bagged item virtual x = anchorX (3) + slotX (0)');
  assert.equal(inside.y, 0, 'bagged item virtual y = anchorY (0) + slotY (0)');

  // bagRows: one entry for moss_pouch's row 0
  assert.equal(result.bagRows.length, 1);
  const mossRow = result.bagRows[0];
  assert.equal(mossRow.row, 0);
  assert.equal(mossRow.artifactId, 'moss_pouch');
  assert.equal(mossRow.bboxStart, 3);
  assert.equal(mossRow.bboxEnd, 5);
  assert.deepEqual(mossRow.enabledCells, [3, 4]);

  // totalRows: at least BAG_ROWS (= 6) so the grid renders a 6×6 floor
  assert.ok(result.totalRows >= 6, 'totalRows respects BAG_ROWS minimum');
});

test('[grid-props] empty loadout returns no items, no bagRows, BAG_ROWS floor', () => {
  const result = prepareGridProps([], BAG_IDS, getArtifact);
  assert.equal(result.items.length, 0);
  assert.equal(result.bagRows.length, 0);
  assert.equal(result.totalRows, 6, 'unified grid floor is BAG_ROWS even when empty');
});

test('[grid-props][regression] battle replay no longer collides bagged items with base-grid items', () => {
  // The screenshot bug: snapshot.loadout had a base-grid item at (0, 0)
  // (spore_lash) AND a bagged item at slot (0, 0) inside an active
  // moss_pouch. ReplayDuel used to forward both straight to ArtifactGrid
  // Board, which rendered both at virtual (0, 0) and they overlapped.
  // After the fix, the bagged item resolves to virtual (3, 0).
  const result = prepareGridProps([
    row({ id: 'base', artifactId: 'spore_lash', x: 0, y: 0 }),
    row({ id: 'bag', artifactId: 'moss_pouch', active: true }),
    row({ id: 'inside', artifactId: 'bark_plate', bagId: 'bag', x: 0, y: 0 })
  ], BAG_IDS, getArtifact);

  const base = result.items.find((i) => i.id === 'base');
  const inside = result.items.find((i) => i.id === 'inside');
  assert.notEqual(`${base.x}:${base.y}`, `${inside.x}:${inside.y}`,
    'base-grid and bagged items must occupy distinct virtual cells');
  assert.equal(base.x, 0);
  assert.equal(base.y, 0);
  assert.equal(inside.x, 3, 'bagged item lands alongside the base inventory in the unified grid');
  assert.equal(inside.y, 0);
});

test('[grid-props] bag rows themselves are filtered out of items (they are layout, not pieces)', () => {
  // ArtifactGridBoard's `items` prop renders pieces. Bag rows describe
  // the grid's bag-zone background and live in `bagRows` instead. A naive
  // forward of all loadoutItems would render the bag itself as a phantom
  // piece (sometimes off-grid at -1, -1, sometimes at the bag's anchor).
  const result = prepareGridProps([
    row({ id: 'm', artifactId: 'moss_pouch', active: true })
  ], BAG_IDS, getArtifact);
  assert.equal(result.items.length, 0, 'no piece for the bag itself');
  assert.equal(result.bagRows.length, 1, 'bag is described via bagRows');
});
