# Backpack interaction consumer integration

Implement the shared backpack controller in Mushroom Battles for issue #5.

- Consumer AC1: Selecting a Storage or placed item does not move it; explicit placement/actions retain row IDs.
- Consumer AC2: Pointer/tap placement and empty-bag movement use shared geometry; starter bag is locked.
- Consumer AC3: Changes persist immediately and failed writes roll back all preparation buckets.
- Consumer AC4: Purchase, refund, fusion and tutorial flows remain available.
- Consumer AC5: Current mobile/desktop screenshots and layout assertions show accessible controls and grid.

Product code only adapts rows, saves, callbacks, labels and wrapper props. No shared placement rules are implemented locally. Root agent owns commits and core pointer updates.

Verify consumer browser journeys plus production build; inspect fresh screenshots. Shared core unit checks are owned by the root agent.
