import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackpackInteractionState } from '@microwavedev/backpack-game-core/vue/composables';
import { mushroomBackpackRows, useMushroomBackpackInteraction } from '../../web/src/composables/useBackpackInteraction.js';

function setup(save) {
  const catalog = new Map([
    ['starter_bag', { id: 'starter_bag', family: 'bag', width: 3, height: 3 }],
    ['needle', { id: 'needle', family: 'weapon', width: 1, height: 1 }]
  ]);
  const getArtifact = (id) => catalog.get(id);
  const state = {
    activeBags: [{ id: 'bag', artifactId: 'starter_bag', anchorX: 0, anchorY: 0 }],
    builderItems: [{ id: 'first', artifactId: 'needle', x: 0, y: 0, width: 1, height: 1 }],
    containerItems: [{ id: 'second', artifactId: 'needle' }], rotatedBags: [],
    gameRun: { id: 'run', loadoutItems: [] }, error: ''
  };
  const interaction = useMushroomBackpackInteraction({ state,
    interactionState: createBackpackInteractionState(), getArtifact,
    effectiveRows: () => 6, persistRunLoadout: save });
  return { state, getArtifact, interaction };
}

test('Mushroom adapter preserves duplicate row identity and awaits the strict save', async () => {
  let release;
  let strict;
  const pending = new Promise((resolve) => { release = resolve; });
  const { state, getArtifact, interaction } = setup((options) => { strict = options.strict; return pending; });
  assert.equal(interaction.select('second'), true);
  const saving = interaction.placeAt({ x: 1, y: 0 });
  assert.equal(interaction.state.busy, true);
  assert.equal(strict, true);
  assert.equal(state.actionInFlight, true);
  release({ success: true });
  assert.equal(await saving, true);
  assert.equal(state.actionInFlight, false);
  const rows = mushroomBackpackRows(state, getArtifact);
  assert.deepEqual(rows.filter((row) => row.artifactId === 'needle').map((row) => [row.id, row.x]),
    [['first', 0], ['second', 1]]);
  assert.equal(state.containerItems.length, 0);
  assert.equal(state.gameRun.loadoutItems.find((row) => row.id === 'second').x, 1);
});

test('Mushroom adapter rolls back every preparation bucket after a rejected save', async () => {
  const { state, interaction } = setup(async () => { throw new Error('offline'); });
  const previous = { builderItems: state.builderItems, activeBags: state.activeBags,
    containerItems: state.containerItems, rotatedBags: state.rotatedBags };
  assert.equal(interaction.select('second'), true);
  assert.equal(await interaction.placeAt({ x: 1, y: 0 }), false);
  for (const [name, value] of Object.entries(previous)) assert.equal(state[name], value);
  assert.equal(interaction.state.messageCode, 'save_failed');
  assert.equal(state.actionInFlight, false);
  interaction.cancel();
});
