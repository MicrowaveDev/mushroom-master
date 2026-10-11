# Current acceptance status — 2026-10-11

Physical Telegram iOS/Android checks (core AC9/AC23) are pending with the user.
Automatic desktop/mobile acceptance passes after the following fixes:

- Desktop Ready fell below 800px when controls were moved into the loadout
  column. Responsive placement now mounts controls in the desktop topbar and
  before the mobile grid; the focused journey asserts Ready and stable origin.
- Concurrent SQLite writers could prevent deferred read-to-write upgrades.
  Product transactions now reserve the writer with IMMEDIATE; a real two-client
  file-backed contention test verifies both writes commit.
- Optimistic token now includes newly purchased rows while retaining persisted
  bag dimensions. Conflict recovery loads the authoritative bootstrap run.
- Shared Vue computed selection no longer caches the active pointer selection
  after completion; touch Cancel/keyboard full-bag regression checks cover it.

Tall-bag caption regression asserted a vertical gap even for the new horizontal
Storage card. The current check requires a real horizontal or vertical separation
and full art bounds. Focused tall-bag, evacuation and skin-purchase tests pass3/3
without retries (20.2s).

The final full-suite retry read geometry before the responsive controls mount
changed parent after a viewport resize. Tests now wait for the expected parent
before collecting bounds; no arbitrary sleep is added.

## Historical findings (previous iteration)

# Resolved consumer regressions

Consumer AC2: selection formerly shifted the board by 156px during a drag. Shared controls now reserve their action/status footprint. The repaired core runtime focused browser passed exact cell0,0 bounding-box invariants for idle→selection and selection→rejection, and a real pointer drag grabbed at bag secondcell4,0 saved anchor3,3.

Consumer AC5: the old floating prep shortcut rail overlapped mobile cells. Prep navigation is inline on narrow screens and in a verified safe gutter at wide desktop widths. Desktop controls use the full-width HUD slot; three wide-desktop shop columns keep the deterministic five-card offer, including the four-row vine mask, above the fold. Mobile375×667 retains the full scrollable board, with controls before it. Both final screenshots were inspected.

A test-only read/write overlap produced SQLITE_BUSY when APIpolling began before strict save completion. The journey now waits for the shared busy control to become enabled before reading server rows; the focused run passed without retries or SQLiteerrors. Product rollback behavior remains tested separately.

Real iOS/Android acceptance remains pending the user's manual device check (canonical core AC9/AC23). It is not claimed by Chromium touchscreen emulation.

## Baseline contract findings uncovered by the full consumer suite

Preparation/replay rendered an unregistered `home-social-sidebar` custom element in main.js after the prior shared refactor, so recipe shortcuts set state without opening a real sidebar. Registration now uses the public shared HomeSocialSidebar, existing product ArtifactStatSummary role/localization configuration, and product recipe/invite adapters. Functional tests exercise opening recipes, all recipe cards, role glyphs, signed stats, scrolling dock and replay access.

The rating-floor regression test assumed the player stayed at100 after random wins. A subsequent loss from a higher rating correctly returned108 but the test asserted100. Its fixture now resets the rating to100 before each battle, preserving the exact loss-clamp assertion. No rating production code changed. Scoped fixture test passed.
