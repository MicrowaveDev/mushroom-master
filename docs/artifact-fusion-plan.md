# Artifact Fusion Plan

> Status: shipped on 2026-05-09 for the first automatic fusion recipe; hardening follow-up active on 2026-05-10. This is now a historical ship record plus the follow-up checklist. The runtime contract is in `app/shared/artifact-fusions.js`, `app/server/services/artifact-fusion-service.js`, `docs/game-requirements.md`, and the prep UI components.

## Goal

Add a Backpack Battles-style fusion layer without turning fusion into a manual shop purchase. When a player owns the ingredients for a recipe, those rows are highlighted during prep. The current round still fights with the unfused ingredients. After the round resolves, the copied next-round loadout fuses automatically before the next shop/prep screen appears.

## V1 Contract

- Recipes are deterministic shared data in `app/shared/artifact-fusions.js`.
- Fusion ingredients are matched by `game_run_loadout_items.id`, not only by artifact id, so duplicates are safe.
- Recipe matching must not reuse the same row twice inside one recipe, including future recipes like `A + A`.
- Fusion runs only between active rounds:
  1. resolve round N using the current loadout;
  2. copy round N rows to round N+1;
  3. consume matching ingredient rows in round N+1;
  4. insert the result row into the round N+1 container at `(-1, -1)`;
  5. create/show the round N+1 shop.
- V1 ingredients cannot be bags, starter-only artifacts, or existing fusion-only results.
- Fusion-only results do not appear in normal shop rolls or ghost shop-purchase pools.
- The prep UI highlights current rows that match a recipe while `currentRound < MAX_ROUNDS_PER_RUN`.
- On replay continue into the next shop, the client plays a fusion reveal: ingredient artifact images move toward the center, shrink into the infusion point, then reveal the result. The reveal blocks prep input until it completes.
- Applied fusions are persisted as reveal events so challenge reconnect can still show the post-replay fusion animation.

## First Recipe

| Recipe | Ingredients | Result |
| --- | --- | --- |
| `portal_cut_sickle` | `sporeblade` + `mirrorloop_knot` | `portal_cut_sickle` |

`portal_cut_sickle` is now `fusionOnly: true`. It keeps the existing live stats and bitmap, but no longer belongs to the normal combat shop pool.

## Implementation Steps

1. Add shared recipe matching helpers.
2. Add server-side round-start fusion service.
3. Apply fusion after copy-forward in solo and challenge round resolution.
4. Mark `portal_cut_sickle` as `fusionOnly` and exclude it from normal shop pools.
5. Highlight pending fusion ingredients in backpack/container and placed-grid surfaces.
6. Play the fusion reveal overlay on next prep entry after replay continue.
7. Add unit and integration tests for recipe matching, shop exclusion, and round-transition fusion.

## Verification

Run:

```bash
node --test tests/game/artifact-fusions.test.js tests/game/round-resolution.test.js
node --test tests/web/artifact-render.test.js tests/web/loadout-projection.test.js
npm run game:test:screens
```

## Follow-Up Checklist - 2026-05-10

1. Persist applied fusion reveal events for reconnect and challenge recovery.
2. Thread persisted reveal events through active-run/bootstrap and reconnect state.
3. Block prep interactions while the fusion reveal is visible.
4. Generalize ingredient animation positions for recipes with more than two ingredients.
5. Add tests for same-row reuse, persisted challenge fusions, and UI input blocking.
