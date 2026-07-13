import { spawn } from 'node:child_process';

const commands = [
  ['npm', ['run', 'game:artifacts:next', '--', '--limit=8']],
  ['npm', ['run', 'game:artifacts:provenance:check']],
  ['npm', ['run', 'game:artifacts:validate', '--', '--all']],
  ['npm', ['run', 'game:artifacts:sheet', '--', '--validate-only']],
  ['npm', ['run', 'game:artifacts:thumbnail-review']],
  ['npm', ['run', 'game:fusions:check']],
  ['npm', ['run', 'game:build']],
  ['npm', ['run', 'game:test:e2e']]
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(' ')}`);
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed${signal ? ` with signal ${signal}` : ` with code ${code}`}`));
    });
  });
}

for (const [command, args] of commands) {
  await run(command, args);
}

console.log('\nArtifact/fusion release check passed.');
