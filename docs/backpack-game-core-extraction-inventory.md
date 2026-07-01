# Backpack Game Core Extraction Inventory

**Status:** Phase 8C first-slices extraction, after the Phase 6A-6C neutral
naming pass.

This document chooses the first extraction slice and records why other modules
wait. It should be updated after each cluster moves.

## Current Core Repo State

`backpack-game-core` now has `main` commits with an ESM package:

- package: `@microwavedev/backpack-game-core`
- first slice: `src/bag-shape.js`, tested by `tests/bag-shape.test.js`
- second slice: `src/grid-geometry.js`, tested by
  `tests/grid-geometry.test.js`
- third slice: `src/fusion-matching.js`, tested by
  `tests/fusion-matching.test.js`
- fourth slice: `src/shop-offer.js`, tested by `tests/shop-offer.test.js`
- initial commit: `69666c8` (`Add bag shape core helpers`)
- latest extraction commit: `6be48a9` (`Add shop offer core helper`)

The package is consumed by `mushroom-master` as a pinned Git dependency.

## Classification Rules

- **Pure candidate:** no database, Express, Telegram, filesystem, product lore,
  portraits, wallet, asset, payment, or Mushroom catalog dependency.
- **Adapter-needed:** useful mechanics exist, but product catalogs, product
  eligibility, abilities, or persistence must be passed in by
  `mushroom-master`.
- **Product-specific:** keep in `mushroom-master`.

## Candidate Matrix

| Cluster | Current files | Classification | Why |
| --- | --- | --- | --- |
| Bag shape masks and rotation | `backpack-game-core/src/bag-shape.js`; compatibility bridge at `app/shared/bag-shape.js` | Extracted pure slice | Dependency-free ESM helpers over passed bag objects and shape arrays. Shared by server/client through the bridge. |
| Bag-shape unit tests | `tests/game/bag-shape.test.js` | Partial pure candidate | The top helper tests are portable. The coverage tests that call `validateItemCoverage` and `getArtifactById` depend on Mushroom validation/catalog code. |
| Artifact family capability helpers | `app/server/services/artifact-helpers.js` | Pure candidate, later | Dependency-free today, but its family list is still Mushroom artifact taxonomy. Move only after deciding the generic family/capability API. |
| Grid placement primitives | `backpack-game-core/src/grid-geometry.js`; validation remains in `app/server/services/loadout-utils.js` | Partially extracted | `pieceCells`, `cellSet`, `setsIntersect`, and `cellKey` are pure. Catalog-backed grid/bag/loadout validation still imports `game-data.js`, `artifact-helpers.js`, and bag policy, so it stays in Mushroom code. |
| Full loadout validation | `app/server/services/loadout-utils.js` | Adapter-needed | Uses Mushroom artifact lookup, prices, dimensions, family semantics, grid constants, and stat caps. Needs injected catalog/config before it belongs in core. |
| Seeded RNG and shuffle | `createRng` in `app/server/lib/utils.js`, `shuffleWithRng` in `app/server/services/battle-engine.js` | Adapter-needed | Algorithms are generic. `createRng` lives beside server/id/time helpers; `shuffleWithRng` lives in battle-engine. Extract only after creating a small RNG module and updating imports. |
| Fusion matching algorithm | `backpack-game-core/src/fusion-matching.js`; Mushroom wrapper and recipes in `app/shared/artifact-fusions.js` | Extracted with product hook | Core owns adjacency search, duplicate row consumption, match shaping, and `fusionIngredientRowIdSet`. Mushroom keeps recipe data and eligibility policy through `canUseIngredient`. |
| Fusion application | `app/server/services/artifact-fusion-service.js` | Product-specific | Reads/writes DB rows, inserts loadout items, records reveals, uses Mushroom artifact catalog and persistence services. |
| Shop offer generation | `backpack-game-core/src/shop-offer.js`; Mushroom adapter in `app/server/services/shop-service.js` | Extracted with product config | Core owns deterministic pool sampling, bag pity, bag chance escalation, and character-item slot reservation. Mushroom passes combat pools, bag pools, eligible character items, and balance constants. |
| Run-shop mutations | `buyRunShopItem`, `refreshRunShop`, `sellRunItem` in `app/server/services/shop-service.js` | Product-specific | DB transactions, run locks, persisted shop states, run currency, refunds, and loadout rows stay in product service code. |
| Bot loadout generation | `app/server/services/bot-loadout.js` | Next planned adapter slice | Contains reusable placement and weighted-pick ideas, but imports Mushroom artifacts, affinities, presets, portraits, prices, grid constants, RNG, and validator. Extract only through provider hooks and keep ghost snapshot/portrait glue local. |
| Battle simulation | `app/server/services/battle-engine.js` | Product-specific until adapterized | Hard-coded Mushroom ids and active/passive abilities are inside combat logic. Extract only after ability hooks/config are designed. |
| Wallet / payment / assets / gacha | `app/server/services/wallet-service.js`, `app/server/services/asset-service.js`, models, routes | Product-specific | Payment providers, ledgers, profile assets, webhooks, compliance, and Mushroom skin catalog are not reusable backpack mechanics. |

## Chosen First Slice

**First extraction slice:** bag shape masks and rotation. This slice has been
moved to `backpack-game-core`.

Start with:

- `app/shared/bag-shape.js`
- the pure helper assertions from `tests/game/bag-shape.test.js`:
  - `defaultRectangleShape`
  - `getBagShape`
  - `rotateShape`
  - `getEffectiveShape`
  - `getEffectiveDimensions`
  - `normalizeRotation`
  - `isCellInShape`
  - `shapeArea`

Do not move in the first slice:

- `validateItemCoverage` tests from `tests/game/bag-shape.test.js`
- `app/server/services/loadout-utils.js`
- Mushroom bag catalog data from `app/server/game-data.js`
- UI rendering code

## Why This Slice

- It is already shared between client and server.
- It has no imports.
- Its API accepts plain objects/arrays rather than DB rows.
- It has focused unit tests.
- Moving it does not touch wallet, assets, gacha, payments, Telegram, DB
  models, Express routes, portraits, or battle abilities.
- If integration fails, rollback is only an import-path revert in
  `mushroom-master`.

## Proposed Core Package Shape For First Slice

```text
backpack-game-core/
  package.json
  src/
    bag-shape.js
    index.js
  tests/
    bag-shape.test.js
  README.md
```

Initial exports:

```js
export {
  defaultRectangleShape,
  getBagShape,
  rotateShape,
  normalizeRotation,
  getEffectiveShape,
  getEffectiveDimensions,
  isCellInShape,
  shapeArea
} from './bag-shape.js';
```

Use ESM JavaScript first. Add TypeScript declarations after the API stabilizes.

## Integration Plan For First Slice

1. Done: created the core package with `bag-shape.js` and pure tests.
2. Done: ran the core package tests.
3. Done: added the core package to `mushroom-master` as a pinned git dependency.
4. Done: kept `app/shared/bag-shape.js` as a package re-export compatibility
   bridge, so existing Mushroom imports did not need broad churn.
5. Done: run focused Mushroom tests:
   - `node --test tests/game/bag-shape.test.js`
   - `node --test tests/game/bag-items.test.js`
   - `node --test tests/game/loadout-refactor.test.js`
6. If direct client imports change in a future cleanup, also run the cheapest
   relevant frontend build or screenshot wrapper required by the changed
   surface.

## Rollback Strategy

- Revert the package dependency/import swap in `mushroom-master`.
- Keep the core repo commit; do not delete it unless it contains secrets or bad
  generated artifacts.
- Restore `app/shared/bag-shape.js` as the local source if compatibility
  re-exporting was removed too early.

## Next Slices After Bag Shape

## Second Slice: Grid Geometry

The second shipped slice moved the lowest-level grid helpers:

- `pieceCells`
- `cellSet`
- `setsIntersect`
- `cellKey`

`app/server/services/loadout-utils.js` now imports these helpers from
`@microwavedev/backpack-game-core` and re-exports `pieceCells` for existing
Mushroom callers such as `game-run-loadout.js`.

Do not treat this as a full loadout-validation extraction. These remain local:

- `effectiveGridHeight`
- `validateGridItems`
- `validateBagPlacement`
- `bagCellSets`
- `bagsContainingItem`
- `validateItemCoverage`
- `validateCoinBudget`
- `validateLoadoutItems`

They still depend on Mushroom artifact lookup, bag semantics, grid constants,
pricing, and product policy.

## Third Slice: Fusion Matching

The third shipped slice moved pure fusion matching:

- `findFusionMatches`
- `fusionIngredientRowIdSet`

`app/shared/artifact-fusions.js` keeps:

- `artifactFusionRecipes`
- `getArtifactFusionRecipe`
- Mushroom eligibility policy:
  - reject bag artifacts
  - reject starter-only artifacts
  - reject existing fusion-only artifacts unless the recipe explicitly allows
    them

The wrapper passes that policy into core through `canUseIngredient`, so the
core package does not import Mushroom recipe data, artifact ids, or catalog
helpers.

## Fourth Slice: Shop Offer Generation

The fourth shipped slice moved pure shop-offer generation:

- `generateShopOffer`

`app/server/services/shop-service.js` keeps:

- run-shop buy, refresh, sell, refund, and DB mutations
- Mushroom combat artifact pool
- Mushroom bag artifact pool
- eligible character item lookup
- `BAG_BASE_CHANCE`, `BAG_ESCALATION_STEP`, `BAG_PITY_THRESHOLD`, and
  `SHOP_OFFER_SIZE`

The wrapper passes those pools/config values into core, so the core package does
not import Mushroom catalog data, run DB rows, or run currency services.

## Planned Fifth Slice: Bot Loadout Generation

**Status:** Planned only. No bot-loadout code has moved yet.

### Source Of Truth

- Current implementation: `app/server/services/bot-loadout.js`
- Current behavior tests: `tests/game/bot-loadout.test.js`
- Supporting local adapters: `app/server/game-data.js`,
  `app/server/services/loadout-utils.js`, `app/shared/bag-shape.js`,
  `app/server/lib/utils.js`, and `app/server/services/battle-engine.js`

### Success Conditions

- `backpack-game-core` owns only reusable loadout-generation mechanics:
  weighted selection, first-fit bag placement, rectangular item placement, and
  retry orchestration over injected data.
- `mushroom-master` owns Mushroom data and presentation:
  artifact catalog, family/affinity weights, starter presets, prices, portraits,
  mushroom choice, ghost snapshot shape, and final validation policy.
- Existing bot-loadout behavior stays deterministic for a given seed and
  Mushroom catalog.
- The core package gets fake-catalog unit tests before Mushroom imports change.
- Mushroom keeps and passes:
  - `gridWidth` / `gridHeight`
  - item pool
  - starter bag and starter preset rows
  - `getItemPrice`
  - `isBag`
  - `getBagShape` / rotation handling
  - `weightForItem`
  - optional `validateLoadout`
  - RNG and optional shuffle helper

### Non-Goals

- Do not move `createBotGhostSnapshot`; it chooses a Mushroom, portrait, and
  response shape.
- Do not move `getMushroomById`, `mushrooms`, `portraitUrl`,
  `getStarterPreset`, `getStarterPresetCost`, or `getArtifactPrice`.
- Do not move `validateLoadoutItems`; it still depends on Mushroom catalog,
  prices, bag semantics, and validation errors.
- Do not move battle simulation or ability logic as part of the bot-loadout
  slice.

### Proposed Adapter Shape

The core API should be close to:

```js
generateBackpackLoadout({
  rng,
  budget,
  attempts,
  grid: { columns, rows },
  items,
  starterBag,
  starterPreset,
  presetCost,
  getItemId,
  getItemPrice,
  isBag,
  getBagShape,
  weightForItem,
  validateLoadout
})
```

`mushroom-master` should expose a small wrapper:

```js
createBotLoadout(mushroom, rng, budget)
```

That wrapper builds the arguments above from Mushroom catalogs and returns the
current `{ gridWidth, gridHeight, items }` shape.

### Implementation Order

1. Add core tests with a tiny fake catalog that covers:
   - starter bag and starter preset are included first,
   - at least one non-bag item is bought when affordable,
   - first-fit compact bag anchors are stable,
   - bought items can land inside bought bag cells,
   - budget includes preset cost only through injected validation,
   - failed validation retries up to the configured attempt limit.
2. Move or duplicate pure helper logic into core:
   - weighted item pick
   - candidate rectangle cells
   - first-fit bag placement candidates
   - occupied item/bag marking
   - optional deterministic shuffle helper
3. Add `generateBackpackLoadout` to core and keep it free of Mushroom artifact
   ids, portrait urls, DB calls, Express routes, and game-run rows.
4. Update `mushroom-master` `createBotLoadout` to pass Mushroom providers into
   core.
5. Keep `createBotGhostSnapshot` local and unchanged except for calling the
   wrapper.
6. Verify:
   - `backpack-game-core`: `npm test`
   - `mushroom-master` focused:
     `node --test tests/game/bot-loadout.test.js tests/game/round-resolution.test.js tests/game/loadout-refactor.test.js`
   - `npm run game:build`

### Rollback

- Revert the Mushroom dependency pin and wrapper import.
- Restore the local `createBotLoadout` body from the previous commit.
- Keep the core commit unless it contains bad generated artifacts or secrets.

## Next Slices After Bag Shape, Grid Geometry, Fusion, And Shop Offer

After the shipped bag-shape, grid-geometry, fusion-matching, and shop-offer
slices, reassess in this order:

1. Implement the planned bot-loadout adapter slice above.
2. Design battle ability hooks before moving any battle simulation code.

Do not extract wallet, assets, gacha, payment providers, DB models, Telegram
routes, lore/portrait catalogs, or home-field code into `backpack-game-core`.
