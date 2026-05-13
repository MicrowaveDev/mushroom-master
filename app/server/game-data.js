// Numeric constants live in app/shared/config.js so the client can
// import the same values without dragging the full game-data artifact/mushroom
// definitions. We `import` them into local scope AND re-export, so existing
// `import { X } from './game-data.js'` call sites plus in-file usages in
// helpers like getShopRefreshCost keep working.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MYCELIUM_LEVEL_CURVE } from './lib/utils.js';
export { MYCELIUM_LEVEL_CURVE };

const __gameDataFile = fileURLToPath(import.meta.url);
const __publicDir = path.resolve(path.dirname(__gameDataFile), '..', '..', 'web', 'public');

// Portrait URL handling is split in two so "drop a new file, it IS the
// default" works without any server restart:
//
// 1. resolvePortraitPath(id, variant) — called at module load. Does
//    extension discovery: scans web/public/portraits/<id>/ for
//    <variant>.{png,jpg,jpeg,webp} and returns the bare URL of the first
//    file that exists on disk. The result is frozen into mushrooms[] and
//    PORTRAIT_VARIANTS so the rest of the server never has to think about
//    file extensions.
//
// 2. portraitUrl(id, variant) — called at REQUEST time by the response
//    shapers (getBootstrap, /api/characters, player-service progression).
//    Stats the current file and appends "?v=<mtime-ms-base36>" so a file
//    replaced between requests shows up immediately on the next fetch.
//    No cache-buster hand-management, no module reload, no restart.
//
// `stat` is effectively free on a warm FS, and there are only ~15 portrait
// files total. The 6 stats per /api/bootstrap call are not a hot path.
const PORTRAIT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

function findPortraitFilename(mushroomId, variant) {
  const dir = path.join(__publicDir, 'portraits', mushroomId);
  for (const ext of PORTRAIT_EXTENSIONS) {
    const candidate = `${variant}.${ext}`;
    if (fs.existsSync(path.join(dir, candidate))) {
      return candidate;
    }
  }
  return null;
}

export function resolvePortraitPath(mushroomId, variant = 'default') {
  const filename = findPortraitFilename(mushroomId, variant);
  if (!filename) {
    // Missing files are guarded by tests/game/portrait-assets.test.js; in
    // the unlikely path we reach here (asset deleted mid-run) return a
    // bare .png URL so the broken-image outline still flags it in review.
    return `/portraits/${mushroomId}/${variant}.png`;
  }
  return `/portraits/${mushroomId}/${filename}`;
}

export function portraitUrl(mushroomId, variant = 'default') {
  const bare = resolvePortraitPath(mushroomId, variant);
  try {
    const filePath = path.join(__publicDir, bare.replace(/^\/+/, ''));
    const mtimeMs = fs.statSync(filePath).mtimeMs;
    return `${bare}?v=${Math.floor(mtimeMs).toString(36)}`;
  } catch {
    return bare;
  }
}

// Return a shallow copy of the mushrooms array with imagePath re-stamped
// from the current mtime of each portrait file on disk. Response shapers
// use this instead of touching the frozen module-level mushrooms array,
// so HTTP responses always carry the latest cache-buster.
export function mushroomsForResponse() {
  return mushrooms.map((m) => ({ ...m, imagePath: portraitUrl(m.id) }));
}

// Same idea for PORTRAIT_VARIANTS. Returns a new {id: variant[]} map with
// each variant's `path` re-stamped from the current file mtime. Callers
// that need fresh URLs for a single mushroom can destructure with bracket
// access: portraitVariantsForResponse()[mushroomId].
export function portraitVariantsForResponse() {
  const out = {};
  for (const [mushroomId, variants] of Object.entries(PORTRAIT_VARIANTS)) {
    out[mushroomId] = variants.map((v) => ({ ...v, path: portraitUrl(mushroomId, v.id) }));
  }
  return out;
}

// Mycelium thresholds that unlock each lore tier on a character wiki page.
// Index = tier number (0–3). Tier 0 (name + portrait) is always unlocked.
export const WIKI_TIER_THRESHOLDS = [0, 100, 1000, 3000];

// Maps a mushroom level (1–20) to its cosmetic tier name.
export function getTier(level) {
  if (level >= 20) return 'eternal';
  if (level >= 15) return 'cap';
  if (level >= 10) return 'root';
  if (level >= 5) return 'mycel';
  return 'spore';
}

import {
  BAG_BASE_CHANCE,
  BAG_COLUMNS,
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  BAG_ROWS,
  CHALLENGE_IDLE_TIMEOUT_MS,
  COMPLETED_RUN_MAX_AGE_DAYS,
  DAILY_BATTLE_LIMIT,
  GHOST_BOT_MAX_AGE_DAYS,
  GHOST_BUDGET_DISCOUNT,
  GHOST_SNAPSHOT_MAX_COUNT,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_ROUNDS_PER_RUN,
  MAX_STUN_CHANCE,
  RATING_FLOOR,
  REROLL_COST,
  ROUND_INCOME,
  SHOP_OFFER_SIZE,
  SHOP_REFRESH_CHEAP_COST,
  SHOP_REFRESH_CHEAP_LIMIT,
  SHOP_REFRESH_EXPENSIVE_COST,
  STARTING_LIVES,
  STEP_CAP
} from '../shared/config.js';

export {
  BAG_BASE_CHANCE,
  BAG_COLUMNS,
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  BAG_ROWS,
  CHALLENGE_IDLE_TIMEOUT_MS,
  COMPLETED_RUN_MAX_AGE_DAYS,
  DAILY_BATTLE_LIMIT,
  GHOST_BOT_MAX_AGE_DAYS,
  GHOST_BUDGET_DISCOUNT,
  GHOST_SNAPSHOT_MAX_COUNT,
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  MAX_ROUNDS_PER_RUN,
  MAX_STUN_CHANCE,
  RATING_FLOOR,
  REROLL_COST,
  ROUND_INCOME,
  SHOP_OFFER_SIZE,
  SHOP_REFRESH_CHEAP_COST,
  SHOP_REFRESH_CHEAP_LIMIT,
  SHOP_REFRESH_EXPENSIVE_COST,
  STARTING_LIVES,
  STEP_CAP
};

// Server-only constant: session TTL lives here (not needed by client).
export const SESSION_TTL_HOURS = 24 * 30;

export const artifacts = [
  // --- Damage family ---
  {
    id: 'spore_needle',
    name: { ru: 'Споровая Игла', en: 'Spore Needle' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 1,
    bonus: { damage: 2 }
  },
  {
    id: 'sporeblade',
    name: { ru: 'Споровый Клинок', en: 'Sporeblade' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 1,
    bonus: { damage: 3 }
  },
  {
    id: 'amber_fang',
    name: { ru: 'Янтарный Клык', en: 'Amber Fang' },
    family: 'damage',
    width: 1,
    height: 2,
    price: 2,
    bonus: { damage: 4, armor: -1 }
  },
  {
    id: 'glass_cap',
    name: { ru: 'Стеклянная Шляпка', en: 'Glass Cap' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    bonus: { damage: 5, armor: -2 }
  },
  {
    id: 'fang_whip',
    name: { ru: 'Клык-Плеть', en: 'Fang Whip' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    bonus: { damage: 6, armor: -3 }
  },
  {
    id: 'burning_cap',
    name: { ru: 'Пылающая Шляпка', en: 'Burning Cap' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 2,
    bonus: { damage: 8, armor: -2, speed: -1 },
    battleEffect: { id: 'burn', trigger: 'hit', target: 'target', statKey: 'damage' }
  },
  // --- Armor family ---
  {
    id: 'bark_plate',
    name: { ru: 'Кора-Пластина', en: 'Bark Plate' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    bonus: { armor: 2 }
  },
  {
    id: 'loam_scale',
    name: { ru: 'Суглинковая Чешуя', en: 'Loam Scale' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    bonus: { armor: 3, speed: -1 }
  },
  {
    id: 'mycelium_wrap',
    name: { ru: 'Мицелиевый Пояс', en: 'Mycelium Wrap' },
    family: 'armor',
    width: 2,
    height: 1,
    price: 1,
    bonus: { armor: 3 }
  },
  {
    id: 'stone_cap',
    name: { ru: 'Каменная Шляпка', en: 'Stone Cap' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 4 }
  },
  {
    id: 'root_shell',
    name: { ru: 'Корневой Панцирь', en: 'Root Shell' },
    family: 'armor',
    width: 2,
    height: 2,
    price: 2,
    bonus: { armor: 5, speed: -1 }
  },
  {
    id: 'truffle_bulwark',
    name: { ru: 'Трюфельный Бастион', en: 'Truffle Bulwark' },
    family: 'armor',
    width: 2,
    height: 2,
    price: 2,
    bonus: { armor: 7, speed: -2, damage: -1 }
  },
  // --- Stun family ---
  {
    id: 'shock_puff',
    name: { ru: 'Шоковая Пышка', en: 'Shock Puff' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    bonus: { stunChance: 8 }
  },
  {
    id: 'glimmer_cap',
    name: { ru: 'Мерцающая Шляпка', en: 'Glimmer Cap' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    bonus: { stunChance: 6 }
  },
  {
    id: 'dust_veil',
    name: { ru: 'Пылевая Вуаль', en: 'Dust Veil' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 12 }
  },
  {
    id: 'static_spore_sac',
    name: { ru: 'Статический Споровый Мешок', en: 'Static Spore Sac' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 14, damage: -1 }
  },
  {
    id: 'thunder_gill',
    name: { ru: 'Громовая Пластина', en: 'Thunder Gill' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 20, armor: -1 }
  },
  {
    id: 'spark_spore',
    name: { ru: 'Искровая Спора', en: 'Spark Spore' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 2,
    bonus: { stunChance: 25, damage: -2 }
  },
  // --- Hybrid / utility ---
  {
    id: 'moss_ring',
    name: { ru: 'Моховое Кольцо', en: 'Moss Ring' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    bonus: { damage: 1, armor: 1 }
  },
  {
    id: 'haste_wisp',
    name: { ru: 'Проворный Блик', en: 'Haste Wisp' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 1,
    bonus: { speed: 1 }
  },
  // --- Lore effect artifacts ---
  // General shop items inspired by wiki locations/factions.
  {
    id: 'reliquary_biostasis_seal',
    name: { ru: 'Печать Биостазиса Реликвария', en: 'Reliquary Biostasis Seal' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 2,
    bonus: { stunChance: 9, armor: 1 },
    description: {
      ru: 'Золотая печать Реликвария стягивает спорную нить в короткий миг биостазиса.',
      en: 'A Golden Reliquary seal knots spore-thread into a brief pulse of biostasis.'
    },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'golden-reliquary'
  },
  {
    id: 'bubbling_grot_bomb',
    name: { ru: 'Бомба Булькающего Грота', en: 'Bubbling Grot Bomb' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 2,
    bonus: { damage: 4, armor: -1 },
    description: {
      ru: 'Бродильный заряд из Булькающего Грота лопается едкой грибной вспышкой.',
      en: 'A ferment charge from the Bubbling Grot bursts with sour fungal pressure.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'bubbling-grot'
  },
  {
    id: 'void_cocoon_spore',
    name: { ru: 'Спора Пустотного Кокона', en: 'Void Cocoon Spore' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 3, stunChance: 5 },
    description: {
      ru: 'Спора-кокон Йог-Мицела закрывается зелеными пластинами вокруг холодной пустоты.',
      en: 'A Ygg-Mycel cocoon spore folds green plates around a cold void core.'
    },
    battleEffect: { id: 'freeze', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'ygg-mycel'
  },
  {
    id: 'root_ash_censer',
    name: { ru: 'Корневая Пепельница', en: 'Root Ash Censer' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 7, armor: 1 },
    description: {
      ru: 'Корневой цензер Йог-Мицела гасит темп боя пепельной спиралью.',
      en: 'A Ygg-Mycel root censer slows the fight with a pale ash spiral.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'ygg-mycel'
  },
  // --- Priority expansion artifacts ---
  // Promoted from docs/artifact-expansion-catalog.md. These are gameplay-live
  // stat artifacts that fit the current combat contract. Dedicated PNGs live
  // under web/public/artifacts and are required by the artifact workflow.
  {
    id: 'hyphae_corset_lace',
    name: { ru: 'Шнуровка Гифного Корсета', en: 'Hyphae Corset Lace' },
    family: 'armor',
    width: 2,
    height: 1,
    price: 2,
    bonus: { armor: 4, stunChance: 4 },
    description: {
      ru: 'Живая золотисто-белая шнуровка защищает и стягивает одной и той же нитью.',
      en: 'A living gold-white lace protects and constricts with the same thread.'
    },
    battleEffect: { id: 'biostasis', trigger: 'block', target: 'actor', statKey: 'armor' }
  },
  {
    id: 'triple_knot_seed',
    name: { ru: 'Семя Тройного Узла', en: 'Triple Knot Seed' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 12, speed: 1 },
    description: {
      ru: 'Три решетчатых зачатка держат пустоту в форме короткого, точного сбоя.',
      en: 'Three lattice bulbs hold the void in the shape of a short, precise interruption.'
    },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'stunChance' }
  },
  {
    id: 'sour_vinegar_ampoule',
    name: { ru: 'Ампула Синего Уксуса', en: 'Sour Vinegar Ampoule' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 1,
    bonus: { damage: 3, armor: -1 },
    description: {
      ru: 'Капля портального уксуса прожигает защиту раньше, чем успевает пахнуть сладко.',
      en: 'A drop of portal vinegar bites through protection before it has time to smell sweet.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' }
  },
  {
    id: 'rainpuff_mine',
    name: { ru: 'Мина-Дождевик', en: 'Rainpuff Mine' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 16, damage: -1 },
    description: {
      ru: 'Плоский дождевик Кирт держит споровое давление до одного резкого хлопка.',
      en: 'A low rainpuff trap holds spore pressure until one sharp snap.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'stunChance' }
  },
  {
    id: 'sound_eater_velvet',
    name: { ru: 'Бархат Пожирателя Звука', en: 'Sound-Eater Velvet' },
    family: 'armor',
    width: 2,
    height: 1,
    price: 2,
    bonus: { armor: 4, stunChance: 6, speed: -1 },
    description: {
      ru: 'Белая плесневая складка из склепа гасит удар так же тихо, как голос.',
      en: 'A fold of white crypt mold muffles a blow as quietly as it muffles a voice.'
    },
    battleEffect: { id: 'decay', trigger: 'block', target: 'actor', statKey: 'armor' }
  },
  {
    id: 'afterimage_cap',
    name: { ru: 'Шляпка-Послеслед', en: 'Afterimage Cap' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 10, speed: 2 },
    description: {
      ru: 'Шляпка оставляет световой след в двух местах сразу, сбивая ритм противника.',
      en: 'The cap leaves light in two places at once, knocking the enemy off rhythm.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'stunChance' }
  },
  {
    id: 'bone_cocoon_greaves',
    name: { ru: 'Поножи Костяного Кокона', en: 'Bone Cocoon Greaves' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 5, speed: -1 },
    description: {
      ru: 'Кость и белая грибница срастаются в тяжелую защиту для долгого боя.',
      en: 'Bone and white mycelium knit into heavy protection for a long fight.'
    },
    battleEffect: { id: 'biostasis', trigger: 'block', target: 'actor', statKey: 'armor' }
  },
  {
    id: 'mirrorfloor_shard',
    name: { ru: 'Осколок Зеркального Пола', en: 'Mirrorfloor Shard' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    bonus: { armor: 2, speed: 1 },
    description: {
      ru: 'Черное стекло Ломиэ отражает удар чуть раньше, чем он становится настоящим.',
      en: 'Lomie black glass reflects a strike a fraction before it becomes real.'
    },
    battleEffect: { id: 'freeze', trigger: 'block', target: 'actor', statKey: 'armor' }
  },
  {
    id: 'overpressure_retort',
    name: { ru: 'Перегретая Реторта', en: 'Overpressure Retort' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 3,
    bonus: { damage: 9, speed: 1, armor: -2 },
    description: {
      ru: 'Лабораторная ошибка Аксилин, которую никто не успел запретить до взрыва.',
      en: 'An Axilin lab accident nobody managed to forbid before it became useful.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' }
  },
  {
    id: 'green_star_sight',
    name: { ru: 'Прицел Зеленой Звезды', en: 'Green Star Sight' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 1,
    bonus: { damage: 2, speed: 1 },
    description: {
      ru: 'Малый прицельный знак Кирт ловит темп цели раньше руки.',
      en: 'Kirt small sight-mark catches the target rhythm before the hand does.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' }
  },
  {
    id: 'ash_library_urn',
    name: { ru: 'Урна Библиотеки Пыли', en: 'Ash Library Urn' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    bonus: { stunChance: 24, armor: 3, damage: -2 },
    description: {
      ru: 'Прах старых артефактов помнит, как заставить сопротивление замолчать.',
      en: 'The dust of old artifacts remembers how to make resistance fall silent.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' }
  },
  {
    id: 'flashstep_tendon',
    name: { ru: 'Сухожилие Мгновенного Шага', en: 'Flashstep Tendon' },
    family: 'damage',
    width: 1,
    height: 2,
    price: 2,
    bonus: { damage: 4, speed: 2, armor: -1 },
    description: {
      ru: 'Живое сухожилие натянуто между двумя вспышками и дергает владельца вперед.',
      en: 'A living tendon stretched between two flashes pulls its bearer forward.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'damage' }
  },
  // --- Deep lore artifact wave ---
  // General shop items from the reserve catalog. They stay inside the current
  // combat contract: visible stats only, with battleEffect as replay flavor.
  {
    id: 'rotlight_lantern',
    name: { ru: 'Фонарь Гнилостного Света', en: 'Rotlight Lantern' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    bonus: { damage: 4, armor: 1 },
    description: {
      ru: 'Костяной фонарь кормит удар теплым светом распада и не дает ему рассыпаться.',
      en: 'A bone lantern feeds each strike with warm rotlight and keeps it from falling apart.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'thalla-rotlight'
  },
  {
    id: 'portal_cut_sickle',
    name: { ru: 'Серп Портального Разреза', en: 'Portal-Cut Sickle' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    fusionOnly: true,
    bonus: { damage: 5, speed: 1, armor: -2 },
    description: {
      ru: 'Лезвие Ломиэ режет не плоть, а короткий путь между защитой и болью.',
      en: 'A Lomie blade cuts the shortcut between protection and pain.'
    },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'crystal-rifts'
  },
  {
    id: 'ferment_sea_pearl',
    name: { ru: 'Жемчужина Моря Ферментации', en: 'Fermentation Sea Pearl' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 3,
    bonus: { damage: 8, speed: 1, armor: -2 },
    description: {
      ru: 'Тяжелая янтарная жемчужина бурлит так громко, что ее используют как оружие.',
      en: 'A heavy amber pearl ferments loudly enough to be used as a weapon.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'fermentation-sea'
  },
  {
    id: 'spore_burst_arrow',
    name: { ru: 'Споровзрывная Стрела', en: 'Spore-Burst Arrow' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    bonus: { damage: 6, stunChance: 4, armor: -2 },
    description: {
      ru: 'Живой наконечник Кирт взрывается спорами в тот же миг, когда находит щель.',
      en: 'Kirt living arrowhead bursts into spores the moment it finds a gap.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'thorn-crown'
  },
  {
    id: 'rustbone_key',
    name: { ru: 'Ржавокостный Ключ', en: 'Rustbone Key' },
    family: 'damage',
    width: 1,
    height: 2,
    price: 2,
    bonus: { damage: 4, stunChance: 5 },
    description: {
      ru: 'Ключ Даламара открывает старые ворота так же легко, как свежую рану.',
      en: 'Dalamar key opens old gates as easily as it opens a fresh wound.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'dead-gates'
  },
  {
    id: 'snaplight_husk',
    name: { ru: 'Щелкающая Свето-Шелуха', en: 'Snaplight Husk' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    bonus: { damage: 4, speed: 2, armor: -1 },
    description: {
      ru: 'Шелуха Морги раскрывается щелчком и оставляет после себя только удар.',
      en: 'Morga husk snaps open and leaves only the strike behind.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'morga-snaplight'
  },
  {
    id: 'amber_needle_swarm',
    name: { ru: 'Рой Янтарных Игл', en: 'Amber Needle Swarm' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 3,
    bonus: { damage: 9, speed: -1, armor: -2 },
    description: {
      ru: 'Смоляной узел держит толстые жала вокруг себя, пока они не находят цель.',
      en: 'A resin node holds thick stingers in orbit until they find a target.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'ygg-mycel'
  },
  {
    id: 'crownthorn_cleaver',
    name: { ru: 'Колючий Секач Кроны', en: 'Crownthorn Cleaver' },
    family: 'damage',
    width: 1,
    height: 2,
    price: 2,
    bonus: { damage: 5, armor: -1 },
    description: {
      ru: 'Черная ветвь Терновой Кроны заточена не металлом, а голодной смолой.',
      en: 'A black Thorn Crown branch sharpened with hungry resin instead of metal.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'thorn-crown'
  },
  {
    id: 'star_spore_sash',
    name: { ru: 'Пояс Звездных Спор', en: 'Star-Spore Sash' },
    family: 'armor',
    width: 2,
    height: 1,
    price: 2,
    bonus: { armor: 3, speed: 1 },
    description: {
      ru: 'Лента Ломиэ переводит входящий удар на соседнюю звезду и возвращает темп владельцу.',
      en: 'Lomie sash routes an incoming blow through a neighboring star and returns tempo to its wearer.'
    },
    battleEffect: { id: 'freeze', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'glass-mycelium'
  },
  {
    id: 'trophy_helm_plate',
    name: { ru: 'Пластина Трофейного Шлема', en: 'Trophy Helm Plate' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    bonus: { armor: 3, speed: -1 },
    description: {
      ru: 'Надкушенная пластина из стены трофеев Кирт все еще помнит, как держать удар.',
      en: 'A bitten plate from Kirt trophy wall still remembers how to hold a blow.'
    },
    battleEffect: { id: 'poison', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'kirt-trophy-wall'
  },
  {
    id: 'gingerroot_filter',
    name: { ru: 'Имбирный Фильтр', en: 'Gingerroot Filter' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 3, damage: 1 },
    description: {
      ru: 'Живой имбирный фильтр Аксилин процеживает яд так долго, что он становится полезным.',
      en: 'Axilin living ginger filter strains poison until it becomes useful.'
    },
    battleEffect: { id: 'ferment', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'axilin-ginger'
  },
  {
    id: 'voidglass_pauldron',
    name: { ru: 'Пустотный Наплечник', en: 'Voidglass Pauldron' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 4, speed: 1 },
    description: {
      ru: 'Зеленое стекло Ломиэ держит пустоту у плеча и сдвигает удар в сторону.',
      en: 'Lomie green glass keeps void at the shoulder and shifts the strike aside.'
    },
    battleEffect: { id: 'freeze', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'void-glass'
  },
  {
    id: 'golden_garden_carapace',
    name: { ru: 'Панцирь Золотого Сада', en: 'Golden Garden Carapace' },
    family: 'armor',
    width: 2,
    height: 2,
    price: 3,
    bonus: { armor: 7, stunChance: 4, damage: -1 },
    description: {
      ru: 'Золотые вешенки и белая грибница срастаются в тяжелую садовую корону.',
      en: 'Golden oyster caps and white mycelium grow into a heavy garden crown.'
    },
    battleEffect: { id: 'biostasis', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'golden-reliquary'
  },
  {
    id: 'amber_resin_shield',
    name: { ru: 'Щит Янтарной Смолы', en: 'Amber Resin Shield' },
    family: 'armor',
    width: 2,
    height: 1,
    price: 2,
    bonus: { armor: 5, speed: -1 },
    description: {
      ru: 'Смола Аксилин застыла как раз перед тем, как должна была взорваться.',
      en: 'Axilin resin hardened just before it was supposed to explode.'
    },
    battleEffect: { id: 'ferment', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'bubbling-grot'
  },
  {
    id: 'porcelain_mold_mask',
    name: { ru: 'Фарфоровая Маска Плесени', en: 'Porcelain Mold Mask' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 2,
    bonus: { armor: 3, stunChance: 4 },
    description: {
      ru: 'Белая маска Даламара не защищает лицо, а убеждает удар забыть о нем.',
      en: 'Dalamar white mask does not protect the face so much as persuade the blow to forget it.'
    },
    battleEffect: { id: 'decay', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'dalamar-crypt'
  },
  {
    id: 'living_bark_latch',
    name: { ru: 'Живая Кора-Застежка', en: 'Living Bark Latch' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    bonus: { armor: 2, damage: 1 },
    description: {
      ru: 'Маленькая застежка Йог-Мицела дышит вместе с владельцем и держится крепче стали.',
      en: 'A small Ygg-Mycel latch breathes with its wearer and grips harder than steel.'
    },
    battleEffect: { id: 'biostasis', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'ygg-mycel'
  },
  {
    id: 'body_memory_splinter',
    name: { ru: 'Осколок Памяти Тела', en: 'Body-Memory Splinter' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 2,
    bonus: { stunChance: 10, damage: 1, speed: -1 },
    description: {
      ru: 'Теплый осколок напоминает телу, кем оно было, и на миг сбивает движение.',
      en: 'A warm splinter reminds the body what it used to be and interrupts its motion.'
    },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'thalla-body-memory'
  },
  {
    id: 'ramaria_snare',
    name: { ru: 'Рамариевая Петля', en: 'Ramaria Snare' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 12, damage: 2 },
    description: {
      ru: 'Коралловая петля Кирт растет туда, где противник собирался сделать следующий шаг.',
      en: 'Kirt coral snare grows exactly where the enemy planned to step next.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'thorn-crown'
  },
  {
    id: 'ashen_heart_smoke',
    name: { ru: 'Дым Пепельного Сердца', en: 'Ashen Heart Smoke' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 14, armor: 1, speed: -1 },
    description: {
      ru: 'Дым из сердца Даламара тяжелый, как обещание, которое никто не произнес.',
      en: 'Smoke from Dalamar heart is as heavy as a promise nobody spoke aloud.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'dalamar-censer'
  },
  {
    id: 'silent_bell_mold',
    name: { ru: 'Плесень Беззвучного Колокола', en: 'Silent Bell Mold' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    bonus: { stunChance: 26, armor: 2, damage: -2 },
    description: {
      ru: 'Колокол из белой плесени не звонит; он просто забирает звук у удара.',
      en: 'A white mold bell does not ring; it takes the sound away from the blow.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'silent-crypt'
  },
  {
    id: 'crystal_rift_chime',
    name: { ru: 'Звон Хрустального Разлома', en: 'Crystal Rift Chime' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 15, speed: 1, armor: -1 },
    description: {
      ru: 'Разлом Ломиэ звенит только внутри костей, поэтому от него трудно увернуться.',
      en: 'Lomie rift chimes only inside the bones, which makes it hard to dodge.'
    },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'crystal-rifts'
  },
  {
    id: 'biostasis_crown_seed',
    name: { ru: 'Семя Короны Биостазиса', en: 'Biostasis Crown Seed' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { stunChance: 22, armor: 3, speed: -2 },
    description: {
      ru: 'Тяжелое семя Реликвария держит время в форме короны и давит ею на врага.',
      en: 'A heavy Reliquary seed holds time in the shape of a crown and presses it onto the enemy.'
    },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'golden-reliquary'
  },
  {
    id: 'spore_snow_globe',
    name: { ru: 'Шар Спорового Снега', en: 'Spore Snow Globe' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    bonus: { stunChance: 7, armor: 1 },
    description: {
      ru: 'Внутри маленького шара падает пепельный снег, который никто не может стряхнуть.',
      en: 'Inside the tiny globe falls ash snow nobody can shake off.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'dalamar-ash-snow'
  },
  {
    id: 'forgotten_crossroads_ring',
    name: { ru: 'Кольцо Забытого Перекрестка', en: 'Forgotten Crossroads Ring' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 9, damage: 2 },
    description: {
      ru: 'Кольцо сшивает золотой путь Тхаллы и черный путь Ломиэ в один неверный шаг.',
      en: 'The ring stitches Thalla golden path and Lomie black path into one uncertain step.'
    },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'forgotten-crossroads'
  },
  // --- Circle relic artifact wave ---
  // A third normal-shop expansion pass. Each item pulls from one character's
  // lore domain while staying in the visible-stat combat model.
  {
    id: 'heartwood_splinter_bow',
    name: { ru: 'Лук из Сердцевинной Щепы', en: 'Heartwood Splinter Bow' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    bonus: { damage: 5, armor: 1 },
    description: {
      ru: 'Черная сердцевина Йог-Мицела гнется в лук, который укрепляет руку вместе с выстрелом.',
      en: 'Black Ygg-Mycel heartwood bends into a bow that braces the hand as it strikes.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'ygg-mycel-heartwood'
  },
  {
    id: 'blue_vinegar_chakram',
    name: { ru: 'Чакрам Синего Уксуса', en: 'Blue Vinegar Chakram' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    bonus: { damage: 5, stunChance: 5, armor: -2 },
    description: {
      ru: 'Кольцо уксуса Аксилин режет защиту кругом и оставляет после себя кислую паузу.',
      en: 'Axilin vinegar ring cuts a circle through armor and leaves a sour pause behind.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'axilin-blue-vinegar'
  },
  {
    id: 'first_bloom_cinder',
    name: { ru: 'Уголек Первого Цвета', en: 'First-Bloom Cinder' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 2,
    bonus: { damage: 3, speed: 2, armor: -1 },
    description: {
      ru: 'Малый уголь Морги вспыхивает до того, как бой успевает назвать свой первый шаг.',
      en: 'A small Morga cinder flares before the fight can name its first step.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'morga-first-bloom'
  },
  {
    id: 'dead_city_nail',
    name: { ru: 'Гвоздь Мертвого Города', en: 'Dead City Nail' },
    family: 'damage',
    width: 1,
    height: 2,
    price: 2,
    bonus: { damage: 5, stunChance: 4, speed: -1 },
    description: {
      ru: 'Ржавый гвоздь Даламара держит ворота закрытыми даже после того, как становится оружием.',
      en: 'Dalamar rusted nail keeps the gate shut even after it becomes a weapon.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'dead-city'
  },
  {
    id: 'golden_spore_mace',
    name: { ru: 'Булава Золотых Спор', en: 'Golden Spore Mace' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 3,
    bonus: { damage: 8, armor: 2, speed: -2 },
    description: {
      ru: 'Тяжелая реликвия Тхаллы бьет как царский запрет и держит владельца на месте.',
      en: 'A heavy Thalla relic hits like a royal interdiction and anchors its bearer.'
    },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'golden-reliquary'
  },
  {
    id: 'riftfang_comet',
    name: { ru: 'Комета Разломного Клыка', en: 'Riftfang Comet' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    fusionOnly: true,
    bonus: { damage: 6, speed: 1, armor: -1 },
    description: {
      ru: 'Клык Ломиэ оставляет за собой короткий зеленый разлом вместо хвоста.',
      en: 'A Lomie fang leaves a short green rift behind it instead of a tail.'
    },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'crystal-rifts'
  },
  {
    id: 'reliquary_bone_buckle',
    name: { ru: 'Костяная Пряжка Реликвария', en: 'Reliquary Bone Buckle' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    bonus: { armor: 2, stunChance: 3 },
    description: {
      ru: 'Священная пряжка не закрывает весь удар, но убеждает его задержаться.',
      en: 'The sacred buckle does not stop the whole blow, but persuades it to linger.'
    },
    battleEffect: { id: 'biostasis', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'golden-reliquary'
  },
  {
    id: 'soft_wall_tile',
    name: { ru: 'Плитка Мягкой Стены', en: 'Soft Wall Tile' },
    family: 'armor',
    width: 2,
    height: 1,
    price: 2,
    bonus: { armor: 4, speed: 1 },
    description: {
      ru: 'Оседающая плитка Ломиэ принимает форму удара и сдвигает владельца в сторону.',
      en: 'Lomie settling tile takes the shape of the blow and nudges its bearer aside.'
    },
    battleEffect: { id: 'freeze', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'soft-wall'
  },
  {
    id: 'ferment_glass_bracer',
    name: { ru: 'Браслет Ферментного Стекла', en: 'Ferment-Glass Bracer' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 4, damage: 1, speed: -1 },
    description: {
      ru: 'Браслет Аксилин держит давление в стекле до тех пор, пока рука не ударит обратно.',
      en: 'Axilin bracer keeps pressure in the glass until the hand strikes back.'
    },
    battleEffect: { id: 'ferment', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'bubbling-grot'
  },
  {
    id: 'thornhide_scale',
    name: { ru: 'Чешуя Терновой Кожи', en: 'Thornhide Scale' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    bonus: { armor: 3, damage: 1 },
    description: {
      ru: 'Черная чешуя Кирт не ждет атаки: она царапает первой.',
      en: 'Kirt black scale does not wait for the attack; it scratches first.'
    },
    battleEffect: { id: 'poison', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'thorn-crown'
  },
  {
    id: 'flashcap_knee_guard',
    name: { ru: 'Наколенник Вспышечной Шляпки', en: 'Flashcap Knee Guard' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 3, speed: 2, damage: -1 },
    description: {
      ru: 'Защита Морги легче щита: она просто оказывается там, где удар уже опоздал.',
      en: 'Morga guard is lighter than a shield: it is simply where the blow arrives too late.'
    },
    battleEffect: { id: 'flash', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'morga-flashcap'
  },
  {
    id: 'obsidian_throne_chip',
    name: { ru: 'Осколок Обсидианового Трона', en: 'Obsidian Throne Chip' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 5, stunChance: 4, speed: -1 },
    description: {
      ru: 'Трон Даламара крошится медленно; даже осколок заставляет бой говорить тише.',
      en: 'Dalamar throne crumbles slowly; even a chip makes the fight speak softer.'
    },
    battleEffect: { id: 'decay', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'obsidian-throne'
  },
  {
    id: 'spore_lullaby_conch',
    name: { ru: 'Раковина Споровой Колыбельной', en: 'Spore Lullaby Conch' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 12, armor: 1 },
    description: {
      ru: 'Тхалла хранит в раковине не звук, а приказ телу уснуть на долю мгновения.',
      en: 'Thalla conch stores not sound, but an order for the body to sleep for a fraction.'
    },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'thalla-spore-lullaby'
  },
  {
    id: 'mirrorloop_knot',
    name: { ru: 'Узел Зеркальной Петли', en: 'Mirrorloop Knot' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    bonus: { stunChance: 7, speed: 1 },
    description: {
      ru: 'Узел Ломиэ отражает следующий шаг обратно в ногу, которая его сделала.',
      en: 'Lomie knot reflects the next step back into the foot that made it.'
    },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'mirror-route'
  },
  {
    id: 'ginger_spark_bottle',
    name: { ru: 'Бутыль Имбирной Искры', en: 'Ginger Spark Bottle' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 11, damage: 2, armor: -1 },
    description: {
      ru: 'Аксилин называет это лекарством, хотя пробка отлетает быстрее любого рецепта.',
      en: 'Axilin calls it medicine, though the cork moves faster than any prescription.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'axilin-ginger'
  },
  {
    id: 'abyss_bow_knot',
    name: { ru: 'Узел Лука Бездны', en: 'Abyss Bow Knot' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { stunChance: 20, damage: 3, armor: -2 },
    description: {
      ru: 'Кусок Черного Ветра Бездны Кирт все еще запоминает цель раньше стрелы.',
      en: 'A chip of Kirt Black Wind of the Abyss remembers the target before the arrow does.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'black-wind-abyss'
  },
  {
    id: 'opening_bell_spore',
    name: { ru: 'Спора Вступительного Колокола', en: 'Opening Bell Spore' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { stunChance: 18, speed: 2, armor: -2 },
    description: {
      ru: 'Колокол Морги звонит только в начале, но эхо хватает на весь обмен ударами.',
      en: 'Morga bell rings only at the opening, but its echo lasts through the exchange.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'morga-opening-bell'
  },
  {
    id: 'entropy_scepter_tip',
    name: { ru: 'Наконечник Скипетра Энтропии', en: 'Entropy Scepter Tip' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 14, armor: 2, damage: -1 },
    description: {
      ru: 'Обломок скипетра Даламара ставит точку там, где противник хотел сделать запятую.',
      en: 'A shard of Dalamar scepter places a period where the enemy wanted a comma.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'entropy-scepter'
  },
  // --- Second fusion relic wave ---
  // These are lore-border artifacts: two established domains touch, then the
  // next-round fusion system creates a result that does not roll in shops.
  {
    id: 'reliquary_ash_crown',
    name: { ru: 'Пепельная Корона Реликвария', en: 'Reliquary Ash Crown' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { stunChance: 20, armor: 4, damage: -1 },
    description: {
      ru: 'Золотой приказ Тхаллы проходит через корневой пепел и становится короной тихого запрета.',
      en: 'Thalla golden command passes through root ash and becomes a crown of quiet interdiction.'
    },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'golden-reliquary-root-ash'
  },
  {
    id: 'portal_vinegar_lens',
    name: { ru: 'Линза Портального Уксуса', en: 'Portal Vinegar Lens' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 3,
    fusionOnly: true,
    bonus: { damage: 6, speed: 2, armor: -2 },
    description: {
      ru: 'Кислота Аксилин, пойманная в зеркальном стекле Ломиэ, режет путь раньше тела.',
      en: 'Axilin sourness caught in Lomie mirror glass cuts the route before it cuts the body.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'bubbling-grot-crystal-rifts'
  },
  {
    id: 'deadwind_arrow',
    name: { ru: 'Стрела Мертвого Ветра', en: 'Deadwind Arrow' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { damage: 8, stunChance: 8, speed: -1 },
    description: {
      ru: 'Стрела Кирт проходит через гвоздь Мертвого Города и приносит с собой сухой ветер склепа.',
      en: 'Kirt arrow passes through a Dead City nail and carries the crypt dry wind with it.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'thorn-crown-dead-city'
  },
  {
    id: 'pressure_bloom_bulwark',
    name: { ru: 'Панцирь Цветущего Давления', en: 'Pressure-Bloom Bulwark' },
    family: 'armor',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { armor: 7, damage: 3, speed: -1 },
    description: {
      ru: 'Бомба Грота не взрывается: янтарная смола заставляет ее цвести наружу броней.',
      en: 'The Grotto bomb does not burst; amber resin makes it bloom outward as armor.'
    },
    battleEffect: { id: 'ferment', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'bubbling-grot'
  },
  {
    id: 'snap_lullaby_bell',
    name: { ru: 'Щелчок Колыбельного Колокола', en: 'Snap-Lullaby Bell' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 3,
    fusionOnly: true,
    bonus: { stunChance: 14, damage: 3, speed: 1 },
    description: {
      ru: 'Приказ Тхаллы уснуть встречает щелчок Морги и приходит раньше сопротивления.',
      en: 'Thalla command to sleep meets Morga snap and arrives before resistance can gather.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'thalla-morga-opening'
  },
  {
    id: 'riftpuff_snare',
    name: { ru: 'Разломная Петля-Дождевик', en: 'Riftpuff Snare' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { stunChance: 24, speed: 1, armor: -1 },
    description: {
      ru: 'Разлом Ломиэ складывает мину Кирт в ловушку, которая хлопает из соседнего пути.',
      en: 'Lomie rift folds Kirt mine into a trap that snaps from the neighboring route.'
    },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'crystal-rifts-thorn-crown'
  },
  {
    id: 'golden_thorn_aegis',
    name: { ru: 'Золотая Терновая Эгида', en: 'Golden Thorn Aegis' },
    family: 'armor',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { armor: 8, damage: 2, speed: -2 },
    description: {
      ru: 'Золотой сад Тхаллы отращивает шипы Кирт и становится щитом, который тоже кусает.',
      en: 'Thalla Golden Garden grows Kirt thorns and becomes a shield that bites back.'
    },
    battleEffect: { id: 'poison', trigger: 'block', target: 'actor', statKey: 'armor' },
    loreSource: 'golden-garden-thorn-crown'
  },
  {
    id: 'soft_ash_hourglass',
    name: { ru: 'Мягкие Пепельные Часы', en: 'Soft Ash Hourglass' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 3,
    fusionOnly: true,
    bonus: { stunChance: 16, armor: 3, speed: 1 },
    description: {
      ru: 'Мягкая стена Ломиэ держит снег спор Даламара, пока время сгущается в тихий песок.',
      en: 'Lomie soft wall holds Dalamar spore snow until time thickens into quiet sand.'
    },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'soft-wall-ash-snow'
  },
  {
    id: 'ginger_star_compass',
    name: { ru: 'Имбирный Звездный Компас', en: 'Ginger Star Compass' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { stunChance: 16, damage: 3, speed: 1, armor: -1 },
    description: {
      ru: 'Искра Аксилин пробегает по звездным спорам Ломиэ и указывает самый резкий путь.',
      en: 'Axilin spark runs through Lomie star spores and points to the sharpest route.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    loreSource: 'ginger-alchemy-star-spores'
  },
  {
    id: 'memory_flash_tendon',
    name: { ru: 'Сухожилие Вспышки Памяти', en: 'Memory-Flash Tendon' },
    family: 'damage',
    width: 1,
    height: 2,
    price: 3,
    fusionOnly: true,
    bonus: { damage: 5, stunChance: 10, speed: 2, armor: -1 },
    description: {
      ru: 'Память тела Тхаллы дергает сухожилие Морги до того, как боль понимает направление.',
      en: 'Thalla body memory pulls Morga flash tendon before pain understands the direction.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'damage' },
    loreSource: 'body-memory-opening-flash'
  },
  // --- Character shop items ---
  // Lore-based items gated by requiredLevel. The level-5 tier has one per
  // mushroom; later tiers may add more.
  // [Req 4-P] through [Req 4-T].
  {
    id: 'thalla_sacred_thread',
    name: { ru: 'Священная Нить Тхаллы', en: 'Thalla\'s Sacred Thread' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 10, damage: 2 },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'thalla', requiredLevel: 5 }
  },
  {
    id: 'lomie_crystal_lattice',
    name: { ru: 'Кристаллическая Решётка Ломиэ', en: 'Lomie\'s Crystal Lattice' },
    family: 'armor',
    width: 2,
    height: 1,
    price: 2,
    bonus: { armor: 5, speed: 1 },
    battleEffect: { id: 'freeze', trigger: 'block', target: 'actor', statKey: 'armor' },
    characterItem: { mushroomId: 'lomie', requiredLevel: 5 }
  },
  {
    id: 'axilin_ferment_core',
    name: { ru: 'Ферментное Ядро Аксилина', en: 'Axilin\'s Ferment Core' },
    family: 'damage',
    width: 1,
    height: 2,
    price: 2,
    bonus: { damage: 5, speed: 1 },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' },
    characterItem: { mushroomId: 'axilin', requiredLevel: 5 }
  },
  {
    id: 'kirt_venom_fang',
    name: { ru: 'Ядовитый Клык Кирт', en: 'Kirt\'s Venom Fang' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 2,
    bonus: { damage: 3, armor: 2 },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' },
    characterItem: { mushroomId: 'kirt', requiredLevel: 5 }
  },
  {
    id: 'morga_flash_seed',
    name: { ru: 'Вспышка-Семя Морги', en: 'Morga\'s Flash Seed' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 12, speed: 2 },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'morga', requiredLevel: 5 }
  },
  {
    id: 'dalamar_ashen_shard',
    name: { ru: 'Пепельный Осколок Даламара', en: 'Dalamar\'s Ashen Shard' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 8, armor: 2 },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'dalamar', requiredLevel: 5 }
  },
  // Level-8 character items from the priority expansion wave.
  {
    id: 'thalla_golden_veil_pin',
    name: { ru: 'Булавка Золотой Вуали', en: 'Thalla\'s Golden Veil Pin' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    bonus: { stunChance: 7 },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'thalla', requiredLevel: 8 }
  },
  {
    id: 'lomie_portal_dust_vial',
    name: { ru: 'Склянка Портальной Пыли Ломиэ', en: 'Lomie\'s Portal Dust Vial' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    bonus: { stunChance: 6, speed: 1 },
    battleEffect: { id: 'freeze', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'lomie', requiredLevel: 8 }
  },
  {
    id: 'axilin_ginger_bite_root',
    name: { ru: 'Кусающий Имбирный Корень Аксилин', en: 'Axilin\'s Ginger Bite Root' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 2,
    bonus: { damage: 4, speed: 1, armor: -1 },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' },
    characterItem: { mushroomId: 'axilin', requiredLevel: 8 }
  },
  {
    id: 'kirt_mantrap_claws',
    name: { ru: 'Когти-Ловушки Кирт', en: 'Kirt\'s Mantrap Claws' },
    family: 'damage',
    width: 2,
    height: 1,
    price: 2,
    bonus: { damage: 5, stunChance: 5, armor: -1 },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' },
    characterItem: { mushroomId: 'kirt', requiredLevel: 8 }
  },
  {
    id: 'morga_first_bloom_spur',
    name: { ru: 'Шпора Первого Цвета Морги', en: 'Morga\'s First Bloom Spur' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 2,
    bonus: { damage: 3, speed: 2, armor: -1 },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'damage' },
    characterItem: { mushroomId: 'morga', requiredLevel: 8 }
  },
  {
    id: 'dalamar_pallid_moth_pin',
    name: { ru: 'Булавка Бледной Моли Даламар', en: 'Dalamar\'s Pallid Moth Pin' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    bonus: { stunChance: 8, armor: 1, damage: -1 },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'dalamar', requiredLevel: 8 }
  },
  // Level-12 and level-16 mastery character items. These extend long-term
  // mushroom progression without changing the normal shop pool.
  {
    id: 'thalla_first_host_locket',
    name: { ru: 'Медальон Первого Носителя Тхаллы', en: 'Thalla\'s First Host Locket' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 2,
    bonus: { stunChance: 11, armor: 1 },
    description: {
      ru: 'Запретный медальон хранит теплую память об Ильве и заставляет тело вспомнить паузу.',
      en: 'A forbidden locket keeps Ilve warm memory and teaches the body to remember stillness.'
    },
    battleEffect: { id: 'biostasis', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'thalla', requiredLevel: 12 }
  },
  {
    id: 'thalla_gold_oyster_crown',
    name: { ru: 'Корона Золотых Вешенок Тхаллы', en: 'Thalla\'s Gold Oyster Crown' },
    family: 'armor',
    width: 2,
    height: 2,
    price: 3,
    bonus: { armor: 8, stunChance: 8, speed: -2 },
    description: {
      ru: 'Тяжелая садовая корона защищает как трон и командует временем как приказ.',
      en: 'A heavy garden crown protects like a throne and commands time like an edict.'
    },
    battleEffect: { id: 'biostasis', trigger: 'block', target: 'actor', statKey: 'armor' },
    characterItem: { mushroomId: 'thalla', requiredLevel: 16 }
  },
  {
    id: 'lomie_mirror_route_map',
    name: { ru: 'Зеркальная Карта Пути Ломиэ', en: 'Lomie\'s Mirror Route Map' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 4, speed: 2 },
    description: {
      ru: 'Черная карта прокладывает безопасный путь там, где удар уже решил попасть.',
      en: 'A black route-map draws a safe path where the blow already decided to land.'
    },
    battleEffect: { id: 'freeze', trigger: 'block', target: 'actor', statKey: 'armor' },
    characterItem: { mushroomId: 'lomie', requiredLevel: 12 }
  },
  {
    id: 'lomie_void_lattice_gate',
    name: { ru: 'Пустотные Врата Решетки Ломиэ', en: 'Lomie\'s Void Lattice Gate' },
    family: 'armor',
    width: 2,
    height: 2,
    price: 3,
    bonus: { armor: 7, stunChance: 10, damage: -1 },
    description: {
      ru: 'Миниатюрные врата держат пустоту в трех грибных ячейках и закрывают лишний путь.',
      en: 'A miniature gate holds void inside three fungal cells and closes the extra route.'
    },
    battleEffect: { id: 'freeze', trigger: 'block', target: 'actor', statKey: 'armor' },
    characterItem: { mushroomId: 'lomie', requiredLevel: 16 }
  },
  {
    id: 'axilin_blue_vinegar_flask',
    name: { ru: 'Фляга Синего Уксуса Аксилин', en: 'Axilin\'s Blue Vinegar Flask' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 10, damage: 2 },
    description: {
      ru: 'Украденная портальная пыль делает уксус достаточно кислым, чтобы сбивать ритм.',
      en: 'Stolen portal dust makes the vinegar sour enough to knock rhythm sideways.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'axilin', requiredLevel: 12 }
  },
  {
    id: 'axilin_ginger_overdrive',
    name: { ru: 'Имбирный Разгон Аксилин', en: 'Axilin\'s Ginger Overdrive' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 3,
    bonus: { damage: 10, speed: 1, armor: -3 },
    description: {
      ru: 'Имбирное ядро работает слишком хорошо и слишком громко, чтобы считаться лекарством.',
      en: 'The ginger core works too well and too loudly to count as medicine.'
    },
    battleEffect: { id: 'ferment', trigger: 'hit', target: 'target', statKey: 'damage' },
    characterItem: { mushroomId: 'axilin', requiredLevel: 16 }
  },
  {
    id: 'kirt_rainpuff_quiver',
    name: { ru: 'Колчан Дождевиков Кирт', en: 'Kirt\'s Rainpuff Quiver' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 14, damage: 3, armor: -1 },
    description: {
      ru: 'Живой колчан держит дождевики под давлением, пока цель не сделает ошибку.',
      en: 'A living quiver keeps puffballs under pressure until the target makes a mistake.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'kirt', requiredLevel: 12 }
  },
  {
    id: 'kirt_black_wind_bowchip',
    name: { ru: 'Щепа Черного Ветра Кирт', en: 'Kirt\'s Black Wind Bowchip' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 3,
    bonus: { damage: 8, stunChance: 8, armor: -2 },
    description: {
      ru: 'Щепка из Черного Ветра Бездны все еще натягивает тетиву в сторону слабого места.',
      en: 'A chip from Black Wind of the Abyss still draws the string toward a weak point.'
    },
    battleEffect: { id: 'poison', trigger: 'hit', target: 'target', statKey: 'damage' },
    characterItem: { mushroomId: 'kirt', requiredLevel: 16 }
  },
  {
    id: 'morga_afterimage_crown',
    name: { ru: 'Корона Послеследа Морги', en: 'Morga\'s Afterimage Crown' },
    family: 'stun',
    width: 2,
    height: 1,
    price: 2,
    bonus: { stunChance: 10, speed: 2 },
    description: {
      ru: 'Корона появляется в двух местах сразу, и противник выбирает неправильное.',
      en: 'The crown appears in two places at once, and the enemy chooses the wrong one.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'morga', requiredLevel: 12 }
  },
  {
    id: 'morga_bellstrike_calyx',
    name: { ru: 'Чашечка Колокольного Удара Морги', en: 'Morga\'s Bellstrike Calyx' },
    family: 'damage',
    width: 2,
    height: 2,
    price: 3,
    bonus: { damage: 7, speed: 2, armor: -2 },
    description: {
      ru: 'Чашечка звенит только при первом рывке, зато весь бой помнит этот звук.',
      en: 'The calyx rings only on the first lunge, but the whole fight remembers the sound.'
    },
    battleEffect: { id: 'flash', trigger: 'hit', target: 'target', statKey: 'damage' },
    characterItem: { mushroomId: 'morga', requiredLevel: 16 }
  },
  {
    id: 'dalamar_throne_splinter',
    name: { ru: 'Тронная Заноза Даламара', en: 'Dalamar\'s Throne Splinter' },
    family: 'armor',
    width: 1,
    height: 2,
    price: 2,
    bonus: { armor: 5, stunChance: 5, speed: -1 },
    description: {
      ru: 'Узкая заноза обсидианового трона защищает тем, что делает движение тяжелым.',
      en: 'A narrow splinter of the obsidian throne protects by making motion heavy.'
    },
    battleEffect: { id: 'decay', trigger: 'block', target: 'actor', statKey: 'armor' },
    characterItem: { mushroomId: 'dalamar', requiredLevel: 12 }
  },
  {
    id: 'dalamar_dead_gate_seal',
    name: { ru: 'Печать Мертвых Врат Даламара', en: 'Dalamar\'s Dead Gate Seal' },
    family: 'stun',
    width: 2,
    height: 2,
    price: 3,
    bonus: { stunChance: 25, armor: 2, damage: -2 },
    description: {
      ru: 'Печать уже осыпается в полезную пыль, но ворота все равно не открываются.',
      en: 'The seal is already crumbling into useful dust, yet the gate still will not open.'
    },
    battleEffect: { id: 'decay', trigger: 'hit', target: 'target', statKey: 'stunChance' },
    characterItem: { mushroomId: 'dalamar', requiredLevel: 16 }
  },
  // --- Character signature starters ---
  // Each of these is preset into the round-1 inventory of one specific
  // mushroom on run start (see STARTER_PRESETS below). They do not appear
  // in shop rolls. Stats mirror the character's active/passive theme.
  {
    id: 'spore_lash',
    name: { ru: 'Споровый Хлыст', en: 'Spore Lash' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    starterOnly: true,
    bonus: { stunChance: 4, damage: 1 }
  },
  {
    id: 'settling_guard',
    name: { ru: 'Оседающий Щит', en: 'Settling Guard' },
    family: 'armor',
    width: 1,
    height: 1,
    price: 1,
    starterOnly: true,
    bonus: { armor: 2 }
  },
  {
    id: 'ferment_phial',
    name: { ru: 'Ферментная Фляга', en: 'Ferment Phial' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 1,
    starterOnly: true,
    bonus: { damage: 2, speed: 1 }
  },
  {
    id: 'measured_strike',
    name: { ru: 'Размеренный Удар', en: 'Measured Strike' },
    family: 'damage',
    width: 1,
    height: 1,
    price: 1,
    starterOnly: true,
    bonus: { damage: 1, armor: 1 }
  },
  {
    id: 'flash_cap',
    name: { ru: 'Вспышка Шляпки', en: 'Flash Cap' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    starterOnly: true,
    bonus: { stunChance: 6, damage: 1 }
  },
  {
    id: 'entropy_shard',
    name: { ru: 'Осколок Энтропии', en: 'Entropy Shard' },
    family: 'stun',
    width: 1,
    height: 1,
    price: 1,
    starterOnly: true,
    bonus: { stunChance: 5, armor: 1 }
  },
  // --- Bag family ---
  {
    // Starter bag — the 3x3 "base inventory" every character gets on run
    // start. Seeded server-side at anchor (0, 0) with active=1 so the
    // client sees it as a regular draggable bag. starterOnly keeps it out
    // of shop pools and bot loadouts. Price 0 (it's a freebie). See
    // .agent/tasks/bag-grid-unification/phase-3-4-spec.md §B.
    id: 'starter_bag',
    name: { ru: 'Стартовая Сумка', en: 'Starter Bag' },
    family: 'bag',
    width: 3,
    height: 3,
    price: 0,
    slotCount: 9,
    color: '#d4c9a8',
    starterOnly: true,
    bonus: {}
  },
  {
    id: 'moss_pouch',
    name: { ru: 'Моховой Мешочек', en: 'Moss Pouch' },
    family: 'bag',
    width: 1,
    height: 2,
    price: 2,
    slotCount: 2,
    color: '#6b8f5e',
    bonus: {}
  },
  {
    id: 'amber_satchel',
    name: { ru: 'Янтарная Сумка', en: 'Amber Satchel' },
    family: 'bag',
    width: 2,
    height: 2,
    price: 3,
    slotCount: 4,
    color: '#d4a54a',
    bonus: {}
  },
  // --- Tetromino-shaped bags (slotCount=4, irregular footprint) ---
  // shape[y][x] = 1 means the cell is part of the bag, 0 means it's empty
  // space inside the bounding box. See app/shared/bag-shape.js. The seven
  // tetrominoes are I, O, T, L, J, S, Z; O is amber_satchel above.
  {
    // T-tetromino, pointing down. 3×2.
    //   ###
    //   .#.
    id: 'trefoil_sack',
    name: { ru: 'Трилистник', en: 'Trefoil Sack' },
    family: 'bag',
    width: 3,
    height: 2,
    price: 3,
    slotCount: 4,
    color: '#a070c0',
    shape: [
      [1, 1, 1],
      [0, 1, 0]
    ],
    bonus: {}
  },
  {
    // L-tetromino, foot to the left. 3×2.
    //   ###
    //   #..
    id: 'birchbark_hook',
    name: { ru: 'Берестяной Крюк', en: 'Birchbark Hook' },
    family: 'bag',
    width: 3,
    height: 2,
    price: 3,
    slotCount: 4,
    color: '#c47a3d',
    shape: [
      [1, 1, 1],
      [1, 0, 0]
    ],
    bonus: {}
  },
  {
    // J-tetromino, foot to the right. 3×2.
    //   ###
    //   ..#
    id: 'hollow_log',
    name: { ru: 'Дуплистое Бревно', en: 'Hollow Log' },
    family: 'bag',
    width: 3,
    height: 2,
    price: 3,
    slotCount: 4,
    color: '#7a5235',
    shape: [
      [1, 1, 1],
      [0, 0, 1]
    ],
    bonus: {}
  },
  {
    // S-tetromino. 3×2.
    //   .##
    //   ##.
    id: 'twisted_stalk',
    name: { ru: 'Витой Стебель', en: 'Twisted Stalk' },
    family: 'bag',
    width: 3,
    height: 2,
    price: 3,
    slotCount: 4,
    color: '#5fa86c',
    shape: [
      [0, 1, 1],
      [1, 1, 0]
    ],
    bonus: {}
  },
  {
    // Z-tetromino. 3×2.
    //   ##.
    //   .##
    id: 'spiral_cap',
    name: { ru: 'Спиральная Шляпка', en: 'Spiral Cap' },
    family: 'bag',
    width: 3,
    height: 2,
    price: 3,
    slotCount: 4,
    color: '#b85a6e',
    shape: [
      [1, 1, 0],
      [0, 1, 1]
    ],
    bonus: {}
  },
  {
    // I-tetromino, vertical. 1×4. Fixed orientation — a horizontal I-bag
    // would need 4 columns, exceeding INVENTORY_COLUMNS=3.
    //   #
    //   #
    //   #
    //   #
    id: 'mycelium_vine',
    name: { ru: 'Грибная Лоза', en: 'Mycelium Vine' },
    family: 'bag',
    width: 1,
    height: 4,
    price: 3,
    slotCount: 4,
    color: '#6e9bbf',
    shape: [
      [1],
      [1],
      [1],
      [1]
    ],
    bonus: {}
  }
];

export const mushrooms = [
  {
    id: 'thalla',
    slug: 'thalla',
    name: { ru: 'Тхалла', en: 'Thalla' },
    styleTag: 'control',
    affinity: { strong: ['stun'], medium: ['damage'], weak: ['armor'] },
    imagePath: resolvePortraitPath('thalla'),
    loreSlug: 'thalla',
    baseStats: { health: 100, attack: 11, speed: 7, defense: 2 },
    passive: {
      name: { ru: 'Эхо Споры', en: 'Spore Echo' },
      description: {
        ru: 'После успешного оглушения следующий удар Тхаллы получает +2 урона.',
        en: 'After a successful stun, Thalla gains +2 damage on her next hit.'
      }
    },
    active: {
      name: { ru: 'Споровый Хлыст', en: 'Spore Lash' },
      description: {
        ru: 'Обычный удар с дополнительными +5% шанса оглушения.',
        en: 'Normal attack with +5% additive stun chance for that hit.'
      }
    }
  },
  {
    id: 'lomie',
    slug: 'lomie',
    name: { ru: 'Ломиэ', en: 'Lomie' },
    styleTag: 'defensive',
    affinity: { strong: ['armor'], medium: ['stun'], weak: ['damage'] },
    imagePath: resolvePortraitPath('lomie'),
    loreSlug: 'lomie',
    baseStats: { health: 125, attack: 9, speed: 4, defense: 5 },
    passive: {
      name: { ru: 'Мягкая Стена', en: 'Soft Wall' },
      description: {
        ru: 'Первое попадание по Ломиэ в бою получает еще -3 урона после брони.',
        en: 'The first hit Lomie receives is reduced by 3 after armor.'
      }
    },
    active: {
      name: { ru: 'Оседающий Щит', en: 'Settling Guard' },
      description: {
        ru: 'Перед ударом готовит +2 временной брони на следующий входящий удар.',
        en: 'Prepares +2 temporary armor for the next incoming hit.'
      }
    }
  },
  {
    id: 'axilin',
    slug: 'axilin',
    legacySlug: 'axylin',
    name: { ru: 'Аксилин', en: 'Axilin' },
    styleTag: 'aggressive',
    affinity: { strong: ['damage'], medium: ['stun'], weak: ['armor'] },
    imagePath: resolvePortraitPath('axilin'),
    loreSlug: 'axilin',
    baseStats: { health: 90, attack: 15, speed: 8, defense: 1 },
    passive: {
      name: { ru: 'Летучий Отвар', en: 'Volatile Brew' },
      description: {
        ru: 'Каждый третий успешный удар получает +3 урона.',
        en: 'Every third successful hit deals +3 bonus damage.'
      }
    },
    active: {
      name: { ru: 'Ферментный Всплеск', en: 'Ferment Burst' },
      description: {
        ru: 'Атака с +2 уроном, после которой защита падает на 1 до конца боя.',
        en: 'Attack with +2 damage, then lose 1 defense for the rest of the battle.'
      }
    }
  },
  {
    id: 'kirt',
    slug: 'kirt',
    name: { ru: 'Кирт', en: 'Kirt' },
    styleTag: 'balanced',
    affinity: { strong: ['damage', 'armor'], medium: ['stun'], weak: [] },
    imagePath: resolvePortraitPath('kirt'),
    loreSlug: 'kirt',
    baseStats: { health: 105, attack: 12, speed: 6, defense: 3 },
    passive: {
      name: { ru: 'Размеренный Ритм', en: 'Measured Rhythm' },
      description: {
        ru: 'Если Кирт не был оглушен на прошлом вражеском ходу, он получает +1 скорости на свой следующий ход.',
        en: 'If Kirt was not stunned on the previous enemy turn, he gains +1 speed on his next action.'
      }
    },
    active: {
      name: { ru: 'Чистый Удар', en: 'Clean Strike' },
      description: {
        ru: 'Удар игнорирует 2 брони цели.',
        en: 'Attack ignores 2 points of enemy armor.'
      }
    }
  },
  {
    id: 'morga',
    slug: 'morga',
    name: { ru: 'Морга', en: 'Morga' },
    styleTag: 'aggressive',
    affinity: { strong: ['damage', 'stun'], medium: [], weak: ['armor'] },
    imagePath: resolvePortraitPath('morga'),
    loreSlug: 'morga',
    baseStats: { health: 85, attack: 13, speed: 10, defense: 0 },
    passive: {
      name: { ru: 'Первый Цвет', en: 'First Bloom' },
      description: {
        ru: 'Первое действие Морги в бою получает +4 урона.',
        en: 'Morga gains +4 damage on her first action.'
      }
    },
    active: {
      name: { ru: 'Вспышка Шляпки', en: 'Flash Cap' },
      description: {
        ru: 'В ничьей по скорости Морга ходит первой и получает +10% шанса оглушения для удара.',
        en: 'Breaks speed ties in her favor and gains +10% stun chance on that attack.'
      }
    }
  },
  {
    id: 'dalamar',
    slug: 'dalamar',
    name: { ru: 'Даламар', en: 'Dalamar' },
    styleTag: 'control',
    affinity: { strong: ['stun'], medium: ['damage', 'armor'], weak: [] },
    imagePath: resolvePortraitPath('dalamar'),
    loreSlug: 'dalamar',
    baseStats: { health: 100, attack: 10, speed: 5, defense: 3 },
    passive: {
      name: { ru: 'Пепельный Покров', en: 'Ashen Veil' },
      description: {
        ru: 'Каждый удар Даламар снижает защиту противника на 1 (минимум 0) на весь бой.',
        en: 'Each of Dalamar\'s hits permanently reduces the enemy\'s defense by 1 (minimum 0).'
      }
    },
    active: {
      name: { ru: 'Кость Энтропии', en: 'Bone of Entropy' },
      description: {
        ru: 'Обычный удар с дополнительными +15% шанса оглушения.',
        en: 'Normal attack with +15% additive stun chance for that hit.'
      }
    }
  }
];

// rewardTable (legacy single-battle reward schedule for [Req 9-D]) deleted
// 2026-04-13. The legacy single-battle flow is no longer reachable from the
// UI; all combat now flows through game runs which use runRewardTable below.

export const runRewardTable = {
  win: { spore: 2, mycelium: 15 },
  loss: { spore: 1, mycelium: 5 }
};

export const completionBonusTable = [
  { minWins: 0, maxWins: 2, spore: 0, mycelium: 0 },
  { minWins: 3, maxWins: 4, spore: 5, mycelium: 2 },
  { minWins: 5, maxWins: 6, spore: 10, mycelium: 5 },
  { minWins: 7, maxWins: 9, spore: 20, mycelium: 10 }
];

// CHALLENGE_WINNER_BONUS is not currently shared with the client — keep here.
export const CHALLENGE_WINNER_BONUS = { spore: 10, mycelium: 5 };
// RATING_FLOOR, GHOST_BUDGET_DISCOUNT, SHOP_REFRESH_* now re-exported at the
// top of this file from app/shared/config.js.

export function getCompletionBonus(wins) {
  for (const tier of completionBonusTable) {
    if (wins >= tier.minWins && wins <= tier.maxWins) {
      return { spore: tier.spore, mycelium: tier.mycelium };
    }
  }
  return { spore: 0, mycelium: 0 };
}

export function getShopRefreshCost(refreshCount) {
  if (refreshCount < SHOP_REFRESH_CHEAP_LIMIT) return SHOP_REFRESH_CHEAP_COST;
  return SHOP_REFRESH_EXPENSIVE_COST;
}

export function getArtifactById(id) {
  return artifacts.find((item) => item.id === id) || null;
}

export function getArtifactPrice(artifact) {
  if (!artifact) {
    return 0;
  }
  return Number.isFinite(artifact.price) ? artifact.price : 1;
}

export function getMushroomById(id) {
  return mushrooms.find((item) => item.id === id) || null;
}

// BAG_* constants re-exported at the top of this file from shared/config.js.

export const bags = artifacts.filter((a) => a.family === 'bag' && !a.starterOnly);
// `starterOnly` items are preset into a specific character's round-1 inventory
// and must never appear in shop rolls or ghost loadouts.
// `fusionOnly` items are created by between-round artifact recipes and must
// not appear in random shops or ghost shop-purchase pools.
// `characterItem` items are level-gated per-mushroom items — they appear only
// through the guaranteed character-item slot, not the general combat pool.
export const combatArtifacts = artifacts.filter((a) => a.family !== 'bag' && !a.starterOnly && !a.characterItem && !a.fusionOnly);
export const characterShopItems = artifacts.filter((a) => a.characterItem);

/**
 * Return eligible character shop items for a mushroom at a given level.
 * [Req 4-Q] eligibility: active mushroom level >= requiredLevel.
 */
export function getEligibleCharacterItems(mushroomId, level) {
  return characterShopItems.filter(
    (a) => a.characterItem.mushroomId === mushroomId && level >= a.characterItem.requiredLevel
  );
}

// Character signature starters — seeded into round 1 for each mushroom on run
// start. Two 1x1 items per character at (0,0) and (1,0). These artifacts have
// `starterOnly: true` and are excluded from shop/ghost pools above.
// Kept for getStarterPresetCost (cost is always 2 across all variants).
export const STARTER_PRESETS = {
  thalla:  ['spore_lash',      'spore_needle'],
  lomie:   ['settling_guard',  'bark_plate'],
  axilin:  ['ferment_phial',   'sporeblade'],
  kirt:    ['measured_strike', 'moss_ring'],
  morga:   ['flash_cap',       'haste_wisp'],
  dalamar: ['entropy_shard',   'shock_puff']
};

// Alternate starter presets per mushroom, unlocked by level.
// All variants use two price-1 items so total preset cost stays at 2.
export const STARTER_PRESET_VARIANTS = {
  thalla: [
    { id: 'default', requiredLevel: 0,  name: { ru: 'Стандарт', en: 'Standard' }, items: ['spore_lash', 'spore_needle'] },
    { id: 'stun',    requiredLevel: 5,  name: { ru: 'Контроль', en: 'Control'  }, items: ['spore_lash', 'glimmer_cap'] },
    { id: 'aggro',   requiredLevel: 10, name: { ru: 'Натиск',   en: 'Aggro'    }, items: ['spore_lash', 'sporeblade'] }
  ],
  lomie: [
    { id: 'default', requiredLevel: 0,  name: { ru: 'Стандарт', en: 'Standard' }, items: ['settling_guard', 'bark_plate'] },
    { id: 'quick',   requiredLevel: 5,  name: { ru: 'Ловкость',  en: 'Quick'   }, items: ['settling_guard', 'haste_wisp'] },
    { id: 'hybrid',  requiredLevel: 10, name: { ru: 'Баланс',   en: 'Hybrid'   }, items: ['settling_guard', 'moss_ring'] }
  ],
  axilin: [
    { id: 'default', requiredLevel: 0,  name: { ru: 'Стандарт', en: 'Standard' }, items: ['ferment_phial', 'sporeblade'] },
    { id: 'speedy',  requiredLevel: 5,  name: { ru: 'Порыв',    en: 'Speedy'   }, items: ['ferment_phial', 'haste_wisp'] },
    { id: 'tough',   requiredLevel: 10, name: { ru: 'Стойкость', en: 'Tough'   }, items: ['ferment_phial', 'moss_ring'] }
  ],
  kirt: [
    { id: 'default',    requiredLevel: 0,  name: { ru: 'Стандарт', en: 'Standard'   }, items: ['measured_strike', 'moss_ring'] },
    { id: 'aggressive', requiredLevel: 5,  name: { ru: 'Агрессия', en: 'Aggressive' }, items: ['measured_strike', 'spore_needle'] },
    { id: 'control',    requiredLevel: 10, name: { ru: 'Контроль', en: 'Control'    }, items: ['measured_strike', 'shock_puff'] }
  ],
  morga: [
    { id: 'default',  requiredLevel: 0,  name: { ru: 'Стандарт',  en: 'Standard' }, items: ['flash_cap', 'haste_wisp'] },
    { id: 'burst',    requiredLevel: 5,  name: { ru: 'Вспышка',   en: 'Burst'    }, items: ['flash_cap', 'spore_needle'] },
    { id: 'lockdown', requiredLevel: 10, name: { ru: 'Оглушение', en: 'Lockdown' }, items: ['flash_cap', 'glimmer_cap'] }
  ],
  dalamar: [
    { id: 'default',   requiredLevel: 0,  name: { ru: 'Стандарт',   en: 'Standard'  }, items: ['entropy_shard', 'shock_puff'] },
    { id: 'defensive', requiredLevel: 5,  name: { ru: 'Защита',     en: 'Defensive' }, items: ['entropy_shard', 'bark_plate'] },
    { id: 'balanced',  requiredLevel: 10, name: { ru: 'Равновесие', en: 'Balanced'  }, items: ['entropy_shard', 'moss_ring'] }
  ]
};

// Portrait variants per mushroom, unlocked by mycelium threshold.
// 'default' is always free (cost: 0). Alternate ids match the filenames
// under /portraits/<mushroomId>/.
export const PORTRAIT_VARIANTS = {
  thalla: [
    { id: 'default', cost: 0,    path: resolvePortraitPath('thalla', 'default'), name: { ru: 'Базовый',   en: 'Default'   } },
    { id: '1',       cost: 500,  path: resolvePortraitPath('thalla', '1'),       name: { ru: 'Вариант 1', en: 'Variant 1' } },
    { id: '2',       cost: 1500, path: resolvePortraitPath('thalla', '2'),       name: { ru: 'Вариант 2', en: 'Variant 2' } }
  ],
  lomie: [
    { id: 'default', cost: 0,    path: resolvePortraitPath('lomie', 'default'), name: { ru: 'Базовый',   en: 'Default'   } },
    { id: '1',       cost: 500,  path: resolvePortraitPath('lomie', '1'),       name: { ru: 'Вариант 1', en: 'Variant 1' } },
    { id: '2',       cost: 1500, path: resolvePortraitPath('lomie', '2'),       name: { ru: 'Вариант 2', en: 'Variant 2' } }
  ],
  axilin: [
    { id: 'default', cost: 0,    path: resolvePortraitPath('axilin', 'default'), name: { ru: 'Базовый',   en: 'Default'   } },
    { id: '1',       cost: 500,  path: resolvePortraitPath('axilin', '1'),       name: { ru: 'Вариант 1', en: 'Variant 1' } },
    { id: '2',       cost: 1500, path: resolvePortraitPath('axilin', '2'),       name: { ru: 'Вариант 2', en: 'Variant 2' } }
  ],
  kirt: [
    { id: 'default', cost: 0,   path: resolvePortraitPath('kirt', 'default'), name: { ru: 'Базовый',   en: 'Default'   } },
    { id: '1',       cost: 500, path: resolvePortraitPath('kirt', '1'),       name: { ru: 'Вариант 1', en: 'Variant 1' } }
  ],
  morga: [
    { id: 'default', cost: 0, path: resolvePortraitPath('morga', 'default'), name: { ru: 'Базовый', en: 'Default' } }
  ],
  dalamar: [
    { id: 'default', cost: 0,    path: resolvePortraitPath('dalamar', 'default'), name: { ru: 'Базовый',   en: 'Default'   } },
    { id: '1',       cost: 500,  path: resolvePortraitPath('dalamar', '1'),       name: { ru: 'Вариант 1', en: 'Variant 1' } },
    { id: '2',       cost: 1500, path: resolvePortraitPath('dalamar', '2'),       name: { ru: 'Вариант 2', en: 'Variant 2' } }
  ]
};

export function getStarterPreset(mushroomId, presetId = 'default') {
  const variants = STARTER_PRESET_VARIANTS[mushroomId];
  const variant = variants?.find(v => v.id === presetId) || variants?.[0];
  if (!variant) return [];
  return variant.items.map((artifactId, index) => {
    const artifact = getArtifactById(artifactId);
    if (!artifact) return null;
    return {
      artifactId,
      x: index,
      y: 0,
      width: artifact.width,
      height: artifact.height,
      sortOrder: index
    };
  }).filter(Boolean);
}

// Total coin value of a character's starter preset. All variants use
// two price-1 items, so cost is always 2. Uses the default preset for
// the reference calculation (safe for any active preset).
export function getStarterPresetCost(mushroomId) {
  const ids = STARTER_PRESETS[mushroomId];
  if (!ids) return 0;
  let total = 0;
  for (const artifactId of ids) {
    const artifact = getArtifactById(artifactId);
    if (artifact) total += getArtifactPrice(artifact);
  }
  return total;
}
