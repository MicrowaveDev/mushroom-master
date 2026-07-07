import achievements from './run-achievements.json' with { type: 'json' };
import { createRunAchievementService, MAX_NEW_RUN_ACHIEVEMENTS } from '@microwavedev/backpack-game-core/modules/season';
import { seasonLevelRank } from './season-levels.js';

export const runAchievements = achievements;
export { MAX_NEW_RUN_ACHIEVEMENTS };

const characterAccents = {
  thalla: 'thalla',
  lomie: 'lomie',
  axilin: 'axilin',
  kirt: 'kirt',
  morga: 'morga',
  dalamar: 'dalamar'
};

const priorityById = {
  first_ring_crossed: 10,
  season_bronze_spore: 20,
  perfect_circle: 30,
  last_spore: 35,
  thalla_spore_echo: 30,
  lomie_soft_wall: 30,
  axilin_volatile_brew: 30,
  kirt_measured_rhythm: 30,
  morga_first_bloom: 30,
  dalamar_ashen_veil: 30,
  deep_run: 50,
  three_caps_taken: 55,
  season_silver_thread: 20,
  season_gold_cap: 20,
  season_diamond_node: 20,
  thalla_sacred_thread: 80,
  lomie_stone_breath: 80,
  axilin_ferment_storm: 80,
  kirt_clean_path: 80,
  morga_flash_trail: 80,
  dalamar_entropy_bone: 80,
  thalla_circle_canticle: 90,
  lomie_ancient_bastion: 90,
  axilin_cauldron_star: 90,
  kirt_unbroken_cadence: 90,
  morga_sunburst_crown: 90,
  dalamar_null_crown: 90
};

function badgeSymbolForAchievement(achievement) {
  if (achievement.type === 'season') {
    if (achievement.id.includes('diamond')) return '◆';
    if (achievement.id.includes('gold')) return '●';
    if (achievement.id.includes('silver')) return '◇';
    return '◉';
  }
  if (achievement.characterId === 'thalla') return '✦';
  if (achievement.characterId === 'lomie') return '▣';
  if (achievement.characterId === 'morga') return '✹';
  if (achievement.characterId === 'axilin') return '∴';
  if (achievement.characterId === 'kirt') return '⌁';
  if (achievement.characterId === 'dalamar') return '◌';
  if (achievement.id === 'perfect_circle') return '◎';
  return '•';
}

const mushroomRunAchievements = createRunAchievementService({
  achievements,
  characterAccents,
  priorityById,
  seasonLevelRank,
  badgeSymbolForAchievement,
  getCharacterId: (context = {}) => context.characterId || context.mushroomId || null,
  maxNew: MAX_NEW_RUN_ACHIEVEMENTS
});

export const {
  getRunAchievementById,
  getAllRunAchievements,
  getNextRunAchievementHint,
  getRunAchievementsByIds,
  getEarnedRunAchievements,
  getAwardableRunAchievements
} = mushroomRunAchievements;
