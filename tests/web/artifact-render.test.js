import assert from 'node:assert/strict';
import test from 'node:test';
import { renderArtifactFigure } from '../../web/src/artifacts/render.js';

test('multi-cell artifacts render each cell as a slice of one full artwork', () => {
  const html = renderArtifactFigure({
    id: 'glass_cap',
    family: 'damage',
    width: 2,
    height: 1,
    bonus: {}
  });

  assert.match(html, /background-image: url\('\/artifacts\/glass_cap\.png'\)/);
  assert.match(html, /background-size: 200% 100%/);
  assert.match(html, /background-position: 0% 50%/);
  assert.match(html, /background-position: 100% 50%/);
  assert.equal((html.match(/artifact-figure-bitmap/g) || []).length, 2);
});

test('tall artifacts render vertical puzzle slices', () => {
  const html = renderArtifactFigure({
    id: 'amber_fang',
    family: 'damage',
    width: 1,
    height: 2,
    bonus: {}
  });

  assert.match(html, /background-image: url\('\/artifacts\/amber_fang\.png'\)/);
  assert.match(html, /background-size: 100% 200%/);
  assert.match(html, /background-position: 50% 0%/);
  assert.match(html, /background-position: 50% 100%/);
  assert.equal((html.match(/artifact-figure-bitmap/g) || []).length, 2);
});
