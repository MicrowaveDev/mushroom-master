// Composable-level tests for web/src/composables/useShop.js.
//
// Why a client composable test and not a Playwright e2e: Playwright's
// synthesized HTML5 drag events don't reliably trigger the Vue
// @dragstart/@drop handlers in headless Chromium, and the bug under test
// is purely in the JS state machine — no rendering involved. See the
// same rationale in tests/game/solo-run.spec.js `sellContainerItemViaApi`.
//
// Regression context: a round-2 save hit the server with an item at y=3
// (below the 3-row grid) and got "Artifact placement is out of bounds"
// back as a 500. Root cause was that deactivateBag only checked its own
// bag's row range, so deactivating an *earlier* bag in the activeBags
// list silently shifted every later bag up by its rowCount and stranded
// items at their old y. Same story for rotateBag.
//
// The fix makes both ops block if anything lives in this bag's rows OR
// any later bag's rows. This test pins that invariant by exercising the
// real composable against a minimal reactive-state shim.

import test from 'node:test';
import assert from 'node:assert/strict';
import { useShop } from '../../web/src/composables/useShop.js';

// Minimal artifacts needed for the test. Mirrors the subset the real
// bootstrap ships to the client — wider catalogs aren't needed because
// useShop looks up by id via the injected getArtifact() function.
const ARTIFACTS = [
  { id: 'spore_lash', family: 'stun', width: 1, height: 1, price: 1, bonus: { damage: 1 } },
  { id: 'spore_needle', family: 'damage', width: 1, height: 1, price: 1, bonus: { damage: 2 } },
  { id: 'bark_plate', family: 'armor', width: 1, height: 1, price: 1, bonus: { armor: 1 } },
  // spark_shard (1×2) — used by the rotate-duplicate test. A rotatable
  // non-bag artifact that fits the 3×3 grid in both orientations.
  { id: 'spark_shard', family: 'damage', width: 1, height: 2, price: 1, bonus: { damage: 1 } },
  // moss_pouch: 1×2 → default orientation cols=2, rows=1 (adds 1 bag row)
  { id: 'moss_pouch', family: 'bag', width: 1, height: 2, price: 2, slotCount: 2, bonus: {} },
  // amber_satchel: 2×2 → cols=2, rows=2 (adds 2 bag rows)
  { id: 'amber_satchel', family: 'bag', width: 2, height: 2, price: 3, slotCount: 4, bonus: {} }
];

function makeFreshState() {
  return {
    lang: 'en',
    error: '',
    gameRun: { id: 'run_test', player: { coins: 100 } },
    bootstrap: { artifacts: ARTIFACTS },
    shopOffer: [],
    containerItems: [],
    activeBags: [],
    rotatedBags: [],
    freshPurchases: [],
    // Starter preset fills y=0 cols 0,1 (thalla: spore_lash, spore_needle).
    // Leaves (2,0), (0,1)..(2,1), (0,2)..(2,2) free on the main 3x3 grid.
    builderItems: [
      { artifactId: 'spore_lash', x: 0, y: 0, width: 1, height: 1 },
      { artifactId: 'spore_needle', x: 1, y: 0, width: 1, height: 1 }
    ],
    draggingArtifactId: '',
    draggingItem: null,
    draggingSource: '',
    rerollSpent: 0
  };
}

function makeShop(state) {
  const getArtifact = (id) => ARTIFACTS.find((a) => a.id === id);
  // persistShopOffer / persistRunLoadout are no-ops: the test asserts on
  // `state` directly, not on what the real persist functions would send.
  return useShop(state, getArtifact, () => {}, () => {});
}

// Monotonic row-id generator for test fixtures. Mimics the server's
// unique-per-row id so the composable can thread it through state the
// same way real code does. Reset at the start of each test via
// makeFreshState so duplicates don't collide across tests.
let nextRowIdSeed = 0;
function makeRowId() {
  nextRowIdSeed += 1;
  return `grlitem_test_${nextRowIdSeed}`;
}

// Seed a container slot so activateBag / placeFromContainer have
// something to consume. Returns the row id on the slot.
function seedContainer(state, artifactId) {
  const rowId = makeRowId();
  state.containerItems = [...state.containerItems, { id: rowId, artifactId }];
  return rowId;
}

// Drop an item from the container into a specific grid cell via the real
// onInventoryCellDrop handler (same code path as a UI drag). The handler
// reads draggingArtifactId / draggingSource, so we set them like the real
// drag-start would. Appends a slot with a synthetic row id so the
// threading assertions can see it land on the placed builderItem.
function dropFromContainer(shop, state, artifactId, x, y) {
  const rowId = makeRowId();
  state.containerItems = [...state.containerItems, { id: rowId, artifactId }];
  state.draggingArtifactId = artifactId;
  state.draggingSource = 'container';
  shop.onInventoryCellDrop({ x, y });
  state.draggingArtifactId = '';
  state.draggingSource = '';
  return rowId;
}

test('[regression] deactivateBag blocks when a later bag contains items', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // Seed both bags into the container so activateBag can consume them.
  seedContainer(state, 'moss_pouch');
  seedContainer(state, 'amber_satchel');

  // Activate moss_pouch first → occupies row 3 (startRow=INVENTORY_ROWS=3, rowCount=1).
  shop.activateBag('moss_pouch');
  assert.equal(state.activeBags.length, 1);
  assert.equal(state.activeBags[0].artifactId, 'moss_pouch');

  // Activate amber_satchel second → occupies rows 4 and 5 (startRow=4, rowCount=2).
  shop.activateBag('amber_satchel');
  assert.deepEqual(
    state.activeBags.map((b) => b.artifactId),
    ['moss_pouch', 'amber_satchel']
  );
  assert.equal(shop.effectiveRows(), 6); // 3 grid + 1 moss_pouch + 2 amber_satchel

  // Drop bark_plate into amber_satchel's LAST row (y=5). This is the
  // stranded-item scenario: if moss_pouch gets deactivated, amber_satchel
  // shifts to rows 3,4 — and the item at y=5 is outside its new range,
  // which is exactly how a builderItem ends up with no matching bag in
  // buildLoadoutPayloadItems.
  dropFromContainer(shop, state, 'bark_plate', 0, 5);
  const placed = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.ok(placed, 'bark_plate must be placed');
  assert.equal(placed.y, 5, 'bark_plate must land at y=5 (amber_satchel last row)');

  // Attempt to deactivate moss_pouch (the FIRST bag). Under the old code
  // this checked only rows [3,4) — the item at y=5 wasn't in that range,
  // so deactivation succeeded silently and stranded the item.
  state.error = '';
  shop.deactivateBag('moss_pouch');

  // With the fix: the deactivation is blocked because there's an item at
  // y>=3 (i.e. in this bag's row OR any later bag's rows).
  assert.deepEqual(
    state.activeBags.map((b) => b.artifactId),
    ['moss_pouch', 'amber_satchel'],
    'deactivation must be blocked while a later bag holds items'
  );
  assert.match(state.error, /Remove items from the bag first/);

  // The stranded item must still be at y=5 (not silently moved).
  assert.equal(
    state.builderItems.find((i) => i.artifactId === 'bark_plate').y,
    5
  );
});

test('[regression] rotateBag blocks when a later bag contains items', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  seedContainer(state, 'moss_pouch');
  seedContainer(state, 'amber_satchel');
  shop.activateBag('moss_pouch');
  shop.activateBag('amber_satchel');
  dropFromContainer(shop, state, 'bark_plate', 0, 5);
  assert.equal(
    state.builderItems.find((i) => i.artifactId === 'bark_plate').y,
    5
  );

  // Rotating moss_pouch (1×2) flips its layout from cols=2,rows=1 to
  // cols=1,rows=2 — that changes its rowCount and would shift
  // amber_satchel down by 1, stranding the item at y=5 again. Under the
  // old code rotateBag only checked moss_pouch's own row range.
  state.error = '';
  shop.rotateBag('moss_pouch');

  assert.deepEqual(
    state.rotatedBags,
    [],
    'rotation must be blocked while a later bag holds items'
  );
  assert.match(state.error, /Remove items from the bag first/);
});

test('deactivateBag still works when no downstream items exist', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  seedContainer(state, 'moss_pouch');
  seedContainer(state, 'amber_satchel');
  shop.activateBag('moss_pouch');
  shop.activateBag('amber_satchel');
  // Intentionally no dropFromContainer — both bags are empty.

  state.error = '';
  shop.deactivateBag('moss_pouch');

  // Happy path: still allowed, moss_pouch moves back to the container.
  assert.deepEqual(
    state.activeBags.map((b) => b.artifactId),
    ['amber_satchel']
  );
  assert.ok(state.containerItems.some((s) => s.artifactId === 'moss_pouch'));
  assert.equal(state.error, '');
});

test('onInventoryCellDrop (source=inventory) rejects drops into disabled bag cells', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // moss_pouch exposes cols=2 (not the full 3). Place bark_plate into its
  // valid col=0 first, then try to move it to col=2 — which is a disabled
  // cell inside the bag row.
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  dropFromContainer(shop, state, 'bark_plate', 0, 3);
  const landed = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.equal(landed.x, 0);
  assert.equal(landed.y, 3);

  // Now simulate an inventory-to-inventory drag into the disabled cell
  // via the real drag-start handler so draggingItem is populated.
  shop.onInventoryPieceDragStart({ item: landed });
  shop.onInventoryCellDrop({ x: 2, y: 3 });
  shop.onDragEndAny();

  // The piece must stay at (0,3) — the drop into the disabled cell is a
  // no-op. Under the old code isCellDisabled wasn't checked for the
  // inventory source, so this would have moved to (2,3) and silently
  // tripped the server's occupancy check on the next save.
  const afterDrop = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.equal(afterDrop.x, 0);
  assert.equal(afterDrop.y, 3);
});

// ---------------------------------------------------------------------------
// Duplicate-artifact identity regression: the player can legitimately own two
// copies of the same artifact (see solo-run-scenario.test.js Phase 2, which
// buys the same id twice and asserts two distinct db rows). Every client-side
// op that used to match by artifactId would wipe all duplicates — a user
// placed a second burning_cap from the container, and the first (already
// placed) one vanished from the grid because normalizePlacement filtered it
// out before appending the candidate.
// ---------------------------------------------------------------------------

test('[regression] placeFromContainer with a duplicate preserves the already-placed copy', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // Place bark_plate #1 at (2,0) via the container→grid path.
  dropFromContainer(shop, state, 'bark_plate', 2, 0);
  assert.equal(state.builderItems.filter((i) => i.artifactId === 'bark_plate').length, 1);

  // Player owns a second bark_plate in the container and drops it at (0,2).
  dropFromContainer(shop, state, 'bark_plate', 0, 2);

  // Both duplicates must be present on the grid now. Under the old code,
  // normalizePlacement filtered existing bark_plates out before checking
  // fit, so the first copy at (2,0) silently disappeared.
  const placed = state.builderItems.filter((i) => i.artifactId === 'bark_plate');
  assert.equal(placed.length, 2, 'both bark_plate duplicates must remain on the grid');
  const coords = new Set(placed.map((i) => `${i.x},${i.y}`));
  assert.ok(coords.has('2,0'), 'first bark_plate must stay at (2,0)');
  assert.ok(coords.has('0,2'), 'second bark_plate must land at (0,2)');

  // Container must have had exactly one bark_plate removed, not all of them.
  assert.equal(
    state.containerItems.filter((s) => s.artifactId === 'bark_plate').length,
    0
  );
});

test('[regression] placeFromContainer pops only one duplicate when multiple are in container', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // Two bark_plates sitting in the container.
  seedContainer(state, 'bark_plate');
  seedContainer(state, 'bark_plate');

  // Drop one onto the grid.
  state.draggingArtifactId = 'bark_plate';
  state.draggingSource = 'container';
  shop.onInventoryCellDrop({ x: 2, y: 0 });
  state.draggingArtifactId = '';
  state.draggingSource = '';

  // Exactly ONE bark_plate must remain in the container. The old code
  // used `.filter(id => id !== 'bark_plate')` which would empty it.
  assert.equal(
    state.containerItems.filter((s) => s.artifactId === 'bark_plate').length,
    1,
    'one duplicate must still sit in the container'
  );
  assert.equal(state.builderItems.filter((i) => i.artifactId === 'bark_plate').length, 1);
});

test('[regression] unplaceToContainer(item) returns only the clicked duplicate', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // Two bark_plates placed on the grid.
  dropFromContainer(shop, state, 'bark_plate', 2, 0);
  dropFromContainer(shop, state, 'bark_plate', 0, 2);
  assert.equal(state.builderItems.filter((i) => i.artifactId === 'bark_plate').length, 2);

  // Click the one at (2,0) to unplace it. PrepScreen forwards the full
  // item to the unplace handler so the per-instance anchor is preserved.
  const clicked = state.builderItems.find((i) => i.artifactId === 'bark_plate' && i.x === 2 && i.y === 0);
  shop.unplaceToContainer(clicked);

  // Only the clicked one comes back to the container. The duplicate at
  // (0,2) must stay on the grid.
  const remaining = state.builderItems.filter((i) => i.artifactId === 'bark_plate');
  assert.equal(remaining.length, 1, 'one bark_plate must remain on the grid');
  assert.equal(remaining[0].x, 0);
  assert.equal(remaining[0].y, 2);
  assert.equal(
    state.containerItems.filter((s) => s.artifactId === 'bark_plate').length,
    1,
    'exactly one bark_plate must land in the container'
  );
});

test('[regression] dragging one duplicate in the grid moves only that copy', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // Two bark_plates placed on the grid at (2,0) and (0,2).
  dropFromContainer(shop, state, 'bark_plate', 2, 0);
  dropFromContainer(shop, state, 'bark_plate', 0, 2);

  // Drag the (0,2) copy to (1,2) via the real drag-start + drop handlers.
  const toDrag = state.builderItems.find((i) => i.artifactId === 'bark_plate' && i.x === 0 && i.y === 2);
  shop.onInventoryPieceDragStart({ item: toDrag });
  shop.onInventoryCellDrop({ x: 1, y: 2 });
  shop.onDragEndAny();

  // The moved copy must be at (1,2); the other copy must stay at (2,0).
  const placed = state.builderItems.filter((i) => i.artifactId === 'bark_plate');
  assert.equal(placed.length, 2);
  const coords = new Set(placed.map((i) => `${i.x},${i.y}`));
  assert.ok(coords.has('2,0'), 'untouched bark_plate must stay at (2,0)');
  assert.ok(coords.has('1,2'), 'dragged bark_plate must land at (1,2)');
  assert.ok(!coords.has('0,2'), 'dragged bark_plate must leave its old cell');
});

// ---------------------------------------------------------------------------
// Row-id threading (docs/client-row-id-refactor.md Phase 2 acceptance tests).
// These pin the invariant that the server's loadout row id stays attached to
// each state slot across every client-side mutation. Before the refactor,
// the client dropped the id on the floor during hydration and re-derived
// item identity from artifactId — which silently collapsed duplicates.
// ---------------------------------------------------------------------------

test('[row-id] placeFromContainer threads the row id onto the placed builderItem', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  const rowId = seedContainer(state, 'bark_plate');

  state.draggingArtifactId = 'bark_plate';
  state.draggingSource = 'container';
  shop.onInventoryCellDrop({ x: 2, y: 0 });
  state.draggingArtifactId = '';
  state.draggingSource = '';

  const placed = state.builderItems.find((i) => i.x === 2 && i.y === 0);
  assert.ok(placed);
  assert.equal(placed.id, rowId, 'placed builderItem must carry the row id from the container slot');
});

test('[row-id] unplaceToContainer preserves the row id on the returned container slot', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  const rowId = seedContainer(state, 'bark_plate');

  // Place then immediately unplace via click.
  state.draggingArtifactId = 'bark_plate';
  state.draggingSource = 'container';
  shop.onInventoryCellDrop({ x: 2, y: 0 });
  state.draggingArtifactId = '';
  state.draggingSource = '';
  const placed = state.builderItems.find((i) => i.x === 2 && i.y === 0);
  shop.unplaceToContainer(placed);

  const slot = state.containerItems.find((s) => s.artifactId === 'bark_plate');
  assert.ok(slot);
  assert.equal(slot.id, rowId, 'row id must ride along from grid back to container');
});

test('[row-id] activateBag / deactivateBag keep the bag row id attached', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  const rowId = seedContainer(state, 'moss_pouch');

  shop.activateBag('moss_pouch');
  assert.equal(state.activeBags.length, 1);
  assert.equal(state.activeBags[0].id, rowId, 'active bag must carry the server row id');

  shop.deactivateBag('moss_pouch');
  const slot = state.containerItems.find((s) => s.artifactId === 'moss_pouch');
  assert.ok(slot);
  assert.equal(slot.id, rowId, 'row id must survive the round-trip through activeBags');
});

test('[row-id] dragging a placed item to a new cell preserves its row id', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  const rowId = seedContainer(state, 'bark_plate');
  dropFromContainer(shop, state, 'bark_plate', 2, 0);
  const placed = state.builderItems.find((i) => i.x === 2 && i.y === 0 && i.artifactId === 'bark_plate');
  // dropFromContainer seeds its own row id for the dropped copy, so the
  // one we placed earlier matches against the seedContainer row id first
  // if the row ids are routed correctly.
  void rowId; // anchor the intent of this test — row id is the placed.id

  shop.onInventoryPieceDragStart({ item: placed });
  shop.onInventoryCellDrop({ x: 2, y: 1 });
  shop.onDragEndAny();

  const moved = state.builderItems.find((i) => i.artifactId === 'bark_plate' && i.x === 2 && i.y === 1);
  assert.ok(moved, 'bark_plate must land at (2,1)');
  assert.equal(moved.id, placed.id, 'drag must preserve the row id across the move');
});

test('[row-id] rotatePlacedArtifact preserves the row id on the rotated instance', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'spark_shard');
  dropFromContainer(shop, state, 'spark_shard', 2, 0);
  const placedBefore = state.builderItems.find((i) => i.artifactId === 'spark_shard');
  const rowId = placedBefore.id;
  assert.ok(rowId, 'sanity: placed item must carry a row id');

  // spark_shard lands at (2,0) as 1×2 (horizontal 2×1 would be OOB),
  // occupying (2,0) and (2,1). Rotating to 2×1 needs (2,0) and (3,0),
  // which is OOB — it'll set state.error and skip. So we use a different
  // position where rotation succeeds.
  // Re-do with (0,1) placement: landed as 2×1 there.
  state.builderItems = [];
  seedContainer(state, 'spark_shard');
  dropFromContainer(shop, state, 'spark_shard', 0, 1);
  const placed = state.builderItems.find((i) => i.artifactId === 'spark_shard' && i.x === 0 && i.y === 1);
  const placedRowId = placed.id;

  shop.rotatePlacedArtifact(placed);

  const rotated = state.builderItems.find((i) => i.artifactId === 'spark_shard' && i.x === 0 && i.y === 1);
  assert.equal(rotated.id, placedRowId, 'rotation must preserve the row id');
});

test('[regression] rotatePlacedArtifact rotates only the targeted duplicate', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // Two spark_shards placed on the grid. Note that preferredOrientation
  // for a 1×2 artifact emits width=2/height=1 (horizontal first): at
  // (2,0) the horizontal form is OOB so it falls back to 1×2; at (0,1)
  // it lands as 2×1.
  //   Layout after both drops:
  //     (0,0) spore_lash 1×1
  //     (1,0) spore_needle 1×1
  //     (2,0) spark_shard #A 1×2 — occupies (2,0),(2,1)
  //     (0,1) spark_shard #B 2×1 — occupies (0,1),(1,1)
  dropFromContainer(shop, state, 'spark_shard', 2, 0);
  dropFromContainer(shop, state, 'spark_shard', 0, 1);
  const placedBefore = state.builderItems.filter((i) => i.artifactId === 'spark_shard');
  assert.equal(placedBefore.length, 2);

  // Rotate the (0,1) copy from 2×1 to 1×2. New footprint needs (0,1)
  // and (0,2); (0,2) is free. Must rotate exactly that instance.
  const target = state.builderItems.find((i) => i.artifactId === 'spark_shard' && i.x === 0 && i.y === 1);
  shop.rotatePlacedArtifact(target);

  const after = state.builderItems.filter((i) => i.artifactId === 'spark_shard');
  assert.equal(after.length, 2, 'both duplicates must remain after rotating one');

  // Targeted copy must now be 1×2 at (0,1).
  const rotated = after.find((i) => i.x === 0 && i.y === 1);
  assert.equal(rotated.width, 1);
  assert.equal(rotated.height, 2);
  // Untouched copy at (2,0) must still be 1×2.
  const untouched = after.find((i) => i.x === 2 && i.y === 0);
  assert.equal(untouched.width, 1);
  assert.equal(untouched.height, 2);
});
