# Backpack-Style UX Rework Plan

**Status:** Active implementation plan.
**Scope:** Make the Telegram Mini App read as a game, with a Backpack Battles-adjacent prep loop, tactile inventory feedback, and a more rewarding replay presentation.

## Source Of Truth

Original request:

- Analyze Mushroom Master goals, game requirements, user flows, and current views.
- Propose how the UX can move closer to Backpack Battles.
- Improve animations, effects, and responsive backpack grid view.
- Decide whether other HTML5 technologies are needed.
- Then write the plan and implement it.

Authoritative repo contracts:

- Game behavior: [`docs/game-requirements.md`](game-requirements.md)
- Screen flows: [`docs/user-flows.md`](user-flows.md)
- Current HTML5 direction: [`docs/html5-ux-optimization-plan.md`](html5-ux-optimization-plan.md)
- Responsive Mini App direction: [`docs/telegram-miniapp-responsive-rendering-plan.md`](telegram-miniapp-responsive-rendering-plan.md)
- UI design rules: [`/.agent/workflows/ui-design.md`](../.agent/workflows/ui-design.md)

## Current Diagnosis

The game rules already support a Backpack Battles-like loop: buy artifacts, hold them in the backpack, place them on a spatial grid, then watch an automatic battle. The main gap is presentation.

- Prep is functionally correct, but mobile reads like a long web form. The current round-1 mobile screenshot is `1263px` tall at a `375x667` viewport, so the player cannot see the build surface, shop, and ready action as one game table.
- The backpack grid is responsive, but it is not yet the visual hero. The board should feel like the arena where strategy happens.
- Shop items and placed artifacts have SVG pieces, but buy/place/rotate/sell feedback is still light.
- Replay uses portraits, HP text, speech bubbles, and logs, but it needs hit reactions, active-side emphasis, and damage/stun style effects to feel like combat.

## Technology Direction

Keep the prep/shop/backpack as **DOM + CSS Grid + SVG + Pointer Events**.

Do not move inventory or shop to canvas/WebGL. Those surfaces need accessible buttons, text, Telegram safe-area support, localization, screenshots, responsive layout assertions, and click-first controls. Canvas would make those harder without solving the core problem.

Use HTML5 enhancements selectively:

- **CSS Grid/container queries:** primary tool for the responsive backpack board.
- **Pointer Events:** primary drag path for touch/mouse/pen.
- **CSS transitions/keyframes and Web Animations later if needed:** buy/place/rotate/sell/invalid feedback.
- **View Transitions API:** already used for route changes as progressive enhancement.
- **Canvas overlay:** optional replay-only layer for sparks, damage numbers, stun crackle, and spore particles.
- **Telegram haptics:** continue using for buy/place/rotate/sell/invalid feedback.

## Target UX

### Prep Screen

Prep should feel like a single game table:

1. Compact round HUD.
2. Backpack grid as the main visual surface.
3. Backpack/container as a bench attached to the board.
4. Shop as a compact tray, not a document section.
5. Sell zone and ready action always easy to reach.

Mobile should prioritize one-hand play. The first viewport should show the round state, the full backpack board, and enough of the shop/bench to understand the next action. Some scrolling is acceptable once the shop is full, but the core board should not feel buried.

Desktop should keep the existing two-column contract: backpack + inventory on the left, shop + sell on the right, aligned below the HUD.

### Item Feedback

Artifact interactions should feel tactile:

- bought items pop into the backpack bench;
- placed items snap onto the grid;
- rotate controls spin with the piece;
- valid drop cells glow;
- invalid/blocked interactions shake or pulse;
- shop cards react quickly on press without layout shift;
- reduced-motion users get instant state changes.

### Replay

Replay is the emotional payoff:

- active fighter lunges or glows;
- damaged side shakes briefly;
- HP changes animate by width/color rather than only text;
- stun/special action gets a visible crackle/flash;
- rewards remain inline after replay, but the battle stage should remain the focus.

## Implementation Slices

### Slice 1: Game-Table Prep And Replay CSS

Ship now.

- Restructure prep markup only enough to create a compact top bar.
- Restyle prep as a game table with tighter mobile spacing.
- Make the inventory board visually dominant and more responsive on mobile.
- Convert mobile shop into a compact tray layout.
- Add CSS-only buy/place/grid/replay motion that respects reduced motion.
- Add replay active-side and hit/stun visual states using existing replay event data.

Acceptance criteria:

- Mobile prep has no horizontal overflow.
- Desktop prep remains a coherent two-column workspace.
- Ready and abandon actions remain reachable and visible.
- Existing click-first and Pointer Events drag flows still work.
- Replay screenshots show clear active fighter emphasis and animated state classes in DOM.
- `npm run game:test` passes.
- `npm run game:test:screens` passes or any failure is documented with concrete follow-up.

### Slice 2: Explicit Selection Mode

Follow-up.

- Tap a backpack item to select it instead of immediately auto-placing when useful.
- Highlight valid cells for the selected item.
- Tap a highlighted cell to place.
- Keep one-tap auto-place as a shortcut where it already works.

### Slice 3: Replay Effect Overlay

Follow-up.

- Add an optional replay canvas overlay behind/over the duel stage.
- Render damage numbers, stun flashes, sparks, and spore particles.
- Disable under reduced motion or low-performance mode.

## Non-Goals For This Pass

- No combat rule changes.
- No economy or balance changes.
- No canvas inventory.
- No new UI framework.
- No broad rewrite of home/wiki/social screens.
