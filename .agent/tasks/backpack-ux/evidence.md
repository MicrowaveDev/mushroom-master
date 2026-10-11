# Current contextual backpack evidence — 2026-10-11

Runtime core `f05461d`; final pin `3f77736` contains documentation-only follow-ups.
Core AC16-AC22 pass. Shared controller supplies direct free-cell bag drag,
occupied-cell item drag, contextual rotation/More, pointer art and full-bag label
fallback. Server normalization derives whole-item evacuation from the old usable
mask. Product transactions preserve instance IDs and rotation; revision conflicts
restore/reload the authoritative bootstrap layout. No-op and invalid/cancelled
moves do not evacuate contents.

Final cross-consumer gate passed: core480 tests/pack, Mushroom665 units/3 screens/
2 focused browsers (21.7s, zero retries), Meat119 units/9 browsers (25.5s), both
builds and synthetic hosted/local deployment configurations. See
`raw/contextual-verification.txt` for the gate summary.

The actual API/browser journey buys a pouch, places an item inside, grabs the
free second cell, saves the translated bag and confirms the evacuated item after
refresh. Four consecutive bag rotations preserve the revision contract. Escape,
invalid placement and contextual sale persist the intended layout. Exact grid
origin invariants pass during selection/rejection. The accessible contextual menu
is shared with Meat's filled-bag keyboard and mobile menu-bounds regressions.

Fresh375x667 and1280x800 PNG+JSON match their descriptions, have no broken images,
horizontal overflow or raw status tokens. Root inspected both confirmed evacuation
screens and pointer art. Desktop uses horizontal Storage cards and36px cells:
Ready fits the first800px after evacuation, full art remains visible, shortcuts
stay in the safe left gutter. Mobile keeps the full scrollable grid and inline
shortcuts. Historical occupied-bag-refusal evidence below is superseded for bag
translations.

Core AC9/AC23 remain PENDING_USER for actual Telegram iOS/Android testing. No
production deployment in this iteration. Full browser regression completed:54
successful (53 first attempt,1 after retry),0 failed,1 existing opt-in skip (4.5m).
The retry measured geometry before matchMedia moved the controls after viewport
change; final test waits for the expected component parent before measuring.
Final responsive full happy path and backpack input checks pass2/2 without
retries (48.9s). Tall-bag caption/art bounds, evacuation and skin-purchase checks pass3/3
without retries (20.2s).

# Historical Mushroom consumer evidence

Validated runtime: `c3776d9`; final core pin `220ebae` adds only acceptance documentation. Product code only adapts rows, saves, callbacks, labels and public component configuration. Storage, board, bag controls, pointer/tap and explicit rotate/store/auto-place/sell all use the shared controller. Canonical instance IDs/dimensions survive projection; strict queued persistence awaits authoritative rows and rolls back all four preparation buckets on failure. Buy/refresh/Ready/abandon are guarded while writes are pending.

Consumer AC1–3: adapter regressions verify duplicate IDs, awaited persistence and rollback. The actual touchscreen/pointer journey verifies select without movement, explicit placement, fixed starter reason, second-cell bag drag from (4,0) to (4,3) saving anchor (3,3), rejected uncovered placement with unchanged rows, exact idle/selected/rejection board-origin invariants on both viewports, reload persistence, selected-item sale and reload removal.

Consumer AC4: tutorial advances after committed placement; deterministic occupied-bag unplace and real sale are rejected without changing server rows. Public HomeSocialSidebar registration restores the previously unregistered preparation/replay sidebar. Existing product grid and stat adapters preserve bitmap art, role glyphs, signed stats, localized recipes and invite callbacks. Functional tests cover fusion reveal, tutorial, sidebar opening, recipe list, mobile dock and replay access.

Consumer AC5: narrow screens keep controls before the board and inline shortcuts; wide desktop uses full-width controls in the existing HUD slot and a safe 44px left-gutter rail. At 1280×800 three shop columns fit a deterministic five-card stress offer containing the four-row Mycelium Vine mask plus Trefoil Sack, Birchbark Hook, Root Shell and Burning Cap. Art stays complete and Ready stays above fold. The board remains scrollable on 375×667.

Verification: final focused input/full-shop cases passed 2/2 without retries (43.4s); focused sidebar functional/bitmap checks passed in the preceding 3-case run. Final production build passed. Full unit suite passed 663/663 (66.7s) on the final source in the cross-consumer gate. Final `game:test:e2e` passed 54 cases, with 1 existing opt-in local grass candidate preview skipped because `HOME_FIELD_CANDIDATE_PREVIEW` was not enabled; zero failures and retries (4.1m).

Fresh PNG/JSON proofs under `raw/`: `backpack-desktop`, `backpack-mobile`, `before-pointer`, `pointer-preview`, `recipes-desktop`, `recipes-mobile`, `full-shop-desktop`. JSON records exact state, viewport, scroll, broken-image/overflow checks. Final preparation and sidebar views were visually inspected; root also visually inspected the stress-shop capture.

Final hub `npm run verify:backpack-core` passed: equal runtime pins, core unit/pack, Mushroom build/unit/screens/support-admin E2E, Meat unit/browser/server+local deploy config/build. The last core commit changes docs only.

Chromium touchscreen emulation does not claim real device acceptance. The user will run the canonical iOS/Android device script; core AC9 remains pending that check.

Pointer artwork follow-up (core `be4b280`): both product renderers consume the
shared teleported ghost. Focused actual pointer journey passed on 375×667 and
1280×800, verifies the second-cell grab, art visibility/non-interception, drop
cleanup and Escape without persistence. Fresh inspected `raw/drag-bag-mobile`
and `raw/drag-bag-desktop` PNG/JSON show held art and the snapped destination.

Final cross-consumer gate on `be4b280` passed: core469/pack, Mushroom663/build/3screens/3support E2E, Meat118/9browser/hosted+local deploy config/build. Focused Mushroom pointer journey passed separately; device verification remains pending.
