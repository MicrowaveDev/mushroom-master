import test from 'node:test';
import assert from 'node:assert/strict';
import { replayFighterEffects } from '../../web/src/replay/effects.js';

test('[Req 13-E] replay fighter effects are side-symmetric for attacks', () => {
  const leftTarget = replayFighterEffects({
    side: 'left',
    replayIndex: 4,
    event: {
      type: 'action',
      actorSide: 'right',
      targetSide: 'left',
      damage: 7,
      blockedDamage: 2,
      stunned: true
    },
    replayState: { left: { stunned: true }, right: { stunned: false } }
  });
  const rightTarget = replayFighterEffects({
    side: 'right',
    replayIndex: 5,
    event: {
      type: 'action',
      actorSide: 'left',
      targetSide: 'right',
      damage: 7,
      blockedDamage: 2,
      stunned: true
    },
    replayState: { left: { stunned: false }, right: { stunned: true } }
  });

  assert.deepEqual(leftTarget.classes, ['fighter--hit', 'fighter--blocked', 'fighter--stunned']);
  assert.deepEqual(rightTarget.classes, leftTarget.classes);
  assert.deepEqual(
    leftTarget.floatingLabels.map((label) => [label.id, label.text, label.className]),
    [
      ['damage', '-7', 'damage'],
      ['blocked', 'BLOCK', 'blocked'],
      ['stun', 'STUN', 'stun']
    ]
  );
  assert.deepEqual(rightTarget.floatingLabels, leftTarget.floatingLabels);
  assert.deepEqual(leftTarget.statusBadges.map((badge) => badge.className), ['stun']);
  assert.deepEqual(rightTarget.statusBadges.map((badge) => badge.className), ['stun']);
});

test('[Req 13-E] replay fighter effects separate actor, target, and skip states', () => {
  const actor = replayFighterEffects({
    side: 'left',
    event: { type: 'action', actorSide: 'left', targetSide: 'right', damage: 4 },
    replayState: { left: {}, right: {} }
  });
  const target = replayFighterEffects({
    side: 'right',
    event: { type: 'action', actorSide: 'left', targetSide: 'right', damage: 4 },
    replayState: { left: {}, right: {} }
  });
  const skipped = replayFighterEffects({
    side: 'right',
    event: { type: 'skip', actorSide: 'right', targetSide: 'left' },
    replayState: { left: {}, right: { stunned: false } }
  });

  assert.deepEqual(actor.classes, ['fighter--acting-now']);
  assert.deepEqual(actor.floatingLabels, []);
  assert.deepEqual(target.classes, ['fighter--hit']);
  assert.deepEqual(target.floatingLabels.map((label) => label.text), ['-4']);
  assert.deepEqual(skipped.classes, ['fighter--skip']);
  assert.deepEqual(skipped.statusBadges, []);
});

test('[Req 13-G] replay fighter effects tolerate legacy and non-combat events', () => {
  assert.deepEqual(
    replayFighterEffects({ side: 'left', event: { type: 'battle_start' } }),
    {
      side: 'left',
      key: '0:battle_start:::left',
      classes: [],
      floatingLabels: [],
      statusBadges: []
    }
  );
});

test('[Req 13-E] replay fighter status labels localize compact combat terms', () => {
  const effects = replayFighterEffects({
    side: 'right',
    lang: 'ru',
    event: {
      type: 'action',
      actorSide: 'left',
      targetSide: 'right',
      damage: 2,
      blockedDamage: 1,
      stunned: true
    },
    replayState: { right: { stunned: true } }
  });

  assert.deepEqual(effects.floatingLabels.map((label) => label.text), ['-2', 'БЛОК', 'ОГЛУШ']);
  assert.deepEqual(effects.statusBadges.map((badge) => badge.label), ['ОГЛУШ']);
});

test('[Req 6-L, 13-G] replay fighter effects render lore artifact effect tags on their target side', () => {
  const targetEffects = replayFighterEffects({
    side: 'right',
    lang: 'en',
    event: {
      type: 'action',
      actorSide: 'left',
      targetSide: 'right',
      damage: 5,
      effectTags: [
        { id: 'poison', sourceArtifactId: 'kirt_venom_fang', targetSide: 'right' },
        { id: 'freeze', sourceArtifactId: 'lomie_crystal_lattice', targetSide: 'left' }
      ]
    }
  });
  const actorEffects = replayFighterEffects({
    side: 'left',
    lang: 'ru',
    event: {
      type: 'action',
      actorSide: 'left',
      targetSide: 'right',
      damage: 5,
      effectTags: [
        { id: 'poison', sourceArtifactId: 'kirt_venom_fang', targetSide: 'right' },
        { id: 'freeze', sourceArtifactId: 'lomie_crystal_lattice', targetSide: 'left' }
      ]
    }
  });

  assert.deepEqual(targetEffects.floatingLabels.map((label) => label.text), ['-5', 'POISON']);
  assert.deepEqual(actorEffects.floatingLabels.map((label) => label.text), ['ИНЕЙ']);
});
