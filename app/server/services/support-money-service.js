import { createMushroomSupportMoneyServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/economy';
import { query } from '../db.js';
import { parseJson } from '../lib/utils.js';

const supportMoneyServicePort = createMushroomSupportMoneyServicePort({
  query,
  parseJson
});

export const { lookupMoneySupportRecords } = supportMoneyServicePort;
