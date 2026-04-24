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
    bonus: { damage: 8, armor: -2, speed: -1 }
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
  // --- Character shop items ---
  // Lore-based items gated by requiredLevel. One per mushroom.
  // [Req 4-P] through [Req 4-T].
  {
    id: 'thalla_sacred_thread',
    name: { ru: 'Священная Нить Тхаллы', en: 'Thalla\'s Sacred Thread' },
    family: 'stun',
    width: 1,
    height: 2,
    price: 2,
    bonus: { stunChance: 10, damage: 2 },
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
    characterItem: { mushroomId: 'dalamar', requiredLevel: 5 }
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
// `characterItem` items are level-gated per-mushroom items — they appear only
// through the guaranteed character-item slot, not the general combat pool.
export const combatArtifacts = artifacts.filter((a) => a.family !== 'bag' && !a.starterOnly && !a.characterItem);
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
