import { config } from './config.js';
import { createTelegramClient, getChannelEntity } from './lib/telegram.js';

async function main() {
  const messageId = Number(process.argv[2]);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    throw new Error('Usage: node src/debug-message.js <message-id>');
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

    process.stdout.write(
      JSON.stringify(
        {
          id: message.id,
          date: message.date,
          message: message.message,
          hasMedia: Boolean(message.media),
          mediaClass: message.media?.className || null,
          file: message.file
            ? {
                name: message.file.name,
                mimeType: message.file.mimeType
              }
            : null
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await telegram.disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
