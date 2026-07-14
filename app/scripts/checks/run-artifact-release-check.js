import { runCommandSequence } from '@microwavedev/backpack-game-core/tooling/release';

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

await runCommandSequence(commands);

console.log('\nArtifact/fusion release check passed.');
