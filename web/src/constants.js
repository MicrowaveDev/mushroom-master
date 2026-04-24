// Client constants re-exported from the shared config so the client and
// server never drift on things like ROUND_INCOME, inventory dimensions,
// or bag distribution constants. Adding a constant means editing
// app/shared/config.js only.
//
// See docs/loadout-refactor-plan.md §5 Step 9 / §3 goal 10.

export {
  BAG_BASE_CHANCE,
  BAG_COLUMNS,
  BAG_ESCALATION_STEP,
  BAG_PITY_THRESHOLD,
  BAG_ROWS,
  DAILY_BATTLE_LIMIT,
  GHOST_BUDGET_DISCOUNT,
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
} from '../../app/shared/config.js';

export function readReplayDelay(envValue, fallback) {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
