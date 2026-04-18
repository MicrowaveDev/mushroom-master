// Pure projection from the server's loadoutItems array into the client
// state buckets (builderItems, containerItems, activeBags, rotatedBags,
// freshPurchases). Extracted from useAuth.js so the routing logic can be
// unit-tested without pulling in the whole auth flow.
//
// Shape of input: Array<LoadoutItem> where each LoadoutItem has
//   { id, artifactId, x, y, width, height, bagId,
//     active, rotated, freshPurchase }
// Shape of output:
//   { builderItems, containerItems, activeBags, rotatedBags, freshPurchases }
//
// The rules, mirrored in the JSDoc on each branch below:
//   - bagged items (bagId set)       → builderItems with bagId
//   - grid-placed non-bag items      → builderItems with x,y coords
//   - container non-bag items (-1,-1)→ containerItems
//   - bag rows with active=1         → activeBags
//   - bag rows with active=0         → containerItems
//   - bag rows with rotated=1        → rotatedBags (regardless of active)
//
// See docs/bag-active-persistence.md and docs/bag-rotated-persistence.md.

export function projectLoadoutItems(loadoutItems, bagArtifactIds) {
  const bagsSet = bagArtifactIds instanceof Set
    ? bagArtifactIds
    : new Set(bagArtifactIds);

  const builderItems = [];
  const containerItems = [];
  const activeBags = [];
  const rotatedBags = [];
  const freshPurchases = [];

  for (const item of loadoutItems) {
    const isBag = bagsSet.has(item.artifactId);

    // Bagged items — live on the grid at the bag's virtual rows.
    // Legacy rows (pre-fix) were written with x=-1,y=-1 because
    // buildLoadoutPayloadItems stripped coords from bagged-item payloads.
    // Routing them into builderItems with invalid coords let CSS grid
    // auto-place them across the base grid, visually corrupting the next
    // prep screen. Drop back to containerItems so the player can re-place
    // them into the bag; the persistence fix keeps new saves correct.
    if (item.bagId) {
      if (item.x < 0 || item.y < 0) {
        containerItems.push({ id: item.id, artifactId: item.artifactId });
      } else {
        builderItems.push({
          id: item.id,
          artifactId: item.artifactId,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          bagId: item.bagId
        });
      }
      if (item.freshPurchase) freshPurchases.push(item.artifactId);
      continue;
    }

    // Bag rows — route by the server-persisted `active` and `rotated` flags.
    if (isBag) {
      if (item.active) {
        activeBags.push({ id: item.id, artifactId: item.artifactId });
      } else {
        containerItems.push({ id: item.id, artifactId: item.artifactId });
      }
      if (item.rotated) {
        rotatedBags.push({ id: item.id, artifactId: item.artifactId });
      }
      if (item.freshPurchase) freshPurchases.push(item.artifactId);
      continue;
    }

    // Non-bag, non-bagged items — routed by coordinates.
    if (item.x >= 0 && item.y >= 0) {
      builderItems.push({
        id: item.id,
        artifactId: item.artifactId,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        bagId: null
      });
    } else {
      containerItems.push({ id: item.id, artifactId: item.artifactId });
    }
    if (item.freshPurchase) freshPurchases.push(item.artifactId);
  }

  return {
    builderItems,
    containerItems,
    activeBags,
    rotatedBags,
    freshPurchases
  };
}
