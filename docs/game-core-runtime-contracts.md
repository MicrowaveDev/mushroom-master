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
- `app/server/models/PlayerWalletBalance.js`
- `app/server/models/PlayerWalletTransaction.js`
- `app/server/models/WalletPurchaseIntent.js`
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
- `app/server/models/PlayerAssetInstance.js`
- `app/server/models/PlayerEquippedAsset.js`
- `app/server/models/AssetRoll.js`
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
  selection, duplicate/burn, pity/guarantee, simulation rules, and wallet
  accounting primitives now have core modules. The remaining movable slices are
  pure settlement/lifecycle planners and DTO builders; direct-buy policy
  composition, runtime catalog persistence, paid mutation execution, provider
  callbacks, and product UI shells stay local.

## Candidate Reusable Mechanics

These mechanics are closest to the reusable core boundary:

- bag shape masks and rotation
- grid cell / occupancy helpers
- placement validation once catalog access is injected
- seeded RNG and deterministic shuffle
- pure fusion matching with recipes/catalog policy injected
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
- browser-safe services and Vue composables that receive API clients, product
  catalogs, route callbacks, copy dictionaries, and theme tokens through
  adapters
- neutral Vue components for backpack grids, artifact tiles, shop lists, battle
  logs, wallet/asset panels, gacha pack cards, roll results, odds tables, and
  admin validation/checklist panels

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
- Telegram auth, bot gateway, Express routes, SSE, database models, migrations,
  and persistence services
- wallet/payment providers, webhook verification, refunds/reversals, support,
  terms, and adult-content compliance gates
- localized UI copy, product route composition, auth shells, CSS themes, and
  product visual assets

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
`modules/gacha/simulation`. Wallet accounting moved in core commit `af520f0`
with `wallet-accounting` and `modules/wallet`. Profile asset state moved in
core commit `6ae688b` with `profile-asset-state` and `modules/assets`. Asset
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
and simulation services stay product-local. Core commits `624d4b0` and
`bf863f3` moved the backend planner slices: asset-gacha roll settlement plans,
duplicate-burn settlement plans, wallet purchase intent/checkout/completion
plans, run-shop buy/refresh/sell plans, run start drafts, starter loadout
drafts, initial/next shop state, ghost budget math, round
reward/counter/end-state planning, and challenge group-completion decisions.
Core commits `2280929`, `ffaa376`, `3c638fb`, `a4c4c06`, `42b1f1c`, `be41855`, `ebc74d2`, and `6d9faeb` moved
the first neutral frontend primitive slices: headless artifact stat-row DTO
shaping, shop item row DTO shaping, grid board render row shaping, replay event
row shaping, artifact tile display contracts, asset pack card rows, odds table
sections, and roll result panel DTOs for
product-styled stat chips/text, shop offers, backpack boards, battle logs,
artifact images, gacha pack cards, odds tables, and roll result panels.
Remaining shared-core work should shift to larger neutral frontend component
primitives after the DTO contracts stabilize. Keep
whole services, Express routes, persistence, payment/webhook providers,
runtime catalogs, route
maps, artwork, support operations, haptics, page assembly, and secure paid-roll
RNG selection inside product repos.
New shared backend logic should continue landing behind public `modules/*`
exports, and new browser-safe helpers should land behind `client` or
`client-view-model` style exports. Avoid new consumer imports from deep `src/*`
files. Broader asset runtime/catalog lifecycle remains later because it still
couples to persistence, support actions, paid rollback behavior, gacha
grant/burn flows, and product catalogs; provider checkout/callback code stays
local.

The shipped slices are bag-shape masks, rotation, first grid-geometry
primitives, fusion matching, shop-offer generation, bot-loadout generation,
hookable battle simulation, provider-driven loadout validation, deterministic
numeric RNG/shuffle helpers, and the first asset-gacha policy helpers.
Mushroom still owns catalog access, pricing, bag/family policy, product
validation messages, secure paid-roll RNG selection, and all DB integration
through adapters. Fusion application, run-shop buy/refresh/sell mutations, and
battle-service persistence/reward integration still belong in `mushroom-master`
because they write DB rows and touch run currency, rating, snapshots, rewards,
or product state.

### Planned Bot-Loadout Boundary

The bot-loadout extraction keeps product identity in `mushroom-master`.
Reusable core owns weighted item choice, first-fit bag placement, rectangular
item placement, occupied-cell tracking, and retry orchestration. Mushroom still
provides artifact catalog data, prices, `isBag`, bag shapes, starter bag/preset
rows, affinity weighting, validation policy, portrait URLs, and
`createBotGhostSnapshot` response shaping.

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
