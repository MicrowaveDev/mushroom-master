export function parseStartParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    screen: params.get('screen'),
    challenge: params.get('challenge'),
    replay: params.get('replay')
  };
}

export function setScreenQuery(screen, extra = {}) {
  const params = new URLSearchParams(window.location.search);
  params.set('screen', screen);
  Object.entries(extra).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
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
