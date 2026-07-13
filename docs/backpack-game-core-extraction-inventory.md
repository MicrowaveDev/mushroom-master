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
  adopt the shared route client without changing backend payload contracts.
  It preserves API error text from string errors and `{ message }` error
  objects; Mushroom and Meat both consume it through product-local route/auth
  adapters. Tested by `tests/client.test.js`
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
- asset pack card client view-model slice: `src/client-view-model.js` now also
  provides headless pack detail/status lines plus roll/burn action DTOs over
  product-provided summary rows and labels while games keep markup, styling,
  localized copy, route events, and page composition local, tested by
  `tests/client-view-model.test.js`
- gacha odds table and roll result panel client view-model slice:
  `src/client-view-model.js` now also provides headless odds table sections and
  asset roll result panel DTOs while games keep markup, styling, localization,
  route events, and page composition local, tested by
  `tests/client-view-model.test.js`
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
- server module contract hardening: `src/server/index.js` now validates module
  names, duplicate requires/provides, duplicate registrations, dependency keys,
  per-module config, explicit provider overrides, and declared provides. The
  contract is documented in
  `vendor/backpack-game-core/docs/server-module-contract.md` and tested by
  `tests/server-modules.test.js`.
- server route-descriptor slice: `src/server/index.js` now also exposes
  framework-neutral route descriptors, route groups, descriptor flattening, and
  adapter-driven route binding. This is the required bridge before moving
  larger Mushroom route files into core: core modules can provide route
  factories without importing the product HTTP stack, and products still mount
  routes in their own composition roots.
- auth route-descriptor slice: `src/server/index.js` now also exposes
  provider-neutral auth/bootstrap route names, `createAuthRouteGroup`, and
  `createAuthRoutesServerModule`. Mushroom binds its existing Telegram/web/
  logout/bootstrap/dev-session handlers through this core route family while
  keeping verification, sessions, rate limits, player lookup, and final path
  choices local. Meat pins the same SHA and verifies the route family with its
  current auth/bootstrap paths.
- first mv-first server-file cluster: `src/server/modules/bot-loadout.js`,
  `src/server/modules/loadout-utils.js`,
  `src/server/modules/gacha-simulation-service.js`, and
  `src/server/modules/ready-manager.js` were physically moved from Mushroom
  service files into core and neutralized into provider-driven factories.
  Mushroom keeps thin wrappers at the old paths for catalog/config/provider
  wiring and legacy `mushroomId` output compatibility; Meat pins the same SHA
  and imports the factories in its core-consumption test.
- second mv-first server-file cluster: `src/server/modules/utils.js` and
  `src/server/modules/observability.js` were physically moved from Mushroom
  server `lib` files into core and neutralized into the public `server`
  facade. Mushroom keeps thin wrappers at the old paths for legacy progression
  aliases, Russian-first language fallback, and product-specific log context;
  Meat pins the same SHA and imports the utility/logger facade in its
  core-consumption test.
- quarantined gameplay ports: `src/server/ports/mushroom/gameplay` exposes
  `createGameRunLoadoutPort()`, `createArtifactFusionPort()`,
  `createSeasonProgressPort()`, `createMushroomBattleEnginePort()`,
  `createMushroomBattleServicePort()`, `createMushroomShopServicePort()`, and
  `createMushroomGameServicePort()`, `createMushroomPlayerServicePort()`, and
  `createMushroomRunServicePort()` after physically moving Mushroom's matching
  service files into core. The ports preserve current Mushroom SQL/table,
  profile/bootstrap DTO, and run lifecycle behavior behind injected providers.
  Mushroom keeps the old service paths as wrappers; Meat verifies the exports
  without adopting these temporary Mushroom table contracts.
- quarantined economy ports: `src/server/ports/mushroom/economy` exposes
  `createMushroomWalletServicePort()` after physically moving Mushroom's
  profile-wallet and payment lifecycle service file into core. The port
  preserves current wallet/payment SQL, provider, webhook, and reconciliation
  behavior behind injected providers while repository/provider contracts are
  neutralized.
- quarantined Mushroom model definitions:
  `src/server/models/mushroom` now contains the full moved
  `app/server/models` Sequelize definition set plus `initModels()` association
  setup. Mushroom keeps only `app/server/models/index.js` as a wrapper. This
  is not a stable repository layer; product repos still own Sequelize instance
  creation, dialect config, sync/backfill logic, queries, transactions, and
  migrations.
- browser-safe Vue composable slice: `src/vue/composables/useReducedMotion.js`
  now exposes `createReducedMotionTracker` and
  `bindReducedMotionTracker` through
  `@microwavedev/backpack-game-core/vue/composables`, tested by
  `tests/vue-composables.test.js`. Mushroom keeps a compatibility re-export.
- artifact capability helper slice: `src/artifact-capabilities.js` now exposes
  default backpack family capabilities, configurable `familyCaps`, bag-family
  detection, combat/stat contribution checks, and container-placement helpers
  through `@microwavedev/backpack-game-core/artifact-capabilities` and
  `modules/loadout`, tested by `tests/artifact-capabilities.test.js`.
  Mushroom keeps `app/server/services/artifact-helpers.js` as a compatibility
  re-export.
- artifact visual classification slice:
  `src/artifact-visual-classification.js` now exposes a product-configurable
  classifier factory and direct helpers for role, shine, owner, stat, footprint,
  CSS-class, and prompt metadata through
  `@microwavedev/backpack-game-core/artifact-visual-classification`, tested by
  `tests/artifact-visual-classification.test.js`. Mushroom keeps
  `app/shared/artifact-visual-classification.js` as the compatibility wrapper
  that supplies Mushroom labels, prompts, CSS taxonomy, shine tiers, and legacy
  `characterItem.mushroomId` owner lookup.
- artifact fusion recipe helper slice:
  `src/artifact-fusion-recipes.js` now exposes product-configurable recipe
  normalization, recipe lookup, ingredient-policy, result/ingredient summary,
  and fusion evaluator helpers through
  `@microwavedev/backpack-game-core/artifact-fusion-recipes` and
  `modules/fusion`, tested by `tests/artifact-fusion-recipes.test.js`.
  Mushroom keeps `app/shared/artifact-fusions.js` as the compatibility wrapper
  that supplies the authored recipe table and Mushroom-specific ingredient
  exclusions.
- season progression and achievement slice:
  `src/modules/season` now exposes product-configurable season scoring,
  progress-summary DTO helpers, level lookup, and run-achievement evaluation
  through `@microwavedev/backpack-game-core/modules/season`, tested by
  `tests/season.test.js`. Mushroom keeps authored season/achievement JSON,
  badge/rank art policy, current-season copy, and the legacy `mushroomId`
  context adapter in thin wrappers.
- mutation claim service slice:
  `src/server/modules/mutation-claim.js` now exposes
  `createMutationClaimService()` through `@microwavedev/backpack-game-core/server`,
  tested by `tests/server-utils.test.js`. Mushroom injects its `mutation_claims`
  SQL query function, env timing, clock, and ID providers through the local
  wrapper.
- gacha simulation service slice:
  `src/modules/gacha/simulation-service.js` now exposes provider-driven
  static/runtime simulation service factories, and
  `createAssetGachaSimulationServerModule` registers that service through the
  server module contract. Mushroom keeps concrete static/runtime pack, catalog,
  odds, and visibility lookups in `app/server/services/gacha-simulation-service.js`.
- loadout validation service slice:
  `src/modules/loadout/validation-service.js` now exposes the provider-driven
  validation service factory, and `createLoadoutValidationServerModule`
  registers that service through the server module contract. Mushroom keeps
  grid constants, artifact lookup, pricing, family semantics, stat caps, and
  compatibility exports in `app/server/services/loadout-utils.js`.
- run readiness module-list slice:
  `createRunReadinessServerModule` now registers the shared readiness/idle/lock
  manager through the server module contract. Mushroom keeps route wiring,
  active-run validation, challenge resolution, SSE delivery, and compatibility
  exports in `app/server/services/ready-manager.js`.
- initial commit: `69666c8` (`Add bag shape core helpers`)
- latest typed package baseline: `d5fb481` (`Add package type declarations`)
- latest consumed core commit: `bb49947`
  (`Move season and mutation claim helpers into core`)
- latest runtime/API core commit: `bb49947`
  (`Move season and mutation claim helpers into core`)
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
- **Quarantined port candidate:** the current Mushroom file is reusable enough
  to move now, but still imports DB/query helpers, Express request/response
  shapes, Telegram/payment/provider code, product catalogs, or legacy field
  names. Move it with `mv` into
  `backpack-game-core/src/server/ports/mushroom/<feature>/`, restore the
  Mushroom path as a wrapper, add exact import-boundary allowlist coverage, and
  then neutralize it behind repositories/config/policies before promoting it
  to a stable `src/server/modules/<feature>` export.
- **Shared-content quarantine:** Mushroom-specific content or metadata may move
  only when it unblocks packaging or wrapper compatibility, and then under an
  explicit `content/mushroom` or `ports/mushroom` namespace. It is not stable
  cross-game API until products provide it as injected data.
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

## Server And Shared Move Recommendation, 2026-07-07

The remaining `app/server` and `app/shared` files should move more aggressively
than the original helper-only audit allowed, but the stable API boundary stays
strict. Move code by filesystem `mv`, leave thin Mushroom wrappers, add
fake-provider tests in core, and keep product-owned runtime/content outside
stable exports.

Server split:

Current server audit, 2026-07-07:

- Already core-backed wrappers, not urgent bulk moves:
  `app/server/lib/idempotency.js`, `app/server/lib/rate-limit.js`,
  `app/server/lib/obs.js`, `app/server/lib/utils.js`,
  `app/server/models/index.js`, `app/server/services/artifact-helpers.js`,
  `app/server/services/ready-manager.js`,
  `app/server/services/gacha-simulation-service.js`,
  `app/server/services/loadout-utils.js`,
  `app/server/services/bot-loadout.js`,
  `app/server/services/game-run-loadout.js`, and
  `app/server/services/artifact-fusion-service.js`,
  `app/server/services/battle-engine.js`,
  `app/server/services/battle-service.js`,
  `app/server/services/shop-service.js`,
  `app/server/services/game-service.js`,
  `app/server/services/player-service.js`,
  `app/server/services/run-service.js`,
  `app/server/services/wallet-service.js`,
  `app/server/services/asset-service.js`,
  `app/server/services/season-service.js`, and
  `app/server/services/mutation-claim-service.js`. Keep them as compatibility
  wrappers until Mushroom imports can be cleaned.
- The economy service move lane is complete through
  `provider-settlement-service.js` and `wallet-ops-check-service.js`.
  `provider-settlement-adapters.js` correctly remains a product field-map
  wrapper over core `modules/wallet/settlement-adapters`; provider callbacks,
  credentials, alert URLs, support permissions, paid rollback policy, and
  adult-content/payment policy stay product-owned.
- Product-local for now:
  `db.js`, `start.js`, `services/sse-manager.js`, and
  `services/home-field-config.js`. Split `game-data.js` into reusable schema /
  projection / selection helpers only; keep Mushroom content and balance data
  local.

| Current file | Extraction direction | Keep product-owned |
| --- | --- | --- |
| `app/server/auth.js` | Core auth/session/bootstrap route and service ports. | Telegram verification, sessions, dev-login policy, rate limits, player lookup, final route paths. |
| `app/server/create-app.js` | Route groups and route-handler factories. | Express app creation, middleware ordering, static serving, raw-body webhook placement, module-list composition. |
| `app/server/bot-gateway.js` | Generic command/payment lifecycle DTO helpers. | Telegram transport, webhook receiver setup, Stars callbacks, support/terms copy, adult-content policy. |
| `app/server/wiki.js` | Wiki route/search/cache helper module. | Mushroom lore/wiki content, unlock text, images, publication policy. |
| `app/server/social-preview-cache.js` | Reusable preview-cache orchestration helpers. | Product renderer, filesystem/static paths, artwork, preview copy. |
| `app/server/game-data.js` | Catalog schemas, validators, projection helpers, selection utilities. | Mushroom roster, artifacts, portraits, balance tables, lore ids, art paths. |
| `app/server/db.js` | Repository contracts only; model definitions are already quarantined in core. | Sequelize instance, dialect config, migrations, sync/backfill/index repair, transactions. |
| `app/server/start.js` | No stable core move. | Process startup, env/port handling, lifecycle, deploy composition. |
| `app/server/services/season-service.js` | ✅ Done 2026-07-08 in core commit `bb49947`: moved as `createSeasonProgressPort()` under the quarantined Mushroom gameplay port, backed by injected scoring, achievement, clock, and ID helpers. | Current season id, product tables, grant persistence semantics, authored achievement definitions, badge/rank art, and scheduling stay in the wrapper/content. |
| `app/server/services/mutation-claim-service.js` | ✅ Done 2026-07-08 in core commit `bb49947`: generic repository-backed `createMutationClaimService()` moved to the stable server facade. | Concrete table name, SQL upsert semantics, env timing, retention policy, and product mutation scopes stay product-configured. |
| `app/server/services/battle-engine.js` / `battle-service.js` | ✅ Done 2026-07-08 in core commit `6a9e3d8`: moved as `createMushroomBattleEnginePort()` and `createMushroomBattleServicePort()` under the quarantined Mushroom gameplay port, backed by injected catalog, RNG, validation, portrait, query, ID, and clock providers. | Character ability tuning, artifact effect metadata, portrait policy, replay SQL/table contract, and Mushroom narration/copy stay quarantined until repository/config contracts are neutral. |
| `app/server/services/shop-service.js` | ✅ Done 2026-07-08 in core commit `bee8d43`: moved as `createMushroomShopServicePort()` under the quarantined Mushroom gameplay port, backed by injected transaction, lock, catalog, pricing, pity, progression, loadout-row, clock, RNG, and run-currency providers. | Current run-shop SQL/table contract, error text, and compatibility response aliases stay quarantined until repository contracts are neutral. |
| `app/server/services/game-service.js` | ✅ Done 2026-07-08 in core commit `de56ec8`: moved as `createMushroomGameServicePort()` under the quarantined Mushroom gameplay port, backed by injected query, player-state, run history, battle history, daily-limit, home-field, asset-pack, runtime-catalog, gacha-toggle, and direct-buy policy providers. | Product bootstrap shape, legacy active-run aliases, selected character semantics, and concrete table/query contracts stay quarantined until repository contracts are neutral. |
| `app/server/services/run-service.js` | ✅ Done 2026-07-08 in core commit `fd78ad7`: moved as `createMushroomRunServicePort()` under the quarantined Mushroom gameplay port, backed by injected DB, transaction, catalog, shop, battle, loadout, fusion, season, wallet, asset, clock, ID, RNG, and lock providers. | Current run SQL/table contract, challenge semantics, reward/rating writes, season award persistence, wallet grant execution, ghost snapshot policy, and public API compatibility aliases stay quarantined until repository contracts are neutral. |
| `app/server/services/player-service.js` | ✅ Done 2026-07-08 in core commit `db3d77d`: moved as `createMushroomPlayerServicePort()` under the quarantined Mushroom gameplay port, backed by injected DB, transaction, catalog, wallet, asset, season, clock, ID, bot-loadout, and run-challenge providers. | Product profile/social table contracts, friend/challenge route semantics, compatibility fields, selected character semantics, and portrait/preset policy stay quarantined until repository contracts are neutral. |
| `app/server/services/wallet-service.js` | ✅ Done 2026-07-08 in core commit `c0c6111`: moved as `createMushroomWalletServicePort()` under the quarantined Mushroom economy port, backed by injected DB, transaction, ID, clock, JSON, env, and fetch providers. | Current wallet/payment SQL table contract, provider setup/env semantics, Telegram/BTCPay/NOWPayments lifecycle, webhook replay storage, settlement reconciliation, mirror policy, paid rollback, and public API compatibility aliases stay quarantined until repository/provider contracts are neutral. |
| `app/server/services/asset-service.js` | ✅ Done 2026-07-08 in core commit `1841f73`: moved as `createMushroomAssetServicePort()` under the quarantined Mushroom economy port, backed by injected DB, transaction, portrait catalog, wallet, mutation-claim, ID, clock, JSON, and env providers. | Current profile-asset/gacha SQL table contract, portrait catalog/content, runtime pack visibility, secure RNG source, wallet debit execution, mutation-claim scope semantics, direct-buy/gacha env policy, support/admin policy, and compatibility mirrors stay quarantined until repository/policy contracts are neutral. |
| gacha-admin/support/settlement services | Later ports after repository, payment, gacha-admin, and support-operation policy contracts exist. | Provider SDKs/callbacks, SQL transactions, audit, support scopes, paid rollback, adult-content/payment policy. |

Shared split:

| Current shared area | Extraction direction | Keep product-owned |
| --- | --- | --- |
| `artifact-fusions.js` | ✅ Done 2026-07-07 in core commit `5370733`: recipe normalization, lookup, result/ingredient summaries, ingredient-policy helpers, and evaluator factory moved to `@microwavedev/backpack-game-core/artifact-fusion-recipes` and `modules/fusion`. | Mushroom authored recipe data, artifact ids, balance, and unlock policy stay in the wrapper. |
| `artifact-visual-classification.js` | ✅ Done 2026-07-07 in core commit `433e2f5`: classifier engine, taxonomy schema, fallback factory, owner adapter, and footprint helper moved to `@microwavedev/backpack-game-core/artifact-visual-classification`. | Mushroom visual labels, prompts, shine tiers, generated-art assumptions, CSS taxonomy, and legacy owner mapping stay in the wrapper. |
| `run-achievements.js` / `.json` | ✅ Done 2026-07-08 in core commit `bb49947`: evaluator engine, localized DTO decoration, award pacing, priority hooks, character adapter, and earned/new result shaping moved to `modules/season`. | Definitions, thresholds, badge art, copy, season tuning, and Mushroom `mushroomId` compatibility stay in the wrapper/content. |
| `season-levels.js` / `.json` | ✅ Done 2026-07-08 in core commit `bb49947`: progression calculators, point breakdowns, level lookup, reward fallback, and display DTO helpers moved to `modules/season`. | Level tables, rank art, copy, reward tuning, current-season metadata, and product scheduling stay in the wrapper/content. |
| image metadata JSON and `home-field/**` | Product-local by default; `content/mushroom` quarantine only if packaging demands it. | Generated art, provenance, prompts, review sheets, final art ownership. |
| `config.js` | Shared default/config schema helpers. | Product constants, labels, route names, theme ids, env-derived settings. |
| `repo-root.js` | Keep local unless a generic package-root helper is needed. | Workspace/script assumptions. |

## Frontend Inventory Refresh, 2026-07-06

This refresh is the current source of truth before any further page-shell move.
The shipped frontend-core surface is no longer only primitives: it now includes
neutral replay page structure as well as reusable cards, grids, logs, gacha
widgets, prep zones, and the reduced-motion composable. Product repos still own
route composition, API calls, stores, local persistence, Telegram wrappers,
final CSS, product catalogs, image paths, generated art, and localization.

### Already Core-Backed In Mushroom

| Mushroom file | Current status | Product-owned adapter work that remains |
| --- | --- | --- |
| `web/src/components/AchievementBadge.js` | Direct re-export of core `AchievementBadge`. | Badge image assets, achievement definitions, and season progress stay local. |
| `web/src/components/SeasonRankEmblem.js` | Direct re-export of core `SeasonRankEmblem`. | Rank image assets and season scoring stay local. |
| `web/src/components/ArtifactStatSummary.js` | Core `ArtifactStatSummary` wrapped with Mushroom stat labels and role classes. | Mushroom stat names, role colors, and bonus formatting stay local. |
| `web/src/components/ArtifactFigure.js` | Uses core `ArtifactTile` and `shapeArtifactTileDisplay`. | Hardcoded artifact glyphs, bitmap paths, visual taxonomy, and bag-shape adapters stay local. Do not move as-is. |
| `web/src/components/ArtifactGridBoard.js` | Delegates board layers to core `BackpackGrid` and core board DTO helpers. | Grid constants, bag watermark offsets, placement events, local `ArtifactFigure`, and product classes stay local. |
| `web/src/components/FighterCard.js` | Wraps core `FighterCard`. | `mushroom` compatibility prop, local `ArtifactGridBoard`, and product combatant naming stay local. |
| `web/src/components/ArtifactCatalogBrowser.js` | Wraps core `ArtifactCatalogBrowser`. | Catalog grouping/sorting, fusion recipes, local artifact grids/stats, localized copy, and CSS stay local. |
| `web/src/pages/RecipesScreen.js` | Wraps core `CatalogPageScreen` around the local artifact catalog browser. | Recipe copy and catalog browser wiring stay local; the page frame is generic. |
| `web/src/components/ReplayDuel.js` | Wraps core `ReplayDuel`. | Combatant shaping, artifact lookup, loadout projection, visual effects, attribution copy, local fighter/grid rendering stay local. |
| `web/src/pages/ReplayScreen.js` | Wraps core `ReplayScreen`. | Replay timeline state, route events, reward/currency DTOs, combatant DTOs, and local `ReplayDuel` stay local. |
| `web/src/components/prep/RunHud.js` | Wraps core `RunHud`. | Run-currency icon/name and Mushroom state mapping stay local. |
| `web/src/components/prep/SellZone.js` | Wraps core `SellZone`. | Drag state and sell-price copy stay local. |
| `web/src/components/prep/PrepActions.js` | Wraps core `PrepActions`. | Challenge mode, ready/abandon route events, and labels stay local. |
| `web/src/components/prep/FusionReveal.js` | Wraps core `FusionReveal`. | Artifact lookup, local `ArtifactFigure`, result labels, and reveal queue ownership stay local. |
| `web/src/components/prep/BackpackZone.js` | Wraps core `BackpackZone`. | Container artifacts, fusion highlights, artifact names, local grid rendering, and placement events stay local. |
| `web/src/components/prep/InventoryZone.js` | Wraps core `InventoryZone`. | Active-bag chips, placement preview, stat/footer slots, local grids/stats, and drag events stay local. |
| `web/src/components/prep/ShopZone.js` | Wraps core `ShopZone` plus core `shapeShopItemRows`. | Prices, budget, catalog descriptions, fusion classes, sell-zone bridge, local previews, and route events stay local. |
| `web/src/pages/PrepScreen.js` | Wraps core `PrepScreen` layout shell with slots for existing prep zones and uses core `shapePrepScreenViewState` for neutral prep selectors. | Drag/drop events, shop actions, ready/abandon events, fusion reveal queue mutation, and product grid/art rendering stay local. |
| `web/src/components/HomeSocialSidebar.js` | Uses core `RecipeList`; other structure remains local. | Telegram sharing, friends/challenges, activity panels, local artifact previews, and social navigation stay local. |
| `web/src/pages/FusionAnimationLabScreen.js` | Uses core `RecipeCard` / `RecipeList`. | Lab playback state, Mushroom recipe catalog, artifact lookup, local reveal/grid/stat rendering stay local. |
| `web/src/pages/HomeScreen.js` | Uses core `AssetRollResultPanel`, `GachaPackCardList`, and wallet/gacha DTO helpers. | Home route orchestration, character carousel, wallet checkout calls, asset roll actions, social sidebar, and product copy stay local. |
| `web/src/pages/SupportAdminScreen.js` | Uses core gacha-admin DTO helpers and `GachaOddsTable`. | Admin credentials, support/gacha API calls, uploads, persistence, operator policy, and page layout stay local. |

### Composables And Helpers

| File | Current status | Next action |
| --- | --- | --- |
| `web/src/composables/useReducedMotion.js` | Compatibility wrapper around core `createReducedMotionTracker` / `bindReducedMotionTracker`. | No move needed. |
| `web/src/composables/loadout-projection.js` | Thin bridge to core `projectLoadoutItems` and `prepareGridProps`. | Keep wrapper until all Mushroom imports can use package names directly. |
| `web/src/helpers/grid-cell-classification.js` | Thin bridge to core grid-cell classification helpers. | Keep wrapper for local import stability. |
| `web/src/composables/useReplay.js` | Partially delegates replay speed/timeline/state shaping to core view-model helpers. | Further extraction needs injected API client, timer hooks, navigation callbacks, and product event formatting. |
| `web/src/composables/useGameRun.js` | Partially delegates run response patching to core view-model helpers. | Further extraction needs route adapter, haptics adapter, bootstrap refresh policy, and product replay navigation. |
| `web/src/composables/useCustomization.js` | Partially delegates wallet/asset response shaping to core view-model helpers. | Further extraction needs wallet checkout adapter, Telegram invoice handling, and product asset catalog policy. |
| `web/src/composables/useGameState.js` | Uses core stat delta/loadout text helpers. | Further extraction needs a product state factory and locale/catalog adapters. |
| `web/src/composables/useAuth.js` | Product-local. | Keep local until shared auth/client service receives injected storage, route map, Telegram adapter, bootstrap adapters, and local-app/server-mode policy. |
| `web/src/composables/useShop.js` | Product-local orchestration delegating effective rows, placement previews, and place/move/activate/deactivate/move-bag/rotate-bag command plans through core. | Remaining extraction is sell/refresh purchase policy, ready/abandon action planning, and API-backed persistence adapters; haptics, API calls, persistence, and local error copy stay local. |
| `web/src/composables/useTouch.js` | Product-local touch/drag state. | Candidate only after grid/drop controller contracts are core-owned. |
| `web/src/composables/useSSE.js` | Product-local routing and event stream lifecycle. | Keep local; server/community mode will affect this boundary. |
| `web/src/composables/useSocial.js` | Product-local friends/challenges API wrapper. | Keep local until community-client surfaces are shared. |
| `web/src/composables/useTelegramWebApp.js` and `web/src/helpers/telegram-links.js` | Product-local Telegram integration. | Keep local; Telegram is not a core dependency. |
| `web/src/composables/useDevTools.js` | Product-local local-dev fixtures. | Keep local. |

### Page Shell Classification

| Page | Classification | Reason |
| --- | --- | --- |
| `ReplayScreen.js` | Extracted neutral shell with Mushroom adapter. | Core owns structure; Mushroom owns replay state, route events, and fighter rendering. |
| `RecipesScreen.js` | Extracted generic catalog page shell with Mushroom adapter. | Core owns only the generic cover/content frame; Mushroom owns recipe copy and catalog browser wiring. |
| `PrepScreen.js` | Outer layout shell extracted; first headless selector and mutation-planner contracts extracted. | Core owns the topbar/workspace/reconnecting/actions/overlay slots, bag-row/effective-row selectors, placement previews, refresh-cost labels, sell-price labels, and neutral prep command plans. Full run API persistence, haptics, fusion reveal queue mutation, product grid/art rendering, local errors, and route events remain local until API adapters exist. |
| `RunCompleteScreen.js` | Adapter-needed. | Needs run-complete DTO helpers for season points, achievements, rewards, actions, and product rank/badge assets before shell extraction. |
| `RunSummaryScreen.js` | Adapter-needed. | Needs summary DTO helpers and route callbacks for replay loading; product character assets and outcome copy stay local. |
| `HomeScreen.js` | Adapter-needed, high risk. | Mixes profile, wallet, gacha, character selection, social sidebar, run actions, asset rolls, and product art. Split smaller panels first. |
| `ProfileScreen.js` | Adapter-needed. | Uses achievements/ranks and player/profile share data; can move after profile DTO helpers and generic badge/rank panels exist. |
| `AuthScreen.js` | Product-specific for now. | Telegram, browser-code/dev login, local storage, and Mushroom portrait marketing make it app-owned. |
| `CharactersScreen.js` and `OnboardingScreen.js` | Product-specific for now. | Character roster, portraits, and onboarding copy are product identity. A future generic roster shell is possible with injected cards. |
| `FriendsScreen.js` and `LeaderboardScreen.js` | Community-shell candidates. | Keep local until shared community client and DTO contracts cover leaderboard/friend/challenge payloads. |
| `SettingsScreen.js` | App shell candidate. | Small enough to move later, but it depends on product settings keys and persistence. |
| `SupportAdminScreen.js` | Product-specific page with core widgets. | Keep route/auth/storage/uploads/operator policy local; extract only more widgets/DTO helpers. |
| `WikiScreen.js`, `WikiDetailScreen.js`, `HomeFieldPreviewScreen.js` | Product-specific. | Lore/wiki/home-field assets and rendering are Mushroom content, not backpack core. |

### Next Frontend Moves

1. Do not move another page until the page has a DTO/adapter contract similar
   to `ReplayScreen`.
2. First headless prep controller slice is complete in core commit `3f5f76b`:
   neutral bag rows, effective rows, disabled-cell checks, first-fit bag
   anchors, placement previews, refresh-cost labels, and sell-price labels now
   live in core and are consumed by Mushroom.
3. First prep mutation-planner slice is complete in core commit `e027bd3`:
   place from container, move placed item, activate/deactivate bag, move active
   bag, and rotate bag now return neutral next-array plans consumed by
   Mushroom. Next prep work should extract sell/refresh and ready/abandon
   action planners plus API persistence adapters while keeping haptics, local
   errors, and route events in products.
4. Continue extracting smaller Home/Profile/RunComplete panels before moving
   those pages wholesale.

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
- Product DB clients, migrations, repositories, auth, rate limits, support
  storage, payment providers, uploaded image storage, and final route/page
  assembly stay in each game. The moved Mushroom model definitions are a
  quarantine package, not product runtime ownership.

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
| Artifact family capability helpers | `backpack-game-core/src/artifact-capabilities.js`; Mushroom adapter in `app/server/services/artifact-helpers.js` | Extracted configurable pure slice | Core owns default backpack family capabilities, configurable family maps, bag-family detection, combat/stat contribution checks, and container-placement helpers. Product catalogs and item family assignment stay local. |
| Artifact visual classification | `backpack-game-core/src/artifact-visual-classification.js`; Mushroom adapter in `app/shared/artifact-visual-classification.js` | Extracted configurable shared slice | Core owns role/shine/stat/owner/footprint classification and prompt/CSS metadata assembly over injected role classes, shine tiers, owner lookup, and shape hooks. Mushroom keeps its visual taxonomy, prompts, generated-art assumptions, CSS labels, and legacy `mushroomId` owner adapter local. |
| Grid placement primitives | `backpack-game-core/src/grid-geometry.js`; validation uses `backpack-game-core/src/loadout-validation.js` through the Mushroom adapter | Extracted pure slice | `pieceCells`, `cellSet`, `setsIntersect`, and `cellKey` are pure and shared by server/client through package imports. Catalog-backed grid/bag/loadout policy is injected into the core validator from Mushroom code. |
| Full loadout validation | `backpack-game-core/src/loadout-validation.js`; `backpack-game-core/src/modules/loadout/validation-service.js`; Mushroom adapter in `app/server/services/loadout-utils.js` | Extracted with product config and service factory | Core owns flat-grid bounds/overlap validation, active-bag placement, bag coverage, budget summing, stat totals, orchestrated loadout validation, provider-driven service factory, and server module registration. Mushroom injects artifact lookup, pricing, family semantics, grid constants, and stat caps. |
| Seeded RNG and shuffle | `backpack-game-core/src/rng.js`; Mushroom string-seed adapter in `app/server/lib/utils.js`; compatibility re-export in `app/server/services/battle-engine.js` | Extracted with product seed hashing | Core owns the browser-safe numeric-seed RNG state machine, integer rolls, and non-mutating shuffle. Mushroom keeps Node `crypto` string hashing for existing deterministic seed inputs. |
| Fusion matching and recipe helpers | `backpack-game-core/src/fusion-matching.js`; `backpack-game-core/src/artifact-fusion-recipes.js`; Mushroom wrapper and recipes in `app/shared/artifact-fusions.js` | Extracted with product recipes and policy | Core owns adjacency search, duplicate row consumption, match shaping, `fusionIngredientRowIdSet`, recipe normalization/lookup/result summaries, ingredient policy helpers, and product-configurable evaluator factories. Mushroom keeps authored recipe data, artifact ids, balance/unlock policy, and compatibility path local. |
| Fusion application | `backpack-game-core/src/server/ports/mushroom/gameplay/artifact-fusion-service.js`; Mushroom wrapper in `app/server/services/artifact-fusion-service.js` | Quarantined port | Core now owns the moved between-round fusion application and reveal-row shaping behind injected query, catalog, fusion matcher, loadout row mutation, clock, and ID providers. The `game_run_fusions` SQL/table contract is still temporary quarantine; product repositories should replace it before this graduates to a stable cross-game module. |
| Season scoring and run achievements | `backpack-game-core/src/modules/season`; Mushroom wrappers in `app/shared/season-levels.js` and `app/shared/run-achievements.js` | Extracted configurable shared slice | Core owns scoring, point breakdowns, level/progress summaries, reward fallback, achievement matching, priority ordering, localized DTO decoration, and earned/new result shaping over injected levels, achievements, rank policy, and character adapters. Mushroom keeps authored JSON, badge/rank assets, current-season metadata, copy, reward tuning, and legacy `mushroomId` compatibility local. |
| Season progress persistence | `backpack-game-core/src/server/ports/mushroom/gameplay/season-service.js`; Mushroom wrapper in `app/server/services/season-service.js` | Quarantined port | Core owns the moved season-run/progress/achievement grant workflow behind injected scoring, achievement, clock, and ID helpers. The `player_season_*` and `player_achievements` SQL/table contract remains temporary quarantine until repository contracts replace it. |
| Shop offer generation and run lifecycle state plans | `backpack-game-core/src/shop-offer.js`; `backpack-game-core/src/run-lifecycle.js`; Mushroom adapters in `app/server/services/shop-service.js` and `app/server/services/run-service.js`; Meat adapter in `app/server/meat-service.js` | Extracted with product config and DTO shaping | Core owns deterministic pool sampling, bag pity, bag chance escalation, character-item slot reservation, buy/refresh/sell run-currency + offer-state plans, run start drafts, starter loadout drafts, initial/next shop state, ghost budget math, round reward/counter/end-state plans, challenge group-completion decisions, and provider-driven run-state summary DTO shaping. Mushroom passes combat pools, bag pools, eligible character items, generated offers, starter presets, balances, reward tables, and run config. Meat passes compact loadout totals/cost and shop row formatting providers. |
| Run/shop mutations | `startGameRun`, `resolveRound`, `createChallengeRun`, `resolveChallengeRound`, `buyRunShopItem`, `refreshRunShop`, `sellRunItem` in product services | Adapter over core planners | Core plans pure state transitions; DB transactions, run locks, persisted shop states, loadout rows, refunds, route errors, catalog lookup, player/mushroom selection, daily limits, rewards execution, rating, season/achievement grants, ghost selection, and challenge matching stay in product service code. |
| Bot loadout generation | `backpack-game-core/src/backpack-loadout.js`; Mushroom wrapper in `app/server/services/bot-loadout.js` | Extracted with product providers | Core owns weighted-pick, first-fit bag placement, rectangular item placement, occupied-cell tracking, and retry orchestration. Mushroom passes artifacts, affinities, presets, prices, grid constants, RNG, validation, and keeps ghost snapshot/portrait glue local. |
| Battle simulation and replay service port | `backpack-game-core/src/battle-simulation.js`; `backpack-game-core/src/server/ports/mushroom/gameplay/battle-engine.js`; `backpack-game-core/src/server/ports/mushroom/gameplay/battle-service.js`; Mushroom wrappers in `app/server/services/battle-engine.js` and `app/server/services/battle-service.js` | Stable simulator plus quarantined Mushroom ports | Core owns the stable deterministic 1v1 turn loop, action/skip event sequencing, HP/stun flow, speed/base-speed tiebreak fallback, step-cap winner resolution, and result shaping. Core also temporarily owns the moved Mushroom battle engine/service ports behind injected providers. Mushroom still supplies catalog/tuning adapters and keeps ability naming, artifact replay metadata, portrait policy, SQL replay/history contracts, and narration/copy quarantined until repository/config contracts are neutral. |
| Wallet accounting and purchase lifecycle | `backpack-game-core/src/wallet-accounting.js`; `backpack-game-core/src/modules/wallet/settlement-adapters.js`; `backpack-game-core/src/server/ports/mushroom/economy/wallet-service.js`; Mushroom adapters in `app/server/services/wallet-service.js` and `app/server/services/provider-settlement-adapters.js` | Stable planners plus quarantined port | Core owns balance math, transaction draft shaping, purchase intent drafts, checkout DTO/metadata patch shaping, checkout resolved-state checks, completion grant planning, purchase grant/reversal mutation shaping, status classification, price matching, settlement invariants, generic settlement CSV/JSON parsing, scoped field lookup, configurable record mapping, and the moved Mushroom wallet/payment lifecycle port. The moved port still preserves Mushroom SQL rows, locks, provider field maps, provider SDK calls, webhooks, invoice polling, reconciliation storage, and operations behavior behind injected providers until repository/provider contracts are neutral. Support actions, adult-content policy, and operations runbooks stay local. |
| Payment providers and purchase webhooks | `app/server/services/provider-settlement-*`, `bot-gateway.js`, payment routes | Product-specific with generic parser adapter | Telegram Stars, BTCPay, NOWPayments, provider signatures, invoice lookups, tax/accounting, adult-content policy, provider field maps, and settlement records are game/ops concerns. Core only owns the provider-neutral input parsing/adapter registry used by the local settlement adapter wrapper. |
| Auth session response envelopes | `backpack-game-core/src/modules/auth/index.js`; Mushroom adapter in `app/server/create-app.js`; Meat adapter in `app/server/meat-service.js` | Extracted response shaper | Core owns public auth user field normalization plus login/session/logout response envelope shaping over already-authenticated product rows. Games keep Telegram verification, dev-login policy, session storage, auth-code lifecycle, request middleware, player lookup, and product identity rules local. |
| Support lookup and mutation services | Core `src/modules/support/index.js` plus `src/server/ports/mushroom/economy/support-money-service.js` and `support-ops-service.js`; Mushroom wrappers under `app/server/services/`; Meat adapter in `app/server/meat-service.js` | Response shapers and quarantined server ports extracted | Core owns support lookup expansion, wallet/asset/refund operation orchestration, action listing, and result shaping over injected persistence, wallet, asset, audit, ID, clock, and JSON providers. Mushroom and Meat keep token/scoped-operator and approval policy, route registration, concrete audit writes, and product-specific support exposure local. |
| Runtime config validation summaries | `backpack-game-core/src/modules/config/index.js`; Meat adapters in `app/server/config.js` and `app/server/check-deploy-config.js` | Extracted response/CLI shaper | Core owns issue normalization, validation result DTOs, assertion error formatting, and deploy-check summary lines. Games keep env parsing, required fields, product policy, provider availability, Node/runtime choices, and deploy commands local. |
| Mushroom Sequelize model definitions | `backpack-game-core/src/server/models/mushroom`; Mushroom wrapper in `app/server/models/index.js` | Quarantined model package | Core now owns the moved model definition functions and `initModels()` association setup. Games still own Sequelize instance creation, Postgres/SQLite dialect config, sync/backfill logic, indexes beyond model metadata, queries, transactions, and migrations. This package should either become neutral schema descriptors or be hidden behind product repositories before it is treated as stable cross-game persistence API. |
| Asset catalog, ownership, equipment, and direct-buy policy | `backpack-game-core/src/profile-asset-state.js`; `backpack-game-core/src/server/ports/mushroom/economy/asset-service.js`; Mushroom wrapper in `app/server/services/asset-service.js`; profile asset tables and runtime catalogs | Stable planners plus quarantined port | Core owns reusable profile asset state shaping, ownership maps, equip validation, purchase spend parameters, instance drafts, portrait variant projection, purchase/equip result DTOs, grant summaries, and the moved Mushroom runtime catalog/direct buy/equip workflow behind injected DB, portrait, wallet, mutation-claim, clock, ID, JSON, and env providers. The current table contract, portrait content, support/admin policy, paid rollback behavior, direct-buy/gacha env policy, and compatibility mirrors remain quarantined until repository/policy contracts are neutral. |
| Gacha pack validation, rolling, duplicates, burn, pity, and simulation | `backpack-game-core/src/asset-gacha.js`; `backpack-game-core/src/modules/gacha/simulation-service.js`; `backpack-game-core/src/server/ports/mushroom/economy/asset-service.js`; Mushroom wrappers in `app/server/services/asset-service.js` and `app/server/services/gacha-simulation-service.js`; admin validation helpers | Stable planners plus quarantined roll/burn port | Core owns pack/item validation, candidate filtering, weighted slot selection, duplicate copy caps, burn target policies, pity/guarantees, odds simulation, provider-driven simulation service shape, server module registration, result DTO shaping, roll settlement planning, duplicate-burn settlement planning, grant drafts, evidence metadata, admin DTO/view-model helpers, and the moved Mushroom runtime roll/burn/odds execution flow behind injected providers. Secure RNG source, wallet debit execution, asset grant SQL, pack storage SQL, mutation-claim policy, static/runtime pack lookup policy, plan visibility policy, and operator audit records remain quarantined. |
| Mutation claim service | `backpack-game-core/src/server/modules/mutation-claim.js`; Mushroom wrapper in `app/server/services/mutation-claim-service.js` | Extracted repository-backed server helper | Core owns claim acquire/reclaim/wait/release orchestration over injected repository, clock, ID, sleep, and error adapters. Mushroom keeps the concrete `mutation_claims` table/query, env timing policy, mutation scope names, and route/service usage local. |
| Server module registry, route descriptors, readiness, and mutation middleware | `backpack-game-core/src/server/*`; Mushroom adapters in `app/server/lib/*`, `app/server/services/ready-manager.js`, and `app/server/services/mutation-claim-service.js` | Extracted infrastructure slice and module factory | Core now owns a lightweight module descriptor/context setup facade, framework-neutral route descriptors/groups/binding helpers, reusable idempotency and token-bucket rate-limit middleware, configurable run readiness state, idle-run detection, keyed async mutexes, repository-backed mutation claims, and module-list registration for the readiness manager. Mushroom keeps route mounting, auth middleware attachment, active-run DB lookups, challenge resolution, SSE sends, claim table wiring, and existing local import paths as adapters; Meat imports the same server surface in its core-consumption test. App bootstrap, provider SDKs, payment/webhook modules, migrations, and concrete DB runtime behavior stay local. |
| Shared frontend DTO/view-model shaping | `backpack-game-core/src/client-view-model.js`; Mushroom composables/pages/components | Extracted DTO baseline and neutral Vue primitive layer | Core owns many browser-safe transforms for loadout projection, shop/run/replay response state, wallet/gacha status, asset pack summaries, admin rows, grid/stat helpers, artifact stat-row DTOs, shop item row DTOs, board render rows, replay rows, artifact tile display contracts, pack card rows, odds table sections, and roll-result panel DTOs. Core also owns the first neutral Vue component layer: roll-result panels, odds tables, gacha pack cards, artifact tiles, stat summaries, shop rows/lists, backpack grids, battle logs, achievement badges, and season-rank emblems. |
| Frontend port inventory and reduced-motion composable | `backpack-game-core/src/vue/composables/*`; Mushroom adapter in `web/src/composables/useReducedMotion.js` | First aggressive frontend-port slice | F1 found that most components/pages still need DTO, route, locale, asset, and CSS adapters before page-shell moves. The first safe F2 slice moved the neutral reduced-motion tracker into core while Mushroom keeps settings/CSS attachment local and Meat verifies the export. |
| Server module inventory and contract | `backpack-game-core/src/server/index.js`; `docs/server-module-contract.md`; Mushroom server files audited in S1; `backpack-game-core/src/server/ports/mushroom/gameplay`; `backpack-game-core/src/server/ports/mushroom/economy`; `backpack-game-core/src/server/ports/mushroom/platform` | Contract implemented, gameplay/economy/platform quarantine expanded | Core now has route descriptors and a quarantine strategy. Gameplay/profile services live under `src/server/ports/mushroom/gameplay`; wallet, asset, gacha-admin, support, provider-settlement, and wallet-ops services live under `src/server/ports/mushroom/economy`; auth/session/auth-code behavior and the adapterized Telegram bot gateway live behind factories in `src/server/ports/mushroom/platform`; mutation claims live in the stable server facade. Remaining Mushroom server work is wiki module extraction and coherent route sections from `create-app.js`. `social-preview-cache.js` is already a thin adapter over the stable core service. Product apps keep concrete DB/model/migration implementations, transactions, provider callbacks, credentials, middleware order, static file serving, deploy config, realtime/SSE delivery, and product catalogs. |
| Backpack grid, artifact tile, and shop UI | `web/src/components/*Prep*`, `web/src/artifacts/render.js`, `web/src/helpers/grid-cell-classification.js`, Meat `src/main.js` prototype | Frontend-core candidate | Grid classification, cell rendering, artifact figure/tile presentation, shop offer rows, price/budget badges, and placement affordances are common backpack UI primitives. Product themes, copy, item art paths, and route actions stay in each game. |
| Battle replay/log UI | Mushroom replay components/pages and Meat battle panel | Frontend-core candidate | Battle timeline rendering, event filtering, combatant stat panels, outcome badges, and playback state are reusable over core battle events. Product narration text, character art, share routes, and replay persistence stay local. |
| Wallet, asset inventory, and gacha UI | Mushroom asset/portrait/gacha screens, support asset widgets, Meat future inventory/gacha screens | Frontend-core candidate | Wallet balance display, asset inventory/equipment panels, gacha pack cards, roll result modals, duplicate/burn state panels, odds tables, and asset policy labels can be shared with product API/copy/theme adapters. Payment provider selection, adult-content gates, and purchase routes stay local. |
| Gacha admin service, UI, and season-plan image storage | Core `src/server/ports/mushroom/economy/gacha-admin-service.js`; Mushroom wrapper in `app/server/services/gacha-admin-service.js`; `/support-admin`, `/gacha-plan` assets | Server port extracted; frontend/admin route split remains | Core now owns fixture import/export, season/collection/pack/plan-item orchestration, promotion, simulation, release checks, and audit-action construction over injected DB, audit, catalog, wallet-currency, env, clock/ID/JSON, and image-storage providers. Mushroom keeps filesystem paths, token-gated routes, operator permissions, Express wiring, and product copy. Neutral admin view-models/components remain a frontend extraction candidate. |

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
10. Neutral frontend primitive pack cards, odds tables, and roll-result panels:
    implemented in core commits `be41855`, `ebc74d2`, and `6d9faeb`.
    Mushroom delegates home
    pack cards, support-admin odds table sections, and home roll-result panel
    metadata through `client-view-model`; Meat consumes the same DTOs in its
    prototype wrappers.
11. Neutral Vue component layer: implemented in core commits `006ab33`,
    `953fa1e`, `6e7c1fb`, `cdba5a7`, `cbb9f18`, `be03e50`, `5dd01f1`,
    and `471e686`.
    Mushroom now delegates roll-result panels, odds tables, gacha pack cards,
    artifact tiles, artifact stat summaries, shop item rows/lists, backpack
    grids, battle logs, achievement badges, and season-rank emblems through
    core components while keeping routes, copy, image asset ownership, role
    color maps, haptics, page shells, and themes local; Meat imports the same
    component surface in its
    core-consumption smoke test. The first Phase 8AW component candidate list
    is complete.
12. Shared server infrastructure surface: implemented in core commit
    `5dd01f1` with `./server` and `./server/middleware` exports, then expanded
    in core commit `471e686` with run readiness and keyed async mutex helpers,
    and expanded again in core commit `c166e28` with framework-neutral route
    descriptors, route groups, descriptor flattening, and adapter-driven route
    binding.
    Mushroom delegates idempotency, rate-limit middleware, challenge ready
    state, idle-run detection, and run locks through local adapters while
    keeping route mounting, auth, DB transactions, product services, payment
    providers, support permissions, SSE sends, and webhooks local; Meat verifies
    the module registry, middleware, readiness, and mutex imports in its
    core-consumption test.

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
