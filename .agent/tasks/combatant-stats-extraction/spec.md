# Shared combatant stat derivation

## Source of truth

User request: «давай перенесем» after identifying combat stat arithmetic duplicated in Meat and the legacy Mushroom core port.

## Acceptance criteria

- AC1: Public browser-safe core battle API owns signed base-plus-equipment arithmetic and final stat limits.
- AC2: Meat delegates stat arithmetic while preserving attack >= 0, defense >= 0, speed >= 1, stun >= 0, and positive armor-derived health.
- AC3: Mushroom uses the same helper while preserving base health, artifact-only stun and its historical unclamped sums.
- AC4: Both consumers pin the same published core commit; package and two-consumer checks pass.

## Constraints and non-goals

Catalogs, character identity, abilities, income, and balance policy stay product-owned. Existing stored replay snapshots are untouched. Placement and stale-code cleanup are excluded. Core is published before consumer changes. Mushroom uses its direct-to-main workflow; Meat updates PR #20; core PR remains for user merge.

## Verification

Core tests and npm pack dry-run, then hub `npm run verify:backpack-core`. Review the implementation against AC1–AC4 after validation.
