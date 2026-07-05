# Profile Currency And Core Extraction Plan

> **Reading guide (updated 2026-07-04 multi-game core revision).** This document
> is a historical ship record plus forward plan, not a live status board. The
> shipped, test-backed foundation is Phases **1-5, 6A-6C, 7, 7A, and 7B**.
> Phase **6A-6C** shipped as a compatibility-safe neutral naming pass:
> `characterXp` is the primary progression helper/export with legacy
> `mycelium` aliases, and run player/shop responses expose `runCurrency` /
> `runCoins` while keeping legacy `coins`. The physical database rename
> (`mycelium`→`character_xp`, `coins`→`run_currency`) remains optional Phase
> **6D** work, not a launch blocker. The authoritative current backlog is the
> **Current Remaining Work Matrix** in the Post-Implementation Review; the
> Phase 7B **Remaining launch gates** are the paid-rollout subset, not the whole
> backlog. Code movement into `backpack-game-core` has started
> with bag-shape, first grid-geometry primitives, fusion matching, and shop-offer
> generation; broader extraction should continue one pure or adapterized cluster
> at a time. The 2026-07-04 direction changes the next core lane: the second
> consumer has been bootstrapped as
> `git@github.com:nuclear-pancakes/meat-master.git`, and reusable
> asset/gacha/wallet-domain rules should move into
> `backpack-game-core` behind adapters rather than staying Mushroom-only.
> That core is now planned as a full-stack shared repo: backend modules,
> shared DTO/view-model shapers, browser-safe client services/composables, and
> neutral Vue component primitives that both Mushroom Battles and Meat Master
> can consume. Product pages, themes, routes, copy, haptics, art resolvers,
> Telegram wrappers, and payment/adult-content policy stay in the product repos.
> A 2026-07-04 Geesome architecture review tightened this direction: copy the
> layered repo shape (`geesome-libs` + `geesome-ui` + `geesome-node` modules),
> but improve it with typed subpath exports and adapter contracts so Backpack
> does not inherit Geesome's historical deep-import coupling.
> The implementation plan now assumes a lead agent plus scoped sub-agents for
> maximum throughput: run audits, contract design, disjoint module work,
> adapter prep, and validation review in parallel, while keeping only
> integration-sensitive steps such as installs, builds, Playwright, submodule
> pointer changes, commits, and pushes in a lead-owned queue.
> Latest implementation pass added the first concrete architecture slice:
> stable module facades, a route-adapter client layer, shared loadout
> view-model helpers, and Mushroom/Meat consumer adoption of those public paths.
> Shipped
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
> shop-offer generation into `backpack-game-core`. **Phase 8D** moved
> bot-loadout generation into `backpack-game-core` through product providers
> while keeping ghost snapshot and portrait glue local. **Phase 8E** moved the
> deterministic battle loop into `backpack-game-core` through ability and
> metadata hooks while keeping Mushroom combat identity local. **Phase 8F**
> moved full loadout validation into `backpack-game-core` through product config
> providers while keeping Mushroom artifact/catalog policy local. **Phase 8G**
> moved deterministic numeric RNG and shuffle helpers into
> `backpack-game-core` while keeping Mushroom string-seed hashing local.
> **Phase 8H** added TypeScript declarations for the root and subpath package
> exports so another game can integrate with typed provider hooks. **Phase 8I**
> is the active domain-core extraction lane; the shared `asset-gacha`,
> gacha admin-validation, gacha simulation, wallet-accounting, and
> profile-asset-state slices are implemented, a focused asset catalog
> acquisition-policy cleanup now shares paid/free default and per-asset override
> resolution, asset gacha roll/burn result DTO shaping is shared, profile asset
> target-variant response shaping and purchase/equip/grant result DTO shaping
> are shared, and client
> view-model helper slices now share pack summary/label,
> wallet purchase-surface, asset roll-feedback, grid-cell classification,
> artifact stat total/text shaping, artifact grid utility shaping, and
> canonical preview-orientation shaping, plus wallet/asset-roll status
> normalization, wallet/asset-roll mutation view-state reducers, and optional
> route-client response-envelope unwrapping. The first headless wallet/gacha
> state helper slice now shares wallet bundle loading state, checkout
> next-action decisions, and roll/burn refresh decisions. The first run-shop
> response patch helper slice now shares refresh-shop, buy, and sell state
> projection, and the broader game-run response patch helper slice now shares
> start, ready, round-transition, and completion projection. Replay playback
> state now shares speed selection, long-battle boost, autoplay delay, tick
> advancement, load/set-speed patches, and timeline shaping. Gacha admin
> draft-diff DTOs, diff table rows, validation/checklist rows, season-plan
> coverage rows, chance text, fixture operation summaries, odds preview table
> rows, fixture operation rows, and simulation item rows are shared. Mushroom
> live frontend transport now routes through the shared client while keeping
> product route names local.
> Product DB schemas, payment-provider adapters, Telegram routes, runtime
> catalogs, artwork, content-policy gates, support operations, and final
> route/page composition remain game-local adapters. The 2026-07-05 backend
> planner slices moved roll settlement, duplicate-burn settlement, wallet
> purchase intent/checkout/completion, and run-shop buy/refresh/sell planning
> into core commit `624d4b0`, then run start drafts, starter loadout drafts,
> initial/next shop state, ghost budget math, round reward/counter/end-state
> planning, and challenge group-completion decisions into core commit
> `bf863f3`, then the first neutral frontend stat-row DTO helper into core
> commit `2280929`, shop item row DTO shaping into core commit `ffaa376`, grid
> board render row shaping into core commit `3c638fb`, and replay event row
> shaping into core commit `a4c4c06`, then artifact tile display contracts
> into core commit `42b1f1c`, while keeping execution/rendering in product
> adapters. The next
> core candidates are **not more route plumbing**; they are remaining neutral
> UI primitives that both Mushroom and Meat can style locally. Move
> planners and DTO builders, not SQL transactions, provider callbacks,
> Telegram/adult-content policy, or product page shells.
> **Phase
> 11** has an initial playable `meat-master` consumer using the shared core
> through a nested submodule.

**Status:** Phases 1-5, 6A-6C, 7, 7A, 7B, 8A, 8B, the first Phase 8C slices,
8D, 8E, 8F, 8G, 8H, the first Phase 8I/8J slices, and the initial Phase 11
consumer
implemented as the Mushroom Battles
compatibility foundation (Phases 1-5 and 7 on 2026-06-22; Phase 7A hardening on
2026-06-23; Phase 7B paid-readiness/UI hardening and Phase 6A-6C neutral naming
on 2026-07-01; Phase 8A-8D extraction on 2026-07-01; Phase 8E battle-loop
extraction, Phase 8F loadout-validation extraction, and Phase 8G RNG helper
extraction on 2026-07-02; Phase 8H type declarations on 2026-07-02; first
Phase 8I/8J slices on 2026-07-04). Phase 6D remains an optional database-breaking rename and
should only happen after external consumers no longer depend on raw legacy
column names.
Real-money rollout still requires provider sandbox/live validation,
product/legal support, terms/refund/age/content compliance gates, and
operational handling for post-completion refunds/reversals/late crypto edge
cases.
**Created:** 2026-06-22
**Primary repo:** `mushroom-master`
**Target reusable core repo:** `git@github.com:MicrowaveDev/backpack-game-core.git`
**Second consumer repo:** `git@github.com:nuclear-pancakes/meat-master.git`

`backpack-game-core` now has `main` commits with the extracted bag-shape
helpers, first grid-geometry primitives, fusion matching, and shop-offer
generation, provider-driven bot-loadout generation, hookable battle
simulation, provider-driven loadout validation, browser-safe numeric RNG /
shuffle helpers, reusable asset/gacha policy helpers, gacha admin validation
helpers, deterministic gacha simulation helpers, reusable wallet accounting
helpers, reusable profile asset state helpers, asset catalog acquisition policy
helpers, asset gacha roll/burn result DTO shapers, profile asset
target-variant list shapers, profile asset purchase/equip/grant result DTO
shapers, asset pack client view-model helpers, wallet/roll feedback
view-model helpers, grid-cell classification helpers, artifact stat
view-model helpers, artifact grid utility helpers, and canonical artifact
preview helpers, plus wallet and asset-roll status normalization and mutation
view-state helpers, optional route-client response-envelope unwrapping, and the
first headless wallet/gacha state helpers. The package ships TypeScript
declarations for the root export and every subpath export.
`meat-master` now consumes it as a nested submodule for a first playable
backpack battle prototype. Earlier notes that treated the target repo as empty
are historical only.

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
- Provider-driven bot-loadout generation is extracted: weighted choice,
  first-fit bag placement, rectangular placement, occupied-cell tracking, and
  retry orchestration now live in `backpack-game-core`. Mushroom artifacts,
  affinities, starter presets, prices, validation, portraits, and
  `createBotGhostSnapshot` response shaping stay in `bot-loadout.js` and
  `game-data.js`.
- Hookable battle simulation is extracted: deterministic step iteration, action
  ordering, action/skip event sequencing, HP/stun/damage resolution, death and
  step-cap ending, and result shaping now live in `backpack-game-core`.
  Mushroom combatant derivation, active/passive ability hooks, Kirt/Morga
  ordering hooks, artifact attribution, lore `effectTags`, narration labels,
  constants, seeded RNG creation, persistence, rewards, and rating stay local.
- Provider-driven loadout validation is extracted: flat-grid bounds and
  overlap checks, active-bag placement, bag-cell coverage, effective grid-height
  expansion, budget summing, stat aggregation, and orchestrated validation now
  live in `backpack-game-core`. Mushroom artifact lookup, pricing, dimensions,
  bag/family policy, container sentinel rules, grid constants, and stat caps
  stay local through `app/server/services/loadout-utils.js`.
- Deterministic numeric RNG helpers are extracted: core owns the numeric-seed
  RNG state machine, integer rolls, and non-mutating seeded shuffle. Mushroom
  keeps string seed hashing in `app/server/lib/utils.js` via Node `crypto`, so
  existing shop, bot, ghost, and battle seed inputs keep their deterministic
  behavior while the core package remains browser-safe.
- Type declarations are shipped: `backpack-game-core` has `.d.ts` files for
  the root export and every subpath export, and `tests/package-types.test.js`
  guards that each package export has matching JS and declaration targets.
- New multi-game target identified: `meat-master` should become the second
  core consumer. That changes the next extraction goal from "wait for another
  game" to "pull reusable wallet/asset/gacha domain behavior into core behind
  persistence/payment/catalog adapters, then bootstrap `meat-master` from that
  core plus a small product-specific data/art layer."

Phase 7A closed the code-level paid-economy hardening gaps found on
2026-06-23: wallet debits now use atomic updates, wallet mutations are
serialized per player in-process, provider adapters can create Telegram Stars,
BTCPay, and NOWPayments checkout metadata, webhooks have provider-specific
signature tests, Telegram Mini App vs web payment surfaces are encoded,
selective gacha catalog policy is configurable, and the home screen has a
wallet-buy entry point.

Phase 7B closed the local paid-readiness gaps found on 2026-07-01 and the
first distributed-checkout hardening gap on 2026-07-02: idempotent checkout
retries reuse one external invoice through a DB-backed checkout claim, crypto
webhook completion validates normalized fiat amount/currency and can re-fetch
BTCPay invoice details, terminal provider statuses are recorded without
granting currency, unsigned payment webhooks fail closed outside
`NODE_ENV=test` unless `PAYMENT_WEBHOOK_ALLOW_UNSIGNED_DEV=true`, a wallet drift
audit/backfill script exists, the home screen exposes server-provided wallet
bundles/providers, and rollable portraits now call the gacha pack roll
endpoint.

This is still not a paid production rollout. Remaining launch gates are:
current payment-provider due diligence for fee/UX/content-policy fit, real
provider sandbox/live validation, real Telegram invoice/manual webhook testing,
purchase UI terms/refund/support presentation, age/content-compliance gating
for adult or sexual content, tax/accounting/data-retention review, and
operational runbooks plus tooling for post-completion refunds, reversals,
chargebacks/disputes, late crypto payments, overpayments, and support
investigations.

Next local lane after Phase 8H moved through G1-G5E: the gacha path now has a
database-backed admin/runtime lane, promoted plan assets, duplicate/burn
support, runtime odds simulation, and support tooling. The second
`backpack-game-core` consumer target now exists: `meat-master`. Deferred beyond
the current lane:
optional Phase 6D database renames / physical removal of legacy compatibility
fields, marketplace trading, database-managed pack catalogs, an expanded
terms/support frontend, provider
refund and reversal handling, distributed payment mutation hardening, expanded
support/admin operations beyond the current lookup, wallet, asset, gacha roll,
and purchase-refund console, tax/accounting evidence, and broader code movement
into `backpack-game-core`.

## Post-Implementation Review

Updated 2026-07-02 from a read-through of the current `main` implementation in
`wallet-service.js`, `asset-service.js`, `create-app.js`, `bot-gateway.js`,
`web/src/composables/useCustomization.js`, `web/src/pages/HomeScreen.js`, and
`tests/game/wallet-assets.test.js`; refreshed after Phase 7B and Phase 6A-6C
implementation on 2026-07-01 and the local wallet-support UI pass on
2026-07-02. This review intentionally does not treat the plan's own status text
as evidence.

### Verified as shipped

- Wallet ledger (`player_wallet_balances`, `player_wallet_transactions`),
  `grantCurrency` / `spendCurrency` / `getWalletState`, per-player in-process
  mutation lock, and atomic debit via `UPDATE ... WHERE balance + $delta >= 0
  RETURNING balance` in `app/server/services/wallet-service.js`.
- Provider-neutral purchase intents with `telegram_stars`, `btcpay`, and
  `nowpayments` adapters, surface policy (`WALLET_PAYMENT_SURFACES`), and
  idempotent completion keyed by `wallet_purchase:${id}`.
- Idempotent purchase-intent checkout creation is guarded by an in-process key
  lock plus DB-backed checkout claim fields on `wallet_purchase_intents`.
  Retrying the same idempotency key reuses existing provider invoice metadata;
  if another process is creating the checkout, the retry waits briefly for that
  claim to finish instead of creating a second provider invoice.
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
4. **Refund/reversal handling is partially automated.** Terminal non-completed
   statuses are recorded before grant, and completed-payment
   refunded/reversed/chargeback statuses now attempt wallet clawback when the
   balance is available. Insufficient-balance clawbacks are recorded for
   support follow-up. Dispute freezes, provider settlement import, late crypto
   review workflows, and support cases are still operational work.
5. **Paid asset mutation locks now have DB-backed claims.** Atomic SQL debits
   protect the balance row, uniqueness constraints roll back duplicate active
   assets, wallet checkout creation has a DB-backed claim, and direct asset
   purchase / gacha roll paths now use `mutation_claims` rows with TTL recovery.
   Multi-instance deployments still need production-database validation plus
   broader operations around refunds, reversals, and provider replay handling.
6. **The current gacha is intentionally static-config only.** It now supports
   one-result and multi-slot openings with static guarantees, pack-scoped pity,
   opt-in duplicate active instances, and simple configured duplicate burn
   exchanges. It still has no marketplace and no database-managed
   seasons/collections.
7. **Core extraction has started and should stay adapter-led.** The next step
   is choosing only small, evidence-backed clusters while keeping `spore`,
   Mushroom portraits, Telegram auth, Sequelize models, battle persistence, and
   home-field code out of `backpack-game-core`.

### Recommended follow-ups

- Keep this plan as a historical ship record; treat the **Current Remaining Work
  Matrix** below as the live backlog. The Phase 7B **Remaining launch gates**
  are the paid-rollout subset of that backlog.
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

### 2026-07-05 Post-Implementation Addendum

Reviewed against the full conversation and the latest remembered implementation
state after the Phase 8AR-8AV and Phase 11 passes. The main correction is that
the backend/planner/DTO extraction is now far enough along that the next core
work should not keep expanding route plumbing. The highest-value remaining
core lane is a small, tested Vue component package built on the DTO shapers
that already moved to `backpack-game-core`.

Findings and plan corrections:

1. **Do not move whole Mushroom frontend screens into core.** Mushroom screens
   mix product layout, localized copy, Telegram UX, haptics, route names,
   admin token storage, asset paths, CSS themes, and Mushroom-specific
   catalog assumptions. Moving them wholesale would make Meat inherit Mushroom
   product decisions and would make the core harder to reuse. The plan now
   calls for neutral component primitives plus props/events/slots/adapters.
2. **The plan needs an explicit frontend-core contract.** Add a small reference
   doc before or during Phase 8AW that defines supported Vue subpath exports,
   peer dependencies, CSS variable/base-class policy, forbidden imports,
   event names, slot contracts, and DTO compatibility guarantees.
3. **Start with the lowest-coupling components.** `AssetRollResultPanel`,
   `GachaOddsTable`, and `GachaPackCard` are better first candidates than the
   full backpack grid because they already have stable DTOs and fewer pointer,
   drag/drop, image, and layout dependencies.
4. **Add a static import-boundary guard.** Core should have a cheap test or
   script that fails if browser/client/Vue exports import Mushroom paths,
   Node-only payment/webhook modules, Express/Sequelize, Telegram helpers, or
   product assets.
5. **Second-consumer work is no longer theoretical.** `meat-master` exists and
   consumes the nested core submodule, so the remaining plan should say
   "stabilize and continuously verify both consumers," not "integrate when one
   exists."
6. **Core release discipline is now a blocker for safe reuse.** Decide whether
   the near-term contract is submodule-only or package publishing; either way,
   every shared export needs typed subpath declarations, changelog notes,
   compatibility expectations, and a CI/check command that validates core,
   Mushroom, and Meat against the same commit.
7. **Admin gacha UX still needs a simplified operator-first flow.** The main
   tab should stay focused on uploading images, assigning a character, checking
   per-character season coverage, setting chance/rarity, promoting ready items
   into a pack, previewing odds, and publishing only after validation. Advanced
   JSON fixture editing, import/export, and rollback tools should stay behind
   this simpler lane.
8. **Copied or generated seed assets are prototype-only.** Any Meat assets
   copied from Mushroom or generated for bootstrapping should be tracked as
   temporary/provenance-tagged content and replaced with product-owned artwork
   before production, especially for adult-themed surfaces and paid packs.
9. **Core should keep returning plans, not executing product mutations.** The
   current boundary is healthy: core can own pure planners, settlement drafts,
   DTOs, odds math, validation, and view models; product repos should still own
   SQL transactions, provider callbacks, payment risk, catalog publication,
   support permissions, and legal/content gating.

## Current Remaining Work Matrix

Added 2026-07-02 after the post-implementation review. Treat this as the live
backlog until the items are split into tickets or implementation phases. Updated
2026-07-02 to make the active next lane gacha-focused: paid-provider,
compliance, support-ops, approval, and production scheduling work is important,
but it is now backlog unless a paid pilot is being prepared. Updated
2026-07-05 after the multi-game core extraction pass: the active shared-core
lane is now neutral Vue component extraction plus package/CI hardening across
core, Mushroom, and Meat.

### Active Lane - Gacha Roadmap Plan

#### Source Of Truth

- User request: move the previous non-gacha next items 1-5 into backlog and
  write a gacha roadmap with a simple implementation first.
- Keep Mushroom Battles direct skin buying available when gacha mode is off.
- Keep the first gacha implementation intentionally small so it can ship and be
  tested without the full future NFT-set/season/marketplace economy.
- Put complex seasonal packs, advanced pity scopes, duplicate burning, and player
  trading into the gacha roadmap backlog instead of mixing them into the first
  pass.
- 2026-07-03 adjustment: database-backed gacha config now needs a proper
  internal admin panel, not direct SQL or ad hoc fixtures. Operators must be
  able to create, validate, review, approve, publish, expire, and roll back
  seasons, collections, packs, pack items, rarity tables, and acquisition
  policy mappings safely.

#### G1 - Simple Seasonal Gacha Pack

Status: **Implemented 2026-07-02 for the simple static-pack lane.** The audit
found that the one-result unowned roll, wallet debit, direct-buy policy, pack
odds endpoint, static Season 1 portrait pack, and first UI pack states already
existed. The completion pass added pack authoring validation, player-aware pack
summary projection, a frontend-renderable roll result payload, localized
roll-result/error feedback, and screenshot-backed UI coverage.

Goal: ship one static, season-aware pack loop that proves wallet spend, roll
eligibility, rarity display, ownership, and UI feedback without creating a
large economy system yet.

- Use static catalog/config for the first season and collection. Keep one active
  pack at a time for the first implementation; no admin database editor yet.
- Keep the existing one-result roll model: one wallet spend grants one random
  unowned asset from the active pack.
- Add or normalize pack metadata needed by the UI: `seasonId`, `collectionId`,
  `rarity`, active/future/expired dates, cost, rollable asset count, and odds.
- Keep direct-buy behavior simple: when gacha is off, direct skin buying remains
  available; when gacha is on with direct-buy blocking, configured gacha-only
  skins roll from the pack instead of showing a buy button.
- Show the player a clear roll result, rarity, newly-owned state, remaining
  rollable count, and "complete pack" state when no unowned assets remain.
- Keep duplicate behavior out of G1 by rolling only unowned assets. This avoids
  inventory clutter until duplicate/burn rules exist.
- Add focused tests for static pack validation, weighted roll selection,
  wallet debit safety, no-unowned completion, direct-buy blocking, and UI
  result/complete states.
- Add screenshot coverage for active pack, roll result, complete pack, and
  disabled/expired pack states on desktop and mobile.

G1 is allowed to reuse the current `asset_rolls`, asset ownership, wallet, pack
odds, and gacha simulation services. The implementation should first audit what
already exists, then fill only the gaps required for a polished simple pack.

#### G1 Implementation Checklist

1. Audit current MVP against G1: catalog fields, endpoint response shape, UI
   copy, tests, and screenshots. **Done 2026-07-02.**
2. Define the first static season/collection/pack in one place with authoring
   validation and stable test fixtures. **Done 2026-07-02:** invalid pack
   authoring is surfaced in pack projection and blocks rolls without spending.
3. Normalize rarity and season metadata in the backend catalog/pack projection.
   **Done 2026-07-02:** bootstrap pack projection includes availability,
   validation, total/owned/remaining counts, completion, total weight, per-item
   probability, and rarity summary.
4. Add a roll-result projection that the frontend can render without guessing
   from refreshed ownership state. **Done 2026-07-02.**
5. Update the skin/customization UI so direct buy, roll, owned, complete,
   future, and expired states are visually distinct. **Done 2026-07-02:** the
   picker now also shows localized roll success and known failure feedback.
6. Expand simulation/tests to cover the first real configured pack and expected
   rarity distribution. **Done for G1 2026-07-02:** focused backend, view-model,
   Playwright, and existing odds-simulation tests cover the simple one-result
   pack. Multi-slot guarantee/pity simulation stays in G2/G3.
7. Regenerate desktop/mobile screenshots and record layout sidecar assertions.
   **Done 2026-07-02:** `02f-home-pack-states-{mobile,desktop}.png` now
   captures the pack states with roll-result feedback and layout assertions.

### Paid/Ops Backlog - Moved Out Of Active Lane

Moved 2026-07-02 from the previous "what next" list. These items remain
required for paid production rollout, but they are not the immediate gacha
implementation lane.

1. Settlement/reconciliation admin UI for imports, reconciliation failures,
   provider mismatch review, and alert status.
2. Stricter approval-policy UX that understands configured operator roles and
   approval requirements, not only an optional approval actor header.
3. Production scheduling and alert routing for purchase-intent expiry,
   wallet ops checks, settlement imports, reconciliation reports, and support
   notifications.
4. Provider live validation for Telegram Stars, BTCPay, NOWPayments, and the
   chosen crypto/fallback processor with real sandbox/live payload examples.
5. Final support runbooks, refund/dispute policy, legal/compliance review,
   adult-content/age gates, tax/accounting exports, and data-retention rules.

### 1. Payment Provider Decision And Validation

- Re-run current processor due diligence before launch. Fees, checkout UX,
  settlement timing, webhook reliability, supported regions, and adult/sexual
  content policy can change; do not rely on stale notes when selecting a final
  crypto provider or fallback.
- Record the chosen provider path for each surface: Telegram Mini App,
  external web checkout, and crypto checkout. Include why each provider was
  accepted or rejected.
- Validate Telegram Stars, BTCPay, NOWPayments, and any final extra processor
  with real sandbox/live credentials. Capture successful, failed, expired,
  underpaid, overpaid, refunded, and disputed callback examples.
- Define provider cutover and fallback behavior if a provider disables the
  merchant account, rejects content, has degraded webhooks, or changes fee
  structure.

### 2. Compliance, Tax, And User-Facing Policy

- Finalize terms, refund policy, support contact, payment-dispute wording, and
  virtual-currency disclosure before enabling paid checkout.
- Add age/content gates for any adult or sexual content path. The gate must
  prohibit unlawful sexual content, minors/CSAM, non-consensual material, and
  anything forbidden by target jurisdictions or provider terms.
- Decide whether gacha/pack odds need jurisdiction-specific disclosure,
  eligibility restrictions, spending limits, or additional consent screens.
- Confirm tax/accounting needs: invoice/receipt data, VAT/sales-tax handling,
  data retention, export format, and who can access purchase records.

### 3. Money Operations And Support Tooling

- Read-only support lookup now exists as of 2026-07-02:
  `npm run game:support:money-lookup -- --query=<player-or-provider-reference>`
  searches purchase intents, provider references, wallet transactions, webhook
  events, asset grants/equipment, rolls, support actions, player records, and
  wallet balances without direct SQL. A first admin UI now exists at
  `/support-admin` for authenticated internal lookup.
- Manual support flows now exist locally as of 2026-07-02:
  `npm run game:support:money-action` can grant/revoke wallet currency,
  grant/revoke/freeze/unfreeze assets, mark a purchase refunded, attach
  evidence JSON, and record immutable `support_actions` notes. Asset
  freeze/unfreeze/revoke actions can target either `assetId` or
  `assetInstanceId`. The `/support-admin` UI now exposes wallet grant/revoke,
  asset grant/freeze/unfreeze/revoke, purchase refund with optional wallet
  clawback, and optional approval-actor header entry. Still add settlement /
  reconciliation operator screens and final support runbooks before
  non-engineering support staff use the full flow set.
- A token-gated support admin JSON API now exists as of 2026-07-02:
  `/api/admin/support/*` mirrors the read-only lookup and audited mutation
  services for future admin UI integration. It requires
  `SUPPORT_ADMIN_API_TOKEN` and an explicit support actor id. Optional
  `SUPPORT_ADMIN_OPERATORS_JSON` / `SUPPORT_ADMIN_OPERATORS` role mapping can
  restrict read, wallet, asset, refund, and approval actions per operator.
  Asset mutation endpoints cover grant, revoke, freeze, and unfreeze; disputed
  asset operations can target either `assetId` or `assetInstanceId`. The
  `/support-admin` UI consumes this API for support lookup, wallet grant/revoke,
  asset grant/freeze/unfreeze/revoke, purchase refund, and optional approval
  actor submission; settlement/reconciliation screens and final runbooks remain.
- Local reconciliation reports now exist as manual commands:
  `npm run game:wallet:audit` checks player/wallet mirror drift, and
  `npm run game:wallet:reconcile` checks completed purchase intents, wallet
  grants, and processed webhook events. Use the ops-check command below for a
  scheduler-ready aggregate report; real provider settlement exports/API data
  still need live validation before true external reconciliation is complete.
- A cron-friendly wallet ops check now exists as of 2026-07-02:
  `npm run game:wallet:ops-check` runs wallet mirror drift and payment
  reconciliation checks in one report and can post failed reports to
  `WALLET_OPS_ALERT_WEBHOOK_URL`. Still wire this command into the production
  scheduler and route the webhook to the final ops/support channel.
- Normalized provider settlement import now exists as of 2026-07-02:
  `npm run game:wallet:import-settlement -- --provider=<provider> --file=<json>`
  stores imported settlement batches and compares provider rows to local
  purchase intents, wallet grants, amounts, and refund clawbacks. Still validate
  real provider export/API shapes, schedule imports, route alerts, and finish
  live settlement runbooks.
- Provider-specific settlement adapters and a local operations runbook now
  exist as of 2026-07-02: the same import command accepts `--format=json|csv|auto`
  and maps common BTCPay, NOWPayments, and Telegram Stars export/API fields into
  the normalized reconciliation service. See
  `docs/payment-operations-runbook.md`. Still validate real sandbox/live export
  shapes, add scheduled imports/reconciliation, and route alerts.
- Local stale purchase-intent expiry now exists as of 2026-07-02:
  `npm run game:wallet:expire-intents` marks old pending wallet purchase
  intents expired without granting currency, skips active checkout claims, and
  records local-expiry metadata. Still schedule it in production and tune the
  expiry window to match provider invoice lifetimes.
- Post-completion refund/reversal handling now exists for provider clawback
  statuses as of 2026-07-02: completed purchases can move to
  `refunded`/`reversed`/`chargeback`, record provider evidence in intent
  metadata, and create a `wallet_purchase_reversal` spend when the profile has
  enough wallet balance. Insufficient-balance clawbacks are recorded as
  support-required and surfaced by reconciliation. Completed-purchase
  `disputed`/`underpaid`/`overpaid` statuses are recorded for support review
  without automatic clawback. Disputed asset freeze/unfreeze tooling now exists
  locally; still validate live provider dispute semantics and richer support
  runbooks.

### 4. Distributed Concurrency, Security, And Abuse Controls

- Checkout idempotency and provider invoice reuse now have DB-backed claim
  fields on `wallet_purchase_intents` as of 2026-07-02. Direct asset purchases
  and gacha pack rolls now use reusable `mutation_claims` rows with stale-claim
  recovery as of 2026-07-02. Still validate these behaviors against the
  production database/provider mix before paid launch.
- Payment webhook replay and duplicate-event handling now use
  `payment_webhook_events` rows as of 2026-07-02, including payload hashes,
  processing status, stored processed results, and duplicate replay responses.
  Timestamp-window checks now reject stale/future webhook deliveries when a
  provider sends explicit webhook/event timestamps, and can require timestamps
  through env flags after live payload validation. Multi-secret webhook
  verification and the local rotation runbook now exist; still wire production
  secret-manager deployment plus production payment-log routing/retention.
- Checkout creation, gacha rolls, direct asset purchases, asset catalog, and
  pack-odds endpoints now have route-scoped rate-limit buckets as of
  2026-07-02. The support admin API also has an actor-scoped rate-limit bucket.
  Still tune production thresholds with real traffic, add shared bucket
  enforcement if multiple app instances are used, and keep equivalent controls
  on future admin/support-sensitive endpoints.

### 5. Gacha, Asset Economy, And Marketplace Roadmap Backlog

G1, G2, and G3 are now implemented for static-config packs. The current runtime
keeps Mushroom's default Season 1 portrait pack as a one-result pack unless
config opts into `rollSize`/slot rarity tables, `guarantees`, or `pityRules`, but
the backend, UI, support lookup, and simulator can handle multi-slot unowned
openings with static guarantees and pack-scoped pity. The items below are the
remaining roadmap beyond that static lane.

#### G2 - Multi-Item Packs

Status: **Implemented 2026-07-02 for static-config, unowned-only multi-slot
packs.**

- Done: packs can set `rollSize` from 1-10 through static/env config.
- Done: packs can define per-slot `rarityWeights`; selection draws without
  replacement from unowned assets, first by slot rarity and then by item
  `dropWeight` inside the selected rarity.
- Done: one wallet spend grants every selected asset instance in the opening.
  Legacy first-result fields stay populated, and the full opening is exposed in
  `rollResult.items[]`.
- Done: roll rows preserve per-item evidence in `metadata_json.results`,
  including slot index, selected rarity, rarity table version, candidate-pool
  hash, instance id, and the shared wallet transaction.
- Done: Home pack UI shows multi-result roll feedback and compact "opens N"
  pack detail copy; screenshot coverage captures the multi-result strip.
- Done: `simulateAssetPackOdds` supports multi-slot openings and reports
  observed per-opening rates plus average item count per opening.
- Deferred to G4+/G5+: richer duplicate economy policy, exact player-facing
  odds disclosures for duplicate-enabled packs, and admin-managed seasons.

#### G3 - Guarantees And Pity

Status: **Implemented 2026-07-02 for static-config packs with pack-scoped
pity.**

- Done: packs can define `guarantees` / `guaranteeRules` with a min rarity and
  count, such as "at least two rare-or-better cards."
- Done: packs can define `pityRules` with min rarity, count, threshold, and
  `resetScope: "pack"`; active pity temporarily behaves as a guarantee for the
  next opening and resets after a qualifying hit.
- Done: pack projection exposes normalized guarantee rules and player-specific
  pity counters, including remaining openings and active state.
- Done: roll evidence records `guaranteesApplied`, `pityBefore`, `pityAfter`,
  and per-item replacement metadata in roll and acquired-instance metadata.
- Done: Home pack details show compact guarantee and pity copy, including a
  "guaranteed next open" state, and screenshot/UI coverage asserts the text.
- Done: validation blocks invalid rarity/count/threshold/scope values and
  impossible min-rarity rules before spending wallet currency.
- Deferred to G5+: season-scoped or collection-scoped pity, admin-managed pity
  policy, duplicate-enabled pity math, and fuller odds disclosure tooling.

#### G4 - Duplicate Inventory And Burning

Status: **Partially implemented 2026-07-02 through G4B.** The shipped slices
are duplicate-enabled pack instances, simple configured burn exchange, copy
caps, and basic burn target policy. The larger duplicate economy remains
backlog.

- Done: packs can opt into `duplicatePolicy: "allow_duplicates"` so owned pack
  items remain rollable and create separate active `player_asset_instances`
  rows. Default packs still reject once all unique items are owned.
- Done: duplicate roll metadata, roll result items, pack projection, simulator
  warnings, and Home pack UI expose duplicate copies and duplicate-enabled
  rollability.
- Done: `asset_burn_exchanges` records simple idempotent burn exchanges.
  Configured rules consume spare duplicate copies of a source rarity while
  preserving one active/equipped copy per asset, then grant random eligible
  pack targets.
- Done: duplicate-enabled packs can set pack-wide or per-item copy caps; capped
  assets leave the roll candidate pool, capped packs reject before wallet spend,
  and pack projection exposes `copyLimit`, `copyCapped`, and `copyComplete`.
- Done: burn rules can use `targetDuplicatePolicy:
  "allow_duplicates" | "unowned_first" | "unowned_only"` so simple exchanges can
  prefer new targets or fail when no unowned target remains.
- Done: support asset operations are instance-aware enough to freeze/unfreeze
  legitimate duplicate copies independently.
- Done: backend, simulator, Home view-model, and Playwright coverage exercise
  duplicate rolls, burn costs, copy caps, validation failures, burn target
  policy, and the rendered burn affordance.
- Backlog: dust/shard balances, richer complete-target rewards after
  `unowned_only` failure, burn-result lock/cooldown policy, richer odds
  disclosure, and advanced duplicate-rate simulation before paid duplicate
  packs.

#### G5 - Database/Admin-Managed Seasons And Admin Panel

Status: **Implemented through the G5D safety MVP as of 2026-07-04.** G5A added
database-backed season, collection, pack, and pack-item records behind
`ASSET_GACHA_DB_PACKS_ENABLED`, plus a runtime loader that lets approved DB
packs override or extend the static pack fallback. G5B added the token-gated
backend admin API. G5C added the first operator UI, and G5D added preview and
release safety tooling. Direct SQL remains acceptable only for tests and
emergency maintenance, not normal season authoring.

- Done: database schema now has season, collection, pack, and pack-item tables
  with `review_status`, status/date windows, price, roll size, rarity table,
  slot, guarantee, pity, duplicate, and burn-rule fields.
- Done: player-facing runtime pack projection, odds endpoint, roll flow, and
  burn flow can use approved DB packs while existing synchronous/static helpers
  remain available for the simulator and static tests.
- Done: draft or unapproved DB packs stay hidden from runtime odds/bootstrap
  and cannot be rolled.
- Done: **G5B - admin backend API** adds a token-gated
  `/api/admin/gacha/*` surface with `gacha_operator` / `admin` roles for
  season, collection, pack, and pack-item CRUD; draft validation using the
  runtime pack validator; review status transitions; cloned draft revisions for
  edits to approved packs; emergency disable/expire actions; and audited
  before/after change records in `support_actions`.
- Done: **G5C - admin UI MVP** adds a dedicated `/support-admin` Gacha tab
  where operators can load the token-gated catalog, see season/collection/pack
  counts, pick existing asset ids from the admin catalog, create/update seasons,
  collections, packs, and pack items, edit rarity/slot/guarantee/pity/
  duplicate/burn JSON fields, validate drafts, publish approved active packs,
  expire/disable packs, and see validation errors without touching SQL.
- Done: **G5D - preview and safety tooling** adds `/api/admin/gacha/packs/:id/preview`
  plus Support Admin preview panels for release checklist, runtime odds preview,
  deterministic roll simulation, DB asset-acquisition policy recommendations,
  and live/draft diff when a draft records `basePackId` or `clonedFromPackId`.
  Publish/approve transitions now block when runtime validation fails or when
  required pack dates, positive price, supported currency, or player-facing
  disclosure copy are missing. Checklist warnings currently surface
  season/collection status mismatches, missing duplicate copy caps, and asset
  policy mappings that are not yet tied to the DB pack.
- Required launch controls: the admin panel must keep Mushroom Battles direct
  skin buying available when gacha is off, keep draft/unapproved packs hidden,
  make approved-row changes auditable, and provide a rollback path that can
  disable a bad pack without deleting ownership or roll history.
- In progress: **G5E - admin hardening** now covers JSON fixture
  import/export and the first simplified season-plan authoring lane.
  `/api/admin/gacha/export` returns a versioned
  `gacha-admin-fixture/v1` payload for DB-authored seasons, collections, packs,
  and nested items. `/api/admin/gacha/import` defaults to dry-run, can apply
  upsert/replace-item fixtures through the support-admin approval path, audits
  applied imports as `gacha_fixture_import`, and requires `allowApproved=true`
  plus validation/release-checklist success before preserving approved pack
  status. `/api/admin/gacha/plan-items` stores uploaded planning images under
  `/gacha-plan`, binds each image to a mushroom character, rarity, chance
  weight, and status, returns per-character season coverage in the catalog, and
  audits `gacha_plan_item_create/update/delete` actions. The Support Admin
  Gacha tab now opens on this simple plan workflow before advanced pack CRUD.
  Ready plan images can now be promoted into a selected pack through audited
  `gacha_plan_promote_pack_items` actions; runtime DB packs, odds, rolls,
  bootstrap catalog projection, and portrait equipment can resolve those
  promoted plan assets. Support asset grant/revoke/freeze/unfreeze paths also
  resolve the runtime catalog so promoted plan assets are operable in support
  workflows.
- Backlog after the G5E admin slices: bulk CSV/item editing beyond full-fixture
  replacement, migration/rollback scripts for live season corrections, richer
  season/collection-scoped pity state, staff permissions beyond the first
  operator role, operator runbooks, scheduled activation alerts, richer
  paid-pack jurisdiction/odds disclosure review, and deeper marketplace/NFT-set
  tooling.
- Post-implementation findings to fold into the next G5E/G5F slice:
  ✅ public/player runtime catalogs now include plan assets only when they are
  linked through approved player-visible DB packs, while admin tooling opts into
  the full ready-plan catalog for draft validation and authoring. ✅ The
  standalone odds-simulation CLI/service now has a runtime mode for approved
  DB-backed packs and promoted plan assets (`--runtime --pack=<packId>`).
  ✅ Direct plan item `asset_id` edits are now rejected after creation; unlinked
  default generated ids sync when the operator changes character, and character
  changes are blocked once any pack item links to the plan asset.
  Remaining: bulk CSV/item editing, migration/rollback scripts, scheduled
  activation alerts, disclosure review, staff permission tiers, and marketplace
  operations.

- Move packs, seasons, collections, rarity tables, dates, and prices out of
  static config into database-managed records.
- Add an internal authoring/review flow before a season is activated.
- Support future/active/expired states, with expired packs no longer buyable
  while owned assets remain usable.
- Add migration and rollback rules for season data, including how to correct a
  bad rarity table after launch.

#### G6 - Marketplace And Trading

- Add player-to-player transfer rules only after duplicate/instance semantics
  are stable.
- Build listing, escrow, purchase, cancellation, trade lock, fraud-control, and
  moderation flows.
- Define how refunds, chargebacks, frozen assets, and revoked assets interact
  with sold or traded items.
- Add audit logs and support views before enabling real trading.

#### G7 - Full Seasonal NFT-Set Direction

- Plan monthly seasons with multiple collections and 50-100 images across
  common, rare, epic, legendary, and secret rarity.
- Decide which assets are purely in-game, which are exportable/claimable, and
  whether external NFT mechanics are truly needed.
- Add content moderation, legal review, asset provenance, and player disclosure
  before anything is advertised as an NFT-like collectible.

Local weighted-odds simulation exists for one-result and static multi-slot
unowned packs via `simulateAssetPackOdds`, `npm run game:gacha:simulate`, and
focused tests as of 2026-07-02. Admin DB-pack preview uses runtime-catalog
simulation for DB-authored packs, and the standalone CLI/service can now run
approved DB-backed runtime packs and promoted plan assets with
`npm run game:gacha:simulate -- --runtime --pack=<packId>`. Extend that
simulation at each roadmap phase instead of waiting until the end.

### 6. Frontend And E2E Coverage Still Missing

- Dedicated e2e coverage now exists for wallet bundle listing, external crypto
  checkout fallback via `window.open`, Telegram invoice opening, wallet refresh
  after a real local Telegram successful-payment webhook, checkout
  pending/failed/expired status copy, support/terms links, direct-buy skin
  purchase/equip for the active mushroom, unchanged character XP after that
  purchase, and roll-only vs direct-only skin picker presentation. This pass
  also fixed the frontend customization refresh wiring after successful skin
  actions. Screenshot-backed layout assertions now cover the wallet shop,
  checkout failure/support links, active pack odds, complete pack copy, and
  future/expired pack labels. Still add live provider status validation with
  real sandbox/live payloads.
- Frontend/e2e coverage now exists for the no-unowned-assets/complete-pack
  picker state plus active, future, and expired pack presentation. Still add
  full pack-odds presentation across real configured packs.
- Product screenshots/layout assertions now exist for wallet purchase failure,
  support links, pack odds, and complete/future/expired pack states. Add more
  screenshots whenever those surfaces change again.
- Support-admin frontend/e2e coverage now exists for token-gated lookup,
  audited wallet grant/revoke, asset grant/freeze/unfreeze/revoke, and purchase
  refund with wallet clawback from `/support-admin`. Still add UI coverage when
  settlement/reconciliation operator screens or stricter approval-policy flows
  are added.
- Support-admin screenshot/layout coverage now exists for the first console:
  `02g-support-admin-wallet-{desktop,mobile}.png` and
  `02h-support-admin-ops-{desktop,mobile}.png` sidecars show no broken images,
  no horizontal overflow, and the lookup/wallet/asset/refund/action/history
  sections present at both viewport sizes.

### 7. Core Package Release, CI, And Second Consumer

- Done for the first reuse proof: `meat-master` now exists as a second
  backpack/grid consumer and uses `backpack-game-core` through a nested
  submodule. The next step is stabilization, not proof-by-placeholder.
- Decide package release discipline: semver versioning, tags, changelog format,
  npm/GitHub package publishing vs submodule-only consumption, and compatibility
  windows for Mushroom and Meat adapters.
- Add CI or one hub helper that verifies `backpack-game-core` tests,
  package exports/types, the Mushroom consumer, and the Meat consumer against
  the same core commit before pointer updates are pushed.
- Add an import-boundary check for `backpack-game-core`: public core, client,
  and Vue exports must not import Mushroom/Meat files, product catalogs,
  product assets, Express/Sequelize, Telegram helpers, provider SDK/webhook
  code, or Node-only modules from browser-safe entry points.
- Add a frontend-core contract reference before the first shared Vue component
  ships. It should define supported subpath exports, Vue peer dependency
  policy, CSS/token policy, event names, slot contracts, forbidden imports,
  adapter props, DTO compatibility expectations, and per-consumer validation
  requirements.
- Decide whether `backpack-game-core` should also be tracked as a top-level hub
  repo in addition to the nested `mushroom-master` submodule.
- Keep copied/generated prototype assets in Meat provenance-tagged and replace
  them with product-owned artwork before any paid or public production launch.

### 8. Optional Compatibility Cleanup

- Keep Phase 6D physical database renames (`mycelium` -> `character_xp`,
  run-level `coins` -> `run_currency`) separate from paid launch and core
  extraction. Do them only if raw legacy column names become a real analytics,
  integration, or maintenance blocker.
- Remove legacy response aliases only after known clients and tests consume the
  neutral names.

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
- Default packs still reject when no unowned skins remain. Packs that explicitly
  set `duplicatePolicy: "allow_duplicates"` now allow duplicate active
  instances and can attach simple burn rules; dust/shards remain backlog.

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
     `null` for future duplicate gacha policy.
2. Add profile-scoped inventory:
   - Canonical table:
     `player_asset_instances(id, player_id, asset_id, acquisition_source,
     acquisition_source_id, status, acquired_at, metadata_json)`.
   - Direct-buy/default uniqueness is enforced in the asset service; duplicate
     gacha packs intentionally allow multiple active instances for the same
     `(player_id, asset_id)`.
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
- No global duplicate flag is required for the shipped slice. Duplicate
  behavior is pack-scoped through `duplicatePolicy: "allow_duplicates"`; trade
  flows remain backlog.

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
- The roll candidate pool excludes already owned assets by default.
  Duplicate-enabled packs include owned pack assets as copy candidates.
- If no candidate exists, reject the roll without spending currency.
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
- Duplicate handling now uses separate inventory instances for duplicate-enabled
  packs; aggregate quantities/dust remain future economy work.
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
- A default gacha roll spends wallet currency and grants one unowned skin from
  the pack; duplicate-enabled packs may grant extra active copies of owned pack
  skins.
- A default gacha roll with no unowned candidates rejects without spending
  currency.
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

1. Checkout creation is retry-safe for idempotent retries.
   - `createPurchaseIntent(...)` serializes same-player/provider/idempotency-key
     checkout creation in-process, stores checkout claim state on
     `wallet_purchase_intents`, reclaims stale checkout claims, and reuses
     existing checkout metadata.
   - Focused tests assert that concurrent in-process retries create one
     provider invoice, DB-observed in-progress claims wait for the winning
     checkout, and stale claims can be reclaimed without creating a new intent.
2. Provider callback amount/currency validation exists.
   - NOWPayments callback `price_amount` / `price_currency` are normalized
     before wallet grant.
   - BTCPay settlement can re-fetch invoice details and validate amount/currency
     when provider credentials and invoice id are available.
3. Payment lifecycle is broader than `pending|completed`.
   - Terminal non-completed statuses are recorded without granting wallet
     currency.
   - Completed-payment refund/reversal clawback is implemented locally for
     refundable/reversed/chargeback provider statuses. Disputed-payment review
     statuses and local asset freeze/unfreeze tooling exist; live-provider
     semantics remain a launch gate below.
4. Webhook signature behavior fails closed outside tests unless explicitly
   opted in with `PAYMENT_WEBHOOK_ALLOW_UNSIGNED_DEV=true`.
5. Wallet data operations exist.
   - `npm run game:wallet:audit` reports `players.spore` / wallet mirror drift
     and can backfill missing wallet balance rows with `--fix`.
6. Product purchase UI exists at MVP level.
   - Home wallet UI loads `/api/wallet/bundles` for the active payment surface.
   - Telegram Stars opens invoice links; crypto providers open checkout URLs.
   - Rollable portrait swatches call the gacha pack roll endpoint.
7. Direct asset purchase and gacha roll mutation claims exist.
   - `purchaseAsset(...)` claims `asset_purchase` by player/asset before
     spending wallet currency.
   - `rollAssetPack(...)` claims `asset_roll` by player/pack before selecting a
     candidate and spending wallet currency.
   - Focused tests assert live claims are waited on and stale claims are
     reclaimed without leaving rows behind.
8. Payment webhook event audit/replay handling exists.
   - `processProviderWebhookEvent(...)` records provider/event identity,
     payload hash, processing status, stored result, and duplicate replay
     metadata in `payment_webhook_events`.
   - Duplicate processed webhooks return the stored result without granting
     wallet currency again; same-event payload mismatches are rejected.
9. Paid asset route abuse-control buckets exist.
   - Checkout creation, direct asset purchase, gacha roll, catalog, and pack
     odds routes use separate player-scoped rate-limit buckets.
   - `RATE_LIMIT_FORCE=true` allows deterministic staging/test enforcement
     without switching the whole process to production mode.
10. Read-only money support lookup exists.
   - `lookupMoneySupportRecords(...)` and
     `npm run game:support:money-lookup` produce JSON support packets for
     players, wallet balances/transactions, purchase intents, webhook events,
     asset grants/equipment, gacha rolls, and support action audit rows.
   - Provider invoice searches resolve back to local player context, and asset
     searches pull the same player's payment/wallet context.
11. Local wallet payment reconciliation exists.
   - `reconcileWalletPayments(...)` and `npm run game:wallet:reconcile` report
     completed intents missing wallet grants, wallet grants without completed
     intents, grant amount/currency mismatches, and processed webhook events
     that did not resolve a completed local intent.
   - This is still a local-state reconciliation report, not provider settlement
     import or scheduled alerting.
12. Post-completion provider refund clawback exists.
   - Provider `refunded` / `reversed` / `chargeback` statuses on completed
     purchases update the purchase intent, store provider evidence, and attempt
     an idempotent `wallet_purchase_reversal` spend.
   - If the player already spent the wallet currency, the intent records
     `clawback.status = "insufficient_balance"` and reconciliation reports a
     support-required refunded purchase missing reversal.
   - Completed-purchase `disputed`, `underpaid`, and `overpaid` statuses are
     recorded as support-review-required without automatic wallet clawback.
13. Manual audited support actions exist.
   - `support_actions` records immutable actor/action/player/target/status,
     note, evidence JSON, result JSON, and timestamp rows.
   - `npm run game:support:money-action` supports wallet grant/revoke, asset
     grant/revoke/freeze/unfreeze, purchase refund marking with optional
     clawback, and support action listing.
   - Read-only money lookup includes matching support action audit rows.
14. Stale wallet purchase-intent expiry exists.
   - `expireStalePurchaseIntents(...)` and
     `npm run game:wallet:expire-intents` mark old pending intents expired,
     skip active checkout creation claims, preserve terminal purchases, and
     record local-expiry metadata for support review.
15. Token-gated support admin API exists.
   - `SUPPORT_ADMIN_API_TOKEN` plus `x-support-actor-id` / bearer auth gates
     `/api/admin/support/money-lookup`, `/api/admin/support/actions`, wallet
     grant/revoke, asset grant/revoke/freeze/unfreeze, and purchase-refund
     endpoints.
   - The endpoints reuse the same support lookup and immutable
     `support_actions` mutation services as the CLI.
16. Normalized provider settlement import exists.
   - `provider_settlement_imports` and `provider_settlement_records` persist
     imported provider rows for auditability.
   - `importProviderSettlementRecords(...)` and
     `npm run game:wallet:import-settlement` compare normalized provider rows
     against local purchase intent status, expected price/currency, wallet
     grants, and refund clawbacks.
17. Provider-specific settlement adapters and local runbook exist.
   - `parseProviderSettlementInput(...)` accepts normalized/provider JSON and
     provider CSV files, maps BTCPay/NOWPayments/Telegram Stars fields, and
     preserves provider raw rows under the stored settlement record.
   - Telegram Stars settlement rows can reconcile through `invoice_payload`
     because `provider_settlement_records.local_intent_id` is now stored and
     checked before provider invoice/payment references.
   - `docs/payment-operations-runbook.md` documents dry-run-first imports,
     provider field mapping, and support follow-up.
18. Wallet ops scheduler hook and alert payload exist.
   - `runWalletOpsChecks(...)` aggregates wallet mirror drift and
     wallet-payment reconciliation into one report.
   - `npm run game:wallet:ops-check` emits the report for cron/scheduler use
     and posts non-clean reports to `WALLET_OPS_ALERT_WEBHOOK_URL` or
     `--alert-webhook-url=<url>`.
   - Tests cover clean no-alert behavior and failed reconciliation alert
     payloads.
19. Optional role-based support operator authorization exists.
   - `SUPPORT_ADMIN_OPERATORS_JSON` or `SUPPORT_ADMIN_OPERATORS` can restrict
     token-authenticated support actors by `support_viewer`, `wallet_operator`,
     `asset_operator`, `refund_operator`, or `admin` roles.
   - Existing token-only behavior remains available when no operator map is
     configured.
   - Tests cover unknown operators, read-only operators, wallet operators, and
     admin override.
20. Optional multi-operator support approval policy exists.
   - `SUPPORT_ADMIN_APPROVAL_REQUIRED=true` requires a second support actor on
     wallet, asset, and refund mutation endpoints.
   - The approver must be different from the action actor and must have
     `support_approver` or `admin`.
   - Successful approved mutations store approval evidence in the immutable
     `support_actions.evidence.approval` payload.
21. Disputed asset freeze/unfreeze tooling exists.
   - `supportFreezeAsset(...)` changes active asset instances to `frozen`,
     resets equipped portraits to default, and records immutable
     `asset_freeze` support actions with evidence.
   - `supportUnfreezeAsset(...)` restores frozen assets to active ownership,
     while `supportRevokeAsset(...)` can permanently revoke an already frozen
     disputed asset.
   - The token-gated support admin API exposes `asset-freeze` and
     `asset-unfreeze` endpoints behind the `asset_operator` role and optional
     multi-operator approval policy.
22. Instance-scoped support asset actions exist.
   - `supportFreezeAsset(...)`, `supportUnfreezeAsset(...)`, and
     `supportRevokeAsset(...)` accept `assetInstanceId` as a narrower target
     than `assetId`.
   - Instance-scoped mutations record `support_actions.target_type =
     "asset_instance"` and `target_id = player_asset_instances.id`, while still
     carrying the resolved `assetId` in the result payload.
   - The support CLI exposes `--instance=<assetInstanceId>`, and the token-gated
     admin API accepts `assetInstanceId` on freeze/unfreeze/revoke bodies.
23. Payment webhook timestamp-window checks exist.
   - `verifyPaymentWebhookTimestamp(...)` accepts common webhook/event timestamp
     headers and payload fields, supports ISO, epoch seconds, and epoch
     milliseconds, and rejects stale or far-future deliveries outside
     `PAYMENT_WEBHOOK_TIMESTAMP_TOLERANCE_MS` (default 5 minutes).
   - Missing timestamps remain allowed by default for provider compatibility,
     but `PAYMENT_WEBHOOK_REQUIRE_TIMESTAMP=true` or provider-specific
     `<PROVIDER>_WEBHOOK_REQUIRE_TIMESTAMP=true` can require them after live
     payload validation.
   - The payment webhook route performs signature verification first, then
     timestamp freshness validation before any event row is stored or processed.
24. Payment webhook secret rotation overlap exists.
   - BTCPay and NOWPayments signature verification accepts the legacy
     single-secret env vars plus plural rotation env vars:
     `BTCPAY_WEBHOOK_SECRETS` and `NOWPAYMENTS_IPN_SECRETS`.
   - The plural env vars accept comma/newline-separated strings or JSON arrays,
     allowing old provider secrets to remain valid during retry windows while a
     new primary secret is deployed.
   - `docs/payment-operations-runbook.md` documents the rotation steps and
     reminds operators to keep real secrets in the production secret manager.
25. Structured payment route logs exist.
   - Purchase-intent creation emits `wallet_purchase_intent` JSON logs with
     request id, player id, local intent id, provider, checkout status, bundle,
     surface, and price/currency fields.
   - Payment webhook routes emit `payment_webhook_rejected`,
     `payment_webhook_processed`, and `payment_webhook_failed` JSON logs for
     validation failures, duplicate/replay/ignored outcomes, and processing
     errors.
   - `docs/payment-operations-runbook.md` names the log kinds and records that
     raw provider payloads, checkout URLs, auth tokens, and webhook secrets stay
     out of runtime logs.
26. Focused wallet and skin e2e coverage exists.
   - `tests/game/wallet-purchase-ui.spec.js` covers wallet bundle listing,
     configured support/terms links, external checkout opening through
     `window.open`, Telegram invoice opening, wallet refresh after a real local
     Telegram successful-payment webhook, and pending/failed/expired checkout
     status text.
   - The same spec covers direct skin purchase/equip for the active mushroom
     after an audited support wallet grant and asserts character XP is
     unchanged. This pass also fixed the frontend customization refresh wiring
     so successful portrait purchase/roll actions call `auth.refreshBootstrap`.
   - The same spec patches bootstrap data only inside the browser test to pin
     roll-only vs direct-buy skin picker classes and pack detail/odds rendering
     without changing the global e2e backend gacha env.
   - The same spec now also pins complete-pack/no-unowned copy plus future and
     expired pack state labels in the skin picker.
27. Screenshot/layout coverage exists for wallet and pack states.
   - `tests/game/screenshots.spec.js` captures
     `02e-home-wallet-shop-{mobile,desktop}.png` and
     `02f-home-pack-states-{mobile,desktop}.png` with sidecar JSON diagnostics.
   - The test asserts configured support/terms links, checkout failure status,
     wallet shop viewport fit, no broken images, no horizontal overflow, active
     pack odds text, complete-pack/no-unowned copy, future/expired pack labels,
     and pack-detail non-overlap with portrait swatches.

### Remaining launch gates

- Re-run payment processor selection before launch, including current fees,
  checkout UX, settlement timing, support responsiveness, region coverage,
  webhook reliability, and adult/sexual-content policy. Record the chosen
  provider, fallback provider, and rejection reasons for providers that are not
  suitable.
- Validate Telegram Stars, BTCPay, and NOWPayments against real sandbox/live
  credentials and record callback payload examples.
- Set provider webhook secrets and rotation env vars in every non-local
  environment through the production secret manager.
- Validate provider timestamp fields where available and verify the new
  `payment_webhook_events` audit trail against real provider retry/replay
  behavior. **Local timestamp-window checks and multi-secret rotation overlap
  are implemented 2026-07-02**, but live payload shapes must be validated before
  requiring timestamps in production or removing old secrets.
- Route structured payment logs to the production payment/support sink and set
  retention according to the final dispute, tax/accounting, and privacy policy.
- Validate multi-instance paid mutation behavior against the production
  database/provider mix before launch. **Local DB-backed claims are implemented
  2026-07-02:** provider invoice creation uses checkout claim fields, and direct
  asset purchase / gacha roll paths use reusable `mutation_claims` rows with
  stale-claim recovery.
- Tune paid-route rate-limit capacities/refill windows against real traffic and
  move buckets to shared storage before horizontally scaling the API.
- Add final terms, refund/support contact, and payment-dispute copy reachable
  from the purchase UI. **Local support link plumbing is implemented
  2026-07-02:** `/api/app-config` exposes `paymentSupport`, the wallet popover
  renders configured support/terms links, and `/paysupport` / `/terms` bot
  replies reuse the same env-parsed URLs. Final copy, URLs, and legal review
  still need launch approval.
- Add adult-content/age/compliance gates before enabling crypto providers:
  prohibit unlawful sexual content, minors/CSAM, non-consensual material, and
  anything forbidden in the merchant's jurisdictions or provider terms.
- Confirm tax/accounting/data-retention requirements for virtual coin sales:
  receipts or invoice exports, VAT/sales-tax handling if applicable, retention
  period, support access, and deletion/privacy behavior.
- Expand purchase/gacha UI beyond MVP: pending/failed/completed states,
  active/expired/future pack states, and "no unowned assets left" handling.
  **Local basics are implemented 2026-07-02:** checkout-opening status text,
  support/terms links, and roll-pack detail/odds summaries now render on the
  home wallet/skin surfaces.
- Add dedicated frontend/e2e coverage for wallet bundle listing, Telegram
  invoice opening, wallet refresh after verified payment, external checkout
  fallback, purchase failure states, and roll-only vs direct-only skins.
  **Focused e2e now covers bundle listing, Telegram invoice opening,
  verified-payment wallet refresh through the local Telegram webhook, external
  checkout fallback, pending/failed/expired purchase status text, support/terms
  links, direct-buy skin ownership/equip for the active mushroom, unchanged
  character XP, roll-only vs direct-only picker states, and the frontend refresh
  hook after successful skin actions, complete/future/expired pack state copy,
  and screenshot-backed layout checks for wallet/support/pack surfaces.** Full
  real-pack odds coverage and live provider-status validation remain.
- Add frontend support-operator coverage before staff use. **First support admin
  UI coverage is implemented 2026-07-02:** `tests/game/support-admin-ui.spec.js`
  drives `/support-admin` through token-gated lookup, wallet grant, wallet
  revoke, refreshed balance, asset grant/freeze/unfreeze/revoke, purchase
  refund with wallet clawback, wallet transaction rows, purchase rows, asset
  rows, and support action rows. Stricter approval-policy and
  settlement/reconciliation UI coverage remains for those future screens.
- Add provider-specific operational notes and tooling for disputes, asset
  freezes, partial/late crypto payments, overpayments, and support
  investigations. **Local refund/reversal clawback and support-review status
  recording are implemented 2026-07-02, and local asset freeze/unfreeze support
  tooling, including instance-scoped targeting, is implemented**, but live
  provider semantics and runbooks still need validation.
- Expand the actual admin/support UI on top of the token-gated JSON API before
  non-engineering support use beyond basic actions. **Current UI shipped
  2026-07-02:** `/support-admin` provides lookup, audited wallet grant/revoke,
  asset grant/freeze/unfreeze/revoke by asset or instance id, purchase refund
  with optional wallet clawback, and optional approval-actor submission. Still
  add settlement/reconciliation operator screens, validate stricter
  approval-policy UX against configured operator roles, and finish production
  scheduler/webhook routing.
- Validate provider-specific settlement adapters and runbooks against real
  BTCPay, NOWPayments, and Telegram Stars sandbox/live exports/API payloads.
  Local adapters exist for common JSON/CSV shapes, but live examples and
  scheduled alert routing are still required.

## Phase 8 - Prepare Core Extraction Boundary

Status: **Phase 8A-8H complete for the current Mushroom consumer.** Phase 6A-6C
made the currency / XP vocabulary clean enough for a reusable boundary, the
runtime contract reference and extraction inventory exist, the first pure and
adapterized clusters are in `backpack-game-core`, and Mushroom now consumes the
core through a nested submodule. The next extraction proof now has a concrete
target, `meat-master`; let that integration drive API cleanup instead of
inventing an unrelated consumer only to mark reuse complete.

Only continue extracting after the currency names above are clean enough that
the core package does not inherit Mushroom-specific vocabulary, and only move a
cluster when it has a clear adapter boundary and tests.

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
- Battle simulation now uses a core loop plus Mushroom ability hooks; future
  battle work should keep Mushroom ids, stats, rewards, and replay storage in
  product code.

Keep these in `mushroom-master`:

- Mushroom definitions, names, lore, portraits, wiki, achievements, seasons, and
  home field.
- Telegram auth, Express routes, SSE, database models, migrations, and
  persistence services.
- Product-specific asset catalogs and localized UI copy.
- Any code that references `player_mushrooms`, `PORTRAIT_VARIANTS`, wiki
  thresholds, or Mushroom lore directly.

### Phase 8D - Bot Loadout Adapter Extraction

Status: **Implemented.** Bot-loadout generation moved into
`backpack-game-core` through product providers. Mushroom ghost snapshot and
portrait glue stayed local.

#### Source Of Truth

- Current Mushroom adapter: `app/server/services/bot-loadout.js`
- Current core implementation: `backpack-game-core/src/backpack-loadout.js`
- Current behavior tests: `tests/game/bot-loadout.test.js`
- Current extraction inventory:
  `docs/backpack-game-core-extraction-inventory.md`
- Current core package latest commit at ship time: `4056d7a`
  (`Add backpack loadout generator`)

#### Stated Criteria And Constraints

- Continue moving reusable Mushroom game mechanics into
  `backpack-game-core`.
- Keep product-specific Mushroom data, portraits, persistence, wallet, gacha,
  payments, and UI out of the core package.
- Preserve the simple Mushroom game behavior while making the backend reusable
  for another backpack game.
- Keep compatibility through pinned Git dependency updates, one cluster at a
  time.

#### Shipped Boundary

- Core owns reusable bot/loadout mechanics only:
  - weighted item choice over injected item weights,
  - first-fit bag placement,
  - rectangular item placement,
  - occupied cell tracking,
  - retry orchestration.
- Mushroom owns all product hooks:
  - artifact catalog and prices,
  - affinity weights,
  - starter presets and starter bag,
  - validation policy,
  - portrait URLs and ghost snapshot response shape.
- Existing `createBotLoadout(mushroom, rng, budget)` and
  `createBotGhostSnapshot(seedInput, mushroomId, budget)` public behavior stays
  stable.
- Core tests use a fake catalog before Mushroom imports change.
- Focused Mushroom tests pass after the wrapper swap.

#### Open Assumptions

- Use ESM JavaScript and the existing pinned Git dependency workflow.
- Do not add a hub submodule for `backpack-game-core` in this phase unless the
  user asks for hub metadata work.
- Keep `createRng` local for now; if deterministic shuffle extraction is needed,
  move only shuffle/random helpers, not server id/time utilities.

#### Core Adapter

The core function is shaped around injected providers:

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

The Mushroom wrapper should remain:

```js
createBotLoadout(mushroom, rng, budget)
```

It should build the core arguments from `game-data.js`, call the core helper,
then return the current `{ gridWidth, gridHeight, items }` response.

#### Verification

- `backpack-game-core`: `npm test`
- `mushroom-master`:
  `node --test tests/game/bot-loadout.test.js tests/game/round-resolution.test.js tests/game/loadout-refactor.test.js`
- `npm run game:build`

#### Rollback

- Revert the Mushroom dependency pin and wrapper import.
- Restore the previous local `createBotLoadout` body.
- Keep the core commit unless it contains secrets or bad generated artifacts.

### Phase 8E - Battle Simulation Hook Extraction

Status: **Implemented.** The deterministic battle loop moved into
`backpack-game-core` through product-provided ability and metadata hooks.
Mushroom combat identity, ability rules, artifact metadata, and persistence
stayed local.

#### Source Of Truth

- Current Mushroom adapter: `app/server/services/battle-engine.js`
- Current core implementation: `backpack-game-core/src/battle-simulation.js`
- Current core tests: `backpack-game-core/tests/battle-simulation.test.js`
- Current behavior tests: `tests/game/battle-engine.test.js`
- Current extraction inventory:
  `docs/backpack-game-core-extraction-inventory.md`
- Current core package latest commit at ship time: `b9879bd`
  (`Add hookable battle simulation core`)

#### Shipped Boundary

- Core owns reusable battle-loop mechanics only:
  - deterministic step iteration,
  - speed ordering plus base-speed/random tiebreak fallback,
  - action and skip event sequencing,
  - damage, armor, stun, death, and step-cap resolution,
  - final result and event shaping.
- Mushroom owns all product hooks:
  - snapshot-to-combatant derivation from Mushroom catalog data,
  - active and passive ability behavior,
  - Kirt and Morga ordering hooks,
  - artifact attribution and lore `effectTags`,
  - narration labels,
  - `STEP_CAP`, `MAX_STUN_CHANCE`, and seeded RNG creation.
- Existing `simulateBattle(snapshot, seed)` remains the Mushroom service API, so
  run resolution and replay persistence keep their import surface.

#### Non-Goals

- Do not move Mushroom ids, names, base stats, artifact catalog data, rewards,
  rating, DB persistence, or replay storage into core.
- Do not move `createRng` / `shuffleWithRng` in this slice. They were extracted
  separately in Phase 8G after the battle adapter stayed stable.
- Do not change combat balance or requirements as part of this adapter move.

#### Verification

- `backpack-game-core`: `npm test`
- `mushroom-master`:
  `node --test tests/game/battle-engine.test.js tests/game/round-resolution.test.js tests/game/challenge-run.test.js`
- `npm run game:build`

#### Rollback

- Revert the Mushroom dependency pin and `battle-engine.js` adapter.
- Restore the previous local battle-loop implementation.
- Keep the core commit unless it contains secrets or bad generated artifacts.

### Phase 8F - Loadout Validation Adapter Extraction

Status: **Implemented.** The flat-grid loadout validator moved into
`backpack-game-core` through product-provided catalog, pricing, family, and stat
policy hooks. Mushroom keeps its artifact data, bag policy, grid constants, and
service exports local.

#### Source Of Truth

- Current Mushroom adapter: `app/server/services/loadout-utils.js`
- Current core implementation: `backpack-game-core/src/loadout-validation.js`
- Current core tests: `backpack-game-core/tests/loadout-validation.test.js`
- Current behavior tests:
  `tests/game/validator-split.test.js`, `tests/game/bag-shape.test.js`,
  `tests/game/bag-items.test.js`, `tests/game/bot-loadout.test.js`, and
  `tests/game/loadout-refactor.test.js`
- Current extraction inventory:
  `docs/backpack-game-core-extraction-inventory.md`
- Current core package latest commit at ship time: `d884410`
  (`Add provider-driven loadout validation core`)

#### Shipped Boundary

- Core owns reusable loadout-validation mechanics:
  - flat-grid item bounds and overlap checks,
  - active-bag placement and overlap checks,
  - bag cell set derivation and item coverage checks,
  - effective grid-height expansion from active bag extents,
  - loadout currency-budget summing,
  - stat aggregation and configured stat clamps,
  - the orchestrated `validateLoadoutItems` flow.
- Mushroom owns product hooks:
  - artifact lookup and price rules,
  - item dimensions and bag/family classification,
  - container sentinel semantics,
  - grid constants,
  - combat stat contribution rules and caps.
- Existing Mushroom exports from `loadout-utils.js` remain stable for
  `game-run-loadout.js`, `battle-service.js`, `battle-engine.js`, tests, and
  other callers.

#### Non-Goals

- Do not move Mushroom artifacts, families, prices, balance constants, database
  rows, or API route semantics into core.
- Do not change loadout error messages, budget math, active-bag policy, or
  battle stat contribution behavior in this slice.
- Keep RNG/shuffle helper movement separate from validation behavior; that
  follow-up happened in Phase 8G.

#### Verification

- `backpack-game-core`: `npm test`
- `mushroom-master`:
  `node --test tests/game/validator-split.test.js tests/game/bag-shape.test.js tests/game/bag-items.test.js tests/game/bot-loadout.test.js tests/game/loadout-refactor.test.js`
- `npm run game:build`

#### Rollback

- Revert the Mushroom nested core pointer and `loadout-utils.js` adapter.
- Restore the previous local validator implementation.
- Keep the core commit unless it contains secrets or bad generated artifacts.

### Phase 8G - RNG And Shuffle Helper Extraction

Status: **Implemented.** The numeric RNG state machine, integer rolls, and
non-mutating shuffle helper moved into `backpack-game-core`. Mushroom keeps
string seed hashing local so existing deterministic seed inputs keep their
sequence while the reusable package stays browser-safe.

#### Source Of Truth

- Current Mushroom string-seed adapter: `app/server/lib/utils.js`
- Current Mushroom compatibility re-export:
  `app/server/services/battle-engine.js`
- Current core implementation: `backpack-game-core/src/rng.js`
- Current core tests: `backpack-game-core/tests/rng.test.js`
- Current behavior tests:
  `tests/game/core-submodule.test.js`, `tests/game/battle-engine.test.js`,
  `tests/game/bot-loadout.test.js`, `tests/game/round-resolution.test.js`,
  `tests/game/challenge-run.test.js`, and
  `tests/game/validator-split.test.js`
- Current extraction inventory:
  `docs/backpack-game-core-extraction-inventory.md`
- Current core package latest commit at ship time: `13e6e0c`
  (`Add reusable rng helpers`)

#### Shipped Boundary

- Core owns reusable RNG/shuffle mechanics:
  - numeric-seed deterministic RNG state progression,
  - integer rolls,
  - non-mutating seeded shuffle.
- Mushroom owns product seed derivation:
  - `hashToSeed(seedInput)` remains in `app/server/lib/utils.js`,
  - `createRng(seedInput)` hashes string seed inputs with Node `crypto`, then
    delegates to core `createSeededRng`,
  - server services keep their current imports through compatibility exports.
- Core does not import Node `crypto`, `Date`, database state, game ids, or
  balance constants.

#### Non-Goals

- Do not change shop, bot, ghost, or battle seed strings.
- Do not move secure paid-roll RNG source selection into core; games inject the
  runtime RNG. Reusable gacha roll selection and simulation helpers can move to
  core in Phase 8I.
- Do not expose payment, wallet, or asset acquisition policy through this
  helper.

#### Verification

- `backpack-game-core`: `npm test`
- `mushroom-master`:
  `node --test tests/game/core-submodule.test.js tests/game/battle-engine.test.js tests/game/bot-loadout.test.js tests/game/round-resolution.test.js tests/game/challenge-run.test.js tests/game/validator-split.test.js`
- `npm run game:build`

#### Rollback

- Revert the Mushroom nested core pointer and restore local `createRng`,
  `randomInt`, and `shuffleWithRng` implementations.
- Keep the core commit unless it contains secrets or bad generated artifacts.

### Phase 8H - Core Package Type Declarations

Status: **Implemented.** `backpack-game-core` now ships TypeScript declaration
files for the root package export and every subpath export without converting
the runtime source away from ESM JavaScript.

#### Source Of Truth

- Current core declarations: `backpack-game-core/src/*.d.ts`
- Current package metadata: `backpack-game-core/package.json`
- Current declaration guard: `backpack-game-core/tests/package-types.test.js`
- Current core package latest commit at ship time: `d5fb481`
  (`Add package type declarations`)

#### Shipped Boundary

- Core package metadata exposes:
  - top-level `"types": "./src/index.d.ts"`,
  - per-export `"types"` and `"import"` condition targets for the root export
    and all subpaths.
- Declaration files type the stable reusable mechanics, provider hooks, and
  returned result shapes.
- Product-owned catalog and runtime objects remain generic/plain-object types,
  because concrete games own artifacts, abilities, wallet state, assets,
  payment policy, and persistence.

#### Non-Goals

- Do not migrate the package to TypeScript in this slice.
- Do not overfit declarations to Mushroom artifact/catalog shapes.
- Do not introduce build tooling or publish automation before another consumer
  needs it.

#### Verification

- `backpack-game-core`: `npm test`
- `backpack-game-core`: `npm pack --dry-run`
- `mushroom-master`: `npm run game:core:check`
- `mushroom-master`: `node --test tests/game/core-submodule.test.js`

#### Rollback

- Revert the declaration files and package export metadata if they block
  runtime package resolution.
- Keep prior mechanics commits unless they contain secrets or bad generated
  artifacts.

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
  TypeScript declarations are now shipped; migrate runtime source to TypeScript
  only if a future consumer or release process needs it.
- Export pure functions only in the first pass. No database, Express, Telegram,
  filesystem, or image dependencies.
- Require catalogs/config through function arguments instead of imports from
  `mushroom-master`.
- Copy or port the relevant unit tests into the core repo before swapping
  imports in `mushroom-master`.
- Consume the core through a nested game-repo submodule once the first useful
  commits exist. The temporary pinned Git dependency was useful for the first
  extraction slices, but the backpack game should move to a local dependency
  backed by a checked-out `backpack-game-core` submodule.

## Phase 10 - Integrate Core Back Into `mushroom-master`

1. Add `backpack-game-core` as a nested submodule of the backpack game
   (`mushroom-master`) at `vendor/backpack-game-core`.
2. Switch `package.json` to consume the package through that local submodule
   path, `file:vendor/backpack-game-core`, while keeping imports as
   `@microwavedev/backpack-game-core`.
3. Update `package-lock.json` and verify `npm install` / `npm ci` from a clean
   checkout after `git submodule update --init --recursive`.
4. Add a small install guard or verification script that gives a clear error
   when the nested core submodule has not been initialized.
5. Update CI/deploy/bootstrap docs to initialize nested submodules before
   dependency installation.
6. Keep adapter files in `mushroom-master` where product data is passed into
   core functions.
7. Replace local imports in `mushroom-master` one cluster at a time:
   - `bag-shape`
   - placement / validation
   - fusion matching
   - shop generation
   - battle engine through product hooks
8. Run the relevant Mushroom Battles verification after each cluster:
   - `npm run game:test`
   - targeted Playwright specs for UI-facing changes
   - `npm run game:test:e2e` before final handoff
9. Commit order for core updates:
   - commit and push `backpack-game-core`,
   - update and commit the nested core submodule pointer in `mushroom-master`,
   - update the hub `mushroom-master` pointer last.
10. Update hub metadata only if `backpack-game-core` is also added as a
    top-level hub repo for coordination:
    - `SUBMODULES.md`
    - `submodules.manifest.json`
    - hub submodule pointer

### Phase 10A - Submodule Consumption Implementation Plan

Status: **Implemented.** The first extraction slices used a pinned GitHub
package dependency. The reusable-core integration now uses a nested submodule
inside the backpack game repo, so the game owns an explicit core pointer and
imports core logic from the checked-out source.

Implementation steps:

1. Done: add `git@github.com:MicrowaveDev/backpack-game-core.git` as a nested Git
   submodule inside `mushroom-master` at `vendor/backpack-game-core`, unless an
   existing repo convention suggests a better local package path.
2. Done: change the game dependency from
   `github:MicrowaveDev/backpack-game-core#<sha>` to a local file dependency
   that points at the submodule, while keeping all runtime imports as
   `@microwavedev/backpack-game-core`.
3. Done: update `package-lock.json`, install/bootstrap docs, and any CI/dev setup
   instructions so fresh clones run `git submodule update --init --recursive`
   before installing dependencies.
4. Done: add a cheap verification guard or test that fails clearly when the core
   submodule is missing.
5. Done for this core-consumption slice: verify core tests, the submodule
   guard, focused game tests, `npm ci`, the production game build, and the full
   game unit suite after the unrelated Home Field prompt/queue fix landed.
6. Done: commit the nested core pointer in `mushroom-master`, push it, then update
   the hub `mushroom-master` pointer.

Additional TODOs for that pass:

1. Done: add/update repo-local agent instructions for nested-submodule staging.
2. Done: add a consumer smoke test that imports from
   `@microwavedev/backpack-game-core` through the installed local dependency.
3. Done: confirm `npm ci` works with the `file:` dependency after submodule init.
4. Ongoing rule: keep `backpack-game-core` source changes committed in the core repo before
   committing the game pointer.
5. Ongoing rule: document the exact core commit SHA in the extraction inventory after the
   pointer moves.
6. Done: add TypeScript declarations for the core package before another game
   consumes it.
7. Done: add a core package changelog and a Mushroom consumer update log for
   core SHA to game-commit mapping:
   `vendor/backpack-game-core/CHANGELOG.md` and
   `docs/backpack-game-core-update-log.md`. Current consumed core pointer is
   `786d41c`; typed package baseline remains `d5fb481`.
8. Updated 2026-07-04: second consumer target identified as
   `git@github.com:nuclear-pancakes/meat-master.git`. Use the real
   `meat-master` integration to drive API cleanup instead of adding the package
   to unrelated repos only to prove reuse.

### Phase 8I - Multi-Game Core Domain Extraction

Status: **In progress.** The prior extraction intentionally kept wallet, asset,
gacha, and most frontend behavior local because only Mushroom Battles consumed
the package. The new target consumer,
`git@github.com:nuclear-pancakes/meat-master.git`, makes that boundary too
narrow: reusable backend domain modules and reusable Vue frontend modules should
move to `backpack-game-core`, while each game keeps its own persistence,
payment providers, route wiring, catalogs, art, copy, compliance gates, and
product-specific page composition. The first shared backend domain slice,
`asset-gacha`, is implemented in core and consumed by Mushroom through adapter
wrappers. Subsequent shared backend slices now include gacha admin validation,
gacha simulation, wallet accounting, and profile asset state helpers.

#### Source Of Truth For This Revision

- User request, 2026-07-04: move all reusable gacha and game-core functionality
  to the core repo, consume that core as a submodule in Mushroom Battles, and
  make `meat-master` another playable game using the same core.
- User clarification, 2026-07-04: the backend has reusable modules that should
  live in core, and the Vue frontend also has reusable components, pages, and
  services that should live in core so both games can share them.
- `meat-master` should have two attractive adult female bikini characters,
  starter bags/artifacts copied or adapted from Mushroom Battles, and enough
  product data/UI wiring to be playable.
- Mushroom Battles must keep the current simple direct-buy skin lane available
  when gacha is off.
- The shared core must not become Mushroom-specific or Meat-specific. Product
  identity, character lore, explicit content policy, artwork, payment-provider
  integrations, Telegram Mini App details, database migrations, and operator UI
  stay outside the core.
- Success means both games import the same package APIs for backend backpack
  mechanics, asset acquisition policy, and gacha outcome logic, and also import
  the same Vue/composable/service APIs for reusable shop, backpack, battle,
  wallet/asset, and gacha UI flows. Product adapters prove the same rules and
  screens under different character/catalog/art/copy data.
- Architecture review, 2026-07-04: use Geesome as the closest local precedent.
  `geesome-libs` keeps reusable client/helpers, `geesome-ui` packages frontend
  services/pages/components/assets, and `geesome-node` organizes backend
  features as modules with `interface.ts`, `index.ts`, `api.ts`, models, query
  helpers, migrations, and workers. Backpack should follow that layered
  discipline, while avoiding the older Geesome pattern of consumers importing
  `geesome-libs/src/*` deep paths.

#### Core Boundary

`backpack-game-core` should become a full-stack shared repo, not only a backend
mechanics package. Treat it as four layers that can start as subpath exports in
one package and split into packages when build/runtime needs justify it:

1. **Backend domain modules:** pure or adapter-driven modules consumed by
   Express services in Mushroom and Meat.
2. **Shared client/contracts layer:** typed DTOs, response shapers, schemas,
   and a `BackpackGameClient` or client factory that wraps API calls without
   owning auth, storage, route prefixes, or product policy.
3. **Browser-safe services and Vue composables:** fetch-client factories,
   state machines, pack/shop/loadout/battle view-model logic, and composables
   that receive product API clients and catalog/config adapters.
4. **Vue components and page modules:** neutral presentational components and
   optional page shells that communicate through props/events/slots and do not
   import product assets, routes, stores, or copy directly.

Recommended repo shape after the next architecture pass:

```text
backpack-game-core/
  package.json
  packages/
    core/      # pure mechanics and domain policy, no Vue or DB
    client/    # API client, DTO contracts, view-model shapers
    vue/       # Vue composables/components/page shells, Vue as peer dependency
  src/         # compatibility facade while the package is still migrating
```

If the package stays single-package for one or two more slices, expose these
layers through stable exports such as
`@microwavedev/backpack-game-core/modules/gacha`,
`@microwavedev/backpack-game-core/client`, and
`@microwavedev/backpack-game-core/vue`. Do not allow new consumers to import
from `src/*`, `packages/*/src/*`, or a nested submodule path directly.

Backend module shape should mirror the useful Geesome pattern:

```text
modules/<feature>/
  interface.{js,ts}  # public service contract and DTO types
  index.{js,ts}      # module factory over product adapters
  api.{js,ts}        # optional route binding helpers, no Express globals
  validation.{js,ts} # pure validators where useful
  *.test.{js,ts}
```

Use this shape for future `wallet`, `asset`, `gacha`, `gacha-admin`,
`run-shop`, `loadout`, and `battle` modules. Product games still own database
models, migrations, repositories, Express app registration, auth, rate limits,
and audit storage.

Move backend modules into `backpack-game-core`:

- asset catalog normalization, eligibility filtering, direct-buy availability,
  and acquisition-mode policy;
- profile asset instance/equipment state transitions as pure or adapter-driven
  functions;
- wallet accounting primitives: balance deltas, idempotent mutation outcome
  shaping, refund/reversal classification, and insufficient-balance checks;
- gacha pack/item validation, active/future/expired visibility rules, direct-buy
  blocking rules, roll candidate selection, weighted slot selection, duplicate
  copy-cap handling, duplicate burn target selection, pity/guarantee helpers,
  and odds/simulation helpers;
- admin-safe validation helpers for pack release checklist, fixture shape,
  planned asset promotion rules, and plan-item asset-id/character-link
  invariants.

Move Vue/frontend modules into `backpack-game-core` in small layers:

- headless services/composables for bootstrap loading, shop offers, backpack
  placement, loadout totals, battle replay playback, wallet/asset catalog
  state, gacha pack state, odds preview, and admin season-plan editing;
- reusable presentational components such as backpack grids, artifact tiles,
  shop offer lists, character selectors, battle logs/replay timelines, wallet
  balance badges, asset inventory/equipment panels, gacha pack cards, roll
  result modals, odds tables, and admin validation/checklist panels;
- optional page-level modules for repeated flows such as prep/shop, battle
  replay, asset inventory, gacha packs, and gacha admin plan review, but only
  when the page accepts product adapters for routing, auth, copy, art, and API
  calls;
- shared CSS tokens or minimal structural styles when they are neutral enough
  for both games. Game-specific themes, palettes, copy, backgrounds, and
  character/product imagery stay in the consuming game.

Keep in each game repo:

- SQL schemas, migrations, repositories, Express routes, auth, rate limits,
  idempotency storage, support-action persistence, and audit-log storage;
- payment processors, Telegram Stars, BTCPay/NOWPayments adapters, provider
  webhook signatures, invoice lookup, tax/accounting exports, and content-policy
  compliance gates;
- product catalogs, character ids, ability hooks, portrait/skin art, adult
  content presentation, localization strings, final route maps, page assembly,
  theme overrides, admin permissions, storage backends, and generated images;
- secure RNG source selection for paid rolls. Core can accept an injected RNG,
  but game services decide whether it is deterministic for simulation or
  cryptographically secure for paid runtime rolls.

#### Implementation Finding - 2026-07-04

The first Phase 8I implementation slice should be `asset-gacha`, not
`wallet-accounting`. Asset/gacha policy, validation, candidate filtering,
weighted selection, duplicate/burn rules, pity, and simulation are mostly pure
over catalogs, ownership snapshots, time, and RNG. Wallet accounting touches
ledger persistence, provider settlement, refunds, and idempotent mutation state,
so it should move only after Mushroom is already stable on the shared gacha
core.

Frontend finding on 2026-07-04: extract headless browser-safe services and
Vue composables before extracting full pages. Components with clean props/events
are next. Page-level modules come last, because Mushroom's Telegram Mini App
shell, Support Admin auth, localization, and Meat's product theme are
composition concerns rather than shared mechanics.

Geesome-inspired correction on 2026-07-04: insert a package/module architecture
pass before the next large extraction. Define the public module layout, client
factory contract, Vue peer/build policy, and export map first, then move
services and components into those lanes. This should prevent a flat "core
bucket" and keep Mushroom and Meat integrations predictable.

Post-implementation review on 2026-07-04: the package/module architecture pass
is now the first shipped slice, not a future blocker. Core commit `3e3d5d6`
exposes layered `modules/*`, `client`, and `client-view-model` exports, and
Mushroom plus Meat consume those public paths. The next work should therefore
move one real reusable behavior cluster at a time through those exports instead
of moving whole Mushroom services wholesale.

The highest-leverage backend slice after facades was `gacha-admin-validation`,
and it landed in core commit `8345448`: pure pack release checklist helpers,
fixture import/export shape validation, planned asset promotion metadata,
plan-item asset-id/character-link rules, season-plan catalog projection, and
plan coverage summaries. This was safer than wallet or asset ownership because
the logic is mostly deterministic over plain rows/catalog snapshots, while
wallet and asset modules still touch ledgers, idempotency, provider evidence,
DB row lifecycle, support actions, and paid rollback semantics.

The next completed backend slice is `gacha-simulation`, landed in core commit
`b3da379`: deterministic odds preview now runs through
`modules/gacha/simulation` over injected packs, catalogs, ownership snapshots,
copy counts, pity state, seed, and RNG. Mushroom keeps static/runtime pack
lookup, catalog visibility, CLI wiring, and admin preview payload shaping local.

The next completed backend slice is `wallet-accounting`, landed in core commit
`af520f0`: profile-wallet delta validation, balance math, purchase
grant/reversal mutation shaping, purchase status classification, and settlement
invariants now run through `modules/wallet`. Mushroom keeps SQL balance rows,
transaction inserts, keyed locks, `players.spore` mirrors, provider webhooks,
support actions, settlement imports, and reconciliation queries local.

The next completed backend slice is `profile-asset-state`, landed in core
commit `6ae688b`: profile asset instance/equipment row shaping, ownership maps,
paid/free equipment validation, direct-purchase spend mutation shaping,
acquisition-source selection, instance draft rows, and portrait variant
projection now run through `modules/assets`. Mushroom keeps runtime catalog
lookup, SQL row lifecycle, gacha roll/burn grants, support actions, paid
rollback behavior, route payloads, and the `player_mushrooms.active_portrait`
compatibility mirror local.

The next completed backend cleanup is asset catalog acquisition policy, landed
in core commit `77b1d7b`: paid/free default acquisition modes, per-asset
overrides, explicit `packId: null`, and default pack assignment now run through
`modules/gacha`. Mushroom keeps env parsing, product pack ids, portrait URLs,
runtime catalog assembly, and direct-buy/roll execution local.

The next completed frontend/client slice is asset pack client view-model
shaping, landed in core commit `578279d`: rarity odds text,
guarantee/pity/duplicate labels, active/availability labels, and roll-pack
summary shaping now run through `client-view-model` over passed packs,
portraits, ownership ids, copy templates, and rarity-label callbacks. Mushroom
keeps localization strings, selected-character state, runtime bootstrap data,
routes, actions, and visual composition local.

The next completed frontend/client slice is wallet and roll feedback
view-model shaping, landed in core commit `cf7c680`: wallet balance fallback,
bundle filtering by surface, bundle price formatting, purchase status/support
link shaping, and asset roll-result/problem feedback assembly now run through
`client-view-model` over passed labels. Mushroom keeps Telegram/web surface
detection, emitted route actions, localization strings, runtime state, and
visual composition local.

The next completed frontend/client slice is grid-cell classification, landed
in core commit `f403553`: slot-first bag row lookup, grid cell role
classification, and occupied footprint key generation now run through
`client-view-model`. Mushroom keeps visual classes, overlays, drag/drop
events, layout constants, and final board composition local.

The next completed frontend/client slice is artifact stat view-model shaping,
landed in core commit `41a3ad5`: stat total summing, signed delta formatting,
bonus-entry DTO shaping, and loadout stat text composition now run through
`client-view-model` over passed stat labels, order, and suffixes. Mushroom keeps
product stat labels, visual role classes, inline/chip UI composition, and
artifact catalog semantics local.

The next completed frontend/client slice is artifact grid utility shaping,
landed in core commit `725ffab`: occupied-cell value maps and preferred artifact
preview orientation now run through `client-view-model` for rectangular and
shape-bearing artifacts. Mushroom keeps placement state, visual preview
composition, drag/drop actions, product rendering, and gameplay mutation logic
local.

The next completed frontend/client cleanup is canonical artifact preview
orientation, landed in core commit `786d41c`: preview-only surfaces now use a
separate helper so non-bag bitmap previews keep authored dimensions, while
shape-bearing and legacy bags still get derived preview footprints. Mushroom
keeps placement-preferred orientation for placement flows.

The next completed frontend/client cleanup is wallet and asset-roll status
normalization, landed in core commit `f387670`: purchase-intent statuses,
Telegram invoice callback statuses, and roll/burn error messages now map to
the shared client status vocabulary through `client-view-model`. Mushroom keeps
route actions, provider checkout opening, localization, runtime state, and UI
composition local.

The next completed backend/domain cleanup is asset gacha roll/burn result DTO
shaping, landed in core commit `9b7b505`: persisted roll and duplicate-burn
exchange rows now normalize through `modules/gacha`, and replay-safe
`rollResult` / `burnResult` payloads are shaped over injected pack/catalog/items.
Mushroom keeps SQL queries, wallet spends, asset grants, secure RNG,
idempotency, route payload ownership, and product error handling local.

The next completed asset inventory/equipment response cleanup is profile asset
target-variant list shaping, landed in core commit `0f8beee`: progression
portrait variants now project through `modules/assets` over injected catalog,
ownership state, active ids, asset-id adapters, and product policy adapters.
Mushroom keeps portrait id convention, runtime catalog assembly, gacha-plan
policy, active/equipment resolution, product routes, and route payload ownership
local.

The next completed frontend/client cleanup is wallet and asset-roll mutation
view-state shaping, landed in core commit `fc53abc`: opening, success, failure,
checkout-unavailable, and global-error transition DTOs now run through
`client-view-model`. Mushroom keeps API routes, idempotency-key generation,
Telegram/web checkout opening, invoice callbacks, bootstrap refresh hooks,
runtime state ownership, and product copy local.

The next completed client/contracts cleanup is response-envelope unwrapping,
landed in core commit `b56ad91`: the shared route-adapter client can unwrap
existing `{ success, data, error }` backend payloads and throw structured
client errors for `success: false`. Mushroom customization wallet/gacha flows
now use a local route map with the core client while keeping route ownership,
session header policy, idempotency-key generation, Telegram/web checkout
opening, invoice callbacks, bootstrap refresh hooks, runtime state ownership,
and product copy local.

The next completed consumer-adoption cleanup keeps using core commit
`b56ad91`: Mushroom social and wiki-detail flows now use the local route map
with the shared route-adapter client. Route ownership, session header policy,
navigation effects, replay autoplay, runtime state ownership, and product copy
stay local.

The following consumer-adoption cleanup also stays on core commit `b56ad91`:
Mushroom auth, bootstrap, settings, session, and active-character routes now use
the local route map with the shared route-adapter client. Telegram auth-code
verification remains raw because it has a special `{ success, needsBotAuth }`
contract; bootstrap state projection, cache ownership, navigation effects,
runtime state ownership, and product copy stay local.

The route-client adoption lane is now complete enough for the current
extraction phase: Mushroom game-run start/readiness/loadout/shop/buy/sell/read
and abandon routes also use the local route map with the shared route-adapter
client. Run state projection, placement payload shaping, replay loading,
haptics, runtime state ownership, and product copy stay local.

The final cleanup for that lane moved replay and dev-tool routes to the same
shared route-adapter client and removed the legacy `apiJson` helper from live
frontend code. Replay timers/state, dev fixtures, runtime state ownership, and
product copy stay local.

Post-route-client extraction review on 2026-07-04: yes, more should still move
to `backpack-game-core`, but the next moves should be narrower than whole
Mushroom services or pages.

Implemented after this review: core commit `458d4bb` added profile asset
record, owned-instance summary, equipped-target summary, purchase result, equip
result, and grant summary DTO shapers. Mushroom now consumes them for direct
asset buys, equipment changes, roll/burn grants, and idempotent replay
summaries while keeping SQL, wallet spends, RNG, catalogs, mutation claims, and
route ownership local.

Implemented as the next slice: core commit `5ee7ee8` added headless
wallet/gacha state helpers for wallet bundle loading, wallet checkout
next-action decisions, and asset roll/burn mutation refresh decisions.
Mushroom now consumes them in `useCustomization` while keeping API calls,
Telegram/web checkout side effects, bootstrap refresh callbacks, route names,
and product copy local.

Implemented as the next slice: core commit `f4734ea` added run-shop response
patch helpers for refresh-shop, buy, and sell state projection. Mushroom now
consumes them in `useGameRun` while keeping API calls, price guards, row-id
sell payload construction, placement payload construction, haptics, replay
loading, route names, and product copy local.

Implemented as the next slice: core commit `2092663` added broader game-run
response patch helpers for start, ready, round-transition, and completion
state projection. Mushroom now consumes them in `useGameRun` while keeping
routes, loadout projection, bootstrap updates, replay loading, navigation,
haptics, and product copy local.

Implemented as the next slice: core commit `ee2a275` added replay playback
state helpers for speed selection, long-battle boost, autoplay delay, tick
advancement, load/set-speed patches, and timeline shaping. Mushroom now
consumes them in `useReplay` while keeping timers, route calls, settings
persistence, event formatting, navigation, Vue computed wrappers, and UI local.

Move next:

- **Remaining headless wallet/gacha state services:** browser-safe helpers for
  pack list loading, duplicate-burn availability, odds-preview state, and
  broader route-client orchestration over injected clients and copy/policy
  adapters. Telegram invoice opening, web checkout opening, and refresh
  callbacks stay product-local.
- **Broader gacha admin view models:** release checklist summaries,
  season-plan coverage matrix, odds-preview table DTOs, and plan-item editor
  validation state. Pack snapshot/draft diff and diff-row shaping are already
  in core via Phase 8AM.

Move later, after the above contracts are stable:

- **Neutral Vue primitives:** backpack grid, artifact tile, wallet badge, asset
  picker, gacha pack card, odds table, roll result modal, battle log/timeline,
  and admin checklist components. These should come after Meat has enough
  equivalent surfaces to verify prop/event boundaries.

Keep local for now:

- SQL schemas, repositories, Express routes, auth/session policy, rate limits,
  idempotency storage, support-action/audit persistence, and route maps.
- Payment providers, Telegram Stars, crypto checkout/webhook adapters, provider
  signatures, refund/tax/compliance handling, and adult-content gates.
- Runtime catalogs, character ids, portrait/skin art, localization, generated
  images, page assembly, final CSS themes, haptics, secure paid-roll RNG
  selection, and product-specific support/admin permissions.

Frontend post-review on 2026-07-04: keep the core client route-adapter based
and do not extract the full Mushroom API client or full Vue pages yet. The next
frontend slices should stay close to DTO/view-model shaping and headless
services adjacent to `client-view-model`; neutral Vue components and page
shells come later, after the shared client contracts are stable and Meat has a
backend surface that can consume them.

#### Sub-Agent Execution Model

Use a lead agent plus scoped sub-agents for the Phase 8K and Phase 8J work. The
goal is maximum end-to-end throughput, not merely lower local CPU usage.
Sub-agents should receive narrow prompts, disjoint write scopes, exact
completion conditions, and permission to work ahead on independent evidence or
draft patches. Their findings are leads, not source of truth; the lead agent
verifies current files before editing or merging.

1. **Lead / integrator agent**
   - Owns the source-of-truth plan, dependency order, final file edits that
     cross boundaries, commit/push sequence, and hub or nested submodule
     pointer updates.
   - May write plan docs, package export maps, integration adapters, and
     update logs after reviewing sub-agent output.
   - Maintains the dependency graph, assigns work scopes, merges accepted
     patches, and keeps one authoritative integration checkout.
   - Serializes only steps that would create shared-state conflicts or wasteful
     duplicate work: installs, package builds, Playwright/screenshot commands,
     `npm pack --dry-run`, submodule pointer updates, commits, and pushes.
2. **Architecture audit agent**
   - Read-only scope: `vendor/backpack-game-core`, Mushroom frontend/backend
     adapters, Meat prototype, and Geesome precedent files.
   - Output: proposed package/module map, public export list, and migration
     order. No writes.
3. **Core backend module agent**
   - Write scope: only the assigned core module folder and its tests, such as
     `modules/gacha`, `modules/wallet`, or `modules/loadout`.
   - Must not edit game DB models, Express app wiring, payment providers,
     Vue files, or submodule pointers.
   - Completion: neutral core tests pass for the assigned module.
4. **Client/contracts agent**
   - Write scope: core client/DTO/view-model layer and matching type
     declarations.
   - Must not edit Vue components or game routes.
   - Completion: package export/type tests pass and consumer-facing DTO shapes
     are documented.
5. **Vue shared UI agent**
   - Write scope: shared composables/components/page-shell candidates only
     after the client/contracts layer is stable.
   - Must not import Mushroom or Meat stores, routers, auth, image paths,
     localization files, or CSS themes directly.
   - Completion: neutral component/composable tests pass with fixture adapters.
6. **Mushroom adapter agent**
   - Write scope: Mushroom thin adapters for one adopted core slice and the
     focused Mushroom tests/screenshots for that slice.
   - Must not edit core internals while adapting; report missing core hooks to
     the lead instead.
7. **Meat adapter agent**
   - Write scope: Meat adapters/tests for the same adopted core slice.
   - Must keep product copy, art, theme, adult-content gate, and catalog data
     local to Meat.
8. **Validation/review agent**
   - Read-only except for approved test snapshot or docs evidence updates.
   - Runs or reviews only the validation tier assigned by the lead, then
     reports exact commands, pass/fail status, and remaining risk.

Maximum-efficiency wave plan:

1. **Wave 0 - lead setup:** build the dependency graph, name the shared public
   contracts, assign file ownership, and decide whether each writer works in
   the main checkout or a temporary local worktree. Temporary worktrees are only
   for parallel draft speed; the lead lands final accepted changes back on the
   required base branch.
2. **Wave 1 - parallel discovery:** run architecture audit, backend inventory,
   frontend inventory, Mushroom adapter audit, Meat adapter audit, and
   validation-plan audit at the same time. Outputs are short briefs with exact
   files, proposed APIs, risk, and test commands.
3. **Wave 2 - contract-first core work:** implement public exports, DTOs,
   module interfaces, neutral fixtures, and package/type tests first. Backend
   module, client/contracts, and Vue composable agents may work in parallel only
   when their write scopes are disjoint and based on the same approved contract.
4. **Wave 3 - parallel consumers:** once a core contract is stable, Mushroom
   and Meat adapter agents implement against the same core API in parallel.
   They must not change core internals; missing hooks go back to the lead.
5. **Wave 4 - lead integration queue:** the lead merges accepted patches,
   resolves conflicts, updates changelogs/update logs, runs focused tests in
   dependency order, and updates nested submodule pointers.
6. **Wave 5 - broad validation:** validation/review agent runs or reviews broad
   suites after focused tests pass: core `npm test`, package export/type tests,
   Mushroom focused game tests/build/screenshots, Meat tests/build, then any
   full e2e pass requested by the changed surface.

Throughput rules:

- Keep every sub-agent unblocked with a read-only or disjoint-write task while
  the lead is waiting on a heavy command.
- Use temporary worktrees for concurrent draft implementation only when they
  reduce idle time and do not bypass the repo's final direct-to-main workflow.
- Run at most one heavyweight local command class at a time per repo: install,
  build, dev server, Playwright/e2e, screenshot suite, package pack, or
  image-generation batch. This is a throughput rule: duplicate heavy commands
  usually slow total delivery and create confusing evidence.
- Prefer many short focused validations over one early broad validation. The
  broad suite runs after the lead has integrated the slice.
- If two agents need the same file, one owns the edit and the other returns a
  patch suggestion or review note.
- Commit order stays serial: core commit and push first, then nested submodule
  pointer and adapter commit in Mushroom or Meat, then hub pointer commit.

#### Implementation Steps

1. Done for the planning pass: update `docs/game-core-runtime-contracts.md` and
   `docs/backpack-game-core-extraction-inventory.md` with the new domain-core
   split before moving code.
2. Done 2026-07-04: add `asset-gacha` as the first shared pure domain slice for
   asset acquisition policy, pack validation, roll candidate filtering,
   weighted roll selection, duplicate/burn target selection, pity helpers, and
   UI pack shaping.
3. Done 2026-07-04: land the Geesome-inspired package/module architecture
   slice. Core now exposes public `modules/gacha`, `modules/shop`,
   `modules/loadout`, `modules/battle`, `modules/fusion`, `client`, and
   `client-view-model` subpaths with declarations and consumer tests.
4. Done 2026-07-04: move `gacha-admin-validation` helpers into core:
   - release checklist evaluation and issue grouping,
   - fixture shape and duplicate-id validation over neutral rows,
   - planned asset promotion preflight checks,
   - plan-item generated asset-id, linked-character, and immutability rules,
   - runtime catalog visibility checks for hidden ready-plan assets versus
     approved player-visible pack assets.
5. Done 2026-07-04: wire Mushroom gacha admin service through thin adapters around those helpers
   while keeping DB transactions, audit logs, operator auth, file upload,
   storage, route payloads, and error wording stable in Mushroom.
6. Done 2026-07-04: add focused neutral core tests for the new helpers, then rerun Mushroom
   gacha admin API, runtime gacha simulation, and core-submodule tests.
7. Done 2026-07-04: move `gacha-simulation` helpers into core:
   deterministic pack odds simulation, trial/seed normalization, duplicate
   copy-cap handling, owned/missing/no-candidate warnings, and multi-slot
   guarantee/pity simulation over the shared roll core.
8. Done 2026-07-04: wire Mushroom admin preview and CLI/runtime pack odds
   simulation through the core helper while keeping DB/runtime catalog lookup
   and route/CLI payload policy local.
9. Done 2026-07-04: move `wallet-accounting` helpers into core: delta
   validation, balance math, purchase grant/reversal mutation shaping, purchase
   status classification, and settlement invariant checks.
10. Done 2026-07-04: wire Mushroom wallet and provider-settlement services
    through the core wallet helpers while keeping SQL, provider callbacks,
    support actions, mirrors, and reconciliation queries local.
11. Done 2026-07-04: move `profile-asset-state` helpers into core: profile
    asset instance/equipment row shaping, ownership maps, paid/free equipment
    validation, direct-purchase spend mutation shaping, acquisition-source
    selection, instance draft rows, and portrait variant projection.
12. Done 2026-07-04: wire Mushroom asset service through the core profile asset
    helpers while keeping runtime catalogs, SQL lifecycle, gacha roll/burn
    grants, support actions, paid rollback behavior, route payloads, and the
    active-portrait mirror local.
13. Then add follow-up core modules or submodules in small slices:
   - `asset-policy` cleanup if it needs a separate public API,
   - `frontend-services` for shared API clients/view-model shapers/composables,
   - `vue-backpack-ui` for grid, artifact tile, shop, and battle replay
     components,
   - `vue-asset-gacha-ui` for asset inventory, gacha pack, roll result, odds,
     and admin validation components.
14. Keep the package export strategy conservative:
   - use one package plus subpath exports until Vue extraction truly requires a
     package split,
   - keep existing backend/browser-safe JS exports stable,
   - add Vue as a peer dependency only when the first Vue module moves,
   - expose Vue modules through subpath exports such as
     `@microwavedev/backpack-game-core/vue` and
     `@microwavedev/backpack-game-core/vue/components`,
   - avoid a build step until SFC or style extraction truly requires it.
15. Port focused unit tests from Mushroom into `backpack-game-core` first,
   replacing Mushroom fixture data with neutral sample catalogs.
16. Refactor Mushroom backend services to call the core modules through thin
   adapters, keeping current route payloads and database tables stable.
17. Refactor Mushroom frontend one surface at a time by replacing local
   composables/components with core imports while preserving current UI flows
   and screenshots.
18. Integrate the same core frontend modules into Meat with product-specific
   data, copy, theme, and API adapters.
19. Verify Mushroom behavior after each slice with the smallest relevant test
   set, then run the wallet/gacha/admin bundle and affected screenshot/e2e
   coverage before moving the next slice.
20. Update `vendor/backpack-game-core/CHANGELOG.md`,
   `docs/backpack-game-core-update-log.md`, and the nested core pointer after
   each core commit.
21. Keep Meat pointed at the same core commit and add Meat tests/build coverage
   for every shared backend or Vue slice it consumes.

#### Validation

- `backpack-game-core`: `npm test` and `npm pack --dry-run`.
- When Vue modules move into core, add core-level component/composable tests
  with neutral fixtures before swapping either game to consume them.
- `mushroom-master`: `npm run game:core:check`, targeted wallet/asset/gacha
  tests, gacha admin API tests, gacha simulation tests, and `npm run game:build`.
- For any UI surface touched by adapter changes, run the relevant Mushroom
  Playwright screenshots/e2e flow from the repo instructions.
- `meat-master`: `npm test` and `npm run build` for every consumed core slice;
  add screenshot/e2e coverage once Meat has persistent routes/screens.

#### Rollback

- Keep each core domain slice independently revertible.
- If Mushroom integration fails, revert only the Mushroom adapter and nested
  submodule pointer to the last known-good core SHA while keeping the core
  commit for repair unless it contains secrets or generated junk.
- If frontend extraction fails, revert the consuming game's import swap and
  nested core pointer first. Keep the core Vue module commit for repair unless
  it contains bad generated artifacts, secrets, or product-specific assets.
- Do not mutate existing wallet, roll, ownership, or support-audit rows during
  extraction. Schema changes belong in a separate explicitly reviewed phase.

### Phase 11 - Add `meat-master` As A Second Core Consumer

Status: **Initial slice implemented 2026-07-04.** `meat-master` is now present
as a hub submodule, has its own nested `vendor/backpack-game-core` submodule,
and ships a Vite-based playable backpack battle prototype. This proves the
shared core can support a new game without copying Mushroom service logic, but
wallet, asset inventory, payment, and gacha runtime flows remain backlog for
that game.

#### Repository And Dependency Setup

1. Done: add `git@github.com:nuclear-pancakes/meat-master.git` to the hub at
   `meat-master` and update `SUBMODULES.md`, `submodules.manifest.json`,
   `.gitmodules`, and hub instructions.
2. Done: add `git@github.com:MicrowaveDev/backpack-game-core.git` as a nested
   `meat-master` submodule at `vendor/backpack-game-core`.
3. Done: consume the core through `file:vendor/backpack-game-core` with imports kept
   on `@microwavedev/backpack-game-core`.
4. Done for the initial slice: `npm test` imports the package through the local
   dependency and fails if the nested core is missing. Add a dedicated
   missing-core guard script later if Meat grows CI/deploy bootstrapping.

#### Playable Vertical Slice

1. Done: copy only the minimum starter data needed to make the loop playable:
   starter bag shapes, initial artifact definitions, grid constants, balance
   defaults, and a tiny static shop.
2. Done: copy a small set of Mushroom starter artifact PNGs as temporary
   starter assets. Add explicit provenance/replacement metadata before larger
   content seeding.
3. Done: create two adult female bikini/swimsuit characters with product-local ids,
   portraits, display names, starter presets, and combat/stat hooks. They must
   be clearly adult characters; avoid childlike proportions, school framing, or
   explicit sexual content.
4. Done for local prototype: character select, shop, bag placement, auto-pack,
   and battle resolve run in the first screen. Remaining: backend API, replay
   persistence, reward wallet grant, skin/asset inventory, and optional simple
   gacha roll.
5. Keep copy, art paths, content-rating labels, and any adult-content gate in
   `meat-master`, not in the shared core.
6. Done for initial slice: smoke tests prove `meat-master` imports the core,
   validates a starter bag/loadout, and resolves one deterministic battle.
   Remaining: backend smoke coverage for wallet grants and buy/roll cosmetic
   asset flows once those systems exist in Meat.

#### Asset Seeding Checklist

- Source Mushroom starter artifacts and bags from stable catalog data, not from
  ad hoc screenshots.
- Copy app-facing PNGs plus their metadata/provenance when available.
- Rename copied ids to avoid future cross-game collisions.
- Mark copied assets as `placeholder` or `starter_port` in Meat metadata until
  product-specific art review replaces them.
- Keep Mushroom lore, mushroom names, and Mycelium-specific copy out of
  `meat-master`.

#### Cross-Game Guardrails

- The core package should not import from either game.
- Both games must pass product fixtures into the same core APIs.
- Shared Vue modules must not import Mushroom or Meat stores, routers, auth,
  image paths, localization files, or CSS themes directly. They receive those
  through props, slots, composables, or adapter objects.
- No Mushroom-only behavior should be introduced to core just to make the port
  fast. If Meat needs a different rule, make it configurable through explicit
  adapters or keep it game-local.
- Adult/sexual-content payment and platform policy stays per game. The core can
  expose policy flags and acquisition rules, but it must not decide whether a
  provider accepts a game.

## Risks And Guardrails

- Avoid a big-bang rename plus extraction. First make the currency model clean
  inside `mushroom-master`; then extract mechanics.
- Keep compatibility aliases for one release where API payloads or old dev DBs
  might still use `coins`, `mycelium`, or `active_portrait`.
- Do not move Sequelize models into the core package. The core should not know
  which product owns persistence.
- Keep Mushroom ability logic product-specific through the battle hook adapter.
- Move reusable gacha and asset-acquisition rules into core, but keep product
  catalogs, database rows, routes, admin auth/storage, final page assembly, and
  support-audit persistence in the game repos.
- Move reusable Vue components, composables, browser services, and page
  view-models into core, but keep product route maps, auth shells, themes, art,
  copy, storage, and final page assembly in the game repos.
- Do not let "profile wallet coins" and "run shop coins" share one field or
  service method. They have different lifetimes, spend targets, and refund
  rules.
- Do not wire gacha to a product-specific route shape. Keep it as an asset
  acquisition service that Mushroom Battles and Meat can use or disable.
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
   wallet bundle/provider picker, rollable portrait UI, payment webhook event
   replay/audit, and paid-route rate-limit buckets.
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
   `cellSet`, `setsIntersect`, and `cellKey`; full validation followed in
   Phase 8F.**
15. Split pure fusion matching from Mushroom recipe catalog data.
   **Done 2026-07-01; Mushroom recipe data and eligibility policy remain
   local.**
16. Parameterize shop offer generation over passed item pools/config.
   **Done 2026-07-01; run-shop buy/refresh/sell mutations remain local.**
17. Phase 8D bot-loadout adapter extraction plan. **Done 2026-07-01.**
18. Implement bot loadout generation over catalog, affinity, preset, and price
   providers. **Done 2026-07-01; ghost snapshot and portrait glue remain
   local.**
19. Adapterize and extract battle simulation through Mushroom ability hooks.
   **Done 2026-07-02; combat identity, rewards, rating, and persistence remain
   local.**
20. Adapterize and extract full loadout validation through Mushroom catalog,
   pricing, family, grid, and stat hooks. **Done 2026-07-02; artifact data,
   balance constants, and service/API semantics remain local.**
21. Extract deterministic numeric RNG, integer roll, and seeded shuffle helpers
   while keeping Mushroom string seed hashing local. **Done 2026-07-02; secure
   gacha RNG and product seed strings remain local.**
22. Add TypeScript declarations and package export metadata for the root and
   subpath exports. **Done 2026-07-02; runtime remains ESM JavaScript.**
23. Add `backpack-game-core` as a nested submodule of the backpack game and
   switch the game dependency to a local submodule-backed package path.
   **Done.**
24. Add install/CI guardrails for the nested submodule: bootstrap docs,
   submodule-init requirement, lockfile verification, and a clear missing-core
   failure. **Done.**
25. Add a core-consumer smoke test plus final cross-repo verification
   (`backpack-game-core` tests, submodule guard, focused game tests, `npm ci`,
   game build, and full game unit suite). **Done for the core integration.**
26. Add release/update notes for the core pointer SHA used by each game commit.
   **Done 2026-07-02 via `docs/backpack-game-core-update-log.md` and core
   `CHANGELOG.md`.**
27. Add hub metadata for `backpack-game-core` only if it should also be tracked
   as a top-level hub repo in addition to the nested game submodule.
28. Integrate a second backpack-style game consumer after a real target exists.
   **Initial slice done 2026-07-04:** `meat-master` now consumes
   `backpack-game-core` as a nested submodule and has a playable local
   backpack battle prototype; see Phase 11.
29. Optional Phase 6D database rename only if raw legacy column names become a
   real extraction or analytics blocker.
30. G1 simple seasonal gacha pack. Keep it static-config, one-result,
   unowned-only, wallet-backed, rarity-aware, and screenshot/test covered before
   expanding the economy. **Done 2026-07-02 for the static Season 1
   portrait-pack lane.**
31. G2 static multi-item packs. Allow configured packs to open multiple
   unowned assets in one wallet spend with slot-level rarity tables, full
   roll-result evidence, UI feedback, screenshots, and simulator coverage.
   **Done 2026-07-02 for static-config packs; Mushroom's default live pack
   remains one-result unless config opts into `rollSize`/`slots`.**
32. Paid/ops backlog moved out of active lane: current processor due diligence,
   real provider validation, final terms/refund/support UI,
   adult-content/compliance gates, tax/accounting/data-retention review,
   dispute/freeze/late-payment runbooks, production scheduling, provider
   settlement imports, reconciliation/admin UI, stricter approval-policy UX,
   alert routing, periodic wallet drift monitoring, distributed mutation
   hardening, and live provider-status validation.
33. G4A duplicate inventory and simple burn exchange. **Done 2026-07-02:**
   duplicate-enabled packs can roll owned items as separate active instances,
   and configured burn rules can exchange spare duplicates for random eligible
   pack targets.
34. G4B duplicate copy caps and burn target policy. **Done 2026-07-03:**
   duplicate-enabled packs can cap active copies per asset, simulators accept
   current copy counts, and burn rules can allow, prefer, or require unowned
   targets.
35. Gacha roadmap backlog after G4B/G5D: season/collection-scoped pity, secret
   rarity policy, dust/shard and richer target-complete rewards,
   remaining database/admin-managed season tooling beyond the safety MVP,
   marketplace/trading, NFT-set policy decisions, and expanded
   disclosure/simulation work for duplicate-enabled paid packs.
36. G5A database-backed gacha pack runtime foundation. **Done 2026-07-03:**
   approved DB season/collection/pack/item rows can override or extend static
   packs at runtime, draft packs stay hidden, and rolls/odds/bootstrap can use
   DB-authored pack prices, dates, rarity tables, and item pools.
37. G5B proper gacha admin backend API. **Done 2026-07-03:** `/api/admin/gacha/*`
   is token-gated, role-gated with `gacha_operator` / `admin`, supports season,
   collection, pack, and pack-item CRUD, validates draft packs, handles
   review/publish/disable transitions, clones approved packs into draft
   revisions for edits, and records audited before/after operator actions.
38. G5C gacha admin panel UI MVP. **Done 2026-07-04:** `/support-admin` has a
   Gacha tab with token-gated catalog loading, season/collection/pack forms,
   asset-picker-backed pack item rows, advanced JSON rule fields, validation,
   publish/expire/disable controls, desktop/mobile screenshots, and UI/e2e
   coverage.
39. G5D gacha preview and safety tooling. **Done 2026-07-04:** admin preview
   endpoint and `/support-admin` panels expose release checklist, odds preview,
   roll simulation, asset policy mapping recommendations, and live/draft diff.
   Publish/approve is blocked when validation or required release checklist
   blockers fail, while non-destructive disable/expire remains available for
   emergency rollback.
40. G5E gacha admin hardening backlog. **Started 2026-07-04:** versioned JSON
   fixture export/import now covers DB seasons, collections, packs, and nested
   items with dry-run, audited apply, approved-pack preservation guardrails, and
   validation/release-checklist gates. This slice also adds a simple
   season-plan main tab for uploaded images, character assignment,
   rarity/chance-weight edits, per-character content coverage, and audited plan
   item create/update/delete actions. **Updated 2026-07-04:** ready plan images
   can be promoted into DB pack items and resolved by runtime odds, rolls,
   bootstrap catalog projection, portrait equipment, and support asset
   operations. **Updated 2026-07-04:** public/player runtime catalogs now hide
   ready plan assets until they are linked through approved player-visible DB
   packs; admin validation and authoring can still use the full ready-plan
   catalog. **Updated 2026-07-04:** `simulateRuntimeAssetPackOdds` and
   `npm run game:gacha:simulate -- --runtime --pack=<packId>` cover approved
   DB-backed packs and promoted plan assets. **Updated 2026-07-04:** plan item
   direct asset-id edits are rejected after creation; unlinked generated ids
   sync on character changes, and linked plan assets cannot change character.
   Remaining: bulk CSV/item editing, migration and rollback scripts for live
   corrections, scheduled activation/expiry alerts, richer disclosure review by
   jurisdiction/provider, staff permission tiers, and marketplace/NFT-set
   operations before non-engineering operators manage paid seasons unaided.
41. Phase 8I multi-game domain-core extraction. **Started 2026-07-04 with the
   `asset-gacha` core slice:** direct-buy policy, gacha validation, roll
   selection, duplicate/burn, pity/guarantee, and simulation-facing pack
   shaping now have a reusable core landing zone behind adapters. **Adjusted
   after post-implementation review:** the next real backend extraction is
   gacha admin validation/release-checklist logic, followed by gacha
   simulation, then wallet accounting. Wallet accounting is now implemented in
   core commit `af520f0`, and profile-asset-state is now implemented in core
   commit `6ae688b`.
   Keep DB schemas, payments, Telegram, product catalogs, art, compliance,
   admin auth/storage, product route shells, and final page assembly in each
   game.
42. Phase 11 `meat-master` consumer. **Initial slice done 2026-07-04:** added
   `git@github.com:nuclear-pancakes/meat-master.git` as the second game target,
   consumed `backpack-game-core` as a nested submodule, seeded a playable Vite
   vertical slice from starter bags/artifacts, created two clearly adult
   swimsuit female characters, and verified core import, loadout validation,
   and deterministic battle smoke flows. Remaining: backend persistence,
   wallet reward grants, asset inventory/equipment, payment policy, and optional
   simple gacha buy/roll flows for Meat.
43. Phase 8J full-stack shared UI extraction. **Started 2026-07-04:** shared
   `client-view-model` helpers now project flat loadout rows into grid props
   from core and are consumed by Mushroom and Meat. Continue extracting reusable
   services/composables first, then neutral Vue components, then optional page
   shells for flows shared by Mushroom and Meat. Candidate flows: bootstrap,
   shop/backpack prep, battle replay, asset inventory/equipment, gacha pack
   browsing/rolling, odds preview, and admin season-plan validation. Keep game
   route shells, auth, localization, adult-content policy, images, and themes
   local. Add core-level component/composable tests plus Mushroom screenshot/e2e
   coverage and Meat build/test coverage for each adopted slice.
44. Phase 8K Geesome-inspired package/module split. **Implemented first slice
   2026-07-04:** core now exposes public `modules/gacha`, `modules/shop`,
   `modules/loadout`, `modules/battle`, `modules/fusion`, `client`, and
   `client-view-model` exports with `.d.ts` coverage and consumer tests.
   Continue using Geesome's module and UI-service shape as the precedent for
   deeper backend modules and future Vue components.
45. Phase 8L sub-agent execution setup. **Used 2026-07-04 for the first
   architecture slice.** Before implementing later Phase 8K/8J slices,
   split work into bounded sub-agent briefs: architecture audit, core backend
   module, client/contracts, Vue shared UI, Mushroom adapter, Meat adapter, and
   validation/review. Optimize for maximum throughput with parallel discovery,
   contract-first core work, parallel consumer adapters, a lead-owned
   integration queue, and serial commit/pointer updates. Treat local machine
   resource limits as scheduling constraints, not as the goal.
46. Phase 8M first real module movement after facades. **Implemented
   2026-07-04:** core commit `8345448` added
   `modules/gacha/admin-validation` for release checklist helpers, fixture
   shape checks, plan-item asset-id/character-link invariants, season-plan
   catalog projection, promotion metadata, and plan coverage summaries.
   Mushroom now calls it through DB-aware wrappers and keeps transactions,
   audit logs, uploads, permissions, route payloads, and error handling local.
47. Phase 8N gacha simulation model extraction. **Implemented 2026-07-04:**
   core commit `b3da379` added `modules/gacha/simulation` for deterministic
   pack odds simulation over injected pack/catalog/ownership/copy/pity state.
   Mushroom admin preview and CLI/runtime odds simulation now delegate through
   adapters.
48. Phase 8O wallet accounting extraction. **Implemented 2026-07-04:** core
   commit `af520f0` added `wallet-accounting`, `modules/wallet`, and
   `modules/wallet/accounting` for profile-wallet delta validation, balance
   math, purchase grant/reversal mutation shaping, purchase status
   classification, and settlement invariants. Mushroom wallet and
   provider-settlement services now delegate through adapters while keeping DB
   rows, provider callbacks, support actions, mirrors, and reconciliation
   queries local.
49. Phase 8P profile asset-state extraction. **Implemented 2026-07-04:** core
   commit `6ae688b` added `profile-asset-state`, `modules/assets`, and
   `modules/assets/profile-state` for profile asset instance/equipment row
   shaping, ownership maps, paid/free equipment validation, direct-purchase
   spend mutation shaping, acquisition-source selection, instance draft rows,
   and portrait variant projection. Mushroom asset service now delegates
   through those helpers while keeping runtime catalogs, SQL lifecycle, gacha
   roll/burn grants, support actions, paid rollback behavior, route payloads,
   and the active-portrait mirror local.
50. Phase 8Q asset catalog acquisition-policy cleanup. **Implemented
   2026-07-04:** core commit `77b1d7b` added
   `resolveAssetCatalogAcquisitionPolicy` through `asset-gacha` /
   `modules/gacha` for paid/free default acquisition modes, per-asset
   overrides, explicit `packId: null`, and default pack assignment. Mushroom
   asset catalog construction delegates to this helper while env parsing,
   `PORTRAIT_PACK_ID`, portrait URLs, runtime pack lookup, direct-buy/roll
   execution, SQL lifecycle, support actions, and product route payloads stay
   local. Next candidates are client/contracts and frontend-services; full Vue
   page/component movement remains later.
51. Phase 8R asset/gacha client view-model helper extraction. **Implemented
   2026-07-04:** core commit `578279d` added `client-view-model` helpers for
   asset pack rarity odds, guarantee/pity/duplicate text, active/availability
   labels, and roll-pack summaries. Mushroom's home skin picker now delegates
   pack summary shaping to core while keeping product copy, selected character
   state, bootstrap payloads, route actions, and UI composition local. Meat
   consumes the same helper through a contract smoke test. Next frontend
   candidates are wallet/asset DTO shapers and headless services/composables;
   full Vue page/component movement remains later.
52. Phase 8S wallet and roll-feedback view-model helper extraction.
   **Implemented 2026-07-04:** core commit `cf7c680` added
   `client-view-model` helpers for wallet purchase surface shaping and asset
   roll feedback assembly. Mushroom's home wallet and pack feedback UI now
   delegate the neutral shaping to core while keeping product copy,
   Telegram/web surface detection, emitted route actions, runtime state, and
   UI composition local. Meat consumes the same helpers through a contract
   smoke test. Next frontend candidate from the sub-agent audit is grid-cell
   classification, followed by artifact stat DTO helpers.
53. Phase 8T grid-cell classification view-model helper extraction.
   **Implemented 2026-07-04:** core commit `f403553` added
   `client-view-model` helpers for slot-first bag row lookup, grid cell role
   classification, and occupied footprint keys. Mushroom's artifact grid board
   and the grid classification tests now consume the shared helpers while
   keeping visual classes, overlays, drag/drop events, layout constants, and
   final board composition local. Meat consumes the same helpers through a
   contract smoke test. Next frontend candidate from the sub-agent audit is
   artifact stat DTO helpers.
54. Phase 8U artifact stat view-model helper extraction. **Implemented
   2026-07-04:** core commit `41a3ad5` added `client-view-model` helpers for
   stat total summing, signed delta formatting, bonus-entry DTO shaping, and
   loadout stat text composition over product-provided labels, stat order, and
   suffixes. Mushroom delegates `deriveTotals`, artifact bonus labels, loadout
   stat text, and stat chips while keeping product stat labels, visual role
   classes, copy, and UI composition local. Meat consumes the same helpers
   through its `formatBonus` wrapper and contract smoke test. Next frontend
   candidates remain response/status DTO shapers and headless services before
   moving neutral Vue components.
55. Phase 8V artifact grid utility view-model helper extraction.
   **Implemented 2026-07-04:** core commit `725ffab` added
   `client-view-model` helpers for occupied-cell value maps and preferred
   artifact preview orientation for rectangular and shape-bearing artifacts.
   Mushroom delegates `buildOccupancy` and `preferredOrientation` while
   keeping placement state, visual preview composition, drag/drop actions,
   product rendering, and gameplay mutation logic local. Meat consumes the
   preferred-orientation helper for shop metadata while leaving placement
   ordering unchanged.
56. Phase 8W canonical artifact preview-orientation cleanup. **Implemented
   2026-07-04:** core commit `786d41c` added `artifactPreviewOrientation` so
   preview-only surfaces can keep non-bag bitmap dimensions canonical while
   shaped and legacy bags still use derived preview footprints. Mushroom's shop
   zone, backpack zone, home social sidebar, catalog browser, and fusion
   animation lab delegate preview orientation through this helper. Placement
   flows still use the placement-preferred orientation helper.
57. Phase 8X wallet and asset-roll status normalization. **Implemented
   2026-07-04:** core commit `f387670` added `client-view-model` helpers for
   wallet purchase-intent status, Telegram invoice callback status, and
   asset-roll error status mapping. Mushroom customization checkout and
   roll/burn flows now delegate these mappings through core while keeping API
   routes, Telegram/web checkout opening, localization, runtime state, and
   final UI composition local. Meat consumes the helpers through its core
   contract smoke test. Next frontend candidates remain asset
   inventory/equipment response shapers and headless services/composables
   before neutral Vue components move.
58. Phase 8Y asset gacha result DTO shaper extraction. **Implemented
   2026-07-04:** core commit `9b7b505` added `modules/gacha` helpers for
   persisted asset roll rows, duplicate-burn exchange rows, and replay-safe
   roll/burn result DTO payloads. Mushroom's asset service now delegates
   `rollResult` and `burnResult` shaping through core while keeping DB
   transactions, wallet mutation, secure RNG, idempotency claims, asset grants,
   runtime catalog lookup, and HTTP route behavior local. Meat consumes the
   helpers through a core contract smoke test. Next domain candidates are
   headless gacha/wallet service adapters, replay/admin view models, and
   neutral UI primitives; the run-shop/game-run response patch helper slices
   are fulfilled by Phases 8AJ-8AK.
59. Phase 8Z profile asset target-variant response shaping. **Implemented
   2026-07-04:** core commit `0f8beee` added `modules/assets` helpers for
   target-variant list projection over injected variants, catalog snapshots,
   profile asset state, active ids, asset-id adapters, and product policy
   adapters. Mushroom uses it for progression portrait lists while keeping
   portrait asset id convention, runtime catalog construction, gacha-plan
   policy, active/equipment resolution, product routes, and HTTP payload
   ownership local. Meat consumes the helper through a core contract smoke
   test. Next candidates are headless gacha/wallet service adapters,
   replay/admin view models, and neutral Vue composables/components only after
   the service contracts stabilize; the run-shop/game-run response patch helper
   slices are fulfilled by Phases 8AJ-8AK.
60. Phase 8AA wallet and asset-roll mutation view-state helper extraction.
   **Implemented 2026-07-04:** core commit `fc53abc` added
   `client-view-model` helpers for headless wallet purchase and asset
   roll/burn opening, success, failure, checkout-unavailable, refresh, and
   global-error state decisions. Mushroom's customization composable now uses
   those reducers while keeping API route calls, idempotency-key generation,
   Telegram invoice opening, web checkout opening, invoice callbacks, bootstrap
   refresh, runtime state ownership, and product copy local. Meat consumes the
   helpers through a core contract smoke test. Next candidates are route-client
   adapter adoption for these flows, replay/admin view models, and neutral Vue
   composables/components only after route contracts are stable; the
   run-shop/game-run response patch helper slices are fulfilled by Phases
   8AJ-8AK.
61. Phase 8AB route-client response-envelope and customization adoption.
   **Implemented 2026-07-04:** core commit `b56ad91` added optional
   `{ success, data, error }` envelope unwrapping to `client`, including
   structured errors for `success: false`. Mushroom now exposes a local
   customization route map and uses the core route-adapter client for portrait
   switching, preset switching, direct portrait purchase, wallet bundle
   loading, wallet purchase intents, pack rolls, and duplicate burns. Route
   names, session header policy, idempotency-key generation, Telegram invoice
   opening, web checkout opening, invoice callbacks, bootstrap refresh, runtime
   state ownership, and product copy stay local. Meat consumes the envelope
   option through a core contract smoke test. Next candidates are additional
   route-client adoption for bootstrap/social/game-run flows, headless
   services/composables, and neutral Vue components only after route contracts
   stabilize.
62. Phase 8AC social/wiki route-client adoption.
   **Implemented 2026-07-04:** Mushroom added social and wiki-detail route
   names to its local route map and moved add-friend, challenge create/load,
   challenge accept/decline, and wiki-entry loading through the shared core
   route-adapter client. This is a consumer-only adoption over core commit
   `b56ad91`; core did not need another change. Route ownership, session header
   policy, navigation effects, replay autoplay, runtime state ownership, and
   product copy stay local. Next candidates are bootstrap/game-run route-client
   adoption, headless services/composables, and neutral Vue components only
   after route contracts stabilize.
63. Phase 8AD auth/bootstrap route-client adoption.
   **Implemented 2026-07-04:** Mushroom added app-config, catalog,
   bootstrap, leaderboard, wiki-home, settings, Telegram code start, browser
   auth, dev session, logout, and active-character route names to its local
   route map and moved the corresponding `useAuth` calls through the shared
   core route-adapter client. Telegram auth-code verification stays raw because
   it returns the special bot-auth polling shape. Bootstrap state projection,
   cache ownership, navigation effects, runtime state ownership, and product
   copy stay local. Next candidates are game-run route-client adoption,
   headless services/composables, and neutral Vue components only after route
   contracts stabilize.
64. Phase 8AE game-run route-client adoption.
   **Implemented 2026-07-04:** Mushroom added game-run start/readiness/read,
   abandon, refresh-shop, buy, sell, and artifact-loadout route names to its
   local route map and moved the corresponding `useGameRun` transport calls
   through the shared core route-adapter client. This closes the active
   route-client lane enough for the current extraction phase. Run state
   projection, placement payload shaping, replay loading, haptics, runtime state
   ownership, and product copy stay local. Next candidates are headless
   services/composables and replay/admin view models before neutral Vue
   components move; the run-shop/game-run response patch helper slices are
   fulfilled by Phases 8AJ-8AK.
65. Phase 8AF replay/dev route-client cleanup.
   **Implemented 2026-07-04:** Mushroom replay settings persistence, battle
   replay loading, local lab narration, and dev inventory-review routes now use
   the shared core route-adapter client through local route names. The unused
   `apiJson` helper was removed from live frontend code. Replay timers/state,
   dev fixtures, runtime state ownership, and product copy stay local. Next
   candidates are headless services/composables and replay/admin view models
   before neutral Vue components move; the run-shop/game-run response patch
   helper slices are fulfilled by Phases 8AJ-8AK.
66. Phase 8AG post-route-client core-move review.
   **Plan adjusted 2026-07-04:** the active route-client lane is complete for
   live Mushroom frontend code. The next core moves should be, in order:
   asset inventory/equipment DTO shapers (fulfilled by Phase 8AH); headless
   wallet/gacha state services (started by Phase 8AI); replay playback state
   and gacha/admin view models (fulfilled by Phases 8AL-8AQ); then the
   planner-level service boundaries listed in Phases 8AR-8AW. The
   run-shop/game-run response patch helper slices are fulfilled by Phases
   8AJ-8AK, and replay playback state is fulfilled by Phase 8AL. Do not
   move whole Mushroom services, pages, Express routes, DB schemas, payment
   providers, route maps, catalogs, artwork, support operations, haptics, or
   secure paid-roll RNG selection into core.
67. Phase 8AH profile asset result DTO shaper extraction.
   **Implemented 2026-07-04:** core commit `458d4bb` added `modules/assets`
   helpers for asset records, owned-instance summaries, equipped-target
   summaries, purchase results, equip results, and grant summaries. Mushroom's
   asset service now delegates direct-buy/equip response shaping and roll/burn
   grant instance summaries, including idempotent replay summaries when rows
   still exist, while keeping runtime catalogs, SQL mutations, wallet spends,
   secure RNG, mutation claims, support actions, and route payload ownership
   local. Headless wallet/gacha state services are started by Phase 8AI,
   gacha/admin view models are covered by Phases 8AM-8AQ, and the remaining
   service moves are now the planner-level boundaries in Phases 8AR-8AW; the
   run-shop/game-run response patch helper slices are fulfilled by Phases
   8AJ-8AK, and replay playback state is fulfilled by Phase 8AL.
68. Phase 8AI headless wallet/gacha state helper extraction.
   **Implemented 2026-07-04:** core commit `5ee7ee8` added
   `client-view-model` helpers for wallet bundle loading state, wallet
   checkout next-action decisions, and roll/burn mutation refresh decisions.
   Mushroom's customization composable now delegates those state decisions
   through core while keeping API calls, route names, idempotency-key
   generation, Telegram invoice opening, web checkout opening, bootstrap
   refresh callbacks, runtime state ownership, and product copy local. Updated
   2026-07-05: backend planner candidates are fulfilled by Phases 8AR-8AU;
   gacha/admin view models are covered by Phases 8AM-8AQ, replay playback
   state is fulfilled by Phase 8AL, the broader game-run response patch helper
   slice is fulfilled by Phase 8AK, and the next active shared-core candidate
   is the remaining Phase 8AV frontend primitive backlog.
69. Phase 8AJ run-shop response patch helper extraction.
   **Implemented 2026-07-04:** core commit `f4734ea` added
   `client-view-model` helpers for refresh-shop, buy, and sell response state
   projection. Mushroom's game-run composable now delegates those state
   patches through core while keeping API calls, price guards, row-id sell
   payload construction, placement payload construction, haptics, replay
   loading, runtime state ownership, route names, and product copy local.
   Updated 2026-07-05: planner-level extraction phases 8AR-8AU are fulfilled;
   gacha/admin view models are covered by Phases 8AM-8AQ, replay playback
   state is fulfilled by Phase 8AL, start/ready/round-transition/completion
   response patch helpers are fulfilled by Phase 8AK, and the next active
   shared-core candidate is the remaining Phase 8AV frontend primitive backlog.
70. Phase 8AK game-run response patch helper extraction.
   **Implemented 2026-07-04:** core commit `2092663` added
   `client-view-model` helpers for game-run start, ready, round-transition,
   and completion response state projection. Mushroom's game-run composable now
   delegates those state patches through core while keeping routes, loadout
   projection, bootstrap updates, replay loading, navigation, haptics, runtime
   state ownership, and product copy local. Updated 2026-07-05:
   planner-level extraction phases 8AR-8AU are fulfilled; gacha/admin view
   models are covered by Phases 8AM-8AQ, replay playback state is fulfilled by
   Phase 8AL, and the next active shared-core candidate is the remaining Phase
   8AV frontend primitive backlog.
71. Phase 8AL replay playback state helper extraction.
   **Implemented 2026-07-04:** core commit `ee2a275` added
   `client-view-model` helpers for replay speed selection, long-battle boost,
   autoplay delay, tick advancement, load/set-speed state patches, and replay
   timeline shaping. Mushroom's replay composable now delegates those state
   decisions through core while keeping timers, API routes, settings
   persistence, event formatting/localization, navigation, Vue computed
   wrappers, runtime state ownership, and UI local. Gacha admin draft-diff DTO
   helpers are fulfilled by Phase 8AM. Updated 2026-07-05: planner-level
   extraction phases 8AR-8AU are fulfilled; the next active shared-core
   candidate is the remaining neutral frontend primitive backlog in Phase 8AV.
72. Phase 8AM gacha admin draft-diff helper extraction.
   **Implemented 2026-07-04:** core commit `c850a14` added
   `modules/gacha/admin-validation` helpers for pack snapshots and live/draft
   diff DTOs, plus `client-view-model` diff table-row shaping for admin
   panels. Mushroom's gacha admin preview now delegates the pure diff to core
   and the support admin page delegates the row projection while keeping DB
   reads, token/role checks, audit logs, upload/storage, product copy, page
   layout, and admin routes local. Checklist/plan row helpers are fulfilled by
   Phase 8AN, fixture operation summaries are fulfilled by Phase 8AO, odds row
   shapers are fulfilled by Phase 8AP, and preview row helpers are fulfilled
   by Phase 8AQ. Updated 2026-07-05: planner-level extraction phases 8AR-8AU
   are fulfilled; the next active shared-core candidate is the remaining Phase
   8AV frontend primitive backlog.
73. Phase 8AN gacha admin checklist and season-plan row helper extraction.
   **Implemented 2026-07-04:** core commit `7deb088` added
   `client-view-model` helpers for validation issue rows, release checklist
   rows, season-plan total weight, coverage rows, and chance text. Mushroom's
   support admin page now delegates those computed DTOs through core while
   keeping credential storage, API calls, upload/data-url handling, product
   copy, JSON textarea parsing, Vue form mutation, page layout, and admin
   routes local. Fixture operation summaries are fulfilled by Phase 8AO, odds
   row shapers are fulfilled by Phase 8AP, and preview row helpers are
   fulfilled by Phase 8AQ. Updated 2026-07-05: planner-level extraction
   phases 8AR-8AU are fulfilled; the next active shared-core candidate is the
   remaining Phase 8AV frontend primitive backlog.
74. Phase 8AO gacha admin fixture operation summary helper extraction.
   **Implemented 2026-07-04:** core commit `497e6f7` added
   `modules/gacha/admin-validation` helper
   `summarizeGachaAdminFixtureOperations`. Mushroom's fixture import now
   delegates dry-run/applied operation summary counts through core while
   keeping DB transactions, fixture upserts, token/role checks, audit logs,
   route payloads, validation of incoming fields, and product errors local.
   Odds row shapers are fulfilled by Phase 8AP and preview row helpers are
   fulfilled by Phase 8AQ. Updated 2026-07-05: planner-level extraction
   phases 8AR-8AU are fulfilled; the next active shared-core candidate is the
   remaining Phase 8AV frontend primitive backlog.
75. Phase 8AP gacha admin odds preview row helper extraction.
   **Implemented 2026-07-04:** core commit `c5ebe41` added
   `client-view-model` helpers for rarity and item odds preview table rows,
   expected-percent text, weight fallback text, copy-cap fallback text, and row
   limiting. Mushroom's support admin odds preview now delegates those rows
   through core while keeping preview loading, API calls, simulation services,
   product copy, and page layout local. Updated 2026-07-05: planner-level
   extraction phases 8AR-8AU are fulfilled; the next active shared-core
   candidate is the remaining Phase 8AV frontend primitive backlog.
76. Phase 8AQ gacha admin fixture/simulation preview row helper extraction.
   **Implemented 2026-07-04:** core commit `c9d8492` added
   `client-view-model` helpers for fixture operation rows and simulation item
   rows, including row limiting, item-count fallback text, observed-per-roll
   percent text, and drop-weight fallback text. Mushroom's support admin now
   delegates those preview rows through core while keeping fixture
   import/export calls, simulation services, product copy, and page layout
   local. Updated 2026-07-05: planner-level extraction phases 8AR-8AU are
   fulfilled; the next active shared-core candidate is the remaining Phase 8AV
   frontend primitive backlog.
77. Phase 8AR asset-gacha roll settlement planner extraction.
   **Implemented 2026-07-05:** core commit `624d4b0` added
   `createAssetGachaRollSettlementPlan`,
   `createAssetGachaRollGrantDrafts`, and
   `shapeAssetGachaRollSettlementItems` through `modules/gacha`. The planner
   now owns candidate-pool hash DTOs, duplicate-result summaries,
   guarantee/pity payloads, wallet-spend metadata, grant draft metadata, roll
   evidence items, and result item DTOs over injected pack/candidate/selection
   snapshots. Mushroom still owns secure RNG selection, feature flags, runtime
   pack/catalog lookup, idempotency queries, mutation locks, SQL transactions,
   wallet debit execution, `asset_rolls` inserts, rollback behavior, HTTP
   errors, and audit/log metadata.
78. Phase 8AS duplicate-burn settlement planner extraction.
   **Implemented 2026-07-05:** core commit `624d4b0` added
   `selectAssetGachaBurnSourceRows`,
   `createAssetGachaBurnSettlementPlan`,
   `createAssetGachaBurnSourceMetadata`,
   `createAssetGachaBurnGrantDrafts`, and
   `shapeAssetGachaBurnSettlementItems` through `modules/gacha`. The planner
   now owns deterministic burn-source ordering over injected active
   rows/equipped ids, source burn metadata, target grant draft metadata,
   duplicate-result summaries, exchange evidence metadata, and burn-result item
   DTOs. Mushroom still owns burn-rule route selection, active/equipped row
   queries, SQL status updates, exchange inserts, mutation locks,
   idempotency replay, secure RNG source, HTTP errors, and product audit
   records.
79. Phase 8AT wallet purchase intent/status planner extraction.
   **Implemented 2026-07-05:** core commit `624d4b0` added
   `createWalletPurchaseIntentDraft`, `shapeWalletPurchaseCheckout`,
   `createWalletPurchaseCheckoutMetadataPatch`,
   `walletPurchaseCheckoutIsResolved`, and
   `createWalletPurchaseCompletionPlan` through `modules/wallet`. Combined
   with the earlier wallet-accounting status/reversal helpers, core now owns
   provider-neutral intent draft shaping, checkout DTO/metadata patch shaping,
   completed-intent grant planning, status classification, clawback/reversal
   mutation shaping, and provider amount/currency comparison contracts.
   Mushroom still owns Telegram Stars, BTCPay, NOWPayments, webhook
   verification, invoice polling, adult-content/provider policy, locks, SQL
   rows, support runbooks, refunds/reversals execution, and payment operations
   monitoring.
80. Phase 8AU run/shop lifecycle state planner extraction.
   **Implemented 2026-07-05:** core commits `624d4b0` and `bf863f3` added
   `createRunShopPurchasePlan`, `createRunShopRefreshPlan`, and
   `createRunShopSellPlan` through `modules/shop`, plus
   `createRunStartPlan`, `createRunStarterLoadoutDrafts`,
   `createRunInitialShopStatePlan`, `createRunRoundShopStatePlan`,
   `createRunGhostBudgetPlan`, `createRunRoundResolutionPlan`, and
   `createRunGroupCompletionPlan` through `modules/run`. Mushroom now
   delegates buy/refresh/sell run-currency and offer-state decisions, run
   start draft state, starter loadout draft state, initial/next shop state,
   ghost budget math, round-transition reward/counter/end-state decisions, and
   challenge group-completion decisions to core while keeping run locks, DB
   mutations, loadout rows, HTTP errors, refunds, and product catalog lookup
   local.
   Mushroom must still own player/mushroom selection, daily limits, rewards,
   rating, season/achievement grants, challenge matching, DB persistence,
   ghost selection, product catalog data, and HTTP route errors.
81. Phase 8AV neutral frontend backpack UI primitives.
   **First slices implemented 2026-07-05:** core commit `2280929` added
   `shapeArtifactStatRows` to `client-view-model`, and core commit `ffaa376`
   added `shapeShopItemRows`; core commit `3c638fb` added
   `shapeGridBoardCells`, `shapeGridBoardPieces`, and
   `shapeGridBagSlotCells`; core commit `a4c4c06` added
   `shapeReplayEventRows`; core commit `42b1f1c` added
   `shapeArtifactTileDisplay` and artifact footprint helpers; core commit
   `be41855` added `shapeAssetPackCardRows`; core commits `ebc74d2` and
   `6d9faeb` added `shapeGachaAdminOddsTableSections`,
   `shapeAssetRollResultPanel`, and the empty-feedback guard.
   Mushroom's
   `ArtifactStatSummary` delegates stat-row/chip DTO shaping through core while
   keeping role colors, glyph markup, labels, classes, and component rendering
   local. Mushroom's prep shop
   delegates offer lookup, pricing, affordability, preview footprint,
   bag/character flags, and stat rows through core while keeping localized
   copy, role/shine classes, fusion hints, click actions, and markup local.
   Mushroom's artifact grid board delegates board cell flags and placed-piece
   rows while keeping visual classes, bag overlays, drag/drop events, figure
   rendering, layout constants, and CSS local. Meat uses the same helpers for
   compact bonus text, prototype shop buttons, and backpack bag-slot/piece
   rows. Mushroom's replay timeline delegates visible event row ordering and
   active-row flags through core while keeping event formatting and replay screen
   markup local; Meat uses the same helper for compact battle-log filtering and
   limiting. Mushroom's artifact figures delegate tile dimensions, mask cells,
   image style hints, and role glyph labels through core while keeping artwork
   generation, role colors, CSS, and visual taxonomy local; Meat uses the same
   helper for prototype artifact image metadata. Mushroom's home pack cards
   delegate detail/status lines and roll/burn action DTOs through core while
   keeping markup, styling, localization, route events, and page composition
   local; Meat uses the same helper for prototype pack-card metadata. Mushroom's
   support admin odds preview delegates table sections through core, and home
   roll feedback delegates panel metadata through core while keeping copy,
   markup, styling, and route events local; Meat uses the same helpers in
   prototype wrappers. Phase 8AV DTO backlog is complete; the next frontend
   work should be neutral Vue components built on these DTO contracts, not
   whole Mushroom screens moved as-is. Keep Mushroom/Meat themes, localized
   copy, routes, image resolvers, haptics, Telegram wrappers, and page shells
   local. Future slices need screenshot/e2e evidence in Mushroom and build/test
   evidence in Meat for every adopted component.
82. Phase 8AW neutral Vue component layer.
   **Planned next, not started:** add a public Vue-facing layer in
   `backpack-game-core`, likely behind subpath exports such as
   `@microwavedev/backpack-game-core/vue` and
   `@microwavedev/backpack-game-core/vue/components`. Do not copy Mushroom
   pages or components into core verbatim. Extract neutral primitives that
   receive already-shaped DTOs plus product-provided labels, image resolvers,
   route callbacks, theme class hooks, and optional slots.
   First component candidates, in safest order:
   - `AssetRollResultPanel`, backed by `shapeAssetRollResultPanel`.
   - `GachaOddsTable`, backed by `shapeGachaAdminOddsTableSections`.
   - `GachaPackCardList` / `GachaPackCard`, backed by
     `shapeAssetPackCardRows`.
   - `ArtifactTile`, backed by `shapeArtifactTileDisplay`.
   - `ShopItemList` / `ShopItemRow`, backed by `shapeShopItemRows`.
   - `BackpackGrid`, backed by `shapeGridBoardCells`,
     `shapeGridBoardPieces`, and `shapeGridBagSlotCells`.
   - `BattleLog` / compact replay rows, backed by `shapeReplayEventRows`.
   Component extraction rules:
   - components emit neutral events such as `roll`, `burn`, `select`, `buy`,
     `place`, `remove`, and `open`, never product route names;
   - components use props/events/slots/adapters instead of importing Mushroom
     stores, APIs, routes, Telegram helpers, generated art, CSS themes, or
     catalogs;
   - core may ship minimal base classes or CSS variables, but Mushroom and Meat
     keep their final themes, responsive page layout, art paths, and copy;
   - each component slice must include core unit/render tests, Mushroom
     adoption evidence including screenshots where visual, and Meat build/test
     evidence.
   Pre-flight before the first component:
   - create a short frontend-core contract reference that documents Vue peer
     dependency/version support, public subpath exports, browser-safe import
     rules, CSS variable/base-class policy, event names, slot names, adapter
     props, and DTO compatibility expectations;
   - add or extend package export/type tests so every Vue subpath has a JS
     target and declaration target;
   - add a static forbidden-import check for core client/Vue exports;
   - decide whether render tests use Vue Test Utils, Vitest, or the existing
     Node test runner plus compiled render snapshots, then keep that choice
     consistent for the first component batch.
   First implementation slice should be intentionally small:
   - extract `AssetRollResultPanel` or `GachaOddsTable` first because those
     components are low-interaction, already DTO-backed, and useful in both
     Mushroom and Meat;
   - adopt it in Mushroom without changing product copy or layout semantics;
   - adopt it in Meat as a proof that the component is not accidentally
     Mushroom-themed;
   - only move toward `BackpackGrid` after the simpler components prove the
     prop/event/theme pattern.
83. Phase 8AX explicit non-core guardrails.
   **Current boundary:** do not move whole Mushroom services, Express routes,
   database migrations/schemas, provider SDK calls, webhook signature checks,
   Telegram integration, support/admin permissions, image upload/storage,
   adult-content compliance gates, settlement runbooks, art assets, lore copy,
   player/mushroom catalogs, CSS themes, or product page composition into
   `backpack-game-core`. Core APIs should receive plain snapshots and return
   plans/DTOs that product repos execute.
84. Phase 8AY cross-consumer release hardening.
   **Planned next, not started:** after the first shared Vue component lands,
   add a single verification path that proves the same core commit works in
   core, Mushroom, and Meat. The minimum gate should run core tests/package
   export checks, Mushroom game/core checks plus any affected screenshot/e2e
   tests, and Meat build/tests. Also record the expected pointer-update order:
   commit/push core first, update Mushroom and Meat nested submodule pointers
   second, then update the hub pointer only after both consumers are clean.
