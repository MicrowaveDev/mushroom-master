// Shared game configuration — imported by both the server (game-data.js) and
// the client (web/src/constants.js). Adding a constant here automatically
// keeps both sides in sync. Non-numeric data (artifact definitions, mushrooms,
// reward tables) stays in game-data.js because the client doesn't need it
// directly at import time — it arrives via bootstrap.

// --- Inventory grid ---
export const INVENTORY_COLUMNS = 3;
export const INVENTORY_ROWS = 3;
// Bag zone (rendered below the base inventory) is wider than the base grid
// so multiple bags can pack side-by-side instead of stacking vertically.
// See docs/game-requirements.md §2-F.
export const BAG_COLUMNS = 6;

// --- Shop / prep budget ---
export const MAX_ARTIFACT_COINS = 5;
export const SHOP_OFFER_SIZE = 5;
export const REROLL_COST = 1;
export const SHOP_REFRESH_CHEAP_LIMIT = 3;
export const SHOP_REFRESH_CHEAP_COST = 1;
export const SHOP_REFRESH_EXPENSIVE_COST = 2;

// --- Game run lifecycle ---
export const MAX_ROUNDS_PER_RUN = 9;
export const STARTING_LIVES = 5;
export const ROUND_INCOME = [5, 5, 5, 6, 6, 7, 7, 8, 8];
export const DAILY_BATTLE_LIMIT = 10;

// --- Combat ---
export const MAX_STUN_CHANCE = 35;
export const STEP_CAP = 120;

// --- Rating / economy ---
export const RATING_FLOOR = 100;
export const GHOST_BUDGET_DISCOUNT = 0.12;

// --- Bag distribution ---
export const BAG_BASE_CHANCE = 0.15;
export const BAG_ESCALATION_STEP = 0.08;
export const BAG_PITY_THRESHOLD = 5;

// --- Ghost snapshot retention ---
export const GHOST_BOT_MAX_AGE_DAYS = 1;
export const GHOST_SNAPSHOT_MAX_COUNT = 10000;

// --- Challenge timeout ---
export const CHALLENGE_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// --- Completed run retention ---
export const COMPLETED_RUN_MAX_AGE_DAYS = 90;
