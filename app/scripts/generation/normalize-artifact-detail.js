import { runChildProcessSync } from '@microwavedev/backpack-game-core/tooling/runners';
import { normalizeArtifacts } from '../lib/artifact-detail-normalizer.js';

function parseArgs(argv) {
  return {
    all: argv.includes('--all'),
    ids: argv.filter((arg) => arg !== '--all').map((arg) => arg.replace(/\.png$/, ''))
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.all && options.ids.length === 0) {
    throw new Error('Usage: npm run game:artifacts:normalize-detail -- --all OR npm run game:artifacts:normalize-detail -- artifact_id [...]');
  }
  const results = normalizeArtifacts(options);
  for (const result of results) {
    console.log(`${result.changed ? 'normalized' : 'rewrote'} ${result.id} (${result.policy})`);
  }
  const ids = results.map((result) => result.id);
  const validation = runChildProcessSync('npm', ['run', 'game:artifacts:validate', '--', ...ids], {
    stdio: 'inherit',
    allowFailure: true
  });
  if (validation.status !== 0) process.exit(validation.status ?? 1);
  console.log('Provenance invalidated by byte changes; review the PNGs, then run game:artifacts:provenance:generate.');
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
