import assert from 'node:assert/strict';
import test from 'node:test';
import { renderArtifactFigure } from '../../web/src/artifacts/render.js';

test('multi-cell artifacts render one continuous artwork over the cell board', () => {
  const html = renderArtifactFigure({
    id: 'glass_cap',
    family: 'damage',
    width: 2,
    height: 1,
    bonus: {}
  });

  assert.match(html, /background-image: url\('\/artifacts\/glass_cap\.png'\)/);
  assert.match(html, /artifact-figure-bitmap artifact-figure-bitmap--full/);
  assert.equal((html.match(/artifact-figure-bitmap--full/g) || []).length, 1);
  assert.equal((html.match(/artifact-figure-cell/g) || []).length, 2);
});

test('tall artifacts keep one full-height bitmap over stacked cells', () => {
  const html = renderArtifactFigure({
    id: 'amber_fang',
    family: 'damage',
    width: 1,
    height: 2,
    bonus: {}
  });

  assert.match(html, /background-image: url\('\/artifacts\/amber_fang\.png'\)/);
  assert.match(html, /artifact-figure-bitmap artifact-figure-bitmap--full/);
  assert.equal((html.match(/artifact-figure-bitmap--full/g) || []).length, 1);
  assert.equal((html.match(/artifact-figure-cell/g) || []).length, 2);
});

test('irregular bag masks keep empty cells as layout holes under one artwork overlay', () => {
  const html = renderArtifactFigure({
    id: 'trefoil_sack',
    family: 'bag',
    width: 3,
    height: 2,
    shape: [
      [1, 1, 1],
      [0, 1, 0]
    ],
    bonus: {}
  });

  assert.match(html, /background-image: url\('\/artifacts\/trefoil_sack\.png'\)/);
  assert.equal((html.match(/artifact-figure-bitmap--full/g) || []).length, 1);
  assert.equal((html.match(/artifact-figure-cell artifact-figure-cell--empty/g) || []).length, 2);
  assert.equal((html.match(/class="artifact-figure-cell/g) || []).length, 6);
});

test('artifact figures expose UI-driven role glyphs for each role', () => {
  const examples = [
    { id: 'spore_needle', family: 'damage', label: 'Damage role' },
    { id: 'bark_plate', family: 'armor', label: 'Armor role' },
    { id: 'shock_puff', family: 'stun', label: 'Stun role' },
    { id: 'moss_pouch', family: 'bag', label: 'Bag role' }
  ];

  for (const example of examples) {
    const html = renderArtifactFigure({
      ...example,
      width: 1,
      height: 1,
      bonus: {}
    });
    assert.match(html, new RegExp(`artifact-role-glyph--${example.family}`), example.id);
    assert.match(html, new RegExp(`aria-label="${example.label}"`), example.id);
  }
});
