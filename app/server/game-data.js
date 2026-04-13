// Numeric constants live in app/shared/config.js so the client can
// import the same values without dragging the full game-data artifact/mushroom
// definitions. We `import` them into local scope AND re-export, so existing
// `import { X } from './game-data.js'` call sites plus in-file usages in
// helpers like getShopRefreshCost keep working.
import {
  BAG_BASE_CHANCE,
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  CHALLENGE_IDLE_TIMEOUT_MS,
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
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  CHALLENGE_IDLE_TIMEOUT_MS,
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
  // --- Bag family ---
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
  }
];

export const mushrooms = [
  {
    id: 'thalla',
    slug: 'thalla',
    name: { ru: 'Тхалла', en: 'Thalla' },
    styleTag: 'control',
    affinity: { strong: ['stun'], medium: ['damage'], weak: ['armor'] },
    imagePath: '/data/channel/assets/2026-03-27T23-32-46-000Z-53.bin.jpg',
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
    imagePath: '/data/channel/assets/2026-03-28T02-06-16-000Z-212.bin.jpg',
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
    imagePath: '/data/channel/generated/character-art-pack/final-results/axylin-sketch.png',
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
    imagePath: '/data/channel/assets/2026-03-28T02-06-35-000Z-214.bin.jpg',
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
    imagePath: '/data/channel/generated/character-art-pack/final-results/dalamar-sketch.png',
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
export const combatArtifacts = artifacts.filter((a) => a.family !== 'bag' && !a.starterOnly);

// Character signature starters — seeded into round 1 for each mushroom on run
// start. Two 1x1 items per character at (0,0) and (1,0). These artifacts have
// `starterOnly: true` and are excluded from shop/ghost pools above.
export const STARTER_PRESETS = {
  thalla:  ['spore_lash',      'spore_needle'],
  lomie:   ['settling_guard',  'bark_plate'],
  axilin:  ['ferment_phial',   'sporeblade'],
  kirt:    ['measured_strike', 'moss_ring'],
  morga:   ['flash_cap',       'haste_wisp']
};

export function getStarterPreset(mushroomId) {
  const ids = STARTER_PRESETS[mushroomId];
  if (!ids) return [];
  return ids.map((artifactId, index) => {
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

// Total coin value of a character's starter preset. Used by
// battle-service.js getActiveSnapshot to widen the run budget ceiling by
// the free gift value — the player's loadout is allowed to exceed
// cumulative-income by exactly this much. Mushrooms with no preset
// (unknown id) contribute 0.
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
