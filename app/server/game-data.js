export const GRID_SIZE = 4;
export const REQUIRED_ARTIFACT_COUNT = 3;
export const MAX_STUN_CHANCE = 35;
export const DAILY_BATTLE_LIMIT = 10;
export const BATTLE_ROUND_CAP = 12;
export const SESSION_TTL_HOURS = 24 * 30;

export const artifacts = [
  {
    id: 'spore_needle',
    name: { ru: 'Споровая Игла', en: 'Spore Needle' },
    family: 'damage',
    width: 1,
    height: 1,
    bonus: { damage: 2 }
  },
  {
    id: 'amber_fang',
    name: { ru: 'Янтарный Клык', en: 'Amber Fang' },
    family: 'damage',
    width: 1,
    height: 2,
    bonus: { damage: 4, armor: -1 }
  },
  {
    id: 'glass_cap',
    name: { ru: 'Стеклянная Шляпка', en: 'Glass Cap' },
    family: 'damage',
    width: 2,
    height: 1,
    bonus: { damage: 5, armor: -2 }
  },
  {
    id: 'bark_plate',
    name: { ru: 'Кора-Пластина', en: 'Bark Plate' },
    family: 'armor',
    width: 1,
    height: 1,
    bonus: { armor: 2 }
  },
  {
    id: 'mycelium_wrap',
    name: { ru: 'Мицелиевый Пояс', en: 'Mycelium Wrap' },
    family: 'armor',
    width: 2,
    height: 1,
    bonus: { armor: 3 }
  },
  {
    id: 'root_shell',
    name: { ru: 'Корневой Панцирь', en: 'Root Shell' },
    family: 'armor',
    width: 2,
    height: 2,
    bonus: { armor: 5, speed: -1 }
  },
  {
    id: 'shock_puff',
    name: { ru: 'Шоковая Пышка', en: 'Shock Puff' },
    family: 'stun',
    width: 1,
    height: 1,
    bonus: { stunChance: 8 }
  },
  {
    id: 'static_spore_sac',
    name: { ru: 'Статический Споровый Мешок', en: 'Static Spore Sac' },
    family: 'stun',
    width: 1,
    height: 2,
    bonus: { stunChance: 14, damage: -1 }
  },
  {
    id: 'thunder_gill',
    name: { ru: 'Громовая Пластина', en: 'Thunder Gill' },
    family: 'stun',
    width: 2,
    height: 1,
    bonus: { stunChance: 20, armor: -1 }
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

export const rewardTable = {
  win: { spore: 10, mycelium: 100 },
  loss: { spore: 3, mycelium: 10 },
  draw: { spore: 5, mycelium: 40 }
};

export function getArtifactById(id) {
  return artifacts.find((item) => item.id === id) || null;
}

export function getMushroomById(id) {
  return mushrooms.find((item) => item.id === id) || null;
}
