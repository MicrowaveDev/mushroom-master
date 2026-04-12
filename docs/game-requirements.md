# Game Requirements

**Type:** Authoritative behavioral spec.
**Scope:** What the game does, not how it's built. Every rule here is
testable: if the game violates a rule, it's a bug.

Last verified against code: 2026-04-12.

---

## 1. Game Structure

- A **game run** consists of up to **9 rounds** (`MAX_ROUNDS_PER_RUN`).
- Each round is a 1v1 battle that ends on death or after at most **120 combat steps** (`STEP_CAP`); most battles end well before the cap.
- The player starts with **5 lives** (`STARTING_LIVES`).
- The player loses **1 life per round lost** (not per step).
- The run ends when lives reach 0 (`end_reason = 'max_losses'`) or all 9 rounds complete (`end_reason = 'max_rounds'`).
- The player may abandon the run at any time (`end_reason = 'abandoned'`).
- Only **one active game run per player** at a time.
- Max **10 game starts per player per day** (`DAILY_BATTLE_LIMIT`).

---

## 2. Inventory & Grid

- The base inventory grid is **3 columns × 3 rows = 9 cells** (`INVENTORY_COLUMNS × INVENTORY_ROWS`).
- Bags expand available slots beyond the base grid.
- Items in the **container** (purchased but unplaced, position `(-1,-1)`) do not contribute combat stats.
- Only **grid-placed** and **bag-placed** items contribute to battle stats.
- Container capacity is unlimited (limited only by coins).

---

## 3. Starter Preset

- Every character has a **2-item signature preset** defined in `STARTER_PRESETS`.
- Preset items are placed at `(0,0)` and `(1,0)` on round 1.
- Preset items are **free** — they do not cost coins from round income.
- Preset items **never appear in shop rolls** or ghost loadouts (filtered by `starterOnly` flag).
- Ghost opponents **also receive** their character's preset on top of bought items.

| Mushroom | Signature item | Existing item |
|---|---|---|
| Thalla | Spore Lash (stun: +4% stun, +1 dmg) | Spore Needle (+2 dmg) |
| Lomie | Settling Guard (armor: +2 armor) | Bark Plate (+2 armor) |
| Axilin | Ferment Phial (damage: +2 dmg, +1 spd) | Sporeblade (+3 dmg) |
| Kirt | Measured Strike (damage: +1 dmg, +1 armor) | Moss Ring (+1 dmg, +1 armor) |
| Morga | Flash Cap (stun: +6% stun, +1 dmg) | Haste Wisp (+1 spd) |

---

## 4. Economy

### Round Income

Coins awarded at the start of each round:

| Round | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Income | 5 | 5 | 5 | 6 | 6 | 7 | 7 | 8 | 8 |

- Unspent coins carry forward to the next round.
- Round income is added to the player's coin pool at round transition.

### Shop

- Each round offers **5 items** (`SHOP_OFFER_SIZE`).
- Artifact prices: **1, 2, or 3** coins (determined per artifact in `game-data.js`).
- Shop offer **persists across page refreshes** — no free re-roll.
- Manual refresh cost: **1 coin** for refreshes 1–3 in the round, **2 coins** for refresh 4+ (resets each round).
- First refresh is **not free**.
- Refresh count limited only by available coins.

### Selling

- Sell an item in the **same round** it was purchased: **full price** refund.
- Sell an item in a **later round**: **half price** (rounded down, minimum 1).
- Non-empty bags **cannot be sold** — empty them first.

### Budget Validation

- The coin-budget validator sums **all items** including preset items.
- The budget ceiling for validation is `cumulative_round_income + preset_cost`.
- This applies to both player loadouts (at ready/resolve time) and ghost loadouts.

---

## 5. Bags

- Bags are special artifacts that add inventory expansion beyond the base grid.
- **Moss Pouch**: 1×2, price 2, 2 slots.
- **Amber Satchel**: 2×2, price 3, 4 slots.
- Bags appear in the shop via escalating probability:
  - Base chance per slot: **15%** (`BAG_BASE_CHANCE`).
  - Escalation per bagless round: **+8%** (`BAG_ESCALATION_STEP`).
  - Hard pity: bag guaranteed at **5 consecutive bagless rounds** (`BAG_PITY_THRESHOLD`).
- `roundsSinceBag` initializes at **1** (not 0) so bags appear sooner in short runs.
- Bags do not contribute combat stats.

---

## 6. Combat Mechanics

### Step Resolution

1. Each step, one combatant acts, then (if alive) the other acts.
2. Action order determined by **speed** stat. Ties broken by: Morga's tie-break passive → base speed → random 50/50.
3. **Damage dealt** = `max(1, attacker_attack + buffs − defender_armor)`.
4. Armor-ignore abilities (e.g. Kirt's Clean Strike) reduce effective armor before the formula.
5. **Stun check** after damage: `stunChance = artifact_stun% + ability_bonus%`, capped at **35%** (`MAX_STUN_CHANCE`).
6. If stunned, the defender skips their next action; the stun flag clears after one skip.
7. Battle ends on **death** (0 HP) with `endReason = 'death'`.
8. Battle ends at **step 120** with `endReason = 'step_cap'`; winner is the side with higher HP%.
9. Combat is fully **server-side** and does not depend on client connection.

### Character Abilities

| Mushroom | Passive | Active |
|---|---|---|
| **Thalla** | After successful stun → next hit +2 damage | Spore Lash: normal attack + 5% additive stun chance |
| **Lomie** | First incoming hit reduced by 3 after armor | Settling Guard: +2 temporary armor for next incoming hit |
| **Axilin** | Every 3rd successful hit → +3 damage | Ferment Burst: +2 damage, then −1 defense rest of battle |
| **Kirt** | If not stunned on previous enemy turn → +1 speed | Clean Strike: attack ignores 2 points of enemy armor |
| **Morga** | First action in battle → +4 damage | Flash Cap: breaks speed ties in her favor, +10% stun chance |

### Base Stats

| Mushroom | HP | ATK | SPD | DEF | Style |
|---|---|---|---|---|---|
| Thalla | 100 | 11 | 7 | 2 | Control |
| Lomie | 125 | 9 | 4 | 5 | Defensive |
| Axilin | 90 | 15 | 8 | 1 | Aggressive |
| Kirt | 105 | 12 | 6 | 3 | Balanced |
| Morga | 85 | 13 | 10 | 0 | Aggressive |

---

## 7. Ghost Opponents (Solo Mode)

- Ghost opponents are selected via **round-robin**: the 4 non-player mushrooms are shuffled once per run (seeded by `gameRunId`) and cycled by round number.
- Each mushroom is seen before any repeats; the player's own mushroom is **excluded**.
- Ghost receives **its character's starter preset** (same as the player).
- Ghost shop-spend budget formula:
  - `playerSpent` = sum of artifact prices in the player's loadout
  - `cumulativeIncome` = sum of `ROUND_INCOME[0..roundNumber]`
  - `graceFactor` = 0.7 (round 1), 0.85 (round 2), 1.0 (round 3+)
  - `base` = min(`playerSpent`, `cumulativeIncome`) × (1 − `GHOST_BUDGET_DISCOUNT` [0.12])
  - `ghostBudget` = max(3, floor(`base` × `graceFactor`))
- Ghost budget floor is always **3 coins** (enough for at least one cheap item).
- Ghost items are weighted by mushroom affinity: strong family = 5×, medium = 3×, weak = 1×.
- Ghost snapshots from completed real-player rounds are saved and can be encountered by other players; a player's own past loadouts are excluded.
- Ghost snapshots are retained for **14 days**; older ones are pruned.

---

## 8. Challenge Mode

- Friend challenges create a **shared game run** where both players face each other every round.
- Both players must **signal ready** before a round begins (SSE-synced).
- Both players receive the **same round income independently**.
- If one player hits 5 losses, the other player wins the run.
- Rating is updated **once at run end** using aggregate W/L record (batch Elo), not per-round.
- Challenge invitations expire after **1 hour** if not accepted; the inviter's run slot is released.
- Read isolation: player A **cannot see** player B's coins or loadout except through the explicit ghost-snapshot projection after round resolve.

---

## 9. Rewards

### Per-Round Rewards (game run)

| Outcome | Spore | Mycelium |
|---|---|---|
| Win | +2 | +15 |
| Loss | +1 | +5 |

### Completion Bonus (at run end)

| Total Wins | Spore | Mycelium |
|---|---|---|
| 0–2 | 0 | 0 |
| 3–4 | +5 | +2 |
| 5–6 | +10 | +5 |
| 7–9 | +20 | +10 |

### Challenge Mode Winner Bonus

The winning player in a challenge run receives an additional **+10 spore, +5 mycelium**.

### Legacy Single-Battle Rewards

| Outcome | Spore | Mycelium |
|---|---|---|
| Win | +10 | +100 |
| Loss | +3 | +10 |
| Draw | +5 | +40 |

---

## 10. Rating

- **Solo mode**: Elo updated per round. Each round is an independent rating event.
- **Challenge mode**: batch Elo update at run end using aggregate W/L record.
- **Rating floor**: 100 (`RATING_FLOOR`). Rating never drops below this.
- On abandon: solo = per-round changes already applied; challenge = batch Elo computed on current W/L record.

---

## 11. Round Transition (Copy-Forward)

- At the end of each round, all loadout items from round N are copied to round N+1:
  - `fresh_purchase` is reset to `0` (for refund calculation — items bought in round N are no longer "fresh" in N+1).
  - `purchased_round` is **preserved** (tracks original purchase round for graduated refunds).
- New coins are added: `coins += ROUND_INCOME[roundNumber]`.
- A new 5-item shop offer is generated.
- Shop `refresh_count` resets to 0.

---

## 12. Disconnection & Reconnection

- If a player disconnects, they see a reconnection popup on return.
- If combat completes while disconnected, the player is advanced to the result phase on reconnect.
- If reconnection fails within the timeout, the run is abandoned.
- Shop offer, loadout, and all run state are server-authoritative and survive page refreshes.

---

## 13. Replay

- Every battle produces a deterministic replay that can be re-watched.
- Replays are accessible from the round-result screen and from the battle history list.
- During an active game run, the post-replay button must show **"Продолжить"** (continue to next round), not "Домой" (home).
- Outside a game run (standalone replay from history), the post-replay button shows **"Домой"**.
