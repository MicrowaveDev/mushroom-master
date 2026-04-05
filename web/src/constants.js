export const INVENTORY_COLUMNS = 3;
export const INVENTORY_ROWS = 2;
export const MAX_ARTIFACT_COINS = 5;
export const SHOP_OFFER_SIZE = 5;
export const MAX_INVENTORY_PIECES = 6;

export function readReplayDelay(envValue, fallback) {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
