import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repoRoot } from '../../shared/repo-root.js';

export const PLAYWRIGHT_SUITES = Object.freeze({
  e2e: [],
  screens: [
    'tests/game/screenshots.spec.js',
    'tests/game/home-field-preview.spec.js'
  ]
});

export const PLAYWRIGHT_RUNNER_USAGE = `Usage: node app/scripts/runners/run-game-playwright.js [options]

Options:
  --suite=e2e|screens  Select the Playwright suite (default: e2e)
  --debug              Enable screenshot-suite debug logs
  --help, -h           Show this help`;

export function parsePlaywrightRunnerArgs(argv) {
  const suiteArg = argv.find((arg) => arg.startsWith('--suite='));
  const suite = suiteArg?.slice('--suite='.length) || 'e2e';
  if (!Object.hasOwn(PLAYWRIGHT_SUITES, suite)) {
    throw new Error(`Unknown Playwright suite "${suite}". Expected: ${Object.keys(PLAYWRIGHT_SUITES).join(', ')}`);
  }
  return {
    suite,
    debug: argv.includes('--debug'),
    help: argv.includes('--help') || argv.includes('-h')
  };
}

export function buildPlaywrightArgs({ suite }) {
  return [
    'playwright',
    'test',
    ...PLAYWRIGHT_SUITES[suite],
    '--config=tests/game/playwright.config.js',
    '--reporter=line'
  ];
}

export function buildPlaywrightEnv({ suite, debug, backendPort, frontendPort }, env = process.env) {
  return {
    ...env,
    PLAYWRIGHT_TEST_BACKEND_PORT: String(backendPort),
    PLAYWRIGHT_TEST_FRONTEND_PORT: String(frontendPort),
    PLAYWRIGHT_SCREEN_DEBUG: suite === 'screens' && debug
      ? '1'
      : env.PLAYWRIGHT_SCREEN_DEBUG || '',
    VITE_REPLAY_AUTOPLAY_MS: env.VITE_REPLAY_AUTOPLAY_MS || '320',
    VITE_REPLAY_AUTOPLAY_FAST_MS: env.VITE_REPLAY_AUTOPLAY_FAST_MS || '180'
  };
}

function tryPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(null));
    server.listen({ port, host: '127.0.0.1' }, () => {
      const address = server.address();
      const chosenPort = typeof address === 'object' && address ? address.port : port;
      server.close(() => resolve(chosenPort));
    });
  });
}

function takeEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = server.address();
      const chosenPort = typeof address === 'object' && address ? address.port : null;
      server.close(() => chosenPort
        ? resolve(chosenPort)
        : reject(new Error('Could not read ephemeral port')));
    });
  });
}

async function findFreePort(preferredPort) {
  return await tryPort(preferredPort) || takeEphemeralPort();
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

  const child = spawn('npx', buildPlaywrightArgs(options), {
    cwd: repoRoot,
    stdio: 'inherit',
    env: buildPlaywrightEnv({ ...options, backendPort, frontendPort })
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runGamePlaywright().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
