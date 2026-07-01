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

- Seasonal packs, multi-item rolls, rarity guarantees, duplicate burn/exchange,
  trading, marketplace listings, and database-managed collections remain
  deferred. The current MVP must not block those designs, but they are not
  part of the first reusable core extraction.

Non-core boundary:

- Asset ownership, profile wallet spends, gacha pack policy, payment-funded
  rolls, portrait URLs, and Mushroom-specific skin catalogs stay in product
  code or adapters.

## Candidate Reusable Mechanics

These mechanics are closest to the reusable core boundary:

- bag shape masks and rotation
- grid cell / occupancy helpers
- placement validation once catalog access is injected
- seeded RNG and deterministic shuffle
- pure fusion matching with recipes/catalog policy injected
- shop offer generation with item pools and eligibility hooks injected

These mechanics need adapters before extraction:

- loadout validation that imports `game-data.js`
- shop generation that imports Mushroom artifact pools and character
  eligibility rules
- fusion application that writes DB rows
- bot loadout generation that imports Mushroom catalogs, presets, affinities,
  and portrait helpers
- battle simulation with hard-coded Mushroom abilities

These are product-specific and must stay out of `backpack-game-core`:

- Mushroom names, lore, portraits, wiki entries, achievements, seasons, and
  home-field code
- Telegram auth, bot gateway, Express routes, SSE, database models, migrations,
  and persistence services
- wallet/payment providers, webhook verification, refunds/reversals, support,
  terms, and adult-content compliance gates
- localized UI copy and product visual assets

## Extraction Rule

Code movement into `backpack-game-core` should stay small and evidence-led:
port focused core tests before changing `mushroom-master` imports, then verify
the Mushroom adapter/bridge tests. The shipped slices are bag-shape masks,
rotation, first grid-geometry primitives, fusion matching, and shop-offer
generation. Full placement/loadout validation still belongs in `mushroom-master`
until catalog access, pricing, bag policy, and validation errors are
parameterized. Fusion application and run-shop buy/refresh/sell mutations still
belong in `mushroom-master` because they write DB rows and touch run currency.
The next likely slice is bot loadout generation after catalog, affinity, preset,
and price providers are injected.
