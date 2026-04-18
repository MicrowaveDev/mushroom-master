# Character Shop Unlock Plan

> Historical planning document. This file is a proposed implementation plan for a future feature, not the live gameplay contract. The authoritative current rules still live in [docs/game-requirements.md](./game-requirements.md) and [docs/user-flows.md](./user-flows.md) until the feature ships and those docs are updated.

## Source Of Truth

### Original Request

Analyze the current requirements, user flows, and related docs and make a plan for this idea:

- after a certain mushroom level is acquired, add new lore-based items for that character that can appear in the shop
- in solo mode they should always be available
- in duel mode only items whose required level is lower than or equal to the opponent's level should be available

### Stated Criteria And Constraints

- Base the plan on the current repository contract, especially:
  - [docs/game-requirements.md](./game-requirements.md)
  - [docs/user-flows.md](./user-flows.md)
  - current server-side run and shop generation logic
- The new items are:
  - character-specific
  - lore-based
  - progression-gated
- Solo and challenge mode must intentionally behave differently.
- Duel eligibility must depend on the opponent's level cap.
- This changes gameplay behavior, so the authoritative requirements must be updated in the same implementation.

### Success Conditions

- The feature has a clear gameplay contract for:
  - unlock condition
  - shop appearance rules
  - solo behavior
  - challenge behavior
- The implementation preserves the current per-player shop isolation model.
- The change is testable through backend scenario coverage and prep-screen UI coverage.

### Non-Goals

- No stat bonuses from level by itself.
- No change to combat abilities, Elo, ghost budget, or reward formulas.
- No broad redesign of the shop UI beyond what is needed to explain the new item class.
- No requirement to ship a full large content library in the first pass.

### Open Assumptions

- "Always available" in solo is interpreted as:
  - if the player has at least one eligible character item, each shop offer guarantees at least one eligible character-item slot
- This plan assumes level gates, not raw mycelium gates, because the user request says "after certain level".
- This plan assumes challenge eligibility is based on the opponent's current active mushroom level for the run.

## Current-State Analysis

### Current Contract

The existing gameplay contract already supports progression and shop persistence, but it does **not** currently allow progression to affect gameplay shop content.

Relevant current rules:

- [Req 4-D] shop offers 5 items per round.
- [Req 4-F] shop offer persists across page refresh.
- [Req 8-G] challenge mode keeps shop/loadout state isolated per player.
- [Req 14-A] each mushroom has a level derived from cumulative mycelium.
- [Req 14-G] starter preset variants are unlocked by level.
- [Req 14-H] mycelium and level are currently cosmetic-only, except for:
  - level/tier display
  - portrait variants
  - starter preset variants
  - wiki section unlocks

### Key Gap

The requested feature directly conflicts with [Req 14-H], because it adds a gameplay effect:

- level would change the effective shop pool

Therefore the feature cannot be treated as a code-only change. The implementation must update the gameplay spec first.

### Current Technical Fit

The current architecture is a good fit for the feature:

- shop offers are already generated server-side and persisted per player per round
- solo and challenge runs already diverge in [app/server/services/run-service.js](../app/server/services/run-service.js)
- challenge mode already supports viewer-scoped shop reads via:
  - `getActiveGameRun`
  - `getGameRun`
- challenge isolation is already pinned by [tests/game/challenge-isolation.test.js](../tests/game/challenge-isolation.test.js)

That means the feature should be implemented as:

- a new eligibility/filtering layer in shop generation
- not as a client-only shop decoration

## Proposed Product Rules

### Rule 1: Character Shop Items

Each mushroom may have a set of special lore-based shop items associated with that mushroom.

Each such item has:

- `mushroomId`
- `requiredLevel`
- normal artifact properties:
  - `id`
  - `name`
  - `family`
  - `size`
  - `price`
  - `bonus`

### Rule 2: Unlock Condition

A character item is unlocked for shop eligibility when:

- `playerLevel >= requiredLevel`

Level is the level of the player's currently active mushroom for the run.

### Rule 3: Solo Mode Availability

In solo mode:

- if at least one character item is eligible for the active mushroom, the shop guarantees at least one eligible character item in the offer

This plan recommends a **guaranteed slot** approach rather than injecting all unlocked items into every offer.

### Rule 4: Challenge Mode Availability

In challenge mode:

- a character item is eligible only when:
  - `playerLevel >= requiredLevel`
  - `opponentLevel >= requiredLevel`

This keeps duel access capped by the lower-progression side, matching the original idea.

### Rule 5: Isolation Boundary

Challenge mode must not expose:

- the opponent's private shop offer
- the opponent's hidden future eligible item pool

The opponent's level may be used server-side as an eligibility cap, and may be shown in the existing shared player summary only if already part of the intended product surface.

## Recommended Scope For V1

### Recommended Behavior

Ship the first version with:

- level-gated character items
- one guaranteed character-item slot per offer when an eligible pool exists
- the same guarantee on:
  - run start
  - between-round shop generation
  - manual refresh

### Why This Scope

This is the smallest implementation that satisfies the idea while staying balanced and easy to test.

It avoids:

- flooding the 5-slot shop with too many forced items
- making high-level progression overpower normal shop randomness
- creating a separate special shop UI or side inventory system

## Data And Code Changes

### 1. Artifact Data Model

Extend artifact definitions in [app/server/game-data.js](../app/server/game-data.js) to support character-item metadata.

Recommended shape:

```js
{
  id: 'thalla_relic_x',
  name: { ru: '...', en: '...' },
  family: 'stun',
  width: 1,
  height: 1,
  price: 2,
  bonus: { stunChance: 4, damage: 1 },
  characterItem: {
    mushroomId: 'thalla',
    requiredLevel: 5,
    loreKey: 'sacred-thread'
  }
}
```

Alternative acceptable shape:

- keep artifact definitions unchanged
- define a separate `CHARACTER_SHOP_UNLOCKS` registry keyed by artifact id

The separate registry is slightly cleaner if the team wants to preserve a strict split between base artifact stats and progression metadata.

### 2. Shop Eligibility Helper

Add a helper that computes the eligible character-item pool for a given viewer:

- input:
  - `playerId`
  - `gameRunId`
  - mode
  - active mushroom
  - player level
  - opponent level when challenge
- output:
  - array of eligible character items

Recommended location:

- a new helper near shop generation in [app/server/services/run-service.js](../app/server/services/run-service.js), or
- a small extracted module if the logic gets large

### 3. Shop Offer Generation

Update shop generation so it can:

- build the normal random pool
- build the eligible character-item pool
- reserve one slot for the character-item pool when the pool is non-empty

Apply the same logic in:

- initial run shop creation
- next-round shop creation
- `refreshRunShop`

### 4. Opponent Level Lookup In Challenge

Challenge runs already know both participants. Add a server-side lookup for the opponent's active mushroom level at the time the viewer's offer is generated.

The lookup should remain internal to the service layer unless the UI explicitly needs the level displayed.

### 5. UI Surface

Minimal UI additions recommended:

- optional badge on eligible character items:
  - "Character item"
  - or a mushroom-specific tag
- optional lock/explainer copy outside active runs:
  - not required for first backend slice

Avoid adding hidden-client logic that guesses eligibility. The server should remain authoritative.

## Requirements Doc Changes Needed

The implementation should update [docs/game-requirements.md](./game-requirements.md) at minimum in these areas.

### Economy / Shop

Add new requirement IDs covering:

- character-specific shop items exist
- unlocks are gated by active mushroom level
- solo mode guarantees access when eligible items exist
- challenge mode applies the opponent-level cap
- manual refresh uses the same eligibility rules
- persisted shop offers preserve whatever was generated for that round

### Progression

Update [Req 14-H] so it no longer claims progression is purely cosmetic.

Recommended replacement direction:

- progression remains non-combat and non-stat-scaling
- progression may unlock:
  - portraits
  - presets
  - wiki sections
  - character-specific shop items

### User Flows

Update [docs/user-flows.md](./user-flows.md), especially Flow B and challenge prep coverage, so prep-screen assertions include:

- the expected unlocked character item presence when the test setup satisfies its gate
- challenge-mode absence of over-cap items when opponent level is too low

## Implementation Plan

### Step 1. Freeze The Spec

Status: pending

Tasks:

- update [docs/game-requirements.md](./game-requirements.md)
- update [docs/user-flows.md](./user-flows.md)
- optionally update [docs/artifact-board-spec.md](./artifact-board-spec.md) if the item catalog or shop composition language needs to reflect the new item class

Completion condition:

- the exact meaning of "always available" is written down
- the challenge-level cap is explicit
- [Req 14-H] no longer contradicts the feature

### Step 2. Author The Initial Content Set

Status: pending

Tasks:

- choose initial lore-based items per mushroom
- define:
  - price
  - footprint
  - stat profile
  - required level
  - lore identity

Completion condition:

- at least one shippable item per mushroom exists in the data model

### Step 3. Add Eligibility And Shop Composition Logic

Status: pending

Tasks:

- implement the player-level check
- implement the challenge opponent-level cap
- reserve a guaranteed character-item slot when the eligible pool is non-empty
- reuse the same logic for:
  - run start
  - round transition
  - manual refresh

Completion condition:

- every generated shop offer follows the new rules in both solo and challenge

### Step 4. Preserve Read Isolation

Status: pending

Tasks:

- verify `getActiveGameRun` and `getGameRun` remain viewer-scoped
- ensure no opponent shop state or hidden eligible-pool details leak to the client

Completion condition:

- challenge isolation tests still pass
- no new read path exposes opponent private state

### Step 5. Add Tests

Status: pending

Tasks:

- unit tests for eligibility filtering
- backend scenario tests for solo unlock progression
- backend scenario tests for challenge opponent-cap filtering
- prep-screen screenshot/E2E assertions for visible item presence

Completion condition:

- the new rules are pinned by automated tests with requirement IDs

### Step 6. Add Minimal UI Explanation

Status: pending

Tasks:

- optionally label character items in the shop
- ensure prep-screen screenshots remain clear on mobile and desktop

Completion condition:

- a player can reasonably understand why a special item appears

## Validation Plan

### Backend Validation

- add unit tests for:
  - eligible in solo when `playerLevel >= requiredLevel`
  - ineligible in challenge when `opponentLevel < requiredLevel`
  - eligible in challenge when both player and opponent meet the threshold
- add scenario coverage for:
  - player earns enough mycelium to reach the target level
  - next generated shop includes the expected character item
- extend challenge scenario coverage so one side has higher progression and the lower-level opponent caps the pool

### UI Validation

- update prep-screen Playwright coverage
- save fresh screenshots for any touched prep screen
- assert visible presence of the expected unlocked item on the screen
- assert absence of over-cap items in the challenge setup where the opponent does not meet the required level

## Risks And Tradeoffs

### Risk 1: Requirement Drift

If code lands before the requirements doc is updated, the repo will temporarily claim the feature is a bug because [Req 14-H] currently forbids it.

### Risk 2: Shop Balance Distortion

If "always available" is implemented as "all unlocked character items are forced into every shop", the 5-slot shop may become too deterministic and crowd out the normal pool.

### Risk 3: Challenge Fairness Confusion

If the opponent-level cap is not explained clearly, players may think unlocked items are missing randomly rather than intentionally filtered.

### Risk 4: Hidden Data Leakage

If the implementation pulls opponent progression into the response shape carelessly, it could break the current challenge isolation contract.

## Recommendation

Recommended first shipping version:

- progression gate by active mushroom level
- one guaranteed eligible character-item slot per shop offer
- challenge mode applies `requiredLevel <= opponentLevel`
- server-authoritative filtering only
- minimal UI labeling

This is the smallest version that satisfies the idea cleanly and fits the current architecture without rewriting the entire shop system.
