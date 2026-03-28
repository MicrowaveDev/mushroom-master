import { setMessageHashtagsBatch, setMessageHashtagsById } from './lib/workflow.js';

function parseArgs(argv) {
  const args = { id: null, ids: [], hashtags: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === '--id') {
      args.id = Number(argv[index + 1]);
      index += 1;
    } else if (part === '--ids') {
      args.ids = String(argv[index + 1] || '')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
      index += 1;
    } else if (part === '--hashtags') {
      args.hashtags = String(argv[index + 1] || '')
        .split(/\s+/u)
        .map((tag) => tag.trim())
        .filter(Boolean);
      index += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if ((!Number.isInteger(args.id) || args.id <= 0) && args.ids.length === 0) {
  process.stderr.write('Usage: node src/set-message-hashtags.js --id <messageId> --hashtags "#general_lore #character_thalla"\n');
  process.stderr.write('   or: node src/set-message-hashtags.js --ids 3,4,5 --hashtags "#general_lore"\n');
  process.exit(1);
}

if (args.ids.length > 0) {
  setMessageHashtagsBatch(
    args.ids.map((messageId) => ({ messageId, hashtags: args.hashtags }))
  ).then((results) => {
    const lines = results.map((result) => {
      if (!result.ok) {
        return `Failed ${result.messageId}: ${result.error}`;
      }
      return `Updated ${result.messageId}${result.processed?.messageFile ? ` -> ${result.processed.messageFile}` : ''}`;
    });
    process.stdout.write(`${lines.join('\n')}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
} else {
  setMessageHashtagsById(args.id, args.hashtags).then((result) => {
    process.stdout.write(
      [
        `Updated hashtags for Telegram message ${args.id}.`,
        result?.messageFile ? `Refreshed markdown: ${result.messageFile}` : 'No local markdown was refreshed.'
      ].join('\n') + '\n'
    );
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
