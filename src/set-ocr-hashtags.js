import { setOcrHashtagsBatch } from './lib/workflow.js';

function parseArgs(argv) {
  const args = { ids: [], hashtags: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === '--ids') {
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

if (args.ids.length === 0) {
  process.stderr.write('Usage: node src/set-ocr-hashtags.js --ids 5,6,7 --hashtags "#general_lore #character_thalla"\n');
  process.exit(1);
}

setOcrHashtagsBatch(
  args.ids.map((sourceMessageId) => ({ sourceMessageId, hashtags: args.hashtags }))
).then((results) => {
  const lines = results.map((result) => {
    if (!result.ok) {
      return `Failed ${result.sourceMessageId}: ${result.error}`;
    }
    return `Updated OCR ${result.sourceMessageId} -> ${result.generatedFile}`;
  });
  process.stdout.write(`${lines.join('\n')}\n`);
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
