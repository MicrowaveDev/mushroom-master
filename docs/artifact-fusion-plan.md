# Artifact Fusion Plan

> Status: shipped on 2026-05-09 for the first automatic fusion recipe; hardening and recipe-catalog follow-ups shipped on 2026-05-10. This is now a historical ship record plus the follow-up checklist. The runtime contract is in `app/shared/artifact-fusions.js`, `app/server/services/artifact-fusion-service.js`, `docs/game-requirements.md`, and the prep/recipe UI components.

## Goal

Add a Backpack Battles-style fusion layer without turning fusion into a manual shop purchase. When a player places recipe ingredients next to each other in the grid, those rows are highlighted during prep. The current round still fights with the unfused ingredients. After the round resolves, the copied next-round loadout fuses automatically before the next shop/prep screen appears.

## V1 Contract

- Recipes are deterministic shared data in `app/shared/artifact-fusions.js`.
- Fusion ingredients are matched by `game_run_loadout_items.id`, not only by artifact id, so duplicates are safe.
- Fusion ingredients must be placed in the grid and touch by an edge; backpack/container rows and non-adjacent grid rows are not eligible.
- Recipe matching must not reuse the same row twice inside one recipe, including future recipes like `A + A`.
- Fusion runs only between active rounds:
  1. resolve round N using the current loadout;
  2. copy round N rows to round N+1;
  3. consume matching ingredient rows in round N+1;
  4. insert the result row into the round N+1 container at `(-1, -1)`;
  5. create/show the round N+1 shop.
- V1 ingredients cannot be bags, starter-only artifacts, or existing fusion-only results.
- Fusion-only results do not appear in normal shop rolls or ghost shop-purchase pools.
- The prep UI highlights current adjacent grid rows that match a recipe while `currentRound < MAX_ROUNDS_PER_RUN`, and may also hint at shop recipe ingredients before the player places them.
- On replay continue into the next shop, the client plays a fusion reveal: ingredient artifact images pull toward each other like magnets, shrink into the infusion point, then reveal the result. The reveal blocks prep input until it completes.
- Applied fusions are persisted as reveal events so challenge reconnect can still show the post-replay fusion animation.
- The sidebar Recipes screen renders the same deterministic recipe list with ingredient visuals, result visuals, localized result text, and result stats.

## Live Recipes

| Recipe | Ingredients | Result |
| --- | --- | --- |
| `portal_cut_sickle` | `sporeblade` + `mirrorloop_knot` | `portal_cut_sickle` |
| `riftfang_comet` | `amber_fang` + `haste_wisp` | `riftfang_comet` |
| `biostasis_crown_seed` | `reliquary_biostasis_seal` + `triple_knot_seed` | `biostasis_crown_seed` |
| `abyss_bow_knot` | `heartwood_splinter_bow` + `mirrorloop_knot` | `abyss_bow_knot` |
| `opening_bell_spore` | `afterimage_cap` + `first_bloom_cinder` | `opening_bell_spore` |
| `reliquary_ash_crown` | `root_ash_censer` + `reliquary_bone_buckle` | `reliquary_ash_crown` |
| `portal_vinegar_lens` | `sour_vinegar_ampoule` + `mirrorfloor_shard` | `portal_vinegar_lens` |
| `deadwind_arrow` | `spore_burst_arrow` + `dead_city_nail` | `deadwind_arrow` |
| `pressure_bloom_bulwark` | `bubbling_grot_bomb` + `amber_resin_shield` | `pressure_bloom_bulwark` |
| `snap_lullaby_bell` | `spore_lullaby_conch` + `snaplight_husk` | `snap_lullaby_bell` |
| `riftpuff_snare` | `crystal_rift_chime` + `rainpuff_mine` | `riftpuff_snare` |

These result artifacts are `fusionOnly: true`. They keep existing live stats and bitmaps, but no longer belong to the normal combat shop pool.

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
6. Add more live fusion recipes and expose them in the sidebar recipe section.
