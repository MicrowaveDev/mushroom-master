# Backpack interaction consumer integration

Implement the shared backpack controller in Mushroom Battles for issue #5.

- Consumer AC1: Selecting a Storage or placed item does not move it; explicit placement/actions retain row IDs.
- Consumer AC2: Pointer/tap placement and empty-bag movement use shared geometry; starter bag is locked.
- Consumer AC3: Changes persist immediately and failed writes roll back all preparation buckets.
- Consumer AC4: Purchase, refund, fusion and tutorial flows remain available.
- Consumer AC5: Current mobile/desktop screenshots and layout assertions show accessible controls and grid.

Product code only adapts rows, saves, callbacks, labels and wrapper props. No shared placement rules are implemented locally. Root agent owns commits and core pointer updates.

Verify consumer browser journeys plus production build; inspect fresh screenshots. Shared core unit checks are owned by the root agent.


## Contextual interaction iteration — 2026-10-11

Canonical scope is core AC16–AC23 in `vendor/backpack-game-core/docs/backpack-interaction-ux-plan.md`.
No global item/bag mode or permanent actions toolbar. Empty usable bag cells begin
bag drag after threshold; occupied cells grab items, mask gaps do nothing. The
accessible bag label is the full-bag fallback. Successful translations evacuate
whole items intersecting the old mask to Storage atomically; no-op/cancel/invalid
and failed commits leave the confirmed layout intact. Public core normalizes the
server plan and generates the optimistic token; Mushroom owns SQLite/Postgres
transactions and saves. Contextual sale shows the actual refund.

Acceptance: core domain/controller/persistence tests, both product browser
journeys, desktop/mobile ghost and evacuation PNG+JSON, stable board origin and
Ready above the desktop fold. Only one controls component is mounted: topbar on
desktop, before grid on mobile. Physical Telegram WebView AC9/AC23 remain assigned
to the user; browser emulation cannot mark them complete.
