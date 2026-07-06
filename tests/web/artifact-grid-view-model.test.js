import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOccupancy, preferredOrientation } from '../../web/src/artifacts/grid.js';
import { FighterCard } from '../../web/src/components/FighterCard.js';
import { HomeSocialSidebar } from '../../web/src/components/HomeSocialSidebar.js';
import { BackpackZone } from '../../web/src/components/prep/BackpackZone.js';
import { FusionReveal } from '../../web/src/components/prep/FusionReveal.js';
import { PrepActions } from '../../web/src/components/prep/PrepActions.js';
import { RunHud } from '../../web/src/components/prep/RunHud.js';
import { SellZone } from '../../web/src/components/prep/SellZone.js';
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

test('[artifact-grid] fighter card keeps the Mushroom compatibility prop over core', () => {
  const mushroom = { id: 'thalla', name: { en: 'Thalla' }, imagePath: '/characters/thalla.png' };

  assert.equal(FighterCard.computed.resolvedCombatant.call({
    combatant: null,
    mushroom
  }), mushroom);
  assert.equal(FighterCard.computed.displayName.call({
    nameText: '',
    resolvedCombatant: mushroom
  }), 'Thalla');
  assert.equal(FighterCard.props.gridColumns.default, 6);
});

test('[artifact-grid] prep HUD and sell zone keep Mushroom compatibility over core', () => {
  const hudPlayer = RunHud.computed.player.call({
    state: { gameRun: { player: { coins: 4, wins: 1, livesRemaining: 3 } } }
  });
  const labels = RunHud.computed.labels.call({ t: { wins: 'Wins', lives: 'Lives' } });
  const currency = RunHud.computed.runCurrency.call({ player: hudPlayer });

  assert.deepEqual(labels, { wins: 'Wins', lives: 'Lives' });
  assert.deepEqual(currency, { amount: 4, icon: '\uD83E\uDE99' });
  assert.match(RunHud.template, /currency-class="run-hud-item run-hud-coins"/);
  assert.deepEqual(SellZone.emits, ['sell-dragover', 'sell-dragleave', 'sell-drop']);
  assert.equal(SellZone.computed.pricePrefix(), '\uD83E\uDE99');
  assert.equal(SellZone.computed.inactivePrefix(), '\uD83D\uDCB0');
  assert.match(SellZone.template, /@dragover="\$emit\('sell-dragover', \$event\)"/);
});

test('[artifact-grid] prep actions keep Mushroom compatibility over core', () => {
  const labels = PrepActions.computed.labels.call({
    t: {
      ready: 'Ready',
      readying: 'Readying',
      abandonRun: 'Abandon',
      opponentReady: 'Opponent ready',
      waitingForOpponent: 'Waiting'
    }
  });

  assert.deepEqual(labels, {
    ready: 'Ready',
    readying: 'Readying',
    abandon: 'Abandon',
    opponentReady: 'Opponent ready',
    opponentWaiting: 'Waiting'
  });
  assert.deepEqual(PrepActions.emits, ['signal-ready', 'abandon']);
  assert.match(PrepActions.template, /state\.gameRun\.mode === 'challenge'/);
  assert.match(PrepActions.template, /@ready="\$emit\('signal-ready'\)"/);
});

test('[artifact-grid] fusion reveal keeps Mushroom compatibility over core', () => {
  const catalog = new Map([
    ['cap', { id: 'cap', width: 1, height: 1, name: { en: 'Cap', ru: 'Шляпка' } }],
    ['stem', { id: 'stem', width: 1, height: 2, name: { en: 'Stem' } }],
    ['result', { id: 'result', width: 2, height: 2, name: { en: 'Result', ru: 'Результат' } }]
  ]);
  const context = {
    reveal: {
      ingredientArtifactIds: ['cap', 'stem'],
      resultArtifactId: 'result'
    },
    getArtifact: (id) => catalog.get(id),
    state: { lang: 'ru' },
    resultArtifact: catalog.get('result')
  };

  assert.deepEqual(FusionReveal.computed.ingredientArtifacts.call(context), [
    catalog.get('cap'),
    catalog.get('stem')
  ]);
  assert.equal(FusionReveal.computed.resultArtifact.call(context), catalog.get('result'));
  assert.equal(FusionReveal.computed.label.call(context), 'Слияние артефактов: Результат');
  assert.deepEqual(FusionReveal.emits, ['done']);
  assert.match(FusionReveal.template, /CoreFusionReveal/);
  assert.match(FusionReveal.template, /#artifact="\{ artifact, width, height \}"/);
  assert.match(FusionReveal.template, /<artifact-figure/);
});

test('[artifact-grid] shop zone shapes offer rows through the shared core helper', () => {
  const catalog = new Map([
    ['needle', {
      id: 'needle',
      family: 'damage',
      width: 1,
      height: 2,
      price: 2,
      name: { en: 'Needle' },
      description: { en: 'Sharp.' },
      bonus: { damage: 2 }
    }],
    ['bag', {
      id: 'bag',
      family: 'bag',
      width: 2,
      height: 2,
      price: 3,
      slotCount: 4,
      name: { en: 'Bag' },
      bonus: {}
    }]
  ]);
  const rows = ShopZone.computed.shopItemRows.call({
    state: {
      gameRunShopOffer: ['needle', 'bag'],
      gameRun: { player: { coins: 2 } },
      lang: 'en'
    },
    getArtifact: (id) => catalog.get(id),
    getArtifactPrice: (artifact) => artifact?.price || 0,
    artifactName: ShopZone.methods.artifactName,
    artifactDescription: ShopZone.methods.artifactDescription,
    formatArtifactBonus: (artifact) => artifact?.bonus?.damage
      ? [{ key: 'damage', label: 'Damage', value: '+2', positive: true }]
      : []
  });

  assert.equal(rows[0].artifactId, 'needle');
  assert.equal(rows[0].name, 'Needle');
  assert.equal(rows[0].description, 'Sharp.');
  assert.equal(rows[0].canAfford, true);
  assert.deepEqual(rows[0].previewOrientation, { width: 1, height: 2 });
  assert.deepEqual(rows[0].statRows, [{ key: 'damage', label: 'Damage', value: '+2', positive: true }]);
  assert.equal(rows[1].isBag, true);
  assert.equal(rows[1].slotCount, 4);
  assert.equal(rows[1].unavailable, true);
});
