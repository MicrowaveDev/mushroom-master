import { createMushroomBattleServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/gameplay';
import { query } from '../db.js';
import {
  getMushroomById,
  getStarterPresetCost,
  BAG_COLUMNS,
  ROUND_INCOME,
  portraitUrl
} from '../game-data.js';
import {
  createId,
  dayKey,
  nowIso,
  parseJson
} from '../lib/utils.js';
import { effectiveGridHeight, validateLoadoutItems } from './loadout-utils.js';
import { normalizeRotation } from '../../shared/bag-shape.js';
import { resolveEquippedPortraitId } from './asset-service.js';

const battleServicePort = createMushroomBattleServicePort({
  query,
  getMushroomById,
  getStarterPresetCost,
  bagColumns: BAG_COLUMNS,
  roundIncome: ROUND_INCOME,
  portraitUrl,
  createId,
  dayKey,
  nowIso,
  parseJson,
  effectiveGridHeight,
  validateLoadoutItems,
  normalizeRotation,
  resolveEquippedPortraitId
});

export const {
  getActiveSnapshot,
  getDailyUsage,
  recordBattle,
  getBattle,
  getBattleHistory
} = battleServicePort;
