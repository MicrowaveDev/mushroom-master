import { defineConfig } from '@playwright/test';
import puppeteer from 'puppeteer';

export default defineConfig({
  testDir: '/Users/microwavedev/workspace/mushroom-master/tests/game',
  testMatch: 'screenshots.spec.js',
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
  webServer: {
    command: 'PORT=4174 node app/server/start.js',
    port: 4174,
    reuseExistingServer: false,
    cwd: '/Users/microwavedev/workspace/mushroom-master'
  }
});
