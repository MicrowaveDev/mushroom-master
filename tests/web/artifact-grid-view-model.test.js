import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOccupancy, preferredOrientation } from '../../web/src/artifacts/grid.js';
import { HomeSocialSidebar } from '../../web/src/components/HomeSocialSidebar.js';
import { BackpackZone } from '../../web/src/components/prep/BackpackZone.js';
import { ShopZone } from '../../web/src/components/prep/ShopZone.js';
import { FusionAnimationLabScreen } from '../../web/src/pages/FusionAnimationLabScreen.js';

test('[artifact-grid] builds occupied cell maps through the shared core helper', () => {
  const occupied = buildOccupancy([
    { artifactId: 'spore_sac', x: 2, y: 1, width: 1, height: 2 },
    { artifactId: 'spark_shard', x: 4, y: 0, width: 2, height: 1 }
  ]);

  assert.equal(occupied.get('2:1'), 'spore_sac');
  assert.equal(occupied.get('2:2'), 'spore_sac');
  assert.equal(occupied.get('5:0'), 'spark_shard');
  assert.equal(occupied.has('3:1'), false);
});

test('[artifact-grid] preserves shaped-bag preview orientation through the shared helper', () => {
  assert.deepEqual(preferredOrientation({ width: 1, height: 2 }), { width: 2, height: 1 });
  assert.deepEqual(preferredOrientation({
    width: 4,
    height: 1,
    shape: [[1], [1], [1], [1]]
  }), { width: 1, height: 4 });
});

test('[artifact-grid] preview methods share canonical core orientation rules', () => {
  const artifact = { id: 'mycelium_vine', family: 'bag', width: 4, height: 1, shape: [[1], [1], [1], [1]] };
  const verticalItem = { id: 'static_spore_sac', family: 'stun', width: 1, height: 2 };

  assert.deepEqual(HomeSocialSidebar.methods.previewOrientation(artifact), { width: 1, height: 4 });
  assert.deepEqual(BackpackZone.methods.previewOrientation(verticalItem), { width: 1, height: 2 });
  assert.deepEqual(FusionAnimationLabScreen.methods.previewOrientation(verticalItem), { width: 1, height: 2 });
  assert.deepEqual(ShopZone.methods.previewOrientation.call({
    getArtifact: () => verticalItem
  }, verticalItem.id), { width: 1, height: 2 });
});
