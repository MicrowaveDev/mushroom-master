# Backpack Game Core Extraction Inventory

**Status:** Ongoing reusable-core extraction after the Phase 6A-6C neutral
naming pass and the first package type-declaration pass.

This document chooses extraction slices and records why other modules wait. It
should be updated after each cluster moves. The 2026-07-04 multi-game revision
adds `git@github.com:nuclear-pancakes/meat-master.git` as the second core
consumer, so wallet/assets/gacha should no longer be treated as entirely
Mushroom-local: product persistence and payment adapters stay local, but
reusable domain rules should move into core behind explicit adapters. The same
applies to the Vue frontend: reusable services, composables, components, and
page view models should move into core behind product-provided data, routing,
copy, theme, and API adapters.

## Current Core Repo State

`backpack-game-core` now has `main` commits with an ESM package:

- package: `@microwavedev/backpack-game-core`
- first slice: `src/bag-shape.js`, tested by `tests/bag-shape.test.js`
- second slice: `src/grid-geometry.js`, tested by
  `tests/grid-geometry.test.js`
- third slice: `src/fusion-matching.js`, tested by
  `tests/fusion-matching.test.js`
- fourth slice: `src/shop-offer.js`, tested by `tests/shop-offer.test.js`
- fifth slice: `src/backpack-loadout.js`, tested by
  `tests/backpack-loadout.test.js`
- sixth slice: `src/battle-simulation.js`, tested by
  `tests/battle-simulation.test.js`
- seventh slice: `src/loadout-validation.js`, tested by
  `tests/loadout-validation.test.js`
- eighth slice: `src/rng.js`, tested by `tests/rng.test.js`
- ninth slice: `src/asset-gacha.js`, tested by
  `tests/asset-gacha.test.js`
- package declaration pass: `src/*.d.ts`, guarded by
  `tests/package-types.test.js`
- initial commit: `69666c8` (`Add bag shape core helpers`)
- latest typed package baseline: `d5fb481` (`Add package type declarations`)
- latest consumed core commit: `f47ff96`
  (`Add reusable asset gacha core`)
- consumer update log:
  `docs/backpack-game-core-update-log.md`

The package is consumed by `mushroom-master` through the nested submodule
`vendor/backpack-game-core` and the local package dependency
`file:vendor/backpack-game-core`, so the game imports checked-out core source
through the stable package name `@microwavedev/backpack-game-core`. The exact
core SHA to game-commit mapping is tracked in
`docs/backpack-game-core-update-log.md`.

## Classification Rules

- **Pure candidate:** no database, Express, Telegram, filesystem, product lore,
  portraits, wallet, asset, payment, or Mushroom catalog dependency.
- **Adapter-needed:** useful mechanics exist, but product catalogs, product
  eligibility, abilities, or persistence must be passed in by
  `mushroom-master`.
- **Domain-core candidate:** wallet, asset, or gacha rules are reusable across
  games if core receives persistence snapshots, catalog data, time, RNG, and
  policy through arguments/adapters. DB schemas, routes, payment processors,
  auth, support-action persistence, and product UI shells stay in the game repo.
- **Frontend-core candidate:** Vue/browser modules are reusable across games if
  they receive product catalogs, API clients, copy, theme tokens, routes, and
  assets through props, slots, composables, or adapter objects. Product stores,
  route shells, Telegram auth, localization files, image generation, and final
  page assembly stay local.
- **Product-specific:** keep in `mushroom-master`.

## Candidate Matrix

| Cluster | Current files | Classification | Why |
| --- | --- | --- | --- |
| Bag shape masks and rotation | `backpack-game-core/src/bag-shape.js`; compatibility bridge at `app/shared/bag-shape.js` | Extracted pure slice | Dependency-free ESM helpers over passed bag objects and shape arrays. Shared by server/client through the bridge. |
| Bag-shape unit tests | `tests/game/bag-shape.test.js` | Partial pure candidate | The top helper tests are portable. The coverage tests that call `validateItemCoverage` and `getArtifactById` depend on Mushroom validation/catalog code. |
| Artifact family capability helpers | `app/server/services/artifact-helpers.js` | Pure candidate, later | Dependency-free today, but its family list is still Mushroom artifact taxonomy. Move only after deciding the generic family/capability API. |
| Grid placement primitives | `backpack-game-core/src/grid-geometry.js`; validation uses `backpack-game-core/src/loadout-validation.js` through the Mushroom adapter | Extracted pure slice | `pieceCells`, `cellSet`, `setsIntersect`, and `cellKey` are pure and shared by server/client through package imports. Catalog-backed grid/bag/loadout policy is injected into the core validator from Mushroom code. |
| Full loadout validation | `backpack-game-core/src/loadout-validation.js`; Mushroom adapter in `app/server/services/loadout-utils.js` | Extracted with product config | Core owns flat-grid bounds/overlap validation, active-bag placement, bag coverage, budget summing, stat totals, and orchestrated loadout validation. Mushroom injects artifact lookup, pricing, family semantics, grid constants, and stat caps. |
| Seeded RNG and shuffle | `backpack-game-core/src/rng.js`; Mushroom string-seed adapter in `app/server/lib/utils.js`; compatibility re-export in `app/server/services/battle-engine.js` | Extracted with product seed hashing | Core owns the browser-safe numeric-seed RNG state machine, integer rolls, and non-mutating shuffle. Mushroom keeps Node `crypto` string hashing for existing deterministic seed inputs. |
| Fusion matching algorithm | `backpack-game-core/src/fusion-matching.js`; Mushroom wrapper and recipes in `app/shared/artifact-fusions.js` | Extracted with product hook | Core owns adjacency search, duplicate row consumption, match shaping, and `fusionIngredientRowIdSet`. Mushroom keeps recipe data and eligibility policy through `canUseIngredient`. |
| Fusion application | `app/server/services/artifact-fusion-service.js` | Product-specific | Reads/writes DB rows, inserts loadout items, records reveals, uses Mushroom artifact catalog and persistence services. |
| Shop offer generation | `backpack-game-core/src/shop-offer.js`; Mushroom adapter in `app/server/services/shop-service.js` | Extracted with product config | Core owns deterministic pool sampling, bag pity, bag chance escalation, and character-item slot reservation. Mushroom passes combat pools, bag pools, eligible character items, and balance constants. |
| Run-shop mutations | `buyRunShopItem`, `refreshRunShop`, `sellRunItem` in `app/server/services/shop-service.js` | Product-specific | DB transactions, run locks, persisted shop states, run currency, refunds, and loadout rows stay in product service code. |
| Bot loadout generation | `backpack-game-core/src/backpack-loadout.js`; Mushroom wrapper in `app/server/services/bot-loadout.js` | Extracted with product providers | Core owns weighted-pick, first-fit bag placement, rectangular item placement, occupied-cell tracking, and retry orchestration. Mushroom passes artifacts, affinities, presets, prices, grid constants, RNG, validation, and keeps ghost snapshot/portrait glue local. |
| Battle simulation | `backpack-game-core/src/battle-simulation.js`; Mushroom adapter in `app/server/services/battle-engine.js` | Extracted with product hooks | Core owns deterministic 1v1 turn loop, action/skip event sequencing, HP/stun flow, speed/base-speed tiebreak fallback, step-cap winner resolution, and result shaping. Mushroom passes combatant derivation, active/passive ability hooks, Morga/Kirt tiebreak hooks, artifact attribution/effect metadata, narration labels, constants, and seeded RNG. |
| Wallet accounting primitives | `app/server/services/wallet-service.js`, wallet tests | Domain-core candidate | Balance delta shaping, insufficient-balance checks, idempotent mutation result semantics, refund/reversal classification, and ledger invariant helpers can be reusable when persistence and provider evidence are injected. SQL rows, locks, mirrors, support actions, and payment callbacks stay local. |
| Payment providers and purchase webhooks | `app/server/services/provider-settlement-*`, `bot-gateway.js`, payment routes | Product-specific | Telegram Stars, BTCPay, NOWPayments, provider signatures, invoice lookups, tax/accounting, adult-content policy, and settlement records are game/ops concerns, not backpack mechanics. |
| Asset catalog, ownership, equipment, and direct-buy policy | `app/server/services/asset-service.js`, profile asset tables, runtime catalogs | Domain-core candidate | Catalog normalization, purchase availability, acquisition modes, profile-owned instance/equipment transitions, direct-buy blocking under gacha, and runtime catalog filtering are reusable if product catalogs, current ownership, wallet spend hooks, and persistence are supplied by the game. |
| Gacha pack validation, rolling, duplicates, burn, pity, and simulation | `app/server/services/asset-service.js`, `gacha-simulation-service.js`, admin validation helpers | Domain-core candidate | Pack/item validation, candidate filtering, weighted slot selection, duplicate copy caps, burn target policies, pity/guarantees, odds simulation, and result evidence can be shared. Secure RNG source, wallet debit transaction, asset grant persistence, pack storage, and operator audit records stay local. |
| Shared frontend DTO/view-model shaping | `web/src/composables/useGameState.js`, `web/src/artifacts/grid.js`, asset/gacha response shapers | Frontend-core candidate | Browser-safe transforms for loadout totals, shop state, battle/replay state, wallet/asset catalog state, gacha pack state, validation summaries, and odds preview can be shared if they receive neutral payloads and catalog/config adapters. |
| Backpack grid, artifact tile, and shop UI | `web/src/components/*Prep*`, `web/src/artifacts/render.js`, `web/src/helpers/grid-cell-classification.js`, Meat `src/main.js` prototype | Frontend-core candidate | Grid classification, cell rendering, artifact figure/tile presentation, shop offer rows, price/budget badges, and placement affordances are common backpack UI primitives. Product themes, copy, item art paths, and route actions stay in each game. |
| Battle replay/log UI | Mushroom replay components/pages and Meat battle panel | Frontend-core candidate | Battle timeline rendering, event filtering, combatant stat panels, outcome badges, and playback state are reusable over core battle events. Product narration text, character art, share routes, and replay persistence stay local. |
| Wallet, asset inventory, and gacha UI | Mushroom asset/portrait/gacha screens, support asset widgets, Meat future inventory/gacha screens | Frontend-core candidate | Wallet balance display, asset inventory/equipment panels, gacha pack cards, roll result modals, duplicate/burn state panels, odds tables, and asset policy labels can be shared with product API/copy/theme adapters. Payment provider selection, adult-content gates, and purchase routes stay local. |
| Gacha admin UI and season-plan image storage | `app/server/services/gacha-admin-service.js`, `/support-admin`, `/gacha-plan` assets | Adapter-needed / product-specific split | Fixture shape validation, release checklist, promoted-plan asset invariants, pack validation, season-plan coverage summaries, validation panels, odds/diff tables, and neutral plan review components can become core helpers/UI. Image upload/storage, token-gated routes, support actions, operator permissions, and product copy stay local. |

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

Use ESM JavaScript first. TypeScript declarations were added after the initial
API surface stabilized; migrate runtime source to TypeScript only if a future
consumer or release process needs it.

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

## Fifth Slice: Bot Loadout Generation

**Status:** Implemented. Bot-loadout mechanics moved through an adapter; ghost
snapshot and portrait glue stayed local.

### Source Of Truth

- Current Mushroom adapter: `app/server/services/bot-loadout.js`
- Current core implementation: `backpack-game-core/src/backpack-loadout.js`
- Current behavior tests: `tests/game/bot-loadout.test.js`
- Supporting local adapters: `app/server/game-data.js`,
  `app/server/services/loadout-utils.js`, `app/shared/bag-shape.js`,
  `app/server/lib/utils.js`, and `app/server/services/battle-engine.js`

### Shipped Boundary

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

### Adapter Shape

The core API is:

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

`mushroom-master` exposes the existing wrapper:

```js
createBotLoadout(mushroom, rng, budget)
```

The wrapper builds the arguments above from Mushroom catalogs and returns the
current `{ gridWidth, gridHeight, items }` shape.

### Verification

- `backpack-game-core`: `npm test`
- `mushroom-master` focused:
  `node --test tests/game/bot-loadout.test.js tests/game/round-resolution.test.js tests/game/loadout-refactor.test.js`

`npm run game:build` should still be run before final handoff for the Mushroom
integration commit.

### Rollback

- Revert the Mushroom dependency pin and wrapper import.
- Restore the local `createBotLoadout` body from the previous commit.
- Keep the core commit unless it contains bad generated artifacts or secrets.

## Sixth Slice: Battle Simulation

**Status:** Implemented. The deterministic battle loop moved into
`backpack-game-core` behind product-provided ability and metadata hooks.

### Source Of Truth

- Current Mushroom adapter: `app/server/services/battle-engine.js`
- Current core implementation: `backpack-game-core/src/battle-simulation.js`
- Current core tests: `backpack-game-core/tests/battle-simulation.test.js`
- Current Mushroom behavior tests: `tests/game/battle-engine.test.js`
- Supporting local adapters: `app/server/game-data.js`,
  `app/server/services/loadout-utils.js`, `app/server/lib/utils.js`, and
  artifact metadata in the Mushroom catalog.

### Shipped Boundary

- `backpack-game-core` owns only reusable battle-loop mechanics:
  deterministic step iteration, speed ordering, base-speed and random
  tiebreak fallback, action/skip event sequencing, damage/armor/stun
  resolution, death and step-cap end conditions, and result/event shaping.
- `mushroom-master` owns Mushroom combat identity and product hooks:
  combatant derivation from snapshots/catalog data, active/passive abilities,
  Kirt and Morga special ordering, artifact attribution, lore `effectTags`,
  narration labels, `STEP_CAP`, `MAX_STUN_CHANCE`, and seeded RNG creation.
- Existing `simulateBattle(snapshot, seed)` remains the public Mushroom
  service API, so `run-service.js`, `game-service.js`, and current tests do not
  need broad import churn.

### Non-Goals

- Do not move Mushroom ids, names, base stats, portraits, artifact catalog
  data, battle effects, or ability definitions into `backpack-game-core`.
- Do not move persistence, battle snapshot storage, rewards, rating, or run
  resolution into core.
- Do not move `createRng` or `shuffleWithRng` in this slice; RNG extraction can
  happen later as a small helper module if another game needs the same seeded
  implementation.

### Verification

- `backpack-game-core`: `npm test`
- `mushroom-master` focused:
  `node --test tests/game/battle-engine.test.js tests/game/round-resolution.test.js tests/game/challenge-run.test.js`

`npm run game:build` should still be run before final handoff for the Mushroom
integration commit.

### Rollback

- Revert the Mushroom dependency pin and `battle-engine.js` adapter.
- Restore the prior local battle-loop implementation from the previous
  `mushroom-master` commit.
- Keep the core commit unless it contains bad generated artifacts or secrets.

## Loadout Validation Extraction Slice

**Status:** Implemented in `backpack-game-core` commit `d884410`.

### Current shape

- Current core implementation: `backpack-game-core/src/loadout-validation.js`
- Current core tests: `backpack-game-core/tests/loadout-validation.test.js`
- Current Mushroom adapter: `app/server/services/loadout-utils.js`

### Boundary

- `backpack-game-core` owns reusable flat-grid validation mechanics:
  bounds/overlap checks, active-bag placement, coverage by bag cells, effective
  grid-height expansion, budget summing, stat aggregation, and the
  all-in-one loadout validator.
- Mushroom owns product policy through injected providers: artifact lookup,
  prices, dimensions, family/bag checks, container sentinel rules, stat
  contribution rules, grid constants, and stat caps.
- Existing Mushroom imports stay stable: `loadout-utils.js` still exports
  `validateLoadoutItems`, `validateGridItems`, `validateBagPlacement`,
  `validateItemCoverage`, `validateCoinBudget`, `buildArtifactSummary`,
  `bagsContainingItem`, `bagCellSets`, `effectiveGridHeight`, and `pieceCells`.

### Verification

- `backpack-game-core`: `npm test`
- `mushroom-master` focused:
  `node --test tests/game/validator-split.test.js tests/game/bag-shape.test.js tests/game/bag-items.test.js tests/game/bot-loadout.test.js tests/game/loadout-refactor.test.js`
- `npm run game:build` should still be run before final handoff for the
  Mushroom consumer.

### Rollback

- Keep the core commit unless it contains bad generated artifacts or secrets.
- If the adapter creates a regression, restore `loadout-utils.js` from the
  previous Mushroom commit and move the nested submodule pointer back to the
  last known-good core commit while keeping the core tests for later repair.

## RNG And Shuffle Extraction Slice

**Status:** Implemented in `backpack-game-core` commit `13e6e0c`.

### Current shape

- Current core implementation: `backpack-game-core/src/rng.js`
- Current core tests: `backpack-game-core/tests/rng.test.js`
- Current Mushroom string-seed adapter: `app/server/lib/utils.js`
- Current Mushroom compatibility re-export:
  `app/server/services/battle-engine.js`

### Boundary

- `backpack-game-core` owns reusable RNG/shuffle mechanics:
  numeric-seed deterministic RNG state progression, integer rolls, and
  non-mutating seeded shuffle.
- Mushroom owns product seed derivation: `createRng(seedInput)` still hashes
  arbitrary string seed inputs with Node `crypto` before delegating to the core
  numeric-seed RNG. This preserves existing shop, bot, ghost, and battle seed
  behavior while keeping core browser-safe.
- Existing Mushroom imports stay stable: callers can still import
  `createRng` from `app/server/lib/utils.js` and `shuffleWithRng` /
  `randomInt` from `app/server/services/battle-engine.js`.

### Verification

- `backpack-game-core`: `npm test`
- `mushroom-master` focused:
  `node --test tests/game/core-submodule.test.js tests/game/battle-engine.test.js tests/game/bot-loadout.test.js tests/game/round-resolution.test.js tests/game/challenge-run.test.js tests/game/validator-split.test.js`
- `npm run game:build` should still be run before final handoff for the
  Mushroom consumer.

### Rollback

- Keep the core commit unless it contains bad generated artifacts or secrets.
- If deterministic behavior regresses, restore local `createRng`,
  `shuffleWithRng`, and `randomInt` implementations and move the nested
  submodule pointer back to the last known-good core commit.

## Next Slices After Bag Shape, Grid Geometry, Fusion, Shop Offer, Bot Loadout, Battle Simulation, Loadout Validation, And RNG

After the shipped bag-shape, grid-geometry, fusion-matching, shop-offer,
bot-loadout, battle-simulation, loadout-validation, RNG, and asset-gacha
slices, the second consumer target is concrete and bootstrapped:
`git@github.com:nuclear-pancakes/meat-master.git`. Use that integration to
drive the next reusable API cleanup instead of waiting for an abstract second
game. The package ships TypeScript declarations for the root export and every
subpath export.

Implementation finding on 2026-07-04: start Phase 8I with the combined
`asset-gacha` module before wallet-accounting. The asset/gacha seam is mostly
pure over catalogs, ownership snapshots, time, and RNG, while wallet accounting
touches ledger persistence and provider-settlement state.

Next planned domain slices:

1. **Asset-gacha core slice:** catalog/acquisition policy helpers,
   pack/item/status/date/price/currency validation, direct-buy blocking,
   candidate filtering, weighted slot selection, guarantee and pity helpers,
   duplicate copy-cap filtering, burn target selection, roll evidence shaping,
   and pack UI shaping over plain objects. **Implemented 2026-07-04 in
   `src/asset-gacha.js`; Mushroom adapter wiring delegates to it.**
2. **Gacha simulation:** deterministic odds simulation over the same roll core
   so admin preview, CLI tools, and tests share one model if it is not fully
   folded into `asset-gacha`.
3. **Gacha admin validation:** fixture shape checks, planned asset promotion
   invariants, and plan-item asset-id/linked-character rules as pure helpers.
4. **Wallet accounting:** reusable balance-delta and idempotency outcome helpers
   that operate on passed snapshots; no DB writes or provider callbacks. Do this
   after the shared gacha seam is stable in Mushroom.

Next planned frontend slices:

1. **Frontend services/composables:** move browser-safe state machines and API
   adapter factories first: bootstrap loader, shop/backpack state, battle
   replay view model, wallet/asset catalog state, gacha pack state, and admin
   validation/odds preview state. These should be plain JS or Vue composables
   with neutral fixtures before component extraction.
2. **Backpack UI primitives:** extract backpack grid, artifact tile/card,
   shop offer list, budget badge, placement preview, and core structural styles
   behind props/events/slots.
3. **Battle UI primitives:** extract battle log, replay timeline, combatant
   stat strips, outcome badges, and playback controls over core battle events.
4. **Asset/gacha UI primitives:** extract wallet balance badge, asset inventory
   panel, equipment picker, gacha pack card, roll result modal, odds table,
   duplicate/burn summary, and asset acquisition labels.
5. **Admin gacha UI primitives:** extract validation issue lists, release
   checklist, season-plan coverage grid, odds preview, pack diff, and plan item
   editor widgets only after their backend/view-model contracts are stable.
6. **Optional page shells:** extract page-level prep/shop, battle replay,
   asset inventory, gacha packs, and admin season-plan shells only when they can
   receive product route/auth/copy/theme/API adapters and stay useful to both
   games.

Do not extract payment providers, DB models, Telegram routes, lore/portrait
catalogs, uploaded image storage, product route shells, product localization,
adult-content gates, generated images, or home-field code into
`backpack-game-core`. Those stay product-local. Core should accept catalogs,
ownership snapshots, wallet snapshots, time, RNG, policy config, API clients,
copy dictionaries, theme tokens, asset URL resolvers, and route callbacks as
inputs.

## Next Infrastructure Slice: Core Submodule Consumption

**Status:** Implemented. `mushroom-master` now consumes the core through a
nested submodule-backed local package dependency.

### Goal

`mushroom-master` is the current backpack game consumer. It tracks
`backpack-game-core` as a nested Git submodule and imports the same package from
that local checkout, instead of relying only on a remote Git SHA dependency.

### Proposed Shape

- Nested submodule path: `vendor/backpack-game-core`.
- `package.json` dependency: `file:vendor/backpack-game-core`.
- Application imports stay unchanged:
  `import { ... } from '@microwavedev/backpack-game-core';`
- Commit the game repo's nested-submodule pointer and lockfile update together.
- Fresh checkouts run:
  `git submodule update --init --recursive`
  before `npm ci` / `npm install`.
- Missing-core guard: `npm run game:core:check`.
- Consumer smoke test: `tests/game/core-submodule.test.js`.

### Additional TODOs

1. Done: add TypeScript declarations for root and subpath exports before a
   second game starts integrating the package.
2. Done: add release/update notes for the core pointer SHA used by each game
   commit in `docs/backpack-game-core-update-log.md` and core package notes in
   `vendor/backpack-game-core/CHANGELOG.md`.
3. Done for the initial slice on 2026-07-04: integrate
   `git@github.com:nuclear-pancakes/meat-master.git` as the second
   backpack-style consumer with a nested core submodule and a playable local
   backpack battle prototype. Let that concrete integration drive API cleanup.
