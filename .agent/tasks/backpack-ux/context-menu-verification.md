# Context menu follow-up

Date: 2026-10-11. Tracking: https://github.com/MicrowaveDev/backpack-game-core/issues/11

## Implemented flow

The latest user request replaces the historical More/Rotate rail. Item and bag selection directly opens the shared single-column context menu in Storage and Backpack. Move retains selection for placement; rotation, Storage, auto-place and permitted priced sale use the existing product APIs. Starter Bag explains its lock without mutation actions. No persistent action controls reserve a row between panels. The compact HUD stays on the right with coins before Wins/Lives; permitted drag sale appears immediately to its left. Outside input or Escape dismisses the menu; no Cancel button remains.

## Evidence

Fresh `raw/context-menu-mobile.png` and `raw/context-menu-desktop.png` plus JSON manifests show the selected Storage item, its on-screen action menu, and absence of the global rail. Executable assertions check all menu bounds, unchanged placed rows after selection, mask-correct bag movement, rotation persistence, evacuation, rejection, and no layout shift. Fresh `raw/drag-sale-desktop.png` and its manifest show the drag art and sale destination immediately left of the compact HUD. The redundant Shop sale zone is removed. Fresh `raw/backpack-mobile.png`, `raw/backpack-desktop.png`, and `raw/full-shop-desktop.png` show confirmed/idle preparation with the new layout.

## Verification

Cross-consumer gate passed on runtime `5ed7d35`: core 486/486 plus package dry-run; Mushroom 665/665, production build, 3/3 screen checks and 3/3 focused browser journeys; Meat 119/119, 9/9 browser checks, both synthetic deployment configuration checks and production build. Final core documentation pin `5a9842b` does not change runtime code. The local gate log was `/tmp/context-menu-delivery-gate.log`; these recorded counts are the durable handoff. Telegram device acceptance remains user-owned; browser touch input does not establish real iOS/Android WebView acceptance.
