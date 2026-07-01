# Profile Currency And Core Extraction Plan

> **Reading guide (updated 2026-07-01 post-implementation review).** This document
> is a historical ship record plus forward plan, not a live status board. The
> shipped, test-backed foundation is Phases **1-5, 6A-6C, 7, 7A, and 7B**.
> Phase **6A-6C** shipped as a compatibility-safe neutral naming pass:
> `characterXp` is the primary progression helper/export with legacy
> `mycelium` aliases, and run player/shop responses expose `runCurrency` /
> `runCoins` while keeping legacy `coins`. The physical database rename
> (`mycelium`→`character_xp`, `coins`→`run_currency`) remains optional Phase
> **6D** work, not a launch blocker. The
> authoritative current backlog is the **Remaining launch gates** under Phase 7B
> plus the Deferred list. Code movement into `backpack-game-core` has started
> with bag-shape, first grid-geometry primitives, fusion matching, and shop-offer
> generation; broader extraction should continue one pure or adapterized cluster
> at a time. Shipped
> runtime contracts (wallet ledger, purchase
> intents, asset ownership, gacha) should be read from the code,
> `tests/game/wallet-assets.test.js`, and the current reference doc
> `docs/game-core-runtime-contracts.md` rather than re-derived from this plan's
> phase sections.
> See the **Post-Implementation Review** section for the verified state and
> current remaining work. As of the latest implementation pass, **Phase 8A/8B**
> is complete via `docs/game-core-runtime-contracts.md` and
> `docs/backpack-game-core-extraction-inventory.md`; **Phase 8C** has moved
> bag-shape helpers, first grid-geometry primitives, fusion matching, and
> shop-offer generation into `backpack-game-core`.

**Status:** Phases 1-5, 6A-6C, 7, 7A, 7B, 8A, 8B, and the first Phase 8C slices
implemented as the Mushroom Battles
compatibility foundation (Phases 1-5 and 7 on 2026-06-22; Phase 7A hardening on
2026-06-23; Phase 7B paid-readiness/UI hardening and Phase 6A-6C neutral naming
on 2026-07-01; Phase 8A-8C first-slice extraction on 2026-07-01). Phase 6D remains an optional database-breaking rename and
should only happen after external consumers no longer depend on raw legacy
column names.
Real-money rollout still requires provider sandbox/live validation,
product/legal support, terms/refund/age/content compliance gates, and
operational handling for post-completion refunds/reversals/late crypto edge
cases.
**Created:** 2026-06-22
**Primary repo:** `mushroom-master`
**Target reusable core repo:** `git@github.com:MicrowaveDev/backpack-game-core.git`

`backpack-game-core` now has `main` commits with the extracted bag-shape
helpers, first grid-geometry primitives, fusion matching, and shop-offer
generation. Earlier notes that treated the target repo as empty are historical
only.

## Implementation Status

Phases 1-5, 6A-6C, 7, 7A, and 7B are complete for the Mushroom Battles
compatibility milestone (Phase 6D is optional and deferred — see the naming
bullet below):

- Requirements now define three separate ledgers: temporary run coins,
  profile wallet currency, and character XP / mastery.
- Profile wallet tables and `wallet-service.js` are the source of truth for
  persistent soft currency, with `players.spore` kept as a compatibility mirror.
- Coin purchase intents are provider-neutral, with Telegram Stars handling,
  BTCPay / NOWPayments checkout adapters, retry-safe idempotent checkout
  creation, provider-specific webhook signatures, and callback amount/currency
  validation where provider data is available.
- Profile-scoped asset instances and equipped assets now own and equip portrait
  skins without binding purchase ownership to a character.
- The backend supports direct asset purchases when gacha is off and an
  environment-gated gacha MVP that rolls an unowned asset from configured packs.
- API responses now expose `wallet`, `asset`, `characterXp`, and run-currency
  aliases (`runCurrency`, `runCoins`) while preserving legacy response aliases.
  `CHARACTER_XP_LEVEL_CURVE` / `computeCharacterLevel` are the primary helper
  exports, with `MYCELIUM_LEVEL_CURVE` / `computeLevel` kept as compatibility
  wrappers over the unchanged database columns. The underlying Phase 6D
  database rename (`mycelium`→`character_xp`, `coins`→`run_currency`) has
  **not** been performed.
- Backend and UI tests cover wallet earns/spends, atomic spend rejection,
  provider checkout creation and retry reuse, provider completion,
  amount/currency mismatch rejection, terminal payment states, direct purchase,
  gacha policy, portrait equipment, payment webhook signatures, Telegram webhook
  allowed updates, wallet drift audit/backfill, and home-screen purchase/gacha
  controls.
- The first reusable mechanics slice is extracted: bag-shape masks, rotation,
  effective dimensions, shape-cell checks, and shape area now live in
  `backpack-game-core`, with `app/shared/bag-shape.js` kept as a compatibility
  re-export for existing Mushroom server/client imports.
- The first grid-geometry primitives are extracted: `pieceCells`, `cellSet`,
  `setsIntersect`, and `cellKey` now live in `backpack-game-core`.
  `loadout-utils.js` re-exports `pieceCells` for existing Mushroom callers
  while keeping catalog-backed validation in product code.
- Pure fusion matching is extracted: adjacency search, duplicate row
  consumption, ingredient result shaping, and `fusionIngredientRowIdSet` now
  live in `backpack-game-core`. Mushroom recipe data and eligibility policy
  stay in `app/shared/artifact-fusions.js` via a `canUseIngredient` hook.
- Pure shop-offer generation is extracted: pool sampling, bag pity, bag chance
  escalation, and character-item slot reservation now live in
  `backpack-game-core`. Mushroom combat pools, bag pools, character-item pools,
  and balance constants stay in `shop-service.js`.

Phase 7A closed the code-level paid-economy hardening gaps found on
2026-06-23: wallet debits now use atomic updates, wallet mutations are
serialized per player in-process, provider adapters can create Telegram Stars,
BTCPay, and NOWPayments checkout metadata, webhooks have provider-specific
signature tests, Telegram Mini App vs web payment surfaces are encoded,
selective gacha catalog policy is configurable, and the home screen has a
wallet-buy entry point.

Phase 7B closed the local paid-readiness gaps found on 2026-07-01: idempotent
checkout retries reuse one external invoice in-process, crypto webhook
completion validates normalized fiat amount/currency and can re-fetch BTCPay
invoice details, terminal provider statuses are recorded without granting
currency, unsigned payment webhooks fail closed outside `NODE_ENV=test` unless
`PAYMENT_WEBHOOK_ALLOW_UNSIGNED_DEV=true`, a wallet drift audit/backfill script
exists, the home screen exposes server-provided wallet bundles/providers, and
rollable portraits now call the gacha pack roll endpoint.

This is still not a paid production rollout. Remaining launch gates are:
real provider sandbox/live validation, real Telegram invoice/manual webhook
testing, purchase UI terms/refund/support presentation, age/content-compliance
gating for adult or sexual content, and operational runbooks plus tooling for
post-completion refunds, reversals, chargebacks/disputes, late crypto payments,
overpayments, and support investigations.

Next local lane after the current Phase 8C slices: adapterize bot loadout
generation over catalog, affinity, preset, and price providers. Deferred beyond
that: optional Phase 6D database renames / physical removal of legacy
compatibility fields, multi-item pack guarantees, duplicate burning, marketplace
trading, database managed pack catalogs, an expanded terms/support frontend,
provider refund and reversal handling, distributed payment mutation hardening,
and broader code movement into `backpack-game-core`.

## Post-Implementation Review

Updated 2026-07-01 from a read-through of the current `main` implementation in
`wallet-service.js`, `asset-service.js`, `create-app.js`, `bot-gateway.js`,
`web/src/composables/useCustomization.js`, `web/src/pages/HomeScreen.js`, and
`tests/game/wallet-assets.test.js`; refreshed after Phase 7B and Phase 6A-6C
implementation on 2026-07-01. This review intentionally does not treat the
plan's own status text as evidence.

### Verified as shipped

- Wallet ledger (`player_wallet_balances`, `player_wallet_transactions`),
  `grantCurrency` / `spendCurrency` / `getWalletState`, per-player in-process
  mutation lock, and atomic debit via `UPDATE ... WHERE balance + $delta >= 0
  RETURNING balance` in `app/server/services/wallet-service.js`.
- Provider-neutral purchase intents with `telegram_stars`, `btcpay`, and
  `nowpayments` adapters, surface policy (`WALLET_PAYMENT_SURFACES`), and
  idempotent completion keyed by `wallet_purchase:${id}`.
- Idempotent purchase-intent checkout creation is guarded by in-process keyed
  locks; retrying the same idempotency key reuses the same provider invoice
  metadata instead of fanning out provider invoices in a single app process.
- Provider webhook signatures match the plan: BTCPay HMAC-SHA256 over the raw
  body; NOWPayments HMAC-SHA512 over key-sorted JSON
  (`nowPaymentsSignaturePayload` in `app/server/create-app.js`). Unsigned
  provider webhooks now fail closed outside tests unless explicitly opted in
  with `PAYMENT_WEBHOOK_ALLOW_UNSIGNED_DEV=true`.
- Crypto payment completion validates normalized fiat amount/currency when the
  callback or fetched BTCPay invoice exposes it; terminal provider states such
  as expired/failed/refunded/cancelled/underpaid/overpaid are recorded without
  granting currency.
- Wallet mirror data ops now exist: `auditWalletMirror`,
  `backfillMissingWalletBalancesFromPlayers`, and
  `npm run game:wallet:audit`.
- Asset ownership/equipment (`player_asset_instances`,
  `player_equipped_assets`), `purchaseAsset` / `equipAsset`, env-gated gacha
  with crypto RNG (`crypto.randomInt`), candidate-pool hashing, and odds
  endpoint in `app/server/services/asset-service.js`.
- The home screen has a wallet bundle/provider picker sourced from
  `/api/wallet/bundles`, opens Telegram invoice links or crypto checkout URLs,
  and uses the backend `rollAvailable` flag to roll eligible gacha portraits.
- Neutral compatibility naming is shipped for the reusable-core boundary:
  progression code uses `CHARACTER_XP_LEVEL_CURVE` / `computeCharacterLevel`,
  profile progression exposes `characterXp`, and run/shop response payloads
  expose `runCurrency` plus `runCoins` alongside legacy `coins`.
- All `players.spore` reward writes routed through `grantCurrency` with
  persistent idempotency keys in `app/server/services/run-service.js`.
- Requirements 4-X / 4-Y / 4-Z and the portrait-purchase model in
  `docs/game-requirements.md`; ghost-portrait contract aligned with
  `resolveEquippedPortraitId`.

### Gaps and corrections (now reflected above)

1. **Phase 6D database rename is not done.** This is deliberate: legacy columns
   remain in place while API and service aliases provide the reusable-core
   boundary.
2. **Provider sandbox/live validation is not done.** The code paths are covered
   by local fake-provider tests, but BTCPay/NOWPayments credentials, callback
   payloads, and Telegram Stars invoice behavior still need sandbox/live
   verification before real money.
3. **Terms/refund/support and age/content gates are product/legal work.** The
   backend has `/paysupport` and `/terms` bot replies, but the web purchase
   surface still needs final public support/terms URLs, refund wording, and
   adult-content/payment-processor compliance decisions.
4. **Refund/reversal handling is still operational, not automated.** Terminal
   non-completed statuses are recorded before grant, but completed-payment
   refunds, chargebacks/disputes, provider reversals, and late crypto review do
   not yet claw back wallet currency or open support cases automatically.
5. **The wallet mutation lock is process-local.** Atomic SQL debits protect the
   balance row, and uniqueness constraints roll back duplicate active assets,
   but multi-instance deployments still need database row locks/advisory locks
   or conflict-aware retries for nicer direct-purchase/gacha behavior under
   simultaneous requests.
6. **The current gacha is intentionally MVP-only.** It is one-result-per-roll,
   static/env configured, no pity/guarantees, no duplicate inventory, no burn
   exchange, no marketplace, and no database-managed seasons/collections.
7. **Core extraction is still not started.** The next step is choosing the first
   pure helper cluster to extract while keeping `spore`, Mushroom portraits,
   Telegram auth, Sequelize models, and home-field code out of
   `backpack-game-core`.

### Recommended follow-ups

- Keep this plan as a historical ship record; treat the Deferred list and the
  Phase 7B **Remaining launch gates** as the live backlog.
- Keep the optional Phase 6D database rename separate from reusable-core
  extraction unless raw legacy column names become a real blocker.
- Before any paid pilot, the true blockers are provider sandbox/live validation,
  final terms/support/refund and age/content compliance, refund/reversal/late
  crypto operations, and distributed mutation hardening if more than one app
  instance will process payments.
- Extract the shipped wallet / asset / gacha runtime contracts into a dedicated
  `docs/` reference doc (the `docs/infra-hardening.md` pattern) so future agents
  read current behavior from a reference, not from this plan's phase sections.
  Done for the current core boundary in `docs/game-core-runtime-contracts.md`.
- Before moving mechanics into `backpack-game-core`, do a narrow import-boundary
  inventory and pick the first pure cluster from evidence. Do not start with
  payment, wallet, asset ownership, gacha, portraits, Telegram, database models,
  or the battle engine. Done in
  `docs/backpack-game-core-extraction-inventory.md`; the first slice is
  bag-shape helpers.

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
- **Recommendation after payment-provider review:** do not choose a single
  payment provider. Use a provider-neutral purchase-intent layer with three
  adapters:
  1. `telegram_stars` for frictionless Telegram-native wallet purchases.
  2. `btcpay` for self-custodial crypto payments with the lowest platform-fee
     and shutdown risk.
  3. `nowpayments` as the hosted crypto fallback for better multi-coin UX and
     conversion tools when self-hosted crypto is too much operational overhead.
- Decide whether existing portrait variants become one-time purchases at their
  current `cost` values, or whether those values need a balance pass before the
  purchase model ships.
- Decide what happens when a gacha pool has no unowned skins left: reject the
  roll, grant duplicate dust/shards, or allow duplicate instances. The MVP below
  recommends rejecting until duplicate mechanics are implemented.

## Pre-Implementation State Snapshot

Historical snapshot from 2026-06-22 before Phases 1-5, 7, and 7A shipped. This
section explains why the plan was shaped this way; it is not the current runtime
contract. For the current state, use the Implementation Status and
Post-Implementation Review sections above.

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
6. **Add a censorship-resistant crypto rail.** Hosted crypto gateways still have
   terms, KYB, sanctions screening, and shutdown risk. For legal adult-oriented
   game content, the most robust crypto option is a self-hosted BTCPay Server
   adapter because it has no processor account to terminate; payments go direct
   to the merchant wallet. Keep hosted gateways as convenience adapters, not the
   only crypto path.
7. **Use cryptographic randomness for gacha.** Do not reuse game `createRng`
   seeds for paid rolls. Use server-side cryptographic randomness, record the
   chosen candidate pool and result, and keep enough metadata to investigate
   support claims.
8. **Expose acquisition policy in bootstrap/app config.** The client needs to
   know whether direct buy or roll is available for each asset. Keep the old
   portrait array shape for compatibility, but add fields like `owned`,
   `price`, `currencyCode`, `acquisitionMode`, `purchaseAvailable`, and
   `rollAvailable`.
9. **Add odds, terms, and support hooks before paid gacha.** If real-money
   currency buys rolls, the backend should expose pack odds and the UI should
   link terms/support. This is a launch gate, not polish.
10. **Add adult-content compliance gates before enabling processors.** Payment
    stability requires more than choosing a tolerant processor. Add clear
    content rules, age gates where needed, terms, support/contact pages, and a
    hard prohibition on unlawful sexual content, minors/CSAM, non-consensual
    material, or anything forbidden in the merchant's jurisdictions.

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

### Crypto provider recommendation

Revalidated against public provider docs on 2026-07-01:

- Telegram's official Bot Payments API for digital goods says bots and Mini
  Apps selling digital goods/services inside Telegram apps must use Telegram
  Stars, not cryptocurrency:
  <https://core.telegram.org/bots/payments-stars>.
- BTCPay's official site/docs still describe a self-hosted, open-source Bitcoin
  payment processor with no platform processing/subscription fees and merchant
  control of funds:
  <https://btcpayserver.org/> and <https://docs.btcpayserver.org/Guide/>.
- NOWPayments still publicly advertises 0.5% monocurrency / 1% conversion
  service fees and an adult-industry solution page:
  <https://nowpayments.io/pricing> and
  <https://nowpayments.io/all-solutions/adult>.

Treat this as a dated provider-policy snapshot, not a permanent guarantee. Fees,
accepted categories, KYB/AML requirements, sanctions controls, and adult-content
policy can change; re-check provider docs and account terms before every paid
pilot or geography expansion.

Use provider adapters in this order:

1. **BTCPay Server (`btcpay`) — primary censorship-resistant crypto rail.**
   - Best fit when the project may include legal adult-oriented in-game content
     and the team wants the lowest shutdown risk.
   - BTCPay is self-hosted/open-source. Its docs describe direct peer-to-peer
     Bitcoin payments, no processor/middleman, no processing fees, and merchant
     control of funds:
     - <https://btcpayserver.org/>
     - <https://docs.btcpayserver.org/Guide/>
   - Tradeoff: worse mainstream UX than a hosted gateway unless the user already
     has Bitcoin/Lightning; no built-in fiat settlement; team owns server,
     wallet, backups, monitoring, legal/tax handling, and refund/support ops.
   - MVP scope: Bitcoin + Lightning invoices only; add altcoins later only if
     there is actual demand.
2. **NOWPayments (`nowpayments`) — hosted multi-coin convenience fallback.**
   - Best fit when the team wants good UX across many coins, hosted invoices,
     conversion options, and less ops work than BTCPay.
   - Current public pages advertise 0.5% for monocurrency payments and 1% with
     conversion, 350+ coins, and adult-business solutions:
     - <https://nowpayments.io/>
     - <https://nowpayments.io/all-solutions/adult>
   - Tradeoff: hosted provider, so there is still account, KYB/AML, third-party,
     jurisdiction, and policy risk. Do not make it the only crypto path.
3. **CoinGate (`coingate`) — optional backup if legal/compliance review fits.**
   - Public pricing is 1% payment processing, no monthly fees:
     <https://coingate.com/pricing>
   - Its general terms prohibit adult content only when there is no age
     verification or when content breaches applicable laws/content rules:
     <https://coingate.com/policy/general-terms-and-conditions>
   - Tradeoff: more expensive than NOWPayments/BTCPay and likely heavier
     compliance review.

Avoid for this use case:

- **Coinbase Commerce / Coinbase Payments**: Coinbase policies restrict adult
  content/services, and it is not a good fit for adult-adjacent risk.
- **Stripe/PayPal/card processors** for this specific rail: many prohibit or
  heavily restrict adult/mature-audience content and have higher shutdown risk.
- **BitPay** as first choice: current pricing is materially higher for low
  volume (`2% + 25c` under $500k/month, with high-risk fees possible), and adult
  suitability is less clear than the options above.
- **High-risk/opaque crypto processors** with weak compliance posture: they can
  create regulatory and reputation risk even if onboarding is easy.

Implementation consequence:

- `wallet_purchase_intents.provider` must be an enum-like string, not a table
  hardcoded around Telegram.
- Store provider-specific invoice/payment fields in `metadata_json`, but always
  normalize core fields: `provider`, `provider_invoice_id`,
  `provider_payment_id`, `price_currency`, `price_amount`, `wallet_amount`,
  `status`, and `completed_at`.
- Add provider-specific status handlers:
  - Telegram: bot webhook `pre_checkout_query` / `successful_payment`.
  - BTCPay: invoice webhook with HMAC/secret verification.
  - NOWPayments: IPN webhook with signature verification.
- The wallet service must not care which provider completed the purchase.

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

> **Status (updated 2026-07-01): Phases 6A-6C shipped.** The reusable-core
> compatibility boundary is now in place without a database-breaking rename:
> `CHARACTER_XP_LEVEL_CURVE` / `computeCharacterLevel` are primary helper names,
> legacy `MYCELIUM_LEVEL_CURVE` / `computeLevel` remain wrappers, profile
> progression exposes `characterXp`, and run player/shop payloads expose
> `runCurrency` / `runCoins` alongside legacy `coins`. Phase 6D physical column
> renames remain optional later work.

Do this after the wallet is real, so the rename has a stable destination. Do
not combine this with provider sandbox validation, refund tooling, paid
compliance gates, or `backpack-game-core` extraction.

### Phase 6A - Freeze Compatibility Contract

Status: **Complete for the current API surface.**

- Inventory every externally visible legacy field before editing:
  `progression[].mycelium`, `progression[].characterXp`, run player `coins`,
  `players.spore`, wallet `soft_coin`, and reward history fields.
- Add or update tests that prove old response fields still exist while new
  neutral aliases exist.
- Define the compatibility window explicitly:
  - API keeps `mycelium` and `coins` aliases for the current Mushroom Battles
    frontend and existing tests.
  - New internal code prefers `characterXp`, `runCurrency`, and `wallet`.
  - Database column renames wait until after the code can read/write through
    neutral helpers.

### Phase 6B - Character XP Internal Naming

Status: **Complete for shared helper exports and touched services.** Raw SQL
column names and historical reward fields intentionally keep `mycelium`.

- Rename character-bound `mycelium` concepts in service code to
  `characterXp` / `character_xp` where they are not database column names.
- Keep database columns unchanged in this subphase:
  - `player_mushrooms.mycelium`
  - `game_rounds.mycelium_awarded`
  - `battle_rewards.mycelium_delta`
  - `player_season_archives.reward_mycelium`
- Introduce neutral helpers/exports and keep legacy aliases:
  - `MYCELIUM_LEVEL_CURVE` -> `CHARACTER_XP_LEVEL_CURVE` plus legacy export.
  - `computeLevel(mycelium)` -> `computeCharacterLevel(characterXp)` plus
    legacy wrapper.
  - service variables should prefer `characterXp`, while SQL aliases can still
    map from `mycelium AS character_xp` or shape rows manually.
- Update tests and docs after the batch; do not change player-facing copy unless
  it refers to implementation vocabulary.

### Phase 6C - Run Currency Internal Naming

Status: **Complete for backend run/shop API aliases.** The current Mushroom UI
can continue reading `coins`; core consumers can read `runCurrency` or
`runCoins`.

- Rename temporary run-shop currency concepts in service/frontend code to
  `runCurrency` or `runCoins` where they are not database column names.
- Keep `game_run_players.coins` and API `player.coins` as compatibility aliases
  in this subphase.
- Make the separation explicit in docs and tests:
  - run currency buys artifacts and refreshes inside a run only.
  - wallet currency buys profile assets and paid bundles.
  - character XP gates character progression only.

### Phase 6D - Optional Database Rename, Later

Status: **Deferred.** Only start this after confirming the frontend, tests, and
any analytics/export consumers no longer depend on raw legacy column names.

- Rename database fields with compatibility migrations or dual-read/dual-write
  shims:
  - `player_mushrooms.mycelium` -> `character_xp`
  - `game_rounds.mycelium_awarded` -> `character_xp_awarded`
  - `battle_rewards.mycelium_delta` -> `character_xp_delta`
  - `game_run_players.coins` -> `run_currency` or `run_coins`
  - `player_season_archives.reward_mycelium` -> either
    `reward_character_xp` or a wallet reward, depending on the chosen reward
    design.
- Preserve rollback/read compatibility for one release. The final removal of
  legacy columns/aliases is a separate cleanup task, not part of the safe rename
  pass.

### Phase 6 Verification

- Executed on 2026-07-01:
  `node --test tests/game/mushroom-progression.test.js tests/game/game-run.test.js tests/game/round-resolution.test.js`
  (99 tests passed).
- Focused unit tests for reward projection, run player payloads, and wallet
  separation.
- `node --test tests/game/wallet-assets.test.js`
- The cheapest broader game test that covers run rewards/progression after the
  touched files are known.
- Full e2e/screenshot wrappers only if frontend visible surfaces change.

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

## Phase 7A - Post-Implementation Hardening Before Paid Rollout

Added after post-implementation review on 2026-06-23. Code-level hardening for
this phase is implemented, but paid rollout still needs the external provider,
support, legal, and content-compliance launch gates listed below. Phases 1-7
created the compatibility foundation; Phase 7A closes the most important money,
policy, and coverage gaps in code.

### Completed in code

1. Wallet debits are atomic under concurrency.
   - Replace read-compute-write balance updates with an atomic debit, for
     example `UPDATE player_wallet_balances SET balance = balance + $delta
     WHERE player_id = $playerId AND currency_code = $currencyCode AND balance
     + $delta >= 0 RETURNING balance`, or a dialect-aware row lock in
     PostgreSQL.
   - Keep transaction rows and the `players.spore` compatibility mirror in the
     same transaction as the atomic balance update.
   - Added tests where concurrent wallet spends cannot overdraw the wallet.
2. Provider invoice / checkout creation exists beyond bare purchase intents.
   - Telegram Stars: create a payable invoice via Bot API `sendInvoice` or
     `createInvoiceLink`, return an invoice link usable by
     `Telegram.WebApp.openInvoice(...)`, and refresh wallet state only after
     the `successful_payment` webhook.
   - BTCPay: call the Greenfield invoice API, store the returned invoice id,
     checkout link, payment URI, and order metadata, then complete only on
     settled invoices.
   - NOWPayments: create a payment with `ipn_callback_url`, store payment id /
     invoice URL, and complete only after a verified finished/confirmed IPN.
   - Keep the rule that client requests can create intents but can never mark
     them as paid.
3. Payment webhook verification is provider-specific and tested.
   - BTCPay verification must compare `BTCPAY-Sig` against HMAC-SHA256 of the
     raw request body and the webhook secret.
   - NOWPayments verification must sort the parsed callback body by key before
     HMAC-SHA512 comparison with `x-nowpayments-sig`; signing the raw JSON body
     is not enough for real NOWPayments callbacks.
   - Add positive and negative signature tests for both providers, plus ignored
     status tests for incomplete payments.
4. Payment-surface policy is encoded.
   - Inside Telegram bots / Mini Apps, digital goods should use Telegram Stars.
     Telegram's current Stars docs say bots and Mini Apps selling digital goods
     must use Stars inside Telegram apps, not crypto or third-party providers.
   - Crypto purchases should therefore be an external web checkout rail unless
     product/legal review explicitly chooses a different surface and accepts the
     platform risk.
   - Add provider availability config by surface, for example
     `wallet.paymentProviders.telegramMiniApp = ['telegram_stars']` and
     `wallet.paymentProviders.web = ['btcpay', 'nowpayments']`.
5. First support hooks are present.
   - Add `/paysupport` bot handling or equivalent in-app support links before
     Stars purchases go live.
6. Gacha catalog configuration is selective.
   - Do not infer `acquisitionMode: 'both'` for every paid portrait forever.
     Move the MVP catalog policy into a static config / JSON module where each
     asset or collection can be `direct`, `gacha`, or `both`.
   - Keep Mushroom Battles direct-buy skins available when gacha mode is off,
     and keep direct-only skins buyable even when `ASSET_GACHA_ENABLED=true`.
   - Add a test where one paid skin is direct-only while another paid skin is
     gacha-pack-only under `block_gacha_assets`.
7. The ghost portrait contract is aligned.
   - `docs/game-requirements.md` currently says ghosts always use the default
     portrait, while the implementation resolves equipped portraits for real
     player ghost snapshots.
   - Choose the desired behavior, then align requirements, code, and tests in
     the same commit.

## Phase 7B - Paid Readiness And Product UX Hardening

Added after the 2026-07-01 post-implementation review. Code-level work in this
phase is implemented locally and covered by focused wallet tests plus build,
e2e, and screenshot checks. It does not replace provider sandbox/live validation
or legal/support/compliance rollout work.

### Completed in code

1. Checkout creation is retry-safe for in-process idempotent retries.
   - `createPurchaseIntent(...)` serializes same-player/provider/idempotency-key
     checkout creation and reuses existing checkout metadata.
   - Focused tests assert that concurrent retries create one provider invoice.
2. Provider callback amount/currency validation exists.
   - NOWPayments callback `price_amount` / `price_currency` are normalized
     before wallet grant.
   - BTCPay settlement can re-fetch invoice details and validate amount/currency
     when provider credentials and invoice id are available.
3. Payment lifecycle is broader than `pending|completed`.
   - Terminal non-completed statuses are recorded without granting wallet
     currency.
   - Completed-payment refunds/reversals still need operational handling below.
4. Webhook signature behavior fails closed outside tests unless explicitly
   opted in with `PAYMENT_WEBHOOK_ALLOW_UNSIGNED_DEV=true`.
5. Wallet data operations exist.
   - `npm run game:wallet:audit` reports `players.spore` / wallet mirror drift
     and can backfill missing wallet balance rows with `--fix`.
6. Product purchase UI exists at MVP level.
   - Home wallet UI loads `/api/wallet/bundles` for the active payment surface.
   - Telegram Stars opens invoice links; crypto providers open checkout URLs.
   - Rollable portrait swatches call the gacha pack roll endpoint.

### Remaining launch gates

- Validate Telegram Stars, BTCPay, and NOWPayments against real sandbox/live
  credentials and record callback payload examples.
- Set provider webhook secrets in every non-local environment.
- Replace the process-local wallet mutation lock with database row/advisory
  locks or conflict-aware retries before running multiple app instances that can
  process paid wallet, direct asset purchase, or gacha requests concurrently.
- Add final terms, refund/support contact, and payment-dispute copy reachable
  from the purchase UI.
- Add adult-content/age/compliance gates before enabling crypto providers:
  prohibit unlawful sexual content, minors/CSAM, non-consensual material, and
  anything forbidden in the merchant's jurisdictions or provider terms.
- Expand purchase/gacha UI beyond MVP: pending/failed/completed states,
  support/terms links, pack detail, odds display, active/expired/future pack
  states, and "no unowned assets left" handling.
- Add dedicated frontend/e2e coverage for wallet bundle listing, Telegram
  invoice opening, wallet refresh after verified payment, external checkout
  fallback, purchase failure states, and roll-only vs direct-only skins.
- Add frontend/e2e coverage that buying a skin while one mushroom is active
  makes it owned/equippable for the target mushroom without changing character
  XP.
- Add provider-specific operational notes and tooling for refunds, reversals,
  chargebacks/disputes, partial/late crypto payments, overpayments, and support
  investigations.

## Phase 8 - Prepare Core Extraction Boundary

Status: **Phase 8A/8B complete; Phase 8C next.** Phase 6A-6C made the currency
/ XP vocabulary clean enough for a reusable boundary. The runtime contract
reference and extraction inventory now exist, so the next step is the first
small pure extraction slice, not a broad code move.

Only start extracting after the currency names above are clean enough that the
core package does not inherit Mushroom-specific vocabulary.

### Phase 8A - Current Runtime Contract Reference

Status: **Complete.** See `docs/game-core-runtime-contracts.md`.

Create a dedicated current-state reference doc before moving code. Suggested
path: `docs/game-core-runtime-contracts.md`.

The reference should describe what the system does now, with code/test anchors:

- temporary run currency: legacy `coins` plus `runCurrency` / `runCoins` API
  aliases, scoped to one run player and spendable only on run artifacts,
  refreshes, and run-item refunds.
- profile wallet currency: profile-scoped wallet ledger, `players.spore`
  compatibility mirror, purchase intents, provider callbacks, and wallet
  grant/spend invariants.
- character XP: `characterXp` helper/API naming over legacy `mycelium` columns,
  progression-only and not stat scaling.
- asset ownership and gacha: profile-owned asset instances/equipment,
  direct-buy policy, env-gated gacha policy, and future seasonal-pack direction.
- non-core boundaries: Telegram auth, Express routes, database models,
  migrations, wallet/payment providers, Mushroom portraits/lore/wiki,
  achievements/seasons, home-field code, and UI copy.

Done when the reference doc points to the authoritative tests and modules, and
the plan links future extraction work to that reference instead of asking
agents to re-derive shipped behavior from old phase notes.

### Phase 8B - Extraction Inventory And First Slice Choice

Status: **Complete.** See
`docs/backpack-game-core-extraction-inventory.md`. The chosen first slice is
bag-shape masks and rotation from `app/shared/bag-shape.js`.

Before creating or editing `backpack-game-core`, map candidate modules with
their imports and classify them:

- **Pure candidate:** no database, Express, Telegram, filesystem, product lore,
  portraits, wallet, asset, or payment dependency.
- **Adapter-needed:** useful mechanics exist, but Mushroom-specific catalogs,
  eligibility, abilities, or persistence must be passed in from
  `mushroom-master`.
- **Product-specific:** keep in `mushroom-master`.

The first extraction slice should be the smallest low-risk pure cluster proven
by that inventory. Likely candidates are bag-shape/grid helpers, placement
validation, deterministic RNG/shuffle helpers, or pure fusion matching. Do not
start with the battle engine until hard-coded Mushroom abilities are behind a
clear product adapter.

Done when the plan records:

- the chosen first cluster and why it is pure enough,
- the exact source files and tests to port,
- the adapter surface `mushroom-master` will keep,
- verification commands for both repos,
- and rollback strategy if the core dependency integration fails.

### Phase 8C - Move First Pure Cluster

Status: **Complete for current slices.** Bag-shape masks/rotation, first
grid-geometry primitives, fusion matching, and shop-offer generation now live
in `backpack-game-core`. `mushroom-master` consumes bag-shape through the
compatibility re-export at `app/shared/bag-shape.js`; `loadout-utils.js`
imports/re-exports the core grid helpers while keeping Mushroom validation
policy local; `artifact-fusions.js` keeps Mushroom recipes/policy and calls the
core fusion matcher through a `canUseIngredient` hook; `shop-service.js` keeps
Mushroom pools/balance constants and calls the core shop-offer generator.

Only after 8A and 8B are complete:

1. Create or update `backpack-game-core` with the chosen pure cluster.
2. Port focused unit tests into the core repo before changing
   `mushroom-master` imports.
3. Swap `mushroom-master` to consume the core package for that one cluster.
4. Keep all product catalogs, persistence, wallet/asset/gacha code, and UI in
   `mushroom-master`.
5. Verify the core tests, then the focused Mushroom game tests that exercise the
   swapped cluster.

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
8. Phase 7A code hardening: atomic wallet debits, provider checkout creation,
   payment webhook verification, payment-surface policy, first support hooks,
   selective gacha catalog config, and initial frontend/screenshot coverage.
9. Phase 7B paid-readiness/UI hardening: idempotent checkout retry reuse,
   callback amount/currency validation, terminal status recording,
   fail-closed unsigned webhooks outside tests, wallet audit/backfill script,
   wallet bundle/provider picker, and rollable portrait UI.
10. Phase 6A-6C neutral naming pass: freeze compatibility contract, add
   character XP and run currency helper/API aliases while keeping legacy DB
   columns and response aliases. **Done 2026-07-01.**
11. Phase 8A current runtime contract reference:
   `docs/game-core-runtime-contracts.md`. **Done 2026-07-01.**
12. Phase 8B extraction inventory and first-slice choice:
   `docs/backpack-game-core-extraction-inventory.md`. **Done 2026-07-01.**
13. Phase 8C / Phase 9 first pure extraction into `backpack-game-core`:
   bag-shape masks and rotation, with tests ported before `mushroom-master`
   import swaps. **Done 2026-07-01 for the first slice.**
14. Split pure grid geometry helpers out of `loadout-utils.js` behind a
   Mushroom catalog/config adapter. **Done 2026-07-01 for `pieceCells`,
   `cellSet`, `setsIntersect`, and `cellKey`; validation remains local.**
15. Split pure fusion matching from Mushroom recipe catalog data.
   **Done 2026-07-01; Mushroom recipe data and eligibility policy remain
   local.**
16. Parameterize shop offer generation over passed item pools/config.
   **Done 2026-07-01; run-shop buy/refresh/sell mutations remain local.**
17. Adapterize bot loadout generation over catalog, affinity, preset, and price
   providers.
18. Adapterize and optionally extract battle simulation only after Mushroom
   ability logic has a product adapter.
19. Add hub/submodule metadata and final cross-repo verification if
   `backpack-game-core` is added to the hub manifest/submodule set.
20. Optional Phase 6D database rename only if raw legacy column names become a
   real extraction or analytics blocker.
21. Paid rollout readiness when external inputs are available: real provider
   validation, final terms/refund/support UI, adult/content-compliance gates,
   refund/reversal/late-payment tooling, distributed mutation hardening, and
   deeper frontend/e2e payment coverage.
22. Data operations after paid pilot: purchase-intent expiry/refund/reversal
   jobs, provider support runbooks, and periodic wallet drift monitoring.
