function defaultWindow() {
  return typeof window === 'undefined' ? null : window;
}

function defaultLocation(win = defaultWindow()) {
  return win?.location || null;
}

export function getTelegramWebApp(win = defaultWindow()) {
  return win?.Telegram?.WebApp || null;
}

export function isTelegramMiniAppEnvironment(win = defaultWindow()) {
  return !!getTelegramWebApp(win);
}

export function normalizeTelegramBotUsername(botUsername) {
  return String(botUsername || '').trim().replace(/^@+/, '');
}

export function buildFriendRefParam(friendCode) {
  return `ref_${String(friendCode || '').trim()}`;
}

export function buildTelegramMiniAppLink({ botUsername, startParam }) {
  const username = normalizeTelegramBotUsername(botUsername);
  if (!username) return '';
  const suffix = startParam ? `?startapp=${encodeURIComponent(startParam)}` : '';
  return `https://t.me/${username}/app${suffix}`;
}

export function buildWebsiteFriendInviteLink({ friendCode, location = defaultLocation() }) {
  const origin = location?.origin || 'https://example.com';
  const url = new URL('/friends', origin);
  if (friendCode) url.searchParams.set('ref', String(friendCode));
  return url.toString();
}

export function buildFriendInviteLink({
  friendCode,
  botUsername,
  win = defaultWindow(),
  location = defaultLocation(win)
} = {}) {
  const startParam = buildFriendRefParam(friendCode);
  if (isTelegramMiniAppEnvironment(win) && normalizeTelegramBotUsername(botUsername)) {
    return buildTelegramMiniAppLink({ botUsername, startParam });
  }
  return buildWebsiteFriendInviteLink({ friendCode, location });
}
