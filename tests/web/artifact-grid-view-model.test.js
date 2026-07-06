import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOccupancy, preferredOrientation } from '../../web/src/artifacts/grid.js';
import { ArtifactCatalogBrowser } from '../../web/src/components/ArtifactCatalogBrowser.js';
import { FighterCard } from '../../web/src/components/FighterCard.js';
import { HomeSocialSidebar } from '../../web/src/components/HomeSocialSidebar.js';
import { BackpackZone } from '../../web/src/components/prep/BackpackZone.js';
import { FusionReveal } from '../../web/src/components/prep/FusionReveal.js';
import { InventoryZone } from '../../web/src/components/prep/InventoryZone.js';
import { PrepActions } from '../../web/src/components/prep/PrepActions.js';
import { RunHud } from '../../web/src/components/prep/RunHud.js';
import { SellZone } from '../../web/src/components/prep/SellZone.js';
import { ShopZone } from '../../web/src/components/prep/ShopZone.js';
import { FusionAnimationLabScreen } from '../../web/src/pages/FusionAnimationLabScreen.js';
import { artifactFusionRecipes } from '../../app/shared/artifact-fusions.js';

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

test('[artifact-grid] backpack zone keeps Mushroom compatibility over core', () => {
  const labels = BackpackZone.computed.labels.call({
    t: {
      container: 'Container',
      bagSlots: 'slots',
      containerHint: 'Drag here',
      fusionPendingHint: 'Pending fusion',
      fusionCandidateHint: 'Can fuse',
      recipes: 'Recipes'
    }
  });
  const emitted = [];

  assert.deepEqual(labels, {
    title: 'Container',
    bagSlots: 'slots',
    empty: 'Drag here',
    pendingTitle: 'Pending fusion',
    highlightedTitle: 'Can fuse'
  });
  assert.equal(BackpackZone.methods.artifactName.call({
    state: { lang: 'en' }
  }, { id: 'spore_needle', name: { en: 'Needle' } }), 'Needle');
  BackpackZone.methods.onSelectItem.call({
    $emit: (event, payload) => emitted.push([event, payload])
  }, { artifactId: 'spore_needle', id: 'row_1' });
  assert.deepEqual(emitted, [['auto-place', { artifactId: 'spore_needle', id: 'row_1' }]]);
  assert.deepEqual(BackpackZone.emits, ['auto-place', 'container-dragover', 'container-drop']);
  assert.match(BackpackZone.template, /CoreBackpackZone/);
  assert.match(BackpackZone.template, /#visual="\{ item, orientation, previewItem \}"/);
  assert.match(BackpackZone.template, /<artifact-grid-board/);
});

test('[artifact-grid] inventory zone keeps Mushroom compatibility over core', () => {
  const catalog = new Map([
    ['starter_bag', { id: 'starter_bag', width: 3, height: 3, name: { en: 'Starter' }, color: '#999' }],
    ['wide_bag', { id: 'wide_bag', width: 4, height: 1, name: { en: 'Wide Bag' }, color: '#abc' }],
    ['square_bag', { id: 'square_bag', width: 2, height: 2, name: { en: 'Square Bag' }, color: '#def' }]
  ]);
  const context = {
    state: {
      lang: 'en',
      activeBags: [
        { id: 'starter_row', artifactId: 'starter_bag' },
        { id: 'wide_row', artifactId: 'wide_bag' },
        { id: 'square_row', artifactId: 'square_bag' }
      ]
    },
    t: { bagDragHint: 'Move bag' },
    getArtifact: (id) => catalog.get(id)
  };
  const chips = InventoryZone.computed.activeContainerChips.call(context);
  const emitted = [];

  assert.equal(chips.length, 2);
  assert.deepEqual(chips[0], {
    id: 'wide_row',
    artifactId: 'wide_bag',
    name: 'Wide Bag',
    color: '#abc',
    draggable: true,
    locked: false,
    title: 'Move bag',
    rotatable: true
  });
  assert.equal(chips[1].rotatable, false);
  assert.deepEqual(InventoryZone.computed.labels(), {
    rotateAction: '\u21BB',
    removeAction: '\u2715',
    statSummaryAriaLabel: 'Artifact stat summary'
  });
  InventoryZone.methods.onContainerDragStart.call({
    $emit: (event, payload) => emitted.push([event, payload])
  }, { id: 'wide_row', event: { type: 'dragstart' } });
  InventoryZone.methods.onRotateContainer.call({
    $emit: (event, payload) => emitted.push([event, payload])
  }, { id: 'wide_row', artifactId: 'wide_bag' });
  InventoryZone.methods.onDeactivateContainer.call({
    $emit: (event, payload) => emitted.push([event, payload])
  }, { id: 'wide_row', artifactId: 'wide_bag' });
  assert.deepEqual(emitted, [
    ['bag-chip-drag-start', { bagId: 'wide_row', event: { type: 'dragstart' } }],
    ['rotate-bag', { id: 'wide_row', artifactId: 'wide_bag' }],
    ['deactivate-bag', { id: 'wide_row', artifactId: 'wide_bag' }]
  ]);
  assert.deepEqual(InventoryZone.emits, [
    'unplace', 'rotate', 'cell-drop', 'inventory-drag-start', 'drag-end',
    'deactivate-bag', 'rotate-bag', 'bag-chip-drag-start'
  ]);
  assert.match(InventoryZone.template, /CoreInventoryZone/);
  assert.match(InventoryZone.template, /#grid="/);
  assert.match(InventoryZone.template, /<artifact-grid-board/);
  assert.match(InventoryZone.template, /#footer="\{ totals, ariaLabel \}"/);
  assert.match(InventoryZone.template, /<artifact-stat-summary/);
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
      sellDragOver: true,
      draggingArtifactId: 'needle',
      lang: 'en'
    },
    t: {
      shop: 'Shop',
      refreshShop: 'Refresh',
      characterItem: 'Character',
      bagSlots: 'slots',
      sellArea: 'Sell here'
    },
    runRefreshCost: 3,
    runSellPriceLabel: '2',
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

  const wrapperContext = {
    state: {
      gameRun: { player: { coins: 2 } },
      sellDragOver: true,
      draggingArtifactId: 'needle'
    },
    t: {
      shop: 'Shop',
      refreshShop: 'Refresh',
      characterItem: 'Character',
      bagSlots: 'slots',
      sellArea: 'Sell here'
    },
    runRefreshCost: 3,
    runSellPriceLabel: '2'
  };
  assert.deepEqual(ShopZone.computed.labels.call(wrapperContext), {
    title: 'Shop',
    refresh: 'Refresh',
    refreshPricePrefix: '\uD83E\uDE99',
    pricePrefix: '\uD83E\uDE99 ',
    characterItem: 'Character',
    bagSlots: 'slots'
  });
  assert.equal(ShopZone.computed.refreshDisabled.call(wrapperContext), true);
  assert.deepEqual(ShopZone.computed.sellZone.call(wrapperContext), {
    active: true,
    draggingItemId: 'needle',
    priceLabel: '2',
    pricePrefix: '\uD83E\uDE99',
    inactivePrefix: '\uD83D\uDCB0',
    inactiveText: 'Sell here'
  });
  assert.match(ShopZone.template, /CoreShopZone/);
  assert.match(ShopZone.template, /@buy="\$emit\('buy-run-item', \$event\.artifactId\)"/);
  assert.match(ShopZone.template, /@sell-dragover="\$emit\('sell-dragover', \$event\)"/);
  assert.match(ShopZone.template, /<artifact-grid-board/);
});

test('[artifact-grid] recipe surfaces keep Mushroom compatibility over core recipe shells', () => {
  const recipe = artifactFusionRecipes[0];
  const artifactIds = [...new Set([...recipe.ingredientArtifactIds, recipe.resultArtifactId])];
  const catalog = new Map(artifactIds.map((id) => [id, {
    id,
    width: 1,
    height: 1,
    name: { en: `Name ${id}` },
    description: { en: `Description ${id}` }
  }]));
  const context = {
    getArtifact: (id) => catalog.get(id),
    state: { lang: 'en' },
    artifactName: HomeSocialSidebar.methods.artifactName,
    artifactDescription: HomeSocialSidebar.methods.artifactDescription
  };

  const sidebarRecipes = HomeSocialSidebar.computed.recipes.call(context);
  const labRecipes = FusionAnimationLabScreen.computed.recipes.call(context);

  assert.equal(sidebarRecipes.length, 1);
  assert.equal(sidebarRecipes[0].resultArtifactId, recipe.resultArtifactId);
  assert.equal(sidebarRecipes[0].resultName, `Name ${recipe.resultArtifactId}`);
  assert.equal(sidebarRecipes[0].resultDescription, `Description ${recipe.resultArtifactId}`);
  assert.equal(sidebarRecipes[0].resultStatsAriaLabel, `Name ${recipe.resultArtifactId} stats`);
  assert.deepEqual(labRecipes, sidebarRecipes);
  assert.match(HomeSocialSidebar.template, /<recipe-list/);
  assert.match(HomeSocialSidebar.template, /card-test-id="sidebar-recipe-card"/);
  assert.match(HomeSocialSidebar.template, /home-sidebar-recipe-artifact-board/);
  assert.match(FusionAnimationLabScreen.template, /<recipe-card/);
  assert.match(FusionAnimationLabScreen.template, /<recipe-list/);
  assert.match(FusionAnimationLabScreen.template, /@select="playRecipe\(\$event\.index, false\)"/);
});

test('[artifact-grid] artifact catalog browser keeps Mushroom compatibility over core shell', () => {
  const recipe = artifactFusionRecipes[0];
  const result = {
    id: recipe.resultArtifactId,
    family: 'damage',
    width: 2,
    height: 1,
    price: 4,
    name: { en: 'Fusion Result' },
    description: { en: 'A fused artifact.' }
  };
  const selectedRecipe = {
    ...recipe,
    ingredients: recipe.ingredientArtifactIds.map((id) => ({ id, width: 1, height: 1 })),
    result
  };
  const context = {
    state: { lang: 'en', bootstrap: { artifacts: [result] } },
    t: {
      artifactCatalogAll: 'All',
      artifactCatalogGridTitle: 'Catalog',
      artifactCatalogCloseDetails: 'Close',
      recipeIngredients: 'Ingredients',
      recipeFusionOnly: 'Fusion',
      artifactCatalogFootprint: 'Footprint',
      artifactCatalogPrice: 'Price',
      artifactCatalogFamily: 'Family',
      artifactCatalogSlots: 'Slots',
      artifactFamily_damage: 'Damage'
    },
    selectedArtifact: result,
    selectedRecipe,
    selectedOrientation: { width: 2, height: 1 },
    selectedPreviewItem: [{ artifactId: result.id, x: 0, y: 0, width: 2, height: 1 }],
    selectedDescription: 'A fused artifact.',
    artifactName: ArtifactCatalogBrowser.methods.artifactName,
    familyLabel: ArtifactCatalogBrowser.methods.familyLabel,
    footprintLabel: ArtifactCatalogBrowser.methods.footprintLabel,
    priceLabel: ArtifactCatalogBrowser.methods.priceLabel,
    previewOrientation: ArtifactCatalogBrowser.methods.previewOrientation
  };

  assert.deepEqual(ArtifactCatalogBrowser.computed.catalogLabels.call(context), {
    all: 'All',
    gridTitle: 'Catalog',
    closeDetails: 'Close',
    ingredients: 'Ingredients'
  });
  assert.deepEqual(ArtifactCatalogBrowser.computed.selectedCatalogItem.call(context), {
    id: recipe.resultArtifactId,
    title: 'Fusion Result',
    description: 'A fused artifact.',
    kicker: 'Fusion',
    orientation: { width: 2, height: 1 },
    previewItem: [{ artifactId: result.id, x: 0, y: 0, width: 2, height: 1 }],
    statsAriaLabel: 'Fusion Result stats',
    facts: [
      { key: 'footprint', label: 'Footprint', value: '2x1' },
      { key: 'price', label: 'Price', value: 4 },
      { key: 'family', label: 'Family', value: 'Damage' },
      { key: 'slots', label: 'Slots', value: 0, visible: false }
    ]
  });
  assert.match(ArtifactCatalogBrowser.template, /<core-artifact-catalog-browser/);
  assert.match(ArtifactCatalogBrowser.template, /#group-board/);
  assert.match(ArtifactCatalogBrowser.template, /#detail-stats/);
  assert.match(ArtifactCatalogBrowser.template, /#recipe-artifact/);
});
