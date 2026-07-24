import assert from 'node:assert/strict';
import test from 'node:test';
import { SupportAdminScreen } from '@microwavedev/backpack-game-core/vue/pages';

function viewModel(overrides = {}) {
  const vm = {
    token: '',
    actorId: '',
    approvalActorId: '',
    gachaCatalog: null,
    gachaValidation: null,
    gachaPreview: null,
    gachaPlanForm: { seasonId: '', characterId: '', promotePackId: '' },
    gachaForm: { seasonId: '', packId: '' },
    ...overrides
  };
  for (const [key, method] of Object.entries(SupportAdminScreen.methods || {})) {
    vm[key] = method.bind(vm);
  }
  for (const [key, getter] of Object.entries(SupportAdminScreen.computed || {})) {
    Object.defineProperty(vm, key, {
      enumerable: true,
      get: () => getter.call(vm)
    });
  }
  return vm;
}

test('support admin gacha view model delegates checklist and season-plan rows through core helpers', () => {
  const vm = viewModel({
    gachaPlanForm: { seasonId: 'season_1', characterId: '', promotePackId: '' },
    gachaCatalog: {
      planSummary: { targetPerCharacter: 2 },
      planCharacters: [
        { id: 'thalla', label: 'Thalla' },
        { id: 'axilin', label: 'Axilin' }
      ],
      planItems: [
        { seasonId: 'season_1', characterId: 'thalla', status: 'ready', dropWeight: 25 },
        { seasonId: 'season_1', characterId: 'thalla', status: 'planned', dropWeight: 75 },
        { seasonId: 'season_1', characterId: 'axilin', status: 'archived', dropWeight: 100 },
        { seasonId: 'season_2', characterId: 'axilin', status: 'ready', dropWeight: 999 }
      ],
      packs: [{
        id: 'pack_1',
        validation: {
          errors: [{ code: 'item_missing' }],
          warnings: [{ code: 'weight_low' }]
        },
        releaseChecklist: {
          blockers: [{ code: 'missing_dates', severity: 'blocker' }],
          warnings: [{ code: 'policy_warning', severity: 'warning' }],
          passed: [{ code: 'price_present', severity: 'pass' }]
        }
      }]
    },
    gachaForm: { seasonId: 'season_1', packId: 'pack_1' },
    gachaValidation: {
      preview: {
        raritySummary: [{ rarity: 'rare', probability: 0.25, count: 2, dropWeight: 25 }],
        items: [
          { assetId: 'skin.a', rarity: 'rare', dropWeight: 25, probability: 0.25, copyLimit: 1 },
          { assetId: 'skin.b', rarity: 'secret', dropWeight: 1, probability: 0.001 },
          { assetId: 'skin.c', rarity: 'common', dropWeight: 100, probability: 0.749 },
          { assetId: 'skin.d', rarity: 'common', dropWeight: 100, probability: 0 },
          { assetId: 'skin.e', rarity: 'common', dropWeight: 100, probability: 0 },
          { assetId: 'skin.f', rarity: 'common', dropWeight: 100, probability: 0 },
          { assetId: 'skin.g', rarity: 'common', dropWeight: 100, probability: 0 },
          { assetId: 'skin.h', rarity: 'common', dropWeight: 100, probability: 0 },
          { assetId: 'skin.i', rarity: 'common', dropWeight: 100, probability: 0 }
        ]
      }
    },
    gachaPreview: {
      simulation: {
        items: [
          { assetId: 'skin.a', rarity: 'rare', dropWeight: 25, observedPerRoll: 0.25, observedCount: 250 },
          { assetId: 'skin.b', rarity: 'secret', observedPerRoll: 0.001, observedCount: 1 }
        ]
      }
    },
    gachaFixtureResult: {
      summary: { total: 3 },
      operations: [
        { type: 'pack', id: 'pack_1', action: 'update', afterCount: 2 },
        { type: 'item', id: 'item_1', action: 'noop' }
      ]
    }
  });

  assert.equal(vm.gachaPlanTotalWeight, 100);
  assert.deepEqual(vm.gachaPlanCoverage, [
    { id: 'thalla', label: 'Thalla', count: 2, readyCount: 1, totalWeight: 100, target: 2, missing: 0, enough: true },
    { id: 'axilin', label: 'Axilin', count: 0, readyCount: 0, totalWeight: 0, target: 2, missing: 2, enough: false }
  ]);
  assert.equal(vm.formatGachaPlanChance({ dropWeight: 25 }), '25.0%');
  assert.deepEqual(vm.gachaValidationIssues, [
    { code: 'item_missing', severity: 'error' },
    { code: 'weight_low', severity: 'warning' }
  ]);
  assert.deepEqual(vm.gachaReleaseItems.map((issue) => issue.code), [
    'missing_dates',
    'policy_warning',
    'price_present'
  ]);
  assert.deepEqual(vm.gachaOddsTables.map((table) => [table.key, table.rows.length]), [
    ['rarities', 1],
    ['items', 8]
  ]);
  assert.deepEqual(vm.gachaOddsTables[0].columns.map((column) => column.label), [
    'Rarity',
    'Expected',
    'Items',
    'Weight'
  ]);
  assert.deepEqual(vm.gachaOddsTables[0].rows[0], {
    rarity: 'rare',
    probability: 0.25,
    count: 2,
    dropWeight: 25,
    expectedText: '25.0%',
    dropWeightText: 25,
    rowKey: 'rare'
  });
  assert.deepEqual(vm.gachaOddsTables[1].rows[1], {
    assetId: 'skin.b',
    rarity: 'secret',
    dropWeight: 1,
    probability: 0.001,
    expectedText: '0.10%',
    dropWeightText: 1,
    copyLimitText: '-',
    rowKey: 'skin.b'
  });
  assert.deepEqual(vm.gachaSimulationItems[1], {
    assetId: 'skin.b',
    rarity: 'secret',
    observedPerRoll: 0.001,
    observedCount: 1,
    observedPerRollText: '0.10%',
    dropWeightText: '-'
  });
  assert.deepEqual(vm.gachaFixtureOperations, [
    { type: 'pack', id: 'pack_1', action: 'update', afterCount: 2, afterCountText: 2 },
    { type: 'item', id: 'item_1', action: 'noop', afterCountText: '-' }
  ]);
});
