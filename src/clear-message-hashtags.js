import { clearMessageHashtagsBatch } from './lib/workflow.js';

function parseArgs(argv) {
  const args = { ids: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === '--ids') {
      args.ids = String(argv[index + 1] || '')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
      index += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.ids.length === 0) {
  process.stderr.write('Usage: node src/clear-message-hashtags.js --ids 3,4,5\n');
  process.exit(1);
}

clearMessageHashtagsBatch(args.ids).then((results) => {
  const lines = results.map((result) => {
    if (!result.ok) {
      return `Failed ${result.messageId}: ${result.error}`;
    }
    return `Cleared ${result.messageId}${result.processed?.messageFile ? ` -> ${result.processed.messageFile}` : ''}`;
  });
  process.stdout.write(`${lines.join('\n')}\n`);
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
