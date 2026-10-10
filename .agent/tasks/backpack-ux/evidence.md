# Mushroom consumer evidence

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
