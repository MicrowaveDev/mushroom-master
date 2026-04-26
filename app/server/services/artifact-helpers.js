// Family capability registry + helpers (§11.8 plan, §5 Step 5).
//
// Every branch that used to read `artifact.family === 'bag'` now goes
// through these helpers. Adding a new family (consumable, enchantment, etc.)
// means adding one row to FAMILY_CAPS — nothing else.
//
// Keep this file dependency-free from game-data to avoid cycles; callers
// pass artifact objects in directly.

export const FAMILY_CAPS = {
  damage:  { statsInBattle: true,  container: true,  holdsItems: false },
  armor:   { statsInBattle: true,  container: true,  holdsItems: false },
  stun:    { statsInBattle: true,  container: true,  holdsItems: false },
  bag:     { statsInBattle: false, container: true,  holdsItems: true  }
};

export function familyCaps(family) {
  return FAMILY_CAPS[family] || FAMILY_CAPS.damage;
}

export function isBag(artifact) {
  return !!artifact && artifact.family === 'bag';
}

export function isCombatArtifact(artifact) {
  if (!artifact) return false;
  return familyCaps(artifact.family).statsInBattle;
}

/**
 * True if an item row is "in the container" (bought but not placed on grid
 * and not inside a bag). Container items don't contribute stats and skip
 * bounds/overlap checks.
 */
export function isContainerItem(item) {
  if (!item) return false;
  return Number(item.x) < 0 || Number(item.y) < 0;
}

/**
 * True if an item row should contribute stats to combat.
 * - Bags never contribute (no bonus).
 * - Container items never contribute (not placed).
 * - Grid-placed combat artifacts contribute.
 * - Bagged items contribute.
 */
export function contributesStats(artifact, item) {
  if (!isCombatArtifact(artifact)) return false;
  return Number(item.x) >= 0 && Number(item.y) >= 0;
}
