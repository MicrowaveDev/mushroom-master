# Profile Currency And Core Extraction Plan

**Status:** Planning only. No implementation has started.
**Created:** 2026-06-22
**Primary repo:** `mushroom-master`
**Target reusable core repo:** `git@github.com:MicrowaveDev/backpack-game-core.git`

`git ls-remote` returned no refs for the target repo on 2026-06-22, so
this plan treats `backpack-game-core` as a new or empty package until proven
otherwise.

## Source Of Truth

### Original request

Separate the Mushroom Battles game core so it can be reused by another game.
Before extracting the core, adjust the coin / skin economy so skin-buying
currency is bound to the user profile, not to a character, and make code
variables plus database fields more general for reuse.

### Follow-up request

Add a backend feature for buying profile coins. Add an environment-controlled
gacha mode: when the toggle is enabled, some skins cannot be bought directly;
players roll a random unowned skin instead. The backend should stay flexible
enough for future seasonal NFT-style packs: one season can include multiple
collections, each collection can contain 50-100 images with rarities (common,
rare, epic, legendary, secret), old season packs can stop being purchasable,
packs can roll 5-10 images with configured drop rates and guarantees, duplicate
commons can later be burned into a random rare, and player-to-player exchange or
sales should remain possible in a later phase. The first implementation can be
simpler, but it must not block that direction, and Mushroom Battles must keep
simple direct skin buying available when gacha mode is off.

### Stated criteria and constraints

- Write a markdown plan first.
- Do not make immediate implementation changes in this pass.
- First implementation priority is the coins / skin ownership adjustment.
- Skin-buying currency must be user-profile scoped, so a player can earn coins
  and spend them on any skin or future in-game asset.
- Users must be able to buy profile coins through a backend purchase flow.
- Gacha mode must be controlled by environment configuration, not by a hard fork
  of the codebase.
- Gacha mode should apply to selected skins / collections, not necessarily every
  asset in the game.
- When direct Mushroom Battles skin buying is desired, it must remain available.
- Naming in code and database should become less Mushroom-specific and more
  reusable by another game.
- Reusable core should live in `git@github.com:MicrowaveDev/backpack-game-core.git`.

### Success conditions

- The persistent spendable currency has one profile-level balance per player,
  with auditable earns and spends.
- Skins and future cosmetic assets are purchased through profile-level
  ownership, not through `player_mushrooms`.
- Character-specific progression remains possible, but it is named as XP /
  mastery, not as the spendable coin wallet.
- Temporary run-shop currency is clearly separated from persistent profile
  currency in database names, service names, API payloads, tests, and UI copy.
- Backend coin purchases are recorded as purchase intents/orders and only grant
  wallet currency after verified payment completion.
- Asset acquisition supports both direct purchase and gacha roll paths from the
  same catalog/ownership model.
- With gacha enabled, configured gacha-only skins cannot be bought directly and
  rolls return an eligible unowned skin when one exists.
- The backpack/autobattler core can be imported by `mushroom-master` and another
  game without importing Telegram auth, Mushroom lore, portraits, wiki,
  achievements, home-field code, or Sequelize models.

### Open ambiguity

- **Recommendation after current-code review:** use the existing profile-level
  `players.spore` balance as the initial wallet balance, but make
  `player_wallet_balances` the new source of truth for future writes. Keep
  `players.spore` as a compatibility mirror/read alias for one release so the
  current home/profile UI and tests can migrate gradually.
- Decide the player-facing name for the new persistent wallet in Mushroom
  Battles. The code should use neutral names such as `wallet_balance`,
  `soft_currency`, and `character_xp`; the UI may still localize that as coins,
  spores, or another thematic term.
- Decide the payment provider for coin purchases. Telegram Stars / Mini App
  invoices are the likely product fit, but the backend should keep provider
  details behind a purchase-provider adapter.
- Decide whether existing portrait variants become one-time purchases at their
  current `cost` values, or whether those values need a balance pass before the
  purchase model ships.
- Decide what happens when a gacha pool has no unowned skins left: reject the
  roll, grant duplicate dust/shards, or allow duplicate instances. The MVP below
  recommends rejecting until duplicate mechanics are implemented.

## Current State Snapshot

- Run/prep economy uses `game_run_players.coins`. This is temporary per-run
  shop currency used for artifacts, refreshes, refunds, and budget validation.
- Progression rewards currently grant profile-level `spore` on `players` and
  character-bound `mycelium` on `player_mushrooms`.
- Portrait variants are not purchased. `PORTRAIT_VARIANTS[].cost` is currently a
  cumulative `player_mushrooms.mycelium` gate, and switching portraits updates
  `player_mushrooms.active_portrait`.
- Starter preset variants are character progression gates based on
  `computeLevel(mycelium)` and `player_mushrooms.active_preset`.
- Requirements currently state that mycelium is per-mushroom and that portrait
  variants are cumulative gates, not purchases: see `docs/game-requirements.md`
  Req 14-F.
- The backend uses Sequelize model registration plus `sequelize.sync()` and a
  small `ensureColumnExists` helper. New tables should be added as models under
  `app/server/models/` and registered in `app/server/models/index.js`; raw SQL
  sketches in this plan are contracts, not the literal implementation path.
- `run-service.js` currently writes `players.spore` directly from solo rewards,
  challenge rewards, completion bonuses, challenge winner bonuses, and season
  archive rewards. Wallet migration must centralize all of these writes or the
  profile balance will drift.
- `switchPortrait` currently updates `player_mushrooms.active_portrait`, and
  `battle-service.getActiveSnapshot()` reads that value into battle snapshots so
  replays preserve the portrait variant. Asset ownership migration must keep a
  compatibility read path for replay snapshots and historical battle rendering.
- The frontend currently has no standalone store. Portrait selection lives in
  the home roster skin picker and expects `progression[mushroomId].portraits[]`
  with `unlocked`, `cost`, `path`, and `activePortrait` semantics.
- Existing mutating run-shop routes use `rateLimit()` and `idempotency()`, but
  portrait switching does not. Wallet spends, direct asset purchases, and gacha
  rolls must use mutation guards and a persistent idempotency key.

## Implementation Review Adjustments

This section records the sharper plan changes from reviewing the current code
on 2026-06-22.

1. **Wallet first, but as a compatibility migration.** Do not introduce a fresh
   zero-balance wallet unless product explicitly wants to wipe existing earned
   `spore`. Backfill `players.spore` into `player_wallet_balances`, then route
   every future profile-currency grant through `wallet-service.js`.
2. **Add a wallet grant adapter before purchases.** Replace direct
   `UPDATE players SET spore = spore + ...` calls with `grantCurrency(...)` in
   one controlled pass. Keep `players.spore` updated from the wallet service
   during the compatibility window.
3. **Do not model future trading with ownership-only rows.** A single
   `(player_id, asset_id)` ownership table is fine for today's portraits but too
   narrow for future duplicates, burning, selling, and trading. Use asset
   instances or inventory quantities as the canonical inventory model, with a
   derived "owned" boolean for the simple skin picker.
4. **Keep catalog definitions static at first.** Current product catalogs live in
   code/JSON (`game-data.js`, shared JSON files). For the MVP, put asset and
   pack definitions in a versioned static module/JSON file, then persist only
   player inventory, purchases, rolls, and transactions. Database-managed
   seasons/collections can come later when there is an admin workflow.
5. **Wire Telegram payments through existing bot infrastructure.** The app
   already exposes `/api/bot/webhook` and `callTelegramBotApi`. For Telegram
   Stars, extend that gateway to handle `pre_checkout_query` and
   `successful_payment` updates instead of assuming all providers post to
   `/api/wallet/purchase-webhook/:provider`.
6. **Use cryptographic randomness for gacha.** Do not reuse game `createRng`
   seeds for paid rolls. Use server-side cryptographic randomness, record the
   chosen candidate pool and result, and keep enough metadata to investigate
   support claims.
7. **Expose acquisition policy in bootstrap/app config.** The client needs to
   know whether direct buy or roll is available for each asset. Keep the old
   portrait array shape for compatibility, but add fields like `owned`,
   `price`, `currencyCode`, `acquisitionMode`, `purchaseAvailable`, and
   `rollAvailable`.
8. **Add odds, terms, and support hooks before paid gacha.** If real-money
   currency buys rolls, the backend should expose pack odds and the UI should
   link terms/support. This is a launch gate, not polish.

## Vocabulary Target

Use this vocabulary before and during the core extraction:

| Concept | Current names | Target code / DB names | Scope |
|---|---|---|---|
| Temporary run-shop money | `coins`, `game_run_players.coins` | `run_currency`, `run_coins`, or `shop_currency` | One active run player |
| Persistent spendable wallet | `spore` or none | `wallet_balance`, `soft_currency`, `currency_code` | User profile |
| Coin purchase order | none | `wallet_purchase_intents`, `provider`, `status` | User profile |
| Character progression XP | `mycelium` | `character_xp`, `mastery_xp` | Player + character |
| Cosmetic asset inventory | `active_portrait` gate only | `player_asset_instances`, `player_equipped_assets`, derived `owned` state | User profile |
| Portrait / skin catalog price | `PORTRAIT_VARIANTS[].cost` | `price`, `currencyCode`, `assetId`, `slot` | Catalog item |
| Gacha pool / pack | none | `asset_packs`, `asset_pack_items`, `rarity`, `drop_weight` | Season / collection |

Implementation should avoid using bare `coins` in shared core APIs because it
will mean different things in different products. Product adapters can still
render the label "Coins".

## Phase 1 - Requirements And Naming Contract

1. Update `docs/game-requirements.md` before code changes:
   - Replace Req 14-F with a profile-wallet purchase model for portrait / skin
     variants.
   - Keep character XP progression for level, tier, wiki, preset unlocks, and
     character shop-item eligibility unless a separate design change removes it.
   - Add a requirement that persistent asset purchases are profile-scoped and
     can be spent on any eligible catalog asset, even if earned while playing a
     different character.
   - Add a requirement that temporary run-shop currency cannot be spent on
     profile assets, and profile wallet currency cannot buy run artifacts.
2. Add or update a short architecture note describing the three separate
   ledgers:
   - run shop currency
   - profile wallet currency
   - character XP / mastery
3. Update test names and error strings deliberately so old ambiguous "coins"
   references are either `run coins` or `wallet coins`.

## Phase 2 - Profile Wallet Schema

Recommended schema:

```sql
player_wallet_balances(
  player_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (player_id, currency_code)
)

player_wallet_transactions(
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT,
  source_id TEXT,
  idempotency_key TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
)
```

Implementation notes:

- Add a wallet service with `grantCurrency`, `spendCurrency`, `getBalance`, and
  `listTransactions`.
- Add Sequelize models for wallet balances and wallet transactions. Register
  them in `initModels`; rely on `sequelize.sync()` for new tables in the current
  migration style, and use explicit backfill code for existing `players.spore`.
- Enforce no-negative balances inside one database transaction.
- Use persistent idempotency keys for run rewards, season archive rewards,
  purchases, and gacha rolls. The existing in-memory HTTP idempotency middleware
  is useful for retries, but it is not sufficient as a financial ledger.
- Backfill `players.spore` into `player_wallet_balances` with
  `currency_code = 'soft_coin'` (or the chosen code). During the compatibility
  window, `grantCurrency` and `spendCurrency` should update both the wallet row
  and `players.spore`.
- Add a consistency test that `getPlayerState().player.spore` equals the wallet
  balance while the compatibility mirror exists.

## Phase 3 - Backend Coin Purchases

Add coin purchases before skin purchasing or gacha spends depend on the wallet.

Recommended schema:

```sql
wallet_purchase_intents(
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_invoice_id TEXT,
  provider_payment_id TEXT,
  currency_code TEXT NOT NULL,
  wallet_amount INTEGER NOT NULL,
  price_amount INTEGER NOT NULL,
  price_currency TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
)
```

Backend contract:

- `GET /api/wallet/bundles` returns configured coin bundles.
- `POST /api/wallet/purchase-intents` creates an order for a configured coin
  bundle and returns provider checkout data.
- For Telegram Mini Apps, the provider adapter should create an invoice usable
  by `Telegram.WebApp.openInvoice(...)`. Official Telegram docs say digital
  goods/services use Stars with currency `XTR`, then the bot receives
  `pre_checkout_query` and `successful_payment` updates before goods are
  delivered:
  - <https://core.telegram.org/bots/payments-stars>
  - <https://core.telegram.org/bots/webapps#initializing-mini-apps>
- Extend `/api/bot/webhook` handling for Telegram Stars:
  - Add `pre_checkout_query` to the webhook `allowed_updates`.
  - Validate the invoice payload against `wallet_purchase_intents`.
  - Answer the pre-checkout query within Telegram's deadline.
  - On `successful_payment`, match by provider payment id / invoice payload and
    grant wallet currency through `grantCurrency`.
- `GET /api/wallet` returns balances and optional recent transactions.
- Never trust the client to mark a purchase as paid.
- Purchase completion must be idempotent: the same provider payment cannot grant
  coins twice.
- Store Telegram's charge id / provider charge id when present so refunds or
  support investigations have the necessary identifiers.
- Keep provider integration behind an adapter, for example `createInvoice`,
  `validatePreCheckout`, `completePayment`, and `extractPaymentId`, so Telegram
  Stars or another provider can be swapped without touching wallet accounting.
- Add `/terms` and `/support` bot handling or equivalent in-app links before
  enabling real-money purchases in production.

MVP bundles can live in config first:

```js
[
  { id: 'coins_small', walletAmount: 100, priceAmount: 1, priceCurrency: 'XTR' },
  { id: 'coins_medium', walletAmount: 550, priceAmount: 5, priceCurrency: 'XTR' },
  { id: 'coins_large', walletAmount: 1200, priceAmount: 10, priceCurrency: 'XTR' }
]
```

## Phase 4 - Cosmetic Asset Ownership

1. Replace portrait-threshold semantics with catalog asset semantics:
   - `assetId`: stable globally unique id, for example `portrait.thalla.1`.
   - `slot`: `portrait`, later `home_field_skin`, `emote`, etc.
   - `targetType`: `character`, `global`, or future target families.
   - `targetId`: nullable; `thalla` for a Thalla-only portrait.
   - `price`: integer wallet price.
   - `currencyCode`: initially one code, for example `soft_coin`.
   - `acquisitionMode`: `direct`, `gacha`, or `both`.
   - `packId`: nullable; set for gacha/season assets.
   - `rarity`: nullable initially; future values `common`, `rare`, `epic`,
     `legendary`, `secret`.
   - `maxCopiesPerPlayer`: `1` for current direct-buy portrait skins; higher or
     `null` later for duplicate gacha items.
2. Add profile-scoped inventory:
   - Canonical table:
     `player_asset_instances(id, player_id, asset_id, acquisition_source,
     acquisition_source_id, status, acquired_at, metadata_json)`.
   - MVP uniqueness: enforce at most one active instance per
     `(player_id, asset_id)` for `maxCopiesPerPlayer = 1` assets.
   - Derived ownership: `owned = active instance exists`. A summary table or
     query helper can expose the simple ownership boolean expected by the
     current portrait UI.
   - Ownership/inventory is not stored on `player_mushrooms`.
3. Add equipment state:
   - `player_equipped_assets(player_id, slot, target_type, target_id,
     asset_instance_id, asset_id)`.
   - `asset_id` keeps default/free compatibility simple; `asset_instance_id`
     becomes important when tradeable duplicates ship.
   - Current portrait selection moves out of `player_mushrooms.active_portrait`
     once the compatibility path is no longer needed.
4. Replace `switchPortrait` with separate operations:
   - `purchaseAsset(playerId, assetId)` spends wallet currency and writes
     an inventory instance.
   - `equipAsset(playerId, assetId | assetInstanceId)` validates ownership and
     target compatibility, then updates equipped state.
5. Preserve compatibility temporarily:
   - `GET /api/bootstrap` can still expose `progression[mushroomId].portraits`
     while sourcing `owned`, `price`, acquisition fields, and `active` from the
     new asset tables.
   - `PUT /api/mushroom/:id/portrait` can become an equip-only compatibility
     route for one release, or be replaced by `/api/assets/:assetId/equip`.
   - `getActiveSnapshot()` should resolve the equipped portrait through an
     asset/equipment helper and still write `portraitId`, `imagePath`, and
     `activePortrait` into battle snapshots for replay compatibility.
   - Historical snapshots that already contain `portraitId` / `imagePath` must
     keep rendering without querying current ownership.

## Phase 5 - Env-Gated Gacha MVP

The MVP should make the backend flexible without forcing Mushroom Battles to use
gacha immediately.

Environment flags:

- `ASSET_GACHA_ENABLED=false` by default.
- `ASSET_GACHA_DIRECT_BUY_POLICY=allow|block_gacha_assets`, default `allow`.
- Optional `ASSET_GACHA_ACTIVE_PACK_IDS=season_1_pack_a,season_1_pack_b`.
- Optional `ASSET_GACHA_ALLOW_DUPLICATES=false` for the MVP. Keep it false
  until duplicate inventory, burn, and trade flows are implemented.

Direct purchase behavior:

- If `ASSET_GACHA_ENABLED=false`, direct purchase remains available for assets
  with `acquisitionMode: direct` or `both`.
- If `ASSET_GACHA_ENABLED=true` and policy is `block_gacha_assets`, direct
  purchase rejects assets whose catalog says `acquisitionMode: gacha` or `both`
  and whose `packId` is active for gacha.
- Assets with `acquisitionMode: direct` remain buyable even when gacha is on.
  This keeps simple Mushroom Battles skin buying available for non-gacha skins.

Initial pack schema:

For the MVP, prefer static versioned pack definitions in
`app/shared/asset-packs.json` or `app/server/asset-catalog.js`; add database
pack tables only when operators need runtime/admin changes. The schema below is
the future DB shape, not a requirement for the first commit.

```sql
asset_packs(
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  collection_id TEXT,
  name_json TEXT NOT NULL,
  status TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  roll_price_currency_code TEXT NOT NULL,
  roll_price_amount INTEGER NOT NULL,
  roll_size INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

asset_pack_items(
  pack_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  drop_weight INTEGER NOT NULL,
  guarantee_group TEXT,
  PRIMARY KEY (pack_id, asset_id)
)

asset_rolls(
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  price_amount INTEGER NOT NULL,
  result_asset_ids_json TEXT NOT NULL,
  guarantee_state_json TEXT,
  created_at TEXT NOT NULL
)
```

MVP roll contract:

- `POST /api/assets/packs/:packId/roll` spends wallet currency once and grants
  one random unowned asset from that pack.
- The first MVP can use `roll_size = 1` even though the schema allows future
  packs with 5-10 results.
- The roll candidate pool excludes already owned assets.
- If no unowned candidate exists, reject the roll without spending currency.
- Use weighted random selection from `drop_weight`; do not hardcode rarity math
  in route handlers.
- Use cryptographic server randomness, not the deterministic game RNG helper.
- Record the candidate pool hash, selected asset id, result instance id, price,
  and env policy in `asset_rolls`; write the inventory source as `gacha`.
- Route must be protected by `rateLimit()`, HTTP `idempotency()`, and persistent
  roll idempotency so retries do not spend twice.
- Expose a read endpoint for pack odds before paid gacha is enabled:
  `GET /api/assets/packs/:packId/odds`.

Future seasonal pack target:

- A season can have multiple collections and packs.
- Packs have sale windows; old packs become unavailable for purchase/roll when
  `status != active` or outside `starts_at`/`ends_at`.
- Packs can return 5-10 assets per roll.
- Rarity groups support configured drop rates and guarantees, such as at least
  two rare-or-better cards in a 10-pull.
- One secret asset can exist per collection/season with an explicit low weight
  and optional separate pity/guarantee policy.
- Duplicate handling should move from ownership rows to inventory instances or
  quantities before duplicate packs ship.
- Direct-trade and sales flows should lock instances in escrow before they are
  listed, traded, burned, or sold. Equipped instances must either be rejected
  for transfer or automatically unequipped in the same transaction.

Deferred mechanics, with schema direction:

- Duplicate burn/exchange: add `asset_duplicate_balances` or
  `player_asset_instances`, then `burnAssets(playerId, assetIds)` can exchange
  five common duplicates for one random rare from an eligible pool.
- Trading: add listing/escrow tables (`asset_trade_listings`,
  `asset_trade_offers`, `asset_trade_escrows`) so sales and swaps are atomic and
  assets cannot be equipped/transferred twice.
- Player sales: reuse wallet transactions for buyer debit and seller credit,
  with platform fee metadata if needed.

## Phase 6 - Generalize Reward And Progression Names

Do this after the wallet is real, so the rename has a stable destination.

1. Rename character-bound `mycelium` concepts in code to `characterXp` /
   `character_xp`.
2. Rename database fields with compatibility migrations:
   - `player_mushrooms.mycelium` -> `character_xp`
   - `game_rounds.mycelium_awarded` -> `character_xp_awarded`
   - `battle_rewards.mycelium_delta` -> `character_xp_delta`
   - `player_season_archives.reward_mycelium` -> either
     `reward_character_xp` or a wallet reward, depending on the chosen reward
     design.
3. Rename config and helpers:
   - `MYCELIUM_LEVEL_CURVE` -> `CHARACTER_XP_LEVEL_CURVE`
   - `computeLevel(mycelium)` -> `computeCharacterLevel(characterXp)`
   - `WIKI_TIER_THRESHOLDS` comments and call sites to `characterXp`.
4. Rename temporary run-shop currency where practical:
   - `game_run_players.coins` -> `run_currency` or `run_coins`
   - API payload `player.coins` may stay for one compatibility release, but
     internal services should use `runCoins` / `runCurrency`.
5. Update docs, tests, and i18n after each rename batch so requirement IDs keep
   matching executable coverage.

## Phase 7 - Currency, Purchase, And Asset Tests

Backend tests:

- Profile wallet balance is shared across active characters.
- All current `players.spore` reward sources grant through wallet service:
  solo round rewards, challenge round rewards, completion bonuses, challenge
  winner bonuses, and season archive rewards.
- `players.spore` compatibility mirror matches `player_wallet_balances` after
  grants and spends.
- Coin purchase completion grants wallet currency exactly once.
- Telegram pre-checkout accepts only known pending purchase intents with exact
  amount/currency; unknown, stale, or mismatched payloads are rejected.
- Forged or duplicate successful-payment updates do not grant wallet currency.
- Coins earned while playing Thalla can buy an Axilin skin or another eligible
  asset.
- Purchasing an asset debits the wallet exactly once and creates one ownership
  instance.
- Repeated purchase of an already owned asset is idempotent or rejected without
  double debit, depending on the chosen contract.
- Wallet spend cannot make the balance negative under concurrent requests.
- With `ASSET_GACHA_ENABLED=false`, direct skin purchase remains available.
- With gacha enabled and policy blocking gacha assets, direct purchase rejects
  configured gacha-pack skins.
- A gacha roll spends wallet currency and grants one unowned skin from the pack.
- A gacha roll with no unowned candidates rejects without spending currency.
- Gacha rolls use a deterministic fake RNG in tests through dependency
  injection, while production uses cryptographic randomness.
- Pack sale windows prevent rolling expired / inactive packs.
- Run-shop purchases still debit only run currency.
- Selling run artifacts still refunds only run currency.
- Character XP still advances only the played character.
- Portrait ownership no longer depends on character XP.
- Battle snapshots keep the equipped portrait id/path after the asset migration,
  and old snapshots still replay without current ownership rows.

Frontend / E2E tests:

- Profile screen or asset shop shows wallet balance, prices, owned state, locked
  affordability state, purchase, and equip.
- Buying a skin on one character and switching active character does not change
  wallet ownership.
- Coin purchase UI creates a purchase intent, opens the provider invoice from a
  user action, and reflects the updated wallet after verified completion.
- If gacha is enabled, gacha-pack skins show roll acquisition instead of direct
  buy, while direct-only skins still show direct buy.
- Home roster portrait swatches keep working with the compatibility
  `progression[mushroomId].portraits[]` payload until a dedicated store screen
  replaces them.
- Existing run prep HUD still shows run currency and does not confuse it with
  wallet currency.
- Screens touched by the wallet / skin UI need fresh mobile and desktop
  screenshots plus layout assertions per repo UI rules.

## Phase 8 - Prepare Core Extraction Boundary

Only start extracting after the currency names above are clean enough that the
core package does not inherit Mushroom-specific vocabulary.

Move mechanics that are already close to product-neutral:

- Bag shapes and rotation: `app/shared/bag-shape.js`
- Grid cells, piece placement, overlap, bag coverage, and loadout validation:
  `app/server/services/loadout-utils.js`
- Item pricing and run-budget validation, parameterized by catalog accessors.
- Shop offer generation, parameterized by item pools, RNG, bag chance, and
  product-specific eligibility hooks.
- Fusion matching: `app/shared/artifact-fusions.js` plus the pure matching part
  of `app/server/services/artifact-fusion-service.js`.
- RNG helpers such as seeded random and shuffle.
- Battle simulation only after the hard-coded mushroom ability switch is moved
  behind configurable ability hooks or a product adapter.

Keep these in `mushroom-master`:

- Mushroom definitions, names, lore, portraits, wiki, achievements, seasons, and
  home field.
- Telegram auth, Express routes, SSE, database models, migrations, and
  persistence services.
- Product-specific asset catalogs and localized UI copy.
- Any code that references `player_mushrooms`, `PORTRAIT_VARIANTS`, wiki
  thresholds, or Mushroom lore directly.

## Phase 9 - Create `backpack-game-core`

Initial package shape:

```text
backpack-game-core/
  package.json
  src/
    grid/
    loadout/
    shop/
    fusion/
    battle/
    rng/
    index.js
  tests/
  README.md
```

Recommended initial choices:

- Use ESM JavaScript first to reduce migration risk from the current codebase.
  Add TypeScript declarations or migrate to TypeScript after the API stabilizes.
- Export pure functions only in the first pass. No database, Express, Telegram,
  filesystem, or image dependencies.
- Require catalogs/config through function arguments instead of imports from
  `mushroom-master`.
- Copy or port the relevant unit tests into the core repo before swapping
  imports in `mushroom-master`.
- Publish or consume via a pinned git dependency first; add it as a hub submodule
  only after the first useful commit exists.

## Phase 10 - Integrate Core Back Into `mushroom-master`

1. Add `backpack-game-core` as a dependency.
2. Replace local imports in `mushroom-master` one cluster at a time:
   - `bag-shape`
   - placement / validation
   - fusion matching
   - shop generation
   - battle engine, only when adapterized
3. Keep adapter files in `mushroom-master` where product data is passed into
   core functions.
4. Run the relevant Mushroom Battles verification after each cluster:
   - `npm run game:test`
   - targeted Playwright specs for UI-facing changes
   - `npm run game:test:e2e` before final handoff
5. Update hub metadata only after the core repo has a committed SHA:
   - `SUBMODULES.md`
   - `submodules.manifest.json`
   - hub submodule pointer if the repo is added as a submodule

## Risks And Guardrails

- Avoid a big-bang rename plus extraction. First make the currency model clean
  inside `mushroom-master`; then extract mechanics.
- Keep compatibility aliases for one release where API payloads or old dev DBs
  might still use `coins`, `mycelium`, or `active_portrait`.
- Do not move Sequelize models into the core package. The core should not know
  which product owns persistence.
- Treat hard-coded Mushroom ability logic as product-specific until the battle
  engine has a clear hook interface.
- Do not let "profile wallet coins" and "run shop coins" share one field or
  service method. They have different lifetimes, spend targets, and refund
  rules.
- Do not wire gacha to a product-specific route shape. Keep it as an asset
  acquisition service that Mushroom Battles can use or disable.
- Keep payment-provider code out of wallet accounting. Provider callbacks prove
  payment; wallet services grant/spend balances.
- Do not allow direct client-supplied rarity, result asset id, or payment status
  to affect gacha outcomes or coin grants.

## Proposed Implementation Order

1. Requirements update for profile wallet, asset ownership, and neutral names.
2. Wallet models + backfill from `players.spore` + wallet service + backend
   tests.
3. Replace current profile-currency reward writes with wallet grants while
   maintaining the `players.spore` mirror.
4. Coin purchase intents + Telegram/provider adapter + idempotent wallet grant.
5. Static asset catalog + inventory instances + equipment schema + direct
   purchase/equip services.
6. Env-gated gacha MVP: static packs, weighted unowned roll, direct-buy policy,
   cryptographic RNG, and odds endpoint.
7. Bootstrap/API/UI updates for profile wallet, direct skins, and optional
   gacha packs.
8. Rename character XP and run currency internals, keeping compatibility where
   needed.
9. Extract pure grid/loadout/fusion/shop helpers to `backpack-game-core`.
10. Adapterize and optionally extract battle simulation.
11. Add hub/submodule metadata and final cross-repo verification.
