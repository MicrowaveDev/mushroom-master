import { fileURLToPath } from 'node:url';
import { repoRoot } from '../../shared/repo-root.js';
import {
  findFreePort,
  parseSuiteRunnerArgs,
  runConfiguredSuite
} from '@microwavedev/backpack-game-core/tooling/runners';

export const PLAYWRIGHT_SUITES = Object.freeze({
  e2e: [],
  screens: ['tests/game/screenshots.spec.js', 'tests/game/home-field-preview.spec.js']
});

export const PLAYWRIGHT_RUNNER_USAGE = `Usage: node app/scripts/runners/run-game-playwright.js [options]

Options:
  --suite=e2e|screens  Select the Playwright suite (default: e2e)
  --debug              Enable screenshot-suite debug logs
  --help, -h           Show this help`;

export function parsePlaywrightRunnerArgs(argv) {
  try {
    return parseSuiteRunnerArgs(argv, {
      suites: PLAYWRIGHT_SUITES,
      defaultSuite: 'e2e',
      extraFlags: ['debug']
    });
  } catch (error) {
    throw new Error(error.message.replace('Unknown suite', 'Unknown Playwright suite'));
  }
}

export function buildPlaywrightArgs({ suite }) {
  return ['playwright', 'test', ...PLAYWRIGHT_SUITES[suite], '--config=tests/game/playwright.config.js', '--reporter=line'];
}

export function buildPlaywrightEnv({ suite, debug, backendPort, frontendPort }, env = process.env) {
  return {
    ...env,
    PLAYWRIGHT_TEST_BACKEND_PORT: String(backendPort),
    PLAYWRIGHT_TEST_FRONTEND_PORT: String(frontendPort),
    PLAYWRIGHT_SCREEN_DEBUG: suite === 'screens' && debug ? '1' : env.PLAYWRIGHT_SCREEN_DEBUG || '',
    VITE_REPLAY_AUTOPLAY_MS: env.VITE_REPLAY_AUTOPLAY_MS || '320',
    VITE_REPLAY_AUTOPLAY_FAST_MS: env.VITE_REPLAY_AUTOPLAY_FAST_MS || '180'
  };
}

export async function runGamePlaywright(argv = process.argv.slice(2)) {
  const options = parsePlaywrightRunnerArgs(argv);
  if (options.help) {
    console.log(PLAYWRIGHT_RUNNER_USAGE);
    return;
  }
  const backendPort = await findFreePort(Number(process.env.PLAYWRIGHT_TEST_BACKEND_PORT || 3321));
  const frontendPort = await findFreePort(Number(process.env.PLAYWRIGHT_TEST_FRONTEND_PORT || 4374));
  const label = `game:test:${options.suite}`;
  console.log(`[${label}] backend port ${backendPort}`);
  console.log(`[${label}] frontend port ${frontendPort}`);
  if (options.debug) console.log(`[${label}] debug logs enabled`);
  return runConfiguredSuite({
    command: 'npx',
    args: buildPlaywrightArgs(options),
    cwd: repoRoot,
    env: buildPlaywrightEnv({ ...options, backendPort, frontendPort })
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runGamePlaywright().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
