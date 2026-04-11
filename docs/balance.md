# Mushroom Master — Game Balance Notes

This document describes the tunable constants that control game feel, the design rationale behind each decision, and a log of balance issues that have been reported and how they were handled.

The goal is to keep the game **competitive but not punishing** — a duel between two players that produces a clear winner within 9 rounds without feeling either grindy or luck-dependent.

---

## 1. Core Game Loop

A **game** (Русский: *Игра*) is a single run between two players (or a player and ghosts/bots). It consists of up to 9 **rounds** (*Раунды*). Each round is a 1v1 **battle** that resolves in up to 120 combat **steps** (*Ходы*).

```
Game = up to 9 Rounds = up to 9 × 120 Steps
```

Terminology — used consistently in code and UI:

| Concept | Code name | UI (RU) | UI (EN) | Meaning |
|---------|-----------|---------|---------|---------|
| **Game** | `game_run` | Игра | Game | Full run of up to 9 rounds |
| **Round** | `round_number` / `currentRound` | Раунд | Round | One 1v1 duel inside a game |
| **Step** | `step` | Ход | Step | One combat turn inside a battle |

---

## 2. Balance Constants

All constants live in [app/server/game-data.js](../app/server/game-data.js).

| Constant | Value | Meaning |
|----------|-------|---------|
| `MAX_ROUNDS_PER_RUN` | **9** | Rounds before the game is force-ended at max rounds |
| `STARTING_LIVES` | **5** | A player is eliminated after losing 5 rounds |
| `STEP_CAP` | **120** | Combat steps before a battle is decided by HP percentage |
| `MAX_ARTIFACT_COINS` | **5** | Per-round income ceiling (matches `ROUND_INCOME[0]`) |
| `SHOP_OFFER_SIZE` | **5** | Items in the shop each round |
| `ROUND_INCOME` | `[5, 5, 5, 6, 6, 7, 7, 8, 8]` | Coins awarded at the start of each round |
| `GHOST_BUDGET_DISCOUNT` | **0.12** | Ghost opponents get 12% less budget than the player |
| `MAX_STUN_CHANCE` | **35** | Hard cap on stun % (prevents lock-down builds) |
| `DAILY_BATTLE_LIMIT` | **10** | Max games started per player per day |

### Why 9 rounds and 5 lives?

A 9-round game with 5 lives gives a deterministic winner: the player who wins the majority of rounds wins the duel. A player must lose 5 times before being eliminated, which is mathematically possible but should be uncommon (see grace period below).

With 5 lives, **both players are guaranteed to play at least 5 rounds** even if they lose every one — leaving 4 remaining rounds where the lead can swing. This gives the "losing" side real comeback opportunities.

### Why coin income scales (5→8)?

Each round the coin floor grows, letting players buy stronger artifacts as the game progresses. This is the natural "power curve" of the game — round 9 fights are noticeably more expensive than round 1.

Cumulative income table:

| Round | Income | Cumulative |
|-------|--------|-----------|
| 1 | 5 | 5 |
| 2 | 5 | 10 |
| 3 | 5 | 15 |
| 4 | 6 | 21 |
| 5 | 6 | 27 |
| 6 | 7 | 34 |
| 7 | 7 | 41 |
| 8 | 8 | 49 |
| 9 | 8 | 57 |

---

## 3. Ghost Opponent Budget Rules

See [run-service.js](../app/server/services/run-service.js) — `resolveRound()` → ghost budget calculation.

In a solo run, when the player lacks a real opponent, the system generates a **ghost** snapshot. Ghost difficulty is controlled by a budget — the total coin cost of artifacts the ghost carries. The budget uses a multi-step formula designed to prevent both walkovers and unwinnable matches.

### Formula

```js
const playerSpent = sum of artifact prices in player's current loadout;
const cumulativeIncome = ROUND_INCOME[0..roundNumber];
const graceFactor =
  roundNumber === 1 ? 0.7 :
  roundNumber === 2 ? 0.85 :
  1.0;

const base = min(playerSpent, cumulativeIncome) * (1 - GHOST_BUDGET_DISCOUNT);
const ghostBudget = max(3, floor(base * graceFactor));
```

### Why this formula?

Each piece of the formula fixes a specific past issue:

1. **`playerSpent`** — base the budget on what the player has *actually invested* in their loadout, not their leftover coins. A saver shouldn't face tougher ghosts for holding back; an aggressive buyer shouldn't face pushovers.
2. **`min(playerSpent, cumulativeIncome)`** — caps the ghost so it can never exceed the cumulative income curve. Prevents an outlier snapshot from a heavy-spending veteran from appearing in round 1.
3. **`(1 - GHOST_BUDGET_DISCOUNT)`** — ghost always gets 12% less than the player. Power fantasy tilt, so the average player wins more than 50% of fair matchups.
4. **`graceFactor`** — rounds 1 and 2 are "learning rounds". Ghost budget is 70% / 85% of normal, giving the player a clear advantage while they learn the game.
5. **`max(3, …)`** — a floor of 3 coins ensures the ghost can always afford at least one item (no zero-item opponents).

### Expected behavior

- **Round 1**: ghost has ~40-50% of the player's power. Most players should win.
- **Round 2**: ghost has ~70% of the player's power. Most players should still win.
- **Round 3+**: ghost matches the player's investment curve (with the 12% tilt).
- **Round 9**: cumulative max budget is 50 coins — serious end-game fights.

---

## 4. Starter Loadout

See [player-service.js](../app/server/services/player-service.js) — `selectActiveMushroom()`.

When a new player picks their first mushroom, the server auto-seeds a **full 5-coin starter loadout** respecting the mushroom's affinity. This is implemented by running the bot loadout generator (`createBotLoadout`) with the player's chosen mushroom and the 5-coin budget.

### Why auto-seed the starter?

Originally new players started with an arbitrary 2-item loadout (2 coins spent), which meant:
- The grid was 66% empty
- Round 1 ghosts scaled to 2 coins — but ghosts roll *synergistic* items while a hand-picked 2-item starter is mixed
- Players frequently lost round 1 by bad luck and felt the game was unfair from the start

The starter loadout fix:
- Spends the full 5-coin budget on affinity-weighted items
- Fills more grid cells so the player sees what a "complete" loadout looks like
- Makes the round 1 matchup genuinely fair (both sides have 5-coin synergistic builds, but player gets the 12% + grace-factor tilt)

### Preservation across character switches

`selectActiveMushroom()` only seeds a starter loadout if no loadout exists yet. Switching characters mid-game preserves the existing loadout (since the player may have carefully built it). If you want to restart, abandon the run and create a new character.

---

## 5. Lives, Rounds, and Elimination

- A player loses **1 life per round they lose** (not per combat step).
- Lives start at `STARTING_LIVES = 5`.
- When a player reaches 0 lives, the game ends with `end_reason = 'max_losses'`.
- When a player completes `MAX_ROUNDS_PER_RUN = 9` rounds without elimination, the game ends with `end_reason = 'max_rounds'`.

### Why lives and not HP?

The "loss counter" model is simpler to explain and display than a damage-scaling HP pool. The grace period (rounds 1-2 easier ghosts) serves the same purpose as Backpack Battles' "early rounds cost less HP": new players aren't punished for unlucky early rolls.

---

## 6. Battle Step Cap

`STEP_CAP = 120` means a battle can run up to 120 combat steps before being decided by HP percentage. This was raised from 12 (too low — many builds hit the cap without a decisive winner) to 120 (roomy enough that step-cap endings are rare in normal play).

When a battle ends via step cap (not death), the replay log and result show **"Лимит ходов исчерпан — X побеждает по здоровью"** ("Step limit reached — X wins on health") to make the tiebreak explicit.

---

## 7. Coin & Shop Rules

- **Purchase cost**: each artifact has a fixed price (1, 2, or 3 coins).
- **Shop refresh**: 1 coin for the first 3 refreshes per round, then 2 coins.
- **Sell refund**: full price if sold in the same round purchased, else half (floor).
- **Non-empty bags** cannot be sold — must first empty them.
- **Carry-over**: unspent coins roll into the next round.

---

## 8. Opponent Mushroom Selection

Ghost opponents cycle through a **round-robin** of the 4 non-player mushrooms per game. This is shuffled once per game (seeded by `gameRunId`) and then cycled by round number, so each opponent mushroom is seen before any repeats.

```js
opponentMushroomIds = mushrooms.filter(m => m.id !== playerMushroomId);
shuffledOrder = shuffle(opponentMushroomIds, seed: gameRunId);
opponentThisRound = shuffledOrder[(roundNumber - 1) % 4];
```

This guarantees variety and prevents the player from fighting the same character twice in 4 rounds. Originally opponents were picked by pure RNG per round, which led to "every opponent is Morga" streaks.

---

## 9. Balance Issues Reported & Handled

### Issue #1: Player loses every round from round 1

**Symptom:** Player with default 2-item starter loadout faces Thalla/Morga ghosts with synergistic 2-coin builds. Loses all 5 rounds in a row. Game ends with 0 wins.

**Root cause:** Ghost budget scaled to `playerSpent * 0.88` with no grace period or cumulative cap. Starter loadout was only 2 coins (40% of budget).

**Fix:**
1. Added grace factor (0.7/0.85/1.0) for rounds 1-3
2. Added cumulative income cap to prevent outlier ghosts
3. Auto-seed a full 5-coin starter loadout on first character pick
4. Lowered the minimum ghost budget floor from 5 to 3 coins

**Files changed:** [run-service.js](../app/server/services/run-service.js), [player-service.js](../app/server/services/player-service.js), [bot-loadout.js](../app/server/services/bot-loadout.js)

### Issue #2: Ghost opponent was always Morga (or Thalla)

**Symptom:** Repeated fights against the same mushroom, especially Morga. Felt unfair and predictable.

**Root cause:** Per-round RNG was picking mushrooms independently, leading to unlucky streaks. Also, DB lookup for existing snapshots didn't filter by target mushroom, so it returned whatever random player's snapshot first.

**Fix:** Round-robin opponent selection, seeded by `gameRunId`, excluding the player's own mushroom. Each of the 4 opponent mushrooms appears once before any repeats.

**Files changed:** [run-service.js](../app/server/services/run-service.js) — `getRunGhostSnapshot`

### Issue #3: Battle ends with both sides alive ("10/100")

**Symptom:** Replay showed the loser with non-zero HP at battle end. Players thought damage wasn't applied.

**Root cause:** `STEP_CAP = 12` was too low. Many battles hit the cap and were decided by HP percentage tiebreak.

**Fix:**
1. Raised `STEP_CAP` from 12 to 120
2. Added `endReason: 'step_cap' | 'death'` to the battle_end event
3. Replay log shows "Step limit reached — X wins on health" for step-cap endings

**Files changed:** [game-data.js](../app/server/game-data.js), [battle-engine.js](../app/server/services/battle-engine.js), [replay/format.js](../web/src/replay/format.js)

### Issue #4: Legacy 5-coin budget rejected round-2+ loadouts

**Symptom:** Signal ready / save loadout returned 500 "Loadout exceeds 5-coin budget" in round 2+ after the player accumulated items.

**Root cause:** `validateLoadoutItems` enforced a hard 5-coin cap from the legacy single-battle shop, but game runs earn income each round.

**Fix:** Budget for game run loadouts now scales with the current round:

```js
budget = activeRun ? sum(ROUND_INCOME[0..currentRound]) : MAX_ARTIFACT_COINS;
```

**Files changed:** [create-app.js](../app/server/create-app.js), [battle-service.js](../app/server/services/battle-service.js) — `getActiveSnapshot`

### Issue #5: Bags broke grid placement rules

**Symptom:** Bags were placed on the base grid as normal artifacts, taking up cells that should hold combat items.

**Fix:** Bags no longer occupy grid cells. They add *extra rows* below the base grid, which hold 1×1 artifacts tagged with `bagId`. See [artifact-board-spec.md](./artifact-board-spec.md) Section 3 for the full bag system.

---

## 10. Tuning Guide

When the game feels off, check these levers in order of impact:

1. **`ROUND_INCOME`** — the most powerful lever. Lowering round 1-2 income slows early snowball; raising late-round income speeds up the end-game.
2. **`GHOST_BUDGET_DISCOUNT`** — raise to tilt the game toward the player (more wins), lower toward 0 for competitive parity.
3. **Grace factors** in `getRunGhostSnapshot` — controls round 1-2 difficulty independently.
4. **`STARTING_LIVES`** — more lives = longer games, more comeback room, but may feel grindy.
5. **`MAX_ROUNDS_PER_RUN`** — shorter games feel snappier; longer games give more strategic depth.
6. **Artifact prices / bonuses** in [game-data.js](../app/server/game-data.js) — character balancing by buffing/nerfing specific items.

**Principle:** change one lever at a time and observe. Never rebalance multiple interacting systems in a single change without playtesting.

---

## 11. Desired Win Rates (Target Metrics)

When we add telemetry, track these numbers per game:

| Metric | Target | Action if below/above |
|--------|--------|----------------------|
| Round 1 win rate | 60-70% | Too low → raise grace factor. Too high → reduce it. |
| Round 5 win rate | 50-55% | Too low → buff starter. Too high → buff ghosts mid-game. |
| Games ending round 5 (5 losses) | <20% | Too high → raise starting lives or grace factors. |
| Games ending round 9 (max rounds) | 30-40% | Too low → STEP_CAP rebalance or ghost power curve. |
| Average rounds per game | 7-8 | Too low → game is too punishing. Too high → too grindy. |

Without telemetry we can't verify these, but they're the numbers to aim for based on roguelike autobattler conventions.
