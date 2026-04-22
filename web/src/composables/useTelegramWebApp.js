function getDefaultRoot() {
  return typeof document === 'undefined' ? null : document.documentElement;
}

function getDefaultWindow() {
  return typeof window === 'undefined' ? null : window;
}

function readTelegramWebApp(win = getDefaultWindow()) {
  return win?.Telegram?.WebApp || null;
}

function parseVersion(version) {
  return String(version || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function versionAtLeast(current, minimum) {
  const currentParts = parseVersion(current);
  const minimumParts = parseVersion(minimum);
  const length = Math.max(currentParts.length, minimumParts.length);
  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] || 0;
    const minimumPart = minimumParts[index] || 0;
    if (currentPart > minimumPart) return true;
    if (currentPart < minimumPart) return false;
  }
  return true;
}

function setCssPx(root, name, value) {
  const numeric = Number(value);
  if (!root?.style || !Number.isFinite(numeric) || numeric <= 0) return;
  root.style.setProperty(name, `${numeric}px`);
}

function callSafely(callback) {
  try {
    callback();
  } catch (_error) {
    // Telegram clients differ by version/platform. Integration helpers are
    // progressive enhancement and must never break browser/dev mode.
  }
}

export function createTelegramWebAppAdapter({ win = getDefaultWindow(), root = getDefaultRoot() } = {}) {
  const getWebApp = () => readTelegramWebApp(win);
  const isTelegramAvailable = () => !!getWebApp();

  function isVersionAtLeast(version) {
    const tg = getWebApp();
    if (!tg?.version) return false;
    if (typeof tg.isVersionAtLeast === 'function') {
      try {
        return !!tg.isVersionAtLeast(version);
      } catch (_error) {
        return versionAtLeast(tg.version, version);
      }
    }
    return versionAtLeast(tg.version, version);
  }

  function syncViewportVars(targetRoot = root) {
    if (!targetRoot?.style) return;
    const tg = getWebApp();
    const fallbackHeight = win?.innerHeight;
    setCssPx(targetRoot, '--tg-viewport-height-local', tg?.viewportHeight || fallbackHeight);
    setCssPx(targetRoot, '--tg-viewport-stable-height-local', tg?.viewportStableHeight || tg?.viewportHeight || fallbackHeight);

    const safeArea = tg?.safeAreaInset || {};
    const contentSafeArea = tg?.contentSafeAreaInset || {};
    setCssPx(targetRoot, '--telegram-safe-area-top', safeArea.top);
    setCssPx(targetRoot, '--telegram-safe-area-right', safeArea.right);
    setCssPx(targetRoot, '--telegram-safe-area-bottom', safeArea.bottom);
    setCssPx(targetRoot, '--telegram-safe-area-left', safeArea.left);
    setCssPx(targetRoot, '--telegram-content-safe-area-top', contentSafeArea.top);
    setCssPx(targetRoot, '--telegram-content-safe-area-right', contentSafeArea.right);
    setCssPx(targetRoot, '--telegram-content-safe-area-bottom', contentSafeArea.bottom);
    setCssPx(targetRoot, '--telegram-content-safe-area-left', contentSafeArea.left);
  }

  function applyTelegramTheme(targetRoot = root) {
    const tg = getWebApp();
    if (!tg || !targetRoot?.style) return;
    const theme = tg.themeParams || {};
    targetRoot.style.setProperty('--telegram-accent', theme.button_color || '#7b5b3b');
    targetRoot.style.setProperty('--telegram-surface', theme.secondary_bg_color || '#f6f0df');
    if (theme.bg_color) targetRoot.style.setProperty('--telegram-bg', theme.bg_color);
    if (theme.text_color) targetRoot.style.setProperty('--telegram-text', theme.text_color);
  }

  function impact(type = 'light') {
    const tg = getWebApp();
    callSafely(() => tg?.HapticFeedback?.impactOccurred?.(type));
  }

  function notify(type = 'success') {
    const tg = getWebApp();
    callSafely(() => tg?.HapticFeedback?.notificationOccurred?.(type));
  }

  function selectionChanged() {
    const tg = getWebApp();
    callSafely(() => tg?.HapticFeedback?.selectionChanged?.());
  }

  function init() {
    const tg = getWebApp();
    syncViewportVars();
    applyTelegramTheme();
    if (!tg) return () => {};

    callSafely(() => tg.ready?.());
    callSafely(() => tg.expand?.());

    const syncAll = () => {
      syncViewportVars();
      applyTelegramTheme();
    };
    const events = ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'themeChanged'];
    for (const eventName of events) {
      callSafely(() => tg.onEvent?.(eventName, syncAll));
    }
    return () => {
      for (const eventName of events) {
        callSafely(() => tg.offEvent?.(eventName, syncAll));
      }
    };
  }

  return {
    getWebApp,
    isTelegramAvailable,
    isVersionAtLeast,
    syncViewportVars,
    applyTelegramTheme,
    impact,
    notify,
    selectionChanged,
    init
  };
}

export function useTelegramWebApp(options) {
  return createTelegramWebAppAdapter(options);
}

export { versionAtLeast };
