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
  - includes asset catalog acquisition default/override resolution through
    `resolveAssetCatalogAcquisitionPolicy`
- layered architecture slice: public module facades under `src/modules/*`,
  route-adapter client primitives in `src/client/index.js`, and frontend
  loadout projection helpers in `src/client-view-model.js`, tested by
  `tests/module-exports.test.js`, `tests/client.test.js`, and
  `tests/client-view-model.test.js`
- client envelope adapter slice: `src/client/index.js` now supports optional
  `{ success, data, error }` response-envelope unwrapping so product apps can
  adopt the shared route client without changing backend payload contracts,
  tested by `tests/client.test.js`
- asset pack client view-model slice: `src/client-view-model.js` now also
  provides rarity odds text, guarantee/pity/duplicate text, active/availability
  labels, and roll-pack summary helpers over product-provided labels/catalogs,
  tested by `tests/client-view-model.test.js`
- wallet and roll-feedback client view-model slice: `src/client-view-model.js`
  now also provides wallet balance/bundle/status/support shaping and asset
  roll-result/problem feedback shaping over product-provided labels, tested by
  `tests/client-view-model.test.js`
- grid-cell classification client view-model slice: `src/client-view-model.js`
  now also provides slot-first bag row lookup, grid-cell classification, and
  occupied-footprint key generation for shared backpack board rendering,
  tested by `tests/client-view-model.test.js`
- grid board render row client view-model slice: `src/client-view-model.js` now
  also provides headless board cell flags, placed-piece grid rows, and bag-slot
  cell rows for product-styled backpack boards, tested by
  `tests/client-view-model.test.js`
- artifact stat client view-model slice: `src/client-view-model.js` now also
  provides stat total summing, signed delta formatting, bonus-entry DTO
  shaping, and loadout stat text composition over product-provided stat labels,
  stat order, and suffixes, tested by `tests/client-view-model.test.js`
- artifact grid utility client view-model slice: `src/client-view-model.js`
  now also provides occupied-cell value maps and preferred artifact preview
  orientation for rectangular and shape-bearing artifacts, tested by
  `tests/client-view-model.test.js`
- canonical artifact preview orientation slice: `src/client-view-model.js` now
  also distinguishes placement-preferred orientation from canonical preview
  orientation, so non-bag bitmap previews keep authored dimensions while shaped
  and legacy bags still use derived preview footprints, tested by
  `tests/client-view-model.test.js`
- wallet and asset-roll status normalization slice: `src/client-view-model.js`
  now also provides shared wallet intent, Telegram invoice, and asset-roll
  error status normalization helpers for browser/client flows, tested by
  `tests/client-view-model.test.js`
- wallet and asset-roll mutation view-state slice: `src/client-view-model.js`
  now also provides headless opening/success/failure state reducers for wallet
  purchases, asset pack rolls, and duplicate burns while games keep routes,
  checkout side effects, refresh hooks, and copy local, tested by
  `tests/client-view-model.test.js`
- headless wallet/gacha state helper slice: `src/client-view-model.js` now also
  provides wallet bundle loading states, wallet checkout next-action decisions,
  and asset roll/burn mutation refresh decisions while games keep API calls,
  checkout side effects, refresh hooks, and copy local, tested by
  `tests/client-view-model.test.js`
- run-shop response patch helper slice: `src/client-view-model.js` now also
  provides refresh-shop, buy, and sell response state projection helpers while
  games keep API calls, price guards, placement payloads, haptics, replay
  loading, and product copy local, tested by `tests/client-view-model.test.js`
- game-run response patch helper slice: `src/client-view-model.js` now also
  provides start, ready, round-transition, and completion response state
  projection helpers while games keep routes, loadout projection, bootstrap
  updates, replay loading, navigation, haptics, and product copy local, tested
  by `tests/client-view-model.test.js`
- replay playback state helper slice: `src/client-view-model.js` now also
  provides speed selection, long-battle boost, autoplay delay, tick
  advancement, load/set-speed patches, and timeline shaping while games keep
  timers, routes, settings persistence, event formatting, navigation, Vue
  computed wrappers, and UI local, tested by `tests/client-view-model.test.js`
- replay event row client view-model slice: `src/client-view-model.js` now also
  provides headless replay/battle-log row filtering, ordering, active flags,
  text fallback, and row limiting while games keep narration, replay screen
  markup, routes, and persistence local, tested by `tests/client-view-model.test.js`
- artifact tile display client view-model slice: `src/client-view-model.js`
  now also provides headless artifact tile dimensions, mask cells, role/shine
  metadata, image fallback, rotated-image hints, and role glyph labels while
  games keep artwork, CSS, generated SVGs, product visual classifiers, and page
  composition local, tested by `tests/client-view-model.test.js`
- asset gacha result DTO slice: `src/asset-gacha.js` and `modules/gacha` now
  also provide persisted roll/burn row normalizers and replay-safe roll/burn
  result DTO shapers over injected pack/catalog/items, tested by
  `tests/asset-gacha.test.js`
- gacha admin validation slice: `src/modules/gacha/admin-validation.js`,
  tested by `tests/gacha-admin-validation.test.js`, covers release checklist,
  fixture normalization, plan-item asset-id invariants, season-plan catalog
  projection, promotion metadata, plan coverage summaries, pack snapshots, and
  live/draft diff DTOs
- gacha admin frontend diff-row slice: `src/client-view-model.js` now also
  provides live/draft diff table row shaping for admin panels while games keep
  page layout, copy, auth, and API calls local, tested by
  `tests/client-view-model.test.js`
- gacha admin frontend checklist/plan row slice: `src/client-view-model.js`
  now also provides validation issue rows, release checklist rows, season-plan
  total weight, coverage rows, and chance text while games keep credential
  storage, API calls, uploads, product copy, and page layout local, tested by
  `tests/client-view-model.test.js`
- gacha admin fixture operation summary slice:
  `src/modules/gacha/admin-validation.js` now also provides dry-run/applied
  fixture operation summary counts while games keep DB transactions, fixture
  upserts, auth, audit logs, route payloads, and product errors local, tested by
  `tests/gacha-admin-validation.test.js`
- gacha admin frontend odds-preview row slice: `src/client-view-model.js` now
  also provides rarity/item odds preview rows, expected-percent text, weight
  fallback text, copy-cap fallback text, and row limiting while games keep
  preview loading, simulation services, product copy, and page layout local,
  tested by `tests/client-view-model.test.js`
- gacha admin frontend preview row slice: `src/client-view-model.js` now also
  provides fixture operation rows and simulation item rows with display fallback
  fields while games keep fixture import/export calls, simulation services,
  product copy, and page layout local, tested by
  `tests/client-view-model.test.js`
- gacha simulation slice: `src/modules/gacha/simulation.js`, tested by
  `tests/gacha-simulation.test.js`, covers deterministic odds simulation over
  injected packs, catalogs, ownership snapshots, copy counts, pity state, seed,
  and RNG
- wallet accounting slice: `src/wallet-accounting.js` plus
  `src/modules/wallet/*`, tested by `tests/wallet-accounting.test.js`, covers
  profile-wallet delta validation, balance math, purchase grant/reversal
  mutation shaping, purchase status classification, and settlement invariants
  over injected rows/snapshots
- profile asset state slice: `src/profile-asset-state.js` plus
  `src/modules/assets/*`, tested by `tests/profile-asset-state.test.js`,
  covers profile asset instance/equipment row shaping, ownership maps,
  paid/free equipment validation, direct-purchase spend mutation shaping,
  acquisition-source selection, instance draft rows, and portrait variant
  projection over injected catalog/policy snapshots
- profile asset target-variant response slice: `src/profile-asset-state.js`
  and `modules/assets` now also provide target-variant list projection over
  injected variants, catalogs, ownership state, active ids, asset-id adapters,
  and product policy adapters, tested by `tests/profile-asset-state.test.js`
- profile asset result DTO slice: `src/profile-asset-state.js` and
  `modules/assets` now also provide asset record, owned-instance summary,
  equipped-target summary, purchase result, equip result, and grant summary DTO
  shapers over injected rows/catalog snapshots, tested by
  `tests/profile-asset-state.test.js`
- package declaration pass: `src/*.d.ts`, guarded by
  `tests/package-types.test.js`
- initial commit: `69666c8` (`Add bag shape core helpers`)
- latest typed package baseline: `d5fb481` (`Add package type declarations`)
- latest consumed core commit: `42b1f1c`
  (`Add artifact tile display view models`)
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

## Geesome Architecture Review Notes

Reviewed 2026-07-04 for extraction guidance:

- `geesome-libs` is the reusable helper/client layer. It contains the shared
  client, browser storage helpers, crypto/IPFS helpers, and common functions.
- `geesome-ui` is a reusable frontend package. It keeps Vue services/plugins,
  pages, components, directives, assets, and locale together, and injects a
  shared client into app code through plugin-style wrappers.
- `geesome-node` is backend-module oriented. Feature folders use explicit
  `interface.ts`, `index.ts`, and `api.ts` files, with local query helpers,
  workers, models, migrations, and docs where needed.

Backpack should adopt the useful shape, but not the old coupling:

- Do not copy Geesome's deep import pattern such as
  `geesome-libs/src/GeesomeClient`. All Backpack consumers should import only
  package roots or public subpath exports.
- Treat the core repo as layered shared infrastructure: pure/domain core,
  client/contracts, Vue composables/components, and optional backend route
  binding helpers.
- Introduce a shared `BackpackGameClient` or client factory before moving
  frontend pages. Mushroom and Meat should inject base URL, auth, storage,
  fetch implementation, route adapters, copy, theme, and catalog providers.
- Backend slices should land as feature modules with explicit public
  interfaces, module factories over product adapters, optional API binding
  helpers, validation helpers, and module-local tests.
- Product DB models, migrations, repositories, auth, rate limits, support
  storage, payment providers, uploaded image storage, and final route/page
  assembly stay in each game.

## Sub-Agent Implementation Notes

Use sub-agents for maximum throughput in the next extraction phases. Keep each
assignment small enough that it can be integrated quickly, but let agents work
ahead on independent audits, contract drafts, fixtures, tests, adapters, and
review while the lead is handling heavy commands or merge decisions.

- **Lead agent:** owns dependency order, final plan edits, integration merge,
  commits, pushes, and all submodule pointer updates.
- **Architecture audit agent:** read-only review of Geesome precedent, current
  core exports, Mushroom adapters, and Meat prototype. Produces a package/module
  map and migration order.
- **Core module agent:** writes one assigned core module folder plus tests.
  Does not touch game adapters, payment code, DB models, Vue files, or pointers.
- **Client/contracts agent:** writes the API client, DTO shapers, type
  declarations, and package export tests. Does not touch product routes or Vue
  components.
- **Vue UI agent:** writes shared composables/components only after client
  contracts are stable. It must use props/events/slots/adapters and avoid
  direct product imports.
- **Mushroom adapter agent:** adapts Mushroom to one consumed core slice and
  updates focused Mushroom tests/screenshots for that slice.
- **Meat adapter agent:** adapts Meat to the same consumed core slice and keeps
  product art, copy, theme, content gating, and catalogs local.
- **Validation/review agent:** verifies sub-agent output against current files,
  runs assigned tests, and reports exact pass/fail evidence.

Maximum-efficiency constraints:

- Parallelize read-only audits, contract/API review, fixture design, disjoint
  module edits, consumer adapter prep, and validation review.
- Use temporary worktrees for parallel draft implementation when useful, but
  land final accepted changes through the lead-owned integration checkout and
  the repo's required base branch.
- Serialize only shared-state or heavyweight bottlenecks: `npm install`,
  `npm ci`, package builds, Vite/dev servers, Playwright/e2e, screenshot
  suites, `npm pack --dry-run`, commits, pushes, and submodule pointer updates.
- Run the pipeline in throughput waves: discovery, contract-first core work,
  parallel consumer adapters, lead integration, focused tests, then broad
  builds/screenshots/e2e.
- If two sub-agents need the same file, one owns the edit and the other returns
  a review note or patch suggestion.

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
| Shop offer generation and run lifecycle state plans | `backpack-game-core/src/shop-offer.js`; `backpack-game-core/src/run-lifecycle.js`; Mushroom adapters in `app/server/services/shop-service.js` and `app/server/services/run-service.js` | Extracted with product config | Core owns deterministic pool sampling, bag pity, bag chance escalation, character-item slot reservation, buy/refresh/sell run-currency + offer-state plans, run start drafts, starter loadout drafts, initial/next shop state, ghost budget math, round reward/counter/end-state plans, and challenge group-completion decisions. Mushroom passes combat pools, bag pools, eligible character items, generated offers, starter presets, balances, reward tables, and run config. |
| Run/shop mutations | `startGameRun`, `resolveRound`, `createChallengeRun`, `resolveChallengeRound`, `buyRunShopItem`, `refreshRunShop`, `sellRunItem` in product services | Adapter over core planners | Core plans pure state transitions; DB transactions, run locks, persisted shop states, loadout rows, refunds, route errors, catalog lookup, player/mushroom selection, daily limits, rewards execution, rating, season/achievement grants, ghost selection, and challenge matching stay in product service code. |
| Bot loadout generation | `backpack-game-core/src/backpack-loadout.js`; Mushroom wrapper in `app/server/services/bot-loadout.js` | Extracted with product providers | Core owns weighted-pick, first-fit bag placement, rectangular item placement, occupied-cell tracking, and retry orchestration. Mushroom passes artifacts, affinities, presets, prices, grid constants, RNG, validation, and keeps ghost snapshot/portrait glue local. |
| Battle simulation | `backpack-game-core/src/battle-simulation.js`; Mushroom adapter in `app/server/services/battle-engine.js` | Extracted with product hooks | Core owns deterministic 1v1 turn loop, action/skip event sequencing, HP/stun flow, speed/base-speed tiebreak fallback, step-cap winner resolution, and result shaping. Mushroom passes combatant derivation, active/passive ability hooks, Morga/Kirt tiebreak hooks, artifact attribution/effect metadata, narration labels, constants, and seeded RNG. |
| Wallet accounting and purchase lifecycle | `backpack-game-core/src/wallet-accounting.js`; Mushroom adapter in `app/server/services/wallet-service.js` | Adapter over core planners | Core owns balance math, transaction draft shaping, purchase intent drafts, checkout DTO/metadata patch shaping, checkout resolved-state checks, completion grant planning, purchase grant/reversal mutation shaping, status classification, price matching, and settlement invariants. SQL rows, locks, provider SDK calls, webhooks, invoice polling, support actions, adult-content policy, and operations runbooks stay local. |
| Payment providers and purchase webhooks | `app/server/services/provider-settlement-*`, `bot-gateway.js`, payment routes | Product-specific | Telegram Stars, BTCPay, NOWPayments, provider signatures, invoice lookups, tax/accounting, adult-content policy, and settlement records are game/ops concerns, not backpack mechanics. |
| Asset catalog, ownership, equipment, and direct-buy policy | `backpack-game-core/src/profile-asset-state.js`; Mushroom adapter in `app/server/services/asset-service.js`; profile asset tables and runtime catalogs | Partially extracted domain-core candidate | Core now owns reusable profile asset state shaping, ownership maps, equip validation, purchase spend parameters, instance drafts, portrait variant projection, purchase/equip result DTOs, and grant summaries over injected rows/catalog policy. Runtime catalog lookup, SQL row lifecycle, support actions, gacha roll/burn grants, paid rollback behavior, direct-buy policy composition, and compatibility mirrors stay in the game. |
| Gacha pack validation, rolling, duplicates, burn, pity, and simulation | `backpack-game-core/src/asset-gacha.js`; Mushroom adapter in `app/server/services/asset-service.js`; `gacha-simulation-service.js`; admin validation helpers | Adapter over core planners | Core owns pack/item validation, candidate filtering, weighted slot selection, duplicate copy caps, burn target policies, pity/guarantees, odds simulation, result DTO shaping, roll settlement planning, duplicate-burn settlement planning, grant drafts, evidence metadata, and admin DTO/view-model helpers. Secure RNG source, wallet debit execution, asset grant persistence, pack storage, idempotency replay, SQL transactions, and operator audit records stay local. |
| Shared frontend DTO/view-model shaping | `backpack-game-core/src/client-view-model.js`; Mushroom composables/pages/components | Partially extracted frontend-core candidate | Core owns many browser-safe transforms for loadout projection, shop/run/replay response state, wallet/gacha status, asset pack summaries, admin rows, grid/stat helpers, artifact stat-row DTOs, shop item row DTOs, board render rows, replay rows, and artifact tile display contracts. Next frontend moves should be neutral component-level primitives only after data contracts settle: pack cards, odds tables, and roll-result panels. |
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

Post-implementation review on 2026-07-04: the package/module architecture pass
landed in core commit `3e3d5d6`, the first real helper movement landed in core
commit `8345448`, the gacha simulation helper moved in core commit `b3da379`,
the wallet accounting helper moved in core commit `af520f0`, and the profile
asset state helper moved in core commit `6ae688b`. Asset catalog acquisition
default/override policy moved in core commit `77b1d7b`, the first asset/gacha
client view-model helper slice moved in core commit `578279d`, wallet/roll
feedback view-model shaping moved in core commit `cf7c680`, and grid-cell
classification moved in core commit `f403553`. Artifact stat total/text DTO
shaping moved in core commit `41a3ad5`, and artifact grid utility shaping moved
in core commit `725ffab`. Canonical preview-orientation shaping moved in core
commit `786d41c`, and wallet/asset-roll client status normalization moved in
core commit `f387670`. Asset gacha roll/burn result DTO shaping moved in core
commit `9b7b505`, and profile asset target-variant response shaping moved in
core commit `0f8beee`. Wallet and asset-roll mutation view-state shaping moved
in core commit `fc53abc`. Client response-envelope unwrapping moved in core
commit `b56ad91`, and Mushroom customization wallet/gacha routes,
social/wiki-detail routes, auth/bootstrap/settings routes, and game-run routes
now use the shared route-adapter client. Replay/dev-tool routes followed in the
final route-client cleanup, and the legacy `apiJson` helper was removed from
live code. Profile asset purchase/equip/grant result DTO shaping moved in core
commit `458d4bb`; Mushroom delegates direct-buy, equip, roll-grant, burn-grant,
and idempotent replay instance summaries through `modules/assets` while keeping
runtime catalogs, SQL queries, wallet spends, RNG, mutation claims, and route
payload ownership local. The first headless wallet/gacha state helper slice
moved in core commit `5ee7ee8`; Mushroom delegates wallet bundle loading
states, checkout next-action decisions, and roll/burn refresh decisions while
keeping API calls, Telegram/web checkout side effects, bootstrap refresh, route
names, and product copy local.
`modules/gacha`, `modules/wallet`, `modules/shop`, `modules/loadout`,
`modules/battle`, `modules/fusion`, `client`, and `client-view-model` are now
public import lanes with declarations and consumer coverage. Future extraction
should keep moving one reusable behavior cluster at a time through those lanes
instead of adding facade-only slices.

Next planned domain slices:

1. **Package/module architecture pass:** **Implemented 2026-07-04 in core
   commit `3e3d5d6`.** Continue with one package plus public subpath exports
   until Vue extraction or build tooling makes a package split necessary.
2. **Asset-gacha core slice:** catalog/acquisition policy helpers,
   pack/item/status/date/price/currency validation, direct-buy blocking,
   candidate filtering, weighted slot selection, guarantee and pity helpers,
   duplicate copy-cap filtering, burn target selection, roll evidence shaping,
   and pack UI shaping over plain objects. **Implemented 2026-07-04 in
   `src/asset-gacha.js`; Mushroom adapter wiring delegates to it.**
3. **Gacha admin validation/release checklist:** first real module-movement
   slice after facades. Move pure
   fixture shape checks, duplicate-id checks, pack release checklist issue
   grouping, planned asset promotion preflight, plan-item generated asset-id
   immutability, linked-character rules, and runtime catalog visibility checks
   into `modules/gacha/admin-validation` over neutral row/catalog snapshots.
   **Implemented 2026-07-04 in core commit `8345448`; Mushroom delegates through
   DB-aware wrappers.** Keep DB transactions, audit rows, operator permissions,
   upload/storage, route payloads, and product error wording in Mushroom.
4. **Gacha simulation:** deterministic odds simulation over the same roll core
   so admin preview, CLI tools, and tests share one model. **Implemented
   2026-07-04 in core commit `b3da379`; Mushroom admin preview and CLI/runtime
   simulation now delegate through thin adapters.**
5. **Wallet accounting:** reusable balance-delta, purchase grant/reversal
   mutation shaping, status classification, and settlement invariant helpers
   that operate on passed snapshots; no DB writes or provider callbacks.
   **Implemented 2026-07-04 in core commit `af520f0`; Mushroom wallet and
   provider-settlement services delegate through adapters.**
6. **Profile asset state:** reusable ownership/equipment row shaping,
   ownership maps, paid/free equipment validation, direct-purchase spend
   mutation shaping, acquisition-source selection, instance drafts, and
   portrait variant projection. **Implemented 2026-07-04 in core commit
   `6ae688b`; Mushroom delegates through `modules/assets` while keeping
   runtime catalogs, SQL lifecycle, support actions, paid rollback behavior,
   gacha roll/burn lifecycle, and the active-portrait mirror local.**
7. **Asset catalog acquisition policy cleanup:** reusable paid/free default
   acquisition-mode resolution, per-asset overrides, explicit `packId: null`,
   and default pack assignment. **Implemented 2026-07-04 in core commit
   `77b1d7b`; Mushroom delegates through `modules/gacha` while keeping env
   parsing, product pack ids, portrait URLs, catalog assembly, runtime pack
   lookup, and direct-buy/roll execution local.**
8. **Asset pack client view-model helpers:** browser-safe rarity odds text,
   guarantee/pity/duplicate labels, active/availability labels, and roll-pack
   summary shaping over passed pack/catalog snapshots and product copy.
   **Implemented 2026-07-04 in core commit `578279d`; Mushroom delegates the
   home skin-picker pack summary while keeping localization, runtime bootstrap
   state, selected character state, routes, and visual composition local.**
9. **Wallet and roll feedback client view-model helpers:** browser-safe wallet
   balance fallback, bundle-surface filtering, bundle price/status/support
   shaping, and asset roll result/problem feedback assembly over passed labels.
   **Implemented 2026-07-04 in core commit `cf7c680`; Mushroom delegates home
   wallet and pack-feedback shaping while keeping surface detection,
   localization, emitted actions, routes, and visual composition local.**
10. **Grid-cell classification view-model helpers:** slot-first bag row lookup,
    grid cell role classification, and occupied footprint key generation for
    backpack board rendering. **Implemented 2026-07-04 in core commit
    `f403553`; Mushroom delegates artifact-grid lookup rules while keeping
    visual classes, overlays, drag/drop events, and layout constants local.**
11. **Artifact stat view-model helpers:** stat total summing, signed delta
    formatting, bonus-entry DTO shaping, and loadout stat text composition over
    passed labels/stat order/suffixes. **Implemented 2026-07-04 in core commit
    `41a3ad5`; Mushroom delegates `deriveTotals`, artifact bonus labels,
    loadout stat text, and stat chips while keeping product stat labels,
    visual role classes, copy, and final UI composition local.**
12. **Artifact grid utility view-model helpers:** occupied-cell value maps and
    preferred artifact preview orientation for rectangular and shape-bearing
    artifacts. **Implemented 2026-07-04 in core commit `725ffab`; Mushroom
    delegates `buildOccupancy` and `preferredOrientation` while keeping
    placement state, visual previews, drag/drop actions, and product rendering
    local.**
13. **Canonical artifact preview orientation helper:** preview-only orientation
    for artifact cards, inventory chips, catalog boards, and fusion previews
    where non-bag bitmaps should keep authored dimensions while shaped and
    legacy bags use derived preview footprints. **Implemented 2026-07-04 in
    core commit `786d41c`; Mushroom delegates shop, backpack, social, catalog,
    and fusion preview orientation through this helper while keeping
    placement-preferred orientation in placement flows.**
14. **Wallet and asset-roll status normalization:** browser-safe helpers for
    wallet purchase-intent status, Telegram invoice callback status, and
    asset-roll error status mapping. **Implemented 2026-07-04 in core commit
    `f387670`; Mushroom delegates customization checkout and pack roll/burn
    status mapping while keeping route actions, Telegram/web opening,
    localization, and final UI composition local.**
15. **Asset gacha roll/burn result DTO shaping:** persisted roll and duplicate
    burn exchange row normalizers plus replay-safe result DTO shapers over
    injected pack/catalog/items. **Implemented 2026-07-04 in core commit
    `9b7b505`; Mushroom delegates roll and burn result payload shaping while
    keeping SQL queries, wallet spends, asset grants, secure RNG, idempotency,
    and route payload ownership local.**
16. **Profile asset target-variant response shaping:** list projection over
    catalog/state/policy adapters for inventory and equipment variant surfaces.
    **Implemented 2026-07-04 in core commit `0f8beee`; Mushroom delegates
    progression portrait list shaping while keeping portrait id convention,
    runtime catalog, gacha-plan policy, active/equipment resolution, and
    product routes local.**
17. **Profile asset result DTO shaping:** asset record, owned-instance summary,
    equipped-target summary, purchase result, equip result, and grant summary
    shapers over injected rows/catalog snapshots. **Implemented 2026-07-04 in
    core commit `458d4bb`; Mushroom delegates direct-buy/equip response
    shaping and roll/burn grant instance summaries while keeping runtime
    catalog lookup, SQL lifecycle, wallet spends, RNG, mutation claims, and
    route payload ownership local.**

Next planned frontend slices:

1. **Client/contracts layer:** **First slice implemented 2026-07-04** with the
   route-adapter client and shared `client-view-model` loadout projection.
   **Second slice implemented 2026-07-04** with asset pack summary/label
   helpers for gacha UI state. **Third slice implemented 2026-07-04** with
   wallet purchase-surface and asset roll-feedback helpers. **Fourth slice
   implemented 2026-07-04** with grid-cell classification helpers. **Fifth
   slice implemented 2026-07-04** with artifact stat total/text helpers.
   **Sixth slice implemented 2026-07-04** with occupied-cell map and preferred
   preview-orientation helpers. **Seventh slice implemented 2026-07-04** with
   canonical preview orientation for bitmap/card surfaces. **Eighth slice
   implemented 2026-07-04** with wallet purchase-intent, Telegram invoice, and
   asset-roll error status normalization. **First asset inventory/equipment
   response shaper implemented 2026-07-04** with target-variant list projection.
   **Ninth slice implemented 2026-07-04** with headless wallet/asset-roll
   mutation view-state reducers. **Tenth slice implemented 2026-07-04** with
   optional response-envelope unwrapping in the shared route client and
   Mushroom customization route-client adoption. **Eleventh consumer slice
   implemented 2026-07-04** with Mushroom social/wiki-detail route-client
   adoption over the same core client. **Twelfth consumer slice implemented
   2026-07-04** with Mushroom auth/bootstrap/settings route-client adoption.
   **Thirteenth consumer slice implemented 2026-07-04** with Mushroom game-run
   route-client adoption. **Final route-client cleanup implemented
   2026-07-04** with replay/dev-tool route adoption and removal of the legacy
   `apiJson` helper from live code. **First headless wallet/gacha state helper
   slice implemented 2026-07-04** with wallet bundle loading state, checkout
   next-action, and roll/burn refresh-decision helpers. **First run-shop
   response patch helper slice implemented 2026-07-04** with refresh-shop,
   buy, and sell state projection helpers. **Broader game-run response patch
   helper slice implemented 2026-07-04** with start, ready, round-transition,
   and completion projection helpers. Continue with planner-level service
   boundaries (roll settlement, duplicate-burn settlement, wallet purchase
   lifecycle, then run/shop lifecycle) before page/component extraction. Do not
   move the full Mushroom API client into core yet; keep product routes behind
   injected adapters.
2. **Post-route-client asset DTO cleanup:** **Implemented 2026-07-04 in core
   commit `458d4bb`.** Purchase result DTOs, equip result DTOs,
   owned-instance summaries, equipped-target summaries, and duplicate-grant
   summaries now live in `modules/assets`; Mushroom consumes them from the
   asset service while keeping persistence and product policy local.
3. **Headless wallet/gacha services:** **First slice implemented 2026-07-04 in
   core commit `5ee7ee8`.** Wallet bundle loading state, purchase-intent /
   checkout next-action decisions, and roll/burn refresh decisions now live in
   `client-view-model`; Mushroom keeps API calls, Telegram invoice opening, web
   checkout opening, bootstrap refresh callbacks, route names, and product copy
   local. Remaining headless service candidates: pack list loading, duplicate
   burn availability, odds-preview state, and broader API-client orchestration
   over injected route clients and product copy/policy adapters.
4. **Run-shop mutation view-model helpers:** **First slice implemented
   2026-07-04 in core commit `f4734ea`.** Refresh-shop, buy, and sell response
   patch helpers now live in `client-view-model`; Mushroom keeps API calls,
   price guards, row-id sell payload construction, placement payload
   construction, haptics, replay loading, server mutations, route names, and
   product copy local. **Broader game-run response patch helper slice
   implemented 2026-07-04 in core commit `2092663`:** start, ready,
   round-transition, and completion response patch helpers now also live in
   `client-view-model`; Mushroom keeps loadout projection, bootstrap updates,
   replay loading, navigation, haptics, routes, and product copy local.
5. **Frontend services/composables:** move browser-safe state machines and API
   adapter factories: bootstrap loader, shop/backpack state, battle replay
   view model, wallet/asset catalog state, gacha pack state, and admin
   validation/odds preview state. These should be plain JS or Vue composables
   with neutral fixtures before component extraction.
6. **Backpack UI primitives:** extract backpack grid, artifact tile/card,
   shop offer list, budget badge, placement preview, and core structural styles
   behind props/events/slots.
7. **Battle UI primitives:** extract battle log, replay timeline, combatant
   stat strips, outcome badges, and playback controls over core battle events.
8. **Asset/gacha UI primitives:** extract wallet balance badge, asset inventory
   panel, equipment picker, gacha pack card, roll result modal, odds table,
   duplicate/burn summary, and asset acquisition labels.
9. **Admin gacha UI primitives:** extract validation issue lists, release
   checklist, season-plan coverage grid, odds preview, pack diff, and plan item
   editor widgets only after their backend/view-model contracts are stable.
10. **Optional page shells:** extract page-level prep/shop, battle replay,
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

Post-route-client review finding on 2026-07-04: no additional route plumbing is
needed in core right now. Whole Mushroom services and pages are still too
product-coupled. The asset inventory/equipment DTO lane is covered by core
commit `458d4bb`, and the first headless wallet/gacha state helper slice is
covered by core commit `5ee7ee8`. The first run-shop response patch helper
slice is covered by core commit `f4734ea`, the broader game-run response patch
helper slice is covered by core commit `2092663`, and replay playback state is
covered by core commit `ee2a275`. Gacha admin pack draft-diff DTOs and diff
table rows are covered by core commit `c850a14`. Gacha admin validation,
release checklist, and season-plan row shaping is covered by core commit
`7deb088`. Gacha admin fixture operation summaries are covered by core commit
`497e6f7`. Gacha admin odds preview rows are covered by core commit `c5ebe41`,
and fixture-operation/simulation preview rows are covered by core commit
`c9d8492`. Backend settlement/lifecycle planners are covered by core commits
`624d4b0` and `bf863f3`: asset-gacha roll settlement, duplicate-burn
settlement, wallet purchase intent/checkout/completion, run-shop
buy/refresh/sell planning, run start drafts, starter loadout drafts,
initial/next shop state, ghost budget math, round reward/counter/end-state
planning, and challenge group-completion decisions. The first neutral frontend
primitive slices are covered by core commits `2280929`, `ffaa376`, `3c638fb`,
`a4c4c06`, and `42b1f1c`: headless artifact stat-row DTO shaping, shop item
row DTO shaping, grid board render row shaping, replay event row shaping, and
artifact tile display contracts for Mushroom/Meat stat chips, shop offers,
backpack boards, battle logs, and artifact images. The next useful extractions
are larger neutral frontend primitives that both games can consume without
inheriting Mushroom persistence, Telegram, payment, catalog, art, support,
haptics, or page-composition rules.

Post-preview-helper review on 2026-07-05: there is still reusable code in
Mushroom, but it should move as planners and DTO builders rather than copied
services. Recommended order:

1. Asset-gacha roll settlement planner: implemented in core commit `624d4b0`
   with candidate-pool hash, duplicate summaries, guarantee/pity payloads,
   wallet spend metadata, grant drafts, roll evidence, and result item DTOs.
2. Duplicate-burn settlement planner: implemented in core commit `624d4b0`
   with burn-source ordering, source burn metadata, target grant drafts,
   exchange evidence, and result item DTOs.
3. Wallet purchase intent/status planner: implemented in core commit
   `624d4b0` plus earlier wallet-accounting helpers for provider-neutral
   intent drafts, checkout metadata, completed grant/reversal plans,
   review/clawback status decisions, and amount/currency contracts.
4. Run/shop lifecycle planner: implemented across core commits `624d4b0` and
   `bf863f3` for shop buy/refresh/sell state plans, run start drafts, starter
   loadout drafts, initial/next shop state, ghost budget math, round reward
   and counter transitions, run end-state decisions, and challenge
   group-completion decisions.
5. Neutral frontend primitive stat rows: implemented in core commit `2280929`
   with `shapeArtifactStatRows` in `client-view-model`. Mushroom uses it for
   artifact stat chips while keeping role colors/glyph markup local; Meat uses
   it for compact shop/loadout bonus text.
6. Neutral frontend primitive shop rows: implemented in core commit `ffaa376`
   with `shapeShopItemRows` in `client-view-model`. Mushroom uses it for prep
   shop offer rows while keeping localized copy, role/shine classes, fusion
   hints, click actions, and markup local; Meat uses it for prototype shop
   buttons.
7. Neutral frontend primitive board rows: implemented in core commit `3c638fb`
   with `shapeGridBoardCells`, `shapeGridBoardPieces`, and
   `shapeGridBagSlotCells` in `client-view-model`. Mushroom uses them in
   `ArtifactGridBoard` while keeping visual classes, bag overlays, drag/drop
   events, figure rendering, layout constants, and CSS local; Meat uses them for
   prototype backpack bag slots and placed pieces.
8. Neutral frontend primitive replay rows: implemented in core commit
   `a4c4c06` with `shapeReplayEventRows` in `client-view-model`. Mushroom's
   replay timeline uses it for visible event ordering and active-row flags while
   keeping event formatting, screen markup, routes, and persistence local; Meat
   uses it for compact battle-log filtering and limiting.
9. Neutral frontend primitive artifact tile display: implemented in core commit
   `42b1f1c` with `shapeArtifactTileDisplay` and footprint helpers in
   `client-view-model`. Mushroom uses it for artifact figure HTML/Vue render
   contracts while keeping bitmap generation, role colors, product visual
   taxonomy, CSS, and generated SVGs local; Meat uses it for prototype artifact
   image/tile metadata.
10. Remaining neutral frontend primitives: pack cards, odds tables, roll-result
   panels, and component contracts after the planner DTOs stabilize.

Do not move SQL, provider SDK calls, webhook verification, Telegram/adult
content policy, support permissions, settlement runbooks, image storage, lore
copy, visual assets, CSS themes, or product page shells into the core package.

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
