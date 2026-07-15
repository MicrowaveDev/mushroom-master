import {
  backfillPostedMessageIds,
  cleanDuplicateTextMessages,
  clearMessageHashtagsBatch,
  rebuildOcrReposts,
  setMessageHashtagsBatch,
  setMessageHashtagsById,
  setOcrHashtagsBatch,
  updateTextMessageById
} from '../../lib/workflow.js';

function usage(message) {
  const error = new Error(message);
  error.name = 'UsageError';
  throw error;
}

function parseIds(value) {
  return String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function parseHashtags(value) {
  return String(value || '').split(/\s+/u).map((tag) => tag.trim()).filter(Boolean);
}

function parseMessageHashtagArgs(argv) {
  const args = { id: null, ids: [], hashtags: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === '--id') {
      args.id = Number(argv[index + 1]);
      index += 1;
    } else if (part === '--ids') {
      args.ids = parseIds(argv[index + 1]);
      index += 1;
    } else if (part === '--hashtags') {
      args.hashtags = parseHashtags(argv[index + 1]);
      index += 1;
    }
  }
  return args;
}

export async function setMessageHashtags(argv) {
  const args = parseMessageHashtagArgs(argv);
  if ((!Number.isInteger(args.id) || args.id <= 0) && args.ids.length === 0) {
    usage('Usage: npm run set-message-hashtags -- --id <messageId> --hashtags "#general_lore #character_thalla"\n   or: npm run set-message-hashtags -- --ids 3,4,5 --hashtags "#general_lore"');
  }
  if (args.ids.length > 0) {
    const results = await setMessageHashtagsBatch(
      args.ids.map((messageId) => ({ messageId, hashtags: args.hashtags }))
    );
    const lines = results.map((result) => {
      if (!result.ok) return `Failed ${result.messageId}: ${result.error}`;
      return `Updated ${result.messageId}${result.processed?.messageFile ? ` -> ${result.processed.messageFile}` : ''}`;
    });
    process.stdout.write(`${lines.join('\n')}\n`);
    return;
  }
  const result = await setMessageHashtagsById(args.id, args.hashtags);
  process.stdout.write([
    `Updated hashtags for Telegram message ${args.id}.`,
    result?.messageFile ? `Refreshed markdown: ${result.messageFile}` : 'No local markdown was refreshed.'
  ].join('\n') + '\n');
}

export async function setOcrHashtags(argv) {
  const idsIndex = argv.indexOf('--ids');
  const hashtagsIndex = argv.indexOf('--hashtags');
  const ids = parseIds(idsIndex === -1 ? '' : argv[idsIndex + 1]);
  const hashtags = parseHashtags(hashtagsIndex === -1 ? '' : argv[hashtagsIndex + 1]);
  if (!ids.length) usage('Usage: npm run set-ocr-hashtags -- --ids 5,6,7 --hashtags "#general_lore #character_thalla"');
  const results = await setOcrHashtagsBatch(ids.map((sourceMessageId) => ({ sourceMessageId, hashtags })));
  process.stdout.write(`${results.map((result) => result.ok
    ? `Updated OCR ${result.sourceMessageId} -> ${result.generatedFile}`
    : `Failed ${result.sourceMessageId}: ${result.error}`).join('\n')}\n`);
}

export async function clearMessageHashtags(argv) {
  const index = argv.indexOf('--ids');
  const ids = parseIds(index === -1 ? '' : argv[index + 1]);
  if (!ids.length) usage('Usage: npm run clear-message-hashtags -- --ids 3,4,5');
  const results = await clearMessageHashtagsBatch(ids);
  process.stdout.write(`${results.map((result) => result.ok
    ? `Cleared ${result.messageId}${result.processed?.messageFile ? ` -> ${result.processed.messageFile}` : ''}`
    : `Failed ${result.messageId}: ${result.error}`).join('\n')}\n`);
}

export async function updateTextMessage(argv) {
  const idIndex = argv.indexOf('--id');
  const textIndex = argv.indexOf('--text');
  const id = Number(idIndex === -1 ? NaN : argv[idIndex + 1]);
  const text = textIndex === -1 ? null : argv[textIndex + 1] || '';
  if (!Number.isInteger(id) || id <= 0 || text == null) {
    usage('Usage: npm run update-text-message -- --id <messageId> --text <newText>');
  }
  const result = await updateTextMessageById(id, text);
  process.stdout.write([
    `Updated Telegram message ${id}.`,
    result?.messageFile ? `Refreshed markdown: ${result.messageFile}` : 'No local markdown was refreshed.'
  ].join('\n') + '\n');
}

export async function backfillMessageIds() {
  const result = await backfillPostedMessageIds();
  process.stdout.write(`Updated ${result.repaired.length} OCR metadata records.\nReport: ${result.reportPath}\n`);
}

export async function rebuildReposts() {
  const result = await rebuildOcrReposts();
  process.stdout.write(`Rebuilt ${result.rebuilt.length} OCR repost records.\nReport: ${result.reportPath}\n`);
}

export async function cleanTextDuplicates() {
  const result = await cleanDuplicateTextMessages();
  process.stdout.write(`Cleaned ${result.changedIds.length} text messages.\nReport: ${result.reportPath}\n`);
}
