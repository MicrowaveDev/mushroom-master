# User Flows

**Type:** Authoritative screen-flow spec for E2E test coverage.
**Scope:** What the user sees, does, and expects at each step. Every flow
is a testable sequence: if a step's assertions fail, it's a bug.

Each step has:
- **Screen** — the `state.screen` value and the Vue component rendering it
- **Above the fold (mobile)** — elements visible on mobile (~375×667) without scrolling. This is the primary viewport (Telegram Mini App). If a critical action or info is missing above the fold, the user can't proceed without discovering they need to scroll.
- **Desktop note** — added only when the desktop viewport (~1280×800) shows a meaningfully different fold. Omitted when desktop sees the same or strictly more content.
- **Sees** — all visible elements an E2E test must assert exist (including below fold)
- **Action** — what the user does (click, drag, type)
- **Expected** — assertions after the action, before the next step

E2E tests must capture screenshots at **both viewports** at each major screen:
- Mobile: `page.setViewportSize({ width: 375, height: 667 })`
- Desktop: `page.setViewportSize({ width: 1280, height: 800 })`

Screenshot paths below are relative to `.agent/tasks/telegram-autobattler-v1/raw/`.
Steps marked `(not yet captured)` need e2e coverage added.

Requirement IDs (e.g. `[Req 1-A]`) link to [game-requirements.md](./game-requirements.md).

Last verified against code: 2026-04-12.

---

## Flow A: First Launch (New Player)

```
Step 1: Auth Screen
  Screen: auth → AuthScreen.js
  Screenshot: screenshots/01-auth-gate.png
  Above the fold (mobile):
    - Navbar title "Мицелиум: автобаттлер"
    - Hero heading "Арена грибов ждёт"
    - 3 overlapping character portraits
    - Tagline + feature list (3 bullets)
    - First login button partially visible
  Desktop note: All login buttons + language toggle visible without scroll
  Sees:
    - Navbar title "Мицелиум: автобаттлер"
    - Hero heading "Арена грибов ждёт" / "The mushroom arena awaits"
    - Language toggle (RU / EN)
    - Login buttons (Telegram / browser code / dev)
  Action: Click login button

Step 2: Onboarding
  Screen: onboarding → OnboardingScreen.js
  Screenshot: screenshots/onboarding-mobile.png, screenshots/onboarding-desktop.png
  E2E: coverage-gaps.spec.js — onboarding flow + dual-viewport screenshots
  Condition: No activeMushroomId in bootstrap
  Above the fold (mobile):
    - Walkthrough heading + first step description
    - Mushroom roster preview (2-3 portraits)
  Sees:
    - 3-step walkthrough (pick mushroom → build loadout → battle)
    - Mushroom roster preview
  Action: Click continue
  Expected: Navigate to characters screen

Step 3: Character Select
  Screen: characters → CharactersScreen.js
  Screenshot: screenshots/03-characters.png
  Above the fold (mobile):
    - First 2 mushroom cards in 2-column grid (portrait, name, style tag, stats)
  Desktop note: All 5 cards visible in wider grid without scroll
  Sees:
    - 5 mushroom cards (portrait, name, style tag, HP/ATK/SPD stats)
  Action: Click a mushroom card (e.g. Thalla)
  Expected:
    - [Req 3-A] selectActiveMushroom seeds 2-item starter preset (first pick)
    - Navigate to home screen
```

---

## Flow B: Solo Game Run (Main Loop)

```
Step 1: Home Screen
  Screen: home → HomeScreen.js
  Screenshot: screenshots/run/solo-01-home-start-game.png
  Above the fold (mobile):
    - Active mushroom portrait + level
    - "Начать Игру" / "Start Game" button (or "Продолжить игру" / resume if active run)
    - Spore count
    - First 1-2 battle history entries
  Desktop note: Friends list + leaderboard also visible (side columns)
  Sees:
    - Active mushroom portrait + level
    - "Начать Игру" / "Start Game" button
    - Spore count
    - Battle limit (X / 10)
    - Recent battle history (up to 5)
    - Friends list (up to 3) + challenge buttons
    - Leaderboard (top 5)
  Action: Click "Start Game"
  Expected:
    - [Req 1-G] Only one active run allowed; button disabled if run exists
    - [Req 1-H] Rejected if daily limit (10) reached
    - startNewGameRun('solo') called
    - Navigate to prep screen

Step 2: Prep Screen (Round N)
  Screen: prep → PrepScreen.js
  Screenshot: screenshots/run/solo-02-prep-round1.png (round 1), screenshots/run/solo-05-prep-round2.png (round 2)
  Condition: state.gameRun exists
  Above the fold (mobile):
    - Round HUD: "Раунд N" / "Round N"
    - Stats HUD: Wins W, Lives L, Coins C
    - Container zone header
    - Top portion of inventory grid (first 1-2 rows)
  Below fold on mobile (scroll required):
    - Full inventory grid, shop items, sell zone, Ready/Abandon buttons
  Desktop note: Inventory + shop visible side-by-side; Ready button visible without scroll
  Sees:
    - Round HUD: "Раунд N" / "Round N"
    - Stats HUD: Wins W, Lives L, Coins C
    - [Req 2-A] Inventory grid (3×3 = 9 cells)
    - [Req 3-A, 3-B] Round 1: 2 preset items at (0,0) and (1,0)
    - Container zone (purchased but unplaced items)
    - [Req 4-D] Shop with 5 items + prices
    - [Req 4-G] Refresh button with cost label (1 or 2 coins)
    - Sell zone (drag target)
    - "Готов" / "Ready" button
    - "Покинуть" / "Abandon" button
  Action: Buy items from shop, arrange on grid, click "Ready"
  Expected:
    - [Req 4-E] Coins deducted per item price on buy
    - [Req 4-F] Shop offer persists across page refresh
    - [Req 4-J] Selling same-round item returns full price
    - [Req 4-K] Selling older item returns half price
    - signalReady() called → POST /api/game-run/:id/ready
    - Navigate to replay screen (automatic)

Step 3: Battle Replay (auto-loaded after ready)
  Screen: replay → ReplayScreen.js
  Screenshot: screenshots/06-replay.png (mid-replay), screenshots/07-replay-complete.png (finished)
  Condition: state.currentBattle loaded automatically after signalReady
  Above the fold (mobile):
    - Battle stage (two fighter cards with portraits, names, HP bars)
    - Speed controls (▶ ▶▶ ▶▶▶)
  Below fold on mobile (scroll required):
    - Combat event log entries
    - Continue/Home button (appears after replay finishes)
  Desktop note: Battle stage + event log + button all visible without scroll
  Sees:
    - Two fighter cards (left = player, right = opponent)
    - Each card: mushroom portrait, name, HP bar (current / max)
    - [Req 7-C] Ghost opponent has its own character preset + bought items
    - Replay speed controls (▶ ▶▶ ▶▶▶)
    - Step-by-step combat log (scrollable, clickable entries)
    - [Req 6-I] Combat fully server-resolved, replay is read-only
  Action: Watch replay auto-play (or adjust speed / click log)
  Expected:
    - [Req 13-A] When replay finishes AND state.gameRun exists:
      button shows "Продолжить" / "Continue" (NOT "Домой")
    - When replay finishes AND no gameRun (standalone):
      button shows "Домой" / "Home"
  Action: Click "Continue"
  Expected:
    - If run still active (lives > 0, rounds < max):
      [Req 11-A] Round N items copied forward to N+1
      [Req 4-C] Coins += ROUND_INCOME[N+1]
      [Req 11-C] New shop offer generated, refresh count reset
      Navigate back to Step 2 (prep) for next round
    - If run ended: Navigate to Step 4b (run complete)
  Note: Round result screen (Step 4a) is accessible via "View Replay" from
  battle history but is NOT shown in the normal ready→replay→prep flow.

Step 4b: Run Complete (run ended)
  Screen: runComplete → RunCompleteScreen.js
  Screenshot: screenshots/run/solo-09-run-complete.png
  Condition: run status = 'completed' or 'abandoned'
  Above the fold (mobile + desktop):
    - Entire card visible — heading, end reason, stats, Home button
    - No scroll needed on either viewport; compact screen
  Sees:
    - "Игра завершена" / "Game Complete" heading
    - End reason: "Все жизни потеряны" / "Максимум раундов" / "Покинуть" (t.eliminated / t.maxRounds / t.abandonRun)
    - [Req 1-E] End reason matches: max_losses (0 lives) or max_rounds (9 rounds)
    - Final stats: total wins, rounds completed
    - [Req 9-B] Completion bonus (if any) based on total wins — spore + mycelium
    - "Домой" / "Home" button
  Action: Click "Home"
  Expected:
    - state.gameRun cleared to null
    - Navigate to home screen
```

---

## Flow C: Challenge Mode

Screenshots: `screenshots/challenge/` directory (not yet captured — challenge-run.spec.js tests the flow but screenshots need a passing dual-player run)

```
Step 1: Send Challenge
  Screen: home → HomeScreen.js
  Action: Click "Challenge" next to a friend
  Expected:
    - createFriendChallenge() called
    - [Req 8-F] Challenge created with 1-hour expiry

Step 2: Accept Challenge (other player)
  Screen: home → HomeScreen.js
  Sees:
    - Pending challenge banner with Accept / Decline buttons
  Action: Click "Accept"
  Expected:
    - [Req 8-A] Shared game run created for both players
    - Both players navigate to prep screen

Step 3: Challenge Prep
  Screen: prep → PrepScreen.js
  Sees:
    - Same as Flow B Step 2
    - [Req 8-B] Ready button; must wait for opponent to also ready
    - Opponent ready status indicator (SSE-driven)
  Action: Click "Ready"
  Expected:
    - [Req 8-B] Both must signal ready before round resolves
    - [Req 8-G] Cannot see opponent's coins or loadout
    - Round resolves when both ready → replay

Step 4: Challenge Resolution
  Same as Flow B Steps 3–4, except:
    - [Req 8-D] If one player hits 5 losses, the other wins
    - [Req 8-E] Rating updated once at run end (batch Elo), not per round
    - [Req 9-C] Winner receives +10 spore, +5 mycelium bonus
```

---

## Flow D: Legacy Single Battle

**Status:** Active but superseded by game runs (Flow B). Kept for backward
compatibility — the ArtifactsScreen/BattlePrepScreen/ResultsScreen path still
works. No requirement IDs exist for the legacy flow except `[Req 9-D]` (rewards).
Consider deprecating once game runs cover all use cases.

```
Step 1: Home Screen
  Action: Select mushroom → navigate to artifacts screen

Step 2: Artifacts Screen (Legacy Shop)
  Screen: artifacts → ArtifactsScreen.js
  Screenshot: screenshots/04-artifacts.png
  Above the fold (mobile):
    - Coin budget display (5 coins)
    - Container header + items
    - Top of inventory grid (1-2 rows)
  Below fold on mobile (scroll required):
    - Full grid, shop section, Save button
  Desktop note: Inventory + shop visible side-by-side; Save button visible
  Sees:
    - 5-coin budget display
    - Container + inventory grid
    - Legacy shop (reroll costs from budget, not round income)
    - "Сохранить" / "Save" button
  Action: Arrange loadout, click "Save"
  Expected: Navigate to battle prep

Step 3: Battle Prep
  Screen: battle → BattlePrepScreen.js
  Screenshot: screenshots/05-battle-prep.png
  Above the fold (mobile + desktop):
    - Mushroom portrait + name + stats
    - Loadout grid with stat totals
    - "Start Battle" button visible
    - Compact screen; no scroll needed on either viewport
  Sees:
    - Active mushroom portrait + stats
    - Current loadout grid with stat totals
    - "Начать битву" / "Start Battle" button
  Action: Click "Start Battle"
  Expected:
    - POST /api/battles → ghost or real opponent matched
    - Navigate to replay screen

Step 4: Legacy Replay
  Screen: replay → ReplayScreen.js
  Sees: Same as Flow B Step 3
  Action: Watch to end, click "Home"
  Expected: Navigate to results screen

Step 5: Legacy Results
  Screen: results → ResultsScreen.js
  Screenshot: screenshots/07-results.png
  Above the fold (mobile):
    - Two fighter outcome cards (names, outcome tags)
    - Fighter portraits partially visible
  Below fold on mobile (scroll required):
    - Full stats, reward details, Home button
  Desktop note: Both cards + rewards + Home button visible without scroll
  Sees:
    - Two fighter cards with outcome
    - [Req 9-D] Legacy rewards: win +10 spore / +100 mycelium
    - Speech bubble from winner
    - "Домой" / "Home" button
  Action: Click "Home" → navigate to home
```

---

## Flow E: Replay from History

```
Step 1: Home or History Screen
  Screen: home or history
  Screenshot: screenshots/08-history.png
  Sees: Battle history list (cards with outcome, opponent, date)
  Action: Click a battle card

Step 2: Standalone Replay
  Screen: replay → ReplayScreen.js
  Sees:
    - Full replay (same as Flow B Step 3)
    - No gameRun active
  Action: Watch to end
  Expected:
    - [Req 13-A] Button shows "Домой" / "Home" (NOT "Continue")
  Action: Click "Home" → navigate to home
```

---

## Flow F: Reconnection

E2E: coverage-gaps.spec.js tests Req 12-D (state survives page refresh).
Screenshots: (not yet captured for reconnection-specific UI)

```
Step 1: Player disconnects mid-run
  Expected:
    - [Req 12-A] Server state is authoritative; no data lost
    - [Req 12-D] Shop offer, loadout, run state survive page refresh

Step 2: Player reopens app
  Expected:
    - refreshBootstrap detects activeGameRun
    - [Req 12-B] If combat completed while away, player sees round result
    - Navigate to prep (if mid-round) or roundResult (if round resolved)

Step 3: Challenge idle timeout
  Expected:
    - [Req 12-C] Challenge runs with no ready/unready activity for
      CHALLENGE_IDLE_TIMEOUT_MS (5 min) are auto-abandoned by the server.
      Both players notified via SSE with endReason='timeout'.
    - Solo runs: no server-side timeout (player can resume any time
      via refreshBootstrap).
```

---

## Flow G: Settings

```
Step 1: Open Settings
  Screen: settings → SettingsScreen.js
  Screenshot: screenshots/14-settings.png
  Sees:
    - Language dropdown (RU / EN)
    - Reduced motion checkbox
    - Battle speed dropdown (1x / 2x)
    - Save button
  Action: Change settings, click Save
  Expected: Settings persisted, refreshBootstrap called
```

---

## Screen Inventory (complete)

| Screen ID | Component | Entry points |
|---|---|---|
| `auth` | AuthScreen.js | App launch (no session) |
| `onboarding` | OnboardingScreen.js | First login (no mushroom) |
| `home` | HomeScreen.js | Login, run complete, results |
| `characters` | CharactersScreen.js | Onboarding, home |
| `artifacts` | ArtifactsScreen.js | Character select (legacy) |
| `battle` | BattlePrepScreen.js | Artifacts save (legacy) |
| `prep` | PrepScreen.js | Start game, continue round, resume |
| `replay` | ReplayScreen.js | Ready, view replay, history |
| `results` | ResultsScreen.js | Legacy replay finish |
| `roundResult` | RoundResultScreen.js | Round resolve (no replay) |
| `runComplete` | RunCompleteScreen.js | Run ends (any reason) |
| `history` | (inline main.js) | Home |
| `friends` | FriendsScreen.js | Home |
| `leaderboard` | LeaderboardScreen.js | Home |
| `settings` | SettingsScreen.js | Menu |
| `wiki` | WikiScreen.js | Menu |
| `wiki-detail` | WikiDetailScreen.js | Wiki entry click |
