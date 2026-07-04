import assert from 'node:assert/strict';
import test from 'node:test';
import { useGameRun } from '../../web/src/composables/useGameRun.js';

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      }
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

test('useGameRun routes run mutations through the shared route client', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const artifacts = [
    { id: 'starter_bag', family: 'bag', width: 2, height: 2, price: 1 },
    { id: 'blade', family: 'weapon', width: 1, height: 1, price: 1 }
  ];
  const state = {
    sessionKey: 'session_run',
    lang: 'en',
    error: '',
    startingRun: false,
    actionInFlight: false,
    bootstrap: {
      activeMushroomId: 'thalla',
      artifacts,
      activeGameRun: null,
      activeGameRuns: [],
      battleLimit: { used: 0, limit: 5 }
    },
    gameRun: null,
    gameRunRounds: [],
    gameRunResult: null,
    gameRunShopOffer: [],
    gameRunRefreshCount: 0,
    builderItems: [],
    containerItems: [],
    activeBags: [],
    rotatedBags: [],
    freshPurchases: [],
    fusionRevealQueue: [],
    sellDragOver: false,
    draggingArtifactId: '',
    draggingItem: null,
    draggingSource: ''
  };
  const navigation = [];
  let impactCount = 0;
  let selectionCount = 0;

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const payloads = {
      '/api/game-run/start': {
        id: 'run_1',
        mushroomId: 'thalla',
        mode: 'solo',
        status: 'active',
        currentRound: 1,
        player: { coins: 5 },
        shopOffer: ['blade'],
        loadoutItems: []
      },
      '/api/artifact-loadout': { ok: true },
      '/api/game-run/run_1/ready': { id: 'run_1', waiting: true },
      '/api/game-run/run_1/refresh-shop': { shopOffer: ['blade'], refreshCount: 1, coins: 4 },
      '/api/game-run/run_1/buy': { id: 'row_blade', artifactId: 'blade', coins: 3, shopOffer: [] },
      '/api/game-run/run_1/sell': { id: 'row_blade', artifactId: 'blade', coins: 4 }
    };
    return jsonResponse({ success: true, data: payloads[url] });
  };

  try {
    const gameRun = useGameRun(
      state,
      (screen, extra, options) => navigation.push({ screen, extra, options }),
      (artifactId) => artifacts.find((artifact) => artifact.id === artifactId) || null,
      async () => {},
      async () => {},
      {
        impact() {
          impactCount += 1;
        },
        selectionChanged() {
          selectionCount += 1;
        },
        notify() {}
      }
    );

    await gameRun.startNewGameRun('solo', { skipTransition: true });
    await gameRun.persistRunLoadout();
    await gameRun.signalReady();
    await gameRun.refreshRunShop();
    await gameRun.buyRunShopItem('blade');
    state.containerItems = [...state.containerItems, { id: 'row_blade_duplicate', artifactId: 'blade' }];
    state.freshPurchases = [...state.freshPurchases, 'blade'];
    await gameRun.sellRunItemAction({ id: 'row_blade', artifactId: 'blade' });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(state.gameRun.id, 'run_1');
  assert.equal(state.gameRun.player.coins, 4);
  assert.deepEqual(state.gameRunShopOffer, []);
  assert.deepEqual(state.containerItems, [{ id: 'row_blade_duplicate', artifactId: 'blade' }]);
  assert.deepEqual(state.freshPurchases, ['blade']);
  assert.equal(impactCount, 3);
  assert.equal(selectionCount, 1);
  assert.deepEqual(navigation, [
    { screen: 'prep', extra: {}, options: { skipTransition: true } }
  ]);
  assert.deepEqual(calls.map((call) => `${call.init.method} ${call.url}`), [
    'POST /api/game-run/start',
    'PUT /api/artifact-loadout',
    'PUT /api/artifact-loadout',
    'POST /api/game-run/run_1/ready',
    'POST /api/game-run/run_1/refresh-shop',
    'POST /api/game-run/run_1/buy',
    'POST /api/game-run/run_1/sell'
  ]);
  assert.ok(calls.every((call) => call.init.headers['X-Session-Key'] === 'session_run'));
  assert.deepEqual(JSON.parse(calls[0].init.body), { mode: 'solo' });
  assert.deepEqual(JSON.parse(calls[1].init.body), { mushroomId: 'thalla', items: [] });
  assert.equal(calls[3].init.body, undefined);
  assert.deepEqual(JSON.parse(calls[5].init.body), { artifactId: 'blade' });
  assert.deepEqual(JSON.parse(calls[6].init.body), { id: 'row_blade', artifactId: 'blade' });
});

test('useGameRun applies shared game-run response patches', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const artifacts = [
    { id: 'starter_bag', family: 'bag', width: 2, height: 2, price: 1 },
    { id: 'blade', family: 'weapon', width: 1, height: 1, price: 1 }
  ];
  const state = {
    sessionKey: 'session_run',
    lang: 'en',
    error: '',
    startingRun: false,
    actionInFlight: false,
    bootstrap: {
      activeMushroomId: null,
      artifacts,
      activeGameRun: null,
      activeGameRuns: [],
      battleLimit: { used: 0, limit: 5 }
    },
    gameRun: null,
    gameRunRounds: [],
    gameRunResult: null,
    gameRunShopOffer: [],
    gameRunRefreshCount: 0,
    builderItems: [],
    containerItems: [],
    activeBags: [],
    rotatedBags: [],
    freshPurchases: [],
    fusionRevealQueue: [],
    sellDragOver: false,
    draggingArtifactId: '',
    draggingItem: null,
    draggingSource: ''
  };
  const navigation = [];
  const replayLoads = [];

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const payloads = {
      '/api/game-run/start': {
        id: 'run_2',
        mushroomId: 'thalla',
        mode: 'solo',
        status: 'active',
        currentRound: 1,
        player: { coins: 5 },
        shopOffer: ['blade']
      },
      '/api/game-run/run_2/ready': {
        id: 'run_2',
        status: 'active',
        currentRound: 2,
        player: { coins: 6 },
        lastRound: { roundNumber: 1, battleId: 'battle_1' },
        battle: { id: 'battle_1' },
        loadoutItems: [{ id: 'row_blade', artifactId: 'blade', x: -1, y: -1, width: 1, height: 1 }],
        shopOffer: ['starter_bag'],
        fusions: [{ id: 'fusion_1' }]
      },
      '/api/game-run/run_done': {
        id: 'run_done',
        mode: 'solo',
        status: 'completed',
        currentRound: 4,
        endedAt: 'now',
        completionBonus: { softCoin: 5 },
        achievements: [{ id: 'ach_1' }],
        player: { coins: 9 },
        rounds: [{ roundNumber: 1 }]
      }
    };
    return jsonResponse({ success: true, data: payloads[url] });
  };

  try {
    const gameRun = useGameRun(
      state,
      (screen, extra, options) => navigation.push({ screen, extra, options }),
      (artifactId) => artifacts.find((artifact) => artifact.id === artifactId) || null,
      async () => {},
      async (battleId, options) => replayLoads.push({ battleId, options }),
      { impact() {}, selectionChanged() {}, notify() {} }
    );

    await gameRun.startNewGameRun('solo');
    await gameRun.signalReady();
    await gameRun.continueToNextRound();
    await gameRun.loadRunComplete('run_done', { routeOptions: { replace: true } });
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.deepEqual(replayLoads, [{ battleId: 'battle_1', options: { battle: { id: 'battle_1' } } }]);
  assert.deepEqual(state.containerItems, [{ id: 'row_blade', artifactId: 'blade' }]);
  assert.deepEqual(state.gameRunShopOffer, ['starter_bag']);
  assert.deepEqual(state.fusionRevealQueue, [{ id: 'fusion_1' }]);
  assert.equal(state.bootstrap.activeGameRun.shopOffer[0], 'starter_bag');
  assert.equal(state.gameRun.id, 'run_done');
  assert.equal(state.gameRun.status, 'completed');
  assert.deepEqual(state.gameRunResult.achievements, [{ id: 'ach_1' }]);
  assert.deepEqual(state.gameRunRounds, [{ roundNumber: 1 }]);
  assert.deepEqual(navigation, [
    { screen: 'prep', extra: {}, options: { skipTransition: false } },
    { screen: 'prep', extra: undefined, options: undefined },
    { screen: 'runComplete', extra: { gameRunId: 'run_done' }, options: { replace: true } }
  ]);
  assert.deepEqual(calls.map((call) => `${call.init.method} ${call.url}`), [
    'POST /api/game-run/start',
    'POST /api/game-run/run_2/ready',
    'GET /api/game-run/run_done'
  ]);
});
