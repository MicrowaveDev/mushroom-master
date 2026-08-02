import test from 'node:test';
import assert from 'node:assert/strict';
import { useShop } from '../../web/src/composables/useShop.js';
import { BAG_COLUMNS } from '../../web/src/constants.js';
import { getEffectiveShape } from '../../app/shared/bag-shape.js';

const ARTIFACTS = [
  { id: 'starter_bag', family: 'bag', width: 3, height: 3, price: 0, slotCount: 9, bonus: {} },
  { id: 'moss_pouch', family: 'bag', width: 1, height: 2, price: 2, slotCount: 2, bonus: {} },
  { id: 'amber_satchel', family: 'bag', width: 2, height: 2, price: 3, slotCount: 4, bonus: {} },
  { id: 'trefoil_sack', family: 'bag', width: 3, height: 2, price: 3, slotCount: 4, bonus: {}, shape: [[1, 1, 1], [0, 1, 0]] },
  { id: 'birchbark_hook', family: 'bag', width: 3, height: 2, price: 3, slotCount: 4, bonus: {}, shape: [[1, 1, 1], [1, 0, 0]] },
  { id: 'hollow_log', family: 'bag', width: 3, height: 2, price: 3, slotCount: 4, bonus: {}, shape: [[1, 1, 1], [0, 0, 1]] },
  { id: 'twisted_stalk', family: 'bag', width: 3, height: 2, price: 3, slotCount: 4, bonus: {}, shape: [[0, 1, 1], [1, 1, 0]] },
  { id: 'spiral_cap', family: 'bag', width: 3, height: 2, price: 3, slotCount: 4, bonus: {}, shape: [[1, 1, 0], [0, 1, 1]] },
  { id: 'mycelium_vine', family: 'bag', width: 1, height: 4, price: 3, slotCount: 4, bonus: {}, shape: [[1], [1], [1], [1]] }
];

function getArtifact(id) {
  return ARTIFACTS.find((artifact) => artifact.id === id);
}

function makeGridState() {
  return {
    lang: 'en',
    error: '',
    gameRun: { id: 'grid_only_bag_test', player: { coins: 100 } },
    bootstrap: { artifacts: ARTIFACTS },
    shopOffer: [],
    containerItems: [],
    activeBags: [{ id: 'starter_bag_row', artifactId: 'starter_bag', anchorX: 0, anchorY: 0 }],
    rotatedBags: [],
    freshPurchases: [],
    builderItems: [],
    draggingArtifactId: '',
    draggingItem: null,
    draggingSource: '',
    rerollSpent: 0
  };
}

function cellsAt(anchorX, anchorY, shape) {
  const cells = new Set();
  for (let dy = 0; dy < shape.length; dy += 1) {
    for (let dx = 0; dx < (shape[dy] || []).length; dx += 1) {
      if (shape[dy][dx]) cells.add(`${anchorX + dx}:${anchorY + dy}`);
    }
  }
  return cells;
}

function overlaps(a, b) {
  for (const cell of a) {
    if (b.has(cell)) return true;
  }
  return false;
}

function occupiedBagCells(activeBags, rotatedBags = []) {
  const occupied = [];
  for (const activeBag of activeBags) {
    const artifact = getArtifact(activeBag.artifactId);
    const rotation = rotatedBags.find((entry) => entry.id === activeBag.id)?.rotation || 0;
    occupied.push(cellsAt(activeBag.anchorX ?? 0, activeBag.anchorY ?? 0, getEffectiveShape(artifact, rotation)));
  }
  return occupied;
}

function expectedFirstFitAnchor(state, bagId) {
  const bag = getArtifact(bagId);
  const shape = getEffectiveShape(bag, false);
  const cols = shape[0]?.length || 0;
  const rows = shape.length;
  const occupied = occupiedBagCells(state.activeBags, state.rotatedBags);
  const maxY = Math.max(
    0,
    ...state.activeBags.map((activeBag) => {
      const artifact = getArtifact(activeBag.artifactId);
      const rotation = state.rotatedBags.find((entry) => entry.id === activeBag.id)?.rotation || 0;
      return (activeBag.anchorY ?? 0) + getEffectiveShape(artifact, rotation).length;
    })
  ) + rows;
  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x + cols <= BAG_COLUMNS; x += 1) {
      const candidate = cellsAt(x, y, shape);
      if (!occupied.some((bagCells) => overlaps(candidate, bagCells))) {
        return { anchorX: x, anchorY: y };
      }
    }
  }
  return { anchorX: 0, anchorY: maxY };
}

function activateFromGridContainer(shop, state, bagId, index) {
  state.containerItems = [...state.containerItems, { id: `bag_row_${index}`, artifactId: bagId }];
  shop.activateBag(bagId);
  return state.activeBags.find((bag) => bag.artifactId === bagId);
}

test('[grid-only bag placement] each bag type uses a non-overlapping compact orientation', () => {
  const state = makeGridState();
  const shop = useShop(state, getArtifact, () => {});
  const sequence = [
    'moss_pouch',
    'amber_satchel',
    'trefoil_sack',
    'birchbark_hook',
    'hollow_log',
    'twisted_stalk',
    'spiral_cap',
    'mycelium_vine'
  ];

  sequence.forEach((bagId, index) => {
    const expected = expectedFirstFitAnchor(state, bagId);
    const occupiedBefore = occupiedBagCells(state.activeBags, state.rotatedBags);
    const placed = activateFromGridContainer(shop, state, bagId, index);
    const rotation = state.rotatedBags.find((entry) => entry.id === placed.id)?.rotation || 0;
    const shape = getEffectiveShape(getArtifact(bagId), rotation);
    const placedCells = cellsAt(placed.anchorX, placed.anchorY, shape);

    assert.ok(
      placed.anchorY <= expected.anchorY,
      `${bagId} should pack at least as high as its current-orientation first fit`
    );
    assert.ok(
      !occupiedBefore.some((bagCells) => overlaps(placedCells, bagCells)),
      `${bagId} must not overlap an active bag after automatic rotation`
    );
    assert.ok(placed.anchorX >= 0 && placed.anchorX + (shape[0]?.length || 0) <= BAG_COLUMNS);
  });
});

test('[grid-only bag placement] mycelium vine uses the upper gap beside spiral cap', () => {
  const state = makeGridState();
  const shop = useShop(state, getArtifact, () => {});

  activateFromGridContainer(shop, state, 'spiral_cap', 1);
  const vineExpected = expectedFirstFitAnchor(state, 'mycelium_vine');
  const vine = activateFromGridContainer(shop, state, 'mycelium_vine', 2);

  assert.deepEqual(vineExpected, { anchorX: 3, anchorY: 1 });
  assert.deepEqual(
    { anchorX: vine.anchorX, anchorY: vine.anchorY },
    vineExpected,
    'mycelium vine should not be pushed below a spiral-cap bounding-box gap'
  );
});
