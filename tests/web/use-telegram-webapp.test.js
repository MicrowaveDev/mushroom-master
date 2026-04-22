import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWebAppAdapter, versionAtLeast } from '../../web/src/composables/useTelegramWebApp.js';

function makeRoot() {
  const values = new Map();
  return {
    values,
    style: {
      setProperty(name, value) {
        values.set(name, value);
      }
    }
  };
}

test('[telegram-webapp] version comparison handles dotted versions', () => {
  assert.equal(versionAtLeast('8.0', '8.0'), true);
  assert.equal(versionAtLeast('8.1', '8.0'), true);
  assert.equal(versionAtLeast('7.10', '8.0'), false);
  assert.equal(versionAtLeast('9.0.1', '9.0'), true);
});

test('[telegram-webapp] adapter no-ops outside Telegram', () => {
  const root = makeRoot();
  const adapter = createTelegramWebAppAdapter({ win: { innerHeight: 667 }, root });

  assert.equal(adapter.isTelegramAvailable(), false);
  assert.equal(adapter.isVersionAtLeast('8.0'), false);
  assert.doesNotThrow(() => adapter.impact('light'));
  assert.doesNotThrow(() => adapter.notify('error'));
  assert.doesNotThrow(() => adapter.selectionChanged());
  adapter.syncViewportVars();

  assert.equal(root.values.get('--tg-viewport-height-local'), '667px');
  assert.equal(root.values.get('--tg-viewport-stable-height-local'), '667px');
});

test('[telegram-webapp] adapter syncs theme, viewport, safe areas, and haptics', () => {
  const root = makeRoot();
  const calls = [];
  const handlers = new Map();
  const webApp = {
    version: '8.0',
    viewportHeight: 612,
    viewportStableHeight: 600,
    safeAreaInset: { top: 10, right: 2, bottom: 20, left: 2 },
    contentSafeAreaInset: { top: 4, right: 1, bottom: 12, left: 1 },
    themeParams: { button_color: '#123456', secondary_bg_color: '#abcdef' },
    ready: () => calls.push('ready'),
    expand: () => calls.push('expand'),
    onEvent: (name, handler) => handlers.set(name, handler),
    offEvent: (name, handler) => {
      if (handlers.get(name) === handler) handlers.delete(name);
    },
    HapticFeedback: {
      impactOccurred: (type) => calls.push(`impact:${type}`),
      notificationOccurred: (type) => calls.push(`notify:${type}`),
      selectionChanged: () => calls.push('selection')
    }
  };
  const adapter = createTelegramWebAppAdapter({
    win: { innerHeight: 667, Telegram: { WebApp: webApp } },
    root
  });

  const cleanup = adapter.init();
  adapter.impact('medium');
  adapter.notify('success');
  adapter.selectionChanged();

  assert.equal(adapter.isTelegramAvailable(), true);
  assert.equal(adapter.isVersionAtLeast('8.0'), true);
  assert.equal(root.values.get('--tg-viewport-height-local'), '612px');
  assert.equal(root.values.get('--tg-viewport-stable-height-local'), '600px');
  assert.equal(root.values.get('--telegram-content-safe-area-bottom'), '12px');
  assert.equal(root.values.get('--telegram-accent'), '#123456');
  assert.deepEqual(calls, ['ready', 'expand', 'impact:medium', 'notify:success', 'selection']);
  assert.ok(handlers.has('viewportChanged'));

  cleanup();
  assert.equal(handlers.size, 0);
});
