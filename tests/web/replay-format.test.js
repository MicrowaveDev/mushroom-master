import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReplayEvent } from '../../web/src/replay/format.js';

const battle = {
  snapshots: {
    left: { mushroomId: 'kirt' },
    right: { mushroomId: 'lomie' }
  }
};

function nameFor(id) {
  return { kirt: 'Кирт', lomie: 'Ломиэ' }[id] || id;
}

function actionFor(id) {
  return { kirt: 'Чистый удар' }[id] || '';
}

test('[Req 6-L, 13-G] replay action bubble narrates lore effects caused during the turn', () => {
  const display = formatReplayEvent(
    {
      type: 'action',
      actorSide: 'left',
      targetSide: 'right',
      actionName: 'Clean Strike',
      damage: 11,
      stunned: true,
      effectTags: [
        { id: 'poison', sourceArtifactId: 'kirt_venom_fang', itemId: 'a', targetSide: 'right' },
        { id: 'poison', sourceArtifactId: 'kirt_venom_fang', itemId: 'b', targetSide: 'right' },
        { id: 'biostasis', sourceArtifactId: 'mirrorloop_knot', targetSide: 'right' },
        { id: 'freeze', sourceArtifactId: 'lomie_crystal_lattice', targetSide: 'left' },
        { id: 'decay', sourceArtifactId: 'morga_ash_pin', targetSide: 'right' }
      ]
    },
    battle,
    nameFor,
    actionFor,
    'ru'
  );

  assert.equal(display.speechSide, 'left');
  assert.equal(display.speechText, 'Использую Чистый удар: 11 урона, оглушение. Эффекты: ЯД, УЗЫ, ИНЕЙ +1 ещё.');
  assert.deepEqual(
    display.speechParts.filter((part) => part.kind).map((part) => [part.kind, part.text]),
    [
      ['action', 'Чистый удар'],
      ['damage', '11 урона'],
      ['stun', 'оглушение'],
      ['keyword', 'Эффекты'],
      ['effect', 'ЯД'],
      ['effect', 'УЗЫ'],
      ['effect', 'ИНЕЙ'],
      ['more', '+1 ещё']
    ]
  );
  assert.equal(display.logText, 'Кирт использует Чистый удар: 11 урона, оглушение. Эффекты: ЯД, УЗЫ, ИНЕЙ +1 ещё.');
});
