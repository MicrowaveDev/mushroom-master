import { defineConfig } from '@playwright/test';
import puppeteer from 'puppeteer';

const testBackendPort = 3321;
const testFrontendPort = 4374;
const testBackendOrigin = `http://127.0.0.1:${testBackendPort}`;
const testFrontendOrigin = `http://127.0.0.1:${testFrontendPort}`;

export default defineConfig({
  testDir: '/Users/microwavedev/workspace/mushroom-master/tests/game',
  testMatch: '*.spec.js',
  timeout: 120000,
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
      command: `VITE_BACKEND_ORIGIN=${testBackendOrigin} VITE_DEV_PORT=${testFrontendPort} npx vite --config web/vite.config.js --host 127.0.0.1 --port ${testFrontendPort}`,
      port: testFrontendPort,
      reuseExistingServer: false,
      cwd: '/Users/microwavedev/workspace/mushroom-master'
    }
  ]
});
