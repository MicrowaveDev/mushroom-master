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

### Stated criteria and constraints

- Write a markdown plan first.
- Do not make immediate implementation changes in this pass.
- First implementation priority is the coins / skin ownership adjustment.
- Skin-buying currency must be user-profile scoped, so a player can earn coins
  and spend them on any skin or future in-game asset.
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
- The backpack/autobattler core can be imported by `mushroom-master` and another
  game without importing Telegram auth, Mushroom lore, portraits, wiki,
  achievements, home-field code, or Sequelize models.

### Open ambiguity

- Decide whether the existing profile-level `players.spore` balance becomes the
  new spendable profile coin balance, or whether a new wallet currency starts
  from zero.
- Decide the player-facing name for the new persistent wallet in Mushroom
  Battles. The code should use neutral names such as `soft_currency`,
  `wallet_balance`, and `character_xp`; the UI may still localize that as coins,
  spores, or another thematic term.
- Decide whether existing portrait variants become one-time purchases at their
  current `cost` values, or whether those values need a balance pass before the
  purchase model ships.

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

## Vocabulary Target

Use this vocabulary before and during the core extraction:

| Concept | Current names | Target code / DB names | Scope |
|---|---|---|---|
| Temporary run-shop money | `coins`, `game_run_players.coins` | `run_currency`, `run_coins`, or `shop_currency` | One active run player |
| Persistent spendable wallet | `spore` or none | `wallet_balance`, `soft_currency`, `currency_code` | User profile |
| Character progression XP | `mycelium` | `character_xp`, `mastery_xp` | Player + character |
| Cosmetic asset ownership | `active_portrait` gate only | `player_assets`, `player_asset_unlocks`, `player_equipped_assets` | User profile |
| Portrait / skin catalog price | `PORTRAIT_VARIANTS[].cost` | `price`, `currencyCode`, `assetId`, `slot` | Catalog item |

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
- Enforce no-negative balances inside one database transaction.
- Use idempotency keys for run rewards and purchases.
- If `players.spore` becomes the new wallet, backfill it into
  `player_wallet_balances` and then either keep `players.spore` as a read-only
  compatibility alias for one release or remove it in a later migration.
- If a fresh wallet starts at zero, leave `players.spore` as legacy profile
  points until a separate cleanup.

## Phase 3 - Cosmetic Asset Ownership

1. Replace portrait-threshold semantics with catalog asset semantics:
   - `assetId`: stable globally unique id, for example `portrait.thalla.1`.
   - `slot`: `portrait`, later `home_field_skin`, `emote`, etc.
   - `targetType`: `character`, `global`, or future target families.
   - `targetId`: nullable; `thalla` for a Thalla-only portrait.
   - `price`: integer wallet price.
   - `currencyCode`: initially one code, for example `soft_coin`.
2. Add profile-scoped ownership:
   - `player_assets(player_id, asset_id, acquired_at, source, metadata_json)`.
   - A player either owns an asset or does not; ownership is not stored on
     `player_mushrooms`.
3. Add equipment state:
   - `player_equipped_assets(player_id, slot, target_type, target_id, asset_id)`.
   - Current portrait selection moves out of `player_mushrooms.active_portrait`
     once the compatibility path is no longer needed.
4. Replace `switchPortrait` with separate operations:
   - `purchaseAsset(playerId, assetId)` spends wallet currency and writes
     ownership.
   - `equipAsset(playerId, assetId)` validates ownership and target
     compatibility, then updates equipped state.
5. Preserve compatibility temporarily:
   - `GET /api/bootstrap` can still expose `progression[mushroomId].portraits`
     while sourcing `owned`, `price`, and `active` from the new asset tables.
   - `PUT /api/mushroom/:id/portrait` can become an equip-only compatibility
     route for one release, or be replaced by `/api/assets/:assetId/equip`.

## Phase 4 - Generalize Reward And Progression Names

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

## Phase 5 - Currency And Asset Tests

Backend tests:

- Profile wallet balance is shared across active characters.
- Coins earned while playing Thalla can buy an Axilin skin or another eligible
  asset.
- Purchasing an asset debits the wallet exactly once and creates one ownership
  row.
- Repeated purchase of an already owned asset is idempotent or rejected without
  double debit, depending on the chosen contract.
- Wallet spend cannot make the balance negative under concurrent requests.
- Run-shop purchases still debit only run currency.
- Selling run artifacts still refunds only run currency.
- Character XP still advances only the played character.
- Portrait ownership no longer depends on character XP.

Frontend / E2E tests:

- Profile screen or asset shop shows wallet balance, prices, owned state, locked
  affordability state, purchase, and equip.
- Buying a skin on one character and switching active character does not change
  wallet ownership.
- Existing run prep HUD still shows run currency and does not confuse it with
  wallet currency.
- Screens touched by the wallet / skin UI need fresh mobile and desktop
  screenshots plus layout assertions per repo UI rules.

## Phase 6 - Prepare Core Extraction Boundary

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

## Phase 7 - Create `backpack-game-core`

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

## Phase 8 - Integrate Core Back Into `mushroom-master`

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

## Proposed Implementation Order

1. Requirements update for profile wallet, asset ownership, and neutral names.
2. Wallet schema + wallet service + backend tests.
3. Cosmetic catalog + ownership/equip schema + purchase/equip services.
4. Bootstrap/API/UI updates for profile wallet and skins.
5. Rename character XP and run currency internals, keeping compatibility where
   needed.
6. Extract pure grid/loadout/fusion/shop helpers to `backpack-game-core`.
7. Adapterize and optionally extract battle simulation.
8. Add hub/submodule metadata and final cross-repo verification.
