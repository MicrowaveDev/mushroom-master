# Backpack Game Core Extraction Inventory

**Status:** Phase 8B inventory, after the Phase 6A-6C neutral naming pass.

This document chooses the first extraction slice and records why other modules
wait. It should be updated after each cluster moves.

## Current Core Repo State

`git ls-remote --heads --tags git@github.com:MicrowaveDev/backpack-game-core.git`
returned no refs on 2026-07-01. Treat the target repo as empty/new until a
commit exists.

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
| Bag shape masks and rotation | `app/shared/bag-shape.js` | Pure candidate | Dependency-free ESM helpers over passed bag objects and shape arrays. Shared by server/client already. |
| Bag-shape unit tests | `tests/game/bag-shape.test.js` | Partial pure candidate | The top helper tests are portable. The coverage tests that call `validateItemCoverage` and `getArtifactById` depend on Mushroom validation/catalog code. |
| Artifact family capability helpers | `app/server/services/artifact-helpers.js` | Pure candidate, later | Dependency-free today, but its family list is still Mushroom artifact taxonomy. Move only after deciding the generic family/capability API. |
| Grid placement primitives | `pieceCells`, cell-set/intersection helpers in `app/server/services/loadout-utils.js` | Adapter-needed | The primitive geometry is pure, but the file imports `game-data.js`, `artifact-helpers.js`, and bag-shape helpers. Extract after splitting geometry from catalog-backed validation. |
| Full loadout validation | `app/server/services/loadout-utils.js` | Adapter-needed | Uses Mushroom artifact lookup, prices, dimensions, family semantics, grid constants, and stat caps. Needs injected catalog/config before it belongs in core. |
| Seeded RNG and shuffle | `createRng` in `app/server/lib/utils.js`, `shuffleWithRng` in `app/server/services/battle-engine.js` | Adapter-needed | Algorithms are generic. `createRng` lives beside server/id/time helpers; `shuffleWithRng` lives in battle-engine. Extract only after creating a small RNG module and updating imports. |
| Fusion matching algorithm | `findArtifactFusionMatches` and `fusionIngredientRowIdSet` in `app/shared/artifact-fusions.js` | Adapter-needed | Matching accepts `getArtifact` and is mostly pure, but the same module also exports Mushroom recipe data and artifact ids. Split algorithm from product recipe catalog first. |
| Fusion application | `app/server/services/artifact-fusion-service.js` | Product-specific | Reads/writes DB rows, inserts loadout items, records reveals, uses Mushroom artifact catalog and persistence services. |
| Shop offer generation | `generateShopOffer` in `app/server/services/shop-service.js` | Adapter-needed | The function is deterministic over pools/RNG, but current implementation imports Mushroom pools, bag chance constants, and character-item eligibility. Needs injected item pools/config/hooks. |
| Run-shop mutations | `buyRunShopItem`, `refreshRunShop`, `sellRunItem` in `app/server/services/shop-service.js` | Product-specific | DB transactions, run locks, persisted shop states, run currency, refunds, and loadout rows stay in product service code. |
| Bot loadout generation | `app/server/services/bot-loadout.js` | Adapter-needed, later | Contains reusable placement ideas, but imports Mushroom artifacts, affinities, presets, portraits, prices, grid constants, RNG, and validator. |
| Battle simulation | `app/server/services/battle-engine.js` | Product-specific until adapterized | Hard-coded Mushroom ids and active/passive abilities are inside combat logic. Extract only after ability hooks/config are designed. |
| Wallet / payment / assets / gacha | `app/server/services/wallet-service.js`, `app/server/services/asset-service.js`, models, routes | Product-specific | Payment providers, ledgers, profile assets, webhooks, compliance, and Mushroom skin catalog are not reusable backpack mechanics. |

## Chosen First Slice

**First extraction slice:** bag shape masks and rotation.

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

1. Create the core package with `bag-shape.js` and pure tests.
2. Run the core package tests.
3. Add the core package to `mushroom-master` as a pinned git dependency or local
   workspace dependency, depending on the hub/submodule decision at that moment.
4. Replace imports of `app/shared/bag-shape.js` in `mushroom-master` with the
   package import.
5. Keep a small compatibility re-export at `app/shared/bag-shape.js` for one
   transition commit if frontend/server import churn would otherwise be broad.
6. Run focused Mushroom tests:
   - `node --test tests/game/bag-shape.test.js`
   - `node --test tests/game/bag-items.test.js`
   - `node --test tests/game/loadout-refactor.test.js`
7. If client imports change, also run the cheapest relevant frontend build or
   screenshot wrapper required by the changed surface.

## Rollback Strategy

- Revert the package dependency/import swap in `mushroom-master`.
- Keep the core repo commit; do not delete it unless it contains secrets or bad
  generated artifacts.
- Restore `app/shared/bag-shape.js` as the local source if compatibility
  re-exporting was removed too early.

## Next Slices After Bag Shape

After the bag-shape slice is green, reassess in this order:

1. Split pure grid geometry helpers out of `loadout-utils.js`.
2. Split fusion matching algorithm from Mushroom recipe catalog data.
3. Parameterize shop offer generation over passed item pools/config.
4. Adapterize bot loadout generation over catalog, affinity, preset, and price
   providers.
5. Design battle ability hooks before moving any battle simulation code.

Do not extract wallet, assets, gacha, payment providers, DB models, Telegram
routes, lore/portrait catalogs, or home-field code into `backpack-game-core`.
