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
    gachaForm: { seasonId: 'season_1', packId: 'pack_1' }
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
});
