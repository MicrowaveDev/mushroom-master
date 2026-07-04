import { createBackpackGameClient } from '@microwavedev/backpack-game-core/client';

// Route mapping: internal Vue screen ids stay stable, while public URL paths
// use lowercase separated words (`run-complete`, `run-summary`, `game-run`).
// Screens listed here support `/path/:param` deep links.
// `game-run` supports `/game-run/:gameRunId` so active runs are bookmarkable and
// shareable (docs/loadout-refactor-plan.md §2.7).
const ROUTE_PARAMS = {
  replay: 'replay',
  friends: 'challenge',
  'game-run': 'gameRunId',
  runSummary: 'gameRunId',
  runComplete: 'gameRunId',
  profile: 'profilePlayerId'
};

const SCREEN_ROUTES = {
  runSummary: 'run-summary',
  runComplete: 'run-complete',
  supportAdmin: 'support-admin'
};

const ROUTE_SCREENS = Object.fromEntries(
  Object.entries(SCREEN_ROUTES).map(([screen, route]) => [route, screen])
);

export const MUSHROOM_GAME_API_ROUTES = {
  appConfig: '/api/app-config',
  characters: '/api/characters',
  artifacts: '/api/artifacts',
  bootstrap: '/api/bootstrap',
  friends: '/api/friends',
  friendsAddByCode: '/api/friends/add-by-code',
  friendChallenges: '/api/friends/challenges',
  friendChallenge: '/api/friends/challenges/:challengeId',
  friendChallengeAccept: '/api/friends/challenges/:challengeId/accept',
  friendChallengeDecline: '/api/friends/challenges/:challengeId/decline',
  leaderboard: '/api/leaderboard',
  wikiHome: '/api/wiki/home',
  wikiEntry: '/api/wiki/:section/:slug',
  settings: '/api/settings',
  telegramAuthCode: '/api/auth/telegram/code',
  webAuth: '/api/auth/web',
  devSession: '/api/dev/session',
  authLogout: '/api/auth/logout',
  activeCharacter: '/api/active-character',
  gameRunStart: '/api/game-run/start',
  gameRun: '/api/game-run/:gameRunId',
  gameRunReady: '/api/game-run/:gameRunId/ready',
  gameRunAbandon: '/api/game-run/:gameRunId/abandon',
  gameRunRefreshShop: '/api/game-run/:gameRunId/refresh-shop',
  gameRunSell: '/api/game-run/:gameRunId/sell',
  gameRunBuy: '/api/game-run/:gameRunId/buy',
  artifactLoadout: '/api/artifact-loadout',
  battle: '/api/battles/:battleId',
  localBattleNarration: '/api/local-tests/battle-narration',
  devInventoryReview: '/api/dev/inventory-review',
  switchPortrait: '/api/mushroom/:mushroomId/portrait',
  switchPreset: '/api/mushroom/:mushroomId/preset',
  purchaseAsset: '/api/assets/:assetId/purchase',
  assetPackRoll: '/api/assets/packs/:packId/roll',
  assetPackBurn: '/api/assets/packs/:packId/burn',
  walletBundles: '/api/wallet/bundles',
  walletPurchaseIntents: '/api/wallet/purchase-intents'
};

export function createMushroomGameApiClient(sessionKey = '', options = {}) {
  const {
    routes = {},
    getAuthHeaders,
    unwrapDataEnvelope = true,
    ...clientOptions
  } = options;
  return createBackpackGameClient({
    ...clientOptions,
    unwrapDataEnvelope,
    routes: {
      ...MUSHROOM_GAME_API_ROUTES,
      ...routes
    },
    getAuthHeaders: getAuthHeaders || (() => (
      sessionKey ? { 'X-Session-Key': sessionKey } : {}
    ))
  });
}

export function parseStartParams() {
  const path = window.location.pathname.replace(/^\/+/, '');
  const parts = path.split('/').filter(Boolean);
  const screen = ROUTE_SCREENS[parts[0]] || parts[0] || null;
  const searchParams = new URLSearchParams(window.location.search || '');
  const result = {
    screen,
    challenge: null,
    replay: null,
    gameRunId: null,
    profilePlayerId: null,
    telegramGameContext: parseTelegramGameContext(searchParams)
  };

  if (screen && ROUTE_PARAMS[screen] && parts[1]) {
    result[ROUTE_PARAMS[screen]] = decodeURIComponent(parts[1]);
  }

  return result;
}

export function parseTelegramGameContext(searchParams = new URLSearchParams()) {
  const chatId = searchParams.get('tgGameChatId');
  const messageId = searchParams.get('tgGameMessageId');
  const inlineMessageId = searchParams.get('tgInlineMessageId');
  const gameShortName = searchParams.get('tgGame');
  const chatInstance = searchParams.get('tgChatInstance');
  if (!chatId && !messageId && !inlineMessageId && !gameShortName && !chatInstance) return null;
  return {
    gameShortName,
    chatInstance,
    chatId,
    messageId,
    inlineMessageId
  };
}

export function setScreenQuery(screen, extra = {}, options = {}) {
  if (options.skipHistory) return;
  let path = `/${SCREEN_ROUTES[screen] || screen}`;
  const paramKey = ROUTE_PARAMS[screen];
  if (paramKey && extra[paramKey]) {
    path += `/${encodeURIComponent(extra[paramKey])}`;
  }
  if (window.location.pathname === path) return;
  const method = options.replaceHistory ? 'replaceState' : 'pushState';
  window.history[method]({}, '', path);
}
