// Composable-level tests for web/src/composables/useShop.js.
//
// Why a client composable test and not a Playwright e2e: Playwright's
// synthesized HTML5 drag events don't reliably trigger the Vue
// @dragstart/@drop handlers in headless Chromium, and the bug under test
// is purely in the JS state machine — no rendering involved. See the
// same rationale in tests/game/solo-run.spec.js `sellContainerItemViaApi`.
//
// Post-slot-coord-refactor (docs/bag-item-placement-persistence.md):
// bagged-item storage uses slot coords relative to their bag, so later
// bags are independent of earlier bags' rotation or activation. The
// client-side relayoutBaggedItems helper recomputes virtual y when the
// active-bag layout changes. Deactivate / rotate therefore block only on
// contents of the *current* bag, and later-bag items get their virtual y
// shifted automatically when earlier bags come or go.

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
  { id: 'amber_satchel', family: 'bag', width: 2, height: 2, price: 3, slotCount: 4, bonus: {} },
  // T-tetromino bag: 3×2 with shape mask. Slots at (0,0), (1,0), (2,0), (1,1).
  // Used to pin shape-aware drop targeting and bagged-item rendering.
  {
    id: 'trefoil_sack', family: 'bag', width: 3, height: 2, price: 3, slotCount: 4, bonus: {},
    shape: [
      [1, 1, 1],
      [0, 1, 0]
    ]
  }
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
  // persistRunLoadout is a no-op: the test asserts on `state` directly.
  return useShop(state, getArtifact, () => {});
}

// Variant that records calls to persistRunLoadout. Used by tests that
// need to assert "this mutation also triggered a server sync".
function makeShopWithSpy(state) {
  const getArtifact = (id) => ARTIFACTS.find((a) => a.id === id);
  const calls = { persistRunLoadout: 0 };
  const persistRunLoadout = () => { calls.persistRunLoadout += 1; };
  const shop = useShop(state, getArtifact, persistRunLoadout);
  return { shop, calls };
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

test('[Req 2-F] activating two bags packs them alongside the base inventory in unified coords', () => {
  // Unified-grid 2D first-fit: the base inventory at (0..2, 0..2) is a
  // virtual obstacle. moss_pouch (effective 2x1) packs at (3, 0) — alongside
  // the inventory in row 0, NOT below it. amber_satchel (2x2) cannot share
  // row 0 with moss (cols 3..4), so the packer steps to row 1 and anchors
  // at (3, 1) — covering rows 1..2, cols 3..4 (still alongside the base).
  // No bag extends past INVENTORY_ROWS, so effectiveRows stays at 3.
  const state = makeFreshState();
  const shop = makeShop(state);

  seedContainer(state, 'moss_pouch');
  seedContainer(state, 'amber_satchel');
  shop.activateBag('moss_pouch');
  shop.activateBag('amber_satchel');

  const moss = state.activeBags.find((b) => b.artifactId === 'moss_pouch');
  const amber = state.activeBags.find((b) => b.artifactId === 'amber_satchel');
  assert.equal(moss.anchorX, 3, 'moss anchors alongside the base inventory (col 3)');
  assert.equal(moss.anchorY, 0, 'moss anchors at the top row (row 0)');
  assert.equal(amber.anchorX, 3, 'amber also anchors at col 3 (no room in row 0)');
  assert.equal(amber.anchorY, 1, 'amber anchors at row 1 — below moss, alongside the base inv');
  assert.equal(shop.effectiveRows(), 6, 'unified grid is always at least BAG_ROWS (6) tall');
});

test('[bag-relayout] deactivating an empty bag preserves a side-by-side bag\u2019s slot identity', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  seedContainer(state, 'moss_pouch');
  seedContainer(state, 'amber_satchel');
  shop.activateBag('moss_pouch');
  shop.activateBag('amber_satchel');
  // Unified packer: moss at (3, 0), amber at (3, 1). amber\u2019s slot
  // (0, 0) maps to virtual (anchorX=3, anchorY=1).
  dropFromContainer(shop, state, 'bark_plate', 3, 1);
  const placedBefore = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.ok(placedBefore, 'bark_plate must be placed');
  assert.equal(placedBefore.x, 3);
  assert.equal(placedBefore.y, 1);
  const amberRowId = state.activeBags.find((b) => b.artifactId === 'amber_satchel').id;
  assert.equal(placedBefore.bagId, amberRowId, 'placed item must carry amber_satchel\u2019s row id');

  // Deactivate moss_pouch (empty). amber_satchel keeps its anchor — v1 does
  // not re-pack on deactivate; the user re-anchors via drag if they want
  // amber to fill the freed space. The bark_plate\u2019s slot coords stay
  // intact and its virtual coords are unchanged.
  state.error = '';
  shop.deactivateBag('moss_pouch');

  assert.deepEqual(
    state.activeBags.map((b) => b.artifactId),
    ['amber_satchel'],
    'deactivation of an empty bag must succeed'
  );
  assert.equal(state.error, '');

  const placedAfter = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.ok(placedAfter, 'amber\u2019s item must survive the deactivate');
  assert.equal(placedAfter.x, 3, 'virtual x is preserved when amber\u2019s anchor doesn\u2019t move');
  assert.equal(placedAfter.y, 1, 'virtual y is preserved when amber\u2019s anchor doesn\u2019t move');
  assert.equal(placedAfter.bagId, amberRowId, 'bag row id (= slot identity) is unchanged');
});

test('[bag-relayout] rotating an empty bag is blocked when it would overlap another bag', () => {
  // Unified-grid layout: moss at (3, 0) (1 row tall), amber at (3, 1) (2 rows
  // tall). Rotating moss (1x2 -> cols=1, rows=2) would extend its footprint
  // into row 1 col 3, which is amber\u2019s anchor. The bagAreaOverlaps guard
  // in rotateBag must reject — without it the rotation would silently
  // displace amber\u2019s items on the next persist.
  const state = makeFreshState();
  const shop = makeShop(state);

  seedContainer(state, 'moss_pouch');
  seedContainer(state, 'amber_satchel');
  shop.activateBag('moss_pouch');
  shop.activateBag('amber_satchel');

  state.error = '';
  shop.rotateBag('moss_pouch');

  assert.equal(state.rotatedBags.length, 0, 'rotation must be blocked — would overlap amber');
});

test('[bag-relayout] rotating an empty bag succeeds when the rotated footprint stays clear', () => {
  // Single bag in the unified grid: moss_pouch at (3, 0) cols=2 rows=1.
  // Rotating to cols=1, rows=2 keeps it inside BAG_COLUMNS and outside the
  // base inventory — allowed. moss\u2019s anchor stays the same.
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');

  state.error = '';
  shop.rotateBag('moss_pouch');

  assert.equal(state.rotatedBags.length, 1, 'rotation succeeds with no other bag in the way');
  assert.equal(state.rotatedBags[0].artifactId, 'moss_pouch');
  assert.equal(state.error, '');
});

test('[bag-relayout] deactivating a non-empty bag is still blocked', () => {
  // The narrow guardrail that must remain: the current bag\u2019s own items
  // would lose their anchor if the bag got removed, so UX blocks it.
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  // Unified-grid: moss anchors at (3, 0); slot (0, 0) → virtual (3, 0).
  dropFromContainer(shop, state, 'bark_plate', 3, 0);

  state.error = '';
  shop.deactivateBag('moss_pouch');

  assert.equal(state.activeBags.length, 1, 'deactivation of a non-empty bag stays blocked');
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

test('[bag-shape] container drop into a non-shape cell of a tetromino bag is rejected', () => {
  // T-bag (trefoil_sack 3x2, shape [[1,1,1],[0,1,0]]) anchors at (3, 0) in
  // unified coords — alongside the base inventory. Slot (0, 1) is the empty
  // bottom-left corner of the T → virtual (anchorX=3, anchorY+1=1) = (3, 1).
  // Drag must not place there and the item must remain in the container.
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'trefoil_sack');
  shop.activateBag('trefoil_sack');

  const containerSlot = state.containerItems.find((s) => s.artifactId === 'bark_plate');
  assert.equal(containerSlot, undefined, 'precondition: no bark_plate yet');
  const rowId = seedContainer(state, 'bark_plate');
  state.draggingArtifactId = 'bark_plate';
  state.draggingSource = 'container';
  shop.onInventoryCellDrop({ x: 3, y: 1 });
  state.draggingArtifactId = '';
  state.draggingSource = '';

  assert.equal(state.builderItems.find((i) => i.artifactId === 'bark_plate'), undefined,
    'item must NOT land on a non-shape cell of the T-bag');
  assert.ok(
    state.containerItems.some((s) => s.id === rowId),
    'container slot must still hold the un-placed bark_plate'
  );
});

test('[bag-shape] container drop into a shape cell of a tetromino bag succeeds', () => {
  // T-bag anchored at unified (3, 0). The T\u2019s bottom row only has slot
  // (1, 1) filled — virtual (anchorX+1, anchorY+1) = (4, 1).
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'trefoil_sack');
  shop.activateBag('trefoil_sack');
  const tBagId = state.activeBags.find((b) => b.artifactId === 'trefoil_sack').id;

  dropFromContainer(shop, state, 'bark_plate', 4, 1);
  const placed = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.ok(placed, 'item lands inside the T-bag');
  assert.equal(placed.x, 4);
  assert.equal(placed.y, 1);
  assert.equal(placed.bagId, tBagId, 'bagId reflects the T-bag row id');
});

test('onInventoryCellDrop (source=inventory) rejects drops into disabled cells', () => {
  // Unified-grid: moss_pouch anchors at (3, 0) cols=2 (cols 3..4). Place
  // bark_plate into moss\u2019 first slot (3, 0), then try to drag it to
  // (5, 0) which is outside any bag and outside the base inventory — an
  // empty-area cell that is disabled for piece placement.
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  dropFromContainer(shop, state, 'bark_plate', 3, 0);
  const landed = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.equal(landed.x, 3);
  assert.equal(landed.y, 0);

  // Drag into the empty bag-area cell at (5, 0).
  shop.onInventoryPieceDragStart({ item: landed });
  shop.onInventoryCellDrop({ x: 5, y: 0 });
  shop.onDragEndAny();

  // The piece must stay at (3, 0) — the drop into the disabled cell is a
  // no-op. Without per-cell coverage check the item would move to (5, 0)
  // and silently trip the server\u2019s occupancy check on the next save.
  const afterDrop = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.equal(afterDrop.x, 3);
  assert.equal(afterDrop.y, 0);
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

// ---------------------------------------------------------------------------
// Bag rotation persistence (docs/bag-rotated-persistence.md). The key fix
// is that rotateBag now calls persistRunLoadout — previously it only
// mutated client state and the rotation vanished on every reload.
// ---------------------------------------------------------------------------

test('[bag-rotated] rotateBag toggles the rotated slot and persists via persistRunLoadout', () => {
  const state = makeFreshState();
  const { shop, calls } = makeShopWithSpy(state);
  // gameRun must be truthy for rotateBag to call persistRunLoadout —
  // mirrors the real flow where the shim is a no-op outside a run.
  state.gameRun = { id: 'run_test' };
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  const activatedId = state.activeBags[0].id;
  // activateBag itself persists; reset the counter so the rotateBag
  // assertion is unambiguous.
  calls.persistRunLoadout = 0;

  shop.rotateBag('moss_pouch');

  assert.equal(state.rotatedBags.length, 1, 'first rotate adds the bag to rotatedBags');
  assert.equal(state.rotatedBags[0].id, activatedId);
  assert.equal(
    calls.persistRunLoadout,
    1,
    'rotateBag must call persistRunLoadout — pre-refactor it did not, which is why rotation vanished on reload'
  );

  // Toggle off.
  shop.rotateBag('moss_pouch');
  assert.equal(state.rotatedBags.length, 0, 'second rotate removes the bag from rotatedBags');
  assert.equal(calls.persistRunLoadout, 2, 'each toggle triggers a persist');
});

test('[bag-rotated] rotateBag preserves rotation state across a deactivate+activate round-trip', () => {
  // The rotatedBags bucket is keyed by row id. Deactivating a rotated
  // bag moves it to containerItems, but the rotatedBags entry stays put
  // (the row still exists server-side with rotated=1). Re-activating it
  // should still find it rotated. Pre-refactor this would have worked
  // by coincidence because rotatedBags was artifactId-keyed and the
  // artifactId survived; now we verify it works for duplicates too.
  const state = makeFreshState();
  const shop = makeShop(state);
  state.gameRun = { id: 'run_test' };
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  shop.rotateBag('moss_pouch');
  const rowId = state.rotatedBags[0].id;

  // Deactivate — the row is still rotated server-side; rotatedBags is
  // a projection of the server state, so the client-side entry should
  // persist across the deactivate hop.
  shop.deactivateBag('moss_pouch');
  assert.equal(state.activeBags.length, 0);
  assert.equal(state.rotatedBags.length, 1, 'rotation survives deactivation (server row still has rotated=1)');
  assert.equal(state.rotatedBags[0].id, rowId);
});

// ---------------------------------------------------------------------------
// Bag chip drag — re-anchor an empty active bag in the bag zone.
// docs/game-requirements.md §2-G. The bag chip is the drag handle; only
// empty bags can move (bagged items would lose their anchor otherwise);
// the drop target is a bag-zone cell whose (x, y) becomes the new anchor.
// ---------------------------------------------------------------------------

test('[Req 2-H] canMoveBag is true for empty bags and false once items land in them', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  const bagId = state.activeBags[0].id;

  assert.equal(shop.canMoveBag(bagId), true, 'newly activated empty bag is movable');
  // Unified-grid: moss anchors at (3, 0); its slot (0, 0) maps to virtual (3, 0).
  dropFromContainer(shop, state, 'bark_plate', 3, 0);
  assert.equal(shop.canMoveBag(bagId), false, 'bag with items inside is not movable');
});

test('[Req 2-H] onBagChipDragStart blocks dragstart when the bag has items, with i18n error', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  const bagId = state.activeBags[0].id;
  // Unified-grid: moss anchors at (3, 0); slot (0, 0) is virtual (3, 0).
  dropFromContainer(shop, state, 'bark_plate', 3, 0);

  let prevented = false;
  const fakeEvent = {
    preventDefault: () => { prevented = true; },
    dataTransfer: { effectAllowed: '', setData: () => {} }
  };
  state.error = '';
  shop.onBagChipDragStart(bagId, fakeEvent);

  assert.equal(prevented, true, 'browser dragstart must be prevented');
  assert.equal(state.draggingBagId, undefined, 'no bag id is staged when blocked');
  assert.match(state.error, /Remove items from the bag first/);
});

test('[Req 2-H] onBagChipDragStart stages drag context for an empty bag', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  const bagId = state.activeBags[0].id;

  let setKey = '';
  let setValue = '';
  const fakeEvent = {
    preventDefault: () => {},
    dataTransfer: { effectAllowed: '', setData: (k, v) => { setKey = k; setValue = v; } }
  };
  shop.onBagChipDragStart(bagId, fakeEvent);

  assert.equal(state.draggingBagId, bagId, 'bag id is staged for the drop handler');
  assert.equal(state.draggingSource, 'bag-chip');
  assert.equal(setKey, 'text/plain');
  assert.equal(setValue, `bag:${bagId}`);
});

test('[Req 2-H] dropping an empty bag chip onto a unified-grid cell sets the anchor', () => {
  // Single empty moss_pouch — auto-pack anchors at (3, 0) (alongside base
  // inventory). Drag to (3, 3) which is below the inventory: inside
  // BAG_COLUMNS, no overlap with base inv or other bags, allowed.
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'moss_pouch');
  shop.activateBag('moss_pouch');
  const bagId = state.activeBags[0].id;
  assert.equal(state.activeBags[0].anchorX, 3, 'precondition: moss auto-packs at col 3 (alongside base inv)');
  assert.equal(state.activeBags[0].anchorY, 0);

  state.draggingBagId = bagId;
  state.draggingSource = 'bag-chip';
  // Cell-drop emits unified virtual (x, y); onBagZoneDrop receives them
  // unchanged (no bag-zone-local offset anymore).
  shop.onInventoryCellDrop({ x: 3, y: 3 });

  assert.equal(state.activeBags[0].anchorX, 3, 'anchor x unchanged');
  assert.equal(state.activeBags[0].anchorY, 3, 'anchor moved below the inventory');
  assert.equal(state.error, '');
});

test('[Req 2-H] bag chip drop is rejected when the new anchor would overlap another bag', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'moss_pouch');
  seedContainer(state, 'amber_satchel');
  shop.activateBag('moss_pouch');
  shop.activateBag('amber_satchel');
  const moss = state.activeBags.find((b) => b.artifactId === 'moss_pouch');
  const amber = state.activeBags.find((b) => b.artifactId === 'amber_satchel');
  // Unified-grid pre-state: moss at (3, 0), amber at (3, 1). Try to drag
  // moss to (3, 1) — would overlap amber\u2019s footprint exactly.
  state.error = '';
  state.draggingBagId = moss.id;
  state.draggingSource = 'bag-chip';
  shop.onInventoryCellDrop({ x: 3, y: 1 });

  assert.equal(moss.anchorX, 3, 'moss anchor unchanged after rejected drop');
  assert.equal(moss.anchorY, 0);
  assert.equal(amber.anchorX, 3, 'amber anchor unchanged');
  assert.equal(amber.anchorY, 1);
  assert.match(state.error, /Does not fit/);
});

test('[Req 2-H] bag chip drop is rejected when the new anchor overflows BAG_COLUMNS', () => {
  const state = makeFreshState();
  const shop = makeShop(state);
  seedContainer(state, 'amber_satchel');
  shop.activateBag('amber_satchel');
  const bagId = state.activeBags[0].id;
  const initialAnchorX = state.activeBags[0].anchorX;
  // amber_satchel is 2x2; BAG_COLUMNS=6 so anchorX=5 would put cols 5..6
  // out of bounds (column 6 is past the right edge).
  state.draggingBagId = bagId;
  state.draggingSource = 'bag-chip';
  shop.onInventoryCellDrop({ x: 5, y: 3 });

  assert.equal(state.activeBags[0].anchorX, initialAnchorX, 'overflow drop must not change the anchor');
});
