import { updateTextMessageById } from './lib/workflow.js';

function parseArgs(argv) {
  const args = { id: null, text: null };
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === '--id') {
      args.id = Number(argv[index + 1]);
      index += 1;
    } else if (part === '--text') {
      args.text = argv[index + 1] || '';
      index += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!Number.isInteger(args.id) || args.id <= 0 || args.text == null) {
  process.stderr.write('Usage: node src/update-text-message.js --id <messageId> --text <newText>\n');
  process.exit(1);
}

updateTextMessageById(args.id, args.text).then((result) => {
  process.stdout.write(
    [
      `Updated Telegram message ${args.id}.`,
      result?.messageFile ? `Refreshed markdown: ${result.messageFile}` : 'No local markdown was refreshed.'
    ].join('\n') + '\n'
  );
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
