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

export function apiHeaders(sessionKey) {
  return sessionKey
    ? {
        'Content-Type': 'application/json',
        'X-Session-Key': sessionKey
      }
    : { 'Content-Type': 'application/json' };
}

export async function apiJson(path, options = {}, sessionKey = '') {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      ...(sessionKey ? { 'X-Session-Key': sessionKey } : {})
    }
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || 'Request failed');
  }
  return json.data;
}
