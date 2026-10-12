# Extraction evidence

Core commit: `fc619bdb3feb1b1a64fb731f250d3135c2d3e73c` ([core PR #24](https://github.com/MicrowaveDev/backpack-game-core/pull/24)). Both consumer pointers resolve to this published commit.

- AC1 PASS: `src/modules/battle/combatant-stats.js` and matching types export through the battle facade and package root. Core tests cover signed bonuses, final clamps, explicit health policy, immutability, and public exports. 521 tests passed; package dry-run includes JS and types.
- AC2 PASS: Meat `src/game.js` delegates to the facade with its existing stat floors and positive armor health policy. 129 tests passed, including signed attack penalties and battle snapshots. A separate parity check matched all six initial stat values for 400 combatants across 100 seeded loadouts.
- AC3 PASS: The legacy Mushroom battle port delegates stat arithmetic with unchanged health and artifact-only stun. Its regression test verifies initial battle snapshots. 666 Mushroom game tests, 3 screenshot checks, and 3 focused support UI E2E tests passed.
- AC4 PASS: `npm run verify:backpack-core` completed successfully with identical core pins; both builds, Meat's 16 browser tests, hosted/local deploy checks, and package verification passed. Raw command/result lines are retained in `raw/consumer-gate-summary.txt`.

Fresh review checked current implementation and consumer configuration after the gate without changing production code. Saved replay snapshots are read as stored and require no migration. Verification establishes configured arithmetic parity, not identical balance between games. Screenshot checks were automated; this task changed no screen layout. Existing bundle-size advisories remain.
