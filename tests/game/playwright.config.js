import { defineConfig } from '@playwright/test';
import puppeteer from 'puppeteer';

export default defineConfig({
  testDir: '/Users/microwavedev/workspace/mushroom-master/tests/game',
  testMatch: '*.spec.js',
  timeout: 120000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
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
      command: 'PORT=3021 node app/server/start.js',
      port: 3021,
      reuseExistingServer: false,
      cwd: '/Users/microwavedev/workspace/mushroom-master'
    },
    {
      command: 'npx vite --config web/vite.config.js --host 127.0.0.1 --port 4174',
      port: 4174,
      reuseExistingServer: false,
      cwd: '/Users/microwavedev/workspace/mushroom-master'
    }
  ]
});
