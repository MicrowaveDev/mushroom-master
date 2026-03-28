import { config } from './config.js';
import { createTelegramClient, fetchChannelMessages, getChannelEntity } from './lib/telegram.js';

async function main() {
  const limit = Number(process.argv[2] || config.messageLimit);
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

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
