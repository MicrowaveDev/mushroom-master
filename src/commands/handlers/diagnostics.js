import { config } from '../../config/index.js';
import { createTelegramClient, fetchChannelMessages, getChannelEntity } from '../../lib/telegram.js';

export async function debugHistory(argv) {
  const limit = Number(argv[0] || config.messageLimit);
  const telegram = await createTelegramClient({
    apiId: config.telegramApiId,
    apiHash: config.telegramApiHash,
    stringSession: config.clientToken
  });

  try {
    const entity = await getChannelEntity(telegram, config.channelUsername);
    const messages = await fetchChannelMessages(telegram, entity, limit);
    const ids = messages.map((message) => message.id);
    process.stdout.write(JSON.stringify(ids, null, 2) + '\n');
  } finally {
    await telegram.disconnect();
  }
}

export async function debugMessage(argv) {
  const messageId = Number(argv[0]);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    const error = new Error('Usage: npm run debug:message -- <message-id>');
    error.name = 'UsageError';
    throw error;
  }
  const telegram = await createTelegramClient({
    apiId: config.telegramApiId,
    apiHash: config.telegramApiHash,
    stringSession: config.clientToken
  });
  try {
    const entity = await getChannelEntity(telegram, config.channelUsername);
    const [message] = await telegram.getMessages(entity, { ids: [messageId] });
    if (!message) {
      process.stdout.write(`Message ${messageId} not found.\n`);
      return;
    }
    process.stdout.write(JSON.stringify({
      id: message.id,
      date: message.date,
      message: message.message,
      hasMedia: Boolean(message.media),
      mediaClass: message.media?.className || null,
      file: message.file ? { name: message.file.name, mimeType: message.file.mimeType } : null
    }, null, 2) + '\n');
  } finally {
    await telegram.disconnect();
  }
}
