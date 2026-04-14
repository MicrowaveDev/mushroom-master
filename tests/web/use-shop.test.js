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

// Drop an item from the container into a specific grid cell via the real
// onInventoryCellDrop handler (same code path as a UI drag). The handler
// reads draggingArtifactId / draggingSource, so we set them like the real
// drag-start would.
function dropFromContainer(shop, state, artifactId, x, y) {
  state.containerItems = [...state.containerItems, artifactId];
  state.draggingArtifactId = artifactId;
  state.draggingSource = 'container';
  shop.onInventoryCellDrop({ x, y });
  state.draggingArtifactId = '';
  state.draggingSource = '';
}

test('[regression] deactivateBag blocks when a later bag contains items', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // Activate moss_pouch first → occupies row 3 (startRow=INVENTORY_ROWS=3, rowCount=1).
  shop.activateBag('moss_pouch');
  assert.deepEqual(state.activeBags, ['moss_pouch']);

  // Activate amber_satchel second → occupies rows 4 and 5 (startRow=4, rowCount=2).
  shop.activateBag('amber_satchel');
  assert.deepEqual(state.activeBags, ['moss_pouch', 'amber_satchel']);
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
    state.activeBags,
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

  // Same setup: moss_pouch (1 row) then amber_satchel (2 rows).
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

  shop.activateBag('moss_pouch');
  shop.activateBag('amber_satchel');
  // Intentionally no dropFromContainer — both bags are empty.

  state.error = '';
  shop.deactivateBag('moss_pouch');

  // Happy path: still allowed, moss_pouch moves back to the container.
  assert.deepEqual(state.activeBags, ['amber_satchel']);
  assert.ok(state.containerItems.includes('moss_pouch'));
  assert.equal(state.error, '');
});

test('onInventoryCellDrop (source=inventory) rejects drops into disabled bag cells', () => {
  const state = makeFreshState();
  const shop = makeShop(state);

  // moss_pouch exposes cols=2 (not the full 3). Place bark_plate into its
  // valid col=0 first, then try to move it to col=2 — which is a disabled
  // cell inside the bag row.
  shop.activateBag('moss_pouch');
  dropFromContainer(shop, state, 'bark_plate', 0, 3);
  const landed = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.equal(landed.x, 0);
  assert.equal(landed.y, 3);

  // Now simulate an inventory-to-inventory drag into the disabled cell.
  state.draggingArtifactId = 'bark_plate';
  state.draggingSource = 'inventory';
  shop.onInventoryCellDrop({ x: 2, y: 3 });
  state.draggingArtifactId = '';
  state.draggingSource = '';

  // The piece must stay at (0,3) — the drop into the disabled cell is a
  // no-op. Under the old code isCellDisabled wasn't checked for the
  // inventory source, so this would have moved to (2,3) and silently
  // tripped the server's occupancy check on the next save.
  const afterDrop = state.builderItems.find((i) => i.artifactId === 'bark_plate');
  assert.equal(afterDrop.x, 0);
  assert.equal(afterDrop.y, 3);
});
