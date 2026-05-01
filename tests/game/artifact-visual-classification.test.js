import assert from 'node:assert/strict';
import test from 'node:test';
import { artifacts, getArtifactById } from '../../app/server/game-data.js';
import {
  artifactFootprintType,
  artifactOwner,
  artifactPrimaryStatKey,
  artifactRoleClass,
  artifactSecondaryStats,
  artifactShineTier,
  artifactTradeoffs,
  artifactVisualClassification
} from '../../app/shared/artifact-visual-classification.js';

const expectedClassificationSnapshot = {
  spore_needle: { role: 'damage', shine: 'plain', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'single' },
  sporeblade: { role: 'damage', shine: 'plain', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'single' },
  amber_fang: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: ['armor'], owner: null, footprintType: 'tall' },
  glass_cap: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  fang_whip: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  burning_cap: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: ['armor', 'speed'], owner: null, footprintType: 'block' },
  bark_plate: { role: 'armor', shine: 'plain', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'single' },
  loam_scale: { role: 'armor', shine: 'plain', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: ['speed'], owner: null, footprintType: 'single' },
  mycelium_wrap: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'wide' },
  stone_cap: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'tall' },
  root_shell: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: ['speed'], owner: null, footprintType: 'block' },
  truffle_bulwark: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: ['damage', 'speed'], owner: null, footprintType: 'block' },
  shock_puff: { role: 'stun', shine: 'plain', primaryStatKey: 'stunChance', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'single' },
  glimmer_cap: { role: 'stun', shine: 'plain', primaryStatKey: 'stunChance', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'single' },
  dust_veil: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'tall' },
  static_spore_sac: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: [], tradeoffs: ['damage'], owner: null, footprintType: 'tall' },
  thunder_gill: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: [], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  spark_spore: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: [], tradeoffs: ['damage'], owner: null, footprintType: 'block' },
  moss_ring: { role: 'armor', shine: 'plain', primaryStatKey: 'armor', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'single' },
  haste_wisp: { role: 'damage', shine: 'plain', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'single' },
  thalla_sacred_thread: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: 'thalla', footprintType: 'tall' },
  lomie_crystal_lattice: { role: 'armor', shine: 'signature', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: [], owner: 'lomie', footprintType: 'wide' },
  axilin_ferment_core: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: [], owner: 'axilin', footprintType: 'tall' },
  kirt_venom_fang: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['armor'], tradeoffs: [], owner: 'kirt', footprintType: 'single' },
  morga_flash_seed: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: [], owner: 'morga', footprintType: 'wide' },
  dalamar_ashen_shard: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: 'dalamar', footprintType: 'tall' },
  spore_lash: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'single' },
  settling_guard: { role: 'armor', shine: 'signature', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'single' },
  ferment_phial: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'single' },
  measured_strike: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'single' },
  flash_cap: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'single' },
  entropy_shard: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'single' },
  starter_bag: { role: 'bag', shine: 'bright', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'block' },
  moss_pouch: { role: 'bag', shine: 'bright', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'tall' },
  amber_satchel: { role: 'bag', shine: 'radiant', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'block' },
  trefoil_sack: { role: 'bag', shine: 'radiant', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'mask' },
  birchbark_hook: { role: 'bag', shine: 'radiant', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'mask' },
  hollow_log: { role: 'bag', shine: 'radiant', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'mask' },
  twisted_stalk: { role: 'bag', shine: 'radiant', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'mask' },
  spiral_cap: { role: 'bag', shine: 'radiant', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'mask' },
  mycelium_vine: { role: 'bag', shine: 'radiant', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'mask' }
};

test('artifact visual classification maps gameplay family to role color', () => {
  assert.equal(artifactRoleClass(getArtifactById('spore_needle')).id, 'damage');
  assert.equal(artifactRoleClass(getArtifactById('bark_plate')).id, 'armor');
  assert.equal(artifactRoleClass(getArtifactById('shock_puff')).id, 'stun');
  assert.equal(artifactRoleClass(getArtifactById('moss_pouch')).id, 'bag');
});

test('artifact visual classification maps specialness to shine tier', () => {
  assert.equal(artifactShineTier(getArtifactById('bark_plate')).id, 'plain');
  assert.equal(artifactShineTier(getArtifactById('root_shell')).id, 'bright');
  assert.equal(artifactShineTier(getArtifactById('amber_satchel')).id, 'radiant');
  assert.equal(artifactShineTier(getArtifactById('kirt_venom_fang')).id, 'signature');
  assert.equal(artifactShineTier(getArtifactById('spore_lash')).id, 'signature');
});

test('every artifact has role and shine CSS classes for UI rendering', () => {
  for (const artifact of artifacts) {
    const visual = artifactVisualClassification(artifact);
    assert.ok(visual.cssClasses.includes(`artifact-role--${visual.role.id}`), artifact.id);
    assert.ok(visual.cssClasses.includes(visual.shine.cssClass), artifact.id);
    assert.match(visual.prompt, /class color:/, artifact.id);
    assert.match(visual.prompt, /shine:/, artifact.id);
  }
});

test('every artifact projects deterministic visual taxonomy metadata', () => {
  for (const artifact of artifacts.filter((item) => !item.isCharacter)) {
    const expected = expectedClassificationSnapshot[artifact.id];
    assert.ok(expected, `missing expected snapshot for ${artifact.id}`);
    assert.equal(artifactPrimaryStatKey(artifact), expected.primaryStatKey, artifact.id);
    assert.deepEqual(artifactSecondaryStats(artifact), expected.secondaryStats, artifact.id);
    assert.deepEqual(artifactTradeoffs(artifact), expected.tradeoffs, artifact.id);
    assert.equal(artifactOwner(artifact), expected.owner, artifact.id);
    assert.equal(artifactFootprintType(artifact), expected.footprintType, artifact.id);
  }
});

test('artifact visual classification snapshot stays stable for the full catalog', () => {
  const actual = Object.fromEntries(artifacts.filter((item) => !item.isCharacter).map((artifact) => {
    const visual = artifactVisualClassification(artifact);
    return [artifact.id, {
      role: visual.role.id,
      shine: visual.shine.id,
      primaryStatKey: visual.primaryStatKey,
      secondaryStats: visual.secondaryStats,
      tradeoffs: visual.tradeoffs,
      owner: visual.owner,
      footprintType: visual.footprintType
    }];
  }));
  assert.deepEqual(actual, expectedClassificationSnapshot);
});
