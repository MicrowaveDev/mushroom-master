import { getBackpackLoadoutRevision, getBackpackItemDimensions } from '@microwavedev/backpack-game-core/modules/loadout';
import { createBackpackInteraction } from '@microwavedev/backpack-game-core/vue/composables';
import { projectLoadoutItems } from './loadout-projection.js';
import { BAG_COLUMNS } from '../constants.js';

// Mushroom's preparation state is split into three buckets; the shared
// interaction controller consumes canonical persisted loadout rows.
export function mushroomBackpackRows(state, getArtifact) {
  const rotation = (id) => state.rotatedBags.find((row) => row.id === id)?.rotation || 0;
  const original = (id) => state.gameRun?.loadoutItems?.find((row) => row.id === id) || {};
  return [
    ...state.activeBags.map((bag) => {
      const artifact = getArtifact(bag.artifactId);
      return { ...original(bag.id), id: bag.id, artifactId: bag.artifactId,
        x: bag.anchorX ?? 0, y: bag.anchorY ?? 0,
        ...getBackpackItemDimensions({ rotated: rotation(bag.id) }, artifact), active: true, rotated: rotation(bag.id) };
    }),
    ...state.builderItems.map((item) => ({ ...original(item.id), ...item })),
    ...state.containerItems.map((slot) => {
      const artifact = getArtifact(slot.artifactId);
      return { ...original(slot.id), id: slot.id, artifactId: slot.artifactId,
        x: -1, y: -1, width: slot.width ?? artifact.width,
        height: slot.height ?? artifact.height,
        active: false, rotated: artifact.family === 'bag' ? rotation(slot.id) : (slot.rotated || 0) };
    })
  ];
}

export function useMushroomBackpackInteraction({ state, interactionState, getArtifact,
  effectiveRows, persistRunLoadout, onCommitted, onSell, getSellPrice, onConflict }) {
  return createBackpackInteraction({
    state: interactionState,
    getRows: () => mushroomBackpackRows(state, getArtifact),
    getArtifact,
    getSellPrice,
    columns: BAG_COLUMNS,
    getHeight: effectiveRows,
    canInteract: () => !state.actionInFlight,
    isLockedBag: (row) => row.artifactId === 'starter_bag',
    async commitRows(rows) {
      // Purchase responses add an owned instance to the projected buckets but do
      // not return a full loadout. Existing persisted rows retain authoritative
      // dimensions (bag catalog dimensions may differ from its displayed mask).
      const previousRows = mushroomBackpackRows(state, getArtifact);
      const expectedLoadoutRevision = getBackpackLoadoutRevision(previousRows.map((row) =>
        state.gameRun?.loadoutItems?.find((saved) => saved.id === row.id) || row));
      const previous = { builderItems: state.builderItems, activeBags: state.activeBags,
        containerItems: state.containerItems, rotatedBags: state.rotatedBags };
      const bags = new Set(rows.filter((row) => getArtifact(row.artifactId)?.family === 'bag')
        .map((row) => row.artifactId));
      const projected = projectLoadoutItems(rows, bags, getArtifact);
      Object.assign(state, { builderItems: projected.builderItems, activeBags: projected.activeBags,
        containerItems: projected.containerItems, rotatedBags: projected.rotatedBags });
      state.actionInFlight = true;
      try {
        const saved = await persistRunLoadout({ strict: true, expectedLoadoutRevision });
        if (!saved) { Object.assign(state, previous); return false; }
        const confirmedRows = saved.loadoutItems || rows;
        const confirmed = projectLoadoutItems(confirmedRows, bags, getArtifact);
        Object.assign(state, { builderItems: confirmed.builderItems, activeBags: confirmed.activeBags,
          containerItems: confirmed.containerItems, rotatedBags: confirmed.rotatedBags });
        if (saved.loadoutItems) Object.assign(state.gameRun, saved);
        else state.gameRun.loadoutItems = confirmedRows;
        state.error = '';
        return true;
      } catch (error) {
        Object.assign(state, previous);
        if (error.status === 409) await onConflict?.();
        return false;
      } finally {
        state.actionInFlight = false;
      }
    },
    onCommitted,
    onSell
  });
}
