import { defineConfig } from '@playwright/test';
import puppeteer from 'puppeteer';

const testBackendPort = Number(process.env.PLAYWRIGHT_TEST_BACKEND_PORT || 3321);
const testFrontendPort = Number(process.env.PLAYWRIGHT_TEST_FRONTEND_PORT || 4374);
const testBackendOrigin = `http://127.0.0.1:${testBackendPort}`;
const testFrontendOrigin = `http://127.0.0.1:${testFrontendPort}`;
const replayAutoplayMs = process.env.VITE_REPLAY_AUTOPLAY_MS || '320';
const replayAutoplayFastMs = process.env.VITE_REPLAY_AUTOPLAY_FAST_MS || '180';

export default defineConfig({
  testDir: '/Users/microwavedev/workspace/mushroom-master/tests/game',
  testMatch: '*.spec.js',
  timeout: 120000,
  // One retry as a safety net for any residual flake. Root causes are
  // addressed by:
  //   - serving a prebuilt bundle (no cold-Vite compile race)
  //   - deterministic `prep-ready` data-testid (no containerItems projection race)
  //   - dev-only /api/dev/game-run/:id/force-shop (no RNG/pity polling)
  // See docs/flaky-tests.md.
  retries: 1,
  // All workers share a single Express server and SQLite database. Parallel
  // workers cause `resetDb()` races — one worker's DB reset closes the
  // connection while others are mid-test, producing SQLITE_MISUSE errors.
  // Serialize until per-worker DB isolation is implemented.
  //
  // Future: per-worker backends (unique SQLITE_STORAGE + PORT per workerIndex)
  // would allow workers: 4, but requires a frontend proxy or dynamic backend
  // origin — the Vite build bakes in VITE_BACKEND_ORIGIN at compile time.
  workers: 1,
  use: {
    baseURL: testFrontendOrigin,
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      executablePath: puppeteer.executablePath()
    },
    viewport: {
      width: 430,
      height: 932
    }
  },
  webServer: [
    {
      command: `PORT=${testBackendPort} node app/server/start.js`,
      port: testBackendPort,
      reuseExistingServer: false,
      cwd: '/Users/microwavedev/workspace/mushroom-master'
    },
    {
      // Build once, then preview the static bundle. Using `vite dev` for
      // tests causes a cold-start compile race where the first few tests
      // interact with the UI before Vue's reactive state catches up with
      // the server response. A prebuilt bundle has no compile step, so
      // every test sees a warm, deterministic load. See docs/flaky-tests.md.
      command: `VITE_BACKEND_ORIGIN=${testBackendOrigin} VITE_DEV_PORT=${testFrontendPort} VITE_REPLAY_AUTOPLAY_MS=${replayAutoplayMs} VITE_REPLAY_AUTOPLAY_FAST_MS=${replayAutoplayFastMs} npx vite build --config web/vite.config.js && VITE_BACKEND_ORIGIN=${testBackendOrigin} VITE_DEV_PORT=${testFrontendPort} npx vite preview --config web/vite.config.js --host 127.0.0.1 --port ${testFrontendPort} --strictPort`,
      port: testFrontendPort,
      reuseExistingServer: false,
      cwd: '/Users/microwavedev/workspace/mushroom-master',
      // Build adds ~20-30s to cold start; bump timeout generously.
      timeout: 180000
    }
  ]
});
