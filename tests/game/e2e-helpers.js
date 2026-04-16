import fs from 'fs/promises';
import path from 'path';

/**
 * Shared helpers for Playwright E2E specs.
 *
 * All four spec files (solo-run, challenge-run, coverage-gaps, screenshots)
 * duplicated these functions. Centralising them here prevents drift and
 * makes the test-setup boilerplate a one-liner.
 */

export async function resetDevDb(request) {
  const response = await request.post('/api/dev/reset', { data: {} });
  const json = await response.json();
  if (!json.success) throw new Error(`dev reset failed: ${JSON.stringify(json)}`);
}

export async function createSession(request, payload) {
  const response = await request.post('/api/dev/session', { data: payload });
  const json = await response.json();
  if (!json.success) throw new Error(`dev session failed: ${JSON.stringify(json)}`);
  return json.data;
}

export async function api(request, sessionKey, url, method = 'GET', data = undefined) {
  const response = await request.fetch(url, {
    method,
    headers: { 'X-Session-Key': sessionKey },
    data
  });
  const json = await response.json();
  if (!json.success) throw new Error(`api call failed for ${url}: ${JSON.stringify(json)}`);
  return json.data;
}

export function makeSaveShot(screenshotDir) {
  return async function saveShot(page, name) {
    await fs.mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
  };
}

/**
 * Wait for the prep screen's deterministic "ready" signal. PrepScreen sets
 * `data-testid="prep-ready"` on the root only after `refreshBootstrap`
 * finishes projecting `loadoutItems` into `containerItems`. Tests should
 * always wait on this before interacting, to avoid racing Vue's reactive
 * update against the server response. See docs/flaky-tests.md.
 */
export async function waitForPrepReady(page, timeout = 15000) {
  await page.locator('[data-testid="prep-ready"]').waitFor({ timeout });
}

// Canonical viewport per docs/user-flows.md preamble + AGENTS.md.
export const MOBILE_VIEWPORT = { width: 375, height: 667 };
