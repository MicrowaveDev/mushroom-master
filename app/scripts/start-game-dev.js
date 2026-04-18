import { spawn } from 'child_process';
import path from 'path';

const repoRoot = '/Users/microwavedev/workspace/mushroom-master';
const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');

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

const backend = startProcess('backend', process.execPath, ['app/server/start.js'], {
  PORT: process.env.PORT || '3021'
});

const frontend = startProcess('frontend', process.execPath, [viteBin, '--config', 'web/vite.config.js', '--host', '127.0.0.1', '--port', '4174'], {});

function shutdown(signal) {
  backend.kill(signal);
  frontend.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// eslint-disable-next-line no-console
console.log('Game dev stack starting: backend http://127.0.0.1:3021, frontend http://127.0.0.1:4174');
