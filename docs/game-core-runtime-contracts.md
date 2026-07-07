# Game Core Runtime Contracts

**Status:** Current reference for the reusable-core boundary after Phase 6A-6C.
This document describes shipped behavior, not future design. Use it before
moving code into `backpack-game-core`.

## Source Of Truth

- Requirements: `docs/game-requirements.md`
- Wallet / asset / gacha tests: `tests/game/wallet-assets.test.js`
- Run currency alias tests: `tests/game/game-run.test.js`,
  `tests/game/round-resolution.test.js`
- Character XP alias tests: `tests/game/mushroom-progression.test.js`
- Core extraction plan: `docs/profile-currency-and-core-extraction-plan.md`

## Architecture Precedent

The 2026-07-04 Geesome review is the local model for the next core boundary:

- `geesome-libs` shows the shared client/helper layer.
- `geesome-ui` shows that reusable frontend services, pages, components,
  assets, and locale can live outside the product app.
- `geesome-node` shows backend feature modules with explicit interfaces,
  module factories, API binding, and module-local helpers.

Backpack should adopt that layering with one correction: public package exports
and type declarations are mandatory. Mushroom and Meat should not import
private `src/*` paths, nested submodule paths, or package internals. Frontend
code should go through a shared client/composable layer that receives product
auth, storage, routes, copy, theme, and catalog adapters.

## Currency Ledgers

Mushroom Battles has three separate ledgers. They must not collapse into one
service or field when extracting reusable mechanics.

### Temporary Run Currency

Temporary run currency is scoped to one `game_run_players` row. The legacy DB
column is `game_run_players.coins`; backend payloads keep `coins` for the
existing Mushroom client and also expose `runCurrency` and `runCoins`.

Current code anchors:

- `app/server/lib/utils.js`: `runCurrencyFields(coins)`
- `app/server/services/run-service.js`: run player payload shaping
- `app/server/services/shop-service.js`: buy, refresh, and sell responses

Rules:

- Run currency buys only run artifacts.
- Run currency pays run-shop refresh costs.
- Selling run items refunds only run currency.
- Run currency cannot buy profile assets, skins, packs, or wallet bundles.
- Profile wallet currency cannot buy run artifacts or refresh the run shop.

Requirement anchors:

- `[Req 4-A]` through `[Req 4-I]` for run income and shop spends.
- `[Req 4-X]` for run currency vs profile wallet separation.

Test anchors:

- `tests/game/game-run.test.js`
- `tests/game/round-resolution.test.js`
- `tests/game/bridge-pin.test.js`

### Profile Wallet Currency

Profile wallet currency is user-profile scoped. The wallet tables are the
source of truth; `players.spore` remains a compatibility mirror for the default
wallet balance.

Current code anchors:

- `app/server/services/wallet-service.js`
- `vendor/backpack-game-core/src/server/models/mushroom/PlayerWalletBalance.js`
- `vendor/backpack-game-core/src/server/models/mushroom/PlayerWalletTransaction.js`
- `vendor/backpack-game-core/src/server/models/mushroom/WalletPurchaseIntent.js`
- `app/server/models/index.js`: compatibility wrapper for model registration
- `app/server/bot-gateway.js`
- `app/server/create-app.js`

Rules:

- Wallet grants and spends go through wallet service functions.
- Wallet spends use an atomic balance update and must reject overdrafts.
- Wallet mutations are serialized per player in-process today.
- Purchase intents are provider-neutral and only grant wallet currency after
  server-side provider verification.
- Provider callback handlers must be idempotent; completing the same purchase
  twice must not double-grant currency.
- Telegram Stars is the Telegram Mini App payment rail; BTCPay and NOWPayments
  are external web checkout rails.
- Crypto payment completion validates amount/currency when provider data is
  available.
- Non-completed terminal provider statuses are recorded without granting wallet
  currency.

Requirement anchors:

- `[Req 4-Y]` for profile-scoped wallet behavior.
- `[Req 4-Z]` for purchase intents and provider verification.

Test anchors:

- `tests/game/wallet-assets.test.js`

Non-core boundary:

- Wallet storage, payment providers, webhook signatures, Telegram bot payment
  handling, refund/reversal operations, and support/terms/compliance gates stay
  in `mushroom-master` or product/payment adapters. They are not first-pass
  `backpack-game-core` mechanics.

### Character XP

Character XP is character-bound progression. The legacy DB vocabulary is still
`mycelium`, but reusable code should prefer `characterXp`.

Current code anchors:

- `app/server/lib/utils.js`: `CHARACTER_XP_LEVEL_CURVE`,
  `computeCharacterLevel(characterXp)`, plus legacy aliases
  `MYCELIUM_LEVEL_CURVE` and `computeLevel(mycelium)`
- `app/server/services/player-service.js`: progression payloads expose both
  `mycelium` and `characterXp`
- `app/server/services/run-service.js`: round result progress uses the neutral
  helper while DB columns remain legacy

Rules:

- Character XP controls level, tier, wiki unlocks, starter preset unlocks, and
  character shop-item eligibility.
- Character XP is not spendable currency.
- Character XP must not affect combat stats, passive/active ability behavior,
  shop affinity weights, ghost budget/difficulty, profile wallet balance, or
  asset ownership.

Requirement anchors:

- `[Req 14-A]` through `[Req 14-H]`.

Test anchors:

- `tests/game/mushroom-progression.test.js`
- `tests/game/round-resolution.test.js`

Deferred:

- Physical DB rename from `mycelium` to `character_xp` is optional Phase 6D.
  Do not combine it with core extraction unless raw column names become a real
  blocker.

## Asset Ownership And Gacha

Profile assets represent persistent cosmetic ownership. Portrait assets are the
current shipped asset type.

Current code anchors:

- `app/server/services/asset-service.js`
- `vendor/backpack-game-core/src/server/models/mushroom/PlayerAssetInstance.js`
- `vendor/backpack-game-core/src/server/models/mushroom/PlayerEquippedAsset.js`
- `vendor/backpack-game-core/src/server/models/mushroom/AssetRoll.js`
- `app/server/game-data.js`: `PORTRAIT_VARIANTS`

Rules:

- Paid portrait ownership is stored in `player_asset_instances`.
- Equipped portrait state is stored in `player_equipped_assets`.
- `player_mushrooms.active_portrait` remains a compatibility mirror.
- Direct asset purchase spends profile wallet currency.
- Gacha is environment-gated with `ASSET_GACHA_ENABLED`.
- With `ASSET_GACHA_DIRECT_BUY_POLICY=block_gacha_assets`, configured gacha
  assets cannot be bought directly.
- MVP rolls choose one random unowned eligible asset, spend wallet currency
  once, record an `asset_rolls` row, and replay by idempotency key.
- Empty, inactive, or expired packs reject without spending wallet currency.

Requirement anchors:

- `[Req 14-F]`.

Test anchors:

- `tests/game/wallet-assets.test.js`
- `tests/game/mushroom-progression.test.js`

Future direction:

- The current Mushroom implementation already includes later gacha slices
  beyond the original MVP: static/database packs, multi-item rolls, duplicate
  copy caps, duplicate burn/exchange, runtime simulation, and admin pack
  validation. The 2026-07-04 multi-game plan moves reusable asset/gacha rules
  into `backpack-game-core` behind adapters so `meat-master` can share them.
  Profile asset state shaping, ownership maps, equipment validation,
  direct-purchase spend parameters, instance draft rows, and portrait variant
  projection now live in `profile-asset-state` / `modules/assets`; Mushroom
  still supplies runtime catalogs, SQL rows, wallet spend execution, roll/burn
  grants, support actions, and compatibility mirrors.
  Purchase/equip response DTOs plus granted-instance summaries for direct-buy,
  roll, burn, and idempotent replay paths now also live in `modules/assets`
  over injected rows/catalog snapshots; Mushroom still owns the mutations that
  create those rows and the route payload assembly around them.
  The same plan now treats reusable Vue frontend modules as core candidates:
  shared services, composables, view-model shapers, components, and optional
  page shells can move to the package when product routes, copy, theme, art,
  auth, and API adapters stay in each game. Trading, marketplace listings, and
  full NFT-set operations remain deferred.

Non-core boundary:

- Product persistence, payment-funded roll transactions, secure runtime RNG
  source selection, portrait URLs, uploaded image storage, route shells, auth,
  theme, localization, and Mushroom-specific skin catalogs stay in product code
  or adapters. Product-specific admin screens stay local, but neutral admin
  validation/checklist/odds/plan-review widgets can become shared Vue modules.
  Reusable asset ownership/equipment state helpers, pack validation, roll
  selection, duplicate/burn, pity/guarantee, simulation rules, wallet
  accounting primitives, and generic settlement input adapter helpers now have
  core modules. The remaining movable slices are pure lifecycle planners and
  DTO builders; direct-buy policy composition, runtime catalog persistence,
  paid mutation execution, concrete provider field maps/callbacks, and product
  UI shells stay local.

## Candidate Reusable Mechanics

These mechanics are closest to the reusable core boundary:

- bag shape masks and rotation
- grid cell / occupancy helpers
- placement validation once catalog access is injected
- seeded RNG and deterministic shuffle
- pure fusion matching with recipes/catalog policy injected
- fusion recipe normalization, lookup, and evaluator factories over
  product-authored recipes and artifact catalogs
- shop offer generation with item pools and eligibility hooks injected
- battle simulation with combatant, ability, attribution, and narration hooks
- asset acquisition policy with catalogs, ownership snapshots, wallet snapshots,
  and purchase/gacha mode config injected
- profile asset ownership/equipment state shaping, equip validation, purchase
  spend parameter shaping, and portrait variant projection over injected rows
  and policy snapshots
- gacha pack validation, roll selection, duplicate/burn, pity/guarantee, and
  simulation over injected RNG and ownership state
- frontend DTO/view-model shaping for shop, backpack, battle replay,
  wallet/assets, gacha packs, odds preview, and admin validation state
- artifact visual classification engines that receive role classes, shine tiers,
  owner lookup, shape hooks, labels, prompts, and CSS taxonomy through product
  adapters
- browser-safe services and Vue composables that receive API clients, product
  catalogs, route callbacks, copy dictionaries, and theme tokens through
  adapters
- server-side cache/job orchestration helpers that receive renderer,
  filesystem/path, logger, and product-copy adapters, such as the shared
  social-preview cache service
- neutral Vue components for backpack grids, artifact tiles, shop lists, battle
  logs, fighter/combatant cards, wallet/asset panels, gacha pack cards, roll
  results, odds tables, and admin validation/checklist panels

These mechanics need adapters before extraction:

- loadout validation that imports `game-data.js`
- shop generation that imports Mushroom artifact pools and character
  eligibility rules
- fusion application that writes DB rows
- bot loadout generation with catalog, starter preset, affinity, price,
  validation, and portrait/ghost snapshot responsibilities injected or kept
  local
- full battle-service integration that records snapshots/events, applies run
  rewards, rating, and round transitions
- wallet accounting helpers that must receive persisted wallet snapshots and
  idempotency state from a game repository
- gacha runtime integration that must receive secure RNG, wallet debit, asset
  grant, roll history, and audit persistence from a game repository
- Vue page shells that must receive product router/auth wrappers, API clients,
  localization, visual theme, image resolvers, and feature flags before they can
  move safely

These are product-specific and must stay out of `backpack-game-core`:

- Mushroom names, lore, portraits, wiki entries, achievements, seasons, and
  home-field code
- Telegram auth, bot gateway, Express routes, SSE, migrations, database
  clients/repositories, and persistence services. The moved Mushroom model
  definitions are a quarantine package only, not stable persistence API.
- wallet/payment providers, webhook verification, refunds/reversals, support,
  terms, and adult-content compliance gates
- localized UI copy, product route composition, auth shells, CSS themes, and
  product visual assets
- social-preview renderer implementations, artwork paths, generated static
  files, and product-specific marketing copy

## Extraction Rule

Code movement into `backpack-game-core` should stay small and evidence-led:
port focused core tests before changing `mushroom-master` imports, then verify
the Mushroom adapter/bridge tests. Backend slices should keep DB and provider
I/O behind adapters. Frontend slices should start with browser-safe services and
Vue composables, then props/events/slots components, then optional page shells.
Each shared frontend module needs neutral core tests plus the affected Mushroom
screenshot/e2e coverage and Meat build/test coverage once Meat consumes it.

Before broadening backend or Vue extraction, define the module/package boundary:
pure core modules, shared client/contracts, Vue composables/components, and
optional route-binding helpers. Each public surface needs stable package
exports, matching `.d.ts` coverage, neutral fixtures, and consumer contract
tests in both games when adopted.

Delegated implementation should use bounded sub-agents for maximum throughput.
Parallelize read-only audits, contract drafting, disjoint module/component
edits, consumer adapter prep, and validation review. Serialize only
integration-sensitive or heavyweight bottlenecks: installs, builds, dev
servers, Playwright/screenshot runs, package packing, submodule pointer updates,
commits, and pushes. A lead agent must verify each sub-agent finding against
current files before editing, merging, or reporting completion.

Post-implementation review on 2026-07-04: the first package/module architecture
slice is complete in core commit `3e3d5d6`, the first real helper movement
landed in core commit `8345448` with `modules/gacha/admin-validation`, and
gacha odds simulation moved in core commit `b3da379` with
`modules/gacha/simulation`; the provider-driven simulation service/module
factory later moved into `modules/gacha/simulation-service` and the server
facade. Wallet accounting moved in core commit `af520f0` with
`wallet-accounting` and `modules/wallet`. Profile asset state moved in core
commit `6ae688b` with `profile-asset-state` and `modules/assets`. Asset
catalog acquisition default/override policy moved in core commit `77b1d7b`
through `asset-gacha` / `modules/gacha`. Asset pack summary/label shaping for
frontend gacha UIs moved in core commit `578279d` through
`client-view-model`. Wallet purchase-surface shaping and asset roll feedback
assembly moved in core commit `cf7c680` through `client-view-model`; games
still own env/config parsing, product pack ids, portrait URLs, catalog
assembly, runtime pack lookup, surface detection, localization, route actions,
and page composition. Grid-cell classification for backpack board rendering
moved in core commit `f403553`; games still own visual classes, overlays,
drag/drop events, and layout constants. Artifact stat total/text view-model
shaping moved in core commit `41a3ad5`; games still own stat labels, visual
role classes, product copy, catalog semantics, and final UI composition.
Artifact grid utility shaping moved in core commit `725ffab`; games still own
placement state, visual preview composition, drag/drop actions, product
rendering, and gameplay mutation logic. Canonical preview-orientation shaping
moved in core commit `786d41c`; preview-only surfaces can keep non-bag bitmap
dimensions canonical while placement flows continue to use placement-preferred
orientation. Wallet and asset-roll status normalization moved in core commit
`f387670`; product UIs can share purchase-intent, Telegram invoice, and
roll/burn error status vocabulary while provider routes, checkout opening,
copy, and final UI state remain local. Asset gacha roll/burn result DTO
shaping moved in core commit `9b7b505`; persisted roll/exchange rows can shape
replay-safe browser payloads through `modules/gacha` while SQL, wallet spends,
asset grants, RNG, idempotency, and route ownership remain local.
Profile asset target-variant response shaping moved in core commit `0f8beee`;
games can share inventory/equipment variant list projection while injecting
product asset-id and policy adapters; runtime catalog/equipment resolution
remains local.
Profile asset result DTO shaping moved in core commit `458d4bb`; games can
share asset records, instance/equipment summaries, purchase results, equip
results, and grant summaries while persistence, wallet spends, RNG,
idempotency storage, runtime catalogs, and product route payload ownership stay
local.
Wallet and asset-roll mutation view-state shaping moved in core commit
`fc53abc`; games can share opening/success/failure reducer contracts while API
routes, idempotency-key generation, checkout side effects, refresh hooks, and
copy remain local.
Headless wallet/gacha state helper shaping moved in core commit `5ee7ee8`;
games can share wallet bundle loading states, wallet checkout next-action
decisions, and asset roll/burn refresh decisions while API calls,
Telegram/web checkout side effects, refresh callbacks, route names, and copy
stay local.
Run-shop response patch helper shaping moved in core commit `f4734ea`; games
can share refresh-shop, buy, and sell response state projection while API
calls, price guards, row-id sell payloads, placement payload construction,
haptics, replay loading, route names, and product copy stay local.
Game-run response patch helper shaping moved in core commit `2092663`; games
can share start, ready, round-transition, and completion response state
projection while routes, loadout projection, bootstrap updates, replay
loading, navigation, haptics, and product copy stay local.
Replay playback state shaping moved in core commit `ee2a275`; games can share
speed selection, long-battle boost, autoplay delay, tick advancement,
load/set-speed patches, and replay timeline shaping while timers, routes,
settings persistence, event formatting, navigation, Vue computed wrappers, and
UI stay local.
Client response-envelope unwrapping moved in core commit `b56ad91`; games can
use the shared route-adapter client against existing `{ success, data, error }`
payloads while route maps, auth/session headers, idempotency keys, checkout
side effects, and refresh behavior remain local.
Post-route-client review on 2026-07-04: live Mushroom frontend transport now
uses the shared route-adapter client, so the next core boundary should move
DTO/state helpers rather than more route plumbing. Profile asset/equipment
result shapers and the first headless wallet/gacha state helpers are now in
core, and the run-shop/game-run response patch helper slices are also in
core. Replay playback state is also in core. Gacha admin draft-diff DTOs, diff
table-row shaping, validation issue rows, release checklist rows, season-plan
coverage/chance shaping, and fixture operation summaries are now in core while
DB reads/writes, auth, audit logs, upload/storage, copy, and page layout stay
product-local. Gacha admin odds preview, fixture operation, and simulation item
table rows are also in core while preview loading, fixture import/export calls,
and concrete DB/catalog simulation providers stay product-local. Core commits
`624d4b0` and `bf863f3` moved the backend planner slices: asset-gacha roll
settlement plans, duplicate-burn settlement plans, wallet purchase
intent/checkout/completion plans, run-shop buy/refresh/sell plans, run start
drafts, starter loadout drafts, initial/next shop state, ghost budget math, round
reward/counter/end-state planning, and challenge group-completion decisions.
Core commits `2280929`, `ffaa376`, `3c638fb`, `a4c4c06`, `42b1f1c`, `be41855`, `ebc74d2`, and `6d9faeb` moved
the first neutral frontend primitive slices: headless artifact stat-row DTO
shaping, shop item row DTO shaping, grid board render row shaping, replay event
row shaping, artifact tile display contracts, asset pack card rows, odds table
sections, and roll result panel DTOs for
product-styled stat chips/text, shop offers, backpack boards, battle logs,
artifact images, gacha pack cards, odds tables, and roll result panels.
Core commit `433e2f5` moved the artifact visual classification engine from
Mushroom `app/shared` into `artifact-visual-classification`; products still own
role labels, prompts, shine tiers, CSS taxonomy, generated-art assumptions, and
legacy owner-field adapters.
Core commit `5370733` moved fusion recipe normalization, lookup, ingredient
policy, result/ingredient summaries, and evaluator factories into
`artifact-fusion-recipes` / `modules/fusion`; products still own authored recipe
tables, artifact ids, balance, unlock policy, and catalog publication.
Core commits `006ab33`, `953fa1e`, `6e7c1fb`, `cdba5a7`, `cbb9f18`,
`be03e50`, `5dd01f1`, and `471e686` then added the neutral Vue component layer
for roll result panels, gacha odds tables, gacha pack cards, artifact tiles,
artifact stat summaries, shop item rows/lists, backpack grids, battle logs,
achievement badges, and season-rank emblems. The first Phase 8AW component
candidate list is complete; future Vue moves should start from a fresh
evidence-backed candidate review. Keep
whole services, Express routes, persistence, payment/webhook providers,
runtime catalogs, route
maps, artwork, support operations, haptics, page assembly, and secure paid-roll
RNG selection inside product repos.
New shared backend logic should continue landing behind public `modules/*` or
`server` exports, and new browser-safe helpers should land behind `client`,
`client-view-model`, or `vue` style exports. Core commit `471e686` added the
first reusable server coordination helpers for run readiness, idle detection,
and keyed async locks; product repos still own route mounting, auth, DB
transactions, active-run validation, SSE delivery, and challenge resolution.
Core commit `f9c0054` hardened the server module contract before larger
server moves: module descriptors now validate dependency/provides metadata,
config, duplicate registration, and provider override intent, with the contract
documented in `vendor/backpack-game-core/docs/server-module-contract.md`.
Later server slices added provider-driven gacha simulation and loadout
validation service/module factories plus readiness manager module-list
registration, while concrete pack/catalog, artifact/pricing/grid providers,
route wiring, and active-run/SSE behavior remain in product repos.
The Phase 13 extraction follow-up also added provider-driven run-state summary
DTO shaping to `modules/run`, with Meat passing product-local loadout totals,
cost, and shop-row formatters while keeping persistence and routes local.
The next Phase 13 follow-up added provider-neutral support lookup bundle and
support mutation response DTO shaping to `modules/support`, with Mushroom and
Meat passing already-authorized product rows while keeping permissions, audit
persistence, storage mutations, and route registration local.
The next server-side follow-up added runtime config validation result,
assertion, and deploy-check summary line formatting to `modules/config`; games
still own env parsing, required fields, product policy, provider availability,
and deploy commands.
The auth-envelope follow-up added public auth user/session/logout response
shaping to `modules/auth`; product repos still own Telegram verification,
dev-login policy, session persistence, auth-code lifecycle, middleware, and
player lookup.
The auth route follow-up added provider-neutral auth/bootstrap route descriptors
and a server-module factory to `@microwavedev/backpack-game-core/server`.
Mushroom now mounts its auth/bootstrap/dev-session handlers through that route
family, and Meat verifies the same family with Meat paths. Products still own
provider verification, sessions, player lookup, middleware/rate-limit policy,
and final path choices.
The first mv-first backend cluster then moved Mushroom service files for ghost
loadouts, loadout validation wrappers, gacha simulation wrappers, and readiness
singleton exports into core provider-driven factories. Product repos still own
catalogs, character lists, starter presets, image paths, runtime pack lookups,
validation policy, readiness config, and legacy aliases.
The second mv-first backend cluster moved the small server utility and
observability files into the core `server` facade. Core now owns neutral
time/id/code/session helpers, JSON parsing, language normalization,
string-seed RNG bridging, progression calculation, run-currency field shaping,
structured logging, and request logging middleware shape. Product repos still
own legacy aliases, default locale preference, product-specific log context
fields, logging sinks, and any DB/provider/bootstrap code that consumes those
helpers.
The first aggressive gameplay-spine move then moved
`game-run-loadout.js` into the quarantined
`@microwavedev/backpack-game-core/server/ports/mushroom/gameplay` subpath.
It intentionally preserves current Mushroom SQL/table behavior behind injected
query, catalog, grid, validation, clock, and ID providers. Treat this as a
temporary migration port, not a stable cross-game API, until repository
contracts replace the table/query details.
The next gameplay-spine move added `artifact-fusion-service.js` to the same
quarantine. It preserves current `game_run_fusions` reveal persistence and
between-round loadout mutation behavior behind injected query, catalog, fusion
matcher, loadout row mutation, clock, and ID providers. It should not become a
stable cross-game fusion module until product repository contracts replace the
SQL/table details.
As of the 2026-07-07 server audit, the remaining server extraction queue is
tiered rather than folder-wide: shrink already core-backed wrappers first only
when imports are cleaned; move the smaller gameplay/profile ports
(`season-service.js`, `mutation-claim-service.js`, `battle-engine.js`, and
`battle-service.js`) before the heavy run/shop/profile spine; move
wallet/assets/gacha/support after repository, payment, support, and content
policy contracts exist; and keep `db.js`, `start.js`, realtime/SSE delivery,
home-field generation config, concrete dialect setup, migrations, and product
catalog content in product repos.
The agreed storage direction is two product-owned runtime modes: hosted server
mode with PostgreSQL in Docker as the authoritative community store, and local
desktop/app mode with SQLite for local-only progress plus optional calls to the
hosted server for community features. Core now has a quarantined copy of the
Mushroom Sequelize model definitions, but product repos still own Sequelize
instance creation, repositories, dialect config, migrations, sync/backfill
logic, and any offline action-log sync policy. Meat now uses one
Sequelize-backed snapshot store for its hosted Postgres and local SQLite
dialects; deeper normalized repositories and sync policy remain product-local
follow-ups. Runtime feature gates are also product-owned: Meat local mode
exposes local progress, disables support/admin by default, and rejects
paid/gacha toggles until those flows are
served by hosted community APIs. Meat's first local community client is a
read-only hosted leaderboard proxy; friends/challenges/account linking remain
product-local hosted API follow-ups. Meat's first desktop wrapper is
Electron-based and starts the same product backend in local SQLite mode; core
still does not own packaging or OS integration. Core now owns the generic
hosted-community client and server module factory used by Meat's local
community proxy; products still own route mounting, auth, configured server
URLs, and any hosted write APIs for friends/challenges/account linking.
The same commit started the aggressive frontend port lane by moving the
browser-safe reduced-motion tracker to
`@microwavedev/backpack-game-core/vue/composables`; product repos still own
settings persistence, CSS class attachment, telemetry, haptics, and page
composition.
Avoid new consumer imports from deep `src/*` files. Broader asset
runtime/catalog lifecycle remains later because it still couples to
persistence, support actions, paid rollback behavior, gacha grant/burn flows,
and product catalogs; provider checkout/callback code stays local.

The shipped slices are bag-shape masks, rotation, first grid-geometry
primitives, fusion matching, fusion recipe helper factories, shop-offer
generation, bot-loadout generation, hookable battle simulation, provider-driven
loadout validation, deterministic numeric RNG/shuffle helpers, artifact family
capability helpers, configurable artifact visual classification helpers, and
the first asset-gacha policy helpers.
Core run-lifecycle helpers now expose neutral aliases for cross-game adoption:
`characterId` alongside legacy `mushroomId`, and `profileCurrency` /
`characterProgress` alongside legacy `spore` / `mycelium`. Consumers may keep
legacy public response fields until their own API and UI migrations are
explicitly scheduled.
Core battle simulation also exposes `characterId` in default combatant summaries
and uses it for default labels before falling back to legacy `mushroomId`, so
new products can keep replay state character-neutral without custom summary
hooks.
Core wallet view-state helpers prefer `profileCurrency` / `profile_currency`
player fields before explicit legacy balance fields when a wallet balance map is
not available, keeping new consumers off Mushroom currency names by default.
Mushroom still owns catalog access, pricing, catalog family assignment, product
validation messages, secure paid-roll RNG selection, and all DB integration
through adapters. The moved fusion application is only a quarantined port until
repositories replace its SQL contract. Stable core modules still do not own
run-shop buy/refresh/sell mutations, battle-service persistence/reward
integration, rating, snapshots, rewards, or other product state writes.

### Planned Bot-Loadout Boundary

The bot-loadout extraction keeps product identity in `mushroom-master`.
Reusable core owns weighted item choice, first-fit bag placement, rectangular
item placement, occupied-cell tracking, and retry orchestration. Mushroom still
provides artifact catalog data, prices, bag-family adapter/config, bag shapes,
starter bag/preset rows, affinity weighting, validation policy, portrait URLs,
and `createBotGhostSnapshot` response shaping.

Do not move battle ghost selection, mushroom portrait selection, or Mushroom
starter preset lookup into `backpack-game-core`.

### Battle-Simulation Boundary

The battle-simulation extraction keeps product combat identity in
`mushroom-master`. Reusable core owns the deterministic 1v1 loop, action/skip
event sequencing, HP/stun/damage flow, speed and base-speed ordering fallback,
death/step-cap resolution, and final result shape. Mushroom still provides
snapshot-to-combatant derivation, Mushroom active/passive ability hooks,
Kirt/Morga ordering hooks, artifact attribution, lore `effectTags`, narration
labels, `STEP_CAP`, `MAX_STUN_CHANCE`, and seeded RNG creation.

Do not move Mushroom ids, names, base stats, artifact catalog data, rewards,
rating, DB persistence, or battle replay storage into `backpack-game-core`.
