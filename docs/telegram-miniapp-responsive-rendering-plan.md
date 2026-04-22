# Telegram Mini App Responsive Rendering Plan

**Status:** V1 foundation implemented; V2 full UI refactor implemented.

## Direction

Mushroom Master should keep the shop, backpack, inventory, and wiki/docs as a responsive HTML app surface: Vue components, semantic HTML, CSS Grid/Flexbox, and SVG artifact art. Canvas/WebGL should be reserved for optional battle/replay flourishes, particle effects, or future real-time scenes, not for the shop or inventory UI.

This direction matches the product shape: the most important screens are UI-heavy, text-rich, touch-first, and need Telegram theme/safe-area support, accessibility, screenshot assertions, and responsive layout. A canvas-first inventory would make buttons, text, wrapping, accessibility, and Telegram integration harder without meaningful benefit.

## Telegram Mini App Rules

- Use Telegram WebApp APIs as progressive enhancement. Browser/dev mode must remain fully functional.
- Use stable viewport height for layout decisions; do not pin critical UI to the live animated viewport height.
- Respect Telegram safe-area and content-safe-area insets, especially in fullscreen and around bottom actions.
- Map Telegram theme colors into repo-native CSS variables instead of replacing the mushroom visual system.
- Prefer Telegram native affordances where they help: BackButton for navigation, MainButton for primary actions, and HapticFeedback for buy/place/rotate/sell/ready/invalid actions.
- Keep click/tap as the primary interaction. Drag is a secondary power-user path.
- Use Pointer Events as the unified drag path while keeping click/tap as the primary interaction.
- Reduce or disable effects when user settings or device capability suggest reduced motion or low performance.

## V1 Foundation

Implemented scope:

- Add a frontend Telegram WebApp adapter that safely exposes availability, version checks, viewport/safe-area CSS syncing, theme syncing, and haptic helpers.
- Wire the adapter through auth, game-run, and shop composables as no-op-safe progressive enhancement.
- Add haptic feedback for successful buy/place/rotate/sell/ready actions and error feedback for invalid/blocked actions.
- Update the app shell and prep layout to use local Telegram viewport variables and safe-area spacing.
- Add Pointer Events scaffolding inside the existing touch bridge before the full V2 interaction rewrite.
- Fix the artifact-board spec to match the current `3x3` inventory contract.

V1 acceptance criteria:

- The app runs unchanged outside Telegram.
- Telegram clients get synced viewport/safe-area CSS variables and theme accents.
- Prep actions do not sit under Telegram/system bottom controls.
- Existing click-first shop/inventory flows still work.
- Existing drag/drop tests and screenshot tests are not intentionally rewritten.

## V2 Full UI Refactor

Implemented scope:

- Split `PrepScreen` into focused components: `RunHud`, `BackpackZone`, `InventoryZone`, `ShopZone`, `SellZone`, and `PrepActions`.
- Replace string-based artifact rendering and `v-html` with declarative Vue/SVG artifact components.
- Replace native HTML5 drag/drop plus the compatibility bridge with one Pointer Events controller using `setPointerCapture`, `touch-action`, transform-based drag ghosts, and board coordinate hit testing.
- Make board sizing container-aware with CSS variables/container queries so cell size adapts to Telegram viewport height and available width.
- Move docs/wiki rendering toward structured Vue-rendered sections with search/filter, locked-section previews, related links, and mobile-friendly section navigation. This remains the next docs-specific follow-up because V2 focused on prep/shop/inventory rendering and input architecture.

V2 acceptance criteria:

- The mobile prep screen fits the critical flow in a Telegram-sized viewport: HUD, backpack/inventory context, shop context, sell affordance, and ready action.
- Artifact visuals are component-rendered SVG, not injected HTML strings.
- Pointer Events support mouse/touch/pen through one path, with drag as secondary to tap/click.
- Screenshot tests cover mobile and desktop prep after the component split.

## Verification Strategy

- Unit tests for Telegram adapter no-op behavior, version checks, theme/viewport syncing, and haptic routing.
- Existing web composable tests for shop/loadout state behavior.
- Existing game tests for server-backed shop, loadout, and run flows.
- Screenshot tests for mobile and desktop prep layout, with explicit safe-area and no-overlap checks when the layout is touched.
