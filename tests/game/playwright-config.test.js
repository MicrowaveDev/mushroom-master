import test from 'node:test';
import assert from 'node:assert/strict';
import config from './playwright.config.js';

test('[e2e-db] Playwright backend uses isolated sqlite storage', () => {
  const backend = Array.isArray(config.webServer) ? config.webServer[0] : null;
  assert.ok(backend?.command, 'backend webServer command must exist');
  assert.match(
    backend.command,
    /SQLITE_STORAGE=tmp\/playwright-e2e-\$\{?testBackendPort\}?|SQLITE_STORAGE=tmp\/playwright-e2e-\d+\.sqlite/,
    'Playwright must not reset the live dev sqlite database'
  );
  assert.doesNotMatch(
    backend.command,
    /telegram-autobattler-dev\.sqlite/,
    'Playwright backend must not use the shared dev sqlite file'
  );
});
