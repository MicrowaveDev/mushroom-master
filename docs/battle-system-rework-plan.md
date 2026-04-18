# Battle System Rework Plan

## Source of truth

### Original request

Rework the battle system so:

- rounds should be renamed to steps (`ходы` in Russian)
- rounds should now mean the won/lost match unit
- a game should now mean up to 9 rounds with 5 lives, ending earlier after 5 losses
- after every round the player should get new coins to spend in the shop in addition to any saved coins
- the shop should offer additional space for artifacts
- the design should be researched against `Backpack Battles`

### Stated criteria and constraints

- Russian-first terminology matters, especially the rename from `round` to `step`
- the existing single-duel flow must be reworked into a multi-round game run
- the economy must support carry-over coins between rounds
- artifact-space expansion must be purchasable from the shop
- friend challenges create a shared game run where both players face each other every round with ready sync
- only one active game run per player at a time
- emoji reactions are deferred to post-rework
- the result should be a markdown implementation plan in the repo

### Success conditions

- `AC1`: the plan defines the new domain language for `step`, `round`, `battle`, and `game`
- `AC2`: the plan defines a backend run model for `9` rounds maximum and `5` loss lives
- `AC3`: the plan defines how coins carry over and how per-round income is added
- `AC4`: the plan defines how inventory-space upgrades are represented, bought, saved, and validated
- `AC5`: the plan identifies the concrete frontend, backend, DB, replay, and test surfaces to change
- `AC6`: the plan records Backpack Battles research clearly enough to justify the design direction without copying it blindly
- `AC7`: the plan defines a ready system for round synchronization (solo and challenge modes)
- `AC8`: the plan defines two game run modes: solo (ghost opponents) and challenge (friend vs friend)
- `AC9`: the plan enforces one active game run per player

### Open ambiguity that still affects execution

- Resolved on 2026-04-07:
  - the game is capped at `9` rounds and ends earlier on the `5th` loss
  - extra artifact space must come from purchasable bag items with their own colors and shapes
  - `spore` and `mycelium` are paid after every round
  - no draw outcome exists; a player can exit/abandon the game at will
  - in challenge mode, if one player hits 5 losses, the other player wins the run
  - disconnected players see a reconnection popup; if they fail to reconnect within a timeout, the run is abandoned
  - artifact count is limited only by available grid space and coins, not by a piece cap
  - `DAILY_BATTLE_LIMIT` applies per game run, not per round
  - solo mode: rating is updated per round; inflation is acceptable for now and will be tuned from real data
  - challenge mode: rating is updated once at the end of the game run using the aggregate W/L record (batch Elo)
  - each round matches against a different ghost opponent
  - both players must signal ready before a round begins (challenge mode); solo mode starts immediately on ready
  - friend challenges create a shared game run where both players face each other every round
  - only one active game run per player at a time
  - emoji reactions are deferred to a post-rework polish pass
  - backend has not shipped to production, so full reworks are safe
  - the shop/loadout screen and the battle-prep screen should be merged into a single prep phase per round
  - `MAX_ARTIFACT_PIECES` (backend) / `MAX_INVENTORY_PIECES` (frontend) should be removed entirely; grid space and coins are the only constraints
  - selling artifacts and bags uses a drag-to-sell-area interaction (mobile-first); the sell area displays the refund value on hover/drag-enter
  - `BATTLE_ROUND_CAP` was renamed to `STEP_CAP` and raised from `12` to `120` during the rework (originally `12` was too low and caused `balance.md` Issue #3, battles ending at "step 12" with both sides alive)
  - sell refund: full price in the round the item was bought, half price in later rounds
  - shop manual refresh cost: `1` coin for refreshes 1–3 within a round, `2` coins for refresh 4+ (capped at `2`; resets each round; first refresh is not free; limited only by available coins)
  - combat resolution is fully server-side and does not depend on client connection
  - ghost opponents are selected randomly; ghost loadout is generated to match the player's round budget (same coin spend on artifacts and bags, minus `12%` for simulated refresh cost)
  - bags can be repositioned when empty (controls appear); bags can be moved back to the container from the inventory
  - the container is a holding area outside the grid where purchased but unplaced items live; capacity is limited only by coins spent
  - max inventory grid is `9x9` for now (may be reconsidered later)
  - solo mode: per-round rating changes persist even on abandon; challenge mode: batch Elo applies on current W/L record on abandon
  - challenge mode uses SSE (Server-Sent Events) for real-time ready state, opponent actions, and round triggers
  - bag shop distribution uses pseudo-random escalating weight: 15% base per slot, +8% per bagless round, hard pity at 5 rounds without a bag
  - each run starts with an empty inventory and fresh shop; no base artifacts or profile/collection carry between runs
  - ghost budget deduction is `12%` of the player's round budget (simulating refresh costs the ghost "spent")
  - ghost loadouts from completed rounds are saved and can be encountered by other players as ghost opponents on the same round number; a player's own past loadouts are excluded from their ghost pool
  - ghost loadout snapshots are retained for `14` days; older snapshots are pruned if the total snapshot count exceeds a configurable threshold (prevents unbounded DB growth)
  - challenge mode invitations expire after `1` hour if not accepted; the inviter's active run slot is released on expiry
  - during prep, stat display reflects only grid-placed and bag-placed items; container items are excluded from stat totals
  - if combat completes while a player is disconnected, the player is advanced to the `result` phase on reconnect
  - shop offer is persisted per player per run; page refresh or reconnect restores the same offer (no free re-roll)
  - `roundsSinceBag` initializes at `1` (not `0`) so the first bag appears sooner in short runs
  - both players in a challenge run receive the same round income independently

## Research notes

### What Backpack Battles is useful for here

- It separates the prep/shop phase from the combat phase very cleanly.
- It carries unspent gold forward between rounds.
- It refreshes the shop after each round.
- It sells bag-like items that add backpack slots, which is the closest reference for your requested extra artifact space.

### Source-backed findings

- The Steam page highlights the core loop of buying and placing differently shaped items in a backpack before auto-resolved fights.
- Community mechanic references describe entering the shop after each round, receiving new gold, and keeping leftover gold for later rounds.
- Community bag references describe purchasable bag items that add backpack slots.

Sources:

- [Backpack Battles on Steam](https://store.steampowered.com/app/2427700/_Backpack_Battles/?l=english)
- [Game Mechanics - Backpack Battles Wiki](https://backpackbattles.wiki.gg/wiki/Game_Mechanics)
- [Game Mechanics - Backpack Battles Fandom mirror](https://backpack-battles.fandom.com/wiki/Game_Mechanics)
- [Bag - Backpack Battles Wiki](https://backpackbattles.wiki.gg/wiki/Bag)

### Adaptation for this repo

We should borrow the loop shape, not the whole ruleset:

- keep our mushroom `1v1` async ghost/friend combat
- keep our simpler stat model
- add run-based progression around the existing duel engine
- represent extra artifact space through a simpler shop upgrade system instead of importing Backpack Battles bag recipes, rarities, or full combinatorics

### End-of-game rewards (adapted from Backpack Battles)

Backpack Battles awards cosmetic trophies (one per round won) and rank points at the end of a run. There are no gameplay-affecting meta-progression rewards between runs.

For this repo, end-of-game rewards work as follows:

- `spore` and `mycelium` are paid after every round per the following table:

| Outcome | Spore | Mycelium |
|---|---:|---:|
| Win | 2 | 15 |
| Loss | 1 | 5 |

- at the end of the game run, the player receives a completion bonus based on total wins:

| Wins in run | Spore bonus | Mycelium bonus |
|---:|---:|---:|
| 0–2 | 0 | 0 |
| 3–4 | 5 | 2 |
| 5–6 | 10 | 5 |
| 7–9 | 20 | 10 |

- in challenge mode, the player who forces the opponent to 5 losses (or has more wins when 9 rounds complete) receives an additional winner bonus of `+10 spore` and `+5 mycelium`
- these values are tuning knobs and will be adjusted from real data

## Current workspace state (post-rework)

> **Updated 2026-04-11.** Reflects the run-state refactor ([loadout-refactor-plan.md](./loadout-refactor-plan.md)) and the post-review hardening pass ([loadout-refactor-review.md](./loadout-refactor-review.md), [post-review-followups.md](./post-review-followups.md)). Prior drift — `STEP_CAP = 12`, `game_run_ghost_snapshots` as a separate table, `PlayerArtifactLoadoutItem` extended for run state — is corrected below.

### Backend

- [app/server/services/run-service.js](app/server/services/run-service.js) — game run lifecycle, mutations, and round resolution:
  - Lifecycle: `startGameRun()`, `getActiveGameRun()`, `abandonGameRun()`, `getGameRun()`
  - Mutations (all wrapped in `withRunLock` for per-run serialization): `buyRunShopItem()`, `sellRunItem()`, `refreshRunShop()`, `applyRunLoadoutPlacements()` (temporary bridge for legacy placement payload, pinned as pass-through)
  - Round resolution: `resolveRound()` (solo), `resolveChallengeRound()` (challenge), with per-round Elo (solo) or batch Elo (challenge). Copy-forward of round-N rows into round N+1 via `copyRoundForward()`.
  - Ghost matching: `getRunGhostSnapshot()` — unified path (§2.4 of the loadout refactor): real-player snapshots and synthetic bot rows both live in `game_run_loadout_items`; the two paths share one query shape. `pruneOldGhostSnapshots()` deletes `game_run_id LIKE 'ghost:bot:%'` rows older than 1 day.
  - Challenge mode: `createRunChallenge()`, `createChallengeRun()`, modified `acceptFriendChallenge()`
  - Rewards: `payCompletionBonus()`, `applyBatchElo()`, `runRewardTable`, `completionBonusTable`
  - History: `getGameRunHistory()`
- [app/server/services/battle-service.js](app/server/services/battle-service.js) — legacy single-battle flow and battle recording: `createBattle()`, `recordBattle()`, `getActiveSnapshot()` (branches on active-run to read from `game_run_loadout_items` vs. the legacy table).
- [app/server/services/battle-engine.js](app/server/services/battle-engine.js) — `simulateBattle()`, step-based combat loop capped at `STEP_CAP` (**120**, raised from 12 during the post-rework balance pass).
- [app/server/services/game-run-loadout.js](app/server/services/game-run-loadout.js) — helpers over `game_run_loadout_items`: `insertLoadoutItem`, `readCurrentRoundItems`, `deleteOneByArtifactId`, `nextSortOrder`, `copyRoundForward`, `insertRefund`, `applyRunPlacements`.
- [app/server/services/artifact-helpers.js](app/server/services/artifact-helpers.js) — `FAMILY_CAPS` registry + `isBag`, `isCombatArtifact`, `isContainerItem`, `contributesStats`. Replaces scattered `family === 'bag'` branches on the server.
- [app/server/services/loadout-utils.js](app/server/services/loadout-utils.js) — split into `validateGridItems`, `validateBagContents`, `validateCoinBudget`, plus the `validateLoadoutItems` orchestrator and `buildArtifactSummary`.
- [app/server/game-data.js](app/server/game-data.js) — constants and artifact/mushroom definitions. Shared numeric constants now live in [app/shared/game-constants.js](../app/shared/game-constants.js) (`INVENTORY_COLUMNS`/`ROWS`, `ROUND_INCOME`, `MAX_ROUNDS_PER_RUN`, `STARTING_LIVES`, `STEP_CAP`, `SHOP_OFFER_SIZE`, bag pity constants — 20 constants total) and are re-exported from both server and client:
  - Run constants: `MAX_ROUNDS_PER_RUN`, `STARTING_LIVES`, `ROUND_INCOME`, `RATING_FLOOR`, `GHOST_BUDGET_DISCOUNT`
  - Combat: `STEP_CAP` (120)
  - Bag items: `moss_pouch` (1x2, 2 slots), `amber_satchel` (2x2, 4 slots) with `family: 'bag'`
  - Bag distribution: `BAG_BASE_CHANCE`, `BAG_ESCALATION_STEP`, `BAG_PITY_THRESHOLD`
  - Shop refresh: `SHOP_REFRESH_CHEAP_LIMIT`, `SHOP_REFRESH_CHEAP_COST`, `SHOP_REFRESH_EXPENSIVE_COST`
  - Helpers: `bags`, `combatArtifacts`, `getCompletionBonus()`, `getShopRefreshCost()`
- [app/server/lib/utils.js](app/server/lib/utils.js) — `kFactor(rating, ratedBattles, mode)` supports `'solo_run'` K-factors (16/10/8)
- [app/server/lib/obs.js](app/server/lib/obs.js) — structured JSONL logger (`log.info/warn/error`) + `requestLogger()` middleware emitting `{requestId, method, route, status, durationMs, outcome, playerId, gameRunId}` per request.
- [app/server/lib/idempotency.js](app/server/lib/idempotency.js) — `Idempotency-Key` header middleware with 5-minute LRU cache keyed on `(playerId, requestId)`. 5xx responses deliberately not cached.
- [app/server/lib/rate-limit.js](app/server/lib/rate-limit.js) — per-player token bucket (12 burst, 4 req/sec sustained) wired into all four run-state mutation routes.
- [app/server/services/ready-manager.js](app/server/services/ready-manager.js) — in-memory ready state + `withRunLock` mutex (used by both ready manager and run-service mutations).
- [app/server/services/sse-manager.js](app/server/services/sse-manager.js) — SSE connection management for challenge mode
- [app/server/models/](app/server/models/) — Sequelize models, tables created via `sequelize.sync()` (umzug versioned migrations tracked in post-review-followups Batch C4).
  - **New run-state tables (from the refactor):** `game_runs`, `game_run_players` (partial unique index), `game_rounds`, `game_run_shop_states` (round-scoped), `game_run_loadout_items` (the authoritative per-round loadout table), `game_run_refunds` (sell ledger).
  - **Deleted during the refactor:** `game_run_ghost_snapshots` — the unified ghost path writes synthetic bot rows into `game_run_loadout_items` under `game_run_id = 'ghost:bot:<hash>'` instead.
  - **Legacy table (severed from game runs):** `player_artifact_loadouts` + `player_artifact_loadout_items` — used only by the legacy single-battle `ArtifactsScreen` prep flow. Game-run code never reads or writes these tables (§2.9 severance of [loadout-refactor-plan.md](./loadout-refactor-plan.md)).
  - `FriendChallenge` (+`challenge_type`, +`game_run_id`)
- [app/server/create-app.js](app/server/create-app.js) — all API routes including:
  - `POST /api/game-run/start`, `GET /api/game-run/:id`, `POST /api/game-run/:id/abandon`
  - `POST /api/game-run/:id/ready`, `POST /api/game-run/:id/unready`, `GET /api/game-run/:id/events` (SSE)
  - Mutation routes (all rate-limited + idempotency-keyed): `POST /api/game-run/:id/buy`, `POST /api/game-run/:id/sell`, `POST /api/game-run/:id/refresh-shop`
  - `PUT /api/artifact-loadout` — bridge to `applyRunLoadoutPlacements` when an active run exists; writes to legacy table otherwise. Pinned as pass-through by `tests/game/bridge-pin.test.js`.
  - `POST /api/game-run/challenge`, `GET /api/game-runs/history`

### Frontend

- [web/src/main.js](web/src/main.js) — Vue 3 SPA with run flow:
  - New state: `gameRun`, `gameRunResult`, `gameRunShopOffer`, `gameRunRefreshCount`, `sellDragOver`
  - New screens: `prep` (merged shop+inventory+ready with run HUD and sell zone), `roundResult` (outcome+rewards), `runComplete` (end summary)
  - Home screen: "Start Game" / "Resume Game" buttons based on active run
  - Bootstrap restores active game run on page load
  - 13 new functions for run lifecycle, shop, sell, ready
- [web/src/i18n.js](web/src/i18n.js) — 24 new bilingual keys for run flow (round, wins, lives, coins, ready, sell, bags, etc.)
- [web/src/artifacts/render.js](web/src/artifacts/render.js) — bag rendering with color palette and slot count display
- [web/src/styles.css](web/src/styles.css) — CSS for run HUD, prep screen, sell zone, round result, run complete, bag styling

### Test coverage (54 tests)

- [tests/game/bag-items.test.js](tests/game/bag-items.test.js) — 16 tests: bag data, validation, shop distribution, sell blocking, ghost snapshots, step naming, history, coins, completion bonus
- [tests/game/ready-manager.test.js](tests/game/ready-manager.test.js) — 6 tests: ready state unit tests
- [tests/game/challenge-run.test.js](tests/game/challenge-run.test.js) — 7 tests: challenge creation, resolution, Elo, abandon
- [tests/game/game-run.test.js](tests/game/game-run.test.js) — 11 tests: run lifecycle, constraints, bootstrap
- [tests/game/round-resolution.test.js](tests/game/round-resolution.test.js) — 11 tests: rewards, Elo, elimination, shop refresh, sell
- [tests/game/loadout-and-battle.test.js](tests/game/loadout-and-battle.test.js) — 3 tests: legacy battle flow (no regressions)

## Domain language (implemented)

- **Step** (`Ход`) — one internal combat beat inside a duel replay; replaces the old user-facing meaning of `round`
- **Round** (`Раунд`) — one won/lost duel inside a longer run; has a shop phase before it and a result after it
- **Game** (`Игра`) — a run capped at 9 rounds that ends earlier on the 5th loss; starts with 5 lives
- **Battle** — kept as the technical name for the duel simulation payload and stored replay artifact (minimizes table/route churn)

## Recommended product rules

### Game run modes

A game run operates in one of two modes:

- `solo`
  - player fights a random ghost opponent each round
  - ghosts already faced in the same run are excluded; if the pool is exhausted, ghosts may be reused
  - ghost loadout matches the player's round budget (same coin spend minus `12%` simulating refresh costs)
  - ready signal starts the round immediately (no opponent to wait for)
  - rating is updated per round
- `challenge`
  - one player invites a friend to a game run via the existing friend challenge flow
  - challenge invitations expire after `1` hour if not accepted; the inviter's active run slot is released on expiry
  - both players share the same game run and face each other every round
  - each player has their own shop, coins, loadout, lives, and win/loss counters
  - a round starts only when both players signal ready
  - while waiting, either player can continue shopping and editing their loadout
  - if either player abandons, the game ends for both with their current records
  - if one player hits 5 losses, the other player wins the run
  - rating is updated once at the end of the game run using the aggregate W/L record (batch Elo), not per round

Only one active game run is allowed per player. Starting a new run requires the previous one to be completed or abandoned.

### Core run loop

1. Player starts a new game run (solo) or accepts a friend challenge (challenge).
2. The run initializes per player:
   - `roundNumber = 1`
   - `wins = 0`
   - `losses = 0`
   - `livesRemaining = 5`
   - `coins = 0` (round 1 income is added immediately)
   - `inventoryGrid = 3x2` (expandable up to `9x9` via bags)
   - `container = []` (empty holding area for purchased but unplaced items)
3. Player shops and edits the loadout (single merged prep screen).
   - purchased items go to the container first, then are placed onto the grid or into bags
   - bags can be moved back to the container when empty
4. Player signals ready.
   - Solo mode: round begins immediately.
   - Challenge mode: round begins when both players are ready.
5. The duel resolves and stores a replay.
6. The run updates per player:
   - increment wins if the round was won
   - increment completed rounds
   - increment losses if the round was lost
   - solo mode: apply rating change (Elo per round)
   - challenge mode: defer rating change to end of run (batch Elo on aggregate W/L)
   - pay `spore` and `mycelium` rewards based on outcome
   - add new round income to saved coins
   - refresh the shop offer
   - solo mode: match a new ghost opponent for the next round
   - challenge mode: opponent stays the same
   - keep owned artifacts and bought inventory expansions for the same run
7. If `roundsPlayed >= 9` or `losses >= 5`, the game ends for that player. In challenge mode, the game ends for both when either player's game ends; the player with fewer losses wins the run. Otherwise return to the prep screen for the next round.
8. At end of game: pay completion bonus based on total wins (see end-of-game rewards table). In challenge mode, also pay winner bonus and apply batch Elo update.
9. Player may abandon the game at any point instead of readying up. In challenge mode, abandoning ends the game for both players.

### Disconnect handling

- Combat resolution is fully server-side; a client disconnect during a duel does not affect the outcome
- If a player loses connection, the client shows a reconnection popup and attempts to reconnect automatically
- The server holds the run state; reconnecting restores the player to their current phase (prep, waiting, or result review); if combat completed during disconnection, the player is advanced to the `result` phase on reconnect
- If the player fails to reconnect within a grace period (default: `5` minutes, tuning knob), the run is treated as abandoned
- The grace period applies equally to solo and challenge modes:
  - solo: the run is abandoned after timeout; per-round rating changes already applied are kept
  - challenge: the opponent sees a "waiting for reconnection" state during the grace period; after timeout, the disconnected player's run is treated as abandoned (counts as a loss for winner bonus and batch Elo purposes)
- On reconnect within the grace period, the player resumes exactly where they left off with no penalty

### Economy rules

- Starting economy:
  - there is no separate starting coin grant; the round 1 income from the income table IS the starting coins
  - example: player receives 5 coins at round 1; if they spend 3, they carry 2 into round 2 and receive 4 more for a total of 6
- Carry-over:
  - unspent coins persist into the next round
- New round income:
  - every round grants fresh coins on top of saved coins, per the income table below
- Daily limit:
  - `DAILY_BATTLE_LIMIT` applies to game runs started, not individual rounds
- Artifact count:
  - `MAX_ARTIFACT_PIECES` is removed; the only constraints are grid space and coins
- Shop offer size:
  - `SHOP_OFFER_SIZE` stays at `5` items per shop visit for v1 (same as Backpack Battles)
  - with increasing coins in later rounds, players use manual refreshes to see more items rather than the offer growing
  - scaling the offer size is deferred to v2 if playtesting shows 5 feels thin in rounds 7–9
- Shop refresh:
  - the shop offer is re-rolled automatically after each round (free)
  - during the prep phase, players can manually refresh the shop for a coin cost
  - first refresh is not free; limited only by available coins
  - refresh cost formula (adapted from Backpack Battles: 1 gold for first 4 rerolls, then 2 gold, capped):
    - refreshes 1–3 within a round: `1` coin each
    - refreshes 4+: `2` coins each (capped at `2`, no further escalation)
    - refresh count resets each round
  - shop offer is persisted per player per run; page refresh or reconnect restores the same offer and refresh count (no free re-roll from reloading)
  - this is simpler than per-refresh escalation tables and matches BB's proven model scaled to our smaller economy
  - tuning knobs: cheap threshold (3), cheap cost (1), expensive cost (2)
  - challenge mode: both players receive the same round income independently

- Shop item distribution (pseudo-random with escalating weight):
  - each shop slot rolls independently for bag vs artifact
  - base probability per slot: `15%` chance to be a bag item
  - track `roundsSinceBag` per player (initializes at `1`, resets to 0 whenever any bag appears in a shop offer)
  - each round without a bag offer, increase per-slot probability by `+8%` (so: 15%, 23%, 31%, 39%, 47%...)
  - hard pity at `roundsSinceBag >= 5`: force one bag item into the offer (replace last slot)
  - with `roundsSinceBag` starting at `1`, round 1 has a 23% per-slot chance (~73% across 5 slots); by round 3 without a bag each slot is 39%, giving ~92% across 5 slots
  - the hard pity almost never fires but prevents worst-case streaks
  - tuning knobs: base rate (15%), escalation step (8%), pity threshold (5)
  - refreshes within a round also count: if a manual refresh produces a bag, `roundsSinceBag` resets
- Sell rules:
  - players can sell items back during the prep phase via drag-to-sell-area
  - refund rate: full price if sold in the same round the item was bought; half price (rounded down) if sold in a later round
  - each item tracks its `purchased_round` to determine the refund rate
- Anti-snowball design:
  - income is flat per round regardless of win/loss record (same approach as Backpack Battles)
  - no win streak bonus or loss compensation gold
  - the structural anti-snowball mechanism is coin carry-over: a losing player who spends wisely can accumulate unspent coins and power-spike in later rounds
  - this keeps the economy simple and avoids runaway advantage from early wins
  - if playtesting shows snowballing is a problem, a small loss compensation coin (+1 coin after a loss) can be added as a tuning knob without changing the core model
- Recommendation:
  - use a simple explicit income table instead of procedural scaling in v1 of this rework

Recommended income table for the first implementation pass (adapted from Backpack Battles, scaled to this game's smaller coin economy where artifacts cost 1–3 coins and bags cost 2–3 coins):

| Round | Income | Cumulative (no spending) |
|---|---:|---:|
| 1 | 5 | 5 |
| 2 | 5 | 10 |
| 3 | 5 | 15 |
| 4 | 6 | 21 |
| 5 | 6 | 27 |
| 6 | 7 | 34 |
| 7 | 7 | 41 |
| 8 | 8 | 49 |
| 9 | 8 | 57 |

Reasoning:

- Backpack Battles gives ~9–12 gold per round with items costing 5–20+; our items cost 1–3 coins, so our per-round income of 5–8 maintains a similar ratio of ~2–4 purchases per round
- flat 5 coins for rounds 1–3 keeps the early game simple and gives new players a stable baseline
- gradual ramp from round 4 onward rewards surviving longer and creates meaningful late-game purchasing power
- the cumulative column shows that a perfectly saving player would have 57 coins by round 9; in practice, spending keeps this around 10–15 coins of carry-over, which is enough to matter without being game-breaking
- 9 rounds with a 5-loss cap avoids ties in challenge mode: the 5-loss cap means one player always hits 5 losses before 9 rounds complete (since 4+4=8 < 9), and if both players reach round 9 the final round breaks any remaining tie

### Artifact-space expansion

Recommendation:

- introduce a new shop family: `bag`
- bag items are placed onto the base grid like other pieces
- each bag occupies cells with its own shape and color
- each bag grants additional artifact capacity inside itself or through attached bag-owned slots
- bags persist for the current game run only
- bags are cleared when the game ends and a new game starts

Recommended first set (v1):

| Bag | Cost | Grid footprint | Slot count | Color direction |
|---|---:|---|---:|---|
| Moss Pouch | 2 | `1x2` | 2 | soft green |
| Amber Satchel | 3 | `2x2` | 4 | warm amber |

Slot geometry rule for v1: each bag has a flat slot count (not a sub-grid). A `1x2` bag has 2 slots, a `2x2` bag has 4 slots. One slot holds one `1x1` artifact piece. This keeps v1 simple; sub-grid geometry and non-uniform piece shapes inside bags are deferred to v2.

Bag data schema (lives alongside artifacts in [game-data.js](app/server/game-data.js)):

```js
// --- Bag family ---
{
  id: 'moss_pouch',
  name: { ru: 'Моховой Мешочек', en: 'Moss Pouch' },
  family: 'bag',
  width: 1,
  height: 2,
  price: 2,
  slotCount: 2,
  color: '#6b8f5e',   // soft green
  bonus: {}
},
{
  id: 'amber_satchel',
  name: { ru: 'Янтарная Сумка', en: 'Amber Satchel' },
  family: 'bag',
  width: 2,
  height: 2,
  price: 3,
  slotCount: 4,
  color: '#d4a54a',   // warm amber
  bonus: {}
}
```

Schema notes:
- `family: 'bag'` distinguishes bags from combat artifact families (`damage`, `armor`, `stun`)
- `slotCount` is bag-specific; combat artifacts do not have this field
- `color` is bag-specific; used to render the bag's visual background/border on the grid
- `bonus: {}` (empty object, not omitted) keeps the shape uniform with combat artifacts so stat-summing loops and `Object.entries(artifact.bonus)` work without null checks; however, the combat stat-summing loop should explicitly exclude `family === 'bag'` items rather than relying on the empty bonus alone
- `width`/`height` follow the same grid footprint convention as existing artifacts
- additional bag types will be added in v2

Implementation rule:

- bags should be true placeable inventory objects, not abstract upgrade counters
- the first implementation keeps containment rules simple:
  - a bag is placed on the main grid and occupies cells matching its footprint
  - the bag exposes a flat internal slot count
  - each slot holds exactly one `1x1` artifact piece
  - only non-bag combat artifacts can be stored inside bags
  - bags cannot contain other bags
- bag repositioning:
  - an empty bag can be picked up and repositioned on the grid or moved back to the container
  - repositioning controls become available only when the bag is empty
  - a bag with items inside it cannot be moved; the player must empty it first
- container rules:
  - the container is a holding area outside the grid for purchased but unplaced items
  - purchased items go to the container first, then are dragged onto the grid or into bags
  - container capacity is limited only by coins spent (no separate cap)
  - artifacts in the container do not participate in combat; only grid-placed and bag-placed items are active
  - stat display during prep reflects only grid-placed and bag-placed items; container items are excluded from stat totals
- max grid size: `9x9` (tuning knob; may be reconsidered later)
- v2 backlog: sub-grid geometry inside bags, non-`1x1` pieces in bags, tiered bag rarities, bag crafting/combining

Why this shape:

- it matches the requested Backpack Battles-style mechanic
- it creates visible spatial decisions instead of invisible stat upgrades
- it avoids recursive-container edge cases
- the flat slot count keeps v1 implementation fast while leaving room for v2 depth

### Sell mechanic

- players can sell artifacts and bags back to the shop during the prep phase
- interaction: drag the item to a sell area at the bottom/edge of the prep screen (mobile-first)
- when the item enters the sell area, the refund value is displayed visually before the player releases
- refund rate:
  - full price if sold in the same round the item was purchased
  - half price (rounded down) if sold in a later round
  - each item tracks `purchased_round` to determine the applicable rate
- selling a bag that contains artifacts: the sale is blocked; the player must empty the bag first
- selling an empty bag: allowed; bag returns its refund value based on `purchased_round`
- sold items are removed from the loadout/container and the coins are added back immediately
- the sell area is always visible during the prep phase, not hidden behind a menu

### Ready system

- Before each round, every player in the run must signal ready
- Solo mode: ready signal starts the round immediately (no unready possible since the round begins instantly)
- Challenge mode: round does not start until both players are ready
- While waiting for the opponent in challenge mode, the player can continue shopping and editing the loadout
- A waiting state is shown when the player is ready but the opponent is not
- Unready (challenge mode only):
  - a player who has signaled ready can unready at any time before the round starts (i.e., before the opponent also readies)
  - unreadying returns the player to the `prep` state, allowing further loadout and shop changes
  - once both players are ready and the round has started, unreadying is no longer possible
  - the opponent sees the ready state toggle in real-time via SSE
- If a player abandons instead of readying, the game ends for all players in the run
- Ready state is ephemeral (server memory only, not persisted to DB) — it exists only for the brief window between one player readying and the round starting

### Rating system

The existing Elo implementation (in [lib/utils.js](app/server/lib/utils.js)) uses standard expected-score formula `E = 1 / (1 + 10^((Ro - Rp) / 400))` with tiered K-factors. The rework adjusts K-factors to account for per-round updates (solo) vs single-update batching (challenge).

- Starting rating: `1000` (unchanged)
- Rating floor: `100` (new; prevents degenerate ratings and display issues)
  - implementation: `ratingAfter = Math.max(100, ratingAfter)`

Solo mode K-factors (applied per round, up to 9 times per session):

| Tier | Current K | New K | Max session swing |
|---|---:|---:|---:|
| Provisional (<30 rated rounds) | 40 | **16** | ±144 |
| Default | 24 | **10** | ±90 |
| High-rated (>1600) | 16 | **8** | ±72 |

- Rationale: dividing the desired "one session feels like one decisive match" K (~24) by ~3 gives K≈8–10 per round, which keeps each round meaningful while capping session volatility at ~70–90 points
- `ratedBattleCount` increments by `1` per round for solo mode
- Provisional threshold remains at `30` (but counted in rounds, not sessions)

Challenge mode K-factors (applied once at end of run via batch Elo):

| Tier | K |
|---|---:|
| Provisional (<30 rated runs) | **40** |
| Default | **24** |
| High-rated (>1600) | **16** |

Batch Elo formula (single fractional update):

```
actualScore = wins / (wins + losses)
expectedScore = 1 / (1 + 10^((opponentRating - playerRating) / 400))
newRating = max(100, round(oldRating + K * (actualScore - expectedScore)))
```

- Example: player A (1000) goes 6-3 vs player B (1000) → `actualScore = 0.667`, `expected = 0.5`, `delta = 24 * 0.167 = +4`
- `ratedBattleCount` increments by `1` per challenge run (not per round)
- Batch Elo is simpler and more predictable for players than iterated per-round updates
- On abandon, batch Elo applies on the current W/L record at time of abandonment

### Opponent matching

- Solo mode: each round matches the player against a random ghost opponent
  - ghosts already faced in the same game run are excluded
  - the player's own past loadouts are excluded from their ghost pool
  - if the pool is exhausted, ghosts may be reused (random selection)
  - ghost loadout generation: the ghost is built with the player's round budget (income + carry-over) minus `12%` simulating refresh costs; the ghost spends this budget on artifacts and bags using weighted random selection from the round's available pool
  - ghost loadouts from completed rounds are persisted and can be encountered by other players as ghost opponents on the matching round number
  - ghost snapshot retention: snapshots older than `14` days are pruned if total snapshot count exceeds a configurable threshold (default: `10000`); this prevents unbounded DB growth while keeping a healthy ghost pool
- Challenge mode: the opponent is the other player in the run for every round

## Data and API plan

### New or changed server concepts

- `game_run`
  - one active or completed multi-round run
  - solo mode: one player vs rotating ghosts
  - challenge mode: two players vs each other every round
- `game_run_player`
  - per-player state within a run (coins, lives, wins, losses)
- `game_round`
  - one duel inside the run, linking to the existing `battles` table
- `round_shop_state`
  - current offer, reserved offer data if later needed, current coins, builder items, and purchased bag items for the active run
  - one per player per run

### DB approach

- The schema is defined via Sequelize model files in [app/server/models/](app/server/models/), supporting both PostgreSQL and SQLite
- Tables are created automatically via `sequelize.sync()` from model definitions
- Raw SQL queries in `game-service.js` are kept as-is; models are used for schema definition and sync, not ORM query building
- The raw SQL schema file (`schema.js`) has been replaced by model-based sync
- Since the backend has not shipped to production, existing tables and models can be freely reworked

### Recommended DB shape

All tables are defined as Sequelize models in [app/server/models/](app/server/models/) and created via `sequelize.sync()`. Raw SQL queries in the service layer remain unchanged.

- [GameRun.js](app/server/models/GameRun.js) — `game_runs` table
  - `id` TEXT PK
  - `mode` TEXT (`solo`, `challenge`)
  - `status` TEXT (`active`, `completed`, `abandoned`), default `active`
  - `current_round` INTEGER, default `1`
  - `started_at` TEXT
  - `ended_at` TEXT (nullable)
  - `end_reason` TEXT (nullable: `max_rounds`, `max_losses`, `abandoned`, `opponent_abandoned`)
- [GameRunPlayer.js](app/server/models/GameRunPlayer.js) — `game_run_players` table
  - `id` TEXT PK
  - `game_run_id` TEXT FK → `game_runs.id` CASCADE
  - `player_id` TEXT FK → `players.id` CASCADE
  - `is_active` INTEGER, default `1` — denormalized flag for the partial unique index
  - `completed_rounds` INTEGER, default `0`
  - `wins` INTEGER, default `0`
  - `losses` INTEGER, default `0`
  - `lives_remaining` INTEGER, default `5`
  - `coins` INTEGER, default `0`
  - partial unique index `idx_one_active_run_per_player` on `(player_id)` WHERE `is_active = 1` — enforces one active run per player at the DB level
  - note: per-player end reason is not stored separately; it is derivable from the run-level `end_reason` combined with each player's `wins`/`losses`/`lives_remaining`
- [GameRound.js](app/server/models/GameRound.js) — `game_rounds` table
  - `id` TEXT PK
  - `game_run_id` TEXT FK → `game_runs.id` CASCADE
  - `round_number` INTEGER
  - `battle_id` TEXT FK → `battles.id` SET NULL (references existing `battles` table — opponent info is already stored there)
  - `created_at` TEXT
  - note: no `opponent_player_id` here; the `battles` table already stores `initiator_player_id` and `opponent_player_id`
  - note: per-round results (outcome, coins) are derivable from `game_run_players` deltas and the `battles` table; a separate results table is not needed in v1
- [PlayerArtifactLoadoutItem.js](app/server/models/PlayerArtifactLoadoutItem.js) — extended with `purchased_round` INTEGER (nullable) for sell-price calculation
- ready state is **ephemeral only** — held in server memory, not persisted to DB
  - keyed by `(game_run_id, player_id, round_number)`
  - solo mode: ready triggers round immediately, no state stored
  - challenge mode: state held until both players ready, then discarded
- run-scoped loadout storage must distinguish:
  - artifacts on the main grid (grid position)
  - placed bag items (grid position + footprint)
  - artifacts inside a specific bag (bag id + slot index)
  - items in the container (purchased but not yet placed)
  - each item tracks `purchased_round` for sell-price calculation
- ghost loadout snapshots
  - after each round in solo mode, the player's loadout is saved as a ghost snapshot keyed by `(player_id, game_run_id, round_number)`
  - other players' solo runs can match against these snapshots on the corresponding round number

### Real-time communication (challenge mode)

- challenge mode uses SSE (Server-Sent Events) for real-time updates:
  - opponent ready state changes
  - round start trigger (when both players are ready)
  - opponent disconnect/reconnect status
  - round result delivery
- solo mode does not need SSE; standard request/response is sufficient
- SSE endpoint: `GET /api/game-run/:id/events` (authenticated, scoped to the player's run)
- the server holds one SSE connection per active challenge player; connections are cleaned up on run completion or abandon

### API changes

- add `POST /api/game-run/start`
  - starts a fresh solo game run
  - rejects if the player already has an active run
- add `POST /api/game-run/challenge`
  - creates a challenge game run and sends an invite to the friend
  - reuses the existing friend challenge flow for invitation and acceptance
  - invitation expires after `1` hour if not accepted; the inviter's active run slot is released on expiry
  - rejects if either player already has an active run
- add `POST /api/game-run/:id/ready`
  - signals the player is ready for the next round
  - solo mode: triggers round immediately
  - challenge mode: triggers round when both players are ready
- add `POST /api/game-run/:id/unready`
  - revokes the player's ready signal before the round starts (challenge mode only)
  - rejects if the round has already started or if the mode is solo
  - notifies the opponent via SSE
- add `GET /api/game-run/:id`
  - returns run summary, current coins, lives, round index, wins, losses, bag state, and recent round results
  - challenge mode: includes opponent's ready state
- add `POST /api/game-run/:id/abandon`
  - ends the game for all players in the run
- add `GET /api/game-runs/history`
  - returns paginated list of completed game runs for the player
  - each entry includes: mode, rounds played, wins, losses, end reason, started/ended timestamps
- add `POST /api/game-run/:id/sell`
  - sells an item from the loadout or container
  - returns refund amount (full price same round, half price later rounds)
  - rejects if the item is a non-empty bag
- add `POST /api/game-run/:id/refresh-shop`
  - manually refreshes the shop offer for a coin cost
  - returns the new offer and the cost paid
  - rejects if the player cannot afford the current refresh cost
- add `GET /api/game-run/:id/events` (SSE)
  - challenge mode only: streams real-time events (ready state, round start, disconnect, results)
- update `/api/bootstrap`
  - if the player has an active game run, include it in the bootstrap payload (run state, current round, coins, lives, wins, losses, loadout, container, shop state)
  - this allows the client to restore the player to the correct phase on page load or reconnect without a separate API call
- update `/api/shop-state`
  - scope it by active run instead of only by player
  - include bag items in the offer pool with pseudo-random pity timer
- keep `/api/artifact-loadout`
  - but make it run-scoped, bag-containment aware, and container aware

## Backend implementation stages

### Stage 1: terminology-safe refactor ✅ DONE

- renamed `BATTLE_ROUND_CAP` → `STEP_CAP` in `game-data.js`
- renamed `round` → `step` in simulation loop, event payloads, and `resolveAction()` in `game-service.js`
- renamed `computeRoundOrder()` → `computeStepOrder()`
- renamed event type `round_start` → `step_start`
- updated `replay/format.js`: `Раунд` → `Ход`, event field `round` → `step`
- updated lab input string in `main.js`
- all existing tests pass

### Stage 2: run state and persistence ✅ DONE

- migrated from raw SQL `schema.js` to Sequelize model files in `app/server/models/`; tables created via `sequelize.sync()`
- added `game_runs`, `game_run_players`, and `game_rounds` models with partial unique index enforcing one active run per player
- added `purchased_round` column to `PlayerArtifactLoadoutItem` model
- added run constants: `MAX_ROUNDS_PER_RUN = 9`, `STARTING_LIVES = 5`, `ROUND_INCOME` table
- removed `MAX_ARTIFACT_PIECES` / `MAX_INVENTORY_PIECES` caps; grid space and coins are the only constraints
- added service functions: `startGameRun()`, `getActiveGameRun()`, `abandonGameRun()`, `getGameRun()`
- added API routes: `POST /api/game-run/start`, `GET /api/game-run/:id`, `POST /api/game-run/:id/abandon`
- updated `getBootstrap()` to include `activeGameRun`

Validation:

- DB-backed tests for:
  - starting a solo run (empty inventory, fresh shop)
  - starting a challenge run (two players)
  - one active run per player constraint
  - finishing a win round
  - finishing a loss round
  - ending early on 5 losses
  - ending on 9 rounds played
  - abandon mid-game (solo and challenge)

### Stage 3: round economy and opponent matching ✅ DONE

- added `runRewardTable` (win: 2 spore/15 mycelium, loss: 1 spore/5 mycelium), `completionBonusTable`, `RATING_FLOOR`, `GHOST_BUDGET_DISCOUNT`, shop refresh cost constants and helpers
- added `kFactor` mode parameter for solo_run K-factors (16/10/8)
- added `GameRunGhostSnapshot` and `GameRunShopState` Sequelize models
- extended `GameRound` model with outcome, rewards, and rating tracking columns
- extracted `recordBattle()` helper from `createBattle()` for shared use
- parameterized bot budget in `pickUniqueArtifactsForBot`/`createBotLoadout`/`createBotGhostSnapshot`
- added `validateLoadoutItems(items, coinBudget)` budget parameter
- added server-side `generateShopOffer()` helper
- `startGameRun()` now initializes coins (`ROUND_INCOME[0]`) and shop state
- implemented `resolveRound()` — full round resolution (duel, rewards, Elo, coins, ghost snapshot, end conditions)
- implemented `getRunGhostSnapshot()` — ghost matching with exclusion + budget + bot fallback with retry
- implemented `applyBatchElo()` and `payCompletionBonus()` helpers
- `abandonGameRun()` now pays completion bonus
- implemented `refreshRunShop()` with formula-based cost (1 coin x3, then 2 coin)
- implemented `sellRunItem()` with round-aware pricing (full same round, half later)
- added API routes: `POST /api/game-run/:id/ready`, `POST /api/game-run/:id/refresh-shop`, `POST /api/game-run/:id/sell`
- 25 tests passing (11 game-run + 11 round-resolution + 3 loadout-and-battle)

Original plan items completed:
- after each round:
  - keep leftover coins
  - add round income
  - refresh shop offer per player (free between-round refresh)
  - solo mode: match a random ghost opponent (exclude ghosts already faced in the run)
  - challenge mode: opponent stays the same
- implement manual shop refresh with formula-based cost (1 coin for refreshes 1–3, 2 coins for 4+, resets each round)
- implement sell mechanic backend logic with round-aware pricing (full same round, half later); UI is deferred to Stage 5
- pay `spore` and `mycelium` after every round to each player (win: `2` spore / `15` mycelium; loss: `1` spore / `5` mycelium)
- solo mode: apply rating change (Elo) after every round; per-round changes persist even on abandon
- challenge mode: defer all rating changes to end of run (batch Elo on aggregate W/L record); batch Elo applies on current W/L even if abandoned
- at end of game: pay completion bonus based on total wins; in challenge mode, pay winner bonus and apply batch Elo
- remove draw outcome from reward table; only win and loss exist
- ghost loadout generation: build ghost with player's round budget minus `12%` refresh-cost deduction
- ghost loadout snapshots are implemented in this stage (deferred from Stage 3 because they depend on the bag/grid UI that produces the loadout data)
- store run summary for history

Validation:

- test coin carry-over across multiple rounds
- test round income addition
- test free shop refresh after round resolution
- test manual shop refresh with formula-based cost (1 coin for refreshes 1–3, 2 coins for 4+, resets each round)
- test sell refund: full price same round, half price later round
- test per-round reward payout amounts (win: 2 spore / 15 mycelium; loss: 1 spore / 5 mycelium)
- test shop offer persists across page refresh / reconnect (no free re-roll)
- test ghost loadout budget matches player round budget
- test ghost exclusion within a run (including player's own past loadouts)
- test rating applied per round (solo mode)
- test per-round rating persists on solo abandon
- test batch Elo applied at end of run (challenge mode)
- test batch Elo applied on challenge abandon

### Stage 4: ready system, challenge mode, and SSE ✅ DONE

- added `ready-manager.js` — in-memory ready state with `setReady`/`setUnready`/`areBothReady`/`clearRound`/`clearRun` + mutex locking via `withRunLock`
- added `sse-manager.js` — SSE connection management with `addConnection`/`removeConnection`/`sendToPlayer`/`sendToOpponent`/`broadcast`/`removeRun`
- added `challenge_type` and `game_run_id` columns to `FriendChallenge` model
- added `createRunChallenge()` — creates challenge invitation with 1-hour expiry, validates friendship and no active runs
- added `createChallengeRun()` — creates shared game run with two players, independent shops/coins/lives
- modified `acceptFriendChallenge()` to branch on `challenge_type` ('run' vs 'battle')
- added `resolveChallengeRound()` — both players face each other, opposite outcomes, no per-round Elo, independent rewards, batch Elo + winner bonus at end
- modified `resolveRound()` to branch on run mode (solo vs challenge)
- modified `abandonGameRun()` — pays completion bonus and batch Elo for ALL players in the run
- added API routes: `POST /api/game-run/challenge`, `POST /api/game-run/:id/unready`, `GET /api/game-run/:id/events` (SSE)
- modified routes: `/ready` branches solo/challenge with ready manager + SSE notifications; `/abandon` sends SSE cleanup for challenge
- 38 tests passing (6 ready-manager + 7 challenge-run + 11 game-run + 11 round-resolution + 3 loadout-and-battle)

Original plan items completed:
- add ready signaling per round
  - player marks ready after prep phase
  - solo mode: round triggers immediately on ready
  - challenge mode: round triggers when both players are ready
  - player can continue editing loadout while waiting in challenge mode
- add SSE endpoint (`GET /api/game-run/:id/events`) for challenge mode
  - streams: opponent ready state, round start, disconnect/reconnect, round results
  - one connection per active challenge player; cleaned up on run end
- add challenge game run creation
  - integrate with existing friend challenge flow
  - both players join the same game run
  - shared round counter, independent player state (coins, lives, loadout, container)
- add abandon logic
  - solo: ends the run for the player
  - challenge: ends the run for both players

Validation:

- test ready state transitions (solo: immediate, challenge: both-ready)
- test unready in challenge mode (revoke ready before round starts, opponent notified via SSE)
- test unready rejected after round has started
- test unready rejected in solo mode
- test round auto-start on both-ready in challenge mode
- test SSE event delivery (ready, unready, round start, disconnect)
- test challenge run creation and friend invite flow
- test challenge invite expiry after `1` hour (inviter's run slot released)
- test abandon ends game for both players in challenge mode
- test that both players get independent shop/coins/lives/container state

### Stage 5: bag items, sell UI, and prep screen rework — backend ✅ DONE, frontend deferred

- added 2 bag items (`moss_pouch`, `amber_satchel`) with `family: 'bag'`, `slotCount`, `color` fields
- added `bags` and `combatArtifacts` filtered exports from game-data.js
- added bag distribution constants: `BAG_BASE_CHANCE` (15%), `BAG_ESCALATION_STEP` (8%), `BAG_PITY_THRESHOLD` (5)
- added `rounds_since_bag` to `GameRunShopState` model (starts at 1)
- added `bag_id` to `PlayerArtifactLoadoutItem` model (nullable, tracks which bag holds this item)
- `buildArtifactSummary` excludes bags from combat stats
- `generateShopOffer` now uses pseudo-random bag distribution with per-slot chance escalation and hard pity timer
- all `generateShopOffer` callers updated (startGameRun, resolveRound, refreshRunShop, createChallengeRun, resolveChallengeRound)
- `validateLoadoutItems` extended for bag containment: bags on grid, artifacts inside bags via `bagId`, bags-in-bags rejected, slotCount enforced, only 1x1 in bags
- `saveArtifactLoadout` supports `bagId` and custom `coinBudget` parameter
- `sellRunItem` blocks selling non-empty bags
- `pruneOldGhostSnapshots()` for ghost snapshot cleanup (>14 days, >10000 threshold)
- `getGameRunHistory(playerId)` + `GET /api/game-runs/history` route
- 54 tests passing (16 bag-items + 6 ready-manager + 7 challenge-run + 11 game-run + 11 round-resolution + 3 loadout-and-battle)

Frontend implementation completed:

This stage combines backend bag logic with the full prep screen UI because bag placement is a complex grid interaction that needs visual testing alongside backend validation.

**Backend:**

- add bag items to shop data (using the bag schema defined in the artifact-space expansion section)
- extend loadout validation to support:
  - base-grid placements
  - bag placements
  - items contained inside a specific bag
- persist purchased bags on the active run
- prevent bag purchases from disappearing between rounds in the same game
- enforce first-pass containment rules:
  - bag must be placed on main grid before it can hold items
  - bag cannot hold another bag
  - items inside a bag must fit that bag's own slot geometry
- implement pseudo-random bag distribution in shop offers:
  - 15% base chance per slot, +8% escalation per bagless round, hard pity at 5 rounds
  - track `roundsSinceBag` per player; reset on any bag appearance (including manual refreshes)
- ghost loadout snapshots:
  - after each solo round, save the player's loadout (grid + bags + container) as a ghost snapshot keyed by `(player_id, game_run_id, round_number)`
  - other players' solo runs can match against these snapshots on the corresponding round number
  - snapshots include bag placements and bag contents so the ghost loadout is fully representative
  - a player's own past loadouts are excluded from their ghost pool
  - snapshots older than `14` days are pruned if total count exceeds a configurable threshold (default: `10000`)
  - if no matching snapshot exists for a round, fall back to generated bot loadout

**Frontend:**

- merge shop/loadout and battle-prep into a single prep screen per round
- show game HUD:
  - round number, wins, lives remaining, coins
  - current bag capacity summary
  - ready state indicator
  - opponent ready state (challenge mode)
- implement sell UI:
  - drag-to-sell-area interaction on the prep screen
  - sell area shows refund value on drag-enter (full same round, half later rounds)
  - selling a bag with contents is blocked until the bag is emptied
  - sell area always visible at the bottom/edge of the prep screen
- implement container UI:
  - purchased items land in the container first
  - items can be dragged from container to grid or into bags
  - bags can be moved back to container when empty
  - container area has a small expand/collapse toggle styled as a link button (collapsed by default to save screen space on mobile; expanded when items are present)
- implement bag repositioning:
  - empty bags show move/reposition controls
  - non-empty bags lock repositioning until emptied
- show round results inside the game flow
- keep replay viewer focused on one round battle, but label combat beats as steps
- show opponent info for the current round (ghost in solo, friend in challenge)

Files most likely touched:

- [app/server/game-data.js](/Users/microwavedev/workspace/mushroom-master/app/server/game-data.js)
- [app/server/services/game-service.js](/Users/microwavedev/workspace/mushroom-master/app/server/services/game-service.js)
- [web/src/components/ArtifactGridBoard.js](/Users/microwavedev/workspace/mushroom-master/web/src/components/ArtifactGridBoard.js)
- [web/src/main.js](/Users/microwavedev/workspace/mushroom-master/web/src/main.js)
- [web/src/styles.css](/Users/microwavedev/workspace/mushroom-master/web/src/styles.css)

Validation:

- executable layout assertions for:
  - base grid starts at `3x2`
  - purchasable bag offers render distinctly from normal artifacts
  - placed bag remains fully inside the main grid
  - bag interior capacity matches its spec
  - artifact pieces placed into a bag remain fully inside the bag bounds
  - CTA remains outside the grid and clickable
  - sell area is visible and does not overlap the grid
  - drag-to-sell displays correct refund value (full vs half) before release
  - selling a non-empty bag is blocked
  - container area is visible with expand/collapse toggle
  - bag repositioning controls appear only when bag is empty
- Playwright integration flow:
  - start game
  - buy item
  - keep leftover coins
  - finish round
  - confirm next-round coins increased
  - buy space upgrade (bag)
  - place bag on grid, place artifact inside bag
  - sell artifact (confirm full refund same round)
  - advance round, sell previously bought artifact (confirm half refund)
  - attempt sell non-empty bag (confirm blocked)
  - manually refresh shop, confirm cost deducted
  - refresh page and confirm run state persists
- fresh screenshots for:
  - base `3x2` prep screen with container (collapsed) and sell area
  - container expanded with purchased items
  - prep screen with distinct bag item offer and refresh button
  - prep screen with placed bag and nested contents
  - sell area with item dragged over it (showing full vs half refund)
  - replay screen showing `Ход` labels
  - challenge mode waiting state

### Stage 6: history and reporting ✅ DONE

- added `getGameRunHistory(playerId)` — returns paginated list of completed/abandoned runs with rounds played, wins, losses, end reason
- added `GET /api/game-runs/history` route
- battle history remains replay-oriented (unchanged)
- game history is now run-oriented

## Frontend UX changes ✅ IMPLEMENTED

### Prep screen (merged shop+inventory+ready)

- Run HUD bar at top: `Раунд X | Победы: X | Жизни: X | Монеты: X`
- Container zone for purchased but unplaced items (same drag-and-drop as before)
- Inventory grid with rotation and placement (same `ArtifactGridBoard` component)
- Shop zone with run-scoped refresh button showing cost (1/2 coins)
- Sell zone at bottom — drag items to sell, shows refund value on drag-enter
- Ready button to trigger round resolution
- Abandon button to exit the run
- Bag items in shop have distinct colored border and slot count badge

### Round result screen

- Shows win/loss outcome with color (green/red)
- Displays per-round rewards: spore, mycelium, rating change
- Shows updated wins, lives, coins
- "Continue" button to return to prep for next round
- "View Replay" button to watch the round's battle

### Run complete screen

- Shows end reason (eliminated / all rounds / abandoned)
- Final record (wins and rounds completed)
- Home button to return to dashboard

### Home screen changes

- "Start Game" button when no active run exists
- "Resume Game (Round X)" button when active run exists
- Auto-navigates to prep screen on page load if active run detected via bootstrap

### Replay labels

- Combat beats labeled as `Ход 1`, `Ход 2`, etc. (step_start events)

### Shop changes

- mixed shop inventory:
  - combat artifacts
  - bag items (pseudo-random with pity timer)
- bags should look visually distinct from combat artifacts through color and silhouette
- each bag card should preview:
  - shape
  - capacity
  - price
- manual refresh button with current cost displayed
- if bag limits are later added, capped bags should be hidden or disabled explicitly

### Container and sell area

- container area shows purchased but unplaced items
- sell area at bottom/edge of prep screen
- drag item to sell area to sell; refund value displayed on drag-enter
- refund value label distinguishes full vs half price visually

### History changes

- current replay cards should stop implying that one duel equals one full game
- add a small run summary on top of the replay list or as a sibling tab later
- each run summary should show at least:
  - wins
  - losses
  - end reason (`9 rounds`, `5 losses`, or `abandoned`)

## Validation plan

### Unit/integration

- backend tests for:
  - step naming in replay payload
  - solo run creation
  - challenge run creation and friend invite
  - early end on 5 losses
  - end on 9 rounds played
  - coin carry-over
  - bag purchase persistence
  - bag-aware loadout bounds
  - container: purchased items held before placement
  - per-round reward payout (spore, mycelium, rating for solo)
  - end-of-game completion bonus based on total wins
  - challenge mode winner bonus
  - batch Elo at end of challenge run
  - batch Elo on challenge abandon (current W/L)
  - per-round rating persists on solo abandon
  - ready signaling (solo: immediate, challenge: both-ready)
  - unready in challenge mode (revoke before round starts)
  - unready rejected after round started or in solo mode
  - SSE event delivery in challenge mode
  - abandon mid-game (solo and challenge)
  - random ghost per round within a solo run
  - ghost loadout matches player round budget
  - ghost loadout snapshots saved for other players (self-excluded)
  - ghost snapshot pruning (>14 days, >threshold count)
  - challenge invite expiry after 1 hour
  - same opponent every round in challenge run
  - daily game limit enforcement
  - one active run per player constraint
  - challenge mode: both players get independent economy
  - sell artifact: full refund same round, half price later round
  - sell bag with contents: blocked until emptied
  - sell empty bag: refund based on purchased_round
  - manual shop refresh with formula-based cost
  - pseudo-random bag distribution with pity timer
  - bag repositioning (empty only)
  - each run starts with empty inventory and fresh shop

### E2E

- solo mode journey:
  - start solo game
  - buy artifacts
  - save leftover coins
  - signal ready (round starts immediately)
  - play round 1
  - receive added round income
  - confirm different ghost opponent for round 2
  - buy a bag
  - place the bag on the grid
  - place a new artifact inside the bag
  - sell an artifact same round (drag to sell area, confirm full refund)
  - advance to next round, sell a previously bought artifact (confirm half refund)
  - attempt to sell non-empty bag (confirm blocked)
  - manually refresh shop, confirm cost deducted
  - refresh and verify persistence
  - signal ready and continue to next round
- challenge mode journey:
  - invite friend to challenge game
  - friend accepts, both enter shared run
  - both players shop independently
  - one player readies, confirm waiting state
  - ready player unreadies, confirm returns to prep
  - one player readies again, second player readies, confirm round starts
  - play round, confirm results for both sides
  - verify both players get rewards and income independently
  - continue to next round

### Visual proof

- fresh screenshots for (supplements Stage 5 screenshots):
  - base `3x2` prep screen with container (collapsed and expanded) and sell area
  - prep screen with distinct bag item offer and refresh button
  - prep screen with placed bag and nested contents
  - sell area with item dragged over it (showing full vs half refund)
  - replay screen showing `Ход` labels
  - challenge mode waiting state

## Game run state transitions

### Run-level states

```
[not started] → active → completed (9 rounds or 5 losses)
                  ↓
               abandoned
```

### Per-round player states (within an active run)

```
prep → ready → (waiting for opponent, challenge only) → combat → result → prep (next round)
  ↑                                                                          |
  └──────────────────────────────────────────────────────────────────────────┘
```

- `prep`: player is shopping, placing items, selling, refreshing. Can transition to `ready` or `abandoned`.
- `ready`: player has signaled ready. Solo: immediately transitions to `combat`. Challenge: transitions to `waiting` if opponent is not ready.
- `waiting`: challenge mode only; player is ready, opponent is not. Player can unready (`POST /api/game-run/:id/unready`) to return to `prep` state for further loadout/shop changes. Transitions to `combat` when opponent also readies.
- `combat`: server resolves the duel. No client interaction needed. Transitions to `result`.
- `result`: round outcome displayed. Transitions to `prep` for next round, or `completed`/`abandoned` if run is over.

### Abandon rules

- a player can abandon at any time during `prep`, `ready`, or `waiting` states
- abandoning during `combat` is not possible (combat resolves server-side instantly)
- solo abandon: run ends for the player; per-round rating changes already applied are kept
- challenge abandon: the abandoning player is treated as the loser of the run
  - the non-abandoning player receives the winner bonus (`+10 spore`, `+5 mycelium`)
  - batch Elo is applied on the current W/L record at time of abandonment
  - both players receive their completion bonus based on total wins at the time of abandonment
  - disconnect timeout (grace period expiry) is treated identically to an explicit abandon

## Completed post-rework fixes

### Stage 7: critical backend fixes ✅ DONE

- [x] **7a** `buyRunShopItem()` server endpoint + `POST /api/game-run/:id/buy` route — purchases validated server-side, item removed from offer, coins deducted, loadout item created with `purchased_round`
- [x] **7b** Rewrote `withRunLock` mutex with proper promise-chaining; `unready` now runs under the same lock
- [x] **7c** Application-level active-run check in `startGameRun()` (DB constraint kept as safety net)
- [x] **7d** `unready` gated behind `withRunLock` to prevent TOCTOU with `ready`
- [x] **7e** `requireRunMembership` middleware on all game-run routes (`/ready`, `/unready`, `/sell`, `/buy`, `/refresh-shop`, `/abandon`, `/events`)
- [x] **7f** `mode` whitelisted to `'solo'` in `startGameRun()` (challenge runs use `/challenge`)
- [x] **7g** Draw bias fixed — coin-flip instead of always favoring right side
- [x] **7h** Expiry check added to `acceptFriendChallenge()`
- [x] **7i** `RATING_FLOOR` clamp applied in legacy `applyBattleRewards()`
- [x] **7j** Error handler maps to proper HTTP codes (404, 403, 409, 429, 410); hides internals for 500s

### Stage 8: frontend robustness ✅ DONE

- [x] **8a** try/catch on all 11 unguarded async functions
- [x] **8b** `useTouch` composable with `touchstart`/`touchmove`/`touchend`, ghost element, `elementFromPoint` drop zones, CSS `touch-action: none`
- [x] **8c** Double `v-if`/`v-else-if` directive fixed (combined condition)
- [x] **8d** Non-critical bootstrap fetches (friends, leaderboard, wiki) individually wrapped — no longer log user out on failure
- [x] **8e** `loadoutStatsText()` uses localized labels
- [x] **8f** `buyRunShopItem()` calls server endpoint
- [x] **8g** `actionInFlight` guard on `saveLoadout`, `startBattle`, `signalReady`

### Stage 9: challenge mode SSE frontend ✅ DONE

- [x] `useSSE` composable: `EventSource` to `/api/game-run/:id/events` with `sessionKey` query param
- [x] Listens for `ready`, `round_result`, `opponent_abandoned`, `run_ended` events
- [x] Auto-connects on challenge prep screen entry, disconnects on exit
- [x] Server auth extended to accept `sessionKey` as query param for EventSource
- [x] Opponent ready indicator in PrepScreen ("Waiting for opponent..." / "Opponent ready")

### Stage 10: backend hardening ✅ DONE

- [x] **10a** SSE heartbeat every 30s + stale connection pruning (2h max age)
- [x] **10b** Heartbeat timer stops when no connections remain; `unref()` for clean process exit
- [x] **10c** `getBattleHistory()` accepts `limit` param; `getBootstrap` passes `limit: 10`
- [x] **10d** `battle_end` event reports actual final step, not always `STEP_CAP`
- [x] **10e** `declineFriendChallenge()` rejects non-pending challenges
- [x] **10f** Daily limit enforced for challenge invitees in `createChallengeRun()`

### Stage 11: test coverage ✅ DONE (71 unit tests)

- [x] `buyRunShopItem`: buy valid, buy not-in-offer (reject), buy insufficient coins
- [x] Invalid mode rejection (`startGameRun('challenge')` → error)
- [x] Expired challenge acceptance (reject)
- [x] Decline already-declined challenge (reject)
- [x] `RATING_FLOOR` enforcement across multiple rounds
- [x] Mycelium reward assertion
- [x] Spore reward assertion
- [x] Sell half-price refund for items from previous rounds
- [x] No-draw outcomes across multiple rounds

### Stage 12: cleanup ✅ DONE

- [x] Deleted `app/server/schema.js`
- [x] EN language button enabled (was permanently `disabled`)
- [x] `moss_pouch` and `amber_satchel` visually distinct in SVG
- [x] Wiki locations/factions i18n fixed

### Stage 13: frontend refactor ✅ DONE

Split `main.js` (2161 → 393 lines) into:

- 8 composables: `useGameState`, `useAuth`, `useShop`, `useGameRun`, `useReplay`, `useSocial`, `useSSE`, `useTouch`
- 16 page components: `AuthScreen`, `OnboardingScreen`, `HomeScreen`, `CharactersScreen`, `ArtifactsScreen`, `PrepScreen`, `BattlePrepScreen`, `ReplayScreen`, `ResultsScreen`, `RoundResultScreen`, `RunCompleteScreen`, `FriendsScreen`, `LeaderboardScreen`, `WikiScreen`, `WikiDetailScreen`, `SettingsScreen`

### Playwright E2E tests ✅ DONE

Run via `npx playwright test --config=tests/game/playwright.config.js`:

- [x] [solo-run.spec.js](tests/game/solo-run.spec.js) — 2 tests, 12 screenshots: start → buy → ready → round result → continue → refresh shop → page reload persistence → play to completion + abandon
- [x] [challenge-run.spec.js](tests/game/challenge-run.spec.js) — 2 tests, 7 screenshots: invite → accept → readies/unready → round resolves → opponent status → play to completion + abandon ends for both

### Stage 14: production UI polish ✅ DONE

- [x] History screen: replaced raw battle UUIDs with replay-card pattern (portraits, outcomes, rewards)
- [x] Results screen: added color-coded outcome banner (green/red/amber)
- [x] PrepScreen: moved hardcoded opponent status strings to i18n
- [x] Fixed `[object Promise]` rendering — all async components now use `defineAsyncComponent()`
- [x] Character grid: 4 columns on desktop, 2 on mobile; fixed portrait name gradient overlay
- [x] Standardized artifact cell sizes (44px) across shop, backpack, and inventory
- [x] Redesigned HomeScreen layout:
  - Mushrooms list (left) with select-to-pick, style tags, W/L/D stats per character
  - Battles list (right) with active run as first item, recent battles, start button in header, spore/limit footer
  - Friends block (bottom-left) with challenge buttons, add-friend form, friend code
  - Leaderboard block (bottom-right) with top 5, self-highlight
- [x] Relaxed battle prep layout rule in ui-design.md for multi-zone screens
- [x] Updated E2E selectors for new markup

## Deferred to post-rework

### Emoji reactions

- Players can send emoji reactions to their opponent between rounds and during the round
- First pass uses standard emoji; a custom sticker set will be provided later
- Reactions are ephemeral and not persisted in replay history
- No text chat, only predefined reactions
- Reactions show as floating overlays near the opponent portrait
- Requires: `POST /api/game-run/:id/react` endpoint
- Deferred because: the core battle rework is functional without it; sticker set is TBD

