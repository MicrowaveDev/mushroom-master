import { spawn } from 'child_process';
import net from 'net';
import path from 'path';

const repoRoot = '/Users/microwavedev/workspace/mushroom-master';
const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const backendPort = Number(process.env.PORT || 3021);
const frontendPort = 4174;

function startProcess(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env
    },
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      // eslint-disable-next-line no-console
      console.log(`[${name}] exited with signal ${signal}`);
      return;
    }
    if (code !== 0) {
      // eslint-disable-next-line no-console
      console.log(`[${name}] exited with code ${code}`);
      process.exitCode = code || 1;
    }
  });

  return child;
}

function waitForPort(port, { host = '127.0.0.1', timeoutMs = 20000, intervalMs = 150 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host, port });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
        } else {
          setTimeout(attempt, intervalMs);
        }
      });
    };
    attempt();
  });
}

const backend = startProcess('backend', process.execPath, ['app/server/start.js'], {
  PORT: String(backendPort)
});

let frontend = null;
function shutdown(signal) {
  backend.kill(signal);
  if (frontend) frontend.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// eslint-disable-next-line no-console
console.log(`Game dev stack starting: backend http://127.0.0.1:${backendPort}, frontend http://127.0.0.1:${frontendPort}`);

waitForPort(backendPort).then(() => {
  frontend = startProcess('frontend', process.execPath, [viteBin, '--config', 'web/vite.config.js', '--host', '127.0.0.1', '--port', String(frontendPort)], {});
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[dev] backend failed to become ready: ${err.message}`);
  shutdown('SIGTERM');
  process.exitCode = 1;
});
