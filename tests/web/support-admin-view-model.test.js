import assert from 'node:assert/strict';
import test from 'node:test';
import { SupportAdminScreen } from '../../web/src/pages/SupportAdminScreen.js';

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
  assert.deepEqual(vm.gachaRaritySummary, [{
    rarity: 'rare',
    probability: 0.25,
    count: 2,
    dropWeight: 25,
    expectedText: '25.0%',
    dropWeightText: 25
  }]);
  assert.equal(vm.gachaOddsItems.length, 8);
  assert.deepEqual(vm.gachaOddsItems[1], {
    assetId: 'skin.b',
    rarity: 'secret',
    dropWeight: 1,
    probability: 0.001,
    expectedText: '0.10%',
    dropWeightText: 1,
    copyLimitText: '-'
  });
});
