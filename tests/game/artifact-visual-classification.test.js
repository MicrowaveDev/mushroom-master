import assert from 'node:assert/strict';
import test from 'node:test';
import { artifacts, getArtifactById } from '../../app/server/game-data.js';
import {
  artifactRoleClass,
  artifactShineTier,
  artifactVisualClassification
} from '../../app/shared/artifact-visual-classification.js';

test('artifact visual classification maps gameplay family to role color', () => {
  assert.equal(artifactRoleClass(getArtifactById('spore_needle')).id, 'damage');
  assert.equal(artifactRoleClass(getArtifactById('bark_plate')).id, 'armor');
  assert.equal(artifactRoleClass(getArtifactById('shock_puff')).id, 'stun');
  assert.equal(artifactRoleClass(getArtifactById('moss_pouch')).id, 'bag');
});

test('artifact visual classification maps specialness to shine tier', () => {
  assert.equal(artifactShineTier(getArtifactById('bark_plate')).id, 'plain');
  assert.equal(artifactShineTier(getArtifactById('root_shell')).id, 'bright');
  assert.equal(artifactShineTier(getArtifactById('amber_satchel')).id, 'radiant');
  assert.equal(artifactShineTier(getArtifactById('kirt_venom_fang')).id, 'signature');
  assert.equal(artifactShineTier(getArtifactById('spore_lash')).id, 'signature');
});

test('every artifact has role and shine CSS classes for UI rendering', () => {
  for (const artifact of artifacts) {
    const visual = artifactVisualClassification(artifact);
    assert.ok(visual.cssClasses.includes(`artifact-role--${visual.role.id}`), artifact.id);
    assert.ok(visual.cssClasses.includes(visual.shine.cssClass), artifact.id);
    assert.match(visual.prompt, /class color:/, artifact.id);
    assert.match(visual.prompt, /shine:/, artifact.id);
  }
});
