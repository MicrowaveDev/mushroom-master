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
  runComplete: 'gameRunId'
};

const SCREEN_ROUTES = {
  runSummary: 'run-summary',
  runComplete: 'run-complete'
};

const ROUTE_SCREENS = Object.fromEntries(
  Object.entries(SCREEN_ROUTES).map(([screen, route]) => [route, screen])
);

export function parseStartParams() {
  const path = window.location.pathname.replace(/^\/+/, '');
  const parts = path.split('/').filter(Boolean);
  const screen = ROUTE_SCREENS[parts[0]] || parts[0] || null;
  const result = { screen, challenge: null, replay: null, gameRunId: null };

  if (screen && ROUTE_PARAMS[screen] && parts[1]) {
    result[ROUTE_PARAMS[screen]] = decodeURIComponent(parts[1]);
  }

  return result;
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
