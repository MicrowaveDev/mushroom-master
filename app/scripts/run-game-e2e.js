import net from 'net';
import { spawn } from 'child_process';

/**
 * Run the full Playwright E2E suite (all *.spec.js files).
 * Port selection logic matches run-game-screenshot-check.js.
 */

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
      server.close(() => {
        if (!chosenPort) {
          reject(new Error('Could not read ephemeral port'));
          return;
        }
        resolve(chosenPort);
      });
    });
  });
}

async function findFreePort(preferredPort) {
  const preferred = await tryPort(preferredPort);
  if (preferred) {
    return preferred;
  }
  return takeEphemeralPort();
}

async function main() {
  const backendPort = await findFreePort(Number(process.env.PLAYWRIGHT_TEST_BACKEND_PORT || 3321));
  const frontendPort = await findFreePort(Number(process.env.PLAYWRIGHT_TEST_FRONTEND_PORT || 4374));

  console.log(`[game:test:e2e] backend port ${backendPort}`);
  console.log(`[game:test:e2e] frontend port ${frontendPort}`);

  const child = spawn(
    'npx',
    ['playwright', 'test', '--config=tests/game/playwright.config.js', '--reporter=line'],
    {
      cwd: '/Users/microwavedev/workspace/mushroom-master',
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_TEST_BACKEND_PORT: String(backendPort),
        PLAYWRIGHT_TEST_FRONTEND_PORT: String(frontendPort),
        VITE_REPLAY_AUTOPLAY_MS: process.env.VITE_REPLAY_AUTOPLAY_MS || '320',
        VITE_REPLAY_AUTOPLAY_FAST_MS: process.env.VITE_REPLAY_AUTOPLAY_FAST_MS || '180'
      }
    }
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
