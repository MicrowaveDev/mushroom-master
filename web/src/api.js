// Route param mapping: which extra key becomes the path segment for each screen
const ROUTE_PARAMS = {
  replay: 'replay',
  friends: 'challenge'
};

export function parseStartParams() {
  const path = window.location.pathname.replace(/^\/+/, '');
  const parts = path.split('/').filter(Boolean);
  const screen = parts[0] || null;
  const result = { screen, challenge: null, replay: null };

  if (screen && ROUTE_PARAMS[screen] && parts[1]) {
    result[ROUTE_PARAMS[screen]] = decodeURIComponent(parts[1]);
  }

  return result;
}

export function setScreenQuery(screen, extra = {}) {
  let path = `/${screen}`;
  const paramKey = ROUTE_PARAMS[screen];
  if (paramKey && extra[paramKey]) {
    path += `/${encodeURIComponent(extra[paramKey])}`;
  }
  window.history.replaceState({}, '', path);
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
