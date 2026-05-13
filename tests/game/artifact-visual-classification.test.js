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
  reliquary_biostasis_seal: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'single' },
  bubbling_grot_bomb: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: ['armor'], owner: null, footprintType: 'single' },
  void_cocoon_spore: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: [], owner: null, footprintType: 'tall' },
  root_ash_censer: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'wide' },
  hyphae_corset_lace: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: [], owner: null, footprintType: 'wide' },
  triple_knot_seed: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'wide' },
  sour_vinegar_ampoule: { role: 'damage', shine: 'plain', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: ['armor'], owner: null, footprintType: 'single' },
  rainpuff_mine: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: [], tradeoffs: ['damage'], owner: null, footprintType: 'wide' },
  sound_eater_velvet: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: ['speed'], owner: null, footprintType: 'wide' },
  afterimage_cap: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'wide' },
  bone_cocoon_greaves: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: ['speed'], owner: null, footprintType: 'tall' },
  mirrorfloor_shard: { role: 'armor', shine: 'plain', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'single' },
  overpressure_retort: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'block' },
  green_star_sight: { role: 'damage', shine: 'plain', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'single' },
  ash_library_urn: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['damage'], owner: null, footprintType: 'block' },
  flashstep_tendon: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'tall' },
  rotlight_lantern: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'wide' },
  portal_cut_sickle: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  ferment_sea_pearl: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'block' },
  spore_burst_arrow: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['stun'], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  rustbone_key: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['stun'], tradeoffs: [], owner: null, footprintType: 'tall' },
  snaplight_husk: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  amber_needle_swarm: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: ['armor', 'speed'], owner: null, footprintType: 'block' },
  crownthorn_cleaver: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: [], tradeoffs: ['armor'], owner: null, footprintType: 'tall' },
  star_spore_sash: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'wide' },
  trophy_helm_plate: { role: 'armor', shine: 'plain', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: ['speed'], owner: null, footprintType: 'single' },
  gingerroot_filter: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'tall' },
  voidglass_pauldron: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'tall' },
  golden_garden_carapace: { role: 'armor', shine: 'radiant', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: ['damage'], owner: null, footprintType: 'block' },
  amber_resin_shield: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: ['speed'], owner: null, footprintType: 'wide' },
  porcelain_mold_mask: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: [], owner: null, footprintType: 'single' },
  living_bark_latch: { role: 'armor', shine: 'plain', primaryStatKey: 'armor', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'single' },
  body_memory_splinter: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: ['speed'], owner: null, footprintType: 'single' },
  ramaria_snare: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'tall' },
  ashen_heart_smoke: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['speed'], owner: null, footprintType: 'tall' },
  silent_bell_mold: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['damage'], owner: null, footprintType: 'block' },
  crystal_rift_chime: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'tall' },
  biostasis_crown_seed: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['speed'], owner: null, footprintType: 'block' },
  spore_snow_globe: { role: 'stun', shine: 'plain', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'single' },
  forgotten_crossroads_ring: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'wide' },
  heartwood_splinter_bow: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'wide' },
  blue_vinegar_chakram: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['stun'], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  first_bloom_cinder: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'single' },
  dead_city_nail: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['stun'], tradeoffs: ['speed'], owner: null, footprintType: 'tall' },
  golden_spore_mace: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: ['armor'], tradeoffs: ['speed'], owner: null, footprintType: 'block' },
  riftfang_comet: { role: 'damage', shine: 'bright', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  reliquary_bone_buckle: { role: 'armor', shine: 'plain', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: [], owner: null, footprintType: 'single' },
  soft_wall_tile: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'wide' },
  ferment_glass_bracer: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['damage'], tradeoffs: ['speed'], owner: null, footprintType: 'tall' },
  thornhide_scale: { role: 'armor', shine: 'plain', primaryStatKey: 'armor', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'single' },
  flashcap_knee_guard: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: ['damage'], owner: null, footprintType: 'tall' },
  obsidian_throne_chip: { role: 'armor', shine: 'bright', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: ['speed'], owner: null, footprintType: 'tall' },
  spore_lullaby_conch: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'wide' },
  mirrorloop_knot: { role: 'stun', shine: 'plain', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'single' },
  ginger_spark_bottle: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: ['armor'], owner: null, footprintType: 'tall' },
  abyss_bow_knot: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: ['armor'], owner: null, footprintType: 'block' },
  opening_bell_spore: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'block' },
  entropy_scepter_tip: { role: 'stun', shine: 'bright', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['damage'], owner: null, footprintType: 'tall' },
  reliquary_ash_crown: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['damage'], owner: null, footprintType: 'block' },
  portal_vinegar_lens: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'wide' },
  deadwind_arrow: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: ['stun'], tradeoffs: ['speed'], owner: null, footprintType: 'block' },
  pressure_bloom_bulwark: { role: 'armor', shine: 'radiant', primaryStatKey: 'armor', secondaryStats: ['damage'], tradeoffs: ['speed'], owner: null, footprintType: 'block' },
  snap_lullaby_bell: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['damage', 'speed'], tradeoffs: [], owner: null, footprintType: 'wide' },
  riftpuff_snare: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: null, footprintType: 'block' },
  golden_thorn_aegis: { role: 'armor', shine: 'radiant', primaryStatKey: 'armor', secondaryStats: ['damage'], tradeoffs: ['speed'], owner: null, footprintType: 'block' },
  soft_ash_hourglass: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['armor', 'speed'], tradeoffs: [], owner: null, footprintType: 'wide' },
  ginger_star_compass: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['damage', 'speed'], tradeoffs: ['armor'], owner: null, footprintType: 'block' },
  memory_flash_tendon: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: ['speed', 'stun'], tradeoffs: ['armor'], owner: null, footprintType: 'tall' },
  porcelain_rotlight_lantern: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: ['armor'], tradeoffs: ['speed'], owner: null, footprintType: 'block' },
  vinegar_gate_chakram: { role: 'damage', shine: 'radiant', primaryStatKey: 'damage', secondaryStats: ['stun'], tradeoffs: ['armor'], owner: null, footprintType: 'block' },
  voidflash_pauldron: { role: 'armor', shine: 'radiant', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: ['damage'], owner: null, footprintType: 'block' },
  ramaria_throne_snare: { role: 'stun', shine: 'radiant', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['speed'], owner: null, footprintType: 'block' },
  thalla_sacred_thread: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: 'thalla', footprintType: 'tall' },
  lomie_crystal_lattice: { role: 'armor', shine: 'signature', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: [], owner: 'lomie', footprintType: 'wide' },
  axilin_ferment_core: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: [], owner: 'axilin', footprintType: 'tall' },
  kirt_venom_fang: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['armor'], tradeoffs: [], owner: 'kirt', footprintType: 'single' },
  morga_flash_seed: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: [], owner: 'morga', footprintType: 'wide' },
  dalamar_ashen_shard: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: 'dalamar', footprintType: 'tall' },
  thalla_golden_veil_pin: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: [], tradeoffs: [], owner: 'thalla', footprintType: 'single' },
  lomie_portal_dust_vial: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: [], owner: 'lomie', footprintType: 'single' },
  axilin_ginger_bite_root: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: 'axilin', footprintType: 'single' },
  kirt_mantrap_claws: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['stun'], tradeoffs: ['armor'], owner: 'kirt', footprintType: 'wide' },
  morga_first_bloom_spur: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: 'morga', footprintType: 'single' },
  dalamar_pallid_moth_pin: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['damage'], owner: 'dalamar', footprintType: 'single' },
  thalla_first_host_locket: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: 'thalla', footprintType: 'single' },
  thalla_gold_oyster_crown: { role: 'armor', shine: 'signature', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: ['speed'], owner: 'thalla', footprintType: 'block' },
  lomie_mirror_route_map: { role: 'armor', shine: 'signature', primaryStatKey: 'armor', secondaryStats: ['speed'], tradeoffs: [], owner: 'lomie', footprintType: 'tall' },
  lomie_void_lattice_gate: { role: 'armor', shine: 'signature', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: ['damage'], owner: 'lomie', footprintType: 'block' },
  axilin_blue_vinegar_flask: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: 'axilin', footprintType: 'tall' },
  axilin_ginger_overdrive: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: 'axilin', footprintType: 'block' },
  kirt_rainpuff_quiver: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: ['armor'], owner: 'kirt', footprintType: 'wide' },
  kirt_black_wind_bowchip: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['stun'], tradeoffs: ['armor'], owner: 'kirt', footprintType: 'block' },
  morga_afterimage_crown: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['speed'], tradeoffs: [], owner: 'morga', footprintType: 'wide' },
  morga_bellstrike_calyx: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: ['armor'], owner: 'morga', footprintType: 'block' },
  dalamar_throne_splinter: { role: 'armor', shine: 'signature', primaryStatKey: 'armor', secondaryStats: ['stun'], tradeoffs: ['speed'], owner: 'dalamar', footprintType: 'tall' },
  dalamar_dead_gate_seal: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: ['damage'], owner: 'dalamar', footprintType: 'block' },
  spore_lash: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'single' },
  settling_guard: { role: 'armor', shine: 'signature', primaryStatKey: 'armor', secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'single' },
  ferment_phial: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['speed'], tradeoffs: [], owner: null, footprintType: 'single' },
  measured_strike: { role: 'damage', shine: 'signature', primaryStatKey: 'damage', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'single' },
  flash_cap: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['damage'], tradeoffs: [], owner: null, footprintType: 'single' },
  entropy_shard: { role: 'stun', shine: 'signature', primaryStatKey: 'stunChance', secondaryStats: ['armor'], tradeoffs: [], owner: null, footprintType: 'single' },
  starter_bag: { role: 'bag', shine: 'bright', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'block' },
  moss_pouch: { role: 'bag', shine: 'bright', primaryStatKey: null, secondaryStats: [], tradeoffs: [], owner: null, footprintType: 'wide' },
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
