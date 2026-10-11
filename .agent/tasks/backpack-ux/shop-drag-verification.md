# Shop drag purchase verification — 2026-10-11

Shared runtime eaac8eb; later core documentation commits do not change behavior. Req4-AA purchases and places in one transaction; invalid, stale and cancelled drops spend nothing. Click still buys into Storage.

Core499 tests passed. Mushroom666 game tests and production build passed; three screenshot checks passed. Final focused Backpack input journey and desktop/mobile shop purchase journeys passed3/3 after client reconciliation and touch coordinate stabilization. Real API regression also verifies bag and regular item rotation survives insertion/reload.

Evidence in raw/shop-price-preview-{desktop,mobile}.{png,json} was reviewed at1280×800 and375×667. The badge aligns with the target corner, remains above art, and shows the expected debit. Browser assertions prove immediate Backpack rendering before reload and persistence after reload. Mobile reaches the board by holding actual touch at a viewport edge, then stops scrolling by moving the finger to the center; no scripted scrolling during the gesture. The initial geometry test race was fixed by reacquiring target coordinates after scrolling stabilizes; assertions were not weakened.

The existing Backpack journey additionally verifies item and bag move, rejection, context menus, Storage, sale and reload. Physical Telegram iOS/Android checks remain with the user. No production deployment occurred.
