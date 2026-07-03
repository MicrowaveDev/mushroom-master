# Game Requirements

**Type:** Authoritative behavioral spec.
**Scope:** What the game does, not how it's built. Every rule here is
testable: if the game violates a rule, it's a bug.

**Config:** All numeric constants referenced below (e.g. `MAX_ROUNDS_PER_RUN`,
`STEP_CAP`) are defined in [`app/shared/config.js`](../app/shared/config.js) —
the single source of truth shared by server and client.

Last verified against code: 2026-04-16.

---

## 1. Game Structure

- **1-A.** A **game run** consists of up to **9 rounds** (`MAX_ROUNDS_PER_RUN`).
- **1-B.** Each round is a 1v1 battle that ends on death or after at most **150 combat steps** (`STEP_CAP`); most battles end well before the cap.
- **1-C.** The player starts with **5 lives** (`STARTING_LIVES`).
- **1-D.** The player loses **1 life per round lost** (not per step).
- **1-E.** The run ends when lives reach 0 (`end_reason = 'max_losses'`) or all 9 rounds complete (`end_reason = 'max_rounds'`).
- **1-F.** The player may abandon the run at any time (`end_reason = 'abandoned'`). Before the abandon request is sent, the client shows a confirmation dialog that explains the season-rank penalty and offers cancel/confirm actions.
- **1-G.** A player may keep **one active solo game run per mushroom** at a time. Starting a solo run for a different active mushroom does not abandon earlier mushroom runs; selecting that mushroom later can resume its run. Challenge runs still require both players to have no active run.
- **1-H.** Max **10 game starts per player per day** (`DAILY_BATTLE_LIMIT`). Both solo game runs and challenge runs increment the same `daily_rate_limits.battle_starts` counter. (The counter is named `battle_starts` for historical reasons — it formerly tracked the now-deleted legacy single-battle flow as well.)

---

## 2. Inventory & Grid

> **Architecture note:** The current model is a flat Backpack-Battles-style grid: bags provide cells, artifacts occupy cells, and bag membership is derived from overlap. See [`inventory-architecture-research.md`](inventory-architecture-research.md).

- **2-A.** The starter inventory is a pre-placed `starter_bag` artifact at `(0, 0)` with **3 columns × 3 rows = 9 cells**.
- **2-B.** Bags expand available cells by occupying absolute anchors on the shared grid.
- **2-C.** Items in the **container** (purchased but unplaced, position `(-1,-1)`) do not contribute combat stats.
- **2-D.** Only placed non-bag artifacts with absolute `(x, y)` coordinates contribute to battle stats.
- **2-E.** Container capacity is unlimited (limited only by coins).
- **2-F.** The prep loadout panel is a **single unified grid** `BAG_COLUMNS = 6` wide and tall enough to fit all active bag footprints (`max(BAG_ROWS, max(anchorY + bag.rows))`). There is no separate base-inventory special case.
- **2-G.** Activating a bag runs a 2D first-fit packer in unified-grid coords that scans top-to-bottom, left-to-right and avoids other active bags.
- **2-H.** Bag chips are draggable regardless of whether artifacts overlap them. Moving, rotating, or deactivating a bag first unplaces affected artifacts to the container, then applies the bag mutation.
- **2-I.** Items may span adjacent bags. Per-cell coverage validation accepts the placement as long as every occupied artifact cell lies inside at least one active bag's shape mask.
- **2-J.** Bag membership is **many-to-many and derived at runtime from tile overlap**: an item is "in" every bag whose footprint overlaps any of the item's cells.
- **2-K.** `game_run_loadout_items` stores absolute `(x, y)` coordinates for placed bags and placed artifacts. `bag_id` is removed; container rows use `(-1, -1)`.
- **2-L.** Per-bag effects are computed at battle-start by aggregating each bag's rules over derived many-to-many membership. Adjacency synergies are computed independently from cell-touching.

### Database schema implications

| col on `game_run_loadout_items` | Meaning |
|---|---|
| `x, y` | absolute coords on the shared grid; `(-1, -1)` for container |
| `width, height, rotated` | piece dimensions and orientation |
| `active` | bag rows only |

Membership is not stored. It is derived from overlap between item cells and active bag cells.

---

## 3. Starter Preset

- **3-A.** Every character has a **2-item signature preset** defined in `STARTER_PRESETS`.
- **3-B.** Preset items are placed at `(0,0)` and `(1,0)` on round 1.
- **3-C.** Preset items are **free** — they do not cost coins from round income.
- **3-D.** Preset items **never appear in shop rolls** or ghost loadouts (filtered by `starterOnly` flag).
- **3-E.** Ghost opponents **also receive** their character's preset on top of bought items.

| Mushroom | Signature item | Existing item |
|---|---|---|
| Thalla | Spore Lash (stun: +4% stun, +1 dmg) | Spore Needle (+2 dmg) |
| Lomie | Settling Guard (armor: +2 armor) | Bark Plate (+2 armor) |
| Axilin | Ferment Phial (damage: +2 dmg, +1 spd) | Sporeblade (+3 dmg) |
| Kirt | Measured Strike (damage: +1 dmg, +1 armor) | Moss Ring (+1 dmg, +1 armor) |
| Morga | Flash Cap (stun: +6% stun, +1 dmg) | Haste Wisp (+1 spd) |
| Dalamar | Entropy Shard (stun: +5% stun, +1 armor) | Shock Puff (+8% stun) |

---

## 4. Economy

### Round Income

- **4-A.** Coins awarded at the start of each round:

| Round | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Income | 5 | 5 | 5 | 6 | 6 | 7 | 7 | 8 | 8 |

- **4-B.** Unspent coins carry forward to the next round.
- **4-C.** Round income is added to the player's coin pool at round transition.

### Shop

- **4-D.** Each round offers **5 items** (`SHOP_OFFER_SIZE`).
- **4-E.** Artifact prices: **1, 2, or 3** coins (determined per artifact in `game-data.js`).
- **4-F.** Shop offer **persists across page refreshes** — no free re-roll.
- **4-G.** Manual refresh cost: **1 coin** for refreshes 1–3 in the round, **2 coins** for refresh 4+ (resets each round).
- **4-H.** First refresh is **not free**.
- **4-I.** Refresh count limited only by available coins.
- **4-P.** Some artifacts are **character shop items**: lore-based artifacts associated with a specific mushroom and gated by `requiredLevel` in `game-data.js`.
- **4-Q.** A character shop item is eligible for a player's shop only when the player's **active mushroom** for the run has `level >= requiredLevel`.
- **4-R.** In **solo mode**, if the active mushroom has at least one eligible character shop item, each generated 5-item shop offer must include **at least one** eligible character shop item.
- **4-S.** In **challenge mode**, character shop-item eligibility is capped by the **lower** of the two active-mushroom levels in the run. Equivalently:
  - `effectiveChallengeLevelCap = min(viewerLevel, opponentLevel)`
  - a character shop item is eligible only when `requiredLevel <= effectiveChallengeLevelCap`
- **4-T.** The character-item eligibility rules in [Req 4-Q]–[Req 4-S] apply consistently to:
  - the initial round-1 shop offer
  - each between-round shop offer
  - each manual refresh result
- **4-U.** Challenge-mode shop offers remain **viewer-scoped** even when opponent level is used as an eligibility cap. The client may not receive the opponent's private shop offer or hidden future eligible item pool.
- **4-V.** General lore artifacts may appear in normal shop rolls without character gating. Their names, localized `description`, and `loreSource` should point at established world concepts, locations, or factions, and production-ready lore artifacts should have dedicated bitmap art under `web/public/artifacts/{artifact_id}.png`.
- **4-W.** Fusion-only artifacts are excluded from normal shop rolls and ghost shop-purchase pools. They are created only by artifact fusion recipes during round transition.

### Selling

- **4-J.** Sell an item in the **same round** it was purchased: **full price** refund.
- **4-K.** Sell an item in a **later round**: **half price** (rounded down, minimum 1).
- **4-L.** Non-empty bags **cannot be sold** — empty them first.

### Budget Validation

- **4-M.** The coin-budget validator sums **all items** including preset items.
- **4-N.** The budget ceiling for validation is `cumulative_round_income + preset_cost`.
- **4-O.** This applies to both player loadouts (at ready/resolve time) and ghost loadouts.

### Profile Wallet

- **4-X.** Temporary run-shop coins and persistent profile wallet currency are
  separate ledgers. `game_run_players.coins` can buy run artifacts, refresh the
  run shop, and receive run-item refunds only. Profile wallet currency cannot
  buy run artifacts.
- **4-Y.** Persistent profile wallet currency is profile-scoped, not
  mushroom-scoped. Currency earned while playing one mushroom can buy any
  eligible profile asset for another mushroom. During the compatibility
  migration, `players.spore` mirrors the default wallet balance, but wallet
  writes are recorded through `player_wallet_balances` and
  `player_wallet_transactions`.
- **4-Z.** Real-money wallet purchases are created as purchase intents and grant
  wallet currency only after server-side provider verification. Supported
  provider adapters are provider-neutral and may include Telegram Stars,
  BTCPay, NOWPayments, or later payment rails. Client requests cannot mark an
  intent as paid.

---

## 5. Bags

> **Architecture note:** Bags and artifacts now share one flat coordinate system. Collision, coverage, move/rotate, and persistence rules are summarized in [`shop-bag-inventory-architecture.md`](shop-bag-inventory-architecture.md); research and rationale are in [`inventory-architecture-research.md`](inventory-architecture-research.md).

- **5-A.** Bags are special artifacts that add inventory expansion beyond the base grid.
- **5-B.** **Moss Pouch**: 1×2, price 2, 2 slots.
- **5-C.** **Amber Satchel**: 2×2, price 3, 4 slots.
- **5-D.** Bags appear in the shop via escalating probability:
  - Base chance per slot: **15%** (`BAG_BASE_CHANCE`).
  - Escalation per bagless round: **+8%** (`BAG_ESCALATION_STEP`).
  - Hard pity: bag guaranteed at **5 consecutive bagless rounds** (`BAG_PITY_THRESHOLD`).
- **5-E.** `roundsSinceBag` initializes at **1** (not 0) so bags appear sooner in short runs.
- **5-F.** Bags do not contribute combat stats.

---

## 6. Combat Mechanics

### Step Resolution

- **6-A.** Each step, one combatant acts, then (if alive) the other acts.
- **6-B.** Action order determined by **speed** stat. Ties broken by: Morga's tie-break passive → base speed → random 50/50.
- **6-C.** **Damage dealt** = `max(1, attacker_attack + buffs − defender_armor)`.
- **6-D.** Armor-ignore abilities (e.g. Kirt's Clean Strike) reduce effective armor before the formula.
- **6-E.** **Stun check** after damage: `stunChance = artifact_stun% + ability_bonus%`, capped at **35%** (`MAX_STUN_CHANCE`).
- **6-F.** If stunned, the defender skips their next action; the stun flag clears after one skip.
- **6-G.** Battle ends on **death** (0 HP) with `endReason = 'death'`.
- **6-H.** Battle ends at **step 150** with `endReason = 'step_cap'`; winner is the side with higher HP%.
- **6-I.** Combat is fully **server-side** and does not depend on client connection.
- **6-J.** Dalamar's Ashen Veil passive reduces the enemy's defense by 1 after each successful hit, floored at 0.
- **6-K.** Replay `action` events include artifact attribution for placed non-bag artifacts that contributed positive attack damage, stun chance, or target armor to that action. The attribution is explanatory replay metadata only: it does not change combat math, does not include bag artifacts or container items, and replay clients must continue to render older battle events where the attribution field is absent.
- **6-L.** Lore-linked artifacts may emit replay-only `effectTags` when their existing stat contribution matters in the action. These tags drive momentary visual effects such as poison, frost, ash, ferment, flash, or biostasis, but they do not add hidden damage, turn skips, stat scaling, or persistent status unless a future requirement explicitly defines that mechanic.

### Character Abilities

| Mushroom | Passive | Active |
|---|---|---|
| **Thalla** | After successful stun → next hit +2 damage | Spore Lash: normal attack + 5% additive stun chance |
| **Lomie** | First incoming hit reduced by 3 after armor | Settling Guard: +2 temporary armor for next incoming hit |
| **Axilin** | Every 3rd successful hit → +3 damage | Ferment Burst: +2 damage, then −1 defense rest of battle |
| **Kirt** | If not stunned on previous enemy turn → +1 speed | Clean Strike: attack ignores 2 points of enemy armor |
| **Morga** | First action in battle → +4 damage | Flash Cap: breaks speed ties in her favor, +10% stun chance |
| **Dalamar** | Each hit permanently reduces enemy defense by 1 (min 0) | Bone of Entropy: normal attack + 15% additive stun chance |

### Base Stats

| Mushroom | HP | ATK | SPD | DEF | Style |
|---|---|---|---|---|---|
| Thalla | 100 | 11 | 7 | 2 | Control |
| Lomie | 125 | 9 | 4 | 5 | Defensive |
| Axilin | 90 | 15 | 8 | 1 | Aggressive |
| Kirt | 105 | 12 | 6 | 3 | Balanced |
| Morga | 85 | 13 | 10 | 0 | Aggressive |
| Dalamar | 100 | 10 | 5 | 3 | Control |

---

## 7. Ghost Opponents (Solo Mode)

- **7-A.** Ghost opponents are selected via **round-robin**: the 5 non-player mushrooms are shuffled once per run (seeded by `gameRunId`) and cycled by round number.
- **7-B.** Each mushroom is seen before any repeats; the player's own mushroom is **excluded**.
- **7-C.** Ghost receives **its character's starter preset** (same as the player).
- **7-D.** Ghost shop-spend budget formula:
  - `playerSpent` = sum of artifact prices in the player's loadout
  - `cumulativeIncome` = sum of `ROUND_INCOME[0..roundNumber]`
  - `graceFactor` = 0.7 (round 1), 0.85 (round 2), 1.0 (round 3+)
  - `base` = min(`playerSpent`, `cumulativeIncome`) × (1 − `GHOST_BUDGET_DISCOUNT` [0.12])
  - `ghostBudget` = max(3, floor(`base` × `graceFactor`))
- **7-E.** Ghost budget floor is always **3 coins** (enough for at least one cheap item).
- **7-F.** Ghost items are weighted by mushroom affinity: strong family = 5×, medium = 3×, weak = 1×.
- **7-G.** Ghost snapshots from completed real-player rounds are saved and can be encountered by other players; a player's own past loadouts are excluded.
- **7-H.** Ghost snapshot retention uses two strategies:
  - **Synthetic bot rows** (`ghost:bot:*`): pruned after `GHOST_BOT_MAX_AGE_DAYS` (1 day). These are deterministic and cheap to regenerate.
  - **Real-player snapshots**: kept at a pool of up to `GHOST_SNAPSHOT_MAX_COUNT` (10 000) distinct snapshots. When the count exceeds this threshold, the oldest snapshots are pruned.

---

## 8. Challenge Mode

- **8-A.** Friend challenges create a **shared game run** where both players face each other every round.
- **8-B.** Both players must **signal ready** before a round begins (SSE-synced).
- **8-C.** Both players receive the **same round income independently**.
- **8-D.** If one player hits 5 losses, the other player wins the run.
- **8-E.** Rating is updated **once at run end** using aggregate W/L record (batch Elo), not per-round.
- **8-F.** Challenge invitations expire after **1 hour** if not accepted; the inviter's run slot is released.
- **8-G.** Read isolation: player A **cannot see** player B's coins or loadout except through the explicit ghost-snapshot projection after round resolve.

---

## 9. Rewards

### Per-Round Rewards (game run)

- **9-A.** Per-round rewards:

| Outcome | Spore | Mycelium |
|---|---|---|
| Win | +2 | +15 |
| Loss | +1 | +5 |

### Completion Bonus (at run end)

- **9-B.** Completion bonus based on total wins:

| Total Wins | Spore | Mycelium |
|---|---|---|
| 0–2 | 0 | 0 |
| 3–4 | +5 | +2 |
| 5–6 | +10 | +5 |
| 7–9 | +20 | +10 |

### Challenge Mode Winner Bonus

- **9-C.** The winning player in a challenge run receives an additional **+10 spore, +5 mycelium**.

### Season Level Recap

> Designer/operator notes, tuning checklist, and maintenance commands live in [`season-ranking.md`](season-ranking.md). The requirements below remain the authoritative behavior.

- **9-E.** The run-complete screen derives a cosmetic **season score** from the finished run:

  `seasonPoints = min(wins, 7) * 2 - losses + 3 if endReason == max_rounds - abandonPenalty`

  `abandonPenalty` is `2` when the run is abandoned before any completed round, and `5` after at least one completed round. Only the first 7 wins in a run award season points; the final 2 possible wins still matter for completion rewards and full-clear status, but the cap prevents a single perfect run from over-farming the ladder. Season points are persisted per player in `player_season_progress`, with one idempotency row per finished run in `player_season_runs`. Run deltas may be negative: losses reduce the season score, and abandoned runs add the exit penalty. Total persisted season points are clamped at 0, so Bronze cannot demote below the floor. `player_season_progress` also stores `peak_points` and `peak_level_id` so end-of-season rewards can use the player's best reached rank even if later losses reduce current rank. The current season identity is `Season of the Deep Ring` / `Сезон Глубокого Кольца` (`season_1`). It behaves as a named chapter, not a destructive reset: accumulated progress remains part of the player history unless a future migration explicitly archives it. Season points do not affect matchmaking, rewards, combat, shop offers, ghosts, or rating. They exist to make the end-of-run recap feel important and to support lore achievements.

  When the season formula or rank thresholds change, run `npm run game:season:recalculate` first as a dry run, then `npm run game:season:recalculate -- --write` to backfill `player_season_runs.points`, `player_season_progress.total_points`, and stored peak fields from stored wins/losses/end reasons.

- **9-F.** Season score maps to the following **season ranks** in `app/shared/season-levels.json`:

  | Season rank | Points |
  |---|---:|
  | Bronze | 0+ |
  | Silver | 25+ |
  | Gold | 70+ |
  | Diamond | 140+ |

  The run-complete screen shows the reached rank, peak rank, a short lore line, points earned by the run, a points breakdown (win points, loss penalty, full-clear bonus, and exit penalty when present), total season rank points, and progress toward the next rank. Diamond shows a max-rank state.
  The prep HUD shows projected season-rank stakes for the current run and the abandon outcome before the player commits to Ready or Abandon.
  The home screen also shows current persisted season rank, peak rank, total points, next-rank progress, season identity, the "first 7 wins count" rule hint, and recent achievement unlocks from `getPlayerState`. If there are no recent unlocks, it should show a small next-achievement hint instead of leaving the season panel feeling empty.
  The season progress bar should animate into place. Run completion visually emphasizes a season rank-up when `leveledUp` is true, and applies a subdued penalty state when `leveledDown` is true. The client also emits `mushroom:season-tier-up` and triggers Telegram haptics for rank-ups when available.
  Season-end archival uses `peak_level_id`, not current `level_id`, when assigning rewards. `npm run game:season:archive` previews the archive and `npm run game:season:archive -- --write` writes one archive row per player-season and grants the peak-rank reward once. Current reward tuning is defined in `seasonEndRewards`: Bronze `50 spore`, Silver `150 spore + 5 mycelium`, Gold `350 spore + 15 mycelium`, Diamond `800 spore + 40 mycelium`. Spore rewards are persistent wallet grants; mycelium rewards remain character XP for the selected mushroom.

- **9-G.** Lore achievements are defined in `app/shared/run-achievements.json`, split into `general` and `characters.<mushroomId>` lists. Earned achievements are persisted in `player_achievements` with a unique `(player_id, achievement_id)` constraint, so the same achievement is not re-awarded every run. A completed run may display newly earned general, season, and character-specific achievements on the run-complete screen. Achievement criteria may reference wins, losses, rounds completed, end reason, last-round outcome, win rate, season points, and season level.
  Newly earned achievements should render as compact achievement cards and reveal with a short staggered animation unless reduced motion is requested. The cards should not stretch into full-width rows when only one achievement appears. To avoid drowning out the recap, persistence awards at most 3 new achievements per completed run, prioritized as first-run milestone → season tier → run-ending feat → character/general follow-ups; matching achievements beyond that cap remain locked and can be awarded by a later run. Medium achievements such as deep-run, three-win, and second character lore badges require at least 25 total season points so a first full clear cannot unlock the whole early catalogue at once. If a run matches no achievements, the recap should show a quiet empty state that still acknowledges the run. Achievements already earned in an older run may still appear when criteria match, but must be marked as already earned rather than `New`. The client emits `mushroom:achievement-unlock` and triggers a light haptic hook when new achievements exist.
  The client logs `achievement_unlock`, `season_tier_up`, and `season_rank_change` to `/api/client-events` for product analytics; those events are also persisted in `client_events`. `season_rank_change` includes direction, run points, total points, previous rank, and current rank so thresholds can be tuned from live distribution. Use `npm run game:season:inspect` for a player/rank debug table and `npm run game:season:analytics` for rank distribution, abandon/demotion rate, and opponent-kind/repeated-opponent summaries. Sound recommendations and generation prompts live in [`sound-design-recommendations.md`](sound-design-recommendations.md); no sound assets are required by this spec yet.
  The profile screen contains an achievement journal grouped by Season, General, and Character, with earned and locked states. Badge visuals should distinguish general, character, and season achievements; character badges use character accents, and season badges use Bronze/Silver/Gold/Diamond styling.

### ~~Legacy Single-Battle Rewards~~ (Deprecated)

- **~~9-D.~~ DEPRECATED 2026-04-13.** The legacy single-battle flow
  (`POST /api/battles`, `ArtifactsScreen`, `BattlePrepScreen`,
  `ResultsScreen`) was removed. All combat now flows through game runs
  which use the per-round + completion-bonus reward tables in 9-A and
  9-B. Tests and code should not reference the legacy reward table.

---

## 10. Rating

- **10-A.** **Solo mode**: Elo updated per round. Each round is an independent rating event.
- **10-B.** **Challenge mode**: batch Elo update at run end using aggregate W/L record.
- **10-C.** **Rating floor**: 100 (`RATING_FLOOR`). Rating never drops below this.
- **10-D.** On abandon: solo = per-round changes already applied; challenge = batch Elo computed on current W/L record.

---

## 11. Round Transition (Copy-Forward)

- **11-A.** At the end of each round, all loadout items from round N are copied to round N+1:
  - `fresh_purchase` is reset to `0` (for refund calculation — items bought in round N are no longer "fresh" in N+1).
  - `purchased_round` is **preserved** (tracks original purchase round for graduated refunds).
- **11-B.** New run coins are added:
  `game_run_players.coins += ROUND_INCOME[roundNumber]`.
- **11-C.** A new 5-item shop offer is generated.
- **11-D.** Shop `refresh_count` resets to 0.
- **11-E.** After round N is copied to round N+1 and before the round N+1 shop is shown, eligible artifact fusion recipes consume their ingredient rows and insert the result row into the container. Ingredients are eligible only when they are placed in the grid and their occupied cells touch by an edge; backpack/container rows and non-adjacent grid rows do not fuse. The battle for round N always uses the pre-fusion loadout. The prep UI highlights rows that will fuse, and the next prep entry plays a fusion reveal animation before the player edits the new shop state. Fusion reveal events persist with the run transition so challenge reconnect can still show the reveal after the missed replay.
- **11-F.** The sidebar menu includes a recipe section that lists every deterministic artifact fusion recipe from `app/shared/artifact-fusions.js`, showing ingredient artifact visuals, the fusion-only result visual, localized result text, and visible result stats.

---

## 12. Disconnection & Reconnection

- **12-A.** If a player disconnects, they see a reconnection popup on return.
- **12-B.** If combat completes while disconnected, the player is advanced to the result phase on reconnect.
- **12-C.** Challenge runs with no ready/unready activity for `CHALLENGE_IDLE_TIMEOUT_MS` (5 minutes) are auto-abandoned by the server. Both players are notified via SSE.
- **12-D.** Shop offer, loadout, and all run state are server-authoritative and survive page refreshes.

---

## 13. Replay

- **13-A.** Every battle produces a deterministic replay that can be re-watched.
- **13-B.** Replays are accessible as the post-ready battle screen during runs and from the run history list — the home and full history both list **game runs** (one row per run, per Req 1-A); clicking a run opens its summary, which lists the per-round battles inside the run, each linking to its own replay. There is no separate round-result screen; round rewards render inline after the replay finishes.
- **13-C.** During an active game run, the post-replay button must show **"Продолжить"** (continue to next round), not "Домой" (home).
- **13-D.** Outside a game run (standalone replay from history), the post-replay button shows **"Домой"**.
- **13-E.** Replay combat readability is primary. Portraits, speech bubbles, health, damage/stun feedback, and the combat log must remain visually dominant over supporting loadout context. Attack, hit, block, stun, and skip feedback must be side-symmetric: the same event class should read with equivalent strength whether it happens to the player portrait or the opponent portrait. Momentary damage/block/stun labels anchor to the affected portrait, not the center of the duel, and must not cover HP, names, speech bubbles, or configured face/head bands. Speech bubbles must read as coming from the speaking character without covering or crowding the character's face/head: each portrait variant used in replay must have configured framing, bubble placement, tail direction, and a head/face band. Replay screenshot tests must assert the bubble body stays inside the portrait image, the tail tip leaves breathing room from that band, and the bubble stays above the name overlay.
- **13-F.** Replay loadout grids are supporting context, not active placement controls. Grid cells and bag outlines must use subdued fills/borders so artifacts are legible without the cells competing for attention.
- **13-G.** Replay artifact attribution is presented as compact explanatory text/chips near the active hit feedback. It must stay readable in reduced motion, must not obscure HP or portraits, and must gracefully disappear for legacy events without attribution metadata. Persistent combat status indicators are rendered as compact portrait badges only for states that exist in replay data; current gameplay supports stun. Momentary lore artifact `effectTags` from [Req 6-L] may render as one-shot portrait labels/effects, but poison/freeze/etc. may not be shown as persistent statuses until battle-event state exists for them.

---

## 14. Mushroom Progression

- **14-A.** Each mushroom has a **level (1–20)** computed on read from its cumulative `mycelium` via `MYCELIUM_LEVEL_CURVE` in `app/server/lib/utils.js`. See [Req 14-H] for the exhaustive list of what level may and may not affect.
- **14-B.** Levels map to one of five **cosmetic tiers** via `getTier(level)` (in `app/server/game-data.js`):

  | Tier | Levels | Mycelium range (approx) |
  |---|---|---|
  | Spore | 1–4 | 0–349 |
  | Mycel | 5–9 | 350–1 199 |
  | Root | 10–14 | 1 200–2 499 |
  | Cap | 15–19 | 2 500–3 999 |
  | Eternal | 20 | 4 000+ |

  Tier is displayed as a badge on the home screen mushroom card. Level-up is a cosmetic event only.

- **14-C.** Level is **per-mushroom**. Playing Thalla does not advance Axilin's level.
- **14-D.** Character wiki entries are **gated by cumulative mycelium** (`WIKI_TIER_THRESHOLDS` in `app/server/game-data.js`):

  | Mycelium | Unlocks |
  |---|---|
  | 0 | Name + portrait (always visible) |
  | 100 | Overview paragraph |
  | 1 000 | Detailed lore |
  | 3 000 | Full backstory |

  Locked sections render as a lock icon with "Unlocks at N mycelium" copy. Non-character wiki entries (locations, factions, glossary) are always fully visible. Gating is enforced server-side in `getWikiEntry(section, slug, mycelium)`.

- **14-E.** The solo round-result response includes `lastRound.levelBefore`, `lastRound.levelAfter`, `lastRound.mushroomId`, and the per-mushroom rank-progress payload `lastRound.progressBefore` and `lastRound.progressAfter`. Each progress object has the shape `{ level, tier, current, next }`, where `tier` is `getTier(level)` and `(current, next)` come from `computeLevel(mycelium)` (`next` is `null` at the level cap). The replay screen renders the post-battle rewards card inline (Flow B Step 3) with a sequenced reveal: round outcome banner, reward stats (spore / mycelium / rating), then a rank progress block whose bar animates from `progressBefore.current` toward `progressAfter.current`. When `levelAfter > levelBefore` the bar fills to `progressBefore.next`, plays a level-up flash, then refills toward the new level's `current`. When `progressBefore.tier !== progressAfter.tier` an additional tier-change toast renders the new tier badge. Both the JS reveal timing and the CSS keyframes must be suppressed when the in-app `reducedMotion` setting is on or when `prefers-reduced-motion: reduce` is set.

- **14-F.** Each mushroom may have one or more profile-owned **portrait
  assets** derived from `PORTRAIT_VARIANTS` (in `app/server/game-data.js`). The
  first variant is always `id: 'default'` with wallet price `0` and is always
  usable. Additional variants are persistent profile assets: ownership is stored
  in `player_asset_instances`, equipment is stored in `player_equipped_assets`,
  and wallet spends are profile-scoped. `player_mushrooms.active_portrait`
  remains a compatibility mirror while older clients and battle snapshots
  migrate. `getPlayerState` returns `portraits[]` per mushroom with `owned`,
  `unlocked` (compatibility alias for owned), `price`, `currencyCode`,
  `assetId`, `acquisitionMode`, `purchaseAvailable`, `rollAvailable`, and
  `activePortraitUrl`. `PUT /api/mushroom/:id/portrait { portraitId }` is an
  equip-only compatibility route: it validates ownership, persists equipment,
  and returns 403 when the profile does not own the requested paid portrait.
  `POST /api/assets/:assetId/purchase` spends wallet currency for direct-buy
  assets, and `POST /api/assets/packs/:packId/roll` can grant one or more
  random skins from a configured pack when env-gated gacha is enabled. Packs can
  come from the static fallback config or, when `ASSET_GACHA_DB_PACKS_ENABLED`
  is enabled, from approved database-managed season/collection/pack/item rows;
  draft or unapproved database packs are not player-visible. The token-gated
  `/api/admin/gacha/*` API is the operator surface for DB-managed gacha data:
  it requires an admin actor with `gacha_operator` or `admin` role when operator
  roles are configured, records audited before/after changes in
  `support_actions`, validates draft packs before approval/publish, and edits
  approved packs through cloned draft revisions except for explicit emergency
  disable/expire actions. The `/support-admin` console includes a Gacha tab
  that consumes this API for catalog review, token-gated asset picking, season
  and collection edits, pack/item authoring, validation, publish, expire, and
  emergency disable actions without direct SQL. The Gacha tab and
  `/api/admin/gacha/packs/:packId/preview` also expose the release checklist,
  odds preview, deterministic roll simulation, DB asset-acquisition policy
  recommendations, and live/draft diff for cloned draft packs. Approval/publish
  is blocked when runtime validation fails or when required release checklist
  blockers are present, including missing pack dates, unsupported currency,
  missing positive price, or missing player-facing disclosure copy. Packs are
  unowned-only by default; packs that set `duplicatePolicy: "allow_duplicates"`
  can grant extra active asset instances for already owned skins, with duplicate
  results marked in roll metadata. Duplicate-enabled packs may define
  pack-level or item-level copy caps; capped assets leave the roll candidate
  pool and capped duplicate packs reject without spending currency. Multi-item
  packs draw without replacement inside one opening; the response keeps the
  first result in legacy fields and exposes the full opening in
  `rollResult.items[]`. Static pack config may define per-opening min-rarity
  guarantees, pack-scoped pity rules, and simple duplicate-burn exchange rules.
  `POST /api/assets/packs/:packId/burn` consumes configured duplicate copies
  while preserving one/equipped copy per asset and grants random eligible pack
  targets with an audit row. Burn rules can target `allow_duplicates`,
  `unowned_first`, or `unowned_only` eligible assets. Authoring validation
  blocks impossible rules, pack projection exposes current pity/burn readiness,
  and roll evidence records any guarantee/pity replacement. Real-player ghost
  snapshots preserve the equipped portrait id/path from the sampled player;
  synthetic bot ghosts use the default portrait.

- **14-G.** Each mushroom has exactly **3 starter preset variants** defined in `STARTER_PRESET_VARIANTS` (in `app/server/game-data.js`). The first is always `id: 'default'` with `requiredLevel: 0`. Variants are unlocked when `computeLevel(mycelium).level >= variant.requiredLevel`. All variants use two price-1 items so the total preset cost stays at 2, satisfying the `[Req 4-N]` budget ceiling. The active preset is stored in `player_mushrooms.active_preset` (default `'default'`). `startGameRun` reads the active preset and seeds its two items at `(0,0)` and `(1,0)` in round 1 instead of the character's signature default. If the stored preset id is unknown it falls back to `default` without error. `getPlayerState` returns `presets[]` per mushroom, each with an `unlocked` boolean and `activePreset`. `PUT /api/mushroom/:id/preset { presetId }` validates the level gate and persists the choice; it returns 403 if level is too low, 400 for an unknown preset id, and 404 for an unknown mushroom. Ghosts always receive the character's default preset regardless of player selection.

- **14-H.** Mycelium accumulation (also exposed in newer code as
  `characterXp`) and mushroom level are **progression-only, not stat-scaling**.
  Earning mycelium and advancing levels must not change: combat stats (health,
  attack, speed, defense), passive or active ability behavior, shop affinity
  weights, ghost opponent budget or difficulty, profile wallet balance, profile
  asset ownership, or any direct numerical combat modifier. The exhaustive list
  of player-facing effects of mycelium accumulation is: level number, tier
  badge, starter preset variant unlocks ([Req 14-G]), wiki section unlocks
  ([Req 14-D]), and character shop-item eligibility ([Req 4-P]–[Req 4-T]).
  Any future feature that grants a stat bonus, ability change, profile wallet
  grant, asset unlock, or other progression effect outside this list must update
  this requirement first.

## 15. Home Field Hub

The home screen is a walkable in-game field hub (see [`docs/home-field-ingame-plan.md`](home-field-ingame-plan.md) and [`docs/adr/0001-home-field-renderer.md`](adr/0001-home-field-renderer.md)). The hub is gated by the `HOME_FIELD_ENABLED` server flag; when disabled, the legacy dashboard renders instead. Map/asset metadata lives in `app/shared/home-field/`, production art lives under `web/public/home-field/`, and the runtime renderer is Phaser 3.88.x loaded via dynamic import.

- **15-A.** Home renders the **selected mushroom's chibi sprite** at the configured spawn point declared in `home-field-map.json`. If the player has no active mushroom (`player_active_character.mushroom_id` null), the hub still renders but Arena shows the `noActiveMushroom` locked state and routes to the character picker.

- **15-B.** On initial render at the mobile viewport (`390 × 844`), the **Arena entrance, Journey entrance, and selected chibi are all visible inside the declared `camera.mobileSafeFrame` without scrolling**. The same composition holds on desktop (`1440 × 900`).

- **15-C.** Tapping/clicking the Arena entrance (either the DOM hotspot button or walking the chibi into the Arena hotspot AABB) **starts a new run** when no active run exists for the selected mushroom (emit `start-run`, `'solo'`) and **resumes an active run** when one exists (`state.gameRun = activeRun; emit('resume-run')`). The CTA copy reflects the state.

- **15-D.** When `bootstrap.battleLimit.used >= bootstrap.battleLimit.limit`, the Arena entrance renders the **`dailyLimitReached` locked state**: arch desaturated, lock icon overlay, lantern art dimmed; the DOM button label uses `homeArenaDailyLimit` and is disabled. Tapping opens an explanation modal but never fires `start-run`/`resume-run`.

- **15-E.** When the player has no active mushroom, Arena renders the **`noActiveMushroom` locked state**: arch slightly desaturated, "?" silhouette under the arch; the DOM button label uses `homeArenaPickMushroom` and routes to the character picker on activation.

- **15-F.** Tapping the Journey entrance opens the **under-construction modal** with the `homeJourneyUnderConstruction` localized message. No backend call fires. Telegram BackButton closes the modal.

- **15-G.** Walking the chibi into the Arena hotspot AABB declared in `home-field-map.json` surfaces the **same Arena CTA** as tapping the DOM button (idempotent activation through both paths).

- **15-H.** The chibi cannot pass through any **collision AABB** declared in `home-field-map.json`. On a stop-on-collision event the chibi's `target` is cleared and `facing` updates to the closest cardinal direction.

- **15-I.** When `prefers-reduced-motion: reduce` matches or `player_settings.reduced_motion` is true, **all ambient animation loops freeze on their declared `stillFrameIndex`** and the chibi walk animation is replaced by an instant teleport to the target (no walk cycle, no camera lerp).

- **15-J.** Switching language **updates every hub text overlay** (chibi nameplate, hotspot labels, daily-limit pill, drawer tabs, Journey modal) **without reinitializing the Phaser scene**. World sprites, camera position, and chibi position are preserved.

- **15-K.** While the home-hub state machine is in `startingRun`, **duplicate Arena activation is debounced** — repeated taps/keypresses during the same `startingRun` are dropped. Server-side, only one `start-run` request fires per activation.

- **15-L.** When the home-field validator fails, the atlas fetch fails, or `HOME_FIELD_FORCE_FALLBACK=true`, the client renders the **legacy dashboard start/resume path** on the same route and logs `home_field_fallback` with `reason ∈ {schema, atlas, webgl, timeout, forced}`. The legacy path remains a real working code path through at least one release after general availability.

- **15-M.** `Telegram.WebApp.BackButton` is wired to the drawer/modal stack: it closes the Journey modal first, then any open drawer; otherwise it is hidden. `Telegram.WebApp.MainButton` is not used on the hub screen.

- **15-N.** Returning from a battle (run resolution or abandonment) lands the user **back on the hub**, not the legacy dashboard. The chibi spawns at the configured post-battle position (same as initial spawn in v1) and the hub re-fetches bootstrap so the daily-limit pill, mycelium, and roster reflect the run's outcome.

- **15-O.** Terrain art under `web/public/home-field/terrain/` must be authored as **reusable tilemap cells**, not full-screen illustrations, texture paintings, or cropped scene fragments. Each terrain PNG is exactly one declared tile cell (`256 x 256` in v1), viewed from the same orthographic/top-down game camera as the map, and must remain readable when repeated in a `3 x 3` grid. Terrain cells must avoid unique center focal points, horizons, character silhouettes, labels, UI, heavy micro-texture, or one-off props that would reveal a visible stamp when repeated.

- **15-P.** Every produced terrain tile requires a **repeatability proof** before its manifest status can move to `approved`: the asset must appear in the `/home-field-preview` map-backed screen, be included in the generated home-field contact sheet, and be visually checked as a repeated patch at mobile (`390 x 844`) and desktop (`1440 x 900`) sizes. Rejected art remains in `.agent/home-field-workspace/raw/`, candidate folders, or review output only; rejected terrain PNGs must not be committed under `web/public/home-field/terrain/`.

- **15-Q.** Path and border terrain cells must declare and preserve their **connector contract** in the prompt, metadata, and review notes. Horizontal paths connect through the same Y-band and width on the west/east edges; vertical destination connectors connect through the same X-band and width on north/south edges; edge fillers expose the blocked border on the intended side only. Props, gates, signs, lanterns, and collision landmarks stay on object/effect layers and are not baked into repeatable terrain tiles.

- **15-Q2.** Terrain compatibility must be modeled as explicit tile metadata before production art is generated. Every terrain asset declares a `tile` block with `terrainSet`, `placement`, and `connectors.{n,e,s,w}`. Adjacent map tiles are production-valid only when touching connector tokens match or an explicit transition/end tile bridges the mismatch. Mid-path tiles must not visually terminate into grass; grass tiles must not secretly contain path/blocker edges.

- **15-Q3.** Production terrain approval requires the strict connector gate to pass: `npm run game:home-field:validate -- --check-connectors`. It also requires the terrain edge-profile heuristic (`--check-edge-profiles`) to pass or be explicitly overridden by human visual review with the adjacency sheet cited. These gates may fail during proof-map iteration while transition assets are missing, but they must pass or be adjudicated before any terrain batch can be marked `approved` or used as the production home-field map.

- **15-Q4.** Path, destination-row, and border terrain must be generated and reviewed as **families**, not unrelated isolated images. A path family review includes the full connector run (`path_h_end_w | path_dirt_straight | path_spore_glow | path_h_end_e`) plus any destination-row ends needed by the map. A border family review includes repeated side stacks and corner/transition pieces when the map requires them. A family fails if its members use different camera, palette, lighting, scale, or edge-band reads, even when each individual tile passes file validation.

- **15-R.** The painterly forest style is achieved through **quiet repeatable terrain plus separate object-layer foliage**, not by baking large bush silhouettes into grass tiles. Grass terrain may include low-contrast color variation, tiny sprouts, and soft texture only; large bush masses, readable leaf clusters, glowing spores, mushrooms, gates, and collision landmarks must be authored as prop/exit/effect assets placed by `home-field-map.json`.

- **15-S.** Home-field asset states are explicit: `missing`, `generated`, `needs_review`, `rejected`, `approved`, and `placeholder`. `placeholder` means layout/technical proof only, whether generated deterministically or by tooling; it is **not production-ready art** and must never be treated as final. Moving an asset to `approved` requires explicit human visual approval against the locked style anchor: it must look like hand-authored game art, not a procedural placeholder, developer sketch, visible math pattern, or generic AI texture.

- **15-T.** Production home-field review happens at three scales before `approved`: isolated asset, repeated contact-sheet patch, and composed `/home-field-preview` screenshot with grid/debug labels ignored. A terrain tile fails if it is merely structurally repeatable but visually weak; a prop fails if it lacks a clean transparent silhouette, soft game-art shading, or scale consistency with the chibi and exits.

- **15-U.** Imagegen outputs are **candidate evidence** until human approval. Candidate terrain, props, exits, effects, and chibi spritesheets must be written under `.agent/home-field-workspace/candidates/.../latest/` and rendered into preview screenshots via candidate routing. Generated candidates must not overwrite `web/public/home-field/**`, atlas files, or app-facing character spritesheets before explicit human approval.

- **15-V.** Production approval must be bound to exact evidence, not only prose. Each approved review row must identify the candidate root reviewed and the exact PNG/review evidence used for approval, including source and candidate output checksums where available plus mobile/desktop clean field screenshot evidence. If a candidate is regenerated, earlier review decisions are stale until the new output is revalidated and reviewed.

- **15-W.** Final production sign-off requires a **combined clean-scene proof** that renders the latest approved-or-candidate terrain, object-layer props/exits, effects where relevant, and selected chibi together at mobile and desktop sizes. Single-family sheets remain required, but they are not enough: terrain, props, and chibi must read as one coherent top-down field with consistent scale, camera, palette, shadow direction, and visual priority.

- **15-X.** Home Field chibi approval is blocked unless the sprite satisfies the canon-facing chibi requirements in `docs/design-requirements.md` Section 11 and the Stage 1 chibi contract. A mechanically valid spritesheet is not enough: candidates that read as pixel art, a tiny beige featureless doll, a busy ornate fantasy sprite, a generic elf, a straight portrait sticker, a realistic doll photo/toy render, a static fake-walk sheet, a baked-shadow sprite, or a human with a mushroom hat must be marked `rejected`/`needs_regen`, excluded from active-scene production validation, and regenerated as candidate-only evidence before roster expansion.
